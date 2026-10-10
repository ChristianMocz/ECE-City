# CLAUDE.md

Guidance for Claude Code when working in this repository. Start with
`README.md` for the overview, folder map and how the `city` modules work.

## Basics

- Plain JavaScript, classic `<script>` tags, **no ES modules and no build
  step**. Browsers block modules on `file://`, and double-clicking
  `index.html` must work. Each file adds globals; load order is in
  `index.html` and `ece-city-play.html` (keep both in sync).
- Phaser 3.90.0 is bundled at `lib/phaser.min.js`; `index.html` falls back to
  the CDN. All art and sound are generated in code.
- Every file starts with a header: path, a short paragraph, "Main pieces:",
  "Used by:". Keep comments short and direct.

## Tests

```bash
node tests/run-all.mjs            # all unit tests (rules + physics)
node tests/sim.test.mjs           # one file
node tests/browser/run-all.mjs    # browser suites (Playwright, slow)
node tests/browser/game.e2e.mjs   # one browser suite
```

Browser tests: `ROOT`, `PAGE`, `CHROME`, `NO_CDN` env vars (see
`tests/browser/harness.mjs`). Buttons and tiles carry a `.tag`
(`"build:RES"`, `"today:orders"`...) so tests can tap them.
`scene.__api` (built in `src/scene/start.js`) exposes game actions for tests.

## Layers

- `src/circuit/` and `src/rules/`: pure logic, no Phaser. Unit tested.
- `src/ui/`: screens. Drawing only; taps go back through callbacks.
- `src/scene/`: the game. Each file is `installX(city)`; `main.js` calls them
  in order. Shared functions go on `city` via `Object.assign`; shared mutable
  values are `city.x` (e.g. `city.townDirty`). A module may only use another
  module's function at install time if that module installed earlier.

## Circuit model (read before changing physics)

- `src/circuit/solver.js`: `computePower(state, dt)` does a full nodal
  analysis each call. Every part has a hot dot (`id`) and a return dot
  (`id + "b"`), linked by `data.pairId`. A closed loop to GND is needed for
  current, with no special cases. GEN is a Thevenin source; LEDs are diodes;
  capacitors and batteries use Backward Euler; the transformer has its own
  branch-current unknown. `solveLinear` throws on a singular matrix (caught
  into `state.solverError`).
- `state.nodes`: id → `{ id, type, container, hit, visual, data }`.
  `state.wires`: `{ a, b, line, ... }`. The solver only reads `type`/`data`
  and writes results to `state.*` maps; drawing happens in `src/scene/`.
- New part: sprite (`src/art/pixelart.js`), `make*`/`set*Visual`
  (`src/scene/parts.js`, extents in `PART_EXTENT` in
  `src/scene/constants.js`), `placePart` (`src/scene/board.js`),
  `branchParams` (`src/circuit/solver.js`), and a test.
- Buildings are houses with `data.building` and their own `R`/`vOn`/`vDim`.
  Loads scale by `state.loadScale`; solar by `state.solarFactor`; the
  generator by `state.genScale`. A generator never takes current backwards.
- Popped LEDs (`data.burned`) are refitted by `refitPoppedLEDs`
  (`src/scene/editing.js`). Never make a state the player can't undo.

## Game rules worth knowing

- Save ("profile"): `src/rules/game.js`, always through `normalizeProfile`.
  Slot 1 is `localStorage` key `ececity.save.v1`, slots 2-3 add `.slotN`.
  Switching slot restarts the scene, so scene listeners go through `onEvent`
  (`src/scene/setup.js`), which removes them on shutdown.
- Contexts (`state.context`): `town`, `level`, `boss`, `mission`, `daily`,
  `make`. `enterContext` (`src/scene/contexts.js`) saves the town, clears
  undo and swaps the board; the town economy pauses meanwhile.
- Unlocks: `FEATURES` in `src/rules/progress.js`. Toolbar buttons are always
  on; phone apps unlock by level. `todayItems` builds the Today board; town orders live only there.
- Sparky (`maybeAsk`, `src/scene/sparky.js`): solves a copy both ways before
  a wire or switch change and asks only if something visibly changes. At
  most every 15 s; setting "Sparky's guessing game".
- Captain Short Circuit (`src/rules/world.js` `BOSSES`, `src/scene/boss.js`):
  a solved board plus reversible `breaks`. The blackout is visual only
  (`visualNight`).
- Levels: `src/rules/campaign.js` (engine, `L()` shorthand) and
  `src/rules/levels.js` (data). Each level has a solution the tests replay.
- Emergencies (`src/rules/emergencies.js`) and daily puzzles
  (`src/rules/daily.js`) are replayed by tests the same way.
- New towns start empty (`REGION_STARTERS.sparkville`); browser tests seed
  the old three-house town in `tests/browser/harness.mjs`.
- Music: `Music.shuffle(world)` in game, `Music.play("title")` on the title.
- Puzzle maker: `src/rules/maker.js` (share codes), `src/scene/makerplay.js`.

See `CHANGES.md` for the history and `docs/` for the original research.
