// src/ui/map.js
//
// The world map and the screens that open from it: the power lines view,
// the line builder (plain or with transformers), a power plant's card, a
// region's card, and the result after a boss fight. Drawing only; taps go
// back through callbacks.
//
// Main pieces: MAP_SPOTS, showMap(), showLines(), showLineBuilder(),
// showPlantCard(), showRegion(), showBossResult().
// Used by: src/scene/worldmap.js, src/scene/menus.js, src/scene/boss.js.

// --- World map ---
// Twelve regions on islands, joined by a dotted sea route.
const MAP_SPOTS = {
  sparkville: [145, 150], batterybay: [335, 150], solardesert: [525, 150], mountains: [715, 150],
  windmill: [715, 300], waterfall: [525, 300], neon: [335, 300], tundra: [145, 300],
  volcano: [145, 450], robot: [335, 450], storm: [525, 450], moon: [715, 450],
};
const REGION_ICON = { sparkville: "house", batterybay: "battery", solardesert: "solar", mountains: "xfmr",
  windmill: "scn_windmill", waterfall: "scn_waterfall", neon: "scn_neonsign", tundra: "scn_igloo", volcano: "scn_lavarock", robot: "scn_gear", storm: "scn_lighthouse", moon: "scn_rocket" };
const LINE_COLORS = { 1: PALN["2"], 5: PALN["4"], 10: PALN["5"] };
// Power lines between towns, drawn as cables with pylons.
function drawLines(scene, layer, profile) {
  const g = scene.add.graphics();
  for (const l of profile.lines || []) {
    const [x1, y1] = MAP_SPOTS[l.a], [x2, y2] = MAP_SPOTS[l.b];
    g.lineStyle(7, UI_INK, 1); g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(4, LINE_COLORS[l.ratio] || PALN["4"], 1); g.lineBetween(x1, y1, x2, y2);
  }
  layer.add(g);
  for (const l of profile.lines || []) {
    const [x1, y1] = MAP_SPOTS[l.a], [x2, y2] = MAP_SPOTS[l.b];
    layer.add(scene.add.image((x1 + x2) / 2, (y1 + y2) / 2 - 10, "pylon"));
  }
}
function showMap(scene, { profile, onRegion, onLines }) {
  const s = openScreen(scene, { title: "World map", width: 820, height: 580 });
  const seaTop = s.top + 52, seaH = s.height - 60;
  s.layer.add(scene.add.rectangle(s.cx, seaTop + seaH / 2, s.width - 16, seaH, PALN["A"]));
  const waves = scene.add.graphics();
  waves.fillStyle(PALN["B"], 1);
  for (let i = 0; i < 60; i++) { const x = s.left + 20 + ((i * 137) % (s.width - 60)), y = seaTop + 12 + ((i * 89) % (seaH - 24)); waves.fillRect(x, y, 9, 3); }
  s.layer.add(waves);
  // the dotted route between regions, in order
  const route = scene.add.graphics();
  route.fillStyle(PALN["C"], 0.9);
  for (let i = 0; i < REGION_KEYS.length - 1; i++) {
    const [x1, y1] = MAP_SPOTS[REGION_KEYS[i]], [x2, y2] = MAP_SPOTS[REGION_KEYS[i + 1]];
    const n = Math.floor(Math.hypot(x2 - x1, y2 - y1) / 16);
    for (let j = 2; j < n - 1; j++) route.fillRect(Math.round(x1 + (x2 - x1) * j / n) - 3, Math.round(y1 + (y2 - y1) * j / n) - 3, 6, 6);
  }
  s.layer.add(route);
  drawLines(scene, s.layer, profile);
  for (const key of REGION_KEYS) {
    const r = REGIONS[key];
    const [x, y] = MAP_SPOTS[key];
    const regionInfo = regionStatus(profile, key);
    const isl = scene.add.image(x, y, "island_" + key).setScale(0.8).setInteractive({ useHandCursor: true });
    isl.tag = "map:" + key;
    isl.on("pointerdown", (p, lx, ly, e) => { e.stopPropagation(); noteOverlayTap(scene); Sfx.play("tap"); onRegion(key, s); });
    if (!regionInfo.ok) isl.setTint(0x8a93a6);
    s.layer.add(isl);
    const ic = scene.add.image(x, y - 4, REGION_ICON[key]);
    ic.setScale(Math.min(0.7, 46 / ic.width, 40 / ic.height));
    s.layer.add(ic);
    if (!regionInfo.ok) s.layer.add(scene.add.image(x + 38, y - 24, "lock"));
    const label = scene.add.text(x, y + 42, r.name, { fontFamily: GAME_FONT, fontSize: "15px", color: "#f4f4f4", fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 4 }).setOrigin(0.5);
    s.layer.add(label);
    const stars = typeof campaignStars === "function" ? campaignStars(profile, key) : 0;
    const sub = !regionInfo.ok ? `Level ${r.level}${r.needsBoss && !bossBeaten(profile, r.needsBoss) ? " + boss" : ""}` : profile.region === key ? `You are here · ★${stars}` : `Tap to visit · ★${stars}`;
    s.layer.add(scene.add.text(x, y + 60, sub, { fontFamily: GAME_FONT, fontSize: "12px", color: "#ffcd75", stroke: "#1a1c2c", strokeThickness: 3 }).setOrigin(0.5));
    // Boss stars: one per difficulty won.
    DIFFICULTY_KEYS.forEach((d, i) => {
      const won = !!profile.bossWins?.[key]?.[d];
      s.layer.add(scene.add.image(x - 30 + i * 20, y - 42, "star").setAlpha(won ? 1 : 0.25));
    });
    if (profile.region === key) {
      const pin = scene.add.image(x + 30, y - 18, "map_pin").setScale(1);
      s.layer.add(pin);
      scene.tweens.add({ targets: pin, y: pin.y - 6, yoyo: true, repeat: -1, duration: 500 });
    }
  }
  screenText(scene, s.layer, s.left + 20, s.top + s.height - 22, "Little stars = Captain Short Circuit beaten (Easy → Extreme). ★ = level stars.", { size: 12, color: "#f4f4f4", originX: 0 });
  if (onLines) screenButton(scene, s.layer, s.left + s.width - 100, s.top + s.height - 24, 170, 30, "⚡ Power lines", { fill: PALN["4"], fontSize: 14 }, () => onLines(s)).hit.tag = "map:lines";
  return s;
}

