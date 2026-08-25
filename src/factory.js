// src/factory.js
//
// Scene-graph builders. Every real component has two leads, so every
// two-terminal device here exposes two small connector dots: an orange
// "IN" dot (where power arrives, drawn near the top) and a blue "OUT" dot
// (where the circuit continues onward, drawn near the bottom) — one
// consistent rule across every component, so a kid only has to learn it
// once. GEN only has an OUT dot (it's the source); GND only has an IN dot
// (it's the return rail). The two dots are the only interactive/wireable
// points; the body art itself is purely decorative.

const HOT_COLOR = 0xff8a3d;
const HOT_STROKE = 0x8a3d10;
const GND_COLOR = 0x3d7aff;
const GND_STROKE = 0x10307a;
const TERMINAL_RADIUS = 8;
const TERMINAL_DEPTH = 21;

function addTerminal(scene, x, y, kind) {
  const isHot = kind === "hot";
  const dot = scene.add.circle(x, y, TERMINAL_RADIUS, isHot ? HOT_COLOR : GND_COLOR)
    .setStrokeStyle(2, isHot ? HOT_STROKE : GND_STROKE)
    .setDepth(TERMINAL_DEPTH);
  return dot;
}

export function drawBackground(scene) {
  const W = scene.scale.width;
  const H = scene.scale.height;

  scene.add.rectangle(W / 2, 90, W, 180, 0x7ec8ff).setDepth(-100);
  scene.add.rectangle(W / 2, 160, W, 60, 0xa9ddff).setDepth(-100);
  scene.add.rectangle(W / 2, 365, W, H - 180, 0x59b44a).setDepth(-100);

  scene.add.rectangle(W / 2, 330, W, 70, 0x6b6b6b).setDepth(-99);
  for (let x = 30; x < W; x += 60) {
    scene.add.rectangle(x, 330, 30, 6, 0xf5f5f5).setDepth(-98);
  }
}

export function addTownDecor(scene) {
  addTree(scene, 80, 430);
  addTree(scene, 140, 470);
  addTree(scene, 220, 440);
  addTree(scene, 820, 450);
  addTree(scene, 760, 480);
  addTree(scene, 680, 445);
}

export function addTree(scene, x, y) {
  scene.add.rectangle(x, y + 18, 12, 28, 0x7a4a22).setDepth(-97);
  scene.add.circle(x, y, 22, 0x2f8f2f).setDepth(-96);
  scene.add.circle(x - 18, y + 6, 18, 0x2a7f2a).setDepth(-96);
  scene.add.circle(x + 18, y + 8, 18, 0x2a7f2a).setDepth(-96);
}

export function makeGenerator(scene, x, y) {
  const container = scene.add.container(x, y).setDepth(20);

  const base = scene.add.rectangle(0, 20, 120, 70, 0x2b2b2b).setStrokeStyle(3, 0x111111);

  const roof = scene.add.graphics();
  roof.fillStyle(0x444444, 1);
  roof.lineStyle(3, 0x111111, 1);
  roof.beginPath();
  roof.moveTo(-70, -15);
  roof.lineTo(70, -15);
  roof.lineTo(0, -60);
  roof.closePath();
  roof.fillPath();
  roof.strokePath();

  const bolt = scene.add.triangle(0, 18, -8, -6, 2, -6, -4, 18, 0xffcc00);
  const label = scene.add.text(-28, 62, "GEN", { fontFamily: "Arial", fontSize: "14px", color: "#ffffff" });
  const supplyLabel = scene.add.text(-46, 82, "supplying 0.00A", { fontFamily: "Arial", fontSize: "12px", color: "#ffffff" });

  container.add([roof, base, bolt, label, supplyLabel]);

  const outDot = addTerminal(scene, x, y + 100, "hot");

  return { container, outHit: outDot, visual: { base, supplyLabel } };
}

