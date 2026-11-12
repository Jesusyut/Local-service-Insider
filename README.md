# Phoenix Car Care — photo-card quiz

## Current new-request flow

New requests on `/` and `/pick` start with a service photo card, then capture first name, email and phone before asking for year, make, model and a desired completion date. There are no package, vehicle-type or quote-entry screens in this flow. The final estimate aggregates the service's seeded package/body-type ranges and is explicitly labeled broad; it does not assume a vehicle class. Smog remains the fixed state-station OBD fee and requires a 1996+ vehicle. The desired date is not a booking.

`/api/intake` saves contact details and the displayed disclosures immediately, emits a deduplicated Lead event, and never distributes phone details to shops. `/api/intake/estimate` saves vehicle/date details and queues the estimate email. The owner dashboard's Intake leads tab includes incomplete and completed requests. Turnstile is optional: set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to enable it. Without both, form validation and submission rate limits remain active. Existing report-return links and partner-consent endpoints remain compatible with prior reports.

The current version uses the supplied November 10 campaign deck, with the user's explicit overrides: two-field email gate, newsletter disclosure below the button, ZIP at quote requests, no empty partner cards, and mobile headline sizing. `server/campaign-copy.json` is the copy inventory keyed by element ID. Landing headlines read `?angle=quote`, `?angle=cost`, or `?angle=heat` exactly from the deck; the longer variants use smaller type to fit two lines at 390px.

Seven ordered services: Window tint, Mobile detailing, Ceramic coating, Body shop, Starlight headliner, Oil change, Custom lighting. The first two photos load eagerly; the remaining five are lazy. All seven files live under `public/images/`, are 600×450 WebP, and are approximately 20–41 KB each. The ceramic image was recovered from the deck's exact source URL because only six images were attached. There are no hotlinked image dependencies.

## Pricing

See [PRICING-SOURCES.md](PRICING-SOURCES.md). There are 120 supported service-option/body-type combinations. Exact research seed ranges take priority, then the service/body-type fallback. Published asking/starting prices and composite package calculations are estimates, not a survey of transactions. See each stored `source_note` for scope limitations. In particular headlight upgrades use a broader local custom-lighting range, and coating one-year/unspecified durations use the broader coating service range. Body-work estimates are broad because severity and replacement parts are unknown.

Market key `phoenix-photo-v1` keeps these seeds and reports separate from prior San Diego and Phoenix versions. Existing data is preserved. Bundled seeds load idempotently; owner edits are not overwritten. Admin is `/admin`, with owner password in Render's `ADMIN_PASSWORD` variable. Edit individual prices in Seed prices. Enter actual partner shops in Shops; deals only display when at least two vetted, paid, active offers exist. Routing still requires separate contact consent and goes to no more than three named partners. Subscriber emails are excluded from shop notifications and lead exports.

## Tracking and delivery

Meta browser events: `ViewContent` on landing, `Lead` after report signup, and custom `QuoteRequest` after phone submission. Server events share the same event IDs for deduplication. `public/tracking.js` queues before SDK load and dispatches via `callMethod` after loading. Backend events retain hashed contact identifiers. Render's public URL is used as event source when `PUBLIC_URL` is absent.

Configure `META_PIXEL_ID`, `META_ACCESS_TOKEN`, and `META_API_VERSION` to deliver real Meta events. Optionally configure both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to enable the additional bot check; absent or incomplete keys do not block form submissions. For reports set `RESEND_API_KEY`, verified `EMAIL_FROM`, and optionally `ADMIN_EMAIL`. For the weekly list set `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` and create vehicle/service/verdict/zip fields. Never post or commit keys. Missing providers leave delivery jobs pending. The requested “sent” note appears only after Resend accepts delivery; it stays blank otherwise to avoid adding unsupported page copy or falsely claiming delivery.

Email gate records the exact Phoenix disclosure and timestamp. ZIP is collected only when visitors request quotes. Contact consent remains separate and stored with named partner shops. Public pages have no site menu or footer; legal links remain at the email and phone buttons. Existing legal pages are operational copy and should be finalized with the business details before selling leads.

## Validation and development

Node 24: `corepack pnpm install`, then `node server/index.mjs` or `node --env-file=.env server/index.mjs`. Local SQLite is for development; production requires Postgres. Run `node --test tests/*.test.mjs`.

13 tests cover all seed combinations, asset format/budget, two-field signup, private pricing, admin protection, routing, paid-deal thresholds, and Meta event dispatch/deduplication. A local 390×844 automated browser run from start through the full report took 29 seconds. It is not a physical-phone user study or a measured 4G first-load guarantee. The long cost headline occupied two lines at 390px; all image dimensions and eager/lazy settings were checked in the browser.

Free Render web services sleep on idle and free Postgres expires after 30 days. Upgrade before sustained paid traffic, establish backups/retention practices, and move queue claiming to a separate worker before horizontal scaling. Queue delivery currently runs inside one web instance.
