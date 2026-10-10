// src/ui/shop.js
//
// The + BUILD menu, the SHOP and the CLOTHES wardrobe. These screens only
// draw tiles and report taps through callbacks; buying and placing happen
// in the scene modules.
//
// Main pieces: showBuildMenu(), showShop(), showWardrobe().
// Uses: src/ui/kit.js. Used by: src/scene/buildmenu.js, src/scene/menus.js.

// --- BUILD menu ---
// Every part (locked ones show their unlock level), plus owned buildings and decorations not yet placed.
const BUILD_ICONS = { HOUSE: "house", RES: "res_470", LED: "led_on", TRANS: "switch_on", CAP: "cap", XFMR: "xfmr", SOLAR: "solar", BAT: "battery" };
function toolLabel(t) {
  if (t.kind === "RES") return `${t.opt}Ω resistor`;
  if (t.kind === "CAP") return `${t.opt}µF capacitor`;
  if (t.kind === "XFMR") return t.opt > 1 ? `Step up ×${t.opt}` : t.opt < 1 ? `Step down ×${t.opt}` : "Transformer 1:1";
  return PARTS[t.kind]?.name || t.kind;
}
function toolIcon(scene, t) {
  if (t.kind === "RES") return resistorTexture(scene, t.opt);
  return BUILD_ICONS[t.kind];
}
function showBuildMenu(scene, { profile, state, onPick, onLocked, toolbox }) {
  resistorTexture(scene, 470); // resistor art is made on first use, so make the icon now
  if (toolbox) {
    // A campaign level: only its own parts, each with how many are left.
    const items = toolbox.map(t => ({
      tag: "build:T:" + t.key, icon: toolIcon(scene, t), name: toolLabel(t), sub: `${t.left} left · $${PART_COST[t.kind] || 0}`, dim: t.left <= 0,
      onTap: () => (t.left > 0 ? (s.close(), onPick({ kind: "tool", key: t.key, tool: t })) : onLocked(toolLabel(t), 0)),
    }));
    const cols = Math.min(5, Math.max(1, items.length)), rows = Math.max(1, Math.ceil(items.length / cols));
    const s = openScreen(scene, { title: "This level's parts", width: Math.max(420, cols * 118 + 40), height: 76 + rows * 102 + 44 });
    if (items.length) tileGrid(scene, s, items, { cols, tileW: 108, tileH: 92, top: s.top + 60 });
    else screenText(scene, s.layer, s.cx, s.top + 110, "No extra parts in this level — use what's on the board!", { size: 15, bold: true, wrap: s.width - 40 });
    screenText(scene, s.layer, s.cx, s.top + s.height - 22, "Parts cost money from the level's budget, like wires do.", { size: 12, color: "#333c57" });
    return s;
  }
  const lvl = levelForXp(profile.xp);
  const items = Object.keys(PARTS).map(k => ({
    tag: "build:" + k, icon: BUILD_ICONS[k], name: PARTS[k].name,
    locked: lvl < PARTS[k].level, sub: lvl < PARTS[k].level ? `Level ${PARTS[k].level}` : k === "HOUSE" ? "free" : "",
    onTap: () => (lvl < PARTS[k].level ? onLocked(PARTS[k].name, PARTS[k].level) : (s.close(), onPick({ kind: "part", key: k }))),
  }));
  for (const k of BUILDING_KEYS) {
    if (k === "house" || !(profile.owned.buildings[k] > 0)) continue;
    const left = buildingsAvailable(profile, k, state);
    items.push({ tag: "build:B:" + k, icon: "bld_" + k, name: BUILDINGS[k].name, sub: `${left} to place`, locked: false, dim: left === 0,
      onTap: () => (left > 0 ? (s.close(), onPick({ kind: "building", key: k })) : onLocked(BUILDINGS[k].name, 0)) });
  }
  for (const k of Object.keys(DECOR)) {
    const owned = profile.owned.decor[k] || 0;
    if (!owned) continue;
    const left = owned - profile.decorPlaced.filter(d => d.key === k).length;
    items.push({ tag: "build:D:" + k, icon: "decor_" + k, name: DECOR[k].name, sub: `${left} to place`,
      onTap: () => (left > 0 ? (s.close(), onPick({ kind: "decor", key: k })) : onLocked(DECOR[k].name, 0)) });
  }
  const cols = 5, rows = Math.ceil(items.length / cols);
  const s = openScreen(scene, { title: "Build", width: 640, height: Math.min(560, 76 + rows * 102 + 14) });
  if (rows <= 5) tileGrid(scene, s, items, { cols, tileW: 104, tileH: 92, top: s.top + 60 });
  else scrollGrid(scene, s, items, { cols, tileW: 104, tileH: 92, top: s.top + 60, height: s.height - 76, cx: s.cx - 16, memKey: "build" });
  return s;
}

