// src/ui/popups.js
//
// Smaller pop-ups: the sticker book, the how-to-play box, the orders board,
// the Today (daily) screen, the gift chest, Sparky's guess-before-you-change
// question, floating "+coins" toasts and the emergency alert. Drawing only;
// taps go back through callbacks.
//
// Main pieces: showStickers(), showIntro(), showOrders(), showDaily(),
// showGift(), showPrediction(), showToast(), showEmergencyAlert().
// Used by: src/scene/menus.js, src/scene/sparky.js, src/scene/town.js and other scene modules.

// --- Sticker book ---
function showStickers(scene, { profile }) {
  const ids = Object.keys(STICKERS);
  const got = ids.filter(id => profile.stickers[id]).length;
  const cols = 6, rows = Math.ceil(ids.length / cols);
  const s = openScreen(scene, { title: `Sticker book  ${got}/${ids.length}`, width: 740, height: Math.min(580, 70 + rows * 104) });
  const items = ids.map(id => {
    const sticker = STICKERS[id], has = !!profile.stickers[id];
    return {
      tag: "sticker:" + id, name: sticker.name, sub: has ? "collected!" : sticker.how, selected: false, locked: !has,
      icon: (layer, x, y) => {
        layer.add(scene.add.image(x, y, "badge").setTint(has ? PALN[sticker.color] : 0x6b7280));
        const img = scene.add.image(x, y, sticker.icon);
        img.setScale(Math.min(34 / img.width, 34 / img.height));
        if (!has) img.setTint(0x3b4252).setAlpha(0.6);
        layer.add(img);
      },
      onTap: () => {},
    };
  });
  if (70 + rows * 104 <= 580) tileGrid(scene, s, items, { cols, tileW: 108, tileH: 98, top: s.top + 58, gap: 6 });
  else scrollGrid(scene, s, items, { cols, tileW: 104, tileH: 98, top: s.top + 58, height: s.height - 70, gap: 6, cx: s.cx - 18, memKey: "stickers" });
  return s;
}

