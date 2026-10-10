// src/scene/rewards.js
//
// Small celebrations: sticker toasts, "+coins" rewards with a level-up party,
// coins flying to the counter, and sparks where a wire connects.
//
// Gives city: sticker, giveReward, sparkAt.

function installRewards(city) {
  const { profile, refreshHud, save, scene, status } = city;
  // --- Stickers ---
  // A toast and a sound for each new sticker (it also pays coins).
  let stickerToasts = 0;
  function sticker(id) {
    if (!awardSticker(profile, id, new Date())) return;
    save();
    const y = 130 + (stickerToasts++ % 3) * 34;
    scene.time.delayedCall(250, () => {
      showToast(scene, 450, y + 60, `Sticker: ${STICKERS[id].name}! +${STICKER_COINS} coins`, "#a7f070");
      Sfx.play("gift");
      refreshHud();
    });
  }

  // --- Rewards ---
  // A "+coins" toast, and a party on level-up saying what it unlocked.
  function giveReward(reward, x, y) {
    if (!reward) return;
    Sfx.play("coin");
    const mult = reward.multiplier > 1 ? ` ×${reward.multiplier}` : "";
    const tx = Phaser.Math.Clamp(x, 90, 810), ty = Phaser.Math.Clamp(y, 170, 560);
    showToast(scene, tx, ty, `+${reward.coins} coins${mult}  +${reward.xp} XP`);
    flyCoins(tx, ty, reward.coins);
    refreshHud();
    if (reward.leveledUp) {
      scene.time.delayedCall(700, () => {
        const what = reward.unlocked.length ? `New: ${reward.unlocked.join(", ")}` : "Keep it up!";
        playCelebration(scene, what, `★  Level ${reward.level}!  ★`);
        Sfx.play("win");
        status.setText(`Level ${reward.level}! ${reward.unlocked.length ? `You unlocked: ${reward.unlocked.join(", ")}. Find them in + BUILD and PHONE → Shop.` : ""}`.trim());
      });
    }
  }

  // Coins fly up to the counter; sparks burst where a wire connects.
  function flyCoins(x, y, amount) {
    const n = Math.min(8, Math.max(1, Math.ceil((amount || 0) / 6)));
    for (let i = 0; i < n; i++) {
      const c = scene.add.image(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 16, "coin").setDepth(660).setScale(1.4);
      scene.tweens.add({
        targets: c, x: 808, y: 20, scale: 0.9, duration: 520 + i * 40, delay: i * 70, ease: "Cubic.In",
        onComplete: () => { c.destroy(); if (i === n - 1) { Sfx.play("blip"); scene.tweens.add({ targets: coinPulse, scale: { from: 1.5, to: 1 }, duration: 200 }); } },
      });
    }
  }
  const coinPulse = scene.add.image(808, 20, "coin").setDepth(201).setAlpha(0.01);
  function sparkAt(x, y) {
    const colors = [PALN["4"], PALN["C"], PALN["B"]];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4, d = 10 + Math.random() * 10;
      const p = scene.add.rectangle(x, y, 3, 3, colors[i % 3]).setDepth(24);
      scene.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 260, ease: "Quad.Out", onComplete: () => p.destroy() });
    }
  }

  Object.assign(city, { giveReward, sparkAt, sticker });
}
