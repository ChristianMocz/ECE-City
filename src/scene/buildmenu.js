// src/scene/buildmenu.js
//
// The + BUILD menu: picking a part, building or decoration to place next.
// In a campaign level it shows the level's toolbox instead of your own parts.
//
// Gives city: levelToolFor, openBuild, pickTool.
// Uses: src/ui/shop.js (showBuildMenu).

function installBuildmenu(city) {
  const { profile, scene, setToolLabel, state, status } = city;
  // Switch the tap mode, with an optional status message.
  function pickTool(mode, msg) {
    scene.events.emit("tool-switch", mode);
    setToolLabel();
    if (msg) status.setText(msg);
  }

  // The level's toolbox entry matching this part and its chosen value.
  function levelToolFor(kind) {
    if (!state.level) return null;
    const opt = kind === "RES" ? state.placeResOhms : kind === "CAP" ? state.placeCapUF : kind === "XFMR" ? state.placeXfmrRatio : null;
    return state.level.def.tool.find(t => t.kind === kind && (t.opt === null || t.opt === opt)) || null;
  }
  function openBuild() {
    showBuildMenu(scene, {
      profile, state,
      toolbox: state.context === "level" && state.level ? state.level.def.tool.map(t => ({ ...t, left: city.toolLeft(t) })) : null,
      onLocked: (name, level) => {
        Sfx.play("wrong");
        showToast(scene, 450, 90, level > 0 ? `${name} unlocks at level ${level}!` : `No ${name.toLowerCase()} left — buy more in PHONE → Shop`, "#ff9f9f");
        status.setText(level > 0 ? `${name} unlocks at level ${level}. Finish LEVELS and orders to earn XP!` : `You've placed every ${name.toLowerCase()} you own. Buy more in PHONE → Shop.`);
      },
      onPick: (chosen) => {
        const { kind, key } = chosen;
        if ((kind === "building" || kind === "decor") && state.context !== "town") {
          status.setText("Buildings and decorations go in your town. Go back to your town first.");
          return;
        }
        if (kind === "tool") {
          const t = chosen.tool;
          if (t.kind === "RES") state.placeResOhms = t.opt;
          if (t.kind === "CAP") state.placeCapUF = t.opt;
          if (t.kind === "XFMR") state.placeXfmrRatio = t.opt;
          const modes = { HOUSE: Mode.PLACE_HOUSE, LED: Mode.PLACE_LED, TRANS: Mode.PLACE_TRANS, SOLAR: Mode.PLACE_SOLAR, BAT: Mode.PLACE_BAT, RES: Mode.PLACE_RES, CAP: Mode.PLACE_CAP, XFMR: Mode.PLACE_XFR };
          pickTool(modes[t.kind], `Tap the grass to place the ${toolLabel(t).toLowerCase()} ($${PART_COST[t.kind] || 0}).`);
          return;
        }
        if (kind === "building") { state.placeBuilding = key; pickTool(Mode.PLACE_BUILDING, `Tap the grass to place the ${BUILDINGS[key].name.toLowerCase()}. ${BUILDINGS[key].need}`); return; }
        if (kind === "decor") { state.placeDecor = key; pickTool(Mode.PLACE_DECOR, `Tap the grass to place the ${DECOR[key].name.toLowerCase()}.`); return; }
        const pick = (title, choices, apply, mode, msg) => showChoiceOverlay(scene, { title, choices, onPick: (c) => { apply(c); pickTool(mode, msg()); } });
        if (key === "RES") {
          pick("Pick a resistor", state.RES_PRESETS.map(p => ({ label: `${p.label} (${p.ohms}Ω)`, sub: `${p.tip ? p.tip + " · " : ""}stripes: ${resistorBandNames(p.ohms)}`, ohms: p.ohms })),
            (c) => { state.placeResOhms = c.ohms; }, Mode.PLACE_RES, () => `Tap the grass to place a ${state.placeResOhms}Ω resistor.`);
        } else if (key === "CAP") {
          pick("Pick a capacitor", state.CAP_PRESETS.map(p => ({ label: `${p.label} (${p.uF}µF)`, uF: p.uF })),
            (c) => { state.placeCapUF = c.uF; }, Mode.PLACE_CAP, () => `Tap the grass to place a ${state.placeCapUF}µF capacitor.`);
        } else if (key === "XFMR") {
          pick("Pick a transformer", state.XFMR_PRESETS.map(p => ({ label: p.label, ratio: p.ratio })),
            (c) => { state.placeXfmrRatio = c.ratio; }, Mode.PLACE_XFR, () => "Tap the grass to place the transformer.");
        } else {
          const modes = { HOUSE: Mode.PLACE_HOUSE, LED: Mode.PLACE_LED, TRANS: Mode.PLACE_TRANS, SOLAR: Mode.PLACE_SOLAR, BAT: Mode.PLACE_BAT };
          pickTool(modes[key], `Tap the grass to place a ${PARTS[key].name.toLowerCase()}.`);
        }
      },
    });
  }

  Object.assign(city, { levelToolFor, openBuild, pickTool });
}
