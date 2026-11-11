# San Diego Car Care Price Checker

Mobile-first San Diego County price checks, report email, weekly deals signup and optional shop quote requests. Node 24 serves the app; Render Postgres holds production records. Local development uses SQLite. The existing Render resource/hostname and Git branch retain their original technical names; customer-facing pages, reporting and pricing are San Diego-specific.

## Current funnel

- Headline: “Is your quote fair?” Ad angles change the small line above it.
- Time promise: “under a minute.” No claim of a measured 30-second completion time.
- Vehicle, service and quote screens show only researched combinations. The public catalog exposes availability, not prices.
- First name and email are the only email-gate fields. The button is followed by “You'll also get our free weekly San Diego deals. Unsubscribe anytime.” The server stores the disclosure text and timestamp; no newsletter checkbox is required.
- ZIP is collected when requesting quotes. San Diego County coverage uses 919/920/921 prefixes; this is not postal-address verification.
- No empty partner cards. At least two vetted, active, paid placements with actual deal text are required for the offers section. Use Shops in admin to mark a paid placement active. Quote routing still requires separate consent and goes to at most three named shops.

## Pricing and research

See [PRICING-SOURCES.md](PRICING-SOURCES.md). Bundled San Diego research seeds load idempotently into market-specific tables at startup; existing owner overrides are preserved. Old Phoenix price ranges and report links do not feed San Diego results. Approved recent quotes must belong to a San Diego check before they contribute.

Exact option/body-type ranges take priority. An unspecified ceramic-coating duration uses the broader coating/body-type range. Coverage-specific services do not inherit unrelated job scopes. Unresearched options are hidden, and direct attempts to price them are rejected before the gate. PPF, wraps, van categories, and other unsupported options stay hidden until researched ranges are added. Add verified ranges in Seed prices to make combinations available; the availability cache refreshes on updates.

Published rates are asking/starting prices, not completed customer transactions. Low/high are observed bounds of the documented sample and typical is its median. The app labels the result as a seed estimate and explains that product, preparation and coverage vary. Ten approved quotes within twelve months enable the existing trimmed percentile calculation. Broader fallback ranges are explicitly identified by `source: service-fallback`.

## Run and test

Install Node 24 and run `corepack pnpm install`. Copy `.env.example` to `.env`, then `node --env-file=.env server/index.mjs`. Alternatively run `node server/index.mjs` for local defaults at http://localhost:3000. Set `ADMIN_PASSWORD` to use `/admin`. Run `node --test tests/*.test.mjs` for server-flow and pricing tests.

## Production configuration

Set these in the Render web service Environment panel:

| Purpose | Variables |
| --- | --- |
| Public report links | `PUBLIC_URL` (otherwise uses Render's external URL) |
| Spam verification | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Reports and shop notifications | `RESEND_API_KEY`, `EMAIL_FROM` (verified sender), `ADMIN_EMAIL` |
| Weekly deals | `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` |
| Meta tracking | `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_API_VERSION` |

Create beehiiv fields `vehicle`, `service`, `verdict`, `zip`. ZIP is blank at signup and can be collected later with a quote request. Verify your publication and tracking assets target San Diego. Never commit credentials. Production submissions fail closed until Turnstile is configured. Missing mail credentials leave jobs pending, and the UI reports that state. After setting provider credentials, retry pending jobs from the admin Delivery queue and test delivery end to end.

Private report links restore answers into the quote-request ZIP step and expire after 30 days. Keep those links private. Report emails use “Caesar from San Diego Car Care Deals.” Subscriber emails are omitted from shop notifications and lead exports.

The email queue runs every minute within one web instance. Free Render web services sleep on idle, and free Postgres expires after 30 days. Upgrade before sustained ad traffic, establish database backups, and move queue claiming to a worker before scaling instances. Owner access uses an HttpOnly cookie; rate limiting is process-local. Confirm business/support details, retention practices and the contact-consent text before selling leads.