// --- SHOP ---
// Buildings (each with its own power needs), lights, decorations and power plants.
function showShop(scene, { profile, tab = "building", onBuy, onPlant, region }) {
  const lvl = levelForXp(profile.xp);
  const s = openScreen(scene, { title: "Shop", width: 760, height: 520 });
  const tabBtn = (x, label, t) => {
    const btn = screenButton(scene, s.layer, x, s.top + 76, 150, 32, label, { fill: tab === t ? PALN["4"] : PALN["C"], fontSize: 14 }, () => { s.close(); showShop(scene, { profile, tab: t, onBuy, onPlant, region }); });
    btn.hit.tag = "shoptab:" + t;
  };
  tabBtn(s.cx - 175, "Buildings", "building");
  tabBtn(s.cx - 20, "Lights & fun", "lights");
  tabBtn(s.cx + 135, "Decorations", "decor");
  tabBtn(s.cx + 285, "Power plants", "plant");
  coinLine(scene, s.layer, s.left + 46, s.top + 76, profile.coins, { size: 16 });
  if (tab === "plant") {
    const here = plantOf(profile, region);
    const items = PLANT_KEYS.map(k => {
      const P = PLANTS[k], owned = plantOwned(profile, k), locked = !owned && lvl < P.level;
      return {
        tag: "shop:plant:" + k, icon: P.sprite, name: P.name, selected: here === k, locked,
        sub: here === k ? "powering this town" : owned ? "tap to use here" : locked ? `Level ${P.level}` : P.price,
        onTap: () => onPlant(k, s),
      };
    });
    tileGrid(scene, s, items, { cols: 5, tileW: 124, tileH: 104, top: s.top + 104, gap: 8 });
    screenText(scene, s.layer, s.cx, s.top + s.height - 22, "A bigger power plant keeps more buildings bright — but each one has a catch. Tap one to see.", { size: 13, color: "#333c57", wrap: s.width - 40 });
    return s;
  }
  // "Lights & fun" are decorations that light up, so they are wired and bought like buildings.
  const isBld = tab === "building" || tab === "lights";
  const cat = isBld ? BUILDINGS : DECOR;
  const keys = Object.keys(cat).filter(k => !isBld || (k !== "house" && !!BUILDINGS[k].decor === (tab === "lights")));
  const items = keys.map(k => {
    const it = cat[k];
    const locked = lvl < it.level;
    return {
      tag: `shop:${isBld ? "building" : "decor"}:${k}`, icon: (isBld ? "bld_" : "decor_") + k, name: it.name,
      sub: locked ? `Level ${it.level}` : it.price, locked,
      onTap: () => onBuy(isBld ? "building" : "decor", k, s),
    };
  });
  scrollGrid(scene, s, items, { cols: 3, tileW: 180, tileH: 110, top: s.top + 104, height: s.height - 150, cx: s.cx - 14, memKey: "shop:" + tab });
  const note = tab === "building" ? "Each building needs power differently. Tap one to buy it, then tap the grass to place it."
    : tab === "lights" ? "These decorations light up! Wire them to GEN and GND just like a building." : "Decorations are just for looks. Tap the grass to place them.";
  screenText(scene, s.layer, s.cx, s.top + s.height - 22, note, { size: 13, color: "#333c57", wrap: s.width - 40 });
  return s;
}

