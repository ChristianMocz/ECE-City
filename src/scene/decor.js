// src/scene/decor.js
//
// Decorations: just for looks, and only in your town. Draws the ones placed
// in the current region, finds one under a tap, and puts one back in the box.
//
// Gives city: decorAt, decorLeft, drawDecor, removeDecor.

function installDecor(city) {
  const { profile, save, scene, state, status } = city;
  let decorImages = [];
  function drawDecor() {
    for (const img of decorImages) img.destroy();
    decorImages = [];
    if (state.context !== "town") return;
    profile.decorPlaced.forEach((d, i) => {
      if ((d.region || "sparkville") !== profile.region) return; // each region shows its own
      const img = scene.add.image(d.x, d.y, "decor_" + d.key).setDepth(5);
      img.decorIndex = i;
      decorImages.push(img);
    });
  }
  function decorAt(x, y) {
    if (state.context !== "town") return -1;
    for (let i = decorImages.length - 1; i >= 0; i--) if (decorImages[i].getBounds().contains(x, y)) return decorImages[i].decorIndex;
    return -1;
  }
  function removeDecor(i) {
    const d = profile.decorPlaced[i];
    if (!d) return;
    profile.decorPlaced.splice(i, 1);
    drawDecor();
    save();
    Sfx.play("delete");
    status.setText(`The ${DECOR[d.key].name.toLowerCase()} went back in your BUILD box.`);
  }
  function decorLeft(key) {
    return (profile.owned.decor[key] || 0) - profile.decorPlaced.filter(d => d.key === key).length;
  }

  Object.assign(city, { decorAt, decorLeft, drawDecor, removeDecor });
}
