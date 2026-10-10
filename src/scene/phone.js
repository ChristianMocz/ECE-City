// src/scene/phone.js
//
// The Engineer's phone and what its apps open: the Today board, the
// Notebook and Records. runApp() sends each app tap to the right screen.
//
// Gives city: openNotebook, openPhone, openRecords, openToday, runApp, todayCtx.
// Uses: src/ui/phone.js (screens), src/rules/progress.js (today list, notebook).

function installPhone(city) {
  const { profile, save, scene, state, status } = city;
  let phoneTab = "town"; // reopen on the last tab used
  function openPhone(tab = phoneTab) {
    phoneTab = tab;
    const apps = city.phoneApps();
    const tabNews = Object.fromEntries(PHONE_TABS.map(([t]) => [t, apps.some(a => a.tab === t && a.isNew)]));
    showPhone(scene, {
      apps, tab, tabNews,
      onTab: (t, s) => { s.close(); openPhone(t); },
      onApp: (key, s) => {
        if (featureIsNew(profile, key)) { markFeatureSeen(profile, key); save(); }
        s.close();
        city.refreshBadges();
        runApp(key);
      },
    });
  }
  function runApp(key) {
    switch (key) {
      case "shop": city.openShop(); break;
      case "orders": city.openOrders(); break;
      case "clothes": city.openWardrobe(); break;
      case "daily": city.openDaily(); break;
      case "map": city.openMap(); break;
      case "lines": city.openLines(); break;
      case "stickers": showStickers(scene, { profile }); break;
      case "notebook": openNotebook(); break;
      case "records": openRecords(); break;
      case "skip":
        if (state.context !== "town") { status.setText("Time only passes in your town."); break; }
        city.skipTime(); break;
      case "clear": scene.events.emit("clear-all-requested"); break;
      case "count": scene.events.emit("run-check"); break;
      case "maker": city.openMakerHome(); break;
      case "playcode": city.openCodeEntry(); break;
      case "settings": city.openSettings(); break;
      case "howto": showIntro(scene, {}); break;
      case "title": if (state.context === "town") city.saveTown(); save(); city.openTitle(); break;
    }
  }
  // --- Today board ---
  // What the Today list needs to know about the game right now.
  function todayCtx() {
    const now = new Date();
    const emergency = state.emergency;
    return {
      emergency: emergency ? { name: EMERGENCIES[emergency.plan.key].name, secondsLeft: Math.max(0, Math.ceil(emergency.timeLeft)) } : null,
      repair: !!profile.repair,
      ordersReady: profile.orders.filter(Boolean).length,
      giftWaiting: profile.daily.giftDay !== dayKey(now),
      puzzleDone: puzzleDoneToday(profile, now),
    };
  }
  function lightCounts() {
    let on = 0, dim = 0, off = 0;
    for (const n of state.nodes.values()) {
      if (n.type !== "HOUSE" && n.type !== "LED") continue;
      const l = state.powered.get(n.id)?.level ?? "OFF";
      if (l === "ON") on++; else if (l === "DIM") dim++; else off++;
    }
    return { on, dim, off };
  }
  function openToday() {
    const c = lightCounts();
    showToday(scene, {
      items: todayItems(profile, todayCtx()),
      townLine: state.context === "town" ? `Your town right now: ${c.on} bright, ${c.dim} dim, ${c.off} dark.` : "",
      onGo: (it, s) => {
        s.close();
        if (it.action === "level") { const lv = CAMPAIGN_BY_ID[it.level]; if (lv) showLevelCard(scene, { profile, level: lv, onPlay: (l, mode) => city.startLevel(l, mode), onBack: () => city.openLevels(lv.world) }); }
        else if (it.action === "captain") { city.openRegion(it.region); status.setText(`Captain Short Circuit is here. Tap "Fight the Captain!"`); }
        else if (it.action === "orders") city.openOrders();
        else if (it.action === "daily") city.openDaily();
        else if (it.action === "notebook") openNotebook();
        else if (it.action === "emergency" || it.action === "hint") scene.events.emit("hint-requested");
      },
    });
  }
  // --- Notebook and Records ---
  function openNotebook() {
    showNotebook(scene, { profile, onCard: (card, s) => { s.close(); showNotebookCard(scene, { card, onBack: openNotebook }); } });
    markCardsSeen(profile);
    save();
    city.refreshBadges();
  }
  function openRecords() {
    showRecords(scene, {
      profile,
      onLevel: (lv, s) => { s.close(); showLevelCard(scene, { profile, level: lv, onPlay: (l, mode) => city.startLevel(l, mode), onBack: openRecords }); },
    });
  }

  Object.assign(city, { openNotebook, openPhone, openRecords, openToday, runApp, todayCtx });
}