// --- CLOTHES ---
// Dress the engineer and the sidekick (two tabs).
function outfitIcon(scene, key) {
  return (layer, x, y) => {
    const slot = OUTFITS[key].slot;
    const c = scene.add.container(x, y + 14);
    if (slot === "acc" && key === "acc_cape") c.add(scene.add.image(0, 0, "fit_" + key).setOrigin(0.5, 1));
    c.add(scene.add.image(0, 0, "person").setOrigin(0.5, 1));
    if (key !== "acc_cape") c.add(scene.add.image(0, 0, "fit_" + key).setOrigin(0.5, 1));
    c.setScale(0.6);
    layer.add(c);
  };
}
function petIcon(scene, key, profile) {
  return (layer, x, y) => {
    const it = PET_ITEMS[key];
    const type = it.slot === "dogcolor" ? "dog" : it.slot === "robotcolor" ? "robot" : profile.sidekick.type;
    const body = it.slot === "dogcolor" || it.slot === "robotcolor" ? key : profile.sidekick.color;
    const c = scene.add.container(x, y + 10);
    if (key === "pacc_cape") c.add(scene.add.image(0, 0, `pet_${key}_${type}`).setOrigin(0.5, 1));
    c.add(scene.add.image(0, 0, "pet_" + body).setOrigin(0.5, 1));
    if (it.slot === "pethat" || (it.slot === "petacc" && key !== "pacc_cape")) c.add(scene.add.image(0, 0, `pet_${key}_${type}`).setOrigin(0.5, 1));
    c.setScale(1);
    layer.add(c);
  };
}
function showWardrobe(scene, { profile, tab = "engineer", onTapItem, onTapPet, onPetType, onTab }) {
  const lvl = levelForXp(profile.xp);
  const s = openScreen(scene, { title: "Clothes", width: 720, height: 590 });
  const tabBtn = (x, label, t) => {
    const btn = screenButton(scene, s.layer, x, s.top + 72, 150, 30, label, { fill: tab === t ? PALN["4"] : PALN["C"], fontSize: 14 }, () => onTab(t, s));
    btn.hit.tag = "wardrobe:" + t;
  };
  tabBtn(s.left + 280, "Engineer", "engineer");
  tabBtn(s.left + 440, "Sidekick", "sidekick");
  // Big preview of the engineer and the sidekick as dressed now.
  const eng = makeEngineer(scene, s.left + 90, s.top + 290);
  dressEngineer(eng, profile.wearing);
  eng.container.setScale(2);
  s.layer.add(eng.container);
  const pet = makeSidekick(scene, s.left + 100, s.top + 370);
  dressSidekick(pet, profile.sidekick);
  pet.container.setScale(1.6);
  s.layer.add(pet.container);
  coinLine(scene, s.layer, s.left + 90, s.top + 400, profile.coins, { size: 18 });
  screenText(scene, s.layer, s.left + 90, s.top + 450, "Tap something to buy it or put it on. Tap again to take it off.", { size: 12, color: "#333c57", wrap: 150 });
  const gridScreen = { layer: s.layer, cx: s.left + 190 + (s.width - 200) / 2 };
  if (tab === "engineer") {
    const keys = Object.keys(OUTFITS);
    const items = keys.map(k => {
      const it = OUTFITS[k];
      const owned = profile.owned.outfits.includes(k);
      const wearing = profile.wearing[it.slot] === k;
      const locked = !owned && lvl < it.level;
      return {
        tag: "outfit:" + k, icon: outfitIcon(scene, k), name: it.name, selected: wearing, locked,
        sub: wearing ? "wearing" : owned ? "tap to wear" : locked ? `Level ${it.level}` : it.price,
        onTap: () => onTapItem(k, s),
      };
    });
    scrollGrid(scene, s, items, { cols: 5, tileW: 92, tileH: 84, top: s.top + 98, height: s.height - 112, gap: 6, cx: gridScreen.cx - 14, memKey: "wardrobe:engineer" });
  } else {
    const side = profile.sidekick;
    const items = Object.keys(PET_TYPES).map(t => ({
      tag: "pettype:" + t, icon: (layer, x, y) => layer.add(scene.add.image(x, y - 8, "pet_" + (t === "dog" ? (side.type === "dog" ? side.color : "dog_brown") : (side.type === "robot" ? side.color : "robot_silver"))).setScale(1)),
      name: PET_TYPES[t], selected: side.type === t, sub: side.type === t ? "your sidekick" : "tap to switch", onTap: () => onPetType(t, s),
    }));
    const colorSlot = side.type === "dog" ? "dogcolor" : "robotcolor";
    for (const k of Object.keys(PET_ITEMS)) {
      const it = PET_ITEMS[k];
      if ((it.slot === "dogcolor" || it.slot === "robotcolor") && it.slot !== colorSlot) continue;
      const owned = profile.owned.pet.includes(k);
      const on = side.color === k || side.hat === k || side.acc === k;
      const locked = !owned && lvl < it.level;
      items.push({
        tag: "pet:" + k, icon: petIcon(scene, k, profile), name: it.name, selected: on, locked,
        sub: on ? "wearing" : owned ? "tap to use" : locked ? `Level ${it.level}` : it.price,
        onTap: () => onTapPet(k, s),
      });
    }
    scrollGrid(scene, s, items, { cols: 5, tileW: 92, tileH: 84, top: s.top + 98, height: s.height - 112, gap: 6, cx: gridScreen.cx - 14, memKey: "wardrobe:sidekick" });
  }
  return s;
}
