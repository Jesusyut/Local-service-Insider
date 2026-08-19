# Local Service Insider — two-page funnel

Static HTML, CSS, and vanilla JavaScript. No build step.

## Funnel

- `index.html` — seven-minute editorial guide and ad destination.
- `offer.html` — free mockup and custom order-size conversion page.
- `pricing/index.html` — private, unlinked campaign-options page.

## Edit before launch

The campaign constants live at the top of `js/main.js`:

- `FORM_ENDPOINT` — lead webhook. Currently configured to the LSI Zapier Catch Hook.
- `SLOTS_REMAINING` — honest count of exclusive slots in the current publication.
- `NEXT_DROP_DATE` — next scheduled mail drop. Keep the matching `datetime` value in sync.
- `FALLBACK_PHONE` — optional phone used only after a failed request. It is intentionally blank until a real number is supplied.
- `SERVICE_ZIPS` — current service ZIP reference list.

Also review territory and permit details on the private pricing page before launch.

## Local preview

```bash
python3 -m http.server 8000
```

Then open `/`, `/offer.html`, and `/pricing/`.

## Render

`render.yaml` publishes the repository root with no build command and includes clean rewrites for `/offer` and `/pricing`.
