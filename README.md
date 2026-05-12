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


## Minimum Runtime Deployment Checklist

To ensure the app works everywhere (local, Node, Python, Cloudflare, Windows, Mac):

1. **Serve over HTTP, not file://**
  - Use `python3 -m http.server`, `npx serve .`, or `http-server -p 8000` (see below).
  - Opening `index.html` directly will break module and asset loading.

2. **All assets must be present and committed**
  - Ensure `assets/`, `gifs/`, and all images/GIFs are in the repo and deployed.
  - Case matters! `assets/hero.png` ≠ `assets/Hero.png` on most hosts.

3. **Correct asset and module paths**
  - Use paths relative to the project root (e.g., `/assets/...`).
  - Check browser dev tools for 404 errors if assets don’t load.

4. **Single entry point for SPAs**
  - For static hosts (Cloudflare, Netlify, Vercel), configure all routes to serve `index.html` (SPA fallback) if using client-side routing.

5. **No duplicated clocks or surfaces**
  - Only one timer/rAF per animated system. No duplicated animation loops.

6. **README and onboarding**
  - Make sure all instructions are clear for Python, Node, and static hosts.

### Node.js HTTP Server (if Python is unavailable)

Option 1: Using npx (no install needed)

```sh
npx serve .
```

Option 2: Install http-server globally

```sh
npm install -g http-server
http-server -p 8000
```

Then open:

```text
http://localhost:8000/
```

---
If assets or modules do not load, check the browser’s Network and Console tabs for errors. Most issues are due to missing files, case mismatches, or not serving over HTTP.

---
## Runtime shape

Initial hydration loads only the inert page shell, routes, and the main module.
Optional runtime pieces are activated on demand:

- GIF frame capture loads `js/vendor/gifler.min.js` only when a GIF hero is rendered.
- Overlay code loads `js/spa/overlayManager.js` only when an overlay action is used.
- Games code loads `js/spa/apps/asymptoteApp.js` and `js/spa/views/gamesView.js`
  only before entering or transitioning to the Games section.
<<<<<<< HEAD
Runtime++

Notes for Minimum Runtime Web Applications

⸻

Core Premise

A web application is not:

* its framework
* its folder structure
* its components
* its architecture diagrams

A web application is:

input → state transition → render output

The runtime behavior is the actual application.

Everything else is supporting machinery.

The goal is not to build the largest architecture possible.
The goal is to preserve behavioral identity with the minimum necessary runtime machinery.

⸻

Runtime-First Thinking

Most frontend systems become structurally complex before they become behaviorally coherent.

This often produces:

* duplicated state authority
* duplicated render paths
* hidden lifecycle
* orchestration layers
* semantic inflation
* framework sediment
* transition discontinuity
* unclear ownership

The runtime should remain understandable as a moving system.

The important questions are:

* What owns this?
* What changes this?
* What restores baseline?
* What actually moves?
* What clocks are active?
* What transitions are real?
* What is just semantic duplication?

⸻

Compression Instead of Abstraction

Abstraction often increases semantic distance from the runtime.

Compression instead asks:

* Can fewer concepts produce the same behavior?
* Can one invariant replace multiple special cases?
* Can continuity eliminate cleanup logic?
* Can motion grammars unify behavior?
* Can ownership become more explicit instead of more hidden?

The goal is not:

* fewer capabilities

The goal is:

* denser capability
* fewer moving abstractions
* stronger runtime invariants

⸻

Minimum Viable Runtime

A minimum viable runtime is:

the smallest fully hydrated runtime capable of preserving the intended behavior.

This means reducing:

* duplicated orchestration
* duplicated ownership
* duplicated transitions
* duplicated lifecycle
* duplicated semantics

without reducing:

* continuity
* interactivity
* responsiveness
* expressive behavior

⸻

The Browser Already Contains Most Of The Runtime

Browsers already provide:

* rendering
* compositing
* event systems
* scheduling
* animation
* persistence
* GPU pipelines
* timing
* stateful surfaces

Many frontend architectures accidentally recreate browser machinery inside additional semantic layers.

This often produces:

* lifecycle duplication
* state synchronization problems
* hydration complexity
* render indirection
* orchestration overhead

Direct runtime contact is valuable.

⸻

Runtime Identity

The true identity of an application is:

* the continuity of its behavior
* not the shape of its abstractions

A runtime organism preserves:

* motion continuity
* ownership continuity
* cadence continuity
* surface continuity
* interaction continuity

even if the underlying implementation changes.

⸻

Ownership Is The Real Boundary

Most difficult frontend bugs are ownership bugs.

Not syntax bugs.

Not rendering bugs.

Ownership bugs appear as:

* multiple clocks
* duplicated authority
* ambiguous cleanup
* resource drift
* transition discontinuity
* stale state
* handoff instability

Every transient system should answer:

* Who owns this right now?
* When does ownership transfer?
* What proves transfer completion?
* What restores baseline?
* What clocks are active?
* What surfaces are authoritative?

⸻

Handoffs Create Complexity

Every handoff introduces:

* synchronization cost
* continuity risk
* semantic friction
* lifecycle ambiguity

Examples:

* DOM → canvas
* image → GIF
* surface → particles
* transition canvas → live hero
* server → client hydration
* timer → requestAnimationFrame
* framework lifecycle → browser lifecycle

Most runtime instability accumulates at seams.

Reducing unnecessary handoffs often simplifies systems more than adding abstractions.

⸻

Runtime Motion Matters

Many frontend systems are fundamentally motion systems:

* gestures
* overlays
* transitions
* particles
* navigation
* hover states
* cadence systems
* momentum systems
* reveal systems

A system can be technically correct while feeling computationally incoherent.

Runtime feel matters.

⸻

Computational Kinesthetics

