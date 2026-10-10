// src/scene/training.js
//
// Training missions and the daily puzzle. Starts each one on its own board,
// checks after every change whether it is solved, then pays the reward and
// shows the win message.
//
// Gives city: startMission, checkMission, startDaily, checkDaily, todaysPuzzleIndex.
// Uses: src/rules/missions.js, src/rules/daily.js.

function installTraining(city) {
  const { profile, save, scene, setBanner, state, status } = city;

  // --- Training missions ---
  function startMission(index) {
    const def = MISSIONS[index];
    city.enterContext("mission", def.setup);
    state.mission = { index, done: false, sawOff: false, cycled: false };
    setBanner(`★ Mission ${index + 1}/${MISSIONS.length}: ${def.goal}`);
    status.setText(`Mission ${index + 1}: ${def.goal}  Stuck? Tap ? HINT.`);
    checkMission();
  }

  function checkMission() {
    const mission = state.mission;
    if (!mission || mission.done || state.context !== "mission") return;
    const def = MISSIONS[mission.index];
    const genCurrent = state.solverError ? Infinity : genAmps(state);
    let won = false;
    try { won = !!def.check(state, { genCurrent, switchCycled: mission.cycled }); } catch (e) { won = false; }
    if (!won) return;
    mission.done = true;
    const firstTime = !city.missionsDone.has(mission.index);
    city.missionsDone.add(mission.index);
    city.saveMissionProgress();
    city.clearHelper();
    playCelebration(scene, def.title);
    Sfx.play("win");
    let pay = "";
    if (firstTime) {
      const reward = addReward(profile, city.MISSION_REWARD.coins, city.MISSION_REWARD.xp);
      save();
      scene.time.delayedCall(900, () => city.giveReward(reward, 450, 420));
      pay = ` +${city.MISSION_REWARD.coins} coins!`;
    }
    const next = mission.index + 1 < MISSIONS.length ? " Tap LEVELS → Training for the next one!" : " That was the last one — you finished them all!";
    const titled = /[!?.]$/.test(def.title) ? def.title : def.title + "!";
    setBanner(`★ Mission ${mission.index + 1} complete: ${titled}${next}`);
    // The winning action sets its own status right after this, so post the
    // win message again next frame.
    const winMsg = `You did it! ${def.title} — complete.${pay}${next}`;
    status.setText(winMsg);
    scene.time.delayedCall(0, () => status.setText(winMsg));
  }

  // --- Daily puzzle ---
  // Same puzzle for everyone today (src/rules/daily.js); solving it keeps the streak.
  function todaysPuzzleIndex() { return puzzleIndexFor(new Date(), DAILY_PUZZLES.length); }

  // forceIndex lets tests play any puzzle, not just today's.
  function startDaily(forceIndex) {
    const index = Number.isInteger(forceIndex) && DAILY_PUZZLES[forceIndex] ? forceIndex : todaysPuzzleIndex();
    const puzzle = DAILY_PUZZLES[index];
    city.enterContext("daily", puzzle.setup);
    state.daily = { index, done: false };
    setBanner(`☀ Daily puzzle: ${puzzle.goal}`);
    status.setText(`Today's puzzle: ${puzzle.title}. ${puzzle.goal}  Stuck? Tap ? HINT.`);
    checkDaily();
  }

  function checkDaily() {
    const d = state.daily;
    if (!d || d.done || state.context !== "daily") return;
    const puzzle = DAILY_PUZZLES[d.index];
    let solved = false;
    try { solved = !!puzzle.check(state); } catch (e) { solved = false; }
    if (!solved) return;
    d.done = true;
    city.clearHelper();
    const r = completeDailyPuzzle(profile, new Date());
    let msg;
    if (r) {
      const reward = addReward(profile, r.coins, r.xp);
      save();
      playCelebration(scene, `${puzzle.title} — ${r.streak}-day streak!`, "★  Puzzle solved!  ★");
      scene.time.delayedCall(900, () => city.giveReward(reward, 450, 420));
      city.sticker("puzzle_pro");
      msg = `You solved today's puzzle! +${r.coins} coins. Puzzle streak: ${r.streak} day${r.streak === 1 ? "" : "s"}. Come back tomorrow for a new one!`;
    } else {
      playCelebration(scene, puzzle.title, "★  Solved again!  ★");
      msg = "Solved again — nice! (Today's reward was already collected.) Come back tomorrow for a new puzzle.";
    }
    Sfx.play("win");
    city.refreshBadges();
    setBanner(`☀ Puzzle solved! PHONE → Daily → "Back to my town".`);
    status.setText(msg);
    scene.time.delayedCall(0, () => status.setText(msg));
  }

  Object.assign(city, { checkDaily, checkMission, startDaily, startMission, todaysPuzzleIndex });
}
