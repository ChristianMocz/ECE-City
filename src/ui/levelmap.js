// src/ui/levelmap.js
//
// The campaign screens: a world's levels along a winding path, a level's
// card before you play it, and the star result when you finish. Drawing
// only; taps go back through callbacks.
//
// Main pieces: showLevels(), showLevelCard(), showLevelResult().
// Used by: src/scene/levelplay.js, src/scene/phone.js.

// --- Level path ---
// A world's ten levels along a winding path. ◀ ▶ change world.
function starRow(scene, layer, x, y, n, size = 0.5, gap = 16) {
  for (let i = 0; i < 3; i++) layer.add(scene.add.image(x + (i - 1) * gap, y, i < n ? "star_big" : "star_empty").setScale(size));
}
function showLevels(scene, { profile, world, onPick, onWorld, onTraining, onBack }) {
  const r = REGIONS[world];
  const levels = campaignLevelsOf(world);
  const got = campaignStars(profile, world);
  const s = openScreen(scene, { title: `${r.name} levels  ★ ${got}/${levels.length * 3}`, width: 820, height: 560 });
  const regionInfo = regionStatus(profile, world);
  // ground for the path
  s.layer.add(scene.add.tileSprite(s.left + 10, s.top + 52, s.width - 20, s.height - 120, REGION_GROUND[world] || "grass").setOrigin(0, 0).setAlpha(0.9));
  const idx = REGION_KEYS.indexOf(world);
  const prevB = screenButton(scene, s.layer, s.left + 40, s.top + 28, 44, 34, "◀", { fill: idx > 0 ? PALN["4"] : PALN["D"], fontSize: 16 }, () => { if (idx > 0) onWorld(REGION_KEYS[idx - 1], s); });
  prevB.hit.tag = "levels:prev";
  const nextB = screenButton(scene, s.layer, s.left + 90, s.top + 28, 44, 34, "▶", { fill: idx < REGION_KEYS.length - 1 ? PALN["4"] : PALN["D"], fontSize: 16 }, () => { if (idx < REGION_KEYS.length - 1) onWorld(REGION_KEYS[idx + 1], s); });
  nextB.hit.tag = "levels:next";
  // path: two rows of five, snaking
  const spots = levels.map((lv, i) => {
    const row = Math.floor(i / 5), col = row % 2 ? 4 - (i % 5) : i % 5;
    return [s.left + 110 + col * 150, s.top + 150 + row * 190];
  });
  const g = scene.add.graphics();
  for (let i = 0; i + 1 < spots.length; i++) {
    const [x1, y1] = spots[i], [x2, y2] = spots[i + 1];
    const n = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 14));
    g.fillStyle(PALN["C"], 0.9);
    for (let j = 1; j < n; j++) g.fillRect(Math.round(x1 + (x2 - x1) * j / n) - 3, Math.round(y1 + (y2 - y1) * j / n) - 3, 6, 6);
  }
  s.layer.add(g);
  levels.forEach((lv, i) => {
    const [x, y] = spots[i];
    const u = levelUnlocked(profile, lv);
    const stars = profile.campaign[lv.id] || 0;
    const fill = !u.ok ? PALN["D"] : stars ? PALN["5"] : PALN["4"];
    const btn = screenButton(scene, s.layer, x, y, 74, 64, String(lv.n), { fill, fontSize: 26 }, () => onPick(lv, s, u));
    btn.hit.tag = "level:" + lv.id;
    if (!u.ok) s.layer.add(scene.add.image(x + 28, y - 26, "lock"));
    if (lv.hard) s.layer.add(scene.add.image(x - 28, y - 26, "coin"));
    starRow(scene, s.layer, x, y + 46, stars);
    screenText(scene, s.layer, x, y + 70, lv.title, { size: 12, bold: true, color: "#f4f4f4", wrap: 140 }).setStroke("#1a1c2c", 4);
    if (u.ok && !stars && (i === 0 || profile.campaign[levels[i - 1].id] >= 1)) {
      const pin = scene.add.image(x, y - 50, "map_pin");
      s.layer.add(pin);
      scene.tweens.add({ targets: pin, y: y - 58, yoyo: true, repeat: -1, duration: 450 });
    }
  });
  // the Expert level opens when all ten are done
  const ex = typeof expertLevelOf === "function" ? expertLevelOf(world) : null;
  if (ex) {
    const u = levelUnlocked(profile, ex), stars = profile.campaign[ex.id] || 0;
    const btn = screenButton(scene, s.layer, s.left + s.width - 120, s.top + 470, 190, 40, u.ok ? "★ EXPERT ★" : "EXPERT (locked)", { fill: u.ok ? PALN["2"] : PALN["D"], textColor: u.ok ? "#ffcd75" : "#1a1c2c", fontSize: 15 }, () => onPick(ex, s, u));
    btn.hit.tag = "level:" + ex.id;
    if (!u.ok) s.layer.add(scene.add.image(s.left + s.width - 32, s.top + 456, "lock"));
    else starRow(scene, s.layer, s.left + s.width - 236, s.top + 470, stars, 0.45, 16);
  }
  if (!regionInfo.ok) screenText(scene, s.layer, s.cx, s.top + 108, `${r.name} is locked: ${regionInfo.why}`, { size: 15, bold: true, color: "#ffcd75", wrap: s.width - 60 }).setStroke("#1a1c2c", 5);
  screenText(scene, s.layer, s.left + 20, s.top + s.height - 34, `You'll learn: ${r.learn || ""}`, { size: 12, color: "#333c57", originX: 0, align: "left", wrap: 470 });
  screenButton(scene, s.layer, s.left + s.width - 250, s.top + s.height - 34, 150, 38, "Training", { fill: PALN["B"], fontSize: 14 }, () => onTraining(s)).hit.tag = "levels:training";
  if (onBack) screenButton(scene, s.layer, s.left + s.width - 90, s.top + s.height - 34, 150, 38, "My town", { fill: PALN["C"], fontSize: 14 }, () => onBack(s)).hit.tag = "levels:back";
  return s;
}

