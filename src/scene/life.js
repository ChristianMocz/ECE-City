// src/scene/life.js
//
// The living town: people walking along the road and cars driving by. More
// appear as the population grows, fewer walk at night. Just for looks: nothing
// is tappable, and it sits under the wires and parts (depth 6).
//
// Main pieces: makeTownLife() (returns { update, walkers, cars }).
// Used by: src/scene/setup.js.

const LIFE_DEPTH = 6;
const LIFE_WALKERS = 12;
const LIFE_CARS = 4;

function makeTownLife(scene) {
  const W = scene.scale.width;
  const walkers = [];
  for (let i = 0; i < LIFE_WALKERS; i++) {
    const kind = i % WALKER_COLORS.length;
    const img = scene.add.image(Math.random() * W, 0, `walker_${kind}_0`).setDepth(LIFE_DEPTH).setVisible(false);
    img.kind = kind;
    img.dir = Math.random() < 0.5 ? -1 : 1;
    img.speed = 18 + Math.random() * 16;
    img.lane = i % 2;
    img.y = img.lane ? 362 : 300;
    img.setFlipX(img.dir < 0);
    img.phase = Math.random();
    walkers.push(img);
  }
  const cars = [];
  for (let i = 0; i < LIFE_CARS; i++) {
    const img = scene.add.image(Math.random() * W, i % 2 ? 344 : 320, "car_" + (i % CAR_COLORS.length)).setDepth(LIFE_DEPTH + 0.1).setVisible(false);
    img.dir = i % 2 ? -1 : 1;
    img.setFlipX(img.dir < 0);
    img.speed = 70 + Math.random() * 50;
    cars.push(img);
  }
  // Headlights at night (a soft glow ahead of each car).
  const lights = cars.map(c => scene.add.image(c.x, c.y, "glow").setDepth(LIFE_DEPTH + 0.2).setScale(0.35, 0.2).setTint(PALN["4"]).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));

  // info: { show, population, night }
  function update(dt, info) {
    const show = !!info.show;
    const people = Math.max(0, info.population || 0);
    const nWalk = show ? Math.min(LIFE_WALKERS, Math.ceil(people / 4) / (info.night ? 2 : 1)) : 0;
    const nCars = show ? Math.min(LIFE_CARS, Math.floor(people / 10)) : 0;
    walkers.forEach((w, i) => {
      const on = i < nWalk;
      if (w.visible !== on) w.setVisible(on);
      if (!on) return;
      w.x += w.dir * w.speed * dt;
      if (w.x > W + 20) w.x = -20; else if (w.x < -20) w.x = W + 20;
      w.phase = (w.phase + dt * 3) % 1;
      const key = `walker_${w.kind}_${w.phase < 0.5 ? 0 : 1}`;
      if (w.texture.key !== key) w.setTexture(key);
    });
    cars.forEach((c, i) => {
      const on = i < nCars;
      if (c.visible !== on) c.setVisible(on);
      lights[i].setVisible(on && !!info.night);
      if (!on) return;
      c.x += c.dir * c.speed * dt;
      if (c.x > W + 40) c.x = -40; else if (c.x < -40) c.x = W + 40;
      lights[i].setPosition(c.x + c.dir * 26, c.y + 2);
    });
  }
  return { update, walkers, cars };
}
