// src/ui/phone.js
//
// The Engineer's phone and the screens it opens: the Today board, the
// Engineer's Notebook (with little circuit drawings on each card) and
// Records. Drawing only; taps go back through callbacks.
//
// Main pieces: showPhone(), showToday(), showNotebook(), showNotebookCard(),
// drawFigure(), showRecords().
// Used by: src/scene/phone.js.

// A small "New!" tag or a red badge on a tile, at its top corners.
function tileExtras(scene, layer, x, y, tileW, tileH, it) {
  if (it.isNew) layer.add(scene.add.image(x - tileW / 2 + 22, y - tileH / 2 + 10, "ico_new"));
  if (it.badge) {
    layer.add(scene.add.rectangle(x + tileW / 2 - 12, y - tileH / 2 + 12, 22, 18, PALN["2"]).setStrokeStyle(2, UI_INK));
    layer.add(scene.add.text(x + tileW / 2 - 12, y - tileH / 2 + 12, it.badge === true ? "!" : String(it.badge), { fontFamily: GAME_FONT, fontSize: "12px", color: "#f4f4f4", fontStyle: "bold" }).setOrigin(0.5));
  }
}

// --- Phone ---
// App tiles in tabs (Town, World, Me, Make, Settings). apps: [{ key, name, icon, tab, sub, isNew, badge }]
function showPhone(scene, { apps, tab = "town", tabNews = {}, onApp, onTab }) {
  const s = openScreen(scene, { title: "Engineer's phone", width: 660, height: 520 });
  // a phone-style status strip: the time and a full battery
  const d = new Date();
  screenText(scene, s.layer, s.left + 26, s.top + 64, `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`, { size: 13, bold: true, color: "#566c86", originX: 0 });
  s.layer.add(scene.add.rectangle(s.left + s.width - 46, s.top + 64, 30, 14, PALN["5"]).setStrokeStyle(2, UI_INK));
  s.layer.add(scene.add.rectangle(s.left + s.width - 29, s.top + 64, 3, 6, UI_INK));
  PHONE_TABS.forEach(([t, label], i) => {
    const x = s.left + 70 + i * 128;
    const btn = screenButton(scene, s.layer, x, s.top + 96, 118, 34, label, { fill: tab === t ? PALN["4"] : PALN["C"], fontSize: 14 }, () => onTab(t, s));
    btn.hit.tag = "phonetab:" + t;
    if (tabNews[t]) s.layer.add(scene.add.image(x + 44, s.top + 80, "ico_new"));
  });
  const list = apps.filter(a => a.tab === tab);
  const items = list.map(a => ({
    tag: "app:" + a.key, icon: a.icon, name: a.name, sub: a.sub ?? "", isNew: a.isNew, badge: a.badge,
    onTap: () => onApp(a.key, s),
  }));
  if (!items.length) screenText(scene, s.layer, s.cx, s.top + 250, "Nothing here yet — keep playing to unlock more apps!", { size: 15, color: "#566c86" });
  const cols = 4, tileW = 138, tileH = 112, gap = 12, top = s.top + 130;
  tileGrid(scene, s, items, { cols, tileW, tileH, top, gap });
  const gridW = cols * tileW + (cols - 1) * gap, x0 = s.cx - gridW / 2 + tileW / 2;
  items.forEach((it, i) => tileExtras(scene, s.layer, x0 + (i % cols) * (tileW + gap), top + Math.floor(i / cols) * (tileH + gap) + tileH / 2, tileW, tileH, it));
  screenText(scene, s.layer, s.cx, s.top + s.height - 22, "More apps appear as you level up.", { size: 12, color: "#566c86" });
  return s;
}

// --- Today ---
// What to do next. items come from todayItems() (src/rules/progress.js).
function showToday(scene, { items, townLine, onGo }) {
  const rows = items.slice(0, 7);
  const s = openScreen(scene, { title: "Today", width: 700, height: Math.min(560, 150 + rows.length * 62) });
  s.layer.add(scene.add.image(s.left + 46, s.top + 70, "ico_today").setScale(1.4));
  screenText(scene, s.layer, s.left + 80, s.top + 70, "Here's what to do next:", { size: 16, bold: true, originX: 0 });
  rows.forEach((it, i) => {
    const y = s.top + 118 + i * 62;
    s.layer.add(scene.add.rectangle(s.cx, y, s.width - 40, 54, it.urgent ? 0xffe0d6 : 0xe8f6ff).setStrokeStyle(2, it.urgent ? PALN["2"] : PALN["D"]));
    fitImage(scene, s.layer, s.left + 50, y, it.icon && scene.textures.exists(it.icon) ? it.icon : "sparky", 40, 40);
    screenText(scene, s.layer, s.left + 84, y, it.text, { size: 14, bold: !!it.urgent, color: it.urgent ? "#b13e53" : "#1a1c2c", originX: 0, align: "left", wrap: it.action ? 450 : 560 });
    if (it.action) {
      const btn = screenButton(scene, s.layer, s.left + s.width - 70, y, 90, 38, "Go ▶", { fill: PALN["5"], fontSize: 15 }, () => onGo(it, s));
      btn.hit.tag = "today:" + it.key;
    }
  });
  if (townLine) screenText(scene, s.layer, s.cx, s.top + s.height - 22, townLine, { size: 12, color: "#566c86" });
  return s;
}

