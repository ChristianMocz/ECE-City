// src/scene/worldmap.js
//
// The world map: travel between regions (each keeps its own town), build
// power lines between towns, and open a region's levels or boss fight.
//
// Gives city: travel, openMap, openRegion, openLines.

function installWorldmap(city) {
  const { profile, save, scene, setBanner, setTitle, state, status } = city;
  // --- Travel ---
  function travel(key) {
    if (state.context === "town") city.saveTown();
    const r = travelTo(profile, key, Date.now());
    if (!r.ok) { Sfx.play("wrong"); status.setText(r.why); return false; }
    state.context = "travelling"; // the old town is saved; don't save it again under the new name
    setRegionScenery(scene, key);
    setTitle(REGIONS[key].name);
    city.enterContext("town", city.regionTown(key));
    setBanner(null);
    city.seenOrders.clear();
    save();
    city.refreshBadges();
    Sfx.play("win");
    const who = REGIONS[key].characters[0];
    status.setText(`Welcome to ${REGIONS[key].name}! ${who.name}: "${who.line}"`);
    if (r.first && key !== "sparkville") city.sticker("explorer");
    if (profile.visited.length >= 6) city.sticker("world_tour");
    if (key === "moon") city.sticker("moonwalker");
    city.arrivedAt = scene.time.now;
    return true;
  }

  function openMap() {
    showMap(scene, {
      profile,
      onRegion: (key, s) => { s.close(); openRegion(key); },
      onLines: (s) => { s.close(); openLines(); },
    });
  }
  // --- Power lines ---
  // Lines between towns (rules in src/rules/plants.js).
  function openLines() {
    showLines(scene, {
      profile,
      onBack: (s) => { s.close(); openMap(); },
      onPick: (a, b, s) => {
        s.close();
        showLineBuilder(scene, {
          profile, a, b,
          onBuild: (ratio, sc) => {
            const r = buildLine(profile, a, b, ratio);
            if (!r.ok) { city.cantBuy(r.why); return; }
            Sfx.play("coin");
            save();
            city.sticker("line_worker");
            sc.close();
            city.refreshPower();
            state.dirty = true;
            const loss = lineLossPercent(ratio);
            status.setText(`Power line built between ${REGIONS[a].name} and ${REGIONS[b].name}: the towns now share their power plants! ${loss > 30 ? `But ${loss}% of the power is lost as heat on the way — transformers would fix that.` : `Only ${loss}% is lost on the way, thanks to the transformers.`}`);
            openLines();
          },
        });
      },
    });
  }
  function openRegion(key) {
    showRegion(scene, {
      profile, key,
      onLevels: (k, s) => { s.close(); city.openLevels(k); },
      onTravel: (k, s) => {
        if (profile.region === k && state.context === "town") { s.close(); status.setText(`You're already in ${REGIONS[k].name}.`); return; }
        const regionInfo = regionStatus(profile, k);
        if (!regionInfo.ok && regionInfo.needsBoss && levelForXp(profile.xp) >= REGIONS[k].level) { s.close(); openRegion(regionInfo.needsBoss); status.setText(`Captain Short Circuit is here in ${REGIONS[regionInfo.needsBoss].name}. Beat him to open ${REGIONS[k].name}!`); return; }
        if (!regionInfo.ok) { city.cantBuy(regionInfo.why); return; }
        s.close();
        if (profile.region === k) { city.backToTown(); return; }
        travel(k);
      },
      onBoss: (k, s) => {
        const bossInfo = bossStatus(profile, k);
        if (!bossInfo.ok) { city.cantBuy(bossInfo.why); return; }
        s.close();
        city.pickDifficulty(k);
      },
      onBack: (s) => { s.close(); openMap(); },
      onFindCaptain: (k, s) => { s.close(); openRegion(k); status.setText(`Captain Short Circuit is here in ${REGIONS[k].name}. Tap "Fight the Captain!" to take him on.`); },
    });
  }

  Object.assign(city, { openLines, openMap, openRegion, travel });
}
