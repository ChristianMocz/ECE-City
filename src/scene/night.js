// src/scene/night.js
//
// Night and storm visuals: a dark-blue wash, unlit parts tinted dark, lit
// windows flickering on at dusk, fireflies, rain, and the layer for broken
// lines left by lightning. The boss blackout also looks like night.
//
// Gives city: applyNight, flickerOnLights, visualNight, rain, repairGfx.

function installNight(city) {
  const { scene, state } = city;
  // --- Night ---
  // The wash sits at depth 8.5, under the helper glow, wires and parts.
  // Night only comes with the clock in your own town.
  const nightWash = scene.add.rectangle(450, 320, 900, 640, PALN["8"], 1).setDepth(8.5).setAlpha(0);
  const fireflies = [];
  for (let i = 0; i < 14; i++) {
    const f = scene.add.rectangle(40 + Math.random() * 820, 170 + Math.random() * 400, 3, 3, PALN["5"]).setDepth(9).setAlpha(0);
    f.homeX = f.x; f.homeY = f.y; f.phase = Math.random() * Math.PI * 2;
    fireflies.push(f);
  }
  // Night, or the boss blackout (looks like night; the physics stays daytime).
  const visualNight = () => !!state.night || (state.context === "boss" && !!state.boss && !state.boss.done);
  function applyNight() {
    const night = visualNight();
    scene.tweens.add({ targets: nightWash, alpha: night ? 0.62 : 0, duration: 600 });
    for (const node of state.nodes.values()) if (node.visual?.tintables) setPartNight(node.visual, night);
    city.refreshPower();
  }
  // At dusk the lights in town flicker on, one window at a time.
  function flickerOnLights() {
    for (const n of state.nodes.values()) {
      if (n.type !== "HOUSE" || !n.visual?.winOn) continue;
      const w = n.visual.winOn;
      w.__flicker?.stop(); // never run two flickers at once
      w.setAlpha(0);
      w.__flicker = scene.tweens.addCounter({
        from: 0, to: 1, duration: 700, delay: Math.random() * 1400,
        onUpdate: (tw) => { const t = tw.getValue(); if (w.active) w.setAlpha(t < 0.3 ? (t * 10) % 2 > 1 ? 1 : 0.2 : t < 0.55 ? 0.3 : 1); },
        onComplete: () => { w.__flicker = null; if (w.active) w.setAlpha(1); },
      });
    }
  }

  function animateFireflies(timeMs) {
    const on = !!state.night;
    for (const f of fireflies) {
      f.x = f.homeX + Math.sin(timeMs / 1400 + f.phase) * 18;
      f.y = f.homeY + Math.cos(timeMs / 1700 + f.phase * 1.3) * 10;
      f.setAlpha(on ? 0.4 + 0.6 * Math.max(0, Math.sin(timeMs / 380 + f.phase * 3)) : 0);
    }
  }
  scene.__animateFireflies = animateFireflies;

  // --- Storms ---
  // Rain, and the dashed red line a lightning strike leaves until fixed.
  const rain = [];
  for (let i = 0; i < 46; i++) {
    const r = scene.add.rectangle(Math.random() * 900, 140 + Math.random() * 460, 2, 9, PALN["A"]).setDepth(9).setAlpha(0);
    r.speed = 260 + Math.random() * 160;
    rain.push(r);
  }
  const repairGfx = scene.add.graphics().setDepth(11);

  Object.assign(city, { applyNight, flickerOnLights, rain, repairGfx, visualNight });
}
