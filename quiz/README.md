# Local Insider 03

Via 21's simple flow adapted to local lead generation and appointment setting: three questions, then a contact form. English and Spanish, validation, duplicate-safe submissions, UTM attribution, durable Postgres storage, and an authenticated pipeline at `/admin`.

Run on Node 24+: `npm install`, configure `DATABASE_URL`, `PUBLIC_ORIGIN`, and `ADMIN_PASSWORD` (at least 16 characters), then `npm start`. Run checks with `npm test`.

The existing site at the repository root is preserved. Render deploys this `quiz/` directory from branch `local-insider-03` with build command `cd quiz && npm install --omit=dev --ignore-scripts` and start command `cd quiz && npm start`.

Optional integrations are disabled until configured: `CALENDAR_URL`, `META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN`, Telegram, Resend email, and Sheet backup. The confirmation acknowledges a saved request; it does not claim a calendar booking or an automated text. Contact actions and appointment scheduling are available in the admin pipeline.

Placeholder headline and subheading are in `dist/i18n.js`. Questions are in `dist/app.js`; server validation is in `server/pipeline.mjs`. Keep both synchronized when changing options.
