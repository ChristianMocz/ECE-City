// src/ui/title.js
//
// The title screen (a town at dusk with your engineer), the three save
// files, the settings screen and the in-game MENU. Drawing only; taps go
// back through callbacks, and every tappable thing has a .tag for tests.
//
// Main pieces: showTitle(), showSlots(), showSettings(), showGameMenu().
// Used by: src/scene/start.js, src/scene/events.js.

const TITLE_DEPTH = 900;

// --- Title screen ---
// `slots` are slotSummary() results (null for an empty slot); `current` is the slot loaded underneath.
function showTitle(scene, { slots, current, onContinue, onSlot, onErase, onSettings }) {
  const W = scene.scale.width, H = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(TITLE_DEPTH);
  const block = scene.add.rectangle(W / 2, H / 2, W, H, PALN["8"]).setInteractive();
  block.on("pointerdown", (p, lx, ly, e) => e.stopPropagation());
  layer.add(block);
  // Dusk sky: bands from navy to plum to orange
  const bands = [PALN["8"], PALN["8"], PALN["1"], PALN["1"], PALN["2"], PALN["3"]];
  bands.forEach((c, i) => layer.add(scene.add.rectangle(W / 2, 40 + i * 50, W, 52, c)));
  // twinkling stars
  for (let i = 0; i < 40; i++) {
    const star = scene.add.rectangle((i * 97) % W, 8 + ((i * 53) % 150), 3, 3, PALN["C"]).setAlpha(0.3 + (i % 3) * 0.25);
    layer.add(star);
    scene.tweens.add({ targets: star, alpha: 0.1, yoyo: true, repeat: -1, duration: 700 + (i % 5) * 300, delay: i * 40 });
  }
  // skyline with lit windows
  const sky = scene.add.graphics();
  let x = 0, i = 0;
  const windows = [];
  while (x < W) {
    const bw = 50 + ((i * 37) % 60), bh = 90 + ((i * 71) % 140);
    sky.fillStyle(i % 2 ? PALN["F"] : PALN["0"], 1);
    sky.fillRect(x, 440 - bh, bw - 4, bh);
    for (let wy = 440 - bh + 10; wy < 430; wy += 18) for (let wx = x + 8; wx < x + bw - 14; wx += 14) windows.push([wx, wy]);
    x += bw; i++;
  }
  layer.add(sky);
  windows.forEach(([wx, wy], k) => {
    if ((k * 7) % 3 === 0) return;
    const w = scene.add.rectangle(wx, wy, 6, 8, PALN["4"]).setOrigin(0, 0).setAlpha((k % 4) ? 1 : 0.2);
    layer.add(w);
    if (k % 9 === 0) scene.tweens.add({ targets: w, alpha: 0.15, yoyo: true, repeat: -1, duration: 900 + (k % 7) * 200, delay: k * 23 });
  });
  // ground and road with cars
  layer.add(scene.add.tileSprite(0, 440, W, H - 440, "grass").setOrigin(0, 0));
  layer.add(scene.add.tileSprite(0, 470, W, 72, "road").setOrigin(0, 0));
  for (let c = 0; c < 3; c++) {
    const car = scene.add.image(-60 - c * 330, c % 2 ? 494 : 520, "car_" + (c * 2 % CAR_COLORS.length)).setFlipX(c % 2 === 1);
    layer.add(car);
    const dir = c % 2 ? -1 : 1;
    if (dir < 0) car.x = W + 60 + c * 200;
    scene.tweens.add({ targets: car, x: dir > 0 ? W + 80 : -80, duration: 6000 + c * 1500, repeat: -1, delay: c * 900, onRepeat: () => {} });
  }
  // logo
  const logoShadow = scene.add.text(W / 2 + 6, 104, "ECE CITY", { fontFamily: GAME_FONT, fontSize: "86px", color: "#1a1c2c", fontStyle: "bold" }).setOrigin(0.5);
  const logo = scene.add.text(W / 2, 98, "ECE CITY", { fontFamily: GAME_FONT, fontSize: "86px", color: "#ffcd75", fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 10 }).setOrigin(0.5);
  layer.add([logoShadow, logo]);
  const boltL = scene.add.image(W / 2 - 250, 96, "bolt_big").setScale(0.9), boltR = scene.add.image(W / 2 + 250, 96, "bolt_big").setScale(0.9).setFlipX(true);
  layer.add([boltL, boltR]);
  scene.tweens.add({ targets: [boltL, boltR], scale: 1.02, yoyo: true, repeat: -1, duration: 600, ease: "Sine.InOut" });
  scene.tweens.add({ targets: logo, y: 92, yoyo: true, repeat: -1, duration: 1400, ease: "Sine.InOut" });
  layer.add(scene.add.text(W / 2, 158, "Wire up the world, one light at a time!", { fontFamily: GAME_FONT, fontSize: "18px", color: "#73eff7", fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 5 }).setOrigin(0.5));
  // your engineer and sidekick (from the current save), and Sparky
  const sum = slots[current - 1];
  const eng = makeEngineer(scene, 230, 470);
  dressEngineer(eng, sum ? sum.wearing : { hat: null, shirt: "shirt_blue", pants: "pants_jeans", acc: null });
  eng.container.setScale(3);
  const pet = makeSidekick(scene, 340, 470);
  dressSidekick(pet, sum ? sum.sidekick : { type: "dog", color: "dog_brown", hat: null, acc: null });
  pet.container.setScale(2.4);
  const sparky = scene.add.image(78, 330, "sparky").setScale(1.8);
  layer.add([eng.container, pet.container, sparky]);
  scene.tweens.add({ targets: sparky, y: 316, yoyo: true, repeat: -1, duration: 900, ease: "Sine.InOut" });
  scene.tweens.add({ targets: pet.container, y: 464, yoyo: true, repeat: -1, duration: 380 });
  if (sum) layer.add(scene.add.text(270, 560, `File ${current} · Level ${sum.level} · ${REGIONS[sum.region]?.name || ""}`, { fontFamily: GAME_FONT, fontSize: "15px", color: "#f4f4f4", fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 4 }).setOrigin(0.5));
  // buttons
  const btn = (y, label, fill, tag, fn) => {
    const btn = pixelButton(scene, 640, y, 280, 58, label, { fill, fontSize: 24 });
    btn.hit.tag = tag;
    btn.hit.on("pointerdown", (p, lx, ly, e) => { e.stopPropagation(); noteOverlayTap(scene); if (typeof Music !== "undefined") Music.unlock(); Sfx.play("tap"); fn(); });
    layer.add(btn.parts);
    return btn;
  };
  let y = 250;
  if (sum) { btn(y, "▶ CONTINUE", PALN["5"], "title:continue", () => onContinue()); y += 76; }
  btn(y, sum ? "SAVE FILES" : "▶ PLAY", PALN["4"], "title:play", () => showSlots(scene, { slots, current, onSlot, onErase, parent: layer })); y += 76;
  btn(y, "SETTINGS", PALN["B"], "title:settings", () => onSettings(layer)); y += 76;
  layer.add(scene.add.text(W - 10, H - 8, "Tap to play · ECE City", { fontFamily: GAME_FONT, fontSize: "11px", color: "#94b0c2" }).setOrigin(1, 1));
  layer.close = () => {
    if (!layer.active || layer.isClosing) return;
    noteOverlayTap(scene);
    // taps go straight to the game while it fades away
    const off = (l) => { for (const o of l) { if (o.input) o.disableInteractive(); if (o.list) off(o.list); } };
    off(layer.list);
    scene.tweens.add({ targets: layer, alpha: 0, duration: 260, onComplete: () => layer.destroy() });
    layer.isClosing = true;
  };
  layer.tag = "title";
  return layer;
}

