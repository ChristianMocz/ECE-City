// src/ui/hud.js
//
// The top bar and the basic pop-up pieces. Draws the title plaque, the tool
// label, the toggles, the two rows of buttons, the engineer panel, the info
// chip and the status bar. Also the choice and confirm overlays and the
// chunky pixel button that every screen uses. Buttons only emit scene events.
//
// Main pieces: Mode, pixelButton(), showChoiceOverlay(), showConfirmOverlay(),
// closeLayer(), buildUI().
// Used by: src/scene/setup.js (buildUI), src/ui/kit.js and the other screens.

const Mode = {
  WIRE: "WIRE",
  DELETE: "DELETE",
  PLACE_HOUSE: "PLACE_HOUSE",
  PLACE_RES: "PLACE_RES",
  PLACE_TRANS: "PLACE_TRANS",
  PLACE_LED: "PLACE_LED",
  PLACE_CAP: "PLACE_CAP",
  PLACE_XFR: "PLACE_XFR",
  PLACE_SOLAR: "PLACE_SOLAR",
  PLACE_BAT: "PLACE_BAT",
  PLACE_BUILDING: "PLACE_BUILDING",
  PLACE_DECOR: "PLACE_DECOR",
  PLACE_TOOL: "PLACE_TOOL", // a part from a campaign level's toolbox
};

const UI_INK = PALN["0"];

// Pixelify Sans joins "fi", "fl" and "ff" into glyphs that look like an "A".
// While drawing, an invisible zero-width non-joiner after each such "f" keeps
// the letters apart. The text you set (and read back) is unchanged.
(function noLigatures() {
  const T = typeof Phaser !== "undefined" && Phaser.GameObjects && Phaser.GameObjects.Text && Phaser.GameObjects.Text.prototype;
  if (!T || T.__noLigatures || typeof T.updateText !== "function") return;
  const orig = T.updateText;
  T.updateText = function () {
    const raw = this._text;
    if (typeof raw !== "string" || !/f[fil]/.test(raw)) return orig.apply(this, arguments);
    this._text = raw.replace(/f(?=[fil])/g, "f\u200C");
    try { return orig.apply(this, arguments); } finally { this._text = raw; }
  };
  T.__noLigatures = true;
})();

// A chunky retro button with a drop shadow that presses down when tapped.
// Returns the tappable rectangle (`hit`) plus every piece, so overlays can
// put them in their own layer.
function pixelButton(scene, cx, cy, w, h, label, { fill = PALN["C"], textColor = "#1a1c2c", fontSize = 13, bold = true } = {}) {
  const shadow = scene.add.rectangle(cx + 3, cy + 3, w, h, UI_INK);
  const hit = scene.add.rectangle(cx, cy, w, h, fill).setStrokeStyle(3, UI_INK).setInteractive({ useHandCursor: true });
  const shine = scene.add.rectangle(cx, cy - h / 2 + 4, w - 6, 3, 0xffffff, 0.45);
  const shade = scene.add.rectangle(cx, cy + h / 2 - 4, w - 6, 3, UI_INK, 0.25);
  const text = scene.add.text(cx, cy, label, {
    fontFamily: GAME_FONT, fontSize: `${fontSize}px`, color: textColor, align: "center",
    fontStyle: bold ? "bold" : "normal", wordWrap: { width: w - 10 },
  }).setOrigin(0.5);
  const moving = [hit, shine, shade, text];
  hit.on("pointerdown", () => {
    for (const o of moving) { o.x += 2; o.y += 2; }
    scene.time.delayedCall(110, () => { for (const o of moving) { if (o.active) { o.x -= 2; o.y -= 2; } } });
  });
  return { hit, text, parts: [shadow, hit, shine, shade, text] };
}

// --- Overlays ---
// Drawn on the canvas instead of window.prompt()/confirm(), which some embeds block.

// The panel behind an overlay's buttons. It is tappable only to swallow taps
// on its empty space, so they don't reach the dimmer (which closes the
// overlay) or the board underneath.
function blockingPanel(scene, cx, cy, w, h) {
  const panel = scene.add.rectangle(cx, cy, w, h, PALN["C"]).setStrokeStyle(4, UI_INK).setInteractive();
  panel.on("pointerdown", (p, lx, ly, event) => event.stopPropagation());
  return panel;
}
function panelShadow(scene, cx, cy, w, h) {
  return scene.add.rectangle(cx + 6, cy + 6, w, h, UI_INK, 0.6);
}