// --- How to play ---
// Shown the first time the game opens, and from PHONE > Settings. Explains
// every button and phone app; scrolls when it's too long.
const GUIDE_BUTTONS = [
  ["WIRE", "Tap a dot, then another dot, to join them with a wire. Orange dots are the + side, blue dots go back to ground."],
  ["+ BUILD", "Pick a house, part, building or decoration, then tap the grass to place it."],
  ["DELETE", "Tap a wire or a part to remove it. Parts go back in your BUILD box."],
  ["UNDO", "Takes back your last change."],
  ["REDO", "Puts back what you just undid."],
  ["LEVELS ★", "Puzzles with up to 3 stars. Each world teaches a new idea. A great place to start!"],
  ["TODAY", "Your to-do list: the next level, the Captain, emergencies, town orders and daily gifts."],
  ["PHONE", "Your engineer's phone. All the extra stuff lives in here (see below)."],
  ["? HINT", "Stuck? Sparky gives you a tip for what you're doing right now."],
];
const GUIDE_EXTRAS = [
  ["Your engineer", "Top right: your coins, level and XP. Tap your engineer to change clothes."],
  ["Toggles", "Top left: show volts and amps, show wire details, and turn Sparky's guessing game on or off."],
  ["Tap a part", "Tap a dark house or LED and Sparky tells you why it's dark. Drag a part to move it."],
];
const GUIDE_APPS = [
  ["Town", [["coin", "Shop", "Buy buildings, decorations and power plants."], ["chest", "Daily", "A free gift and a new puzzle every day."], ["moon", "Skip time", "Jump to night or to morning."], ["ico_tools", "Clear board", "Remove all your wires and start fresh."], ["led_on", "Count lights", "Counts how many lights are on."]]],
  ["World", [["map_pin", "World map", "Travel to 12 worlds and fight Captain Short Circuit."], ["pylon", "Power lines", "Send power between towns."]]],
  ["Me", [["person", "Clothes", "Dress up your engineer and your pet."], ["ico_book", "Notebook", "Cards for everything you've learned."], ["ico_trophy", "Records", "Your progress, best times and challenges."], ["badge", "Stickers", "Your sticker book."]]],
  ["Make", [["ico_tools", "Puzzle maker", "Build your own puzzle and share its code."], ["ico_phone", "Play a code", "Type in a friend's puzzle code."]]],
  ["Settings", [["ico_gear", "Settings", "Music, sound, Sparky and emergencies."], ["sparky", "How to play", "Opens this guide again."], ["house", "Save & title", "Your 3 save files and the title screen."]]],
];
function showIntro(scene, { onClose }) {
  const s = openScreen(scene, { title: "Welcome to ECE City!", width: 720, height: 580, onClose });
  const left = s.left + 30, width = s.width - 90, top = s.top + 60, height = s.height - 130;
  scrollPane(scene, s, { left, top, width, height, fill: (pane) => {
    let y = top;
    const text = (x, str, opts) => screenText(scene, pane, x, y, str, { originX: 0, originY: 0, align: "left", ...opts });
    const heading = (str) => { y += 8; const t = text(left, str, { size: 17, bold: true, color: "#b13e53" }); y += t.height + 8; };
    const para = (str) => { const t = text(left, str, { size: 13, wrap: width }); y += t.height + 8; };
    // A row: a chip (button name) or icon on the left, its explanation on the right.
    const row = (chip, icon, title, desc) => {
      const y0 = y;
      if (icon) fitImage(scene, pane, left + 22, y0 + 14, icon, 34, 30);
      else {
        pane.add(scene.add.rectangle(left + 52, y0 + 13, 100, 26, PALN["B"]).setStrokeStyle(2, UI_INK));
        screenText(scene, pane, left + 52, y0 + 13, chip, { size: 13, bold: true });
      }
      const tx = icon ? left + 50 : left + 116;
      const t = text(tx, title ? `${title}: ${desc}` : desc, { size: 13, wrap: width - (tx - left) });
      y = Math.max(y0 + 30, y0 + t.height + 2) + 8;
    };
    pane.add(scene.add.image(left + 40, y + 40, "sparky").setScale(1.6));
    const hi = screenText(scene, pane, left + 96, y + 6, "Hi, I'm Sparky! You're the new town engineer. Your town starts empty, so it's up to you to build it and keep every light on.", { size: 15, bold: true, originX: 0, originY: 0, align: "left", wrap: width - 100 });
    y += Math.max(86, hi.height + 16);
    heading("Your first house");
    para("1. Tap + BUILD, pick House, and tap the grass to place it.\n2. Tap WIRE. Tap GEN's orange dot, then the house's orange dot.\n3. Then wire the house's blue dot to GND. Power needs a full loop: out of GEN and back to ground!");
    heading("The buttons");
    for (const [name, desc] of GUIDE_BUTTONS) row(name, null, null, desc);
    for (const [name, desc] of GUIDE_EXTRAS) row(name, null, null, desc);
    heading("Inside your PHONE");
    para("The phone has 5 tabs. Some apps show up as you level up.");
    for (const [tab, apps] of GUIDE_APPS) {
      const t = text(left, tab, { size: 14, bold: true, color: "#29366f" }); y += t.height + 6;
      for (const [icon, name, desc] of apps) row(null, icon, name, desc);
    }
    heading("Coins and XP");
    para("Stars, orders, Sparky's guesses, the daily puzzle and boss fights all pay coins and XP. Each new level unlocks parts, buildings, power plants, clothes and worlds (12 in all!).");
    return y - top;
  } });
  const go = screenButton(scene, s.layer, s.cx, s.top + s.height - 36, 200, 44, "Let's go!", { fill: PALN["4"], fontSize: 17 }, () => s.close());
  go.hit.tag = "intro:go";
  screenText(scene, s.layer, s.left + s.width - 20, s.top + s.height - 36, "(PHONE → Settings → How to play)", { size: 11, color: "#566c86", originX: 1 });
  return s;
}