// The three save files.
function showSlots(scene, { slots, current, onSlot, onErase }) {
  const s = openScreen(scene, { title: "Save files", width: 640, height: 440 });
  s.layer.setDepth(TITLE_DEPTH + 10);
  for (let n = 1; n <= SLOT_COUNT; n++) {
    const sum = slots[n - 1];
    const y = s.top + 100 + (n - 1) * 110;
    const card = screenButton(scene, s.layer, s.cx - 40, y, 480, 96, "", { fill: n === current ? 0xd9f7c8 : 0xe8f6ff }, () => onSlot(n, s));
    card.hit.tag = "slot:" + n;
    if (sum) {
      const eng = makeEngineer(scene, s.left + 90, y + 40);
      dressEngineer(eng, sum.wearing); eng.container.setScale(1.1);
      s.layer.add(eng.container);
      screenText(scene, s.layer, s.left + 140, y - 26, `File ${n}${n === current ? "  (playing)" : ""}`, { size: 17, bold: true, originX: 0, originY: 0 });
      screenText(scene, s.layer, s.left + 140, y + 2, `Level ${sum.level} · ${sum.coins} coins · ★ ${sum.stars}`, { size: 14, originX: 0, originY: 0 });
      screenText(scene, s.layer, s.left + 140, y + 22, `In ${REGIONS[sum.region]?.name || "Sparkville"}`, { size: 13, color: "#257179", originX: 0, originY: 0 });
      const er = screenButton(scene, s.layer, s.left + s.width - 70, y, 90, 36, "Erase", { fill: PALN["3"], fontSize: 13 }, () => onErase(n, s));
      er.hit.tag = "erase:" + n;
    } else {
      screenText(scene, s.layer, s.cx - 40, y, `File ${n} — empty.  Tap to start a NEW GAME`, { size: 16, bold: true, color: "#566c86" });
    }
  }
  return s;
}