// Close a pop-up and remember which tap did it. src/scene/events.js ignores
// that same tap on the board, so it can't also act on the board underneath.
function closeLayer(scene, layer) {
  noteOverlayTap(scene);
  layer.destroy();
}
function noteOverlayTap(scene) {
  scene.__overlayTapAt = scene.input?.activePointer?.downTime;
}

// A list of big choice buttons. Every overlay tap handler stops propagation,
// or the tap that closes it would also place or delete a part on the board.
function showChoiceOverlay(scene, { title, choices, onPick, onCancel }) {
  const W = scene.scale.width, H = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(500);

  const dim = scene.add.rectangle(W / 2, H / 2, W, H, UI_INK, 0.55)
    .setInteractive(); // blocks clicks from reaching the game underneath
  layer.add(dim);

  const panelW = Math.min(520, W - 60);
  const btnH = 56;
  const gap = 12;
  const panelH = 70 + choices.length * (btnH + gap) + 20;
  const cx = W / 2, cy = H / 2;

  layer.add(panelShadow(scene, cx, cy, panelW, panelH));
  layer.add(blockingPanel(scene, cx, cy, panelW, panelH));
  layer.add(scene.add.rectangle(cx, cy - panelH / 2 + 30, panelW - 8, 44, PALN["8"]));
  const titleText = scene.add.text(cx, cy - panelH / 2 + 30, title, {
    fontFamily: GAME_FONT, fontSize: "22px", color: "#ffcd75", fontStyle: "bold",
  }).setOrigin(0.5);
  layer.add(titleText);

  const close = () => { closeLayer(scene, layer); if (onCancel) onCancel(); };
  dim.on("pointerdown", (p, lx, ly, event) => { event.stopPropagation(); close(); });

  choices.forEach((choice, i) => {
    const by = cy - panelH / 2 + 66 + i * (btnH + gap) + btnH / 2;
    const btn = pixelButton(scene, cx, by, panelW - 40, btnH, "", { fill: i % 2 ? PALN["B"] : 0xd8f7ff });
    btn.hit.tag = "choice:" + i;
    layer.add(btn.parts);
    const label = scene.add.text(cx, by - (choice.sub ? 9 : 0), choice.label, {
      fontFamily: GAME_FONT, fontSize: "18px", color: "#1a1c2c", fontStyle: "bold",
    }).setOrigin(0.5);
    layer.add(label);
    if (choice.sub) {
      const sub = scene.add.text(cx, by + 13, choice.sub, {
        fontFamily: GAME_FONT, fontSize: "13px", color: "#333c57",
      }).setOrigin(0.5);
      layer.add(sub);
    }
    btn.hit.on("pointerdown", (pointer, lx, ly, event) => {
      event.stopPropagation();
      Sfx.play("tap");
      closeLayer(scene, layer);
      onPick(choice);
    });
  });

  return layer;
}

// A yes / no question.
function showConfirmOverlay(scene, { title, message, confirmLabel = "Yes", cancelLabel = "No, keep it", onConfirm, danger = true }) {
  const W = scene.scale.width, H = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(500);

  const dim = scene.add.rectangle(W / 2, H / 2, W, H, UI_INK, 0.55).setInteractive();
  layer.add(dim);

  const panelW = Math.min(420, W - 60);
  const panelH = 190;
  const cx = W / 2, cy = H / 2;

  layer.add(panelShadow(scene, cx, cy, panelW, panelH));
  const panel = blockingPanel(scene, cx, cy, panelW, panelH);
  const titleText = scene.add.text(cx, cy - 60, title, {
    fontFamily: GAME_FONT, fontSize: "21px", color: "#1a1c2c", fontStyle: "bold",
  }).setOrigin(0.5);
  const msgText = scene.add.text(cx, cy - 34, message, {
    fontFamily: GAME_FONT, fontSize: "14px", color: "#333c57", align: "center", wordWrap: { width: panelW - 40 },
  }).setOrigin(0.5, 0);
  layer.add([panel, titleText, msgText]);

  const close = () => closeLayer(scene, layer);
  dim.on("pointerdown", (p, lx, ly, event) => { event.stopPropagation(); close(); });

  const yes = pixelButton(scene, cx - 90, cy + 60, 150, 46, confirmLabel, { fill: danger ? PALN["3"] : PALN["B"], fontSize: 15 });
  const no = pixelButton(scene, cx + 90, cy + 60, 150, 46, cancelLabel, { fill: PALN["D"], fontSize: 14 });
  yes.hit.tag = "confirm:yes"; no.hit.tag = "confirm:no";
  layer.add([...yes.parts, ...no.parts]);

  yes.hit.on("pointerdown", (p, lx, ly, event) => { event.stopPropagation(); closeLayer(scene, layer); onConfirm(); });
  no.hit.on("pointerdown", (p, lx, ly, event) => { event.stopPropagation(); closeLayer(scene, layer); });

  return layer;
}

