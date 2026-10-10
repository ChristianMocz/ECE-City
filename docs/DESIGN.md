# DESIGN.md

Phase 2 research: what other games get right about teaching a real technical system to a young or novice audience, and what ECE City should specifically steal. Web search was available and used for all six references below; sources are linked at the end of each section. This document is findings + concrete decisions, not a mood board — every steal below is tied to a specific Phase 4/5 item in the original brief so Phase 3–5 can implement directly off this list.

---

## 1. PhET Interactive Simulations — Circuit Construction Kit

**What it does:** renders current as small charges physically moving along the wire path, not as a number printed somewhere near it. PhET's own research principles (published design guidelines) name four goals explicitly: give the learner a sense of autonomy/ownership over their own exploration, present the *expert visual model* of the phenomenon (not a diagram of it — the phenomenon itself, moving), tie it to real-world objects and language, and keep it game-like enough to trigger curiosity rather than assign a worksheet.

**What we steal:**
- **Moving-dot current animation, literally along the wire polyline.** This is the single highest-leverage item in the entire brief ("making electricity visible" is called out as the top-priority ask) and PhET's answer is the reference implementation: dot density and speed scale with `|I|`, direction of travel matches the sign of current. Zero current = no motion at all, which is itself informative (an open/broken circuit visibly stops moving rather than requiring the player to read "I = 0.00A"). This also gives us a *non-color* channel for "how much current" — solving part of the color-alone accessibility problem from the audit, since motion speed doesn't require color vision at all.
- **A detachable probe/meter tool, not numbers welded to every device.** PhET's ammeter/voltmeter are objects you pick up and place on a wire or across two points — metering is something you *do*, not ambient text. This maps directly onto Phase 5's "draggable multimeter" ask, and gives us a natural way to implement the audit's "Beginner mode hides the numbers" requirement: in Beginner mode, no V/I text exists anywhere until the player picks up the probe and touches it to something.
- **Components that look like the real object.** PhET's resistor sprite reads as a resistor (color bands) at a glance; our current abbreviated 4-letter labels (`XFMR`, `TRANS`) fail this on purpose-inversion — steal the principle, not the exact art: every device icon should be recognizable *before* reading its label, addressing Phase 4's "tool discovery" ask directly.

