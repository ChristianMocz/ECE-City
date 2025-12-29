const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 550,
  backgroundColor: "#000000", // we draw our own background
  scene: { create }
};

new Phaser.Game(config);

function create() {
  const W = this.scale.width;
  const H = this.scale.height;

  // ---------- BACKGROUND (Sky + Grass) ----------
  this.add.rectangle(W / 2, 90, W, 180, 0x7ec8ff).setDepth(-100);
  this.add.rectangle(W / 2, 160, W, 60, 0xa9ddff).setDepth(-100);
  this.add.rectangle(W / 2, 365, W, H - 180, 0x59b44a).setDepth(-100);

  // Road
  this.add.rectangle(W / 2, 330, W, 70, 0x6b6b6b).setDepth(-99);
  for (let x = 30; x < W; x += 60) {
    this.add.rectangle(x, 330, 30, 6, 0xf5f5f5).setDepth(-98);
  }

  // Trees
  addTree(this, 80, 430);
  addTree(this, 140, 470);
  addTree(this, 220, 440);
  addTree(this, 820, 450);
  addTree(this, 760, 480);
  addTree(this, 680, 445);

  // ---------- UI ----------
  this.add.text(20, 12, "ECE City (MVP)", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#0b1020"
  }).setDepth(60);

  // ---------- TOWN OBJECTS ----------
  const genObj = makeGenerator(this, 140, 285);

  const houses = [
    makeHouse(this, 700, 210, "House 1"),
    makeHouse(this, 700, 310, "House 2"),
    makeHouse(this, 700, 410, "House 3"),
  ];

  // ---------- WIRING STATE ----------
  const connected = new Set();
  let currentLine = null;
  const wireDepth = 10;

  // IMPORTANT: click the generator BASE (rectangle) not the container
  genObj.base.setInteractive({ useHandCursor: true });
  genObj.base.on("pointerdown", () => {
    // Start preview wire
    currentLine = this.add.line(0, 0, genObj.container.x, genObj.container.y, genObj.container.x, genObj.container.y, 0x2b2b2b)
      .setOrigin(0, 0)
      .setLineWidth(4)
      .setDepth(wireDepth);
  });

  // Follow mouse while wiring
  this.input.on("pointermove", (p) => {
    if (!currentLine) return;
    currentLine.setTo(genObj.container.x, genObj.container.y, p.x, p.y);
  });

  // IMPORTANT: click the HOUSE BODY (rectangle) not the container
  houses.forEach((houseObj, idx) => {
    houseObj.body.setInteractive({ useHandCursor: true });

    houseObj.body.on("pointerdown", () => {
      if (!currentLine) return;

      connected.add(idx);

      // Lock the wire to the center of the house
      currentLine.setTo(genObj.container.x, genObj.container.y, houseObj.container.x, houseObj.container.y);
      currentLine = null;

      // Power visuals
      setHousePowered(houseObj, true);
    });
  });

  // ---------- RUN CHECK BUTTON ----------
  const btn = this.add.rectangle(450, 40, 170, 38, 0xffcc00)
    .setInteractive({ useHandCursor: true })
    .setDepth(60);

  this.add.text(392, 28, "RUN CHECK", {
    color: "#000",
    fontSize: "16px",
    fontFamily: "Arial"
  }).setDepth(60);

  const status = this.add.text(20, 515, "Click the generator base, then click houses to connect wires.", {
    color: "#0b1020",
    fontSize: "18px",
    fontFamily: "Arial"
  }).setDepth(60);

  btn.on("pointerdown", () => {
    if (connected.size === houses.length) {
      status.setText("✅ All houses powered! Nice work.");
    } else {
      status.setText(`❌ Only ${connected.size}/${houses.length} houses connected.`);
    }
  });
}

// ---------- Helper: tree ----------
function addTree(scene, x, y) {
  scene.add.rectangle(x, y + 18, 12, 28, 0x7a4a22).setDepth(-97);
  scene.add.circle(x, y, 22, 0x2f8f2f).setDepth(-96);
  scene.add.circle(x - 18, y + 6, 18, 0x2a7f2a).setDepth(-96);
  scene.add.circle(x + 18, y + 8, 18, 0x2a7f2a).setDepth(-96);
}

// ---------- Helper: generator ----------
function makeGenerator(scene, x, y) {
  const container = scene.add.container(x, y).setDepth(20);

  // Base (THIS is clickable)
  const base = scene.add.rectangle(0, 20, 120, 70, 0x2b2b2b)
    .setStrokeStyle(3, 0x111111);

  // Roof (Graphics so it lines up perfectly)
  const roof = scene.add.graphics();
  roof.fillStyle(0x444444, 1);
  roof.lineStyle(3, 0x111111, 1);

  // Base top is y = 20 - 70/2 = -15
  // Put the roof base exactly at y = -15
  roof.beginPath();
  roof.moveTo(-70, -15); // left base
  roof.lineTo(70, -15);  // right base
  roof.lineTo(0, -60);   // peak
  roof.closePath();
  roof.fillPath();
  roof.strokePath();

  // Bolt icon
  const bolt = scene.add.triangle(0, 18, -8, -6, 2, -6, -4, 18, 0xffcc00);

  // Label
  const label = scene.add.text(-52, 62, "Generator", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff"
  });

  // IMPORTANT: roof first so it draws behind base nicely
  container.add([roof, base, bolt, label]);

  return { container, base };
}


// ---------- Helper: house ----------
function makeHouse(scene, x, y, name) {
  const container = scene.add.container(x, y).setDepth(20);

  // Body
  const body = scene.add.rectangle(0, 20, 90, 60, 0xe9e2d0)
    .setStrokeStyle(3, 0x3a2f25);

  // Roof (Graphics = always aligned)
  const roof = scene.add.graphics();
  roof.fillStyle(0xb45b3d, 1);
  roof.lineStyle(3, 0x3a2f25, 1);

  // Body top is y = 20 - 60/2 = -10
  // Make roof base sit exactly at y = -10
  roof.beginPath();
  roof.moveTo(-50, -10); // left base
  roof.lineTo(50, -10);  // right base
  roof.lineTo(0, -55);   // top peak
  roof.closePath();
  roof.fillPath();
  roof.strokePath();

  // Windows
  const window1 = scene.add.rectangle(-18, 20, 16, 16, 0x777777)
    .setStrokeStyle(2, 0x3a2f25);
  const window2 = scene.add.rectangle(18, 20, 16, 16, 0x777777)
    .setStrokeStyle(2, 0x3a2f25);

  // Label
  const label = scene.add.text(-34, 55, name, {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#0b1020"
  });

  container.add([roof, body, window1, window2, label]);

  return { container, body, window1, window2 };
}


function setHousePowered(houseObj, powered) {
  if (powered) {
    houseObj.window1.fillColor = 0xfff2a6;
    houseObj.window2.fillColor = 0xfff2a6;
    houseObj.body.fillColor = 0xdff5d9;
  } else {
    houseObj.window1.fillColor = 0x777777;
    houseObj.window2.fillColor = 0x777777;
    houseObj.body.fillColor = 0xe9e2d0;
  }
}
