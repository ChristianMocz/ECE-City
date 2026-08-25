# CHANGES.md

What changed in this pass, why, what was deliberately left out, and what's still weak. See `AUDIT.md` for the pre-rewrite findings this addresses and `DESIGN.md` for the research behind the new UX. Every claim about the physics below is backed by a hand-derived, independently-checked test in `tests/sim.test.mjs` (16/16 passing) — not just asserted here.

## The core fix: the simulation now models a real circuit

The single biggest change is architectural, not cosmetic: every component that used to be "a node with a resistance shunted straight to an abstract ground" is now a genuine **two-terminal** part — a hot lead and a return lead, both real, independently-wireable graph nodes, exactly like a real component has two leads. That single change is what makes the following honest instead of hand-waved:

- **A closed loop is now required for current to flow at all** (AUDIT.md B1). This isn't a special "is it grounded?" check bolted onto the solver — it's an emergent property of standard nodal analysis once GND is a real, separately-reachable node. A wire from the generator to a house with no way back to GND now shows the true, honest result: full source voltage sitting on the dangling wire, and exactly zero current, because nothing is pulling current through it. That's not a compromise — it's what a voltmeter across an open circuit actually reads in real life.
- **The generator sags under load** (B2). GEN is modeled as an ideal 12V EMF behind a real internal resistance (`R_GEN = 1.5Ω`, reasoning and the worked numbers are in `state.js`). One house barely dents it; ten houses brown the grid out. There's also a live "supplying X.XXA" readout on the generator now, so a kid can actually see it working harder.
- **The transformer references its own primary, not a hardcoded constant, and conserves power** (B3). This needed a proper extra unknown in the linear system (an ideal-transformer MNA stamp — see the long comment in `sim.js`) rather than treating the secondary as an independent second voltage source. Stepping voltage up now visibly costs current on the primary side; the math makes power-in equal power-out as a structural property of the equations, not a rule I coded separately.
- **LEDs are modeled as diodes, not resistors** (B4). A real LED has a forward voltage drop (~2V) and barely conducts below it — it isn't ohmic. Wire one straight to the generator with no resistor and it now visibly pops (with a little cartoon burst and a plain-language explanation), exactly like a real LED would. It's free and instant to replace — no score penalty, no lecture, just try again with a resistor.
- **A resistor's on-screen value now matches what's actually simulated** (B5). No more silent doubling.
- **A transistor OFF is a true open circuit**, not "extra resistance" — closing/opening it is now a dedicated tap on the component's body, completely separate from the wiring dots, which also incidentally fixes the old ambiguity where toggling a switch could silently eat a click meant for something else (B11).

One real mid-build correction worth being honest about: my first pass at this kept the old "shunt straight to an abstract 0V" model for loads and just added a gate on top of it. The test suite caught that this created a redundant, near-zero-resistance shortcut around real return-path resistance the moment a load also had an actual wire to GND — a load hanging off the far end of a chain of resistors would ignore that chain and behave as if directly grounded. That's exactly the kind of "looks fixed, isn't" bug the brief warned about, and it's why the two-terminal redesign happened instead of shipping the first draft.

## Everything else from AUDIT.md

- **B6** — the undefined, unused `capSlowFactor` is gone; there's one documented capacitor time-scale knob now (`CAP_TIME_SCALE`), with the target ~3-second charge curve worked out and verified in the test suite.
- **B7** — delete (tap a part or a wire in the DELETE tool), undo/redo (snapshot-based, 50 steps deep), and Clear All with an in-canvas confirmation (not a native `confirm()`).
- **B8** — starter layout rebuilt on a taller canvas (640px) with everything, including the new terminal dots, verified on-canvas.
- **B9/B10** — every tool switch now goes through one function that always clears a dangling wire preview first; clicking a wire's own start point a second time now cancels cleanly with a status message instead of leaving an orphaned line.
- **B12** — the solver throws on a singular/ill-conditioned matrix instead of quietly returning zeros; `computePower` catches it and sets `state.solverError`, which the UI can (and should, going forward) surface distinctly from "genuinely unpowered."
- **B13/B14** — dead fallback paths and the fixed-`dt` capacitor-on-event-recompute quirk are gone as a side effect of the broader rewrite.

## Design research actually shipped (see DESIGN.md for the full research)