Sources: [Circuit Construction Kit: DC — PhET](https://phet.colorado.edu/en/simulations/legacy/circuit-construction-kit-dc), [PhET Simulation Design Process (PDF)](https://phet.colorado.edu/publications/phet_design_process.pdf), [PhET Interactive Simulations research](https://phet.colorado.edu/en/research)

---

## 2. Human Resource Machine / 7 Billion Humans (Tomorrow Corporation)

**What it does:** teaches an assembly-language-adjacent programming model to people who have never programmed, with close to zero written instruction. The trick is a physical metaphor (office workers moving numbered boxes) standing in for the abstract system (registers, memory, instructions), plus puzzles that each introduce exactly one new mechanic by *making it the only thing you can do* in that level, rather than explaining it in a paragraph first.

**What we steal:**
- **One new concept per level, taught by restricting the toolbox, not by a tutorial box.** Level 1 of Challenge mode should have *only* the wire tool available (house and generator pre-placed) — the player physically cannot do anything except complete the loop, so they learn "circuits must be closed" by being unable to do anything else, not by reading it. This is the direct mechanism for Phase 4's "understand the goal within ten seconds, without reading a paragraph" and Phase 5's progression ask (light one house → three → a component that burns out → step-down for a neighborhood).
- **Rename by metaphor, not abbreviation.** HRM never says "accumulator" — it says "the thing in your hands." Our component names should follow the same instinct: not necessarily inventing cute names for real components (a resistor should still eventually be called a resistor, since this is meant to teach real ECE 110 vocabulary and lying about the name would undercut the "correct physics" mandate) but *leading* with a plain-language descriptor and icon, with the real term as secondary/reinforcing label once a kid is already looking at the right picture. E.g. button reads a resistor icon + "Resistor" (not `RES`), transformer icon + "Voltage Changer (Transformer)".
- **A recurring character with personality carries feedback instead of a status bar.** Steal for our failure/status messaging (see KSP below, same underlying idea) — short in-character lines beat a build-log-style status string.

Sources: [7 Billion Humans — Tomorrow Corporation](https://tomorrowcorporation.com/7billionhumans), [7 Billion Humans — Wikipedia](https://en.wikipedia.org/wiki/7_Billion_Humans)

---

## 3. Factorio / Mindustry

**What it does:** both make an otherwise-invisible system (item/power throughput) legible through constant ambient visual signals — belts show flow directly, and both games use small persistent alert icons over anything that's jammed, starved, or unpowered, so a problem is spottable across the whole map without reading a single number.

**What it gets wrong when done badly** (and is directly relevant to us): community consensus on both games is that weak onboarding is the actual failure point, not the systems' complexity — new players restart repeatedly and blame the genre when the real issue is being dropped into a sandbox with no goal, which is exactly ECE City's current state.

**What we steal:**
- **A small persistent alert glyph over anything unpowered/broken**, independent of the moving-current dots — e.g. a tiny "!" or unplugged-icon badge over a dark house, so a kid scanning a big build can spot the problem house without inspecting each one. Cheap to implement (just another sprite gated on `powered.level`), high legibility payoff.
- **Do not open on a bare sandbox.** Factorio/Mindustry both work today because tutorials/campaigns exist *alongside* the sandbox for people who want structure first. Confirms the brief's own instinct to keep Challenge mode and Sandbox mode as clearly separate, sequenced experiences rather than one screen trying to be both.

Sources: [Best Factory Games for Beginners — Game Foundry](https://gamefoundry.games/blog/factory-games-best-tutorials-beginners), [Factory Games Where Watching the Machine Run Is the Whole Point](https://gamefoundry.games/blog/factory-games-most-satisfying-automation)

---

## 4. Poly Bridge

**What it does:** color-codes structural stress directly on the bridge members during simulation — green means fine, red means about to snap — and offers a dedicated "stress view" toggle plus (via a well-known community mod) an option to pause the instant something breaks, so cause and effect are never missed in a fast simulation.

**What we steal:**
- **Green → yellow → red load coloring on wires, driven by how close `|I|` is to a defined safe limit, not just an on/off state.** This is a direct upgrade over our current "wire label says a number" approach and, combined with the PhET-style moving dots (dots speed up *and* the wire tints red as it approaches its limit), gives current a dual-coded (motion + color) representation — addressing the audit's "communicated by color alone" finding, since the *motion* still reads correctly to a colorblind player even if the red tint doesn't.
- **A deliberate beat on the moment of failure**, not an instant silent disappearance. When a component burns out, borrow Poly Bridge's "pause on break" instinct: a brief freeze-frame/flash + callout, so a kid watching seven components at once actually sees which one failed and can trace back why, instead of just noticing something's missing thirty seconds later.

Sources: [Poly Bridge 2 review — Shacknews](https://www.shacknews.com/article/118338/poly-bridge-2-review-trussing-the-process), [StressTypeVisualization mod — GitHub](https://github.com/56kyle/StressTypeVisualization)

---

## 5. Kerbal Space Program

**What it does:** failure is frequent, visually dramatic, and has a real consequence (you lose the rocket, sometimes a Kerbal) — but the tone treats it as a funny, informative beat rather than a punishment, largely carried by the Kerbals' own goofy, unbothered reactions. The design lesson repeatedly cited: consequence without punishment makes the *next* success feel earned instead of just relieving anxiety.

**What we steal:**
- **Component failure = a small, funny, explanatory beat, always reversible for free.** An LED that's overdriven doesn't just vanish or silently stay "ON" (today's bug) — it visibly pops (cartoon puff, not anything grim), and a short speech-bubble line in kid language explains why ("Too much power came through — I need a resistor to slow it down!"). Replacing it costs nothing and takes one click. This directly satisfies Phase 5's "components that can break, visibly and reversibly, with an explanation" and Phase 4's "communicate why in kid language, funny rather than punishing," using the same underlying idea KSP uses for exploded rockets.
- **No score penalty, ever, for a broken component in Sandbox mode.** Failure there is purely informational. (Challenge mode can track attempts/stars separately — see Toca Boca note below on keeping *that* separate from free play.)

Sources: [Kerbal Space Program review — PC Gamer](https://www.pcgamer.com/kerbal-space-program-review/), [Kerbal Space Program review — GameSpot](https://www.gamespot.com/reviews/kerbal-space-program-review/1900-6416128/)

---

## 6. Toca Boca / Sago Mini / Scratch

**What it does:** Toca Boca apps famously ship with no scores, no levels, and no text tutorials at all — interaction is taught entirely by "if you tap it, something obviously happens." Design principle repeatedly cited: the highest form of UX for young kids is simplicity *through elimination* — fewer choices visible per screen, not more affordances crammed in. Sago Mini specifically calls out softer sound and slower animation pacing to avoid overstimulation.

**What we steal:**
- **Kill `window.prompt()` entirely, replace with big tap targets, not a text field.** For resistor/capacitor/transformer values: a row of large preset "chip" buttons (e.g. three resistor sizes with a plain-language hint like "a little resistance / medium / a lot") in Beginner mode. Advanced mode can reveal a drag-slider with the exact numeric value, but that's opt-in, not the default — directly implements Phase 5's Beginner/Advanced modes and Phase 4's "replace `prompt()`" ask in one mechanism.
- **Fewer visible choices at once.** Our current HUD shows all 7 tools + 4 toggles simultaneously regardless of mode. Steal Toca Boca's elimination instinct: Beginner mode shows a shorter, icon-only palette (wire, house, LED, resistor, generator is pre-placed) with everything else revealed only once Challenge mode unlocks it — reduces the "wall of small dark text" the brief specifically flags.
- **Sandbox mode stays genuinely consequence-free and score-free**, matching Toca Boca's open-ended-play philosophy exactly — reinforces the Phase 3/5 design decision to keep Sandbox and Challenge mode cleanly separate (Sandbox: no goals, no stars, breakage is just funny and free to fix; Challenge: has goals, hints, progression, and can track stars/completion).
- **Softer, quieter default audio and no fast strobing**, per Sago Mini's calmer pacing — feeds directly into the `prefers-reduced-motion` and "sound optional, off-switchable" requirements already in the brief.

Sources: [Designing for Kids — Ungrammary](https://www.ungrammary.com/post/designing-for-kids-ux-design-tips-for-children-apps), [UX Design for Kids — Gapsy](https://gapsystudio.com/blog/ux-design-for-kids/), [Sago Mini — Wikipedia](https://en.wikipedia.org/wiki/Sago_Mini)

---

## 7. Zachtronics (SpaceChem, SHENZHEN I/O, TIS-100, Exapunks)

**What it does:** builds deep, specific-solution engineering puzzles around real (or real-flavored) technical systems, and is well known for shipping an in-fiction "manual" — a beautifully art-directed document that explains the system diegetically rather than as a dry help page.

**What we steal:**
- **A per-component "how it works" panel styled like a little in-world spec sheet, not a wiki page** — picture of the real device, one or two plain-sentence facts, done. This is a lighter-weight, kid-appropriate version of the Zachtronics manual instinct, and directly implements Phase 5's "how it works panel per component, in plain language, with the real-world version pictured."
- Zachtronics puzzles are *not* the model for our onboarding pacing (they're deliberately hard and adult-facing) — the useful steal here is narrow and specific to the manual concept, not the difficulty curve. Noting this explicitly so Phase 4/5 doesn't over-index on "make it Zachtronics-hard."

Sources: [Zachtronics — Wikipedia](https://en.wikipedia.org/wiki/Zachtronics), [Interview: Zach Barth — Giant Bomb](https://www.giantbomb.com/profile/gamer_152/blog/interview-zach-barth-head-of-zachtronics/133319/)

---

## Synthesis — steals mapped to the brief, by phase

| Brief item | Steal | Source |
|---|---|---|
| Onboarding (10-second goal) | Level 1 restricts the toolbox to force the one lesson ("circuits must close") by doing, not reading | HRM/7BH |
| Tool discovery (no more `XFMR`) | Icon-first palette, real device silhouette recognizable before reading the label; plain-language primary label, real term secondary | PhET, HRM |
| Number entry (kill `prompt()`) | Big preset chip buttons in Beginner mode; slider in Advanced mode | Toca Boca/Sago Mini |
| Making electricity visible (top priority) | Moving dots along wires, speed/density = current, motion stops at zero — works without color | PhET |
| Making electricity visible (magnitude) | Green→yellow→red wire tint as load approaches a safe limit, layered on top of the dot animation (dual-coded, not color-only) | Poly Bridge |
| Failure, kid language, funny not punishing | Visible "pop," free/instant replace, one-line in-character explanation, no score penalty in Sandbox | KSP |
| Measurement tool | Detachable probe/meter object instead of ambient always-on numbers; also the mechanism for Beginner-mode number-hiding | PhET |
| Beginner/Advanced modes | Fewer visible choices by default; numbers and sliders are opt-in reveals, not the default state | Toca Boca |
| "How it works" panel | Small in-world spec card per component: picture + 1-2 plain sentences | Zachtronics |
| Progression / level design | One concept per level via toolbox restriction, not text; keep Sandbox and Challenge modes structurally separate | HRM/7BH, Factorio/Mindustry |
| Glanceable problem-spotting at scale | Small persistent alert badge over any unpowered/broken node, independent of the metering tool | Factorio/Mindustry |

Everything in this table is additive to the Phase 3 physics fixes already scoped in `AUDIT.md` — none of it requires the simulation model to be anything other than correct; if anything, several of these (the stress-coloring, the alert badges, the moving current dots) only become *honest* once loads actually require a closed loop and the generator actually sags under load, which is exactly the ordering `AUDIT.md` already recommends for Phase 3.

---

*Ready for review alongside `AUDIT.md`. No code has been changed. Next: Phase 3, the simulation rewrite.*
