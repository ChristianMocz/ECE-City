// src/rules/levels.js
//
// The 132 hand-made campaign levels: ten per world plus one Expert level each.
// Each world teaches one idea in small steps; its last levels mix everything.
// The shorthand and win checks are explained in src/rules/campaign.js.
// tests/campaign.test.mjs replays every `sol` to prove each level works.
//
// Main pieces: L({...}) calls, one per level.

// --- Sparkville ---
L({ world: "sparkville", title: "First loop", teach: "Power needs a loop: out of GEN, through the house, and back home to GND.",
  goal: "Light house H0.", hint: "Tap GEN's dot, then H0's orange dot. Then H0's blue dot, then GND's dot.",
  parts: "H0@450,260", win: { lit: ["H0"] }, sol: "w GEN H0; w H0b GND" });
L({ world: "sparkville", title: "The way home", teach: "Power that can't get home doesn't flow at all.",
  goal: "H0 has power coming in, but it's still dark. Fix it!", hint: "Power has no way home. Wire H0's BLUE dot to GND.",
  parts: "H0@450,260", wires: "GEN-H0", win: { lit: ["H0"] }, sol: "w H0b GND" });
L({ world: "sparkville", title: "Two houses", teach: "Every house needs its own complete loop.",
  goal: "Light both houses.", hint: "Give each house its own loop: orange dot to GEN, blue dot to GND.",
  parts: "H0@400,260 H1@640,260", win: { lit: ["H0", "H1"] }, sol: "w GEN H0; w H0b GND; w GEN H1; w H1b GND" });