// --- Notebook ---
// A card for every idea, locked until you learn it.
function showNotebook(scene, { profile, onCard }) {
  resistorTexture(scene, 470);
  const have = new Set(notebookCards(profile).map(c => c.key));
  const s = openScreen(scene, { title: `Engineer's Notebook  ${have.size}/${NOTEBOOK.length}`, width: 720, height: 560 });
  const items = NOTEBOOK.map(c => {
    const got = have.has(c.key);
    return {
      tag: "card:" + c.key, icon: got ? c.pic : null, name: got ? c.title : "???", locked: !got,
      sub: got ? "" : "keep playing", isNew: got && !(profile.seenCards || []).includes(c.key),
      onTap: () => (got ? onCard(c, s) : null),
    };
  });
  const sg = scrollGrid(scene, s, items, { cols: 4, tileW: 150, tileH: 104, top: s.top + 70, height: s.height - 110, gap: 10, cx: s.cx - 16, memKey: "notebook" });
  items.forEach((it, i) => {
    const o = sg.pane.list.find(x => x.tag === it.tag);
    if (o) tileExtras(scene, sg.pane, o.x, o.y, 150, 104, it);
  });
  screenText(scene, s.layer, s.cx, s.top + s.height - 22, "Finish levels to fill your notebook. Tap a card to read it.", { size: 12, color: "#566c86" });
  return s;
}
function showNotebookCard(scene, { card, onBack }) {
  resistorTexture(scene, 470);
  const s = openScreen(scene, { title: card.title, width: 600, height: 400 });
  s.layer.add(scene.add.rectangle(s.left + 150, s.top + 170, 230, 200, 0xfff6e0).setStrokeStyle(3, PALN["b"]));
  if (card.fig) drawFigure(scene, s.layer, s.left + 150, s.top + 170, card.fig);
  else fitImage(scene, s.layer, s.left + 150, s.top + 170, card.pic, 150, 140);
  screenText(scene, s.layer, s.left + 300, s.top + 110, card.text, { size: 17, bold: true, originX: 0, originY: 0, align: "left", wrap: 270 });
  s.layer.add(scene.add.image(s.left + 330, s.top + 300, "sparky").setScale(1.3));
  screenText(scene, s.layer, s.left + 370, s.top + 300, "Try it in your town!", { size: 13, color: "#257179", originX: 0 });
  screenButton(scene, s.layer, s.cx, s.top + s.height - 34, 180, 40, "Back", { fill: PALN["C"], fontSize: 15 }, () => { s.close(); onBack(); }).hit.tag = "card:back";
  return s;
}
// Little circuit drawings for the notebook (GEN on the left, GND at the bottom).
function drawFigure(scene, layer, cx, cy, fig) {
  const g = scene.add.graphics();
  layer.add(g);
  const wire = (pts, color = PALN["3"]) => { g.lineStyle(4, color); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.strokePath(); };
  const L = cx - 90, R = cx + 90, T = cy - 60, B = cy + 60;
  const icon = (x, y, key, w = 34, h = 34) => fitImage(scene, layer, x, y, key, w, h);
  const gen = () => { g.fillStyle(PALN["E"]).fillRect(L - 14, cy - 18, 28, 36); layer.add(scene.add.text(L, cy, "G", { fontFamily: GAME_FONT, fontSize: "16px", color: "#ffcd75", fontStyle: "bold" }).setOrigin(0.5)); };
  if (fig === "loop") { wire([[L, cy - 18], [L, T], [R, T], [R, B], [L, B], [L, cy + 18]]); gen(); icon(R, cy, "house"); }
  if (fig === "series") { wire([[L, cy - 18], [L, T], [R, T], [R, B], [L, B], [L, cy + 18]]); gen(); icon(cx - 30, T, "led_on", 26, 30); icon(cx + 30, T, "led_on", 26, 30); }
  if (fig === "parallel") { wire([[L, cy - 18], [L, T], [R, T], [R, B], [L, B], [L, cy + 18]]); wire([[cx, T], [cx, B]]); gen(); icon(cx, cy, "house", 30, 30); icon(R, cy, "house", 30, 30); }
  if (fig === "short") { wire([[L, cy - 18], [L, T], [R, T], [R, B], [L, B], [L, cy + 18]]); wire([[cx, T], [cx, B]], PALN["2"]); gen(); icon(R, cy, "house", 30, 30); layer.add(scene.add.text(cx + 8, cy, "⚡", { fontSize: "18px" }).setOrigin(0, 0.5)); }
  if (fig === "led") { wire([[L, cy - 18], [L, T], [R, T], [R, B], [L, B], [L, cy + 18]]); gen(); icon(cx, T, "res_470", 40, 22); icon(R, cy, "led_on", 26, 30); }
  if (fig === "and") { wire([[L, cy - 18], [L, T], [R, T], [R, B], [L, B], [L, cy + 18]]); gen(); icon(cx - 35, T, "switch_on", 30, 26); icon(cx + 25, T, "switch_on", 30, 26); icon(R, cy, "house", 30, 30); }
  if (fig === "or") { wire([[L, cy - 18], [L, T], [R, T], [R, B], [L, B], [L, cy + 18]]); wire([[L, T], [L, cy - 30], [cx + 40, cy - 30], [cx + 40, T]]); gen(); icon(cx, T, "switch_on", 30, 26); icon(cx, cy - 30, "switch_on", 30, 26); icon(R, cy + 10, "house", 30, 30); }
}