// --- Orders board ---
function orderIcon(order, state) {
  if (order.kind === "leds") return "led_on";
  if (order.kind === "solar") return "solar";
  if (order.kind === "nightBattery" || order.kind === "storage") return order.kind === "storage" ? "cap" : "battery";
  const n = order.target && state.nodes.get(order.target);
  return n ? buildingTexture(n.data?.building) : "house";
}
function showOrders(scene, { profile, state, now, onSkip }) {
  const rows = [];
  if (profile.repair) rows.push({ repair: true });
  for (let i = 0; i < 3; i++) rows.push({ i, order: profile.orders[i] });
  const s = openScreen(scene, { title: "Power orders", width: 660, height: 88 + rows.length * 96 });
  const bonus = streakMultiplier(profile.streak);
  screenText(scene, s.layer, s.cx, s.top + 64, bonus > 1 ? `Sparky streak ×${bonus}: orders pay ${bonus}× coins!` : "Finish an order and you'll be paid automatically.", { size: 13, color: "#333c57" });
  rows.forEach((r, k) => {
    const y = s.top + 84 + k * 96 + 44;
    s.layer.add(scene.add.rectangle(s.cx, y, s.width - 30, 86, r.repair ? 0xffe1d6 : 0xe8f6ff).setStrokeStyle(3, UI_INK));
    if (r.repair) {
      s.layer.add(scene.add.image(s.left + 56, y, "wx_storm").setScale(2));
      screenText(scene, s.layer, s.left + 96, y - 12, `Storm damage! Reconnect the wire between ${profile.repair.a} and ${profile.repair.b}.`, { size: 14, bold: true, originX: 0, align: "left", wrap: 420 });
      coinLine(scene, s.layer, s.left + 112, y + 22, profile.repair.coins);
      screenText(scene, s.layer, s.left + 160, y + 22, `+${profile.repair.xp} XP`, { size: 12, originX: 0, color: "#257179" });
      return;
    }
    const o = r.order;
    if (!o) {
      const secs = Math.max(0, Math.ceil(((profile.refillAt[r.i] || 0) - now) / 1000));
      screenText(scene, s.layer, s.cx, y, secs > 0 ? `A new order arrives in ${secs}s…` : "A new order is on its way…", { size: 14, color: "#566c86" });
      return;
    }
    fitImage(scene, s.layer, s.left + 56, y, orderIcon(o, state), 60, 60);
    screenText(scene, s.layer, s.left + 96, y - 12, o.text, { size: 14, bold: true, originX: 0, align: "left", wrap: 400 });
    coinLine(scene, s.layer, s.left + 112, y + 24, o.coins * bonus);
    screenText(scene, s.layer, s.left + 160, y + 24, `+${o.xp} XP`, { size: 12, originX: 0, color: "#257179" });
    if (o.kind === "hold") screenText(scene, s.layer, s.left + 230, y + 24, `${Math.floor(o.progress || 0)}/${o.seconds}s lit`, { size: 12, originX: 0, color: "#b13e53" });
    const btn = screenButton(scene, s.layer, s.left + s.width - 70, y, 80, 34, "Skip", { fill: PALN["D"], fontSize: 13 }, () => { onSkip(r.i); s.close(); showOrders(scene, { profile, state, now: Date.now(), onSkip }); });
    btn.hit.tag = "skip:" + r.i;
  });
  return s;
}

