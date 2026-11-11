# Phoenix Car Care Price Checker

A mobile-first Phoenix car-care price checker, built from the included development spec. Node 24 serves the frontend and API; Render Postgres stores production records. Local development uses Node's built-in SQLite. Price ranges never ship in the public catalog or teaser API.

## Run locally

Install Node 24, then `corepack pnpm install`. Run `node --env-file=.env server/index.mjs` after copying `.env.example` to `.env`, or `node server/index.mjs` to start with local development defaults. Visit http://localhost:3000. Set `ADMIN_PASSWORD` to enable `/admin`. Run `node --test tests/*.test.mjs` for pricing and HTTP flow tests.

## Render

The root `render.yaml` provisions a separate web service and Postgres database in Oregon. Start a Blueprint from this branch. The generated owner password and session secret are stored as Render environment variables; reveal `ADMIN_PASSWORD` in the service dashboard to sign in. Existing services are not adopted.

The Blueprint uses free resources for initial review. Render's free web services sleep on idle, and free Postgres expires after 30 days; upgrade before production/ad traffic. An always-on paid service is needed for consistent email queue processing and the fast first-load target. No load-time guarantee has been measured on real 4G.

## Launch configuration

Configure these variables in the **new** Render web service's Environment panel, then deploy:

| Integration | Environment variables |
| --- | --- |
| Public URL | `PUBLIC_URL` (your HTTPS Render or custom-domain URL) |
| Spam protection | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (add your hostname in Cloudflare) |
| Reports and lead notifications | `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), `ADMIN_EMAIL` |
| Newsletter | `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` |
| Meta | `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_API_VERSION` (default v25.0; use a version supported by your app) |

Create beehiiv custom fields `vehicle`, `service`, `verdict`, and `zip`. The app sends a service tag with each subscription. Confirm the API plan supports your segmentation configuration. Provider credentials are never sent to browsers.

Production email and phone forms fail closed until Turnstile is configured. Missing mail/newsletter credentials leave jobs pending in the owner Delivery queue; the result page accurately says when report email is not configured. After supplying credentials, use Retry pending jobs. Provider jobs retry up to six times. Sending is at least once (Resend receives idempotency keys); inspect delivery status before manually retrying notifications.

## Owner setup

1. Add verified low/typical/high ranges per service option and vehicle type, with research sources. No invented prices are seeded.
2. Review pending quotes. Outlier flags identify prices below one-third or above three times the typical price. Ten approved quotes from the last 12 months enable 20th/50th/80th percentile pricing after trimming extremes. Calculations run on the server at check time; reports retain that snapshot.
3. Add partner shops, coverage and notification email. Mark a shop vetted only after checking it and confirming its permission to receive leads. Set deals active when valid. Quote requests remain unavailable without matching vetted shops; the visitor sees and consents to the named partners.
4. Test Resend delivery, beehiiv subscription/segmentation, Cloudflare verification, Meta browser/server deduplication, and shop notifications using your configured accounts before ad traffic.
5. Finalize the published business identity, support contact, privacy/terms wording, retention practices, and shop contact consent for your operation. Current legal pages are initial product copy. The privacy page explains partner sharing and lead sales.

The owner dashboard supports seed prices, quote moderation, lead filters (service, ZIP, date, status), buyer/payment tracking, CSV export, shops/deals, campaign/day capture rates, and delivery retries. CSV cells are protected against spreadsheet formula injection.

## Operational limits

The queue drains in the web process every minute; use one web instance for this MVP. Move queue claims to a separate worker with database locking before scaling instances. Subscriber source retains the original campaign attribution; each check has its own campaign snapshot. Admin login expires after eight hours and uses an HttpOnly SameSite cookie. A process-local rate limiter protects forms; add a shared limiter before horizontal scaling. Local SQLite is for development only and is prohibited in production. Lookup failure permits manual vehicle entry. ZIP validation covers configured metro ZIP patterns rather than a postal-address verification service.

Never commit `.env`, database files, API keys, passwords, contact exports, or test submissions. `.gitignore` excludes local runtime data. Source quote and subscriber records are private to the owner API. Rotate credentials in Render if exposed. Back up Postgres and establish a real retention/deletion process before collecting production leads.
