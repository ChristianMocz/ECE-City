# ECE City

A pixel-art browser game that teaches early electrical engineering. You wire
up a small town's power grid and watch it behave like the real thing: lights
need a closed loop, the generator sags under load, LEDs pop without a
resistor, capacitors charge, and transformers step voltage up and down.

Built with [Phaser 3](https://phaser.io). Plain JavaScript, no build step.

## ▶ [Play it in your browser](https://christianmocz.github.io/ECE-City/)

Free, nothing to install. Works on a computer, phone or tablet.

To run it from a copy of this repo, double-click `index.html`: no server, no
install, works offline.

Or serve the folder (handy while editing): `python3 tests/devserver.py 8502`,
then open http://localhost:8502.

## What's in the game

- **Campaign:** 12 worlds, 10 levels each plus an Expert level. Each world
  teaches one idea (loops, resistors, LEDs, switches, capacitors, solar,
  transformers, logic, the grid...). Stars for staying on budget.
- **Your town:** build it up, buy buildings and decorations, power plants and
  power lines, day and night, weather, storms, timed emergencies and orders.
- **Captain Short Circuit:** a blackout boss fight in every world.
- **Sparky:** a robot who asks "will it get brighter or dimmer?" before a
  change, then lets you see if you were right.
- **The phone:** shop, clothes, Today board, Engineer's Notebook, records,
  stickers, settings, and a Puzzle maker that makes share codes.

## Folder map

```
index.html            the game page (loads every script in order)
ece-city-play.html    the same game, Phaser from the internet (online preview)
main.js               starts Phaser and runs each scene module in order
lib/                  Phaser and the pixel font license
src/
  art/                every sprite, drawn in code (no image files)
  audio/              sound effects and chiptune music, made live
  circuit/            the board's state, the physics solver, "why is it dark?"
  rules/              game rules and data: levels, shop, worlds, saves...
  ui/                 screens and pop-ups (drawing only)
  scene/              the game itself: one file per job, joined by `city`
tests/                unit tests (rules and physics), run with Node
tests/browser/        browser tests that play the real game in Chromium
docs/                 the original audit and design research
CHANGES.md            what changed in each update
```

## How the code fits together

**No modules, on purpose.** Every file is a classic `<script>`. Browsers block
ES modules on `file://`, and the game must work when you double-click it. So
each file adds plain functions and constants to the page, and **order
matters**: a file can only use what loaded before it. The order is in
`index.html`.

**Four layers:**

1. `src/rules/` and `src/circuit/` are **pure logic**: no Phaser, no drawing.
   This is where the physics and the game rules live, and it's what the unit
   tests cover.
2. `src/art/` and `src/audio/` make sprites and sounds from code.
3. `src/ui/` **draws screens** and reports taps through callbacks. It never
   changes the game itself.
4. `src/scene/` **runs the game**: it reacts to taps, changes the state, runs
   the solver and updates what you see.

**The `city` object.** The scene is split into small modules. Each one is a
function `installX(city)`. `main.js` creates one shared `city` object and
calls them in order:

```js
function create() {
  const city = { scene: this };
  installSetup(city);   // state, save file, HUD
  installBoard(city);   // placing parts and wires, undo/redo
  ...
  installStart(city);   // load the town, show the title screen
}
```

Each module reads what it needs from `city`, defines its functions, and adds
the ones others use with `Object.assign(city, { ... })`. A module calls
another module's function as `city.someFunction()`. Every file starts with a
short paragraph saying what it does, its main pieces, and who uses it.

**The physics.** `src/circuit/solver.js` is the heart of the game. Every part
has two dots (a "hot" one and a return one) and the solver does nodal
analysis: one current-balance equation per dot, solved together. That's why
a light only works on a closed loop, with no special cases. Read its header
before changing anything electrical.

### Adding a new part

1. Its sprite in `src/art/pixelart.js`.
2. Its look on the board in `src/scene/parts.js` (`make*` and `set*Visual`).
3. Placing it in `src/scene/board.js` (`placePart`).
4. Its electrical behavior in `src/circuit/solver.js` (`branchParams`).
5. A test in `tests/sim.test.mjs`.

## Tests

```bash
npm test                     # unit tests: rules and physics (about 260)
npm install                  # once, for the browser tests
npx playwright install chromium
npm run test:browser         # play the real game in Chromium (about 300 checks, slow)
node tests/browser/game.e2e.mjs   # just one browser suite
```

No Node? Open `tests/run-in-browser.html` to run the unit tests in a browser.

## License

MIT, see `LICENSE`. Phaser is MIT (`lib/PHASER-LICENSE.md`); the Pixelify
Sans font is SIL OFL 1.1 (`lib/PIXELIFY-SANS-LICENSE.txt`).