// --- Daily ---
// Weather, the gift chest, today's puzzle and your streaks.
function showDaily(scene, { profile, now, weather, puzzle, puzzleDone, giftWaiting, inDaily, onGift, onPlay, onBack }) {
  const s = openScreen(scene, { title: "Today", width: 620, height: 400 });
  s.layer.add(scene.add.image(s.left + 60, s.top + 100, "wx_" + weather.key).setScale(2.5));
  screenText(scene, s.layer, s.left + 100, s.top + 88, `Weather: ${weather.name}`, { size: 17, bold: true, originX: 0 });
  screenText(scene, s.layer, s.left + 100, s.top + 112, weather.note, { size: 13, color: "#333c57", originX: 0, align: "left", wrap: 470 });
  s.layer.add(scene.add.image(s.left + 60, s.top + 190, giftWaiting ? "chest" : "chest_open").setScale(1.2));
  screenText(scene, s.layer, s.left + 100, s.top + 178, giftWaiting ? "Your daily gift is waiting!" : "Gift opened — come back tomorrow!", { size: 15, bold: true, originX: 0 });
  screenText(scene, s.layer, s.left + 100, s.top + 200, `Login streak: ${profile.daily.loginStreak} day${profile.daily.loginStreak === 1 ? "" : "s"} (longer streaks = bigger gifts)`, { size: 12, color: "#333c57", originX: 0 });
  if (giftWaiting) screenButton(scene, s.layer, s.left + s.width - 90, s.top + 190, 120, 40, "Open!", { fill: PALN["4"], fontSize: 15 }, () => { s.close(); onGift(); }).hit.tag = "daily:gift";
  s.layer.add(scene.add.image(s.left + 60, s.top + 290, "sparky").setScale(1.4));
  screenText(scene, s.layer, s.left + 100, s.top + 262, `Daily puzzle: ${puzzle.title}`, { size: 16, bold: true, originX: 0 });
  screenText(scene, s.layer, s.left + 100, s.top + 286, puzzle.goal, { size: 13, color: "#333c57", originX: 0, align: "left", wrap: 330 });
  screenText(scene, s.layer, s.left + 100, s.top + 322, `Puzzle streak: ${profile.daily.puzzleStreak} day${profile.daily.puzzleStreak === 1 ? "" : "s"}${puzzleDone ? " — solved today ✓" : ""}`, { size: 12, color: "#257179", originX: 0 });
  if (!inDaily) screenButton(scene, s.layer, s.left + s.width - 90, s.top + 290, 120, 40, puzzleDone ? "Play again" : "Play!", { fill: PALN["5"], fontSize: 15 }, () => { s.close(); onPlay(); }).hit.tag = "daily:play";
  if (inDaily) screenButton(scene, s.layer, s.cx, s.top + s.height - 36, 220, 40, "Back to my town", { fill: PALN["B"], fontSize: 15 }, () => { s.close(); onBack(); }).hit.tag = "daily:back";
  return s;
}

// The gift chest: tap to open, see what's inside.
function showGift(scene, { onOpen }) {
  const s = openScreen(scene, { title: "Daily gift!", width: 380, height: 300 });
  const chest = scene.add.image(s.cx, s.cy, "chest").setScale(2.5);
  s.layer.add(chest);
  const msg = screenText(scene, s.layer, s.cx, s.cy + 70, "Tap the chest to open it!", { size: 15, bold: true });
  let opened = false;
  const btn = screenButton(scene, s.layer, s.cx, s.top + s.height - 34, 150, 40, "Open", { fill: PALN["4"], fontSize: 15 }, () => {
    if (opened) { s.close(); return; }
    opened = true;
    const r = onOpen();
    chest.setTexture("chest_open");
    scene.tweens.add({ targets: chest, scale: 2.9, yoyo: true, duration: 160 });
    msg.setText(!r ? "Already opened today!" : r.type === "coins" ? `+${r.coins} coins!` : `A ${r.name}! Find it in BUILD.`);
    btn.text.setText("Yay!");
  });
  btn.hit.tag = "gift:open";
  return s;
}

