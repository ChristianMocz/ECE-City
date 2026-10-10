// src/scene/boss.js
//
// Blackout boss fights. Captain Short Circuit blacks out the town and breaks
// a big circuit; fix every light before the clock runs out. Each right guess
// when Sparky asks zaps him for extra time and coins. The clock pauses while
// a question or menu is open.
//
// Gives city: pickDifficulty, startBoss, checkBoss, bossTick, zapCaptain, endBossVisuals.

function installBoss(city) {
  const { profile, save, scene, setBanner, state, status } = city;
  // --- Boss fight ---
  let bossVisuals = null;

  function pickDifficulty(region) {
    showChoiceOverlay(scene, {
      title: "How tough a fight?",
      choices: DIFFICULTY_KEYS.map(d => {
        const D = DIFFICULTIES[d], won = !!profile.bossWins?.[region]?.[d];
        return { label: `${won ? "★ " : ""}${D.name}`, sub: `${D.breaks} things broken · ${Math.floor(D.seconds / 60)}:${String(D.seconds % 60).padStart(2, "0")} · ${D.coins} coins${D.hints ? "" : " · no hints!"}`, d };
      }),
      onPick: (c) => startBoss(region, c.d),
    });
  }

  function startBoss(region, difficulty, seed) {
    const boss = BOSSES[region], D = DIFFICULTIES[difficulty];
    if (!boss || !D) return;
    // Pick the breaks. Every combination is tested to start broken; the
    // retry is just a safety check against the real board.
    const rng = Number.isFinite(seed) ? seededRandom(seed) : Math.random;
    let breaks = pickBreaks(boss, D.breaks, rng);
    if (region !== profile.region) {
      setRegionScenery(scene, region); // fight in that region's scenery
    }
    for (let tries = 0; tries < 10; tries++) {
      city.enterContext("boss", applyBreaks(boss.board, breaks));
      if (!bossFixed(state)) break;
      breaks = pickBreaks(boss, D.breaks, Math.random);
    }
    state.boss = { region, difficulty, breaks, timeLeft: D.seconds, zaps: 0, done: false, won: false, tauntIn: 6 };
    city.lastAskAt = -Infinity;
    city.applyNight();
    // The Captain himself, a clock, and a zap counter.
    const cx = 858, cy = 236;
    const captain = scene.add.image(cx, cy, "captain").setDepth(30);
    const bob = scene.tweens.add({ targets: captain, y: cy - 8, yoyo: true, repeat: -1, duration: 700, ease: "Sine.InOut" });
    const clock = scene.add.text(cx, cy + 62, "", { fontFamily: GAME_FONT, fontSize: "22px", color: "#ffcd75", fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 5 }).setOrigin(0.5).setDepth(31);
    const zapText = scene.add.text(cx, cy + 86, "", { fontFamily: GAME_FONT, fontSize: "12px", color: "#73eff7", fontStyle: "bold", stroke: "#1a1c2c", strokeThickness: 4 }).setOrigin(0.5).setDepth(31);
    bossVisuals = { captain, bob, clock, zapText, bubble: null };
    updateBossHud();
    setBanner(`⚡ BLACKOUT! ${boss.title} (${D.name}): light every building and LED!`);
    status.setText(`Captain Short Circuit: "${boss.taunts[0]}" Fix ${D.breaks} broken things before time runs out. Guess right when Sparky asks to ZAP him!`);
    Sfx.play("thunder");
    taunt(boss.taunts[0]);
  }

  function updateBossHud() {
    const boss = state.boss;
    if (!boss || !bossVisuals) return;
    const t = Math.max(0, Math.ceil(boss.timeLeft));
    bossVisuals.clock.setText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`).setColor(t <= 20 ? "#ef7d57" : "#ffcd75");
    bossVisuals.zapText.setText(`Zaps: ${boss.zaps}/${MAX_ZAPS}`);
  }

  function taunt(text) {
    if (!bossVisuals) return;
    if (bossVisuals.bubble) bossVisuals.bubble.destroy();
    bossVisuals.bubble = makeBubble(scene, 760, 168, text, 170, 302);
    const bub = bossVisuals.bubble;
    scene.time.delayedCall(3500, () => { if (bub.active) bub.destroy(); });
  }

  function endBossVisuals() {
    if (!bossVisuals) return;
    const looks = bossVisuals;
    bossVisuals = null;
    looks.bob.stop();
    for (const o of [looks.captain, looks.clock, looks.zapText, looks.bubble]) if (o && o.active) o.destroy();
  }

  function zapCaptain() {
    const boss = state.boss;
    if (!boss || boss.done || !bossVisuals) return;
    if (boss.zaps >= MAX_ZAPS) { status.setText(`${status.text} (Captain Short Circuit is already zapped ${MAX_ZAPS} times — now fix those lights!)`); return; }
    boss.zaps++;
    boss.timeLeft += ZAP_SECONDS;
    profile.zaps += 1;
    const looks = bossVisuals;
    const bolt = scene.add.image(843, 60, "zap").setDepth(460).setScale(1.5);
    scene.tweens.add({ targets: bolt, x: looks.captain.x, y: looks.captain.y, duration: 350, ease: "Quad.In", onComplete: () => {
      bolt.destroy();
      if (!looks.captain.active) return;
      looks.captain.setTintFill(0xffffff);
      scene.time.delayedCall(120, () => { if (looks.captain.active) looks.captain.clearTint(); });
      scene.tweens.add({ targets: looks.captain, x: looks.captain.x + 6, yoyo: true, repeat: 3, duration: 50 });
    } });
    Sfx.play("pop");
    showToast(scene, looks.captain.x - 20, looks.captain.y - 40, `ZAP! +${ZAP_SECONDS}s`, "#73eff7");
    taunt(["Ow! That tickles!", "Hey! Stop zapping me!", "Grrr... lucky guess!", "Bzzzt! No fair!", "Okay, okay, you're good at this!"][boss.zaps - 1] || "Bzzzt!");
    updateBossHud();
  }

  function checkBoss() {
    const boss = state.boss;
    if (!boss || boss.done || state.context !== "boss") return;
    if (!bossFixed(state)) return;
    boss.done = true; boss.won = true;
    const reward = bossReward(profile, boss.region, boss.difficulty, boss.zaps);
    const r = addReward(profile, reward.coins, reward.xp);
    save();
    city.applyNight(); // lights back on: the blackout is over
    city.clearHelper();
    if (bossVisuals) {
      const looks = bossVisuals;
      looks.bob.stop();
      taunt("Nooo! My beautiful blackout! I'll be back!");
      scene.tweens.add({ targets: looks.captain, x: 980, y: 80, angle: 30, duration: 1400, delay: 600, ease: "Quad.In" });
    }
    playCelebration(scene, "Captain Short Circuit ran away!", "★  Blackout fixed!  ★");
    Sfx.play("win");
    scene.time.delayedCall(900, () => city.giveReward(r, 450, 420));
    city.sticker("breaker_fixer");
    if (boss.difficulty === "extreme") city.sticker("extreme_hero");
    const D = DIFFICULTIES[boss.difficulty];
    const t = Math.ceil(boss.timeLeft);
    setBanner(`★ Blackout fixed! ${BOSSES[boss.region].title} (${D.name})`);
    const winMsg = `You beat Captain Short Circuit with ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} to spare! +${reward.coins} coins, +${reward.xp} XP.`;
    status.setText(winMsg);
    scene.time.delayedCall(0, () => status.setText(winMsg)); // the tap that won sets its own message first
    const next = REGION_KEYS[REGION_KEYS.indexOf(boss.region) + 1];
    scene.time.delayedCall(2600, () => {
      if (state.boss !== boss) return;
      showBossResult(scene, {
        won: true, title: "Blackout fixed!",
        lines: [
          `${D.name} — ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} left`,
          `Zaps: ${boss.zaps}  (+${Math.min(boss.zaps, MAX_ZAPS) * ZAP_COINS} coins)`,
          `Reward: +${reward.coins} coins, +${reward.xp} XP${reward.first ? "" : " (repeat win)"}`,
          next ? (regionStatus(profile, next).ok ? `${REGIONS[next].name} is open on the world map (PHONE → World)!` : `Next: ${REGIONS[next].name} (level ${REGIONS[next].level})`) : "You've saved every region!",
        ],
        onAgain: () => startBoss(boss.region, boss.difficulty),
        onHome: () => city.backToTown(),
      });
    });
    city.refreshBadges();
  }

  function bossTick(dt) {
    const boss = state.boss;
    if (!boss || boss.done || state.context !== "boss") return;
    if (city.anyScreenOpen()) return; // the clock waits while you think
    boss.timeLeft -= dt;
    boss.tauntIn -= dt;
    if (boss.tauntIn <= 0) { boss.tauntIn = 20; const T = BOSSES[boss.region].taunts; taunt(T[Math.floor(Math.random() * T.length)]); }
    updateBossHud();
    if (boss.timeLeft > 0) return;
    boss.timeLeft = 0; boss.done = true; boss.won = false;
    updateBossHud();
    Sfx.play("wrong");
    taunt("Mwahaha! Time's up — the town stays dark!");
    status.setText("Out of time! Captain Short Circuit got away. Try again — you can do it!");
    scene.time.delayedCall(1200, () => {
      if (state.boss !== boss) return;
      showBossResult(scene, {
        won: false, title: "Out of time!",
        lines: ["Captain Short Circuit got away this time.", `Zaps: ${boss.zaps}`, "Tip: tap a dark building to see what's wrong, and use ? HINT."],
        onAgain: () => startBoss(boss.region, boss.difficulty),
        onHome: () => city.backToTown(),
      });
    });
  }

  Object.assign(city, { bossTick, checkBoss, endBossVisuals, pickDifficulty, startBoss, zapCaptain });
}