export function makeGroundTerminal(scene, x, y) {
  const container = scene.add.container(x, y).setDepth(20);
  const g = scene.add.graphics();
  g.lineStyle(4, 0x333333, 1);
  g.lineBetween(0, -20, 0, 10);
  g.lineBetween(-22, 10, 22, 10);
  g.lineBetween(-14, 18, 14, 18);
  g.lineBetween(-6, 26, 6, 26);
  const label = scene.add.text(-16, 34, "GND", { fontFamily: "Arial", fontSize: "13px", color: "#0b1020" });
  container.add([g, label]);

  const inDot = addTerminal(scene, x, y - 30, "gnd");
  return { container, inHit: inDot, visual: {} };
}

export function makeHouse(scene, x, y, idText = "H0") {
  const container = scene.add.container(x, y).setDepth(20);

  const body = scene.add.rectangle(0, 20, 90, 60, 0xe9e2d0).setStrokeStyle(3, 0x3a2f25);

  const roof = scene.add.graphics();
  roof.fillStyle(0xb45b3d, 1);
  roof.lineStyle(3, 0x3a2f25, 1);
  roof.beginPath();
  roof.moveTo(-50, -10);
  roof.lineTo(50, -10);
  roof.lineTo(0, -55);
  roof.closePath();
  roof.fillPath();
  roof.strokePath();

  const window1 = scene.add.rectangle(-18, 20, 16, 16, 0x777777).setStrokeStyle(2, 0x3a2f25);
  const window2 = scene.add.rectangle(18, 20, 16, 16, 0x777777).setStrokeStyle(2, 0x3a2f25);

  const idLabel = scene.add.text(-18, 55, idText, { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });
  const voltLabel = scene.add.text(-28, 70, "V=0.00V", { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });
  const currLabel = scene.add.text(-28, 85, "I=0.00A", { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });

  container.add([roof, body, window1, window2, idLabel, voltLabel, currLabel]);

  const inDot = addTerminal(scene, x, y - 68, "hot");
  const outDot = addTerminal(scene, x, y + 100, "gnd");

  return { container, inHit: inDot, outHit: outDot, visual: { body, window1, window2, voltLabel, currLabel } };
}

export function makeResistor(scene, x, y, idText = "R0", ohms = 2.0) {
  const container = scene.add.container(x, y).setDepth(20);

  const base = scene.add.rectangle(0, 20, 90, 50, 0xf0d36b).setStrokeStyle(3, 0x6b5a1d);

  const g = scene.add.graphics();
  g.lineStyle(4, 0x6b5a1d, 1);
  g.beginPath();
  g.moveTo(-30, 20);
  g.lineTo(-20, 10);
  g.lineTo(-10, 30);
  g.lineTo(0, 10);
  g.lineTo(10, 30);
  g.lineTo(20, 10);
  g.lineTo(30, 20);
  g.strokePath();

  const label = scene.add.text(-18, 55, idText, { fontFamily: "Arial", fontSize: "14px", color: "#0b1020" });
  const ohmLabel = scene.add.text(-34, 72, `${ohms.toFixed(0)}Ω`, { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });

  container.add([base, g, label, ohmLabel]);

  const inDot = addTerminal(scene, x, y - 18, "hot");
  const outDot = addTerminal(scene, x, y + 90, "gnd");

  return { container, inHit: inDot, outHit: outDot, visual: { base, ohmLabel } };
}