// Sparky asks before a change: brighter, dimmer, or the same?
function showPrediction(scene, { targetName, streak, onAnswer }) {
  const s = openScreen(scene, { title: "Sparky asks…", width: 560, height: 280, onClose: () => { if (!answered) { answered = true; onAnswer(null); } } });
  let answered = false;
  s.layer.add(scene.add.image(s.left + 70, s.top + 120, "sparky").setScale(2));
  screenText(scene, s.layer, s.left + 130, s.top + 104, `Before you do that… will ${targetName} get`, { size: 17, bold: true, originX: 0, align: "left", wrap: 400 });
  screenText(scene, s.layer, s.left + 130, s.top + 136, `Guess right for bonus coins!${streak >= 2 ? ` Streak: ${streak}` : ""}`, { size: 13, color: "#257179", originX: 0 });
  const answer = (a) => { if (answered) return; answered = true; s.close(); onAnswer(a); };
  [["brighter", "BRIGHTER", PALN["4"]], ["dimmer", "DIMMER", PALN["D"]], ["same", "THE SAME", PALN["B"]]].forEach(([a, label, fill], i) => {
    const btn = screenButton(scene, s.layer, s.cx - 170 + i * 170, s.top + 200, 150, 50, label, { fill, fontSize: 16 }, () => answer(a));
    btn.hit.tag = "predict:" + a;
  });
  screenButton(scene, s.layer, s.cx, s.top + s.height - 22, 120, 26, "skip question", { fill: PALN["C"], fontSize: 11, bold: false }, () => answer(null)).hit.tag = "predict:skip";
  return s;
}

// "+12 coins" floating up from a spot.
function showToast(scene, x, y, text, color = "#ffcd75") {
  const t = scene.add.text(x, y, text, { fontFamily: GAME_FONT, fontSize: "18px", color, fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 4 })
    .setOrigin(0.5).setDepth(650);
  scene.tweens.add({ targets: t, y: y - 50, alpha: { from: 1, to: 0 }, duration: 1600, delay: 300, ease: "Sine.Out", onComplete: () => t.destroy() });
  return t;
}

// --- Emergency alert ---
// What's happening, how long you have, and help now or not.
function showEmergencyAlert(scene, { plan, onAccept, onDecline }) {
  const E = EMERGENCIES[plan.key];
  let answered = false;
  const s = openScreen(scene, { title: "⚠ EMERGENCY!", width: 600, height: 330, onClose: () => { if (!answered) { answered = true; onDecline(); } } });
  const icon = scene.add.image(s.left + 80, s.top + 130, E.icon);
  icon.setScale(Math.min(2.5, 90 / icon.width, 90 / icon.height));
  s.layer.add(icon);
  scene.tweens.add({ targets: icon, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 160 });
  screenText(scene, s.layer, s.left + 150, s.top + 70, E.name, { size: 20, bold: true, color: "#b13e53", originX: 0, originY: 0 });
  screenText(scene, s.layer, s.left + 150, s.top + 102, plan.text, { size: 15, originX: 0, originY: 0, align: "left", wrap: 410 });
  screenText(scene, s.layer, s.left + 150, s.top + 200, `You have ${plan.seconds} seconds. Reward: ${EMERGENCY_REWARD.coins} coins + ${EMERGENCY_REWARD.xp} XP`, { size: 13, color: "#257179", bold: true, originX: 0, originY: 0, align: "left", wrap: 410 });
  screenButton(scene, s.layer, s.cx - 110, s.top + s.height - 40, 200, 46, "Let's fix it!", { fill: PALN["5"], fontSize: 17 }, () => { if (answered) return; answered = true; s.close(); onAccept(); }).hit.tag = "emergency:accept";
  screenButton(scene, s.layer, s.cx + 110, s.top + s.height - 40, 180, 46, "Not now", { fill: PALN["D"], fontSize: 15 }, () => { if (answered) return; answered = true; s.close(); onDecline(); }).hit.tag = "emergency:decline";
  Sfx.play("thunder");
  return s;
}