// --- Records ---
// How much of the game you've done, best times and challenges.
function showRecords(scene, { profile, onLevel }) {
  const prog = gameProgress(profile);
  const s = openScreen(scene, { title: "Records", width: 720, height: 540 });
  s.layer.add(scene.add.image(s.left + 60, s.top + 92, "ico_trophy").setScale(2));
  screenText(scene, s.layer, s.left + 110, s.top + 78, `${prog.percent}% of ECE City done`, { size: 22, bold: true, originX: 0 });
  s.layer.add(scene.add.rectangle(s.left + 110, s.top + 108, 300, 16, PALN["D"]).setOrigin(0, 0.5).setStrokeStyle(2, UI_INK));
  s.layer.add(scene.add.rectangle(s.left + 111, s.top + 108, Math.round(298 * prog.percent / 100), 12, PALN["5"]).setOrigin(0, 0.5));
  prog.parts.forEach((p, i) => {
    const y = s.top + 150 + i * 26;
    screenText(scene, s.layer, s.left + 40, y, p.label, { size: 14, originX: 0 });
    screenText(scene, s.layer, s.left + 290, y, `${p.have} / ${p.of}`, { size: 14, bold: true, originX: 1 });
  });
  // best times and challenges, newest first
  screenText(scene, s.layer, s.left + 360, s.top + 150, "Time trials and no-undo wins", { size: 15, bold: true, originX: 0 });
  const rec = Object.entries(profile.records || {}).filter(([id]) => CAMPAIGN_BY_ID[id]);
  if (!rec.length) screenText(scene, s.layer, s.left + 360, s.top + 180, "None yet! Open a level you've finished\nand try ⏱ Time trial or No-undo.", { size: 13, color: "#566c86", originX: 0, originY: 0, align: "left" });
  rec.slice(-9).reverse().forEach(([id, r], i) => {
    const lv = CAMPAIGN_BY_ID[id], y = s.top + 182 + i * 30;
    const t = screenText(scene, s.layer, s.left + 360, y, `${REGIONS[lv.world].name} ${lv.n}`, { size: 13, originX: 0 });
    screenText(scene, s.layer, s.left + 560, y, r.time != null ? `⏱ ${formatTime(r.time)}` : "", { size: 13, bold: true, originX: 0 });
    screenText(scene, s.layer, s.left + 650, y, r.noUndo ? "✓ no-undo" : "", { size: 12, color: "#257179", originX: 0 });
    t.setInteractive({ useHandCursor: true }).on("pointerdown", (p, a, b, e) => { e.stopPropagation(); noteOverlayTap(scene); if (onLevel) onLevel(lv, s); });
  });
  screenText(scene, s.layer, s.cx, s.top + s.height - 22, `Best Sparky streak: ${profile.bestStreak || 0}   ·   Orders done: ${profile.ordersDone || 0}   ·   Emergencies fixed: ${profile.emergenciesDone || 0}`, { size: 12, color: "#566c86" });
  return s;
}
