# Phoenix Car Care — photo-card quiz

## Current new-request flow

New requests on `/price-check` start with a service photo card, then capture first name, email and phone before asking for year, make, model and a desired completion date. There are no package, vehicle-type or quote-entry screens in this flow. The final estimate aggregates the service's seeded package/body-type ranges and is explicitly labeled broad; it does not assume a vehicle class. Smog remains the fixed state-station OBD fee and requires a 1996+ vehicle. The desired date is not a booking.

`/api/intake` saves contact details and the displayed disclosures immediately, emits a deduplicated Lead event, and never distributes phone details to shops. `/api/intake/estimate` saves vehicle/date details and queues the estimate email. The owner dashboard's Intake leads tab includes incomplete and completed requests. Turnstile is optional: set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to enable it. Without both, form validation and submission rate limits remain active. Existing report-return links and partner-consent endpoints remain compatible with prior reports.

The current version uses the supplied November 10 campaign deck, with the user's explicit overrides: two-field email gate, newsletter disclosure below the button, ZIP at quote requests, no empty partner cards, and mobile headline sizing. `server/campaign-copy.json` is the copy inventory keyed by element ID. Landing headlines read `?angle=quote`, `?angle=cost`, or `?angle=heat` exactly from the deck; the longer variants use smaller type to fit two lines at 390px.

Seven ordered services: Window tint, Mobile detailing, Ceramic coating, Body shop, Starlight headliner, Oil change, Custom lighting. The first two photos load eagerly; the remaining five are lazy. All seven files live under `public/images/`, are 600×450 WebP, and are approximately 20–41 KB each. The ceramic image was recovered from the deck's exact source URL because only six images were attached. There are no hotlinked image dependencies.

## Home page: Local Car Care

`/` is the Local Car Care page (`public/index.html`, `home.css`, `home.js`). `/pick` is retired and 301-redirects to `/` with its query string, so existing ad links keep their `?angle=` and UTM values. The earlier price checker (photo-card quiz below) moved to `/price-check`; old report-email links (`/#request=…`) are forwarded there, and new report emails link to `/price-check#request=…` directly.

Flow: landing, then step 1, pick a service (the two landing photos are clickable and jump straight to step 2 with that service chosen), then step 2, first name, email and mobile number, one field per screen, then the local price label (`POST /api/intake/rate`, a broad range across packages and body types, emailed to the visitor), then **Text me a quote**: year, make, model, a day in the next six days, a time of day and contact consent (`POST /api/intake/quote`). Quote requests are stored in `intake_quote_requests`, fire a deduplicated `QuoteRequest` event, and email `ADMIN_EMAIL` when it is set. The owner dashboard's Intake leads tab shows the requested time and "Quote requested".

Landing headline angles: `?angle=trust` (default), `convenience`, `quality`, `onestop`. Barlow fonts are self-hosted under `public/fonts/` (SIL OFL, see `OFL.txt`) because the CSP allows only same-origin styles and fonts. The Google rating badge is `public/images/google-stars.png`; keep the 5-star claim true for every shop you route to.

## Price checker at /price-check

## Pricing

See [PRICING-SOURCES.md](PRICING-SOURCES.md). There are 120 supported service-option/body-type combinations. Exact research seed ranges take priority, then the service/body-type fallback. Published asking/starting prices and composite package calculations are estimates, not a survey of transactions. See each stored `source_note` for scope limitations. In particular headlight upgrades use a broader local custom-lighting range, and coating one-year/unspecified durations use the broader coating service range. Body-work estimates are broad because severity and replacement parts are unknown.

Market key `phoenix-photo-v1` keeps these seeds and reports separate from prior San Diego and Phoenix versions. Existing data is preserved. Bundled seeds load idempotently; owner edits are not overwritten. Admin is `/admin`, with owner password in Render's `ADMIN_PASSWORD` variable. Edit individual prices in Seed prices. Enter actual partner shops in Shops; deals only display when at least two vetted, paid, active offers exist. Routing still requires separate contact consent and goes to no more than three named partners. Subscriber emails are excluded from shop notifications and lead exports.

## Tracking and delivery

Meta browser events: `ViewContent` on landing, `Lead` after report signup, and custom `QuoteRequest` after phone submission. Server events share the same event IDs for deduplication. `public/tracking.js` queues before SDK load and dispatches via `callMethod` after loading. Backend events retain hashed contact identifiers. Render's public URL is used as event source when `PUBLIC_URL` is absent.

Configure `META_PIXEL_ID`, `META_ACCESS_TOKEN`, and `META_API_VERSION` to deliver real Meta events. Optionally configure both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to enable the additional bot check; absent or incomplete keys do not block form submissions. For reports set `RESEND_API_KEY`, verified `EMAIL_FROM`, and optionally `ADMIN_EMAIL`. For Brevo contact/list sync set `BREVO_API_KEY` and `BREVO_LEAD_LIST_ID`. Optionally set `BREVO_COMPLETE_LIST_ID` for a separate completed-estimate list. The server creates LPC_ contact fields and updates vehicle/date/estimate data after completion; configure your Brevo automation to trigger on entry to the selected lead list. Phone is stored as a custom contact field, not SMS-marketing enrollment. Existing unsubscribe settings are preserved. Report emails remain with Resend. Never post or commit keys. Missing providers leave delivery jobs pending. The requested “sent” note appears only after Resend accepts delivery; it stays blank otherwise to avoid adding unsupported page copy or falsely claiming delivery.

Email gate records the exact Phoenix disclosure and timestamp. ZIP is collected only when visitors request quotes. Contact consent remains separate and stored with named partner shops. Public pages have no site menu or footer; legal links remain at the email and phone buttons. Existing legal pages are operational copy and should be finalized with the business details before selling leads.

## Validation and development

Node 24: `corepack pnpm install`, then `node server/index.mjs` or `node --env-file=.env server/index.mjs`. Local SQLite is for development; production requires Postgres. Run `node --test tests/*.test.mjs`.

13 tests cover all seed combinations, asset format/budget, two-field signup, private pricing, admin protection, routing, paid-deal thresholds, and Meta event dispatch/deduplication. A local 390×844 automated browser run from start through the full report took 29 seconds. It is not a physical-phone user study or a measured 4G first-load guarantee. The long cost headline occupied two lines at 390px; all image dimensions and eager/lazy settings were checked in the browser.

Free Render web services sleep on idle and free Postgres expires after 30 days. Upgrade before sustained paid traffic, establish backups/retention practices, and move queue claiming to a separate worker before horizontal scaling. Queue delivery currently runs inside one web instance.

Internal Telegram alerts: configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Render. New contacts, estimate completions, contact edits, and quote requests queue separate notifications with all submitted fields, source attribution, and consent. Telegram jobs retry independently of Brevo or report email delivery. User text is sent as plain text; credentials are never logged. The site and notification messages use Local Car Care branding.