export function makeCapacitor(scene, x, y, idText = "C0", uF = 220) {
  const container = scene.add.container(x, y).setDepth(20);

  const body = scene.add.rectangle(0, 20, 70, 60, 0x7bb7ff).setStrokeStyle(3, 0x1f4f7a);
  const top = scene.add.ellipse(0, -10, 70, 18, 0x9ad0ff).setStrokeStyle(3, 0x1f4f7a);

  const leadL = scene.add.rectangle(-18, 45, 4, 20, 0x1f4f7a);
  const leadR = scene.add.rectangle(18, 45, 4, 20, 0x1f4f7a);
  const plus = scene.add.text(20, -2, "+", { fontFamily: "Arial", fontSize: "16px", color: "#0b1020" });

  const label = scene.add.text(-18, 62, idText, { fontFamily: "Arial", fontSize: "14px", color: "#0b1020" });
  const capLabel = scene.add.text(-34, 78, `${uF.toFixed(0)}µF`, { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });

  container.add([body, top, leadL, leadR, plus, label, capLabel]);

  const inDot = addTerminal(scene, x, y - 38, "hot");
  const outDot = addTerminal(scene, x, y + 96, "gnd");

  return { container, inHit: inDot, outHit: outDot, visual: { body, capLabel } };
}

export function makeTransformer(scene, x, y, idText = "X0", ratio = 0.5) {
  const container = scene.add.container(x, y).setDepth(20);

  const base = scene.add.rectangle(0, 22, 120, 70, 0xe3ccff).setStrokeStyle(3, 0x4a2a7a);

  const g = scene.add.graphics();
  g.lineStyle(3, 0x4a2a7a, 1);
  for (let i = -40; i <= -10; i += 10) g.strokeCircle(i, 22, 6);
  for (let i = 10; i <= 40; i += 10) g.strokeCircle(i, 22, 6);

  const tower = scene.add.graphics();
  tower.lineStyle(3, 0x4a2a7a, 1);
  tower.beginPath();
  tower.moveTo(0, -18);
  tower.lineTo(-12, 10);
  tower.lineTo(12, 10);
  tower.closePath();
  tower.strokePath();
  tower.lineBetween(-16, 0, 16, 0);

  const label = scene.add.text(-18, 62, idText, { fontFamily: "Arial", fontSize: "14px", color: "#0b1020" });
  const ratioLabel = scene.add.text(-50, 78, `ratio ${ratio.toFixed(2)}×`, { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });

  container.add([base, g, tower, label, ratioLabel]);

  const priDot = addTerminal(scene, x, y - 40, "hot");
  const secDot = addTerminal(scene, x, y + 96, "gnd");

  return { container, priHit: priDot, secHit: secDot, visual: { base, ratioLabel } };
}

export function makeTransistor(scene, x, y, idText = "T0") {
  const container = scene.add.container(x, y).setDepth(20);

  const base = scene.add.rectangle(0, 20, 90, 60, 0xb7d7ff).setStrokeStyle(3, 0x1c4c7a);

  const g = scene.add.graphics();
  g.lineStyle(3, 0x1c4c7a, 1);
  g.beginPath();
  g.moveTo(-10, 5); g.lineTo(-10, 45);
  g.moveTo(10, 5);  g.lineTo(10, 45);
  g.moveTo(-35, 25); g.lineTo(-10, 25);
  g.moveTo(10, 25);  g.lineTo(35, 25);
  g.strokePath();

  const label = scene.add.text(-18, 55, idText, { fontFamily: "Arial", fontSize: "14px", color: "#0b1020" });
  const hint = scene.add.text(-40, 72, "(tap body to flip)", { fontFamily: "Arial", fontSize: "10px", color: "#0b1020" });

  container.add([base, g, label, hint]);

  const inDot = addTerminal(scene, x, y - 28, "hot");
  const outDot = addTerminal(scene, x, y + 85, "gnd");
  const toggleZone = scene.add.zone(x, y + 20, 90, 60).setInteractive({ useHandCursor: true });

  return { container, inHit: inDot, outHit: outDot, toggleHit: toggleZone, visual: { base } };
}

