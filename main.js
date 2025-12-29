const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 550,
  backgroundColor: "#101a3a",
  scene: { create }
};

new Phaser.Game(config);

function create() {
  this.add.text(20, 20, "ECE City (MVP)", {
    fontFamily: "Arial",
    fontSize: "28px",
    color: "#ffffff"
  });

  const gen = this.add.circle(150, 300, 35, 0x00ffcc);
  this.add.text(120, 350, "Generator", { color: "#ffffff" });

  const houses = [
    this.add.rectangle(650, 180, 70, 70, 0x444444),
    this.add.rectangle(650, 300, 70, 70, 0x444444),
    this.add.rectangle(650, 420, 70, 70, 0x444444),
  ];
  houses.forEach((h, i) => this.add.text(625, 210 + i*120, `House ${i+1}`, { color:"#ffffff" }));

  const connected = new Set();
  let currentLine = null;

  gen.setInteractive();
  gen.on("pointerdown", () => {
    currentLine = this.add.line(0, 0, gen.x, gen.y, gen.x, gen.y, 0xffffff).setOrigin(0,0);
  });

  this.input.on("pointermove", (p) => {
    if (!currentLine) return;
    currentLine.setTo(gen.x, gen.y, p.x, p.y);
  });

  houses.forEach((h, idx) => {
    h.setInteractive();
    h.on("pointerdown", () => {
      if (!currentLine) return;
      connected.add(idx);
      currentLine.setTo(gen.x, gen.y, h.x, h.y);
      currentLine = null;
      h.fillColor = 0x00ff00; // light up
    });
  });

  const btn = this.add.rectangle(450, 60, 160, 45, 0xffcc00).setInteractive();
  this.add.text(405, 48, "RUN CHECK", { color: "#000", fontSize: "18px" });

  const status = this.add.text(20, 500, "Click generator, then click houses to wire them.", {
    color: "#ffffff",
    fontSize: "18px"
  });

  btn.on("pointerdown", () => {
    status.setText(
      connected.size === 3
        ? "✅ All houses powered!"
        : `❌ Only ${connected.size}/3 houses connected.`
    );
  });
}
