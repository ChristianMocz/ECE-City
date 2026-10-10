// src/scene/menus.js
//
// Opens the game's menus and handles what you pick in them: SHOP, power
// plants, CLOTHES (and the pet), ORDERS, DAILY and its gift chest, and
// the training mission list.
//
// Gives city: cantBuy, openDaily, openGiftScreen, openMissions, openOrders,
// openPlantCard, openShop, openWardrobe.
// Uses: src/ui/shop.js, src/ui/popups.js, src/rules/game.js (buying).

function installMenus(city) {
  const { profile, save, scene, state, status } = city;
  // "Can't do that" buzz and red toast.
  function cantBuy(why) {
    Sfx.play("wrong");
    showToast(scene, 450, 90, why, "#ff9f9f");
  }

  function openShop(tab = "building") {
    showShop(scene, {
      profile, tab, region: profile.region,
      onPlant: (key, s) => { s.close(); openPlantCard(key); },
      onBuy: (kind, key, s) => {
        const r = buy(profile, kind, key);
        if (!r.ok) { cantBuy(r.why); return; }
        Sfx.play("coin");
        save();
        city.refreshBadges();
        s.close();
        const item = catalogueItem(kind, key);
        if (kind === "building") city.sticker("town_builder");
        if (state.context !== "town") { status.setText(`You bought a ${item.name.toLowerCase()}! It's waiting in + BUILD back in your town.`); return; }
        if (kind === "building") { state.placeBuilding = key; city.pickTool(Mode.PLACE_BUILDING, `You bought a ${item.name.toLowerCase()}! Tap the grass to place it. ${BUILDINGS[key].need}`); }
        else { state.placeDecor = key; city.pickTool(Mode.PLACE_DECOR, `You bought a ${item.name.toLowerCase()}! Tap the grass to place it.`); }
      },
    });
  }

  function openPlantCard(key) {
    const region = profile.region;
    showPlantCard(scene, {
      profile, key, region,
      status: plantOwned(profile, key) ? plantStatusText(key, city.plantEnvFor(region)) : null,
      onBuy: (k, s) => {
        const r = buyPlant(profile, k, region);
        if (!r.ok) { cantBuy(r.why); return; }
        Sfx.play("coin");
        city.arrivedAt = scene.time.now;
        save(); city.refreshBadges();
        city.sticker("power_tycoon");
        s.close();
        city.applyEnvironment(true); city.refreshPower();
        status.setText(`You built a ${PLANTS[k].name.toLowerCase()} in ${REGIONS[region].name}! ${PLANTS[k].good} (Catch: ${PLANTS[k].catchText})`);
      },
      onUse: (k, s) => {
        if (plantOf(profile, region) === k) { s.close(); return; }
        usePlant(profile, k, region);
        city.arrivedAt = scene.time.now;
        save();
        s.close();
        city.applyEnvironment(true); city.refreshPower();
        status.setText(`${REGIONS[region].name} now runs on the ${PLANTS[k].name.toLowerCase()}.`);
      },
    });
  }

  function openWardrobe(tab = "engineer") {
    const reopen = (s, t = tab) => { save(); city.refreshBadges(); s.close(); openWardrobe(t); };
    showWardrobe(scene, {
      profile, tab,
      onTab: (t, s) => reopen(s, t),
      onTapItem: (key, s) => {
        if (profile.owned.outfits.includes(key)) {
          toggleWear(profile, key);
        } else {
          const r = buy(profile, "outfit", key);
          if (!r.ok) { cantBuy(r.why); return; }
          Sfx.play("coin");
          city.sticker("dressed_up");
        }
        reopen(s);
      },
      onPetType: (type, s) => { setSidekickType(profile, type); reopen(s); },
      onTapPet: (key, s) => {
        if (profile.owned.pet.includes(key)) {
          togglePetItem(profile, key);
        } else {
          const r = buy(profile, "pet", key);
          if (!r.ok) { cantBuy(r.why); return; }
          Sfx.play("coin");
          city.sticker("dressed_up");
        }
        reopen(s);
      },
    });
  }

  function openOrders() {
    showOrders(scene, {
      profile, state, now: Date.now(),
      onSkip: (i) => { skipOrder(profile, i, Date.now()); save(); },
    });
    if (state.context !== "town") status.setText("Orders are for your town — they only count when you're back home.");
  }

  function openGiftScreen() {
    showGift(scene, {
      onOpen: () => {
        const r = openGift(profile, new Date());
        if (r) {
          Sfx.play("gift");
          save();
          city.refreshBadges();
          status.setText(r.type === "coins" ? `Daily gift: +${r.coins} coins!` : `Daily gift: a ${r.name.toLowerCase()}! Find it in + BUILD.`);
        }
        return r;
      },
    });
  }

  function openDaily() {
    const now = new Date();
    showDaily(scene, {
      profile, now,
      weather: city.currentWeather(),
      puzzle: DAILY_PUZZLES[city.todaysPuzzleIndex()],
      puzzleDone: puzzleDoneToday(profile, now),
      giftWaiting: profile.daily.giftDay !== dayKey(now),
      inDaily: state.context === "daily",
      onGift: openGiftScreen,
      onPlay: () => city.startDaily(),
      onBack: city.backToTown,
    });
  }

  function openMissions() {
    const lvl = levelForXp(profile.xp);
    const choices = MISSIONS.map((m, i) => {
      const need = MISSION_LEVELS[i] ?? 1;
      return lvl < need
        ? { label: `${i + 1}. ${m.title}`, sub: `Unlocks at level ${need}`, index: i, locked: need }
        : { label: `${city.missionsDone.has(i) ? "✓ " : ""}${i + 1}. ${m.title}`, sub: m.goal, index: i };
    });
    if (state.context !== "town") choices.push({ label: "Back to my town", sub: "Your town is just as you left it", index: -1 });
    showChoiceOverlay(scene, {
      title: "Pick a mission",
      choices,
      onPick: (c) => {
        if (c.index < 0) { city.backToTown(); return; }
        if (c.locked) {
          Sfx.play("wrong");
          status.setText(`Mission ${c.index + 1} unlocks at level ${c.locked}. Finish power orders to earn XP!`);
          return;
        }
        city.startMission(c.index);
      },
    });
  }

  Object.assign(city, { cantBuy, openDaily, openGiftScreen, openMissions, openOrders, openPlantCard, openShop, openWardrobe });
}