// --- The HUD ---
// Title plaque on the left, two rows of buttons, the engineer panel top
// right, and the status bar at the bottom. Buttons only emit scene events;
// the scene modules decide what they do.
function buildUI(scene, state, profile) {
  const W = scene.scale.width, H = scene.scale.height;

  // --- Title plaque (x 8..304) ---
  const PL_W = 296, PL_H = 122;
  scene.add.rectangle(8 + PL_W / 2 + 4, 6 + PL_H / 2 + 4, PL_W, PL_H, UI_INK, 0.6).setDepth(198);
  scene.add.rectangle(8 + PL_W / 2, 6 + PL_H / 2, PL_W, PL_H, PALN["8"]).setStrokeStyle(3, UI_INK).setDepth(199);

  let TITLE = "ECE City";
  const titleText = scene.add.text(20, 10, TITLE, {
    fontFamily: GAME_FONT, fontSize: "24px", color: "#ffcd75", fontStyle: "bold",
  }).setDepth(200);
  const levelTag = scene.add.text(PL_W - 4, 16, "", {
    fontFamily: GAME_FONT, fontSize: "14px", color: "#a7f070", fontStyle: "bold",
  }).setOrigin(1, 0).setDepth(200);

  // The title spot doubles as the mission banner: while a mission or the
  // daily puzzle is on, it shows the goal (up to two lines).
  let bannerOn = false;
  // The title is the region you're in ("Battery Bay"), shrunk to fit.
  function fitTitle() {
    titleText.setText(TITLE).setFontStyle("bold").setWordWrapWidth(null).setY(10).setColor("#ffcd75");
    for (const size of [24, 21, 18, 16]) { titleText.setFontSize(size); if (titleText.width <= 200) break; }
    titleText.setY(10 + (24 - parseInt(titleText.style.fontSize, 10)) / 2);
  }
  function setTitle(t) { TITLE = t; if (!bannerOn) fitTitle(); }
  function setBanner(text) {
    bannerOn = !!text;
    if (!text) {
      fitTitle();
      levelTag.setVisible(true);
    } else {
      titleText.setText(text).setFontStyle("bold").setWordWrapWidth(PL_W - 22).setY(6).setColor("#a7f070");
      // Two lines at most so it never hits the Tool line: shrink a long goal.
      for (const size of [13, 12, 11, 10]) { titleText.setFontSize(size); if (titleText.height <= 36) break; }
      levelTag.setVisible(false);
    }
  }

  const toolText = scene.add.text(20, 44, "Tool: WIRE", {
    fontFamily: GAME_FONT, fontSize: "15px", color: "#f4f4f4",
  }).setDepth(200);

  function setToolLabel() {
    const mode = state.mode;
    let t;
    if (mode === Mode.PLACE_RES) t = `RESISTOR (${state.placeResOhms.toFixed(0)}Ω)`;
    else if (mode === Mode.PLACE_CAP) t = `CAPACITOR (${state.placeCapUF.toFixed(0)}µF)`;
    else if (mode === Mode.PLACE_XFR) t = `TRANSFORMER (×${state.placeXfmrRatio.toFixed(2)})`;
    else if (mode === Mode.PLACE_LED) t = "LED";
    else if (mode === Mode.PLACE_HOUSE) t = "HOUSE";
    else if (mode === Mode.PLACE_TRANS) t = "SWITCH";
    else if (mode === Mode.PLACE_SOLAR) t = "SOLAR PANEL";
    else if (mode === Mode.PLACE_BAT) t = "BATTERY";
    else if (mode === Mode.PLACE_BUILDING) t = (BUILDINGS[state.placeBuilding]?.name || "BUILDING").toUpperCase();
    else if (mode === Mode.PLACE_DECOR) t = (DECOR[state.placeDecor]?.name || "DECORATION").toUpperCase();
    else if (mode === Mode.DELETE) t = "DELETE (tap a part or wire)";
    else if (mode === Mode.PLACE_TOOL) t = (state.placeToolName || "PART").toUpperCase();
    else t = "WIRE (tap two dots)";
    toolText.setText("Tool: " + t);
  }

  // --- Toggles under the tool label ---
  function toggleLine(i, label, get, set) {
    const t = scene.add.text(20, 68 + i * 19, "", {
      fontFamily: GAME_FONT, fontSize: "14px", color: "#73eff7",
    }).setDepth(200);
    const refresh = () => t.setText(`${get() ? "☑" : "☐"} ${label}`);
    refresh();
    t.setInteractive({ useHandCursor: true });
    t.on("pointerdown", () => { Sfx.play("tap"); set(!get()); refresh(); scene.events.emit("toggles-changed"); });
    t.refresh = refresh;
    return t;
  }
  const toggles = [
    toggleLine(0, "Show Numbers (V / I)", () => state.showVoltage, v => { state.showVoltage = v; state.showCurrent = v; }),
    toggleLine(1, "Show Wire Details", () => state.showResistance, v => { state.showResistance = v; state.advancedWireCurrent = v; }),
    toggleLine(2, "Sparky's guessing game", () => profile.settings.sparky, v => { profile.settings.sparky = v; scene.events.emit("settings-changed"); }),
  ];
  function refreshToggles() { for (const t of toggles) t.refresh(); }

  // --- Buttons (x 312..786) ---
  // Everyday tools in two rows; everything else lives in the PHONE. Buttons
  // appear as they unlock (src/rules/progress.js), tagged "New!" until tapped.
  const buttons = {};
  function makeBtn(name, cx, cy, w, h, text, onClick, fill = PALN["C"], icon = null) {
    const btn = pixelButton(scene, cx, cy, w, h, text, { fill, fontSize: 14 });
    btn.parts.forEach((o, i) => o.setDepth(200 + (i === 0 ? 0 : 1)));
    if (icon) {
      // icon on the left, label nudged right; the icon presses down with the button
      btn.text.setX(cx + 12);
      btn.icon = scene.add.image(cx - w / 2 + 20, cy, icon).setDepth(202);
      btn.parts.push(btn.icon);
      btn.hit.on("pointerdown", () => { btn.icon.x += 2; btn.icon.y += 2; scene.time.delayedCall(110, () => { if (btn.icon.active) { btn.icon.x -= 2; btn.icon.y -= 2; } }); });
    }
    btn.hit.on("pointerdown", () => { Sfx.play("tap"); scene.events.emit("button-tapped", name); onClick(); });
    btn.hit.tag = "btn:" + name;
    // "New!" tag and a little badge (a "!" or a number).
    btn.newTag = scene.add.image(cx + w / 2 - 14, cy - h / 2 - 2, "ico_new").setDepth(205).setVisible(false);
    btn.badgeDot = scene.add.rectangle(cx + w / 2 - 6, cy - h / 2 + 4, 18, 16, PALN["2"]).setStrokeStyle(2, UI_INK).setDepth(204).setVisible(false);
    btn.badgeText = scene.add.text(cx + w / 2 - 6, cy - h / 2 + 4, "!", { fontFamily: GAME_FONT, fontSize: "11px", color: "#f4f4f4", fontStyle: "bold" }).setOrigin(0.5).setDepth(205).setVisible(false);
    btn.shown = true;
    buttons[name] = btn;
    return btn;
  }
  const ROW1 = 34, ROW2 = 92, BH = 46;
  const tool = (mode) => () => { scene.events.emit("tool-switch", mode); setToolLabel(); };
  const emit = (ev) => () => scene.events.emit(ev);
  // Row 1: building tools.
  makeBtn("wire", 360, ROW1, 88, BH, "WIRE", tool(Mode.WIRE));
  makeBtn("build", 456, ROW1, 88, BH, "+ BUILD", emit("build-requested"), PALN["4"]);
  makeBtn("delete", 552, ROW1, 88, BH, "DELETE", tool(Mode.DELETE), PALN["3"]);
  makeBtn("undo", 648, ROW1, 88, BH, "UNDO", emit("undo-requested"));
  makeBtn("redo", 742, ROW1, 84, BH, "REDO", emit("redo-requested"));
  // Row 2: where to go next.
  makeBtn("levels", 371, ROW2, 110, BH, "LEVELS ★", emit("levels-requested"), PALN["5"]);
  makeBtn("today", 489, ROW2, 110, BH, "TODAY", emit("today-requested"), PALN["B"], "ico_today");
  makeBtn("phone", 627, ROW2, 150, BH, "PHONE", emit("phone-requested"), PALN["A"], "ico_phone");
  makeBtn("hint", 746, ROW2, 76, BH, "? HINT", emit("hint-requested"), PALN["C"]);

  // Show / hide buttons as they unlock. vis: { name: bool }, news: Set of names.
  function setToolbar(vis, news = new Set()) {
    for (const [name, b] of Object.entries(buttons)) {
      const show = vis[name] !== false;
      for (const o of b.parts) o.setVisible(show);
      b.hit.input.enabled = show;
      if (show && !b.shown) {
        // newly unlocked: pop in
        for (const o of b.parts) { const sx = o.scaleX, sy = o.scaleY; o.setScale(0.1); scene.tweens.add({ targets: o, scaleX: sx, scaleY: sy, duration: 420, ease: "Back.Out" }); }
      }
      b.shown = show;
      b.newTag.setVisible(show && news.has(name));
      if (!show) { b.badgeDot.setVisible(false); b.badgeText.setVisible(false); }
    }
  }
  // A badge on a button: true = "!", a number = that number, falsy = none.
  function setBadge(name, v) {
    const btn = buttons[name];
    if (!btn) return;
    const on = !!v && btn.shown && !btn.newTag.visible;
    btn.badgeDot.setVisible(on); btn.badgeText.setVisible(on);
    if (on) btn.badgeText.setText(v === true ? "!" : String(v));
  }

  // --- Engineer panel (x 794..892) ---
  // Coins, level and XP bar, streak, the engineer and sidekick. Tap it to open CLOTHES.
  const CP_X = 794, CP_W = 98, CP_CX = CP_X + CP_W / 2;
  scene.add.rectangle(CP_CX + 4, 6 + PL_H / 2 + 4, CP_W, PL_H, UI_INK, 0.6).setDepth(198);
  const panel = scene.add.rectangle(CP_CX, 6 + PL_H / 2, CP_W, PL_H, PALN["8"]).setStrokeStyle(3, UI_INK).setDepth(199)
    .setInteractive({ useHandCursor: true });
  panel.tag = "btn:engineer";
  panel.on("pointerdown", () => { Sfx.play("tap"); scene.events.emit("wardrobe-requested"); });
  scene.add.image(CP_X + 14, 20, "coin").setDepth(200);
  const coinText = scene.add.text(CP_X + 24, 20, "0", { fontFamily: GAME_FONT, fontSize: "15px", color: "#ffcd75", fontStyle: "bold" }).setOrigin(0, 0.5).setDepth(200);
  const lvlText = scene.add.text(CP_X + 8, 38, "Lv 1", { fontFamily: GAME_FONT, fontSize: "12px", color: "#f4f4f4", fontStyle: "bold" }).setOrigin(0, 0.5).setDepth(200);
  const XB_X = CP_X + 40, XB_W = 50;
  scene.add.rectangle(XB_X, 38, XB_W, 8, UI_INK).setOrigin(0, 0.5).setDepth(200);
  const xpFill = scene.add.rectangle(XB_X + 1, 38, 0, 6, PALN["5"]).setOrigin(0, 0.5).setDepth(201);
  const engineer = makeEngineer(scene, CP_X + 28, 124);
  engineer.container.setDepth(201).setScale(0.8);
  // The sidekick sits at the engineer's feet.
  const sidekick = makeSidekick(scene, CP_X + 72, 125);
  sidekick.container.setDepth(201).setScale(0.8);
  const streakIcon = scene.add.image(CP_X + 64, 60, "star").setDepth(200);
  const streakText = scene.add.text(CP_X + 75, 60, "0", { fontFamily: GAME_FONT, fontSize: "13px", color: "#f4f4f4", fontStyle: "bold" }).setOrigin(0, 0.5).setDepth(200);
  const multText = scene.add.text(CP_X + 72, 78, "", { fontFamily: GAME_FONT, fontSize: "13px", color: "#a7f070", fontStyle: "bold" }).setOrigin(0.5).setDepth(200);

  function refreshHud(flags = {}) {
    const lvl = levelForXp(profile.xp);
    coinText.setText(String(profile.coins));
    lvlText.setText(`Lv ${lvl}`);
    levelTag.setText(`Level ${lvl}`);
    xpFill.width = Math.round((XB_W - 2) * levelProgress(profile.xp));
    streakText.setText(String(profile.streak));
    const bonus = streakMultiplier(profile.streak);
    multText.setText(bonus > 1 ? `×${bonus}` : "");
    streakIcon.setAlpha(profile.streak > 0 ? 1 : 0.35);
    dressEngineer(engineer, profile.wearing);
    dressSidekick(sidekick, profile.sidekick);
    for (const k of ["levels", "today", "phone"]) if (k in flags) setBadge(k, flags[k]);
  }

  // --- Info chip ---
  // Top of the board: town population, a level's budget, or an emergency countdown.
  const chipBg = scene.add.rectangle(W / 2, 164, 200, 24, UI_INK, 0.82).setStrokeStyle(2, PALN["F"]).setDepth(205).setVisible(false);
  const chipIcon = scene.add.image(W / 2 - 90, 164, "people").setDepth(206).setVisible(false);
  const chipText = scene.add.text(W / 2, 164, "", { fontFamily: GAME_FONT, fontSize: "14px", color: "#f4f4f4", fontStyle: "bold" }).setOrigin(0.5).setDepth(206).setVisible(false);
  function setChip(text, { icon = "people", color = "#f4f4f4" } = {}) {
    const on = !!text;
    chipBg.setVisible(on); chipText.setVisible(on); chipIcon.setVisible(on && !!icon);
    if (!on) return;
    if (chipText.text !== text) chipText.setText(text);
    chipText.setColor(color);
    const w = chipText.width + (icon ? 44 : 24);
    chipBg.width = w;
    chipBg.setPosition(W / 2, 164);
    chipText.setX(W / 2 + (icon ? 11 : 0));
    if (icon) chipIcon.setTexture(icon).setX(W / 2 - w / 2 + 16);
  }

  // --- Status bar ---
  // Along the bottom, with the clock and weather on its right.
  scene.add.rectangle(W / 2, H - 22, W, 44, UI_INK, 0.92).setDepth(199);
  scene.add.rectangle(W / 2, H - 44, W, 3, PALN["4"]).setDepth(199);
  const CLOCK_W = 150;
  const status = scene.add.text(16, H - 21, "WIRE: tap two dots to connect them. Tap empty ground to cancel.", {
    color: "#f4f4f4", fontSize: "15px", fontFamily: GAME_FONT, wordWrap: { width: W - 32 - CLOCK_W },
  }).setOrigin(0, 0.5).setDepth(200);
  scene.add.rectangle(W - CLOCK_W - 6, H - 22, 2, 34, PALN["F"]).setDepth(200);
  const wxIcon = scene.add.image(W - CLOCK_W + 14, H - 22, "wx_normal").setDepth(200);
  const clockText = scene.add.text(W - CLOCK_W + 34, H - 22, "", {
    color: "#f4f4f4", fontSize: "13px", fontFamily: GAME_FONT, lineSpacing: 0,
  }).setOrigin(0, 0.5).setDepth(200);
  function setClock(weatherKey, line1, line2) {
    if (scene.textures.exists("wx_" + weatherKey)) wxIcon.setTexture("wx_" + weatherKey);
    clockText.setText(line2 ? `${line1}\n${line2}` : line1);
  }

  setToolLabel();
  refreshHud();
  return { status, setToolLabel, setBanner, setTitle, refreshHud, setClock, setChip, refreshToggles, setToolbar, setBadge, engineer, sidekick, buttons };
}