Computational kinesthetics is:

how computational systems feel while moving.

This includes:

* pressure
* cadence
* elasticity
* settling
* continuity
* tension
* release
* motion coherence
* ownership continuity

Two systems with identical functionality may feel radically different because of runtime continuity.

⸻

Motion Grammars

Many transient systems follow reusable motion grammars.

Examples:

Tension Grammar

REST → TENSION → RELEASE → REST

Surface Grammar

SURFACE → PARTICLES → SURFACE

Pulse Grammar

REST → PEAK → REST

Cadence Grammar

BASELINE → COMPRESSION → BASELINE

These grammars are useful because they:

* reduce semantic duplication
* reduce special cases
* clarify lifecycle
* clarify cleanup
* clarify ownership boundaries

⸻

Linear Systems vs Palindromic Systems

Not every system should be symmetrical.

Some systems are naturally linear:

* history
* progression
* persistence
* ownership chains
* loading
* accumulation

Other systems benefit from mirrored return paths:

* gestures
* transitions
* overlays
* particles
* motion feedback
* cadence systems

Useful distinction:

Linear state, palindromic motion, explicit ownership.

⸻

Phase, Amplitude, Ownership, Cleanup

Many runtime bugs come from semantically overloaded variables.

A single variable often accidentally means:

* where the system is
* how strong the effect is
* who owns the effect
* whether cleanup completed

These should often remain distinct.

Useful separation:

Phase

Where the system is.

Amplitude

How strong the effect is.

Ownership

Who controls the runtime object.

Cleanup

What restores baseline.

Overloaded variables create ambiguity.

⸻

Runtime Compression

Reduction is diagnostic.

Removing systems reveals:

* false abstractions
* duplicated lifecycle
* duplicated ownership
* unnecessary orchestration
* hidden invariants
* framework sediment

Good reduction asks:

* What machinery exists only to support other machinery?
* What abstractions only exist because earlier abstractions exist?
* What transitions are duplicated?
* What state is merely cached motion?
* What cleanup exists only because continuity was lost earlier?

⸻

Framework Sediment

Architectures often solidify into frameworks.

Frameworks often become:

* semantic runtimes
* orchestration systems
* lifecycle interpreters
* state synchronization layers

Over time:

* abstractions accumulate
* assumptions harden
* runtimes become indirect

This can produce systems where:

* the architecture becomes more visible than the runtime itself.

⸻

Runtime Abrasion

Some fixes work because they increase structural pressure instead of adding systems.

Good abrasion:

* removes ambiguity
* removes duplicated authority
* exposes ownership seams
* forces invariant clarity
* reveals hidden lifecycle

Sometimes the strongest fixes are reductions.

⸻

Reduction Until Failure

A useful diagnostic method:

* reduce systems until behavior breaks
* identify the true invariant
* restore only what is necessary

This reveals:

* actual dependencies
* false dependencies
* semantic inflation
* unnecessary orchestration

⸻

Web Applications As Persistent Runtime Organisms

A web application behaves less like:

* a static document

and more like:

* a persistent computational organism

It:

* maintains memory
* responds to pressure
* transitions between surfaces
* transfers ownership
* preserves continuity
* settles into baselines

The runtime is always alive while hydrated.

⸻

The Yo-Yo Model

A useful metaphor for runtime systems.

A yo-yo:

* stores momentum
* transfers pressure
* returns through tension
* maintains continuity through motion
* preserves identity while changing state

Good runtime systems behave similarly:

* state should not teleport
* motion should preserve continuity
* pressure should transfer coherently
* release should settle naturally

⸻

State Machine Transformers

A state machine should not merely:

* switch states

It should:

* transform continuously between states.

Good systems preserve:

* continuity of ownership
* continuity of motion
* continuity of cadence
* continuity of interaction

even while changing state.

⸻

Surface Continuity

Visual continuity matters.

Examples:

* a GIF should reform from particles into the same frame that continues motion
* a surface transition should preserve perceived identity
* overlays should settle instead of abruptly switching
* motion should feel causally connected

The user perceives continuity before architecture.

⸻

Multiple Clocks Are Dangerous

Many instability bugs come from:

* duplicated timers
* duplicated animation loops
* duplicated ownership
* duplicated cadence systems

A runtime should minimize:

* independent clocks
* independent truth sources
* independent surfaces

A single authoritative motion source is often simpler.

⸻

LLMs As Runtime Compression Tools

LLMs are most useful for:

* invariant discovery
* contradiction exposure
* reduction probing
* semantic compression
* ownership tracing
* grammar discovery
* architecture abrasion
* continuity analysis

They are less useful for:

* generating maximal abstraction
* producing arbitrary architecture
* replacing runtime understanding

⸻

False Maximalism

Modern tooling creates the illusion that:

* understanding is downloadable
* architecture is automatic
* agents replace runtime intuition
* efficiency is instant

Real runtime intuition still develops through:

* debugging
* observation
* reduction
* iteration
* contact with the runtime itself

The developer remains:

* the evaluator
* the pressure source
* the runtime judge

⸻

Runtime Questions

Useful runtime questions:

* What is the true owner?
* What is the real surface?
* What clocks are active?
* What restores baseline?
* What transitions are duplicated?
* What motion feels discontinuous?
* What variables are overloaded?
* What abstractions obscure runtime truth?
* What handoffs are unnecessary?
* What machinery already exists in the browser?
* What is the smallest runtime capable of preserving the behavior?

⸻

General Direction

The goal is not:

* maximal abstraction
* maximal architecture
* maximal framework layering

The goal is:

* continuity
* clarity
* explicit ownership
* runtime compression
* behavioral density
* coherent motion
* minimum viable runtime truth
=======
>>>>>>> b57078b (Runtime reduction and continuity hardening)