// --- Level card ---
// Shown before you play a level.
function showLevelCard(scene, { profile, level, onPlay, onBack }) {
  const s = openScreen(scene, { title: level.custom ? level.title : level.expert ? `${REGIONS[level.world].name}: ${level.title}` : `${REGIONS[level.world].name} ${level.n}: ${level.title}`, width: 660, height: 430 });
  s.layer.add(scene.add.image(s.left + 70, s.top + 110, "sparky").setScale(1.8));
  if (level.teach) screenText(scene, s.layer, s.left + 130, s.top + 64, level.teach, { size: 14, color: "#257179", bold: true, originX: 0, originY: 0, align: "left", wrap: 470 });
  screenText(scene, s.layer, s.left + 130, s.top + 140, `Goal: ${level.goal}`, { size: 15, bold: true, originX: 0, originY: 0, align: "left", wrap: 470 });
  const env = level.env || {};
  const notes = [];
  if (env.night) notes.push("It's night.");
  if (env.solarFactor != null && !env.night) notes.push(env.solarFactor > 1 ? "Bright sunshine." : env.solarFactor < 1 ? "Cloudy." : "");
  if (env.genScale === 0) notes.push("The generator is broken!");
  else if (env.genScale != null && env.genScale < 1) notes.push("The power plant is weak today.");
  if (env.plant && typeof PLANTS !== "undefined") notes.push(`Power: ${PLANTS[env.plant].name}.`);
  if (notes.filter(Boolean).length) screenText(scene, s.layer, s.left + 130, s.top + 200, notes.filter(Boolean).join(" "), { size: 13, color: "#b13e53", originX: 0, originY: 0 });
  screenText(scene, s.layer, s.left + 40, s.top + 240, `${level.hard ? "Tight budget" : "Budget"}: $${level.budget}${level.hard ? " — you can't spend more!" : ""}`, { size: 15, bold: true, originX: 0, color: level.hard ? "#b13e53" : "#1a1c2c" });
  const tools = level.tool.length ? level.tool.map(t => `${t.n}× ${toolLabel(t)}`).join(", ") : "no extra parts — use what's on the board";
  screenText(scene, s.layer, s.left + 40, s.top + 266, `Parts: ${tools}`, { size: 13, originX: 0, align: "left", wrap: s.width - 80 });
  const best = profile.campaign[level.id] || 0;
  screenText(scene, s.layer, s.left + 40, s.top + 300, "Stars: ★ finish it  ★ stay in budget  ★ few wires & nothing popped", { size: 12, color: "#566c86", originX: 0 });
  starRow(scene, s.layer, s.left + s.width - 90, s.top + 300, best, 0.6, 22);
  // finishing once opens the challenges: time trial and no-undo
  const rec = profile.records?.[level.id] || {};
  const canChallenge = best >= 1 && !level.custom;
  const bw = canChallenge ? 150 : 200;
  const xs = canChallenge ? [s.cx - 228, s.cx - 68, s.cx + 92, s.cx + 238] : [s.cx - 110, null, null, s.cx + 110];
  screenButton(scene, s.layer, xs[0], s.top + s.height - 40, bw, 46, "Play!", { fill: PALN["5"], fontSize: 18 }, () => { s.close(); onPlay(level, "normal"); }).hit.tag = "level:play";
  if (canChallenge) {
    screenButton(scene, s.layer, xs[1], s.top + s.height - 40, 150, 46, "⏱ Time trial", { fill: PALN["B"], fontSize: 14 }, () => { s.close(); onPlay(level, "time"); }).hit.tag = "level:time";
    screenButton(scene, s.layer, xs[2], s.top + s.height - 40, 150, 46, "No-undo", { fill: PALN["2"], textColor: "#f4f4f4", fontSize: 14 }, () => { s.close(); onPlay(level, "noundo"); }).hit.tag = "level:noundo";
    screenText(scene, s.layer, s.cx - 68, s.top + s.height - 76, rec.time != null ? `best ${formatTime(rec.time)}` : "no time yet", { size: 11, color: "#257179" });
    screenText(scene, s.layer, s.cx + 92, s.top + s.height - 76, rec.noUndo ? "beaten ✓" : "no UNDO, no HINT", { size: 11, color: "#b13e53" });
  } else if (!level.custom) {
    screenText(scene, s.layer, s.cx, s.top + s.height - 76, "Finish it once to unlock ⏱ Time trial and the No-undo challenge.", { size: 11, color: "#566c86" });
  }
  screenButton(scene, s.layer, xs[3], s.top + s.height - 40, canChallenge ? 110 : 180, 46, "Back", { fill: PALN["C"], fontSize: 15 }, () => { s.close(); onBack(); }).hit.tag = "level:cardback";
  return s;
}

