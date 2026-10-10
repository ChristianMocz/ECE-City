# AUDIT.md

Pre-rewrite audit of ECE City as it existed at commit `c0337ea` ("Last update 1/13/2026"). Scope: `index.html`, `main.js`, `src/state.js`, `src/sim.js`, `src/ui.js`, `src/factory.js`. Every file was read in full, line by line, before any of this was written.

No build tooling, no test runner, no linter, no `package.json` exists yet — this is five hand-written files totaling ~950 lines.

---

## 1. Architecture map

**Single global mutable state object.** `state.js#createGameState()` returns one object that everything else reads and writes directly (no getters/setters, no events guarding mutation). It holds four different kinds of data mixed together with no separation:

- the circuit graph (`nodes: Map`, `wires: Array`)
- transient UI/tool state (`mode`, `wireStart`, `previewLine`)
- simulation *constants* that should never change at runtime (`R_HOUSE`, `V_HOUSE_ON`, `CAP_TIME_SCALE`, …)
- simulation *outputs* that are recomputed every solve (`nodeVoltages`, `powered`, `wireMetrics`)

Nothing enforces the boundary between "constant" and "output" — a future change to either looks identical at the call site. This is the root cause of several bugs below (a constant silently missing is indistinguishable from one that's just unused).

**Data flow, per frame:**

```
Phaser update(time, delta)
  → main.js: refreshPower(dt)
      → sim.js: computePower(state, dt)
          1. buildAdj(state)              — wires + node types → adjacency list, resistances
          2. reachableFrom("GEN", adj)    — BFS/DFS restricts solve to the powered island
          3. computeTransformerSources    — GEN-reachable XFMR nodes become fixed-V sources
          4. nodal analysis (A·V = b)     — Gaussian elimination, one unknown per remaining node
          5. capacitorCompanion per CAP   — backward-Euler companion conductance folded into A/b
          6. computeWireMetrics(state)    — per-wire R/I/V, keyed by "idA|idB" sorted
      → state.nodeVoltages / state.powered / state.wireMetrics updated
      → main.js pushes state.powered into device visuals (color, V/I text) — factory.js `set*Visual`
      → main.js pushes state.wireMetrics into wire label text
```

`sim.js` is properly decoupled from Phaser — it never touches a `container` or a `visual`, only `node.type`/`node.data` and `state.wires`. That boundary is good and should survive the rewrite. Everything downstream of `state.powered`/`state.wireMetrics` (rendering) lives in `main.js` and `factory.js`.

**Module ownership:**

| Module | Owns | Should not, but currently does |
|---|---|---|
| `state.js` | initial state shape, constants | nothing — but constants live undifferentiated next to mutable outputs |
| `factory.js` | Phaser scene-graph construction, color/visual state application | nothing (cleanest file) |
| `sim.js` | the solver | reads one constant (`capSlowFactor`) that `state.js` never defines |
| `ui.js` | HUD construction, tool switching, numeric input via `window.prompt` | owns *no* state itself, correctly delegates to callbacks — good pattern |
| `main.js` | scene lifecycle, node/wire graph mutation, event wiring, render-from-simulation | also does per-frame orchestration that has no business running unconditionally every frame (see §4) |

**Coupling:** `ui.js` and `main.js` communicate through two Phaser scene events (`toggles-changed`, `run-check`) plus direct state mutation — an acceptable lightweight pattern for this scale. The tighter coupling problem is that `main.js` and `sim.js` agree on the shape of `node.data` (`ohms`, `ratio`, `C`, `Vprev`, `on`) only by convention — nothing documents or validates it, so adding a device type means touching four files with no compiler or test to catch a missed one.

---

## 2. Bugs, dead code, and silent failures — ranked

### Critical

**B1. Loads have no return path — it's not a circuit, it's a lookup table.**
`computePower` (`sim.js:212-214`) adds load conductance as a term straight to a virtual ground: `if (Rload != null) sumG += 1 / Rload;`. There is no ground node in the graph, no second wire, no loop. A single wire from GEN to a HOUSE lights it. This directly contradicts the first thing any electronics student learns (current flows in a loop) and undermines everything else in the game — wiring "backwards" is currently no different from wiring correctly. Every downstream bug about the generator, transformer, and LED overcurrent traces back to this: there's no real circuit to enforce KVL/KCL against.

**B2. The generator is an infinite, lossless, unmonitored power source.**
`computeTransformerSources` (`sim.js:122`) hardcodes `sources.set("GEN", state.V)` — GEN voltage is *always* exactly 12.0V, full stop, regardless of how many houses are attached or how much current flows. There's no internal resistance, no capacity, no readout anywhere of total current draw. "Manage the grid" is the game's premise and there is currently nothing to manage — you cannot overload, brown out, or run out of capacity.

**B3. The transformer references the wrong voltage and manufactures energy.**
`computeTransformerSources` (`sim.js:128-129`) sets `V(XFMR) = ratio * state.V` — the *global generator constant*, not the solved voltage at whatever node feeds the transformer's primary. Put a resistor upstream of a transformer and its output doesn't drop, because the code never looks at the primary side at all. Worse, a step-up ratio (e.g. 2×) doubles voltage with the same current model as everywhere else, silently producing more power out than in — the single clearest "an EE student would have to unlearn this" bug in the codebase, since it violates conservation of energy, not just a simplification of it.

**B4. LEDs cannot be overdriven — there's no failure state, so there's no lesson.**
`R_LED = 30`, `V_LED_ON = 3.0`. Wire an LED straight to the 12V generator (nothing currently stops you) and it draws `12/30 = 0.4A` — 20× a real LED's rated current — while the game reports `level: "ON"` and renders it at full brightness (`setLEDVisual` clamps brightness to `V/V_LED_ON`, so 12V and 3V render identically once clamped). The most basic real-world lesson about LEDs — *they need a current-limiting resistor or they die* — is not just missing, it's actively contradicted: the "correct-looking" build (direct wire) works fine in-game and the "correct-in-reality" build (resistor in series) has no observable benefit over it.

### High

**B5. Inline components double their own resistance.**
`edgeResistance(state, fromNode, toNode)` (`sim.js:18-30`) adds a RES or ON-TRANS node's value to *any* edge touching that node. But a resistor placed "inline" between two other nodes has *two* wires touching it (in-edge and out-edge), and both edges independently add its resistance. A "2Ω" resistor wired `GEN — R2 — HOUSE` contributes `2 + 2 = 4Ω` to that path, not 2Ω. The on-screen label (`2.00Ω`) and the simulated value silently disagree by exactly 2×. This affects every RES placement and every ON transistor identically, since they share the same `edgeResistance` logic.

**B6. `sim.js` reads `state.capSlowFactor`, which `state.js` never defines.**
`sim.js:147`: `const slow = Math.max(0.001, Math.min(1.0, state.capSlowFactor ?? 0.04));` — grepped the whole repo; `capSlowFactor` is assigned nowhere. It silently falls back to `0.04` every time. This isn't just an unused constant — it means the capacitor's charge-time tuning is currently controlled by *two* independent, undocumented knobs that both claim to do the same job: `CAP_TIME_SCALE` (in `state.js`, actually wired up, scales `C` itself) and `capSlowFactor` (referenced only in `sim.js`, permanently defaulted, scales `dt`). Whoever wrote the second one clearly meant to expose it and never did. This is worth resolving by picking *one* slow-charge knob, not by just adding the missing property.

**B7. No delete, no undo, on anything.**
Confirmed by absence: there is no code path anywhere in `main.js` that removes an entry from `state.nodes` or `state.wires`, destroys a Phaser container, or unwires anything. Once placed, every component and wire is permanent for the life of the page. A single misclick is unrecoverable except by refreshing and losing the whole build. For a sandbox aimed at kids who will absolutely misclick, this is table-stakes, not a nice-to-have.

**B8. Starter house #3 renders partly below the canvas.**
`main.js:303`: `placeHouse(720, 480)`. `makeHouse` (`factory.js:57-84`) places `currLabel` at local y=`85`, so its absolute y is `480 + 85 = 565` against a **550px-tall canvas**. The current (I) readout — and part of the voltage readout right above it — is clipped off the bottom of the screen for that house, permanently, from the moment the page loads. (Bonus, lower-severity finding in the same spot: that house also sits visually on top of the road band, which is drawn from y=295–365 while the house lands at y=480 comfortably in the grass — so that part's fine — but its roof peak, `480 - 55 - 60(container offset) ≈ 365`, grazes the road's bottom edge. Not a rendering bug, just tight layout worth revisiting.)

### Medium

**B9. Dangling wire preview when switching tools mid-wire.**
Start a wire (click node A in WIRE mode — `state.wireStart` and `state.previewLine` are now set), then click any tool button in `ui.js` (HOUSE/RES/CAP/…). Every tool button handler only sets `state.mode`; none of them call `clearPreview()`. The scene's global `pointermove` handler (`main.js:306-310`) doesn't check `state.mode` at all — it keeps redrawing the preview line toward the mouse forever, and the ground `pointerdown` handler now routes to `placeHouse`/`placeRes`/etc. instead of the WIRE branch that would have cleaned it up. Net effect: a permanently orphaned line graphic that never gets removed unless the player happens to re-enter WIRE mode and start a *new* wire (whose `startWire()` calls `clearPreview()` as a side effect). This is exactly the "event handler can't fire because of a mode conflict" class of bug — the cleanup code exists, it's just unreachable from this path.

**B10. Clicking a wire's own start node again does nothing, silently.**
`finishWire(id)` (`main.js:130-157`): `if (a === b) return;` — bails out *before* calling `clearPreview()` or updating `status`. The preview line is left dangling and following the mouse (see B9's same root cause), and the player gets zero feedback that their click was ignored. Contrast with the "click empty ground while wiring" path, which does call `clearPreview()` and sets a status message — this is the same user intent (cancel/redo) hitting an inconsistent code path.

**B11. Transistor toggle silently overrides tool clicks.**
`registerNodeClicks` (`main.js:207-222`): the transistor-toggle branch fires whenever `state.mode !== Mode.WIRE`, with no check for which *placement* tool is active. If a player is in `Tool: HOUSE` mode and misclicks an existing transistor (its hit area is a fairly generous 150×130 box), the click is swallowed (`event.stopPropagation()`), the transistor silently toggles, and no house is placed — with no status text explaining why. A child will not know their click "worked," just differently than expected.

**B12. Solver silently returns all-zero voltages on a near-singular matrix instead of surfacing an error.**
`solveLinear` (`sim.js:75-101`): `if (Math.abs(M[pivot][col]) < 1e-12) return new Array(n).fill(0);`. Today this is close to unreachable in practice (every unknown node has a nonzero conductance term from `R_WIRE` at minimum, and the network is always anchored to a fixed-voltage source when it's solved at all) — but a user-entered resistor value at the extreme edges of what the `>0` validation in `ui.js` allows (e.g. `1e-9` or `1e12`) can ill-condition the matrix enough to hit this branch. When it does, the game reports every downstream house/LED as `OFF`, indistinguishable from "this circuit is genuinely unpowered." A broken/degenerate circuit and an unsolvable one currently look identical to the player. Phase 6 in the brief calls this out directly: a solver that returns zeros for a bad matrix is worse than one that throws — flagging for the rewrite to make this state visible (e.g. a distinct "ERROR" level) rather than silent.

### Low

**B13. Redundant dead fallbacks in `sim.js`.**
`toNode.data?.ohms ?? state.RES_DEFAULT_OHMS` and `node.data?.ratio ?? state.XFMR_DEFAULT_RATIO` can never actually use their fallback: `main.js` always sets `data.ohms`/`data.ratio` at placement time (`placeRes`, `placeXfmr`). Harmless, but it's defensive code guarding against a state that can't occur, which reads as "this value is sometimes missing" to the next person touching this file — worth deciding deliberately to keep (as real defense) or drop, not leave as an accident.

**B14. `state.dt` (fixed `1/30`) is used as an implicit "one frame elapsed" assumption for every event-triggered recompute.**
Every non-per-frame call to `refreshPower()` (placing a component, finishing a wire, toggling a checkbox) omits the `dt` argument and falls back to the constant `state.dt`, not real elapsed time. For a capacitor mid-charge, wiring in a new component advances its charge state by a fixed 1/30s regardless of how long the player actually paused to do it. Minor in the current slow-charge model, but worth being intentional about in the rewrite (event-triggered recomputes probably shouldn't advance capacitor time at all).

**No commented-out code, no leftover `console.log`/`debugger`/`TODO`/`FIXME` anywhere in the repo** — grepped explicitly, zero hits. Worth stating as a positive: whoever wrote this kept it clean of debug cruft even though the logic itself has the bugs above.

---

## 3. Physics correctness — what's wrong, and what a kid would wrongly conclude

This section is about the *model*, independent of the individual bugs already listed above (some overlap intentionally, because a bug and a modeling error are often the same line viewed two ways).

| What the game currently does | What a kid would incorrectly conclude | Real behavior |
|---|---|---|
| One wire from GEN to a house lights it (B1) | "Electricity needs one connection, like a single pipe." | Current only flows in a closed loop; a house needs a supply *and* a return conductor back to the source. |
| GEN voltage never sags under load (B2) | "A power source can supply any amount of current at a fixed voltage forever." | Every real source has internal resistance / a capacity limit; voltage sags as load increases. This is *the* concept "managing a grid" is supposed to teach, and right now nothing in the sim produces the sag. |
| Transformer output is `ratio × 12V` no matter what feeds it (B3) | "A transformer is just a dial that sets a new fixed voltage." | A transformer relates its output to whatever voltage is actually present at its primary, and (ideally) conserves power: `V_p·I_p = V_s·I_s`. Stepping voltage up must step current down. |
| LED brightness clamps at 1.0 regardless of overcurrent (B4) | "More voltage into an LED just makes it brighter, with no downside." | LEDs have a narrow safe forward-current range; overdriving them destroys them — this is *why* a series resistor exists at all, and the game currently gives no reason to add one. |
| Resistor's on-screen value and simulated value disagree 2× (B5) | A kid who *does the math by hand* (division/multiplication with round numbers, entirely plausible at this age) and checks it against the reported current will get a different number and conclude their arithmetic — or Ohm's Law itself — is wrong. | The label should always equal the resistance actually used in the solve. This is the one bug in this table that isn't a simplification choice at all, just incorrect — the fix is mechanical (attribute resistance to a device's *edges*, not double-count it), not a design decision. |
| Capacitor charges toward the final DC voltage of the circuit (correct-ish) with two unrelated, undocumented time constants (B6) | Probably no incorrect conclusion for a kid (the curve shape is directionally right), but the "why does it take this long" is not decodable from the code and isn't taught in-game either. | Real RC charging is exponential, time constant `τ = R·C`; the "slow it down for teaching" scaling is a legitimate and common simplification (real τ with milliohm wire resistance is sub-millisecond, invisible), it just needs to be *one* clearly-labeled knob with the deviation documented at the point of use. |

**Bottom line for Phase 3:** B1 (real return path / actual graph-based ground or loop requirement) is the load-bearing fix — B2, B3, and B4's *worst* symptoms (LED destruction, transformer energy creation) all get meaningfully better once current has to actually flow through a closed loop with series elements, because that's what makes voltage division, sag under load, and transformer power conservation possible to model honestly in the first place. Recommend sequencing the Phase 3 work in that order rather than patching each symptom independently.

---

## 4. Performance

**Every frame, unconditionally, regardless of whether anything changed:**

`main.js` `update(time, delta)` → `refreshPower(dt)` → `sim.js` `computePower`:
- rebuilds the entire adjacency list from scratch (`buildAdj`)
- reruns graph reachability (`reachableFrom`)
- rebuilds and Gaussian-eliminates a dense `N×N` matrix (`solveLinear`), even when `N` unknowns haven't changed and no capacitor is mid-transient
- rebuilds `state.wireMetrics` for every wire (`computeWireMetrics`)

then back in `main.js`, `refreshPower` also, every frame:
- loops every node and calls `.setText()` on voltage/current labels for every HOUSE and LED (Phaser `Text.setText` re-renders a texture — not free) even when the printed value hasn't changed
- `updateWireLabels()` does the same `setText`/`setPosition`/`setVisible` for every wire's label, every frame

None of this is gated on "did the graph topology change" or "is there an active capacitor transient" or "did a toggle change what's visible." For the current 4-6 node sandbox this is invisible; it will not stay invisible once the game has dozens of components in a level-mode circuit, and it's the single most direct violation of the Phase 6 instruction ("nothing expensive should run every frame if the state hasn't changed") in the codebase — flagging it here from static inspection; recommend actually profiling with the Chrome Performance panel on a bigger test circuit before optimizing, per the brief's "profile it, don't guess."

**Fix direction for the rewrite:** drive `computePower` from a topology/parameter "dirty" flag set by `placeX`/wiring/toggle mutations, and *only* run it unconditionally every frame while at least one capacitor exists in the GEN-reachable graph (i.e., while there's an actual transient in progress). Gate label `setText` calls behind a value-changed check.

---

## 5. Accessibility and readability

- **Information conveyed by color alone**, repeatedly: house window color (ON=`#fff2a6` yellow / DIM=`#e6cf7a` tan / OFF=`#777777` gray) and LED bulb color are the *only* signal of power state — no icon, shape, or pattern change. Yellow-vs-tan is a genuinely hard distinction for red-green colorblind users (roughly 8% of boys — a material fraction of this game's target audience), and the color gap between ON and DIM is small even for typical vision.
- **Contrast:** all label text is a single dark navy (`#0b1020`) regardless of background. Over the green ground (`#59b44a`) and gray road (`#6b6b6b`) at 12px, this is unlikely to clear WCAG AA for small text (needs to be checked with an actual contrast tool against final colors in the rewrite, not asserted here from memory — flagging as needing verification, not asserting a specific ratio failed).
- **No keyboard access at all.** The entire game is Phaser pointer-event driven (`pointerdown`/`pointermove`); there is not a single `keydown`/`keyup` listener anywhere in the codebase, and the whole UI — including the tool buttons — lives inside the `<canvas>` with no parallel DOM, so there is nothing for a screen reader or keyboard-only user to attach to. This is a full accessibility gap, not a partial one.
- **No `prefers-reduced-motion` handling** — moot today since nothing animates, but worth wiring up from day one in the rewrite once motion (current-flow animation, etc.) is added, rather than retrofitting later.
- **No responsive/scale handling at all.** The Phaser config (`main.js:19-25`) hardcodes `width: 900, height: 550` with no `scale` block (no `Phaser.Scale.FIT`/`RESIZE`, no `autoCenter`), and `index.html` has **no `<meta name="viewport">` tag**. On a phone or tablet — the brief explicitly expects tablets — this either renders zoomed out and tiny, or gets clipped by the CSS `overflow: hidden` on `<body>`, with no way to see the whole play area. This needs a `Scale.FIT` (or similar) config plus a viewport meta tag at minimum, and touch-sized hit targets (current buttons are 92×32 CSS px equivalent, workable but tight) as a secondary concern.
- **Reading level:** current copy is already fairly minimal, but device labels (`XFMR`, `TRANS`, `RES`, `CAP`, `GEN`) are engineering abbreviations, not words an 8-year-old has ever seen, and status-line sentences ("RUN CHECK ✅ Houses: ON 2 | DIM 0 | OFF 1 LEDs: ON 0...") read like a build log, not a message to a kid.

---

## Severity-ranked punch list for Phase 2 onward

1. **B1** — give loads a real return path / closed-loop requirement (unblocks B2–B4's honest fixes)
2. **B2** — generator internal resistance / capacity, so load actually matters
3. **B3** — transformer referenced to its own primary voltage, with power conservation
4. **B4** — LED overcurrent has a real consequence (ties into B7's undo — burnout needs to be recoverable)
5. **B5** — fix double-counted inline component resistance (mechanical fix, no design decision needed — do this one first, it's cheap and unblocks trustworthy playtesting of everything else)
6. **B6** — resolve the two competing capacitor time-constants into one documented knob
7. **B7** — delete/undo (explicitly non-negotiable per brief)
8. **B8** — fix starter house #3 placement (one-line fix, but do it after the layout is otherwise being reworked for Phase 4 responsiveness, so it isn't done twice)
9. **B12** — surface solver failure distinctly from "legitimately unpowered"
10. **B9, B10, B11** — mode-conflict/dangling-state cleanup (bundle together, same root cause: tool switches and wire-cancel paths need one shared reset function instead of three ad-hoc ones)
11. Performance gating (§4) — do alongside the Phase 4 rendering rewrite, since that's touching the same render loop anyway
12. Accessibility items (§5) — color/contrast and keyboard access should be designed in from the start of Phase 4, not bolted on after
13. **B13, B14** — low-priority cleanup, fold into the general Phase 3/6 pass

---

*Ready for review. Nothing has been changed yet — this document is entirely observational. Phase 2 (research) and Phase 3 (simulation rewrite) have not started.*