// --- Power lines ---
// Tap two neighbouring towns to join them with a line.
function showLines(scene, { profile, onPick, onBack }) {
  const s = openScreen(scene, { title: "Power lines", width: 820, height: 580 });
  const seaTop = s.top + 52, seaH = s.height - 60;
  s.layer.add(scene.add.rectangle(s.cx, seaTop + seaH / 2, s.width - 16, seaH, PALN["8"]));
  drawLines(scene, s.layer, profile);
  let first = null, firstMark = null;
  for (const key of REGION_KEYS) {
    const [x, y] = MAP_SPOTS[key];
    const ok = regionStatus(profile, key).ok;
    const isl = scene.add.image(x, y, "island_" + key).setScale(0.6).setInteractive({ useHandCursor: true });
    if (!ok) isl.setTint(0x6b7280);
    isl.tag = "lines:" + key;
    s.layer.add(isl);
    s.layer.add(scene.add.text(x, y + 30, REGIONS[key].name, { fontFamily: GAME_FONT, fontSize: "13px", color: "#f4f4f4", fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 4 }).setOrigin(0.5));
    const pk = plantOf(profile, key);
    s.layer.add(scene.add.text(x, y + 46, PLANTS[pk].name, { fontFamily: GAME_FONT, fontSize: "11px", color: "#73eff7", stroke: "#1a1c2c", strokeThickness: 3 }).setOrigin(0.5));
    isl.on("pointerdown", (p, lx, ly, e) => {
      e.stopPropagation(); noteOverlayTap(scene); Sfx.play("tap");
      if (!ok) { help.setText(`${REGIONS[key].name} is still locked.`); return; }
      if (!first) { first = key; firstMark = scene.add.circle(x, y, 40, PALN["4"], 0).setStrokeStyle(4, PALN["4"]); s.layer.add(firstMark); help.setText(`Now tap a town next to ${REGIONS[key].name}.`); return; }
      if (first === key) { first = null; firstMark?.destroy(); help.setText("Tap a town, then a town next to it."); return; }
      const a = first; first = null; firstMark?.destroy();
      if (!lineNeighbours(a, key)) { help.setText("Power lines join towns that are next to each other on the map (along the dotted route)."); return; }
      onPick(a, key, s);
    });
  }
  const help = screenText(scene, s.layer, s.cx, s.top + 74, "Tap a town, then a town next to it, to build a power line.", { size: 14, bold: true, color: "#ffcd75" });
  screenText(scene, s.layer, s.left + 20, s.top + s.height - 22, "Joined towns share their power plants. Red: 12 V line · Yellow: ×5 · Green: ×10", { size: 12, color: "#f4f4f4", originX: 0 });
  screenButton(scene, s.layer, s.left + s.width - 90, s.top + s.height - 24, 150, 30, "Back to map", { fill: PALN["C"], fontSize: 13 }, () => onBack(s)).hit.tag = "lines:back";
  return s;
}
// Choose how to build one line: plain, or with transformers.
function showLineBuilder(scene, { profile, a, b, onBuild }) {
  const old = findLine(profile, a, b);
  const s = openScreen(scene, { title: `${REGIONS[a].name} ⇄ ${REGIONS[b].name}`, width: 640, height: 430 });
  screenText(scene, s.layer, s.left + 30, s.top + 62, "A long power line has resistance, so some power turns into heat on the way. Step the voltage UP with a transformer before the line, and DOWN after it: less current flows, so much less is lost.", { size: 13, originX: 0, originY: 0, align: "left", wrap: s.width - 60 });
  [1, 5, 10].forEach((r, i) => {
    const y = s.top + 170 + i * 74;
    const info = LINE_RATIOS[r];
    s.layer.add(scene.add.rectangle(s.cx, y, s.width - 40, 64, old?.ratio === r ? 0xd9f7c8 : 0xe8f6ff).setStrokeStyle(3, UI_INK));
    s.layer.add(scene.add.rectangle(s.left + 50, y, 26, 8, LINE_COLORS[r]).setStrokeStyle(2, UI_INK));
    screenText(scene, s.layer, s.left + 80, y - 12, info.name, { size: 15, bold: true, originX: 0 });
    screenText(scene, s.layer, s.left + 80, y + 12, `Power lost on the way: ${lineLossPercent(r)}%`, { size: 13, color: lineLossPercent(r) > 30 ? "#b13e53" : "#257179", originX: 0 });
    const label = old?.ratio === r ? "Built ✓" : `${old ? "Upgrade" : "Build"} · ${info.price}`;
    const btn = screenButton(scene, s.layer, s.left + s.width - 110, y, 170, 40, label, { fill: old?.ratio === r ? PALN["D"] : PALN["4"], fontSize: 14 }, () => onBuild(r, s));
    btn.hit.tag = "line:" + r;
  });
  coinLine(scene, s.layer, s.left + 40, s.top + s.height - 24, profile.coins, { size: 15 });
  return s;
}

