// Asymptote — SPA-integrated idle game engine
//
// Renders game content directly into the existing SPA DOM elements
// (spa-section-nav, spa-hero-container, spa-dots) so the game looks
// visually identical to the main SPA navigation: same button styles,
// same hero text style, same dots, same swipe gesture.
//
// Entry flow:
//   1. User navigates to Games / Asymptote Engine (sees tappable text hero)
//   2. User taps the hero → gamesView.onEnterGame() → AsymptoteApp.enterGame()
//   3. SPA DOM is replaced in-place with game sections + hero + dots
//   4. Exit: the ✕ nav button → restore the Games / Asymptote Engine item view
//
// Exposes window.AsymptoteApp = { mount, enterGame, stopGame, deactivate }
// Exposes window.__SPA_GameNav when game is active

(function () {

  // ── GAME DATA ────────────────────────────────────────────────────────────────

  var GENERATORS = [
    {
      id: 'brainSquisher',
      name: 'Brain Squisher',
      motif: 'squish',
      baseCost: 10,
      baseProduction: 0.1,
      costMultiplier: 1.15,
      description: 'Squish the BIG thing into a small thing that fits in your head. Density.'
    },
    {
      id: 'copyMachine',
      name: 'Copy Machine',
      motif: 'copy',
      baseCost: 50,
      baseProduction: 1.0,
      costMultiplier: 1.15,
      description: 'Copy the vibes that work. Forget the rest. Bootleg reality.'
    },
    {
      id: 'layerCake',
      name: 'Layer Cake',
      motif: 'layers',
      baseCost: 250,
      baseProduction: 5.0,
      costMultiplier: 1.15,
      description: 'It stacks. Layers on layers on more layers. Complexity hides itself.'
    },
    {
      id: 'lastStep',
      name: 'Last Step',
      motif: 'edge',
      baseCost: 1000,
      baseProduction: 25.0,
      costMultiplier: 1.15,
      description: 'The last bit is what kills you. Or saves you. The edge. The asymptote.'
    },
    {
      id: 'infiniteLoop',
      name: 'Infinite Loop',
      motif: 'loop',
      baseCost: 5000,
      baseProduction: 100.0,
      costMultiplier: 1.15,
      description: 'Copy the copy of the copy — it goes brrrr but you drift from what\'s real.'
    }
  ];

  var UPGRADES = [
    {
      id: 'chunking',
      name: 'Chunking',
      motif: 'chunks',
      cost: 100,
      description: '2× clicks. Stop the flow. Make it chunks. Patterns are objects now.',
      apply: function (s) { s.clickPower *= 2; }
    },
    {
      id: 'networkEffect',
      name: 'Network',
      motif: 'net',
      cost: 500,
      description: '2× production. Everyone copies reality differently. Squad up for scale.',
      apply: function (s) { s.productionMultiplier *= 2; }
    },
    {
      id: 'focusMode',
      name: 'Focus',
      motif: 'focus',
      cost: 1000,
      description: '2.5× clicks. Limited attention. Pick what matters. Ignore the rest.',
      requires: 'chunking',
      apply: function (s) { s.clickPower *= 2.5; }
    },
    {
      id: 'moveFast',
      name: 'Velocity',
      motif: 'fast',
      cost: 5000,
      description: '2× production. Speed beats perfect. Errors are fine upstream.',
      requires: 'networkEffect',
      apply: function (s) { s.productionMultiplier *= 2; }
    }
  ];

  var SACRIFICE_ACTIONS = [
    {
      id: 'ticksToUnderstanding',
      name: 't→⊙',
      motif: 'tickUp',
      description: 'Convert 10 ticks into 1 understanding.',
      canDo: function (s) { return s.resources.ticks >= 10; },
      execute: function (s) {
        s.resources.ticks -= 10;
        s.resources.understanding += 1;
      }
    },
    {
      id: 'understandingToTicks',
      name: '⊙→t',
      motif: 'uDown',
      description: 'Convert 1 understanding into 5 ticks.',
      canDo: function (s) { return s.resources.understanding >= 1; },
      execute: function (s) {
        s.resources.understanding -= 1;
        s.resources.ticks += 5;
      }
    },
    {
      id: 'temporalCollapse',
      name: 'Collapse',
      motif: 'collapse',
      description: 'Reset understanding + ticks. Gain permanent click power from the loss.',
      canDo: function (s) {
        return s.resources.understanding >= 50 || s.resources.ticks >= 100;
      },
      execute: function (s) {
        var bonus = Math.max(1, Math.floor(
          s.resources.understanding * 0.1 + s.resources.ticks * 0.05
        ));
        s.resources.understanding = 0;
        s.resources.ticks = 0;
        s.clickPower += bonus;
      }
    }
  ];

  // Game sections — mirrors the SPA_SECTIONS structure exactly.
  // sectionIdx 0 = understanding (the main click action)
  // sectionIdx 1 = generators
  // sectionIdx 2 = upgrades
  // sectionIdx 3 = sacrifice
  var GAME_SECTIONS = [
    {
      id: 'understanding',
      label: '⊙',
      items: [
        { id: 'click', name: '⊙', description: '' }
      ]
    },
    { id: 'generators',  label: '⚙', items: GENERATORS        },
    { id: 'upgrades',    label: '✦', items: UPGRADES          },
    { id: 'sacrifice',   label: '†', items: SACRIFICE_ACTIONS }
  ];

  var TICKS_PER_SEC    = 10;
  var TICK_INTERVAL_MS = 100;

  // ── STATE ────────────────────────────────────────────────────────────────────

  var state = null;

  function createState() {
    var s = {
      resources: { understanding: 0, ticks: 0 },
      sectionIdx: 0,
      itemIndices: { understanding: 0, generators: 0, upgrades: 0, sacrifice: 0 },
      clickPower: 1,
      productionMultiplier: 1,
      generators: {},
      upgrades: {}
    };
    for (var i = 0; i < GENERATORS.length; i++) {
      s.generators[GENERATORS[i].id] = { count: 0 };
    }
    for (var j = 0; j < UPGRADES.length; j++) {
      s.upgrades[UPGRADES[j].id] = { purchased: false };
    }
    return s;
  }

  // ── GAME LOGIC ───────────────────────────────────────────────────────────────

  function getCurrentSection() {
    return GAME_SECTIONS[state.sectionIdx];
  }

  function getCurrentItem() {
    var sec = getCurrentSection();
    return sec.items[state.itemIndices[sec.id]] || null;
  }

  function getGeneratorCost(genId) {
    var def = null;
    for (var i = 0; i < GENERATORS.length; i++) {
      if (GENERATORS[i].id === genId) { def = GENERATORS[i]; break; }
    }
    return Math.floor(def.baseCost * Math.pow(def.costMultiplier, state.generators[genId].count));
  }

  function getProductionPerSecond() {
    var total = 0;
    for (var i = 0; i < GENERATORS.length; i++) {
      var def = GENERATORS[i];
      total += state.generators[def.id].count * def.baseProduction;
    }
    return total * state.productionMultiplier;
  }

  function canDoCurrentItem() {
    var sec  = getCurrentSection();
    var item = getCurrentItem();
    if (!item) return false;
    if (sec.id === 'understanding') return true;
    if (sec.id === 'generators') {
      return state.resources.understanding >= getGeneratorCost(item.id);
    }
    if (sec.id === 'upgrades') {
      if (state.upgrades[item.id].purchased) return false;
      if (state.resources.understanding < item.cost) return false;
      if (item.requires && !state.upgrades[item.requires].purchased) return false;
      return true;
    }
    if (sec.id === 'sacrifice') {
      return item.canDo(state);
    }
    return false;
  }

  function doCurrentItemAction() {
    var sec  = getCurrentSection();
    var item = getCurrentItem();
    if (!item) return;

    if (sec.id === 'understanding') {
      state.resources.understanding += state.clickPower;
      corePulseAt = performance.now();
      dirty = true;
      return;
    }
    if (sec.id === 'generators') {
      var cost = getGeneratorCost(item.id);
      if (state.resources.understanding < cost) return;
      state.resources.understanding -= cost;
      state.generators[item.id].count++;
    } else if (sec.id === 'upgrades') {
      if (!canDoCurrentItem()) return;
      state.resources.understanding -= item.cost;
      state.upgrades[item.id].purchased = true;
      item.apply(state);
    } else if (sec.id === 'sacrifice') {
      if (item.canDo(state)) item.execute(state);
    }
    dirty = true;
  }

  // ── NAVIGATION ───────────────────────────────────────────────────────────────

  // Linear navigation mirrors the main SPA:
  //   next item in current section → or first item of next section
  //   prev item in current section → or last item of previous section
  function getNextGameTarget() {
    var sec     = GAME_SECTIONS[state.sectionIdx];
    var itemIdx = state.itemIndices[sec.id];
    if (itemIdx < sec.items.length - 1) {
      return { sectionIdx: state.sectionIdx, itemIdx: itemIdx + 1 };
    }
    var nextSecIdx = (state.sectionIdx + 1) % GAME_SECTIONS.length;
    return { sectionIdx: nextSecIdx, itemIdx: 0 };
  }

  function getPrevGameTarget() {
    var sec     = GAME_SECTIONS[state.sectionIdx];
    var itemIdx = state.itemIndices[sec.id];
    if (itemIdx > 0) {
      return { sectionIdx: state.sectionIdx, itemIdx: itemIdx - 1 };
    }
    var prevSecIdx = (state.sectionIdx - 1 + GAME_SECTIONS.length) % GAME_SECTIONS.length;
    var prevSec    = GAME_SECTIONS[prevSecIdx];
    return { sectionIdx: prevSecIdx, itemIdx: prevSec.items.length - 1 };
  }

  function navigateTo(secIdx, itemIdx) {
    state.sectionIdx = secIdx;
    state.itemIndices[GAME_SECTIONS[secIdx].id] = itemIdx;
    renderGameDOM();
    dirty = true;
  }

  // ── TICK LOOP ────────────────────────────────────────────────────────────────

  var tickInterval = null;
  var lastTickTime = null;
  var tickPaused   = false;

  function startTick() {
    if (tickInterval !== null) return;
    lastTickTime = performance.now();
    tickPaused   = false;
    tickInterval = setInterval(function () {
      if (tickPaused) return;
      var now = performance.now();
      var dt  = Math.min((now - lastTickTime) / 1000, 1);
      lastTickTime = now;
      state.resources.understanding += getProductionPerSecond() * dt;
      state.resources.ticks         += TICKS_PER_SEC * dt;
      dirty = true;
    }, TICK_INTERVAL_MS);
    // Pause tick when tab is hidden so returning doesn't burst accumulated time.
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function stopTick() {
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
      lastTickTime = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      tickPaused = true;
    } else {
      lastTickTime = performance.now();
      tickPaused   = false;
    }
  }

  // ── MOUNT ANIMATION CONSTANTS ────────────────────────────────────────────────

  var ANIM_DOT_N         = 22;
  var ANIM_DOT_R         = 4.5;   // CSS px — solid dot radius
  var ANIM_GLOW_R        = 11;    // CSS px — outer glow radius
  var ANIM_CYCLE_MS      = 3500;
  var ANIM_SEQ_MS        = 2200;  // time at which all dots are lit
  var ANIM_HOLD_MS       = 2700;  // time at which fade-out begins
  var ANIM_RANGE         = 3.5;   // curve units shown per axis
  var ANIM_AR            = [94, 232, 125]; // accent colour #5ee87d
  // Offset used for both buildMountHeroProbe and mount() startup so the first
  // live animation frame exactly matches the particle-transition probe snapshot.
  var ANIM_PROBE_OFFSET_MS = ANIM_SEQ_MS + 100;

  // Pre-compute Q2 curve: x ∈ [−3.2, −0.3], y = −1/x > 0.
  // Log-spaced so dots are denser near the y-axis asymptote.
  // i = 0  → leftmost  (x ≈ −3.2, y ≈ 0.31)  — lights up first
  // i = N−1 → rightmost (x ≈ −0.3, y ≈ 3.33) — lights up last
  var ANIM_DOTS = (function () {
    var d = [];
    for (var i = 0; i < ANIM_DOT_N; i++) {
      var t   = i / (ANIM_DOT_N - 1);
      var mag = Math.exp(Math.log(3.2) + (Math.log(0.3) - Math.log(3.2)) * t);
      d.push({ cx: -mag, cy: 1 / mag });
    }
    return d;
  }());

  // ── RENDER LOOP ──────────────────────────────────────────────────────────────

  var renderFrameId    = null;
  var mountAnimFrameId = null;
  var dirty            = false;
  var entryIntroActive = false;
  var entryIntroStartMs = 0;
  var corePulseAt      = 0;

  var ENTRY_INTRO_MS   = 3200;

  function startRender() {
    if (renderFrameId !== null) return;
    (function loop() {
      if (document.querySelector('.asy-engine-bg') || document.querySelector('.asy-motif')) {
        dirty = true;
      }
      updateLiveDisplay();
      renderFrameId = requestAnimationFrame(loop);
    }());
  }

  function stopRender() {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
      renderFrameId = null;
    }
  }

  // ── FORMATTING ───────────────────────────────────────────────────────────────

  function fmt(n) {
    if (!isFinite(n) || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(1);
  }

  // The text displayed in the hero area for each section/item.
  // For the understanding section the label is constant; generators and upgrades
  // include cost/count which update every tick, so this is also used by updateLiveDisplay.
  function getItemHeroText(sec, item) {
    if (sec.id === 'generators') {
      var count = state.generators[item.id].count;
      var cost  = getGeneratorCost(item.id);
      return count + '  ·  ' + fmt(cost);
    }
    if (sec.id === 'upgrades') {
      if (state.upgrades[item.id].purchased) return '✓';
      return fmt(item.cost);
    }
    if (sec.id === 'sacrifice') return item.name;
    return item.name;
  }

  // ── DOM HELPERS ──────────────────────────────────────────────────────────────

  // Same touchend+onclick dual-wiring as addActivationHandler in main.js:
  // touchend fires immediately on mobile (no 300ms delay), preventDefault blocks
  // the synthetic click so the handler never double-fires.
  function wire(el, handler) {
    el.addEventListener('touchend', function (e) { e.preventDefault(); handler(); });
    el.onclick = handler;
  }

  function setElText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ── LIVE DISPLAY UPDATE ──────────────────────────────────────────────────────

  // Called every rAF — only updates text nodes and the affordability class.
  // Does NOT rebuild DOM structure; that only happens on navigateTo().
  function updateLiveDisplay() {
    if (!dirty) return;
    dirty = false;

    // Stats (in spa-section-nav)
    var sectionNav = document.getElementById('spa-section-nav');
    if (sectionNav) {
      var pps = getProductionPerSecond();
      setElText(sectionNav.querySelector('.asy-stat-u'),  fmt(state.resources.understanding));
      setElText(sectionNav.querySelector('.asy-stat-ps'), fmt(pps) + '/s');
      setElText(sectionNav.querySelector('.asy-stat-t'),  fmt(state.resources.ticks));
    }

    var heroContainer = document.getElementById('spa-hero-container');
    var heroTextEl    = heroContainer && heroContainer.querySelector('.asy-hero-stat');
    if (heroTextEl) {
      var sec  = getCurrentSection();
      var item = getCurrentItem();
      if (item && sec.id !== 'understanding') {
        setElText(heroTextEl, getItemHeroText(sec, item));
      }
    }

    // Affordability indicator — dim hero text when item can't be actioned
    var heroEl = heroContainer && heroContainer.querySelector('.spa-hero');
    if (heroEl) {
      var canDo   = canDoCurrentItem();
      var secId   = getCurrentSection().id;
      heroEl.classList.toggle('asy-hero--dim', secId !== 'understanding' && !canDo);
    }

    var engBg = heroContainer && heroContainer.querySelector('.asy-engine-bg');
    if (engBg) {
      drawEngineBgCanvas(engBg, performance.now());
    }
    var motifEl = heroContainer && heroContainer.querySelector('.asy-motif');
    if (motifEl && state) {
      var sec2 = getCurrentSection();
      var item2 = getCurrentItem();
      if (item2) drawItemMotifCanvas(motifEl, sec2.id, item2, performance.now());
    }
  }

  // ── GAME DOM RENDER ──────────────────────────────────────────────────────────

  // Renders the complete game UI into the three shared SPA DOM nodes.
  // Called on game entry and on every navigateTo().
  function renderGameDOM() {
    renderSectionNav();
    renderHero();
    renderDots();
  }

  // Replaces #spa-section-nav with game section tabs + stats row + exit button.
  // Uses .spa-nav-btn so buttons look identical to the main SPA nav.
  function renderSectionNav() {
    var sectionNav = document.getElementById('spa-section-nav');
    if (!sectionNav) return;
    sectionNav.innerHTML = '';

    // Stats bar — 100% width forces tabs onto the next flex row automatically
    var statsBar = document.createElement('div');
    statsBar.className = 'asy-stats-bar';
    statsBar.innerHTML =
      '<span class="asy-stat"><span class="asy-label">⊙</span>' +
        '<span class="asy-stat-u">—</span></span>' +
      '<span class="asy-stat"><span class="asy-label">→</span>' +
        '<span class="asy-stat-ps">—</span></span>' +
      '<span class="asy-stat"><span class="asy-label">t</span>' +
        '<span class="asy-stat-t">—</span></span>';
    sectionNav.appendChild(statsBar);

    // Section buttons — .spa-nav-btn = visually identical to Home / Social / etc.
    GAME_SECTIONS.forEach(function (sec, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'spa-nav-btn';
      btn.textContent = sec.label;
      btn.style.fontWeight = idx === state.sectionIdx ? 'bold'  : 'normal';
      btn.style.background = idx === state.sectionIdx ? '#333'  : '';
      btn.setAttribute('aria-current', idx === state.sectionIdx ? 'page' : 'false');
      wire(btn, (function (i) { return function () { navigateTo(i, 0); }; }(idx)));
      sectionNav.appendChild(btn);
    });

    // Exit button — same .spa-nav-btn base with a distinct label
    var exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'spa-nav-btn asy-exit-btn';
    exitBtn.textContent = '✕';
    exitBtn.setAttribute('aria-label', 'exit game');
    wire(exitBtn, function () {
      if (window.__SPA_ExitGameToCurrentItem) {
        window.__SPA_ExitGameToCurrentItem();
      } else if (window.__SPA_GoHome) {
        window.__SPA_GoHome();
      }
    });
    sectionNav.appendChild(exitBtn);

    // Seed stats immediately so there's no blank flash
    dirty = true;
  }

  // Renders the current section's current item as a .spa-hero inside
  // #spa-hero-container — identical structure to normal SPA text heroes.
  function renderHero() {
    var heroContainer = document.getElementById('spa-hero-container');
    if (!heroContainer) return;
    heroContainer.innerHTML = '';

    var sec  = getCurrentSection();
    var item = getCurrentItem();
    if (!item) return;

    var canDo    = canDoCurrentItem();
    var dimClass = (sec.id !== 'understanding' && !canDo) ? ' asy-hero--dim' : '';

    var hero = document.createElement('div');
    hero.className = 'spa-hero spa-hero--linkable asy-hero-main' + dimClass;
    if (sec.id === 'understanding') {
      hero.classList.add('asy-engine-hero');
    } else {
      hero.classList.add('asy-item-hero');
    }
    hero.style.position = 'relative';
    hero.setAttribute('role', 'group');
    hero.setAttribute('tabindex', '0');
    hero.setAttribute('aria-label', item.name || 'game action');

    hero.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (sec.id !== 'understanding') doCurrentItemAction();
      }
    });

    if (sec.id === 'understanding') {
      var bg = document.createElement('canvas');
      bg.className = 'asy-engine-bg';
      bg.setAttribute('aria-hidden', 'true');
      hero.appendChild(bg);

      var core = document.createElement('button');
      core.type = 'button';
      core.className = 'asy-core-dot';
      core.setAttribute('aria-label', 'Pulse engine — add understanding');
      wire(core, doCurrentItemAction);
      hero.appendChild(core);

      var hint = document.createElement('div');
      hint.className = 'asy-engine-hint';
      hint.textContent = '⊙';
      hero.appendChild(hint);
    } else {
      var motif = document.createElement('canvas');
      motif.className = 'asy-motif';
      motif.setAttribute('aria-hidden', 'true');
      hero.appendChild(motif);

      var heroText = document.createElement('div');
      heroText.className = 'spa-hero-text asy-hero-stat';
      heroText.textContent = getItemHeroText(sec, item);
      hero.appendChild(heroText);

      var act = document.createElement('button');
      act.type = 'button';
      act.className = 'asy-hero-action';
      act.textContent = sec.id === 'sacrifice' ? '▶' : '●';
      act.setAttribute('aria-label', 'activate ' + (item.name || ''));
      wire(act, doCurrentItemAction);
      hero.appendChild(act);
    }

    heroContainer.appendChild(hero);
  }

  // Replaces #spa-dots with item dots for the current section.
  // Uses .spa-dot — identical to the main SPA item dots.
  function renderDots() {
    var dotsBar = document.getElementById('spa-dots');
    if (!dotsBar) return;
    dotsBar.innerHTML = '';

    var sec     = getCurrentSection();
    var items   = sec.items;
    var itemIdx = state.itemIndices[sec.id];

    if (items.length <= 1) return;

    items.forEach(function (item, idx) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'spa-dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', item.name || '');
      dot.setAttribute('aria-selected', idx === itemIdx ? 'true' : 'false');
      wire(dot, (function (i) { return function () { navigateTo(state.sectionIdx, i); }; }(idx)));
      dotsBar.appendChild(dot);
    });
  }

  // ── HERO PROBE ───────────────────────────────────────────────────────────────

  // Builds an off-screen .spa-hero/.spa-hero-text element for a given game
  // section/item so main.js can rasterize it as a transition surface.
  // Mirrors createTextProbe() in main.js exactly.
  function buildGameHeroProbe(secIdx, itemIdx) {
    var sec  = GAME_SECTIONS[secIdx];
    var item = sec && sec.items[itemIdx];
    if (!sec || !item) return null;

    var heroContainer = document.getElementById('spa-hero-container');
    if (!heroContainer) return null;

    var probeHero = document.createElement('div');
    probeHero.setAttribute('data-probe', '1');
    probeHero.style.position = 'absolute';
    probeHero.style.pointerEvents = 'none';
    probeHero.style.margin = '0';
    probeHero.style.left = '-9999px';
    probeHero.style.top  = '-9999px';

    var liveHeroEl = heroContainer.querySelector('.spa-hero:not([data-probe])');
    if (liveHeroEl) {
      var liveRect = liveHeroEl.getBoundingClientRect();
      if (liveRect.width > 0) probeHero.style.width = liveRect.width + 'px';
    } else {
      probeHero.style.width = Math.max(220, Math.min(heroContainer.clientWidth || 320, 608)) + 'px';
    }

    if (sec.id === 'understanding') {
      probeHero.className = 'spa-hero asy-engine-hero';
      var bg = document.createElement('canvas');
      bg.className = 'asy-engine-bg';
      bg.style.position = 'absolute';
      bg.style.top = '0';
      bg.style.left = '0';
      bg.style.width = '100%';
      bg.style.height = '100%';
      probeHero.style.minHeight = '280px';
      probeHero.appendChild(bg);
      var core = document.createElement('div');
      core.className = 'asy-core-dot';
      probeHero.appendChild(core);
      var hint = document.createElement('div');
      hint.className = 'asy-engine-hint';
      hint.textContent = '⊙';
      probeHero.appendChild(hint);
      heroContainer.appendChild(probeHero);
      var pr = probeHero.getBoundingClientRect();
      var cssW = Math.round(pr.width);
      var cssH = Math.round(Math.max(pr.height, 280));
      var dpr = window.devicePixelRatio || 1;
      bg.width  = Math.round(cssW * dpr);
      bg.height = Math.round(cssH * dpr);
      var ctx = bg.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawIdleEngine(ctx, cssW, cssH, performance.now(), 0);
      return { element: probeHero, cleanup: function () { probeHero.remove(); } };
    }

    probeHero.className = 'spa-hero asy-item-hero';
    probeHero.style.minHeight = '200px';
    var probeMotif = document.createElement('canvas');
    probeMotif.className = 'asy-motif';
    probeHero.appendChild(probeMotif);
    drawItemMotifCanvas(probeMotif, sec.id, item, performance.now());
    var probeText = document.createElement('div');
    probeText.className = 'spa-hero-text asy-hero-stat';
    probeText.textContent = getItemHeroText(sec, item);
    probeHero.appendChild(probeText);
    heroContainer.appendChild(probeHero);

    return { element: probeHero, cleanup: function () { probeHero.remove(); } };
  }

  // ── NAVIGATION ─ (instant, no particle effect — used by dot/tab clicks) ──────

  // Immediate navigation (dot clicks, section-tab clicks).
  function navigateInDir(dir) {
    var target = (dir === 'next') ? getNextGameTarget() : getPrevGameTarget();
    navigateTo(target.sectionIdx, target.itemIdx);
  }

  // ── MOUNT ANIMATION ─ (entrance canvas: Q2 y=−1/x graph, left-to-right dots) ─

  function createPlotMapper(cssW, cssH) {
    var padL = 26, padR = 46, padT = 26, padB = 44;
    var plotW = cssW - padL - padR;
    var plotH = cssH - padT - padB;
    var sx    = plotW / ANIM_RANGE;
    var sy    = plotH / ANIM_RANGE;
    function canX(cx) { return padL + (cx + ANIM_RANGE) * sx; }
    function canY(cy) { return (cssH - padB) - cy * sy; }
    return {
      cssW: cssW, cssH: cssH, padL: padL, padR: padR, padT: padT, padB: padB,
      ox: cssW - padR, oy: cssH - padB, canX: canX, canY: canY
    };
  }

  function computeLeadDotIndex(elapsed) {
    var eFrac = (elapsed % ANIM_CYCLE_MS) / ANIM_CYCLE_MS;
    var seqFrac = ANIM_SEQ_MS / ANIM_CYCLE_MS;
    var holdFrac = ANIM_HOLD_MS / ANIM_CYCLE_MS;
    var lead = 0;
    var i;
    for (i = 0; i < ANIM_DOT_N; i++) {
      var activateAt = (i / (ANIM_DOT_N - 1)) * seqFrac;
      if (eFrac >= activateAt) lead = i;
    }
    return { lead: lead, eFrac: eFrac, seqFrac: seqFrac, holdFrac: holdFrac };
  }

  function computeMountCameraScale(info) {
    var holdFrac = info.holdFrac;
    if (info.eFrac < info.seqFrac) {
      return 1 + 0.5 * (info.eFrac / info.seqFrac);
    }
    if (info.eFrac < holdFrac) return 1.5;
    var fade = Math.min(1, (info.eFrac - holdFrac) / Math.max(0.001, 1 - holdFrac));
    return 1.5 - 0.35 * fade;
  }

  function drawMountSceneCore(ctx, M, elapsed) {
    var cssW = M.cssW;
    var cssH = M.cssH;
    var padL = M.padL, padT = M.padT, padR = M.padR, padB = M.padB;
    var ox = M.ox, oy = M.oy;
    var canX = M.canX, canY = M.canY;

    ctx.strokeStyle = 'rgba(72, 72, 72, 0.9)';
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'round';

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox, padT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox - 4, padT + 9);
    ctx.lineTo(ox,     padT + 1);
    ctx.lineTo(ox + 4, padT + 9);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(padL, oy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padL + 9, oy - 4);
    ctx.lineTo(padL + 1, oy);
    ctx.lineTo(padL + 9, oy + 4);
    ctx.stroke();

    var labelSize = Math.max(10, Math.round(cssW * 0.03));
    ctx.fillStyle = 'rgba(78, 78, 78, 0.9)';
    ctx.font      = labelSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('x', padL - 4, oy + 13);
    ctx.textAlign = 'right';
    ctx.fillText('y', ox - 5, padT + 5);

    var eFrac    = (elapsed % ANIM_CYCLE_MS) / ANIM_CYCLE_MS;
    var seqFrac  = ANIM_SEQ_MS  / ANIM_CYCLE_MS;
    var holdFrac = ANIM_HOLD_MS / ANIM_CYCLE_MS;
    var slotFrac = seqFrac / (ANIM_DOT_N - 1);

    var i;
    for (i = 0; i < ANIM_DOT_N; i++) {
      var activateAt = (i / (ANIM_DOT_N - 1)) * seqFrac;
      var opacity;
      if (eFrac < activateAt) {
        opacity = 0;
      } else if (eFrac < holdFrac) {
        opacity = Math.min(1, (eFrac - activateAt) / Math.max(slotFrac * 0.55, 0.001));
      } else {
        opacity = Math.max(0, 1 - (eFrac - holdFrac) / (1 - holdFrac));
      }
      if (opacity <= 0.01) continue;

      var px = canX(ANIM_DOTS[i].cx);
      var py = canY(ANIM_DOTS[i].cy);
      if (py < -ANIM_GLOW_R || py > cssH + ANIM_GLOW_R ||
          px < -ANIM_GLOW_R || px > cssW + ANIM_GLOW_R) continue;

      var grd = ctx.createRadialGradient(px, py, 0, px, py, ANIM_GLOW_R);
      grd.addColorStop(0, 'rgba(' + ANIM_AR[0] + ',' + ANIM_AR[1] + ',' + ANIM_AR[2] + ',' + (opacity * 0.7) + ')');
      grd.addColorStop(1, 'rgba(' + ANIM_AR[0] + ',' + ANIM_AR[1] + ',' + ANIM_AR[2] + ',0)');
      ctx.beginPath();
      ctx.arc(px, py, ANIM_GLOW_R, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, ANIM_DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + ANIM_AR[0] + ',' + ANIM_AR[1] + ',' + ANIM_AR[2] + ',' + opacity + ')';
      ctx.fill();
    }
  }

  // Draw mount graph; useCamera = gimbal follow on the latest lit dot (menu + intro).
  function drawMountFrame(ctx, cssW, cssH, elapsed, useCamera) {
    if (useCamera === undefined) useCamera = true;
    ctx.clearRect(0, 0, cssW, cssH);
    var M = createPlotMapper(cssW, cssH);
    var canX = M.canX, canY = M.canY;
    var info = computeLeadDotIndex(elapsed);
    var focusX = canX(ANIM_DOTS[info.lead].cx);
    var focusY = canY(ANIM_DOTS[info.lead].cy);
    var scale  = useCamera ? computeMountCameraScale(info) : 1;

    ctx.save();
    if (useCamera && scale > 1.001) {
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(scale, scale);
      ctx.translate(-focusX, -focusY);
    }
    drawMountSceneCore(ctx, M, elapsed);
    ctx.restore();
  }

  // Idle “engine” after intro: orbit + flow into center (same motif as core dot).
  function drawIdleEngine(ctx, cssW, cssH, wallMs, pulseMs) {
    ctx.clearRect(0, 0, cssW, cssH);
    var cx = cssW * 0.5;
    var cy = cssH * 0.48;
    var t = wallMs * 0.001;
    var pulse = pulseMs > 0 ? Math.min(1, (wallMs - pulseMs) / 220) : 0;
    var ringR = Math.min(cssW, cssH) * 0.22;
    var i;
    ctx.strokeStyle = 'rgba(94, 232, 125, 0.25)';
    ctx.lineWidth = 1.2;
    for (i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringR + i * 14 + (pulse * 8), 0, Math.PI * 2);
      ctx.stroke();
    }
    var n = 18;
    for (i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + t * 0.7;
      var rad = ringR + 36 + Math.sin(t * 2 + i) * 6;
      var px = cx + Math.cos(ang) * rad;
      var py = cy + Math.sin(ang) * rad;
      var a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3 + i));
      ctx.fillStyle = 'rgba(' + ANIM_AR[0] + ',' + ANIM_AR[1] + ',' + ANIM_AR[2] + ',' + a + ')';
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(94, 232, 125, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(t) * (ringR + 50), cy + Math.sin(t) * (ringR + 50));
    ctx.stroke();
  }

  function drawEngineBgCanvas(canvas, wallMs) {
    if (!canvas || !canvas.getContext) return;
    var rect = canvas.getBoundingClientRect();
    var dpr  = window.devicePixelRatio || 1;
    var cssW = Math.round(rect.width);
    var cssH = Math.round(rect.height);
    if (cssW < 10 || cssH < 10) return;
    var physW = Math.round(cssW * dpr);
    var physH = Math.round(cssH * dpr);
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width  = physW;
      canvas.height = physH;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (entryIntroActive) {
      var introElapsed = wallMs - entryIntroStartMs;
      if (introElapsed >= ENTRY_INTRO_MS) {
        entryIntroActive = false;
      } else {
        drawMountFrame(ctx, cssW, cssH, introElapsed, true);
        return;
      }
    }
    drawIdleEngine(ctx, cssW, cssH, wallMs, corePulseAt);
  }

  function drawItemMotifCanvas(canvas, secId, item, wallMs) {
    if (!canvas || !canvas.getContext || !item) return;
    var w = 112;
    var h = 112;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2;
    var cy = h / 2;
    if (secId === 'upgrades' && state.upgrades[item.id] && state.upgrades[item.id].purchased) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(94,232,125,0.35)';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', cx, cy);
      return;
    }
    var t = wallMs * 0.001;
    var motif = item.motif || item.id;
    var g;
    var i;
    var j;

    function dot(x, y, r, al) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + ANIM_AR[0] + ',' + ANIM_AR[1] + ',' + ANIM_AR[2] + ',' + al + ')';
      ctx.fill();
    }

    if (secId === 'generators') {
      if (motif === 'squish') {
        for (i = 0; i < 12; i++) {
          var ang = (i / 12) * Math.PI * 2 + t;
          var pull = 0.35 + 0.25 * Math.sin(t * 2);
          dot(cx + Math.cos(ang) * (28 + pull * 20), cy + Math.sin(ang) * (28 + pull * 20), 3, 0.5);
        }
        dot(cx, cy, 8 + 3 * Math.sin(t * 3), 0.95);
      } else if (motif === 'copy') {
        dot(cx - 14, cy, 5, 0.7);
        dot(cx + 14 + Math.sin(t * 4) * 4, cy, 5, 0.9);
        dot(cx - 14, cy + 16, 4, 0.35);
        dot(cx + 14, cy + 16, 4, 0.55);
      } else if (motif === 'layers') {
        for (j = 0; j < 4; j++) {
          ctx.strokeStyle = 'rgba(94, 232, 125, ' + (0.15 + j * 0.12) + ')';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 30 + j * 5, cy - 22 + j * 6, 60 - j * 10, 44 - j * 8);
        }
      } else if (motif === 'edge') {
        ctx.strokeStyle = 'rgba(94, 232, 125, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 36, cy + 28);
        ctx.lineTo(cx - 8, cy - 8);
        ctx.stroke();
        dot(cx + 36, cy + 28, 5, 0.9);
        dot(cx - 8, cy - 8, 4, 0.5);
      } else if (motif === 'loop') {
        ctx.strokeStyle = 'rgba(94, 232, 125, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 22, t * 2, t * 2 + Math.PI * 1.7);
        ctx.stroke();
        dot(cx + 22, cy, 4, 0.85);
      } else {
        dot(cx, cy, 6, 0.8);
      }
    } else if (secId === 'upgrades') {
      if (motif === 'chunks') {
        for (i = 0; i < 3; i++) {
          for (j = 0; j < 3; j++) {
            var on = ((i + j + Math.floor(t * 2)) % 3) === 1;
            ctx.fillStyle = on ? 'rgba(94,232,125,0.65)' : 'rgba(60,60,60,0.5)';
            ctx.fillRect(cx - 22 + i * 15, cy - 22 + j * 15, 12, 12);
          }
        }
      } else if (motif === 'net') {
        for (i = 0; i < 5; i++) {
          dot(cx + Math.cos(i * 1.2 + t) * 24, cy + Math.sin(i * 1.7) * 18, 3.5, 0.7);
        }
        ctx.strokeStyle = 'rgba(94, 232, 125, 0.25)';
        ctx.lineWidth = 1;
        for (i = 0; i < 5; i++) {
          for (j = i + 1; j < 5; j++) {
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(i * 1.2 + t) * 24, cy + Math.sin(i * 1.7) * 18);
            ctx.lineTo(cx + Math.cos(j * 1.2 + t) * 24, cy + Math.sin(j * 1.7) * 18);
            ctx.stroke();
          }
        }
      } else if (motif === 'focus') {
        g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 40);
        g.addColorStop(0, 'rgba(94,232,125,0.5)');
        g.addColorStop(0.35, 'rgba(94,232,125,0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        dot(cx, cy, 6, 1);
      } else if (motif === 'fast') {
        for (i = 0; i < 6; i++) {
          ctx.fillStyle = 'rgba(94,232,125,' + (0.6 - i * 0.08) + ')';
          ctx.fillRect(cx - 40 + i * 10 - (t * 40 % 20), cy - 2, 8, 4);
        }
      } else {
        dot(cx, cy, 6, 0.8);
      }
    } else if (secId === 'sacrifice') {
      var u = Math.min(1, state.resources.understanding / 80);
      var tk = Math.min(1, state.resources.ticks / 200);
      if (motif === 'tickUp') {
        ctx.fillStyle = 'rgba(120,120,140,0.5)';
        ctx.fillRect(cx - 36, cy + 20, 72 * tk, 6);
        ctx.fillStyle = 'rgba(94,232,125,0.85)';
        ctx.fillRect(cx - 36, cy - 8, 72 * u, 6);
        dot(cx, cy - 26, 4, 0.9);
      } else if (motif === 'uDown') {
        ctx.fillStyle = 'rgba(94,232,125,0.85)';
        ctx.fillRect(cx - 36, cy - 8, 72 * u, 6);
        ctx.fillStyle = 'rgba(120,120,140,0.5)';
        ctx.fillRect(cx - 36, cy + 20, 72 * tk, 6);
      } else if (motif === 'collapse') {
        var shrink = 0.35 + 0.35 * Math.sin(t * 2);
        ctx.strokeStyle = 'rgba(94,232,125,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 32 * shrink, 0, Math.PI * 2);
        ctx.stroke();
        dot(cx, cy, 5 * shrink, 0.9);
      } else {
        dot(cx, cy, 6, 0.7);
      }
    }
  }

  // initialElapsed: optional ms offset into the cycle at which to start the
  // animation. Pass ANIM_PROBE_OFFSET_MS after a particle "to" transition so
  // the first live frame (all dots lit, entering fade) matches the probe snapshot.
  function startMountAnimation(canvas, initialElapsed) {
    var ctx       = canvas.getContext('2d');
    var offsetMs  = (typeof initialElapsed === 'number') ? initialElapsed : 0;
    var startTime = null;

    function frame(now) {
      mountAnimFrameId = requestAnimationFrame(frame);
      if (!startTime) startTime = now;

      var rect = canvas.getBoundingClientRect();
      var dpr  = window.devicePixelRatio || 1;
      var cssW = Math.round(rect.width);
      var cssH = Math.round(rect.height);
      if (cssW < 10 || cssH < 10) return;

      var physW = Math.round(cssW * dpr);
      var physH = Math.round(cssH * dpr);
      if (canvas.width !== physW || canvas.height !== physH) {
        canvas.width  = physW;
        canvas.height = physH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMountFrame(ctx, cssW, cssH, (now - startTime) + offsetMs, true);
    }

    mountAnimFrameId = requestAnimationFrame(frame);
  }

  function stopMountAnimation() {
    if (mountAnimFrameId !== null) {
      cancelAnimationFrame(mountAnimFrameId);
      mountAnimFrameId = null;
    }
  }

  // buildMountHeroProbe: creates an off-screen probe element that mirrors the
  // mount() hero structure (canvas + text), with the canvas pre-drawn at the
  // "all dots lit" state. Used by the particle transition engine to build a
  // to-surface that includes the animation, not just the label text.
  function buildMountHeroProbe(containerEl) {
    var heroContainer = containerEl || document.getElementById('spa-hero-container');
    if (!heroContainer) return null;

    var probeHero = document.createElement('div');
    probeHero.className = 'spa-hero';
    probeHero.setAttribute('data-probe', '1');
    probeHero.style.position    = 'absolute';
    probeHero.style.pointerEvents = 'none';
    probeHero.style.margin      = '0';
    probeHero.style.left        = '-9999px';
    probeHero.style.top         = '-9999px';

    // Match width of the live hero so font wrapping is identical.
    var liveHeroEl = heroContainer.querySelector('.spa-hero:not([data-probe])');
    if (liveHeroEl instanceof window.HTMLElement) {
      var liveRect = liveHeroEl.getBoundingClientRect();
      if (liveRect.width > 0) probeHero.style.width = liveRect.width + 'px';
    } else {
      probeHero.style.width = Math.max(220, Math.min(heroContainer.clientWidth || 320, 608)) + 'px';
    }

    // Canvas behind text (same structure as mount())
    var canvas = document.createElement('canvas');
    canvas.style.position    = 'absolute';
    canvas.style.top         = '0';
    canvas.style.left        = '0';
    canvas.style.right       = '0';
    canvas.style.bottom      = '0';
    canvas.style.width       = '100%';
    canvas.style.height      = '100%';
    canvas.style.zIndex      = '0';
    canvas.style.pointerEvents = 'none';
    probeHero.appendChild(canvas);

    var heroText = document.createElement('div');
    heroText.className       = 'spa-hero-text';
    heroText.style.position  = 'relative';
    heroText.style.zIndex    = '1';
    heroText.textContent     = 'Asymptote Engine';
    probeHero.appendChild(heroText);

    heroContainer.appendChild(probeHero);

    // Draw animation at the "all dots fully lit, just before fade-out" state.
    var rect = probeHero.getBoundingClientRect();
    var cssW = Math.round(rect.width);
    var cssH = Math.round(rect.height);
    if (cssW > 0 && cssH > 0) {
      var dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMountFrame(ctx, cssW, cssH, ANIM_PROBE_OFFSET_MS, true);
    }

    return { element: probeHero, cleanup: function () { probeHero.remove(); } };
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────

  // mount: called by the SPA when the user navigates to Games / Asymptote Engine.
  // Renders the "Asymptote Engine" text hero with the animated graph canvas behind it.
  // The user must tap it to enter the game; nothing starts automatically.
  function mount(containerEl) {
    stopMountAnimation();
    containerEl.innerHTML = '';

    var hero = document.createElement('div');
    hero.className = 'spa-hero';
    hero.style.position = 'relative';
    hero.setAttribute('tabindex', '0');
    hero.setAttribute('aria-label', 'Enter Asymptote Engine');

    // Keyboard entry
    hero.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (typeof window.__SPA_EnterCurrentGame === 'function') {
          window.__SPA_EnterCurrentGame();
        } else if (window.__SPA_Views && window.__SPA_Views.games) {
          window.__SPA_Views.games.onEnterGame();
        }
      }
    });

    // Canvas animation (behind the text)
    var canvas = document.createElement('canvas');
    canvas.style.position   = 'absolute';
    canvas.style.top        = '0';
    canvas.style.right      = '0';
    canvas.style.bottom     = '0';
    canvas.style.left       = '0';
    canvas.style.width      = '100%';
    canvas.style.height     = '100%';
    canvas.style.zIndex     = '0';
    canvas.style.pointerEvents = 'none';
    hero.appendChild(canvas);

    var heroText = document.createElement('div');
    heroText.className        = 'spa-hero-text';
    heroText.style.position   = 'relative';
    heroText.style.zIndex     = '1';
    heroText.textContent      = 'Asymptote Engine';
    hero.appendChild(heroText);

    containerEl.appendChild(hero);
    // Start offset so the first live frame (all dots lit, entering fade) matches
    // the buildMountHeroProbe snapshot that particle transitions reform into.
    startMountAnimation(canvas, ANIM_PROBE_OFFSET_MS);
  }

  // enterGame: called when the user taps the "Asymptote Engine" hero.
  // Replaces the SPA nav/hero/dots with game content and starts the loops.
  function enterGame() {
    stopMountAnimation();
    if (!state) state = createState();
    entryIntroActive = true;
    entryIntroStartMs = performance.now();
    corePulseAt = 0;
    renderGameDOM();
    dirty = true;
    startTick();
    startRender();

    window.__SPA_GameNav = {
      // Read current game position
      getFromTarget: function () {
        var sec = getCurrentSection();
        return { sectionIdx: state.sectionIdx, itemIdx: state.itemIndices[sec.id] };
      },
      // Compute next/prev game target without changing state
      getToTarget: function (direction) {
        return direction === 'next' ? getNextGameTarget() : getPrevGameTarget();
      },
      // Build an off-screen hero probe for the given game item (for rasterization)
      buildHeroProbe: function (secIdx, itemIdx) {
        return buildGameHeroProbe(secIdx, itemIdx);
      },
      // Navigate game to a specific section/item and rebuild DOM
      commitTo: function (secIdx, itemIdx) {
        navigateTo(secIdx, itemIdx);
      },
      // Instant navigation (dot / section-tab clicks; no particle effect)
      navigateNext: function () { navigateInDir('next'); },
      navigatePrev: function () { navigateInDir('prev'); },
      // Action tap — activates current item
      onTap: doCurrentItemAction
    };
  }

  // stopGame: stops tick + render but keeps the DOM intact so the transition
  // engine can capture the current game hero as the particle "from" surface.
  // Called by gamesView.onDeactivate before goTo() kicks off the transition.
  function stopGame() {
    stopTick();
    stopRender();
    window.__SPA_GameNav = null;
  }

  // deactivate: called when the SPA has finished navigating away from
  // games/asymptote. The SPA restores spa-section-nav / dots / hero itself.
  function deactivate() {
    stopMountAnimation();
    stopGame();
  }

  function buildEntryGameHeroProbe(containerEl) {
    return buildGameHeroProbe(0, 0, containerEl);
  }

  window.AsymptoteApp = {
    mount:                  mount,
    enterGame:              enterGame,
    stopGame:               stopGame,
    deactivate:             deactivate,
    buildMountHeroProbe:    buildMountHeroProbe,
    buildEntryGameHeroProbe: buildEntryGameHeroProbe
  };

}());
