// src/ui/makerscreens.js
//
// Screens for the Puzzle maker: its home screen, a real text box helper,
// entering a friend's code, sharing your own code, the finish screen (name
// and budget) and the step bar shown on the board while building. Drawing
// only; taps go back through callbacks.
//
// Main pieces: showMakerHome(), domInput(), showCodeEntry(), showShareCode(),
// showMakerFinish(), makeMakerBar().
// Used by: src/scene/makerplay.js. Uses: src/rules/maker.js (decodePuzzle, suggestBudget).

// --- Puzzle maker home ---
function showMakerHome(scene, { profile, onNew, onCode, onPlayMine, onShareMine }) {
  const s = openScreen(scene, { title: "Puzzle maker", width: 680, height: 520 });
  s.layer.add(scene.add.image(s.left + 70, s.top + 110, "sparky").setScale(1.8));
  screenText(scene, s.layer, s.left + 130, s.top + 70, "Build your own puzzle, solve it to prove it works, then share its code with a friend!", { size: 15, bold: true, originX: 0, originY: 0, align: "left", wrap: 500 });
  screenText(scene, s.layer, s.left + 130, s.top + 120, "1  Build: place parts (and any starting wires)\n2  Goal: tap lights — ✓ must be bright, ✗ must stay dark\n3  Test: solve it yourself, then pick the budget", { size: 13, color: "#257179", originX: 0, originY: 0, align: "left" });
  screenButton(scene, s.layer, s.cx - 130, s.top + 222, 230, 50, "Make a new puzzle", { fill: PALN["5"], fontSize: 16 }, () => { s.close(); onNew(); }).hit.tag = "maker:new";
  screenButton(scene, s.layer, s.cx + 130, s.top + 222, 230, 50, "Play a friend's code", { fill: PALN["B"], fontSize: 16 }, () => { s.close(); onCode(); }).hit.tag = "maker:code";
  screenText(scene, s.layer, s.left + 40, s.top + 278, "My puzzles", { size: 16, bold: true, originX: 0 });
  const mine = profile.myPuzzles || [];
  if (!mine.length) screenText(scene, s.layer, s.left + 40, s.top + 308, "None yet — make one!", { size: 13, color: "#566c86", originX: 0 });
  mine.slice(0, 5).forEach((m, i) => {
    const y = s.top + 312 + i * 40;
    screenText(scene, s.layer, s.left + 40, y, m.name, { size: 14, originX: 0 });
    screenButton(scene, s.layer, s.left + s.width - 200, y, 100, 32, "Play", { fill: PALN["5"], fontSize: 13 }, () => { s.close(); onPlayMine(m); }).hit.tag = "maker:play:" + i;
    screenButton(scene, s.layer, s.left + s.width - 90, y, 100, 32, "Share", { fill: PALN["B"], fontSize: 13 }, () => { s.close(); onShareMine(m); }).hit.tag = "maker:share:" + i;
  });
  return s;
}

// A real text box over the game (for typing a code or a name). Returns the
// <input>; it's removed when the screen closes.
function domInput(scene, s, { x, y, w, placeholder = "", value = "", maxLength = 2000, id = "ece-input", readOnly = false }) {
  const canvas = scene.game.canvas, r = canvas.getBoundingClientRect();
  const sx = r.width / scene.scale.width, sy = r.height / scene.scale.height;
  const el = document.createElement("input");
  el.id = id; el.type = "text"; el.placeholder = placeholder; el.value = value; el.maxLength = maxLength; el.readOnly = readOnly;
  el.autocomplete = "off"; el.spellcheck = false;
  Object.assign(el.style, {
    position: "fixed", left: `${r.left + (x - w / 2) * sx}px`, top: `${r.top + (y - 18) * sy}px`, width: `${w * sx}px`, height: `${36 * sy}px`,
    font: `${Math.round(16 * sy)}px "Pixelify Sans", monospace`, border: "3px solid #1a1c2c", background: "#ffffff", color: "#1a1c2c",
    padding: "0 8px", boxSizing: "border-box", zIndex: 10, outline: "none",
  });
  document.body.appendChild(el);
  // keys typed into the box shouldn't drive the game
  el.addEventListener("keydown", e => e.stopPropagation());
  s.layer.once("destroy", () => el.remove());
  return el;
}

// --- Code entry ---
function showCodeEntry(scene, { onPlay, onBack }) {
  const s = openScreen(scene, { title: "Play a friend's code", width: 620, height: 300 });
  screenText(scene, s.layer, s.cx, s.top + 74, "Type or paste the puzzle code (it starts with ECE-):", { size: 15 });
  const box = domInput(scene, s, { x: s.cx, y: s.top + 126, w: 520, placeholder: "ECE-...", id: "ece-code-input" });
  const msg = screenText(scene, s.layer, s.cx, s.top + 170, "", { size: 13, color: "#b13e53", bold: true, wrap: 540 });
  screenButton(scene, s.layer, s.cx - 200, s.top + s.height - 40, 150, 44, "Paste", { fill: PALN["C"], fontSize: 15 }, async () => {
    try { box.value = await navigator.clipboard.readText(); } catch (e) { msg.setText("Your browser won't let me paste — press Ctrl+V (or ⌘V) in the box."); }
  }).hit.tag = "code:paste";
  screenButton(scene, s.layer, s.cx, s.top + s.height - 40, 150, 44, "Play!", { fill: PALN["5"], fontSize: 16 }, () => {
    const r = decodePuzzle(box.value);
    if (!r.ok) { msg.setText(r.why); Sfx.play("wrong"); return; }
    s.close(); onPlay(r.puzzle, box.value.trim());
  }).hit.tag = "code:play";
  screenButton(scene, s.layer, s.cx + 200, s.top + s.height - 40, 150, 44, "Back", { fill: PALN["C"], fontSize: 15 }, () => { s.close(); onBack(); }).hit.tag = "code:back";
  setTimeout(() => box.focus(), 50);
  return s;
}

