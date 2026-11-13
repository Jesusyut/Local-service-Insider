# Local Insider turf pipeline

Independent API and vanilla static funnel. The existing static service and legacy pages are unchanged. Work is split into stacked phase PRs; merge in build order. No new resources are provisioned just by opening these PRs.

## Local development

Use Node 20 or newer and pnpm 11.25.0. Inside `api/`, run `pnpm install --frozen-lockfile`. Copy `.env.example` to an untracked `.env` and set `DATABASE_URL` for a dedicated PostgreSQL database. Load the file with `node --env-file=.env src/migrate.js`, then `node --env-file=.env src/seed.js` (never production), then `node --env-file=.env src/server.js`. Run `pnpm test` for the acceptance suite. Tests use real PostgreSQL SQL in PGlite with isolated databases; deployed PostgreSQL and live-provider smoke tests remain deployment checks.

The demo seed creates a fictional partner, three synthetic ZIPs and all seven days of availability. Its timezone is `DEMO_TIMEZONE` or the non-geographic UTC standard. No phone recipient is invented. Seed delivery flags stay false.

Serve the repo root with any static HTTP server. Set `turf/js/config.js` to the public API origin (and optional public Pixel ID). The static frontend has no build step; these public settings must be set at deployment. Provider secrets never belong in that file. `PUBLIC_SITE_URL` is the static site's origin, and `API_BASE_URL` is the API's public origin. Neither has a geographic default. Phone entry requires an international country code instead of silently choosing one.

## Render deployment

The additive Blueprint declares `turf-api`, `turf-db`, and `turf-tick`. Review the current Render prices before provisioning paid resources. Existing `local-service-insider` settings remain byte-for-byte intact. No paid deployment or merge is performed by this task.

API service migrations run before deploy. The API's one-second delivery loop processes newly queued notifications promptly; the five-minute cron invokes an authenticated API tick for follow-ups and recovery. Cron carries only `API_BASE_URL` and `TICK_SECRET` from the API, never copied messaging credentials. Keep the paid API service awake for speed-to-lead behavior. Match the two public URL env vars exactly to deployed HTTPS origins.

Set `ADMIN_PASSWORD_HASH` to a bcrypt hash generated privately, `MAGIC_LINK_SECRET` to a random secret of at least 32 characters, and `TICK_SECRET` to the Blueprint-generated shared secret. Partner login is `/partner` on the API origin; owner login is `/admin` on that origin. Magic links arrive by email, expire after seven days and exchange a fragment token for a scoped session. Owner sessions expire after eight hours. The portals never share sessions.

The API uses runtime environment variables for deployment-specific settings. Blueprint sync preserves these omitted service variables; do not add secret literals to `render.yaml`. Configure Twilio, Resend or SMTP, Meta and owner alerts using `.env.example` as the key inventory. Set `META_GRAPH_VERSION` explicitly to your app's supported API version. `EMAIL_ENABLED` and `META_ENABLED` are separate opt-in flags; all three providers default off. Read [the A2P checklist](docs/A2P.md) before activating SMS.

## Business and operational behavior

- Routing is exclusive by ZIP and active partner. Area labels only affect displayed copy and attribution. They never determine routing, state, timezone, currency assumptions beyond the requested USD ledger, or phone country.
- Consent text/version/time/IP are retained on every submission, including duplicates. Same-phone submissions within 30 days return the original booking token. STOP persists in a separate phone suppression table even after that window.
- Bookings serialize on lead and partner advisory locks in PostgreSQL, and availability / blackout changes use the same partner lock. All appointment writes go through those services. Booking records snapshot commission and show-fee terms; territory changes do not move booked jobs.
- Slots cover fourteen partner-local calendar days, advance in thirty-minute increments and require three hours of notice. Booking collects the install address. Calendar links, cancellation and rescheduling use the opaque booking token. Treat this link as private; booking pages have no-referrer and noindex metadata.
- Every queued send has a unique delivery key. Successful or simulated delivery stamps the matching reminder / follow-up field. A repeated tick does not schedule it twice. Provider errors back off for three attempts, then enter the failure dashboard and notify the owner's email. Do not manually replay messages without checking provider history.
- Quiet hours take precedence over an exact reminder time and over immediate partner SMS. Messages that become stale after reschedule/cancellation or appointment start are discarded. Missed follow-ups after downtime are collapsed to the latest step, with audit entries for skipped steps. A reminder inside quiet hours may be delayed or skipped if its appointment starts first.
- Any homeowner reply ends the unbooked nudge sequence. STOP also blocks confirmations, reminders and queued SMS tied to that lead; there is no automated reactivation. `C` confirms an active appointment and `R` queues the manage link. Unassigned leads still count, including `just_pricing`.
- Weekly availability and blackout changes are audited. Dates entered in the partner editor are interpreted in the partner timezone. Blackouts cannot silently invalidate an existing booking.
- Ledger amounts are immutable at the database level. Changing a sold value, deposit status or showed status creates a net adjustment. Invoice/paid timestamps can change, but amounts cannot. Commission becomes earned when sold has a paid-deposit timestamp. Minimum job value is a partner configuration field, not an undocumented commission exclusion.
- A Purchase event is queued once on the first recorded sale. Later job-value changes correct the financial ledger; they do not generate another Purchase and overcount sales. Lead Pixel/CAPI events share event name and UUID for deduplication.
- Dashboard dates are lead-created cohorts; booked/showed/sold counts and earnings follow those leads. Monthly spend is whole-month input, including when a campaign filter is selected; the UI says so. Credits and reversals are included in net earnings. Rates with no denominator show zero, costs show a dash.
- Every admin override requires a reason and writes an audit event. Partners cannot access territory, terms or ledger mutation endpoints. Notification opt-in does not authorize unrelated marketing.

## Launch gates

Provision and configure the dedicated API/database/cron, set the static API origin, onboard a real partner with exclusive ZIPs and availability, and run an end-to-end deployment smoke test. Approval of A2P, provider keys, real recipient consent, approved privacy/terms URLs and a real partner are external requirements; they are not fabricated by the demo seed. SMS stays false until the owner completes those gates. Keep the existing live funnels on their existing branches and services.
