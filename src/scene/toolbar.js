// src/scene/toolbar.js
//
// The toolbar: which buttons show, the badges on them, the phone's app list,
// and the "New!" message when a phone app unlocks.
//
// Gives city: phoneApps, refreshBadges.
// Uses: src/rules/progress.js (features, toolbarFor, todayItems).

function installToolbar(city) {
  const { profile, refreshHud, save, scene, setToolbar, state, status } = city;
  // Buttons the current board needs, whatever the player has unlocked.
  function toolbarNeeds() {
    if (state.context === "level" && state.level) return levelNeeds(state.level.def);
    if (state.context === "town") return {};
    return { delete: true, build: true, undo: true }; // boss, mission, daily, puzzle maker
  }
  function phoneApps() {
    const now = new Date();
    const ordersReady = profile.orders.filter(Boolean).length;
    const giftWaiting = profile.daily.giftDay !== dayKey(now), puzzleOpen = !puzzleDoneToday(profile, now);
    const freshCards = notebookCards(profile).filter(c => !(profile.seenCards || []).includes(c.key)).length;
    const cap = nextCaptain(profile);
    const extra = {
      daily: { sub: giftWaiting ? "gift waiting!" : puzzleOpen ? "puzzle to solve" : "done today ✓", badge: giftWaiting || puzzleOpen },
      map: { sub: cap?.ready ? "the Captain waits!" : REGIONS[profile.region].name, badge: !!cap?.ready || REGION_KEYS.some(k => regionStatus(profile, k).ok && !profile.visited.includes(k)) },
      notebook: { sub: `${notebookCards(profile).length}/${NOTEBOOK.length} cards`, badge: freshCards || false },
      records: { sub: `${gameProgress(profile).percent}% done` },
      shop: { sub: `${profile.coins} coins` },
      skip: { sub: state.context === "town" ? (state.night ? "to morning" : "to night") : "in town only" },
      maker: { sub: `${(profile.myPuzzles || []).length} made` },
      stickers: { sub: `${Object.keys(profile.stickers).length}/${Object.keys(STICKERS).length}` },
    };
    return FEATURE_KEYS.filter(k => FEATURES[k].where === "phone" && featureUnlocked(profile, k)).map(k => ({
      key: k, name: FEATURES[k].name, icon: FEATURES[k].icon, tab: FEATURES[k].tab, isNew: featureIsNew(profile, k), ...(extra[k] || {}),
    }));
  }
  function refreshBadges() {
    const now = new Date();
    const vis = toolbarFor(profile, { needs: toolbarNeeds() });
    if (state.level && state.level.mode === "noundo" && !state.level.done) { vis.undo = false; vis.redo = false; vis.hint = false; }
    setToolbar(vis);
    const apps = phoneApps();
    const todayCount = todayItems(profile, city.todayCtx()).filter(i => i.action && i.urgent).length;
    refreshHud({
      levels: (() => { const lv = nextLevelIn(profile, profile.region); return !!lv && levelUnlocked(profile, lv).ok; })(),
      today: todayCount || profile.orders.filter(Boolean).length || false, // urgent things first, else waiting orders
      phone: apps.some(a => a.isNew || a.badge),
    });
    // Announce new unlocks once, only in town with nothing open, so the
    // message isn't hidden under a "Level complete" screen.
    if (state.context !== "town" || city.anyScreenOpen() || state.paused) return;
    const fresh = newlyUnlocked(profile).filter(k => FEATURES[k].say);
    if (fresh.length) {
      save();
      // One unlock explains itself; several at once share one message.
      const names = fresh.map(k => FEATURES[k].name);
      const msg = fresh.length === 1 ? `New! ${FEATURES[fresh[0]].say}` : `New: ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}! Look for the New! tags.`;
      scene.time.delayedCall(400, () => {
        showToast(scene, 450, 215, fresh.length === 1 ? `New: ${names[0]}!` : "New things to try!", "#a7f070");
        status.setText(msg);
        Sfx.play("gift");
      });
    }
  }
  Object.assign(city, { phoneApps, refreshBadges });
}
