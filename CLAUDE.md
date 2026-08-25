# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ECE City — a browser game (built on Phaser 3) that teaches early electrical engineering concepts (voltage, current, resistance, capacitors, transformers, transistors) by letting the player wire up a small power grid and watch it behave.

## Running it

There is no build step, no package manager, and no test suite — this is plain ES modules loaded directly by `index.html`. Phaser itself is pulled from a CDN `<script>` tag (`index.html`), not installed locally.

Because `main.js` is loaded as an ES module (`<script type="module">`), opening `index.html` directly via `file://` will fail CORS/module-loading restrictions in most browsers. Serve the directory over HTTP instead, e.g.:

```bash
npx serve .
```

or any equivalent static file server, then open the served URL.

There are no lint or test commands configured in this repo.

## Architecture

The app is a single Phaser scene (`main.js`) with one `create()`/`update()` pair, wired to four plain-JS modules under `src/`:

- **`src/state.js`** — `createGameState()` returns the single mutable state object for the whole game: the node/wire graph, tool mode, all electrical constants (generator voltage, load resistances, on/dim/off voltage thresholds), and display toggles. There is no other state store — everything reads/writes this one object.
- **`src/factory.js`** — pure Phaser scene-graph builders. Each `make*` function (`makeGenerator`, `makeHouse`, `makeResistor`, `makeCapacitor`, `makeTransformer`, `makeTransistor`, `makeLED`) draws a device and returns `{ container, hit, visual }`; `set*Visual` functions (`setHouseVisual`, `setLEDVisual`, `setTransistorVisual`) recolor an existing device based on simulated state. No simulation logic lives here.
- **`src/sim.js`** — the circuit solver. `computePower(state, dt)` is the only entry point and does full recompute each call (no incremental updates):
  1. `buildAdj` builds an adjacency list from `state.wires`, applying edge resistance rules (`edgeResistance`) and dropping edges through OFF transistors (open switch).
  2. `reachableFrom("GEN", adj)` restricts the solve to the generator-connected subgraph — anything not reachable is forced to 0V/OFF.
  3. Transformers (`XFMR`) that are GEN-reachable become fixed-voltage source nodes (`computeTransformerSources`), not unknowns.
  4. Remaining unknown node voltages are solved via nodal analysis (conductance matrix `A`, current vector `b`) with Gaussian elimination (`solveLinear`). Loads (`HOUSE`, `LED`) add conductance to ground; capacitors add a Backward-Euler companion model (`capacitorCompanion`) so charging is a transient over time rather than instantaneous.
  5. Results are written back to `state.nodeVoltages`, `state.powered` (per-load V/I/level), and `state.wireMetrics` (per-wire R/I/V, via `computeWireMetrics`).
- **`src/ui.js`** — builds the HUD: title, tool label, display toggles (voltage/current/resistance/advanced-mode checkboxes), and the button grid (RUN CHECK, WIRE, HOUSE, LED, XFMR, RES, TRANS, CAP). Buttons mutate `state.mode` (the `Mode` enum, also exported from here) and some prompt the player for a numeric value (resistor ohms, capacitor µF, transformer ratio) via `window.prompt`. Emits a `toggles-changed` scene event when toggles or tool parameters change.
- **`main.js`** — the Phaser scene glue. Owns node placement (`placeHouse`, `placeRes`, `placeCap`, `placeXfmr`, `placeTrans`, `placeLED`), the click-to-wire interaction (`startWire`/`finishWire`/`clearPreview`), and `refreshPower()`, which calls `computePower` and pushes results into device visuals and wire labels. Listens for `toggles-changed` and `run-check` scene events (the latter tallies ON/DIM/OFF counts across houses and LEDs into the status line). Phaser's `update(time, delta)` drives the capacitor transient by calling `refreshPower(dt)` every frame.

**Key invariant:** every node lives in `state.nodes` (id → `{ id, type, container, hit, visual, data }`); every connection lives in `state.wires` (`{ a, b, line, labelText }`) as an undirected pair of node ids. `sim.js` never touches Phaser objects directly — it only reads `node.type`/`node.data` and `state.wires`, then writes derived numbers back into `state.*` maps. All rendering/visual updates happen in `main.js`/`factory.js` in response to those derived numbers, not inside `sim.js`.

Device types (`node.type`): `GEN`, `HOUSE`, `RES`, `CAP`, `XFMR`, `TRANS`, `LED`. Adding a new device type touches all four files: a `make*`/`set*Visual` pair in `factory.js`, a `place*` function + button in `main.js`/`ui.js`, and handling in `sim.js` (edge resistance and/or load/source behavior).