L({ world: "sparkville", title: "Share the way home", teach: "Dots that are wired together are the same place for electricity — so houses can share wires.",
  goal: "Light both houses — but copper is tight!", hint: "Wire H1's orange dot to H0's orange dot, and H1's blue dot to H0's blue dot. Then they share H0's wires to GEN and GND.",
  parts: "H0@400,260 H1@620,260", hard: true, win: { lit: ["H0", "H1"] }, sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b" });
L({ world: "sparkville", title: "Too many houses", teach: "One little generator can only light so many houses. Too many, and they all go dim.",
  goal: "All five houses are dim. Make H0, H1 and H2 bright.", hint: "Unplug the two houses that don't matter (H3 and H4): DELETE their wires to GEN.",
  parts: "H0@330,260 H1@480,260 H2@630,260 H3@420,450 H4@620,450",
  wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND GEN-H2 H2b-GND GEN-H3 H3b-GND GEN-H4 H4b-GND",
  win: { lit: ["H0", "H1", "H2"] }, sol: "u GEN H3; u GEN H4" });
L({ world: "sparkville", title: "Sneaky shortcut", teach: "A wire straight across a house is a shortcut: the power skips the house and races home.",
  goal: "Both houses are dark. Find the shortcut and remove it!", hint: "One wire joins a house's orange dot straight to its own blue dot. DELETE it.",
  parts: "H0@400,260 H1@640,260", wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND H1-H1b",
  win: { lit: ["H0", "H1"] }, sol: "u H1 H1b" });
L({ world: "sparkville", title: "In the way", teach: "A resistor slows electricity down. A big one in front of a house leaves it too little.",
  goal: "The big resistor is starving H0. Light it up!", hint: "Give H0 a path to GEN that doesn't go through the resistor.",
  parts: "R0@320,430:1000 H0@560,260", wires: "GEN-R0 R0b-H0 H0b-GND",
  win: { lit: ["H0"] }, sol: "w GEN H0" });
L({ world: "sparkville", title: "Resistor buddy", teach: "An LED needs a resistor in front of it, or too much current pops it.",
  goal: "Make LED L0 shine — without popping it.", hint: "Place the resistor, then wire GEN → resistor → L0's orange dot, and L0's blue dot → GND.",
  parts: "L0@560,440", tool: "RES:470", win: { lit: ["L0"] }, sol: "p RES 400 430 470; w GEN R0; w R0b L0; w L0b GND" });
L({ world: "sparkville", title: "Pick the right one", teach: "Small lets too much through (pop!), Large lets too little (dim). Medium is just right.",
  goal: "Make L0 shine brightly. Only one resistor will do!", hint: "Small (100Ω) pops it, Large (1000Ω) makes it dim. Use Medium (470Ω).",
  parts: "L0@600,440", tool: "RES:100 RES:470 RES:1000", win: { lit: ["L0"] }, sol: "p RES 420 430 470; w GEN R0; w R0b L0; w L0b GND" });
L({ world: "sparkville", title: "Light switch", teach: "A switch in a house's loop opens and closes the loop: off, and the power can't get round.",
  goal: "Wire it so switch T0 turns H1 on and off — and H0 stays on either way.", hint: "Put the switch in H1's loop only: GEN → T0 → H1 → GND. Give H0 its own loop.",
  parts: "H0@340,260 T0@500,470 H1@650,260",
  win: { truth: { switches: ["T0"], want: { "1": { H0: 1, H1: 1 }, "0": { H0: 1, H1: 0 } } } },
  sol: "w GEN H0; w H0b GND; w GEN T0; w T0b H1; w H1b GND" });

// --- Battery Bay ---
L({ world: "batterybay", title: "Fill it up", teach: "A capacitor is a little bucket for electricity. Wire it to GEN and GND and watch it fill.",
  goal: "Charge capacitor C0 to at least 10 volts.", hint: "Wire GEN → C0's orange dot, and C0's blue dot → GND. Then wait a few seconds.",
  parts: "C0@450,460:220:0", win: { capAtLeast: { C0: 10 } }, sol: "w GEN C0; w C0b GND; t 8" });
L({ world: "batterybay", title: "No generator needed", teach: "A charged capacitor can run a house all by itself — until it empties.",
  goal: "Light H0 using only the charged capacitor (no generator).", hint: "Make a loop: C0's orange dot → H0's orange dot, H0's blue dot → C0's blue dot.",
  parts: "C0@330,460:1000:12 H0@600,260", win: { lit: ["H0"], noGen: true }, sol: "w C0 H0; w H0b C0b" });
L({ world: "batterybay", title: "Battery to the rescue", env: { genScale: 0 }, teach: "A battery is a big, slow capacitor: it stores lots of power for a long time.",
  goal: "The generator is broken! Light H0 with the battery.", hint: "Loop: B0's orange dot → H0 → back to B0's blue dot.",
  parts: "B0@350,470:12 H0@600,260", win: { lit: ["H0"] }, sol: "w B0 H0; w H0b B0b" });
L({ world: "batterybay", title: "Fill the battery", teach: "Batteries fill slowly. Keep them wired to the generator.",
  goal: "Charge battery B0 to at least 9 volts.", hint: "Wire GEN → B0 and B0's blue dot → GND, then wait.",
  parts: "B0@450,470:6", win: { capAtLeast: { B0: 9 } }, sol: "w GEN B0; w B0b GND; t 30" });
L({ world: "batterybay", title: "Charge, then unplug", teach: "Charge first, use later: that's how a harbour keeps its lights on.",
  goal: "Light H0 from the battery with the generator unplugged.", hint: "Charge B0 from GEN first (it's only part full). Wire B0 to H0. Then DELETE the wire from GEN.",
  parts: "B0@330,470:8 H0@600,260", win: { lit: ["H0"], noGen: true }, sol: "w GEN B0; w B0b GND; t 25; w B0 H0; w H0b GND; u GEN B0" });
L({ world: "batterybay", title: "Capacitor in the way", teach: "A full capacitor won't let steady power through — it stores, it doesn't pass.",
  goal: "The full capacitor is blocking H0. Light it for good!", hint: "Give H0 a path to GEN that doesn't go through C0.",
  parts: "C0@360,460:220:12 H0@600,260", wires: "GEN-C0 C0b-H0 H0b-GND",
  win: { lit: ["H0"], lastSeconds: { ids: ["H0"], seconds: 5 } }, sol: "w GEN H0; t 1" });
L({ world: "batterybay", title: "Night shift", env: { night: true }, teach: "At night every house needs more power. A battery next to the generator helps it keep up.",
  goal: "It's night: light all three houses.", hint: "On its own the generator can't keep three houses bright at night. Wire the charged battery to GEN and GND too.",
  parts: "H0@330,260 H1@500,260 H2@670,260 B0@500,470:12",
  win: { lit: ["H0", "H1", "H2"], lastSeconds: { ids: ["H0", "H1", "H2"], seconds: 10 } },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w GEN B0; w B0b GND" });
L({ world: "batterybay", title: "Big bucket, small bucket", teach: "A bigger capacitor (more µF) holds more, so it lasts longer.",
  goal: "Keep H0 lit for 8 seconds with no generator.", hint: "The 47µF capacitor empties in a blink. Use the 1000µF one.",
  parts: "C0@330,460:47:12 C1@480,460:1000:12 H0@680,260",
  win: { lit: ["H0"], noGen: true, lastSeconds: { ids: ["H0"], seconds: 8 } }, sol: "w C1 H0; w H0b C1b" });
L({ world: "batterybay", title: "Harbour on a budget", env: { genScale: 0 }, hard: true, teach: "Parts that are wired together share one path back to the battery.",
  goal: "Generator's down! Light both houses from the battery — copper is tight.", hint: "Wire B0 → H0, then H0 → H1 (orange to orange) and H1's blue dot → H0's blue dot → B0's blue dot.",
  parts: "B0@450,470:12 H0@330,260 H1@570,260", win: { lit: ["H0", "H1"] }, sol: "w B0 H0; w H0 H1; w H1b H0b; w H0b B0b" });
L({ world: "batterybay", title: "Lighthouse keeper", env: { night: true, genScale: 0.7 }, teach: "A tired generator and a full battery: the battery takes over.",
  goal: "The old generator is weak tonight. Keep the lighthouse (H0) bright.", hint: "The generator alone makes H0 dim. Wire the full battery B0 in, too.",
  parts: "H0@600,260 B0@400,470:12", win: { lit: ["H0"], lastSeconds: { ids: ["H0"], seconds: 10 } },
  sol: "w GEN H0; w H0b GND; w GEN B0; w B0b GND" });

// --- Solar Desert ---
L({ world: "solardesert", title: "Sunshine", teach: "A solar panel is a little generator with its own two dots.",
  goal: "Light H0 with sunshine only.", hint: "Loop: S0's orange dot → H0 → back to S0's blue dot.",
  parts: "S0@400,260 H0@640,260", win: { lit: ["H0"], noGen: true }, sol: "w S0 H0; w H0b S0b" });
L({ world: "solardesert", title: "Hazy day", env: { solarFactor: 0.6 }, teach: "Two panels side by side add up their power.",
  goal: "It's hazy. Light H0 with sunshine only.", hint: "One panel isn't enough today. Wire both panels to H0, side by side.",
  parts: "S0@330,260 S1@330,470 H0@620,260", win: { lit: ["H0"], noGen: true }, sol: "w S0 H0; w H0b S0b; w S1 H0; w S1b H0b" });
L({ world: "solardesert", title: "Noon power", env: { solarFactor: 1.6 }, teach: "At noon on a sunny day, one panel has power to spare.",
  goal: "Light both houses with one solar panel.", hint: "Wire S0 to H0, then share: H0 → H1 and H1's blue dot → H0's blue dot.",
  parts: "S0@380,260 H0@560,260 H1@720,260", win: { lit: ["H0", "H1"], noGen: true }, sol: "w S0 H0; w H0b S0b; w H0 H1; w H1b H0b" });
L({ world: "solardesert", title: "Sand in the works", teach: "A wire across a panel's own two dots shorts it out.",
  goal: "Someone shorted the solar panel. Fix it!", hint: "One wire joins S0's two dots. DELETE it.",
  parts: "S0@400,260 H0@640,260", wires: "S0-H0 H0b-S0b S0-S0b", win: { lit: ["H0"], noGen: true }, sol: "u S0 S0b" });
L({ world: "solardesert", title: "Night falls", env: { night: true, genScale: 0 }, teach: "Solar panels rest at night. A battery carries the day's sunshine into the dark.",
  goal: "It's night and the generator is off. Light H0.", hint: "The panel is asleep. Use the charged battery B0.",
  parts: "S0@330,260 B0@450,470:12 H0@650,260", win: { lit: ["H0"] }, sol: "w B0 H0; w H0b B0b" });
L({ world: "solardesert", title: "Charge with sunshine", env: { solarFactor: 1.6 }, teach: "Sunshine can fill a battery for later.",
  goal: "Charge battery B0 to 7 volts with sunshine only.", hint: "Loop: S0 → B0's orange dot, B0's blue dot → S0's blue dot. Then wait.",
  parts: "S0@330,260 B0@560,470:4", win: { capAtLeast: { B0: 7 }, noGen: true }, sol: "w S0 B0; w B0b S0b; t 30" });
L({ world: "solardesert", title: "Cloudy day", env: { solarFactor: 0.5 }, teach: "Weak power can still run a small load.",
  goal: "Under the clouds, light the park lamps (H1) with sunshine.", hint: "The panel is too weak for the cottage today, but the park lamps sip only a little.",
  parts: "S0@380,260 H0@560,260 H1@720,260:park", win: { lit: ["H1"], noGen: true }, sol: "w S0 H1; w H1b S0b" });
L({ world: "solardesert", title: "Desert town", teach: "When the generator is full, the sun can power the extra house.",
  goal: "Four houses are too many for the generator. Light all four!", hint: "Take H3 off the generator and run it on the solar panel (its blue dot can go back through GND).",
  parts: "H0@300,260 H1@450,260 H2@600,260 H3@740,260 S0@520,470",
  wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND GEN-H2 H2b-GND GEN-H3 H3b-GND",
  win: { litAll: true }, sol: "u GEN H3; w S0 H3; w S0b GND" });
L({ world: "solardesert", title: "Sun for the street", env: { solarFactor: 1.6 }, hard: true, teach: "Short wires save copper.",
  goal: "Light both houses from the panel between them — copper is tight!", hint: "The panel sits right between the houses: wire each house straight to it.",
  parts: "H0@380,260 S0@520,260 H1@660,260", win: { lit: ["H0", "H1"], noGen: true }, sol: "w S0 H0; w H0b S0b; w S0 H1; w H1b S0b" });
L({ world: "solardesert", title: "Professor Sunny's lab", teach: "Solar panels wired to GEN and GND help the generator push harder.",
  goal: "The school (H0) needs 10 volts but it's dim. Light everything!", hint: "Wire both panels side by side with the generator: each panel's orange dot → GEN, blue dot → GND.",
  parts: "H0@340,260:school H1@500,260 H2@660,260 S0@380,470 S1@600,470",
  wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND GEN-H2 H2b-GND",
  win: { litAll: true }, sol: "w GEN S0; w S0b GND; w GEN S1; w S1b GND" });

// --- Transformer Mountains ---
L({ world: "mountains", title: "Over the mountain", teach: "Long power lines waste power. Step the voltage UP to send it, then DOWN to use it.",
  goal: "Send power over the long line (R0) to light H0.", hint: "GEN → X0 (step up ×2) → the line → X1 (step down ×0.5) → H0 → GND. The line is already wired between them.",
  parts: "X0@270,460:2 R0@450,430:12 X1@600,460:0.5 H0@740,260", wires: "X0-R0 R0b-X1P",
  win: { lit: ["H0"], needs: { H0: "R0" } }, sol: "w GEN X0P; w X1 H0; w H0b GND" });
L({ world: "mountains", title: "Build the line", teach: "Up at the start, down at the end.",
  goal: "Place the transformers and light H0 through the long line.", hint: "Put the ×2 transformer near GEN and the ×0.5 one near H0. GEN → up → line → down → H0.",
  parts: "R0@450,430:12 H0@740,260", tool: "XFMR:2 XFMR:0.5",
  win: { lit: ["H0"], needs: { H0: "R0" } }, sol: "p XFMR 290 460 2; p XFMR 610 460 0.5; w GEN X0P; w X0 R0; w R0b X1P; w X1 H0; w H0b GND" });
L({ world: "mountains", title: "More push", teach: "More voltage pushes more current through the same resistor.",
  goal: "The LED is stuck behind a big resistor and only glows. Make it bright!", hint: "Step the voltage up ×2 before the resistor: GEN → X0 → R0 → L0 → GND.",
  parts: "R0@450,430:1000 L0@600,440", tool: "XFMR:2", win: { lit: ["L0"], needs: { L0: "R0" } },
  sol: "p XFMR 300 460 2; w GEN X0P; w X0 R0; w R0b L0; w L0b GND" });
L({ world: "mountains", title: "Less push", teach: "Stepping the voltage DOWN can protect a delicate part.",
  goal: "12 volts would pop this LED even with its small resistor. Light it safely!", hint: "Step the voltage down ×0.5 first: GEN → X0 → R0 → L0 → GND.",
  parts: "R0@450,430:220 L0@600,440", tool: "XFMR:0.5", win: { lit: ["L0"], needs: { L0: "R0" } },
  sol: "p XFMR 300 460 0.5; w GEN X0P; w X0 R0; w R0b L0; w L0b GND" });
L({ world: "mountains", title: "Two cabins", teach: "One line can carry power for a whole village.",
  goal: "Light both cabins across the line.", hint: "Feed the line from the step-up transformer, then wire both houses to the step-down one.",
  parts: "X0@270,460:2 R0@420,430:4 X1@560,460:0.5 H0@650,260 H1@780,260", wires: "X0-R0 R0b-X1P",
  win: { lit: ["H0", "H1"], needs: { H0: "R0", H1: "R0" } }, sol: "w GEN X0P; w X1 H0; w H0b GND; w H0 H1; w H1b H0b" });
L({ world: "mountains", title: "Small loads travel well", teach: "A tiny LED takes so little current that a long line hardly matters.",
  goal: "Light the hut's LED (L0) through the long line — no transformers needed.", hint: "GEN → line R0 → resistor R1 → L0 → GND.",
  parts: "R0@330,430:12 R1@500,430:470 L0@650,440", win: { lit: ["L0"], needs: { L0: "R0" } }, sol: "w GEN R0; w R0b R1; w R1b L0; w L0b GND" });
L({ world: "mountains", title: "Mixed up", teach: "Down then up is backwards: the line wastes almost everything.",
  goal: "The transformers are wired the wrong way round. Fix the line!", hint: "The step-up one (X1, ×2) must be at the GEN end and the step-down one (X0) at the house end. Rewire them.",
  parts: "X0@300,460:0.5 R0@460,430:12 X1@620,460:2 H0@740,260", wires: "GEN-X0P X0-R0 R0b-X1P X1-H0 H0b-GND",
  win: { lit: ["H0"], needs: { H0: "R0" } },
  sol: "u GEN X0P; u X0 R0; u R0b X1P; u X1 H0; w GEN X1P; w X1 R0; w R0b X0P; w X0 H0" });
L({ world: "mountains", title: "Copper over the peaks", hard: true, teach: "Put parts close together to save copper.",
  goal: "Light H0 through the line — and copper is tight!", hint: "Place each transformer right next to the end of the line it connects to.",
  parts: "R0@460,430:12 H0@720,260", tool: "XFMR:2 XFMR:0.5", win: { lit: ["H0"], needs: { H0: "R0" } },
  sol: "p XFMR 320 460 2; p XFMR 600 460 0.5; w GEN X0P; w X0 R0; w R0b X1P; w X1 H0; w H0b GND" });
L({ world: "mountains", title: "Near and far", teach: "Near houses can plug in directly; far ones need the line.",
  goal: "Light the near house (H1) and the far house (H0).", hint: "H1 can go straight to GEN. H0 is over the mountain: up → line → down.",
  parts: "R0@460,430:8 H0@740,260 H1@330,260", tool: "XFMR:2 XFMR:0.5", win: { lit: ["H0", "H1"], needs: { H0: "R0" } },
  sol: "w GEN H1; w H1b GND; p XFMR 330 460 2; p XFMR 600 460 0.5; w GEN X0P; w X0 R0; w R0b X1P; w X1 H0; w H0b GND" });
L({ world: "mountains", title: "Engineer Ella's grid", teach: "A whole mountain village, lit through one line.",
  goal: "Light both cabins and the hut's LED across the line.", hint: "Everything in the village hangs off the step-down transformer X1.",
  parts: "X0@270,460:2 R0@400,430:4 X1@520,460:0.5 H0@640,260 H1@780,260 R1@650,440:470 L0@780,450", wires: "X0-R0 R0b-X1P",
  win: { litAll: true, needs: { H0: "R0", H1: "R0", L0: "R0" } },
  sol: "w GEN X0P; w X1 H0; w H0b GND; w H0 H1; w H1b H0b; w X1 R1; w R1b L0; w L0b GND" });

// --- Windmill Valley ---
L({ world: "windmill", title: "String of lights", teach: "Lights in a row (in series) share one path: the same current goes through every one.",
  goal: "Light both LEDs in one string.", hint: "GEN → R0 → L0 → L1 → GND: L0's blue dot goes to L1's orange dot.",
  parts: "R0@300,430:430 L0@450,440 L1@600,440", win: { chain: ["L0", "L1"] }, sol: "w GEN R0; w R0b L0; w L0b L1; w L1b GND" });
L({ world: "windmill", title: "Side by side", teach: "Lights side by side (in parallel) each get their own path.",
  goal: "Light both LEDs so that either one keeps shining if the other breaks.", hint: "Give each LED its own resistor and its own loop.",
  parts: "R0@300,430:470 L0@420,440 R1@560,430:470 L1@680,440", win: { parallel: ["L0", "L1"] },
  sol: "w GEN R0; w R0b L0; w L0b GND; w GEN R1; w R1b L1; w L1b GND" });
L({ world: "windmill", title: "One gap", teach: "In a string, one gap and EVERY light goes out.",
  goal: "The festival string is dark. Find the gap!", hint: "Follow the string from the resistor: one LED's blue dot isn't joined to the next one.",
  parts: "R0@280,430:330 L0@400,440 L1@520,440 L2@640,440", wires: "GEN-R0 R0b-L0 L0b-L1 L2b-GND",
  win: { chain: ["L0", "L1", "L2"] }, sol: "w L1b L2" });
L({ world: "windmill", title: "Houses in a row", teach: "Two houses in a row share the push — each gets only half, so both stay dark.",
  goal: "These houses are in a row and both dark. Light them both — side by side!", hint: "DELETE the wire from H0's blue dot to H1. Then give each house its own way to GEN and to GND.",
  parts: "H0@400,260 H1@620,260", wires: "GEN-H0 H0b-H1 H1b-GND", win: { parallel: ["H0", "H1"] },
  sol: "u H0b H1; w H0b GND; w GEN H1" });
L({ world: "windmill", title: "A calm day", env: { genScale: 0.7, plant: "wind" }, teach: "On a calm day the wind turbine pushes less. Small loads still work.",
  goal: "The wind is weak today. Light the park lamps (H1).", hint: "The cottage needs too much today — just wire the park lamps.",
  parts: "H0@380,260 H1@620,260:park", win: { lit: ["H1"] }, sol: "w GEN H1; w H1b GND" });
L({ world: "windmill", title: "A breezy day", env: { plant: "wind" }, teach: "A wind turbine is a bigger power plant than the little generator: more houses stay bright.",
  goal: "The turbine is spinning! Light all four houses.", hint: "Give every house a loop — they can share wires.",
  parts: "H0@300,260 H1@450,260 H2@600,260 H3@740,260",
  win: { litAll: true }, sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w H2 H3; w H3b H2b" });
L({ world: "windmill", title: "Copper string", hard: true, teach: "A string needs only one wire between each pair of lights.",
  goal: "Make a string of three LEDs — copper is tight!", hint: "R0 → L0 → L1 → L2 → GND, each LED's blue dot to the next one's orange dot.",
  parts: "R0@260,430:330 L0@380,440 L1@500,440 L2@620,440", win: { chain: ["L0", "L1", "L2"] },
  sol: "w GEN R0; w R0b L0; w L0b L1; w L1b L2; w L2b GND" });
L({ world: "windmill", title: "Switch the string", teach: "One switch in a string turns the whole string on and off.",
  goal: "Switch T0 must turn the LED string on and off. The house stays on.", hint: "Put T0 at the start of the string: GEN → T0 → R0 → L0 → L1 → GND.",
  parts: "H0@330,260 T0@300,470 R0@430,430:430 L0@560,440 L1@690,440",
  win: { truth: { switches: ["T0"], want: { "1": { H0: 1, L0: 1, L1: 1 }, "0": { H0: 1, L0: 0, L1: 0 } } } },
  sol: "w GEN H0; w H0b GND; w GEN T0; w T0b R0; w R0b L0; w L0b L1; w L1b GND" });
L({ world: "windmill", title: "Two strings", teach: "Two strings side by side: if one breaks, the other keeps shining.",
  goal: "Light all four LEDs using just the two resistors.", hint: "Make two strings of two: R0 → L0 → L1, and R1 → L2 → L3.",
  parts: "R0@280,430:430 L0@380,440 L1@480,440 R1@580,430:430 L2@680,440 L3@780,440", win: { ledsOn: 4 },
  sol: "w GEN R0; w R0b L0; w L0b L1; w L1b GND; w GEN R1; w R1b L2; w L2b L3; w L3b GND" });
L({ world: "windmill", title: "Harvest festival", env: { plant: "wind" }, teach: "Houses side by side, lights in a string, and a switch for the show.",
  goal: "Both houses always on; switch T0 turns the festival string on and off.", hint: "Houses side by side on GEN; the string goes GEN → T0 → R0 → L0 → L1 → GND.",
  parts: "H0@330,260 H1@500,260 T0@670,250 R0@330,430:430 L0@460,440 L1@590,440",
  win: { truth: { switches: ["T0"], want: { "1": { H0: 1, H1: 1, L0: 1, L1: 1 }, "0": { H0: 1, H1: 1, L0: 0, L1: 0 } } } },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w GEN T0; w T0b R0; w R0b L0; w L0b L1; w L1b GND" });

// --- Waterfall Woods ---
L({ world: "waterfall", title: "Night light", teach: "A big resistor lets only a little current through: a soft glow.",
  goal: "Make L0 glow softly — dim, not bright.", hint: "Use the Large resistor (1000Ω).",
  parts: "L0@600,440", tool: "RES:470 RES:1000", win: { dim: ["L0"] }, sol: "p RES 420 430 1000; w GEN R0; w R0b L0; w L0b GND" });
L({ world: "waterfall", title: "Two in a row", teach: "Resistors in a row add up: 220 + 220 = 440 ohms.",
  goal: "Light L0 brightly. One small resistor alone would pop it!", hint: "Use BOTH resistors, one after the other: GEN → R0 → R1 → L0 → GND.",
  parts: "L0@650,440", tool: "RES:220 RES:220", win: { lit: ["L0"] }, sol: "p RES 330 430 220; p RES 480 430 220; w GEN R0; w R0b R1; w R1b L0; w L0b GND" });
L({ world: "waterfall", title: "Two side by side", teach: "Resistors side by side give current two paths: together they resist LESS.",
  goal: "Light L0 brightly with two big resistors.", hint: "One 1000Ω makes it dim. Put both side by side: GEN → each resistor → L0.",
  parts: "L0@650,440", tool: "RES:1000 RES:1000", win: { lit: ["L0"] },
  sol: "p RES 360 430 1000; p RES 500 430 1000; w GEN R0; w GEN R1; w R0b L0; w R1b L0; w L0b GND" });
L({ world: "waterfall", title: "Bright and dim", teach: "Pick the resistor for the job.",
  goal: "Make L0 bright and L1 glow softly.", hint: "Medium (470Ω) for the bright one, Large (1000Ω) for the soft one.",
  parts: "L0@420,440 L1@680,440", tool: "RES:470 RES:1000", win: { lit: ["L0"], dim: ["L1"] },
  sol: "p RES 300 430 470; p RES 560 430 1000; w GEN R0; w R0b L0; w L0b GND; w GEN R1; w R1b L1; w L1b GND" });
L({ world: "waterfall", title: "Popped in the woods", teach: "A wire around a resistor skips it — and the LED pops.",
  goal: "A shortcut skipped the resistor and L0 popped. Fix the circuit!", hint: "DELETE the wire from GEN that goes past the resistor. The LED gets a fresh bulb when you rewire it.",
  parts: "R0@330,430:470 L0@520,440:burned", wires: "GEN-R0 GEN-R0b R0b-L0 L0b-GND", win: { lit: ["L0"] }, sol: "u GEN R0b" });
L({ world: "waterfall", title: "Hydro power", env: { plant: "hydro" }, teach: "A hydro dam is steady and strong: five houses, no problem.",
  goal: "Light all five cabins with the hydro dam.", hint: "Every cabin needs a loop. Share wires to save copper.",
  parts: "H0@300,260 H1@450,260 H2@600,260 H3@450,450 H4@600,450", wires: "GEN-H0 H0b-GND",
  win: { litAll: true }, sol: "w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w GEN H3; w H3b GND; w H3 H4; w H4b H3b" });
L({ world: "waterfall", title: "The old line", teach: "Every building adds current. Old wires can only carry so much.",
  goal: "Light H0, H1 and L0 — but the old line carries at most 1.2 amps.", hint: "Leave H2 unplugged: three houses would pull too much current.",
  parts: "H0@330,260 H1@500,260 H2@670,260 R0@400,430:470 L0@560,440", win: { lit: ["H0", "H1", "L0"], genMax: 1.2 },
  sol: "w GEN H0; w H0b GND; w GEN H1; w H1b GND; w GEN R0; w R0b L0; w L0b GND" });
L({ world: "waterfall", title: "Beaver's dam", teach: "Add a second path next to a resistor and more current gets through.",
  goal: "L0 is dim behind R0. Make it bright — R0 has to stay in the circuit.", hint: "Put the new resistor side by side with R0: join their orange dots, and their blue dots.",
  parts: "R0@380,430:1000 L0@600,440", wires: "GEN-R0 R0b-L0 L0b-GND", tool: "RES:1000", win: { lit: ["L0"], needs: { L0: "R0" } },
  sol: "p RES 480 300 1000; w R0 R1; w R1b R0b" });
L({ world: "waterfall", title: "Waterfall string", hard: true, teach: "Three LEDs in a string need a smaller resistor than one LED alone.",
  goal: "Light the string of three LEDs — copper is tight.", hint: "100Ω is too small even for three. Use 330Ω.",
  parts: "L0@380,440 L1@500,440 L2@620,440", tool: "RES:100 RES:330", win: { chain: ["L0", "L1", "L2"] },
  sol: "p RES 260 430 330; w GEN R0; w R0b L0; w L0b L1; w L1b L2; w L2b GND" });
L({ world: "waterfall", title: "Ranger station", teach: "Everything you learned in the woods.",
  goal: "Keep H0 on, L1 glowing softly, and let switch T0 turn the bright lamp L0 on and off.", hint: "L0's loop goes through T0 and R0 (470Ω). L1 gets the big resistor R1.",
  parts: "H0@320,260 T0@480,250 R0@620,240:470 L0@740,250 R1@460,430:1000 L1@620,440",
  win: { dim: ["L1"], truth: { switches: ["T0"], want: { "1": { H0: 1, L0: 1 }, "0": { H0: 1, L0: 0 } } } },
  sol: "w GEN H0; w H0b GND; w GEN T0; w T0b R0; w R0b L0; w L0b GND; w GEN R1; w R1b L1; w L1b GND" });

// --- Neon City ---
L({ world: "neon", title: "Backwards sign", teach: "An LED only lets power through one way: orange dot toward GEN, blue dot toward GND.",
  goal: "The sign's LED is in backwards. Turn it round!", hint: "DELETE its two wires, then wire R0's blue dot → L0's ORANGE dot, and L0's blue dot → GND.",
  parts: "R0@380,430:470 L0@560,440", wires: "GEN-R0 R0b-L0b L0-GND", win: { lit: ["L0"] }, sol: "u R0b L0b; u L0 GND; w R0b L0; w L0b GND" });
L({ world: "neon", title: "Three buddies", teach: "Every LED needs its own resistor buddy (or a string shares one).",
  goal: "Light all three LEDs.", hint: "Place a resistor in front of each LED.",
  parts: "L0@380,440 L1@560,440 L2@740,440", tool: "RES:470 RES:470 RES:470", win: { lit: ["L0", "L1", "L2"] },
  sol: "p RES 290 430 470; p RES 470 430 470; p RES 650 430 470; w GEN R0; w R0b L0; w L0b GND; w GEN R1; w R1b L1; w L1b GND; w GEN R2; w R2b L2; w L2b GND" });
L({ world: "neon", title: "One buddy for two", teach: "Two LEDs in a string can share one resistor.",
  goal: "Light both LEDs with just one resistor.", hint: "Make a string: GEN → R0 → L0 → L1 → GND.",
  parts: "L0@450,440 L1@600,440", tool: "RES:430", win: { lit: ["L0", "L1"] },
  sol: "p RES 330 430 430; w GEN R0; w R0b L0; w L0b L1; w L1b GND" });
L({ world: "neon", title: "Popped sign", teach: "Fix the circuit first, then the LED gets a fresh bulb.",
  goal: "This sign was wired with no resistor and popped. Fix it!", hint: "DELETE the wire from GEN to L0, place the resistor, and wire GEN → R0 → L0.",
  parts: "L0@560,440:burned", wires: "GEN-L0 L0b-GND", tool: "RES:470", win: { lit: ["L0"] },
  sol: "u GEN L0; p RES 400 430 470; w GEN R0; w R0b L0" });
L({ world: "neon", title: "Sign switch", teach: "One switch can control lots of lights at once.",
  goal: "Switch T0 must turn both signs on and off together.", hint: "GEN → T0, then T0's blue dot feeds both resistors.",
  parts: "T0@290,250 R0@420,430:470 L0@520,440 R1@640,430:470 L1@740,440",
  win: { truth: { switches: ["T0"], want: { "1": { L0: 1, L1: 1 }, "0": { L0: 0, L1: 0 } } } },
  sol: "w GEN T0; w T0b R0; w R0b L0; w L0b GND; w T0b R1; w R1b L1; w L1b GND" });
L({ world: "neon", title: "Billboard", teach: "Strings save resistors.",
  goal: "Light all four billboard LEDs — you only have two resistors.", hint: "Two strings of two LEDs, each with one resistor.",
  parts: "L0@360,440 L1@470,440 L2@600,440 L3@710,440", tool: "RES:430 RES:430", win: { ledsOn: 4 },
  sol: "p RES 260 430 430; p RES 520 260 430; w GEN R0; w R0b L0; w L0b L1; w L1b GND; w GEN R1; w R1b L2; w L2b L3; w L3b GND" });
L({ world: "neon", title: "City block", env: { plant: "coal" }, teach: "The city's coal plant can run a whole block.",
  goal: "Light every building and sign on the block.", hint: "Every building and every LED string needs its own loop.",
  parts: "H0@300,260 H1@440,260:school H2@580,260 H3@720,260 R0@360,430:470 L0@480,440",
  win: { litAll: true }, sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w H2 H3; w H3b H2b; w GEN R0; w R0b L0; w L0b GND" });
L({ world: "neon", title: "Neon nights", env: { night: true }, teach: "At night buildings need more power — but LEDs barely use any.",
  goal: "It's night. Light the club (H0) and all three LEDs.", hint: "One building plus the LEDs: the generator can manage it.",
  parts: "H0@330,260 R0@460,430:430 L0@580,440 L1@700,440 R1@560,240:470 L2@700,250",
  win: { litAll: true }, sol: "w GEN H0; w H0b GND; w GEN R0; w R0b L0; w L0b L1; w L1b GND; w GEN R1; w R1b L2; w L2b GND" });
L({ world: "neon", title: "Tight sign budget", hard: true, teach: "Line things up and keep wires short.",
  goal: "Light the three-LED sign — copper is tight!", hint: "Place the resistor close to GEN and make one string.",
  parts: "L0@360,440 L1@470,440 L2@580,440", tool: "RES:330", win: { chain: ["L0", "L1", "L2"] },
  sol: "p RES 250 430 330; w GEN R0; w R0b L0; w L0b L1; w L1b L2; w L2b GND" });
L({ world: "neon", title: "Broadway", teach: "Two switches, two signs: each switch runs its own sign.",
  goal: "T0 must run sign L0 and T1 must run sign L1.", hint: "Two separate loops: GEN → T0 → R0 → L0 → GND, and GEN → T1 → R1 → L1 → GND.",
  parts: "T0@290,250 R0@420,240:470 L0@540,250 T1@290,470 R1@420,430:470 L1@540,440",
  win: { truth: { switches: ["T0", "T1"], want: { "11": { L0: 1, L1: 1 }, "10": { L0: 1, L1: 0 }, "01": { L0: 0, L1: 1 }, "00": { L0: 0, L1: 0 } } } },
  sol: "w GEN T0; w T0b R0; w R0b L0; w L0b GND; w GEN T1; w T1b R1; w R1b L1; w L1b GND" });

// --- Frosty Tundra ---
L({ world: "tundra", title: "Igloo battery", env: { night: true, genScale: 0 }, teach: "On the long polar night, batteries keep the lights on.",
  goal: "Light the igloo (H0) from the battery and keep it lit for 20 seconds.", hint: "Loop: B0 → H0 → back to B0's blue dot.",
  parts: "B0@380,470:12 H0@620,260", win: { lit: ["H0"], lastSeconds: { ids: ["H0"], seconds: 20 } }, sol: "w B0 H0; w H0b B0b" });
L({ world: "tundra", title: "Charge before dark", teach: "Batteries fill up while the generator runs.",
  goal: "Charge battery B0 to 10 volts before the night.", hint: "Wire B0 to GEN and GND and wait.",
  parts: "B0@450,470:6", win: { capAtLeast: { B0: 10 } }, sol: "w GEN B0; w B0b GND; t 40" });
L({ world: "tundra", title: "Two small buckets", env: { night: true, genScale: 0 }, teach: "Capacitors side by side add up: twice the bucket.",
  goal: "Keep H0 lit for 10 seconds — one capacitor alone runs out too soon.", hint: "Wire both capacitors side by side (orange to orange, blue to blue) to the house.",
  parts: "C0@330,460:220:12 C1@470,460:220:12 H0@650,260", win: { lit: ["H0"], lastSeconds: { ids: ["H0"], seconds: 10 } },
  sol: "w C0 H0; w H0b C0b; w C1 C0; w C1b C0b" });
L({ world: "tundra", title: "Long night", env: { night: true }, teach: "A battery next to the generator keeps a whole street bright at night.",
  goal: "Light all three huts tonight.", hint: "The generator alone is too weak at night for three. Wire the battery in beside it.",
  parts: "H0@330,260 H1@500,260 H2@670,260 B0@520,470:12",
  win: { litAll: true, lastSeconds: { ids: ["H0", "H1", "H2"], seconds: 10 } },
  sol: "w GEN H0; w H0b GND; w GEN H1; w H1b GND; w GEN H2; w H2b GND; w GEN B0; w B0b GND" });
L({ world: "tundra", title: "Penny's switch", env: { night: true, genScale: 0 }, teach: "Batteries and switches work together too.",
  goal: "Switch T0 must turn the igloo (H0) on and off, powered by the battery.", hint: "Loop: B0 → T0 → H0 → back to B0's blue dot.",
  parts: "B0@330,470:12 T0@480,250 H0@650,260",
  win: { truth: { switches: ["T0"], want: { "1": { H0: 1 }, "0": { H0: 0 } } } }, sol: "w B0 T0; w T0b H0; w H0b B0b" });
L({ world: "tundra", title: "Frozen generator", env: { genScale: 0.6 }, teach: "When the generator is half frozen, a battery takes over the push.",
  goal: "The generator is half frozen. Light both huts.", hint: "Wire the full battery to the same dots as the generator: B0 → GEN, B0's blue dot → GND.",
  parts: "H0@380,260 H1@600,260 B0@490,470:12", wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND", win: { litAll: true, lastSeconds: { ids: ["H0", "H1"], seconds: 10 } },
  sol: "w GEN B0; w B0b GND" });
L({ world: "tundra", title: "Thermos", teach: "Fill the capacitor, then let it run the house on its own.",
  goal: "Light H0 from the capacitor alone (generator unplugged) for 10 seconds.", hint: "Charge C0 from GEN, wire it to H0, then DELETE the wire from GEN.",
  parts: "C0@380,460:1000:0 H0@620,260", win: { lit: ["H0"], noGen: true, lastSeconds: { ids: ["H0"], seconds: 10 } },
  sol: "w GEN C0; w C0b GND; t 30; w C0 H0; w H0b GND; u GEN C0" });
L({ world: "tundra", title: "Snow budget", env: { night: true, genScale: 0 }, hard: true, teach: "Short, shared wires.",
  goal: "Light both huts from the battery — copper is tight.", hint: "Battery → H0 → H1 (orange to orange), and the blue dots back to the battery.",
  parts: "B0@480,470:12 H0@360,260 H1@600,260", win: { litAll: true }, sol: "w B0 H0; w H0 H1; w H1b H0b; w H0b B0b" });
L({ world: "tundra", title: "Research camp", teach: "Important buildings get a backup battery: if the generator line breaks, they stay on.",
  goal: "The hospital (H0) must stay bright even if every wire to GEN is cut.", hint: "Wire the hospital to GEN AND to the charged battery.",
  parts: "H0@560,260:hospital B0@360,470:12", win: { backup: ["H0"] }, sol: "w GEN H0; w H0b GND; w B0 H0; w B0b GND" });
L({ world: "tundra", title: "Aurora", env: { night: true }, teach: "Everything for a frozen night.",
  goal: "Night: light both huts and the aurora LED, and keep them lit.", hint: "Houses on GEN, battery beside GEN, and the LED with its resistor.",
  parts: "H0@340,260 H1@500,260 B0@400,470:12 R0@560,430:470 L0@680,440",
  win: { litAll: true, lastSeconds: { ids: ["H0", "H1", "L0"], seconds: 10 } },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w GEN B0; w B0b GND; w GEN R0; w R0b L0; w L0b GND" });

// --- Volcano Island ---
L({ world: "volcano", title: "Hospital first", teach: "Too many big buildings on one generator, and nothing is bright. Unplug what can wait.",
  goal: "Every building is dim. Make the hospital (H0) and H3 bright.", hint: "The bakery is the hungriest. Unplug it, and one more house.",
  parts: "H0@330,260:hospital H1@480,260:bakery H2@630,260 H3@480,450", wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND GEN-H2 H2b-GND GEN-H3 H3b-GND",
  win: { lit: ["H0", "H3"] }, sol: "u GEN H1; u GEN H2" });
L({ world: "volcano", title: "Geothermal", env: { plant: "geothermal" }, teach: "Heat from deep underground runs a big power plant.",
  goal: "With the geothermal plant, light every building — even the school.", hint: "Wire every building to GEN and GND (sharing is fine).",
  parts: "H0@330,260:school H1@480,260 H2@630,260 H3@480,450:bakery", win: { litAll: true },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w GEN H3; w H3b GND" });
L({ world: "volcano", title: "Heavy load", teach: "Every building pulls current from the generator.",
  goal: "Light the hospital and H1 using no more than 1.6 amps.", hint: "Don't plug in the bakery: it pulls too much.",
  parts: "H0@330,260:hospital H1@500,260 H2@670,260:bakery", win: { lit: ["H0", "H1"], genMax: 1.6 },
  sol: "w GEN H0; w H0b GND; w GEN H1; w H1b GND" });
L({ world: "volcano", title: "Lab exam", teach: "The school needs 10 volts. Alone, the generator can do it.",
  goal: "Light the school (H0) — the others can wait.", hint: "The school needs the generator all to itself.",
  parts: "H0@340,260:school H1@500,260 H2@660,260", wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND GEN-H2 H2b-GND",
  win: { lit: ["H0"] }, sol: "u GEN H1; u GEN H2" });
L({ world: "volcano", title: "Sun and steam", teach: "Two power sources can share the work.",
  goal: "Light all four buildings: the solar panel can take one.", hint: "Three on GEN, and run the fourth (H3) on the solar panel.",
  parts: "H0@300,260 H1@450,260 H2@600,260 S0@380,470 H3@600,450", win: { litAll: true },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w S0 H3; w H3b S0b" });
L({ world: "volcano", title: "Bakery boost", env: { plant: "geothermal" }, teach: "A big plant runs big buildings.",
  goal: "Light both bakeries and the ice-cream shop.", hint: "With the geothermal plant, they can all share GEN.",
  parts: "H0@330,260:bakery H1@500,260:bakery H2@670,260:icecream", win: { litAll: true },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b" });
L({ world: "volcano", title: "Coconut budget", hard: true, teach: "Short wires, shared paths.",
  goal: "Light both houses — copper is tight.", hint: "Chain them: GEN → H0 → H1, and blue dots H1 → H0 → GND.",
  parts: "H0@320,260 H1@480,260", win: { litAll: true }, sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b" });
L({ world: "volcano", title: "Lava lights", teach: "LEDs barely add to the load, even next to big buildings.",
  goal: "Light the hospital and both lava-warning LEDs.", hint: "Hospital on GEN, then a string of two LEDs with R0.",
  parts: "H0@330,260:hospital R0@460,430:430 L0@580,440 L1@700,440", win: { litAll: true },
  sol: "w GEN H0; w H0b GND; w GEN R0; w R0b L0; w L0b L1; w L1b GND" });
L({ world: "volcano", title: "Eruption alarm", teach: "The alarm must work only when the switch is on.",
  goal: "Switch T0 runs the alarm LED; the hospital stays on.", hint: "GEN → T0 → R0 → L0 → GND, and the hospital on its own loop.",
  parts: "H0@330,260:hospital T0@480,250 R0@600,240:470 L0@720,250",
  win: { truth: { switches: ["T0"], want: { "1": { H0: 1, L0: 1 }, "0": { H0: 1, L0: 0 } } } },
  sol: "w GEN H0; w H0b GND; w GEN T0; w T0b R0; w R0b L0; w L0b GND" });
L({ world: "volcano", title: "Dr. Magma's lab", env: { plant: "geothermal" }, teach: "Big plant, big buildings, and a backup for the hospital.",
  goal: "Light everything, and the hospital must stay on even if every GEN wire is cut.", hint: "Everything on GEN — and the charged battery wired to the hospital too.",
  parts: "H0@330,260:hospital H1@480,260:school H2@630,260 B0@420,470:12", win: { litAll: true, backup: ["H0"] },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w B0 H0; w B0b GND" });

// --- Robot Factory ---
const ALL2 = (f) => ({ "11": f(1, 1), "10": f(1, 0), "01": f(0, 1), "00": f(0, 0) });
const ALL3 = (f) => { const o = {}; for (const a of [1, 0]) for (const b of [1, 0]) for (const c of [1, 0]) o[`${a}${b}${c}`] = f(a, b, c); return o; };
L({ world: "robot", title: "AND gate", teach: "Two switches in a row: the light is on only when BOTH are on. That's AND.",
  goal: "H0 must light only when T0 AND T1 are both on.", hint: "Put the switches in a row: GEN → T0 → T1 → H0 → GND.",
  parts: "T0@300,250 T1@440,250 H0@620,260", win: { truth: { switches: ["T0", "T1"], want: ALL2((a, b) => ({ H0: a && b })) } },
  sol: "w GEN T0; w T0b T1; w T1b H0; w H0b GND" });
L({ world: "robot", title: "OR gate", teach: "Two switches side by side: EITHER one turns the light on. That's OR.",
  goal: "H0 must light when T0 OR T1 (or both) is on.", hint: "Two paths from GEN to H0: one through T0, one through T1.",
  parts: "T0@330,250 T1@330,470 H0@600,260", win: { truth: { switches: ["T0", "T1"], want: ALL2((a, b) => ({ H0: a || b })) } },
  sol: "w GEN T0; w T0b H0; w GEN T1; w T1b H0; w H0b GND" });
L({ world: "robot", title: "NOT gate", teach: "A switch across a light makes a shortcut when it's on: switch ON means light OFF. That's NOT.",
  goal: "H0 must be OFF when T0 is on, and ON when T0 is off.", hint: "GEN → R0 → H0 → GND, then put T0 straight across H0 (its dots to H0's two dots).",
  parts: "R0@330,430:2 T0@520,470 H0@650,260", win: { truth: { switches: ["T0"], want: { "1": { H0: 0 }, "0": { H0: 1 } } } },
  sol: "w GEN R0; w R0b H0; w H0b GND; w T0 H0; w T0b H0b" });
L({ world: "robot", title: "Triple lock", teach: "Three switches in a row: all three must be on.",
  goal: "H0 lights only when T0, T1 AND T2 are all on.", hint: "GEN → T0 → T1 → T2 → H0 → GND.",
  parts: "T0@290,250 T1@420,250 T2@550,250 H0@700,260", win: { truth: { switches: ["T0", "T1", "T2"], want: ALL3((a, b, c) => ({ H0: a && b && c })) } },
  sol: "w GEN T0; w T0b T1; w T1b T2; w T2b H0; w H0b GND" });
L({ world: "robot", title: "AND, then OR", teach: "Gates can be combined: (T0 AND T1) OR T2.",
  goal: "H0 lights when (T0 AND T1) are on — or when T2 is on.", hint: "One path through T0 then T1, another path through T2, both into H0.",
  parts: "T0@290,250 T1@420,250 T2@350,470 H0@620,260", win: { truth: { switches: ["T0", "T1", "T2"], want: ALL3((a, b, c) => ({ H0: (a && b) || c })) } },
  sol: "w GEN T0; w T0b T1; w T1b H0; w GEN T2; w T2b H0; w H0b GND" });
L({ world: "robot", title: "Master switch", teach: "A master switch feeds everything after it.",
  goal: "T0 is the master: off means everything off. T1 controls H1 only.", hint: "GEN → T0, then T0's blue dot feeds H0 directly and H1 through T1.",
  parts: "T0@290,250 H0@450,260 T1@460,470 H1@650,260",
  win: { truth: { switches: ["T0", "T1"], want: ALL2((a, b) => ({ H0: a, H1: a && b })) } },
  sol: "w GEN T0; w T0b H0; w H0b GND; w T0b T1; w T1b H1; w H1b GND" });
L({ world: "robot", title: "Conveyor lights", teach: "A switch can run a whole string of LEDs.",
  goal: "T0 turns the conveyor's LED string on and off.", hint: "GEN → T0 → R0 → L0 → L1 → GND.",
  parts: "T0@290,250 R0@420,430:430 L0@540,440 L1@660,440",
  win: { truth: { switches: ["T0"], want: { "1": { L0: 1, L1: 1 }, "0": { L0: 0, L1: 0 } } } },
  sol: "w GEN T0; w T0b R0; w R0b L0; w L0b L1; w L1b GND" });
L({ world: "robot", title: "Budget AND", hard: true, teach: "Short wires make neat gates.",
  goal: "Build an AND gate for H0 — copper is tight.", hint: "GEN → T0 → T1 → H0 → GND, all close together.",
  parts: "T0@270,250 T1@390,250 H0@530,260", win: { truth: { switches: ["T0", "T1"], want: ALL2((a, b) => ({ H0: a && b })) } },
  sol: "w GEN T0; w T0b T1; w T1b H0; w H0b GND" });
L({ world: "robot", title: "Two robots, two switches", teach: "Separate loops make separate controls.",
  goal: "T0 runs robot H0 and T1 runs robot H1 — each on its own.", hint: "GEN → T0 → H0 → GND, and GEN → T1 → H1 → GND.",
  parts: "T0@300,250 H0@450,260 T1@300,470 H1@650,260",
  win: { truth: { switches: ["T0", "T1"], want: ALL2((a, b) => ({ H0: a, H1: b })) } },
  sol: "w GEN T0; w T0b H0; w H0b GND; w GEN T1; w T1b H1; w H1b GND" });
L({ world: "robot", title: "Robo-Boss's puzzle", teach: "T0 AND (T1 OR T2): the boss level of logic!",
  goal: "H0 lights when T0 is on AND (T1 OR T2) is on.", hint: "GEN → T0, then from T0's blue dot two paths — through T1 and through T2 — into H0.",
  parts: "T0@290,250 T1@450,250 T2@450,470 H0@650,260", win: { truth: { switches: ["T0", "T1", "T2"], want: ALL3((a, b, c) => ({ H0: a && (b || c) })) } },
  sol: "w GEN T0; w T0b T1; w T0b T2; w T1b H0; w T2b H0; w H0b GND" });

// --- Storm Coast ---
L({ world: "storm", title: "Fallen lines", teach: "After a storm, an engineer reconnects every broken line.",
  goal: "The storm knocked down three lines. Light every house again.", hint: "Tap each dark house to see which dot is missing its wire.",
  parts: "H0@330,260 H1@500,260 H2@670,260", wires: "GEN-H0 H1b-GND GEN-H2",
  win: { litAll: true }, sol: "w H0b GND; w GEN H1; w H2b GND" });
L({ world: "storm", title: "Backup battery", teach: "A backup battery keeps the lights on when the power line goes down.",
  goal: "The lighthouse (H0) must stay lit even if every GEN wire is cut.", hint: "Wire H0 to GEN and to the charged battery.",
  parts: "H0@600,260 B0@380,470:12", win: { backup: ["H0"] }, sol: "w GEN H0; w H0b GND; w B0 H0; w B0b GND" });
L({ world: "storm", title: "Shortcut storm", teach: "Lightning left two shortcut wires behind.",
  goal: "Remove the shortcuts and light both houses.", hint: "Look for wires joining a part's two dots, and one straight from GEN to GND.",
  parts: "H0@380,260 H1@620,260", wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND H0-H0b GEN-GND",
  win: { litAll: true }, sol: "u H0 H0b; u GEN GND" });
L({ world: "storm", title: "Tide power", env: { plant: "tidal" }, teach: "The tidal plant is strong: five houses at once.",
  goal: "Light all five houses with the tidal plant.", hint: "Every house needs a loop; share wires.",
  parts: "H0@300,260 H1@450,260 H2@600,260 H3@450,450 H4@600,450",
  win: { litAll: true }, sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w GEN H3; w H3b GND; w H3 H4; w H4b H3b" });
L({ world: "storm", title: "Two paths", teach: "Two paths to the same house: if a storm cuts one, the other still works.",
  goal: "H0 must stay lit whichever ONE wire gets cut.", hint: "Join H0 to GEN two ways (directly and through H1), and to GND two ways too.",
  parts: "H0@600,260 H1@380,260", win: { redundant: ["H0"] },
  sol: "w GEN H0; w GEN H1; w H1 H0; w H0b GND; w H1b GND; w H1b H0b" });
L({ world: "storm", title: "Low tide", env: { genScale: 0.7, plant: "tidal" }, teach: "At low tide the tidal plant pushes less. The battery helps.",
  goal: "It's low tide. Light both houses.", hint: "Wire the full battery beside the generator (to GEN and GND).",
  parts: "H0@380,260 H1@600,260 B0@490,470:12", wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND",
  win: { litAll: true, lastSeconds: { ids: ["H0", "H1"], seconds: 10 } }, sol: "w GEN B0; w B0b GND" });
L({ world: "storm", title: "Lighthouse beam", teach: "Backup power for a light, too.",
  goal: "The beacon LED must stay on even if every GEN wire is cut.", hint: "Feed R0 from both GEN and the battery's orange dot.",
  parts: "B0@330,470:12 R0@470,430:470 L0@600,440", win: { lit: ["L0"], backup: ["L0"] },
  sol: "w GEN R0; w R0b L0; w L0b GND; w B0 R0; w B0b GND" });
L({ world: "storm", title: "Storm budget", hard: true, teach: "Fix it fast and cheap.",
  goal: "One line fell in the storm. Reconnect it — copper is tight.", hint: "Both houses share their wires. Tap a dark house to find the missing one.",
  parts: "H0@340,260 H1@520,260", wires: "GEN-H0 H0-H1 H1b-H0b", win: { litAll: true }, sol: "w H0b GND" });
L({ world: "storm", title: "Storm-proof hospital", teach: "Two paths AND a backup: nothing stops this hospital.",
  goal: "The hospital must stay lit if any one wire is cut — AND with every GEN wire cut.", hint: "Two paths to GEN and GND, plus the battery.",
  parts: "H0@620,260:hospital H1@380,260 B0@480,470:12", win: { redundant: ["H0"], backup: ["H0"] },
  sol: "w GEN H0; w GEN H1; w H1 H0; w H0b GND; w H1b GND; w H1b H0b; w B0 H0; w B0b GND" });
L({ world: "storm", title: "Captain Gale's harbour", env: { plant: "tidal" }, teach: "A harbour ready for any storm.",
  goal: "Light everything, and the beacon LED needs a backup battery.", hint: "Houses on GEN; the beacon through R0 from GEN and from B0.",
  parts: "H0@300,260 H1@450,260 H2@600,260 B0@330,470:12 R0@480,430:470 L0@620,440",
  win: { litAll: true, backup: ["L0"] },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w GEN R0; w R0b L0; w L0b GND; w B0 R0; w B0b GND" });

// --- Moon Base ---
L({ world: "moon", title: "Moon sunshine", teach: "No clouds on the Moon: the sun shines bright all day.",
  goal: "Light the first moon dome (H0) with sunshine.", hint: "Loop: S0 → H0 → back to S0's blue dot.",
  parts: "S0@380,260 H0@620,260", win: { lit: ["H0"], noGen: true }, sol: "w S0 H0; w H0b S0b" });
L({ world: "moon", title: "Lunar night", env: { night: true, genScale: 0 }, teach: "The Moon's night is long and dark. Batteries!",
  goal: "Light both domes through the lunar night.", hint: "Both domes on the battery.",
  parts: "B0@460,470:12 H0@340,260 H1@600,260", win: { litAll: true, lastSeconds: { ids: ["H0", "H1"], seconds: 10 } },
  sol: "w B0 H0; w H0b B0b; w H0 H1; w H1b H0b" });
L({ world: "moon", title: "Rover's LED", teach: "Same rules on the Moon: an LED needs its resistor.",
  goal: "Light the rover's LED.", hint: "Pick the Medium resistor.",
  parts: "L0@600,440", tool: "RES:100 RES:470", win: { lit: ["L0"] }, sol: "p RES 420 430 470; w GEN R0; w R0b L0; w L0b GND" });
L({ world: "moon", title: "Airlock", teach: "An airlock opens only when both buttons are pressed: AND.",
  goal: "The airlock light (H0) comes on only when T0 AND T1 are on.", hint: "Switches in a row.",
  parts: "T0@300,250 T1@440,250 H0@620,260", win: { truth: { switches: ["T0", "T1"], want: ALL2((a, b) => ({ H0: a && b })) } },
  sol: "w GEN T0; w T0b T1; w T1b H0; w H0b GND" });
L({ world: "moon", title: "Crater line", teach: "Across the crater: step up, send, step down.",
  goal: "Light the far dome through the long cable.", hint: "Up ×2 near GEN, down ×0.5 near the dome.",
  parts: "R0@460,430:12 H0@740,260", tool: "XFMR:2 XFMR:0.5", win: { lit: ["H0"], needs: { H0: "R0" } },
  sol: "p XFMR 300 460 2; p XFMR 610 460 0.5; w GEN X0P; w X0 R0; w R0b X1P; w X1 H0; w H0b GND" });
L({ world: "moon", title: "Fusion power", env: { plant: "fusion" }, teach: "The fusion reactor: a tiny star in a box. Light the whole base!",
  goal: "Light all six domes.", hint: "Every dome needs a loop. Share wires.",
  parts: "H0@300,260 H1@450,260 H2@600,260 H3@300,450 H4@450,450 H5@600,450",
  win: { litAll: true }, sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b; w GEN H3; w H3b GND; w H3 H4; w H4b H3b; w H4 H5; w H5b H4b" });
L({ world: "moon", title: "Safe base", teach: "On the Moon, nothing can be allowed to fail.",
  goal: "The command dome (H0) must stay lit whichever ONE wire is cut.", hint: "Two paths to GEN and two to GND.",
  parts: "H0@620,260 H1@380,260", win: { redundant: ["H0"] }, sol: "w GEN H0; w GEN H1; w H1 H0; w H0b GND; w H1b GND; w H1b H0b" });
L({ world: "moon", title: "Rocket budget", hard: true, teach: "Rockets are expensive. Wires shouldn't be!",
  goal: "Light both domes from the solar panel — copper is tight.", hint: "The panel is between the domes: wire each one straight to it.",
  parts: "H0@380,260 S0@520,260 H1@660,260", env: { solarFactor: 1.6 }, win: { litAll: true, noGen: true },
  sol: "w S0 H0; w H0b S0b; w S0 H1; w H1b S0b" });
L({ world: "moon", title: "Star string", teach: "A string of stars on the Moon.",
  goal: "Light the string of three LEDs.", hint: "One resistor, three LEDs in a row.",
  parts: "R0@280,430:330 L0@400,440 L1@520,440 L2@640,440", win: { chain: ["L0", "L1", "L2"] },
  sol: "w GEN R0; w R0b L0; w L0b L1; w L1b L2; w L2b GND" });
L({ world: "moon", title: "One giant leap", teach: "Everything you've learned, all at once. You're the best engineer in ECE City!",
  goal: "Light every dome and LED. The command dome (H0) needs a backup battery; switch T0 runs the beacon L0.",
  hint: "Domes on GEN (H0 also on B0), and GEN → T0 → R0 → L0 → GND for the beacon.",
  parts: "H0@300,260 H1@450,260 B0@330,470:12 T0@560,250 R0@600,430:470 L0@720,440", env: { plant: "fusion" },
  win: { lit: ["H0", "H1"], backup: ["H0"], truth: { switches: ["T0"], want: { "1": { L0: 1 }, "0": { L0: 0 } } } },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w B0 H0; w B0b GND; w GEN T0; w T0b R0; w R0b L0; w L0b GND" });

// --- Expert ---
// One per world, opens after its ten levels. Bigger boards, traps, and no copper to spare.
L({ world: "sparkville", expert: true, title: "Expert: The estate", teach: "Everything from Sparkville at once: loops, sharing wires, shortcuts and resistors in the way.",
  goal: "Light all three houses bright. Two things are wrong — and copper is very tight!",
  hint: "Remove the shortcut across H1 and the big resistor feeding H2. Then share wires: H0 to GEN and GND, H1 onto H0, H2 onto H1.",
  parts: "H0@330,260 H1@480,260 H2@630,260 R0@780,430:1000", wires: "GEN-R0 R0b-H2 H2b-GND H1-H1b",
  win: { lit: ["H0", "H1", "H2"] },
  sol: "u H1 H1b; u GEN R0; u R0b H2; u H2b GND; w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H1 H2; w H2b H1b" });
L({ world: "batterybay", expert: true, title: "Expert: Storm harbour", teach: "A battery only saves you if it's full when the storm hits.",
  goal: "Light both harbour houses, and fill battery B0 so they'd stay lit if every wire to GEN were cut.",
  hint: "Wire the houses to GEN, put B0 (or C0) side by side with them, then wait for it to fill up before the storm.",
  parts: "B0@330,470:0 C0@470,460:220:0 H0@620,260 H1@770,260", tool: "",
  win: { lit: ["H0", "H1"], backup: ["H0", "H1"] },
  sol: "w GEN H0; w H0b GND; w H0 H1; w H1b H0b; w H0 B0; w B0b GND; t 150" });
L({ world: "solardesert", expert: true, title: "Expert: Night market", env: { solarFactor: 1.5 }, teach: "Two solar panels side by side push more current than one.",
  goal: "Light both market stalls with sunshine only — no generator — and charge battery B0 to 8 volts for later.",
  hint: "Join the two panels side by side (orange to orange, blue to blue), then the stalls and the battery across them.",
  parts: "S0@300,260 S1@440,260 B0@330,470:3 H0@620,260 H1@770,260",
  win: { lit: ["H0", "H1"], noGen: true, capAtLeast: { B0: 8 } },
  sol: "w S0 S1; w S0b S1b; w S1 H0; w H0b S1b; w H0 H1; w H1b H0b; w S0 B0; w B0b S0b; t 60" });
L({ world: "mountains", expert: true, title: "Expert: Peak to peak", teach: "Two cabins at the end of one long line: step up to send, step down to use.",
  goal: "Light both far cabins through the long line R0 (the power must go through it).",
  hint: "Two cabins need a lot of current, so ×2 isn't enough: step up ×4 right after GEN, then the long line, then step down ×0.25. Both cabins share the stepped-down side.",
  parts: "R0@480,430:12 H0@650,260 H1@790,260", tool: "XFMR:2 XFMR:0.5 XFMR:4 XFMR:0.25 RES:100",
  win: { lit: ["H0", "H1"], needs: { H0: "R0", H1: "R0" } },
  sol: "p XFMR 320 460 4; p XFMR 620 460 0.25; w GEN X0P; w X0 R0; w R0b X1P; w X1 H0; w H0b GND; w H0 H1; w H1b H0b" });
L({ world: "windmill", expert: true, title: "Expert: Festival lights", env: { genScale: 0.85, plant: "wind" }, teach: "Strings share the push; things side by side each get all of it.",
  goal: "Light the LED string (L0 then L1, one resistor) AND both tents side by side, on a light breeze.",
  hint: "GEN → R0 → L0 → L1 → GND for the string. Each tent gets its own loop (they can share wires).",
  parts: "R0@300,430:330 L0@420,440 L1@540,440 H0@660,260 H1@800,260",
  win: { chain: ["L0", "L1"], parallel: ["H0", "H1"] },
  sol: "w GEN R0; w R0b L0; w L0b L1; w L1b GND; w GEN H0; w H0b GND; w H0 H1; w H1b H0b" });
L({ world: "waterfall", expert: true, title: "Expert: Ranger's signals", teach: "Bigger resistance, less current: pick each resistor for its job.",
  goal: "L0 bright, L1 just glowing (dim), and the cabin H0 lit. Don't pop anything!",
  hint: "Medium (470Ω) in front of L0, Large (1000Ω) in front of L1. The Small one is a trap.",
  parts: "L0@420,440 L1@600,440 H0@760,260", tool: "RES:100 RES:470 RES:1000",
  win: { lit: ["L0", "H0"], dim: ["L1"] },
  sol: "p RES 300 430 470; p RES 500 430 1000; w GEN R0; w R0b L0; w L0b GND; w GEN R1; w R1b L1; w L1b GND; w GEN H0; w H0b GND" });
L({ world: "neon", expert: true, title: "Expert: Marquee", teach: "Two LED strings, each with its own resistor — and one switch for the whole sign.",
  goal: "Light all four LEDs, and make switch T0 turn the WHOLE sign on and off.",
  hint: "GEN → T0, then from T0's blue dot: R0 → L0 → L1 → GND, and R1 → L2 → L3 → GND.",
  parts: "T0@260,250 R0@350,430:330 L0@440,440 L1@530,440 R1@620,430:330 L2@710,440 L3@800,440",
  win: { ledsOn: 4, truth: { switches: ["T0"], want: { "1": { L0: 1, L1: 1, L2: 1, L3: 1 }, "0": { L0: 0, L1: 0, L2: 0, L3: 0 } } } },
  sol: "w GEN T0; w T0b R0; w R0b L0; w L0b L1; w L1b GND; w T0b R1; w R1b L2; w L2b L3; w L3b GND" });
L({ world: "tundra", expert: true, title: "Expert: Polar night", env: { night: true, genScale: 0 }, teach: "A capacitor empties in a blink. A battery lasts the night.",
  goal: "The generator is frozen solid. Keep both igloos lit for 20 seconds.",
  hint: "Use the battery B0, not the capacitor — the capacitor runs dry in seconds.",
  parts: "C0@320,460:1000:12 B0@470,470:12 H0@640,260 H1@790,260",
  win: { litAll: true, lastSeconds: { ids: ["H0", "H1"], seconds: 20 } },
  sol: "w B0 H0; w H0b B0b; w H0 H1; w H1b H0b" });
L({ world: "volcano", expert: true, title: "Expert: Evacuation", teach: "When power is short, the hospital comes first — and it needs a backup.",
  goal: "Hospital H0 and school H1 bright, the bakery H2 OFF, and the hospital must stay lit with every wire to GEN cut.",
  hint: "Unplug the bakery. Give the hospital battery B0 side by side, as a backup.",
  parts: "H0@330,260:hospital H1@500,260:school H2@670,260:bakery B0@760,470:12",
  wires: "GEN-H0 H0b-GND GEN-H1 H1b-GND GEN-H2 H2b-GND",
  win: { lit: ["H0", "H1"], dark: ["H2"], backup: ["H0"] },
  sol: "u GEN H2; w B0 H0; w B0b GND" });
L({ world: "robot", expert: true, title: "Expert: Factory logic", teach: "Mix AND and OR: (T0 AND T1) OR T2.",
  goal: "Lamp H0 is on when T0 AND T1 are both on — OR when T2 is on.",
  hint: "T0 then T1 in a row from GEN to H0. Then T2 side by side with that pair (GEN to H0's orange dot).",
  parts: "T0@280,250 T1@420,250 T2@350,450 H0@640,260",
  win: { truth: { switches: ["T0", "T1", "T2"], want: ALL3((a, b, c) => ({ H0: (a && b) || c })) } },
  sol: "w GEN T0; w T0b T1; w T1b H0; w H0b GND; w GEN T2; w T2b H0" });
L({ world: "storm", expert: true, title: "Expert: Hurricane-proof", teach: "Two paths for every wire, and a battery for when the lines go down.",
  goal: "H0 and H1 must stay lit whichever ONE wire is cut — and H0 must also stay lit if every wire to GEN goes.",
  hint: "Give each house two paths to GEN and two to GND, and put battery B0 beside H0.",
  parts: "H0@420,260 H1@650,260 B0@760,470:12",
  win: { redundant: ["H0", "H1"], backup: ["H0"] },
  sol: "w GEN H0; w GEN H1; w H0 H1; w H0b GND; w H1b GND; w H0b H1b; w B0 H0; w B0b GND" });
L({ world: "moon", expert: true, title: "Expert: Mission control", env: { plant: "fusion" }, teach: "The final exam: lines, logic, LEDs and backup — all on one board.",
  goal: "Far dome H0 through the long cable R0; command dome H1 with a battery backup; switch T0 runs the beacon string L0 → L1.",
  hint: "Up ×2, cable, down ×0.5 to H0. H1 on GEN with B0 beside it. GEN → T0 → R1 → L0 → L1 → GND.",
  parts: "R0@550,430:12 H0@800,260 H1@330,260 B0@330,470:12 T0@460,250 R1@650,250:330 L0@720,440 L1@810,440", tool: "XFMR:2 XFMR:0.5",
  win: { lit: ["H0", "H1"], needs: { H0: "R0" }, backup: ["H1"], truth: { switches: ["T0"], want: { "1": { L0: 1, L1: 1 }, "0": { L0: 0, L1: 0 } } } },
  sol: "p XFMR 450 460 2; p XFMR 640 460 0.5; w GEN X0P; w X0 R0; w R0b X1P; w X1 H0; w H0b GND; w GEN H1; w H1b GND; w B0 H1; w B0b GND; w GEN T0; w T0b R1; w R1b L0; w L0b L1; w L1b GND" });