// Settings (from the title screen or the MENU).
function showSettings(scene, { get, set, depth }) {
  const s = openScreen(scene, { title: "Settings", width: 520, height: 380 });
  if (depth) s.layer.setDepth(depth);
  const rows = [
    ["music", "Music", "Chiptune songs for every world"],
    ["sound", "Sound effects", "Clicks, coins and zaps"],
    ["sparky", "Sparky's guessing game", "Sparky asks you to predict changes"],
    ["emergencies", "Emergencies", "Surprise timed jobs in your town"],
  ];
  rows.forEach(([key, label, sub], i) => {
    const y = s.top + 92 + i * 66;
    const on = get(key);
    screenText(scene, s.layer, s.left + 30, y - 10, label, { size: 17, bold: true, originX: 0 });
    screenText(scene, s.layer, s.left + 30, y + 12, sub, { size: 12, color: "#566c86", originX: 0 });
    const btn = screenButton(scene, s.layer, s.left + s.width - 80, y, 110, 40, on ? "ON" : "OFF", { fill: on ? PALN["5"] : PALN["D"], fontSize: 16 }, () => {
      set(key, !get(key));
      btn.text.setText(get(key) ? "ON" : "OFF");
      btn.hit.fillColor = get(key) ? PALN["5"] : PALN["D"];
    });
    btn.hit.tag = "setting:" + key;
  });
  return s;
}

// The in-game MENU.
function showGameMenu(scene, { onHowTo, onSettings, onTitle }) {
  const s = openScreen(scene, { title: "Menu", width: 420, height: 330 });
  screenButton(scene, s.layer, s.cx, s.top + 100, 300, 50, "How to play", { fill: PALN["B"], fontSize: 17 }, () => { s.close(); onHowTo(); }).hit.tag = "menu:howto";
  screenButton(scene, s.layer, s.cx, s.top + 168, 300, 50, "Settings", { fill: PALN["C"], fontSize: 17 }, () => { s.close(); onSettings(); }).hit.tag = "menu:settings";
  screenButton(scene, s.layer, s.cx, s.top + 236, 300, 50, "Save & title screen", { fill: PALN["4"], fontSize: 17 }, () => { s.close(); onTitle(); }).hit.tag = "menu:title";
  screenText(scene, s.layer, s.cx, s.top + s.height - 20, "Your game saves by itself as you play.", { size: 12, color: "#566c86" });
  return s;
}