export function makeLED(scene, x, y, idText = "L0") {
  const container = scene.add.container(x, y).setDepth(20);

  const pole = scene.add.rectangle(0, 25, 10, 60, 0x444444);
  const head = scene.add.rectangle(0, -2, 30, 18, 0x333333).setStrokeStyle(2, 0x111111);
  const bulb = scene.add.circle(0, -2, 8, 0x555555);

  const label = scene.add.text(-18, 55, idText, { fontFamily: "Arial", fontSize: "14px", color: "#0b1020" });
  const voltLabel = scene.add.text(-28, 72, "V=0.00V", { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });
  const currLabel = scene.add.text(-28, 87, "I=0.00A", { fontFamily: "Arial", fontSize: "12px", color: "#0b1020" });

  container.add([pole, head, bulb, label, voltLabel, currLabel]);

  const inDot = addTerminal(scene, x, y - 22, "hot");
  const outDot = addTerminal(scene, x, y + 102, "gnd");

  return { container, inHit: inDot, outHit: outDot, visual: { bulb, head, voltLabel, currLabel } };
}

export function setHouseVisual(v, level) {
  if (level === "ON") {
    v.window1.fillColor = 0xfff2a6;
    v.window2.fillColor = 0xfff2a6;
    v.body.fillColor = 0xdff5d9;
  } else if (level === "DIM") {
    v.window1.fillColor = 0xe6cf7a;
    v.window2.fillColor = 0xe6cf7a;
    v.body.fillColor = 0xe8f0df;
  } else {
    v.window1.fillColor = 0x777777;
    v.window2.fillColor = 0x777777;
    v.body.fillColor = 0xe9e2d0;
  }
}

export function setLEDVisual(v, level, brightness01 = null) {
  if (level === "BURNED") {
    v.bulb.fillColor = 0x1a1a1a;
    v.head.fillColor = 0x1a1a1a;
    return;
  }
  const b = (brightness01 == null) ? null : Math.max(0, Math.min(1, brightness01));
  if (b != null) {
    if (b <= 0.02) { v.bulb.fillColor = 0x555555; v.head.fillColor = 0x333333; return; }
    if (b < 0.6) { v.bulb.fillColor = 0xe6cf7a; v.head.fillColor = 0x3b3b3b; return; }
    v.bulb.fillColor = 0xfff2a6; v.head.fillColor = 0x444444; return;
  }
  if (level === "ON") { v.bulb.fillColor = 0xfff2a6; v.head.fillColor = 0x444444; }
  else if (level === "DIM") { v.bulb.fillColor = 0xe6cf7a; v.head.fillColor = 0x3b3b3b; }
  else { v.bulb.fillColor = 0x555555; v.head.fillColor = 0x333333; }
}

export function setTransistorVisual(v, on) {
  v.base.fillColor = on ? 0xb7d7ff : 0xaaaaaa;
}

// A short cartoon "pop" — a few particles-as-shapes bursting outward and
// fading, plus a speech-bubble line in kid language. Reversible, funny, not
// punishing (see AUDIT.md B4 / DESIGN.md's Kerbal Space Program section).
export function playBurnoutEffect(scene, x, y, message) {
  const colors = [0xffcc00, 0xff6633, 0xff3355, 0xffffff];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const dist = 26 + Math.random() * 14;
    const chip = scene.add.circle(x, y, 4, colors[i % colors.length]).setDepth(300);
    scene.tweens.add({
      targets: chip,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: 420,
      ease: "Cubic.Out",
      onComplete: () => chip.destroy(),
    });
  }

  const bubble = scene.add.container(x, y - 60).setDepth(301);
  const pad = 10;
  const txt = scene.add.text(0, 0, message, {
    fontFamily: "Arial", fontSize: "13px", color: "#0b1020", align: "center", wordWrap: { width: 160 },
  }).setOrigin(0.5);
  const bg = scene.add.rectangle(0, 0, txt.width + pad * 2, txt.height + pad * 2, 0xffffff, 0.95)
    .setStrokeStyle(2, 0x0b1020);
  bubble.add([bg, txt]);

  scene.tweens.add({
    targets: bubble,
    y: y - 90,
    alpha: { from: 1, to: 0 },
    duration: 2200,
    delay: 500,
    onComplete: () => bubble.destroy(),
  });
}