- **Moving current dots** along every wire, speed and density scaled by current, direction matching current sign — motion works without color vision, so it's a genuine second channel, not just a repaint (PhET steal).
- **Green→yellow→red wire tinting** as load approaches a documented (cosmetic) threshold, layered on top of the dots (Poly Bridge steal).
- **No more `window.prompt()`** anywhere — resistor/capacitor/transformer values are picked from large in-canvas preset buttons (Toca Boca steal). The resistor presets are a deliberately worked teaching curve (documented in `state.js`): the small one isn't enough to save an LED, the medium one is exactly right, the large one is safe but dimmer — verified by the test suite, not just eyeballed.
- **Kid-friendly, reversible failure**: an LED pop is a short animation plus a one-line, plain-language explanation, never a score penalty (Kerbal Space Program steal).
- **Fewer visible choices by default**: numbers are off until a kid opts in (one "Show Numbers" toggle instead of four separate ones), and the toolbox is consolidated (Toca Boca/Sago Mini steal).
- **Responsive canvas**: real viewport meta tag, `Phaser.Scale.FIT` + auto-center, so this actually works on a tablet now instead of being silently clipped.
- **Pinned Phaser version** (`3.90.0`) instead of an unpinned `@3` CDN tag that could break the whole game on any future major release with zero code changes on our end.

## Verification

- `tests/sim.test.mjs` — 16 solver tests, run in-browser (`tests/run-in-browser.html`; this machine has no Node.js installed, otherwise `node tests/sim.test.mjs` works too since it's plain ESM with no framework dependency). Covers series/parallel/divider against independently-computed textbook formulas, open circuit, a near-short, generator sag, transformer power conservation, capacitor RC curve shape (~63% at one time constant), LED burn thresholds for all three resistor presets, the resistor double-counting fix, and transistor switching.
- The actual game was exercised end-to-end by driving Phaser's real event system programmatically (not just unit-testing the solver in isolation): placing every component type, wiring a house into the starter grid, deleting a wire and a whole component, undo, redo, an LED burning out unprotected and surviving protected, a transformer under real load, a capacitor's voltage climbing monotonically over ~100 simulated frames, RUN CHECK tallying correctly (including a "popped" LED count), the preset-picker overlay firing its callback, and Clear-All's confirm flow actually clearing (and leaving GEN/GND alone). No console errors at any point.

## Deliberately not done this pass

Scoped out to keep this change reviewable and to not ship five half-finished features instead of one solid rewrite:

- **Challenge/level mode** with a taught progression (light one house → three → a component that fails → step voltage down for a neighborhood). Sandbox mode only, for now.
- **A draggable multimeter/probe tool.** Numbers are currently a toggle, not something you "measure" by touching a wire — a real probe tool is a natural next step and was scoped out of DESIGN.md's synthesis for exactly this reason.
- **Per-component "how it works" panels.**
- **Achievements/sticker book, day/night or weather demand cycle, save/load or shareable builds.**
- **Full accessibility pass**: the dual-coding (motion + color) for current is done, but contrast ratios haven't been measured against WCAG AA with a real tool, and there's no keyboard navigation at all yet — the whole interaction model is still pointer-only.
- **House "burnout."** Only LEDs can fail this pass; houses are a lumped abstraction without a real single failure point the way a specific LED current rating gives one.
- **An "Advanced: exact value" numeric entry** alongside the presets — right now presets are the only way to set a value; a power-user escape hatch (probably a slider, definitely not `prompt()`) is a reasonable follow-up.
- **A hard generator capacity/breaker mechanic.** The Thevenin sag models "load affects voltage" honestly, but there's no hard cutoff/overload state — the grid just gets dimmer, it doesn't ever truly fail from too much load.

## Still weak, and worth knowing about

- The transformer's primary and secondary share the same GND reference rather than being galvanically isolated the way a real transformer is — documented as a deliberate simplification in `sim.js`, but a student who goes on to study real transformer isolation will eventually need to unlearn this specific piece.
- Wire-coloring thresholds (`WIRE_WARM_I`/`WIRE_HOT_I`) are a reasoned estimate against this sandbox's typical currents, not measured against real wire gauge ampacity — they're a cosmetic "getting busy" cue, not a claim about real wire safety.
- There's no automated browser test in CI — verification this pass was thorough but manual (see above). A lightweight Playwright smoke test would be a good next investment before this grows much further.
- `state.solverError` is now surfaced as data, but the in-game messaging for it is a single generic status line ("can't calculate this circuit") rather than anything that teaches a kid *why* — reasonable for the rare ill-conditioned edge case it's guarding against, but not polished.