// --- Share code ---
function showShareCode(scene, { name, code, onBack }) {
  const s = openScreen(scene, { title: `Share "${name}"`, width: 640, height: 320 });
  screenText(scene, s.layer, s.cx, s.top + 72, "Send this code to a friend. They open PHONE → Make → Play a code.", { size: 14, wrap: 580 });
  const box = domInput(scene, s, { x: s.cx, y: s.top + 124, w: 580, value: code, readOnly: true, id: "ece-share-code" });
  box.addEventListener("focus", () => box.select());
  const msg = screenText(scene, s.layer, s.cx, s.top + 170, `${code.length} letters long`, { size: 12, color: "#566c86" });
  screenButton(scene, s.layer, s.cx - 100, s.top + s.height - 40, 170, 44, "Copy code", { fill: PALN["5"], fontSize: 15 }, async () => {
    try { await navigator.clipboard.writeText(code); msg.setText("Copied! Paste it in a message to your friend."); }
    catch (e) { box.focus(); box.select(); msg.setText("Selected — press Ctrl+C (or ⌘C) to copy it."); }
  }).hit.tag = "share:copy";
  screenButton(scene, s.layer, s.cx + 100, s.top + s.height - 40, 170, 44, "Done", { fill: PALN["C"], fontSize: 15 }, () => { s.close(); if (onBack) onBack(); }).hit.tag = "share:done";
  return s;
}

// --- Finish screen ---
// After solving your own puzzle: name it, set the budget, save.
function showMakerFinish(scene, { spent, wires, defaultName, onSave, onKeepEditing }) {
  const s = openScreen(scene, { title: "You solved it!", width: 620, height: 400 });
  screenText(scene, s.layer, s.cx, s.top + 70, `Your solution used ${wires} wire${wires === 1 ? "" : "s"} and cost $${spent}.`, { size: 15, bold: true });
  screenText(scene, s.layer, s.left + 40, s.top + 112, "Name:", { size: 15, bold: true, originX: 0 });
  const box = domInput(scene, s, { x: s.cx + 30, y: s.top + 112, w: 440, value: defaultName, maxLength: 28, id: "ece-name-input" });
  let tight = false, budget = suggestBudget(spent, false);
  const bt = screenText(scene, s.layer, s.cx, s.top + 172, "", { size: 18, bold: true });
  const tt = screenText(scene, s.layer, s.cx, s.top + 236, "", { size: 13, color: "#566c86" });
  const show = () => { bt.setText(`Budget: $${budget}`); tt.setText(tight ? "Tight: players can't spend more than the budget." : "Players can go over (but lose a star)."); };
  show();
  screenButton(scene, s.layer, s.cx - 150, s.top + 172, 60, 38, "− $5", { fill: PALN["C"], fontSize: 14 }, () => { budget = Math.max(spent, budget - 5); show(); }).hit.tag = "finish:less";
  screenButton(scene, s.layer, s.cx + 150, s.top + 172, 60, 38, "+ $5", { fill: PALN["C"], fontSize: 14 }, () => { budget = Math.min(999, budget + 5); show(); }).hit.tag = "finish:more";
  const tb = screenButton(scene, s.layer, s.cx, s.top + 208, 200, 30, "Tight budget: OFF", { fill: PALN["D"], fontSize: 12 }, () => {
    tight = !tight; tb.text.setText(`Tight budget: ${tight ? "ON" : "OFF"}`); tb.hit.fillColor = tight ? PALN["4"] : PALN["D"];
    budget = suggestBudget(spent, tight); show();
  });
  tb.hit.tag = "finish:tight";
  screenButton(scene, s.layer, s.cx - 110, s.top + s.height - 40, 200, 46, "Save & share", { fill: PALN["5"], fontSize: 16 }, () => {
    const name = (box.value || defaultName).trim().slice(0, 28) || defaultName;
    s.close(); onSave({ name, budget, tight });
  }).hit.tag = "finish:save";
  screenButton(scene, s.layer, s.cx + 110, s.top + s.height - 40, 180, 46, "Keep editing", { fill: PALN["C"], fontSize: 14 }, () => { s.close(); onKeepEditing(); }).hit.tag = "finish:edit";
  return s;
}

// --- Step bar ---
// Sits on the board under the toolbar (not a pop-up, so you can keep
// building): 1 Build · 2 Goal · 3 Test · Exit.
function makeMakerBar(scene, { step, onStep, onExit }) {
  const layer = scene.add.container(0, 0).setDepth(210);
  const W = scene.scale.width;
  layer.add(scene.add.rectangle(W / 2, 166, 560, 34, UI_INK, 0.85).setStrokeStyle(2, PALN["4"]));
  const steps = [["build", "1 Build"], ["goal", "2 Goal"], ["test", "3 Test"]];
  steps.forEach(([k, label], i) => {
    const btn = screenButton(scene, layer, W / 2 - 200 + i * 130, 166, 120, 26, label, { fill: step === k ? PALN["4"] : PALN["D"], fontSize: 13 }, () => onStep(k));
    btn.hit.tag = "makerbar:" + k;
  });
  screenButton(scene, layer, W / 2 + 210, 166, 100, 26, "Exit", { fill: PALN["3"], fontSize: 13 }, onExit).hit.tag = "makerbar:exit";
  return layer;
}