// --- Level result ---
// The stars you earned, popping in one by one.
function showLevelResult(scene, { level, result, reward, hasNext, onNext, onRetry, onMap, challenge }) {
  const s = openScreen(scene, { title: `Level complete!`, width: 580, height: 420 });
  if (challenge) screenText(scene, s.layer, s.cx, s.top + 60, challenge, { size: 15, bold: true, color: "#b13e53" });
  const got = [true, result.budget, result.neat];
  got.forEach((on, i) => {
    const img = scene.add.image(s.cx + (i - 1) * 110, s.top + 120, on ? "star_big" : "star_empty").setScale(0.2);
    s.layer.add(img);
    scene.tweens.add({ targets: img, scale: 2.4, duration: 260, delay: 200 + i * 300, ease: "Back.Out", onStart: () => { if (on) Sfx.play("coin"); } });
  });
  const lines = [
    `★ ${level.title} — finished!`,
    `${result.budget ? "★" : "✗"} Budget: spent $${result.spent} of $${level.budget}`,
    `${result.neat ? "★" : "✗"} Neat: ${result.wiresAdded} wire${result.wiresAdded === 1 ? "" : "s"} (best ${level.parWires})${result.popped ? ", but something popped" : ", nothing popped"}`,
  ];
  screenText(scene, s.layer, s.left + 60, s.top + 200, lines.join("\n"), { size: 15, originX: 0, originY: 0, align: "left", wrap: s.width - 100 });
  if (reward && (reward.coins || reward.xp)) screenText(scene, s.layer, s.cx, s.top + 290, `+${reward.coins} coins  +${reward.xp} XP`, { size: 16, bold: true, color: "#257179" });
  else if (!level.custom) screenText(scene, s.layer, s.cx, s.top + 290, "No new stars this time — try for all three!", { size: 13, color: "#566c86" });
  const w = 170;
  screenButton(scene, s.layer, s.cx - 180, s.top + s.height - 40, w, 46, "Try again", { fill: PALN["C"], fontSize: 15 }, () => { s.close(); onRetry(); }).hit.tag = "result:retry";
  screenButton(scene, s.layer, s.cx, s.top + s.height - 40, w, 46, "Level map", { fill: PALN["B"], fontSize: 15 }, () => { s.close(); onMap(); }).hit.tag = "result:map";
  if (hasNext) screenButton(scene, s.layer, s.cx + 180, s.top + s.height - 40, w, 46, "Next level ▶", { fill: PALN["5"], fontSize: 15 }, () => { s.close(); onNext(); }).hit.tag = "result:next";
  return s;
}
