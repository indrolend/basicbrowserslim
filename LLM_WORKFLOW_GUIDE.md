# LLM Workflow Guide for Runtime++ SPA

## Purpose
This guide is for LLMs and developers collaborating on this project. It codifies the workflow, dependencies, and best practices for maintaining a browser-first, minimum viable runtime SPA using Runtime++ principles.

---

## 1. Browser-First Demoing
- **Always serve the SPA over HTTP** (never open index.html directly).
- Use Python's built-in HTTP server:
  ```sh
  python3 -m http.server 8000
  ```
  Then open [http://localhost:8000/](http://localhost:8000/) in your browser.
- All ES modules, overlays, and games are loaded on demand by the browser. No build step is required.
- Validate all changes by interacting with the app in the browser, not just by static analysis.

---

## 2. Dependencies
- **Python 3**: For local HTTP serving (`python3 -m http.server 8000`).
- **No Node.js, npm, or bundler required.**
- **gifler.min.js**: Used for GIF playback, loaded only when a GIF hero is rendered.
- **overlayManager.js**: Loaded only when an overlay action is triggered.
- **asymptoteApp.js, gamesView.js**: Loaded only when entering the Games section.
- **Modern browser**: Required for ES modules and dynamic imports.

---

## 3. LLM Instructions: Enforcing Runtime++
- **Single Source of Truth**: All state transitions must be explicit and centralized. Avoid duplicated state or hidden lifecycle.
- **Idempotent Rendering**: Rendering should always reflect the current state. No hidden side effects.
- **Explicit State Transitions**: All changes to state must be triggered by explicit input or intent, routed through a central dispatcher.
- **Stateless/Immutable Deployments**: No build artifacts or server-side state. The app must run from static files.
- **Automation-First**: All workflows (serve, test, reset) should be codified and reproducible.
- **Observability**: Prefer browser devtools and direct runtime inspection over abstracted logging.
- **Minimal/Reductionist**: Remove any code, dependency, or abstraction that does not directly support runtime behavior.
- **Reproducibility & Reset**: The app must always be able to return to a known baseline state with a page reload.
- **End-to-End Traceability**: All input → state → render flows must be traceable in code and in the browser.

---

## 4. LLM/Agent Workflow
1. **Inspect**: Read the current code and state. Never assume; always check the latest browser behavior.
2. **Plan**: Propose changes as a sequence of explicit, minimal steps. State what will be preserved, reduced, or removed.
3. **Edit**: Make changes in small, testable increments. Remove dead code and abstractions.
4. **Demo**: Serve the app and verify all changes in the browser. Confirm that runtime behavior is preserved or improved.
5. **Document**: Update this guide and README.md with any new workflow, dependency, or runtime invariant.

---

## 5. Example: Adding a Feature
- Add new state or behavior only if it cannot be composed from existing runtime primitives.
- Route all new input through the central dispatcher.
- Render new output only as a function of current state.
- Test by serving the app and interacting in the browser.
- Remove any code that is no longer required after the change.

---

## 6. Prohibited Patterns
- No direct DOM manipulation outside the kernel/dispatcher.
- No global mutable state outside the explicit AppState.
- No framework, bundler, or transpiler dependencies.
- No hidden timers, intervals, or animation loops outside the main runtime.
- No code that cannot be demoed in a browser session.

---

## 7. LLM/Agent Checklist (Before Commit)
- [ ] All changes demoed in browser via HTTP server
- [ ] No new abstractions unless required for runtime continuity
- [ ] All state transitions are explicit and traceable
- [ ] No dead code or unused dependencies remain
- [ ] README.md and this guide updated if workflow changes

---

## 8. References
- See README.md for Runtime++ philosophy and minimum runtime notes.
- See js/spa/appKernel.js for the main state machine and dispatcher logic.
- See js/spa/spaData.js for all section/item data and click action routing.
- See js/spa/overlayManager.js and js/vendor/gifler.min.js for on-demand runtime modules.

---

> This file is for LLMs and human collaborators. All agents must follow these rules to preserve the minimum viable runtime and browser-first workflow.