// A power plant's card: what it's good at, its catch, buy / use.
function showPlantCard(scene, { profile, key, region, status, onBuy, onUse }) {
  const P = PLANTS[key];
  const s = openScreen(scene, { title: P.name, width: 600, height: 380 });
  s.layer.add(scene.add.image(s.left + 110, s.top + 140, P.sprite).setScale(1.2));
  const power = Math.round((1.5 / P.R) * 10) / 10;
  screenText(scene, s.layer, s.left + 210, s.top + 70, `Power: ${power}× the little generator`, { size: 15, bold: true, originX: 0, originY: 0 });
  screenText(scene, s.layer, s.left + 210, s.top + 100, `Good: ${P.good}`, { size: 14, color: "#257179", originX: 0, originY: 0, align: "left", wrap: 360 });
  screenText(scene, s.layer, s.left + 210, s.top + 160, `Catch: ${P.catchText}`, { size: 14, color: "#b13e53", originX: 0, originY: 0, align: "left", wrap: 360 });
  if (status) screenText(scene, s.layer, s.left + 210, s.top + 240, `In ${REGIONS[region].name} right now: ${status}`, { size: 13, color: "#333c57", originX: 0, originY: 0, align: "left", wrap: 360 });
  const owned = plantOwned(profile, key), using = plantOf(profile, region) === key;
  const lvlOk = levelForXp(profile.xp) >= P.level;
  const label = using ? "Powering this town" : owned ? `Use in ${REGIONS[region].name}` : !lvlOk ? `Unlocks at level ${P.level}` : `Buy · ${P.price}`;
  const btn = screenButton(scene, s.layer, s.cx, s.top + s.height - 36, 280, 44, label, { fill: using ? PALN["D"] : PALN["4"], fontSize: 15 }, () => (owned ? onUse(key, s) : onBuy(key, s)));
  btn.hit.tag = owned ? "plant:use" : "plant:buy";
  coinLine(scene, s.layer, s.left + 40, s.top + s.height - 36, profile.coins, { size: 15 });
  return s;
}

