# Basic Browser Slim SPA

This repo is a static browser SPA. It does not need a bundler or install step, but
it should be served over HTTP so ES modules and lazily loaded runtime scripts use
normal browser loading rules.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Do not open `index.html` directly with a `file://` URL. The app uses
`<script type="module">` plus on-demand classic scripts for optional runtimes
(GIF frame capture, overlays, and games), and those paths are meant to be loaded
by the browser from the same HTTP origin.

## Runtime shape

Initial hydration loads only the inert page shell, routes, and the main module.
Optional runtime pieces are activated on demand:

- GIF frame capture loads `js/vendor/gifler.min.js` only when a GIF hero is rendered.
- Overlay code loads `js/spa/overlayManager.js` only when an overlay action is used.
- Games code loads `js/spa/apps/asymptoteApp.js` and `js/spa/views/gamesView.js`
  only before entering or transitioning to the Games section.
