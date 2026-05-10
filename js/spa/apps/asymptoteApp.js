<<<<<<< HEAD
// Asymptote economy module.
// Pure state + tick. No DOM authority, no navigation, no nav/dots rendering.
// gamesView.js reads getSnapshot() and renders into the hero container.
(function () {
  var TICK_MS = 100;

  var economy = null;
  var tickInterval = null;

  function createEconomy() {
    return {
      understanding: 0,
      ticks: 0,
      generatorCount: 0,
      generatorCost: 10,
      upgraded: false,
      upgradeCost: 100,
      clickPower: 1,
      productionMultiplier: 1
    };
  }

  function getEconomy() {
    if (!economy) economy = createEconomy();
    return economy;
  }

  function pps() {
    var e = getEconomy();
    return e.generatorCount * 0.5 * e.productionMultiplier;
  }

  function tick() {
    var e = getEconomy();
    var dt = TICK_MS / 1000;
    e.understanding += pps() * dt;
    e.ticks += dt * 10;
  }

  function startTick() {
    if (tickInterval !== null) return;
    tickInterval = setInterval(tick, TICK_MS);
  }

  function stopTick() {
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function doAction(itemId) {
    var e = getEconomy();

    if (itemId === 'understand') {
      e.understanding += e.clickPower;

    } else if (itemId === 'generate') {
      if (e.understanding >= e.generatorCost) {
        e.understanding -= e.generatorCost;
        e.generatorCount += 1;
        e.generatorCost = Math.floor(e.generatorCost * 1.15);
      }

    } else if (itemId === 'upgrade') {
      if (!e.upgraded && e.understanding >= e.upgradeCost) {
        e.understanding -= e.upgradeCost;
        e.upgraded = true;
        e.productionMultiplier *= 2;
      }

    } else if (itemId === 'collapse') {
      if (e.understanding >= 50 || e.generatorCount >= 5) {
        var bonus = Math.max(1, Math.floor(e.understanding * 0.1 + e.generatorCount * 0.5));
        economy = createEconomy();
        economy.clickPower += bonus;
      }
    }
  }

  function getSnapshot() {
    var e = getEconomy();
    return {
      understanding: e.understanding,
      ticks: e.ticks,
      generatorCount: e.generatorCount,
      generatorCost: e.generatorCost,
      upgraded: e.upgraded,
      upgradeCost: e.upgradeCost,
      clickPower: e.clickPower,
      productionMultiplier: e.productionMultiplier,
      pps: pps()
    };
  }

  window.AsymptoteApp = {
    startTick: startTick,
    stopTick: stopTick,
    doAction: doAction,
    getSnapshot: getSnapshot
  };
}());
=======
// asymptoteApp.js — Asymptote game stub
// Registers with window.__SPA_Views['games'] if a game-mode SPA is present.
// Full implementation would mount the Asymptote procedural animation.
(function() {
  // Minimal stub so main.js onActivate/onDeactivate calls don't throw.
  // Replace this with the real Asymptote engine implementation.
  // Note: the full games section view is registered by gamesView.js.
  // asymptoteApp.js handles the game engine that runs inside the games view.
})();
>>>>>>> b57078b (Runtime reduction and continuity hardening)