// One region: its story, people, parts, and what you can do there.
function showRegion(scene, { profile, key, onTravel, onBoss, onBack, onLevels, onFindCaptain }) {
  resistorTexture(scene, 470);
  const r = REGIONS[key];
  const s = openScreen(scene, { title: r.name, width: 700, height: 500 });
  s.layer.add(scene.add.image(s.left + 100, s.top + 120, "island_" + key));
  { const ic = scene.add.image(s.left + 100, s.top + 116, REGION_ICON[key]); ic.setScale(Math.min(0.7, 60 / ic.width, 50 / ic.height)); s.layer.add(ic); }
  screenText(scene, s.layer, s.left + 190, s.top + 62, r.story, { size: 14, originX: 0, originY: 0, align: "left", wrap: 480 });
  let y = s.top + 158;
  for (const c of r.characters) {
    screenText(scene, s.layer, s.left + 190, y, `${c.name}: "${c.line}"`, { size: 13, color: "#257179", bold: true, originX: 0, align: "left", wrap: 480 });
    y += 24;
  }
  if (r.learn) screenText(scene, s.layer, s.left + 30, s.top + 222, `You'll learn: ${r.learn}`, { size: 13, bold: true, color: "#b13e53", originX: 0, align: "left", wrap: s.width - 60 });
  screenText(scene, s.layer, s.left + 30, s.top + 250, "Parts and power here:", { size: 14, bold: true, originX: 0 });
  const icons = r.parts.slice(0, 3).map(part => ({ icon: BUILD_ICONS[part], name: PARTS[part].name, lv: PARTS[part].level }));
  if (r.plant && r.plant !== "generator" && typeof PLANTS !== "undefined") icons.push({ icon: PLANTS[r.plant].sprite, name: PLANTS[r.plant].name, lv: PLANTS[r.plant].level });
  icons.forEach((it, i) => {
    const x = s.left + 70 + i * 120;
    fitImage(scene, s.layer, x, s.top + 296, it.icon, 70, 50);
    const unlocked = levelForXp(profile.xp) >= it.lv;
    screenText(scene, s.layer, x, s.top + 334, `${it.name}${unlocked ? "" : ` (Lv ${it.lv})`}`, { size: 12, color: unlocked ? "#1a1c2c" : "#566c86", wrap: 116 });
  });
  // Captain Short Circuit (the boss)
  const bossInfo = bossStatus(profile, key);
  const won = DIFFICULTY_KEYS.filter(d => profile.bossWins?.[key]?.[d]).map(d => DIFFICULTIES[d].name);
  s.layer.add(scene.add.image(s.left + s.width - 90, s.top + 290, "captain").setScale(0.9).setTint(bossInfo.ok ? 0xffffff : 0x6b7280));
  screenText(scene, s.layer, s.left + s.width - 90, s.top + 345, won.length ? `Beaten: ${won.join(", ")}` : "Captain Short Circuit", { size: 11, color: "#5d275d", wrap: 160 });
  const regionInfo = regionStatus(profile, key);
  const here = profile.region === key;
  const findCap = !regionInfo.ok && regionInfo.needsBoss && levelForXp(profile.xp) >= r.level;
  const travel = screenButton(scene, s.layer, s.left + 100, s.top + s.height - 42, 160, 44, here ? "You are here" : regionInfo.ok ? "Travel here" : findCap ? "Find the Captain →" : "Locked", { fill: (regionInfo.ok && !here) || findCap ? PALN["4"] : PALN["D"], fontSize: findCap ? 13 : 15 }, () => (findCap && onFindCaptain ? onFindCaptain(regionInfo.needsBoss, s) : onTravel(key, s)));
  travel.hit.tag = "region:travel";
  if (onLevels) screenButton(scene, s.layer, s.left + 270, s.top + s.height - 42, 150, 44, "Levels ★", { fill: regionInfo.ok ? PALN["5"] : PALN["D"], fontSize: 15 }, () => onLevels(key, s)).hit.tag = "region:levels";
  const boss = screenButton(scene, s.layer, s.left + 450, s.top + s.height - 42, 190, 44, "Fight the Captain!", { fill: bossInfo.ok ? PALN["2"] : PALN["D"], textColor: bossInfo.ok ? "#f4f4f4" : "#1a1c2c", fontSize: 14 }, () => onBoss(key, s));
  boss.hit.tag = "region:boss";
  const back = screenButton(scene, s.layer, s.left + s.width - 70, s.top + s.height - 42, 110, 44, "Back", { fill: PALN["C"], fontSize: 14 }, () => onBack(s));
  back.hit.tag = "region:back";
  const why = !regionInfo.ok ? regionInfo.why : !bossInfo.ok ? bossInfo.why : "";
  if (why) screenText(scene, s.layer, s.cx, s.top + s.height - 84, why, { size: 13, color: "#b13e53", bold: true, wrap: s.width - 60 });
  return s;
}

// After a boss fight.
function showBossResult(scene, { won, title, lines, onAgain, onHome }) {
  const s = openScreen(scene, { title, width: 520, height: 330 });
  s.layer.add(scene.add.image(s.left + 80, s.top + 150, won ? "zap" : "captain").setScale(won ? 2.5 : 1));
  screenText(scene, s.layer, s.left + 160, s.top + 80, lines.join("\n"), { size: 15, originX: 0, originY: 0, align: "left", wrap: 330 });
  screenButton(scene, s.layer, s.cx - 115, s.top + s.height - 40, 200, 44, won ? "Fight again" : "Try again", { fill: PALN["4"], fontSize: 15 }, () => { s.close(); onAgain(); }).hit.tag = "boss:again";
  screenButton(scene, s.layer, s.cx + 115, s.top + s.height - 40, 200, 44, "Back to my town", { fill: PALN["B"], fontSize: 15 }, () => { s.close(); onHome(); }).hit.tag = "boss:home";
  return s;
}
