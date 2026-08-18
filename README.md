# Local Service Insider — landing page

Static site. No build step.

## Before you deploy — three edits

1. **Form endpoint.** `index.html`, the `<form action="...">` attribute.
   Create a form at https://formspree.io, paste your endpoint in.
   (Any endpoint that accepts a POST and returns JSON works — Formspree,
   Basin, or your own webhook.)
2. **Fallback number.** `js/main.js`, search `000-000-0000`. This shows only
   if the form POST fails.
3. **Territory + permit.** `index.html` — the ZIP in the postcard strip, the
   sample address, the permit number in the indicia, and the city list in
   the footer.

## Deploy on Render

```bash
git init
git add .
git commit -m "LSI landing page"
git remote add origin git@github.com:YOURNAME/lsi-site.git
git push -u origin main
```

Then in Render: New → Static Site → connect the repo.
- Build command: leave empty
- Publish directory: `.`

`render.yaml` is included, so you can also use Blueprints instead.

## Local preview

```bash
python3 -m http.server 8000
```

## Structure

```
index.html      markup + copy
css/styles.css  all styling
js/main.js      postcard scroll flip, reveals, form
```

The postcard flip is CSS 3D driven by scroll position — no Three.js, so the
page stays light on a phone over LTE. `prefers-reduced-motion` is respected.

Asset references are case-correct and deployment-safe: `./css/styles.css`
and `./js/main.js`.
