# CHANGES.md

## New-player update — October 2026

- Every toolbar button (WIRE, + BUILD, DELETE, UNDO, REDO, LEVELS, TODAY, PHONE, HINT) is there from the start. Phone apps still unlock as you level up.
- The welcome guide explains every button and every phone app, and scrolls (wheel, drag, ▲/▼ or the handle). It's also in PHONE → Settings → How to play.
- A new town starts empty, just GEN and GND. You build your own houses with + BUILD. Missions still use the three-house starter board.
- The GEN moved up so it and its dot sit on the grass, not the road. A power plant's name now shows to the right of it.
- Music shuffles: each world starts with its own song, then moves through all 12 world songs, about a minute each.

## Clean-up: organised folders, short comments, readable names — October 2026

No gameplay changes except one: **town orders now live only on the TODAY board** (the phone's Orders app is gone).

- **Folders by job:** `src/art`, `src/audio`, `src/circuit`, `src/rules`, `src/ui`, `src/scene`. Renamed for clarity: `sim.js` → `circuit/solver.js`, `helper.js` → `circuit/diagnose.js`, `puzzles.js` → `rules/daily.js`, `factory.js` → `scene/parts.js`, `ui.js` → `ui/hud.js`, `moreart.js` → `art/shopart.js`. The three `screens` files became `ui/kit`, `shop`, `map`, `popups`, `title`, `levelmap`, `phone` and `makerscreens`.
- **main.js split up:** its 2,900-line `create()` is now 23 small modules in `src/scene/`, each `installX(city)` sharing one `city` object. `main.js` is now about 70 lines.
- **Comments:** every file opens with a short paragraph saying what it does, its main pieces and who uses it. Comments inside are short and direct.
- **Names:** cryptic one- and two-letter names became words (`m` → `maker`, `em` → `emergency`, `L` → `level`, `ci` → `clock`, `b` → `boss`/`btn`/`box`...).
- **GitHub-ready:** `README.md`, `LICENSE` at the top, `package.json` (`npm test`, `npm run test:browser`), browser tests in `tests/browser/`, research notes in `docs/`.
- Checked: the code is token-for-token the same apart from comments, the moves and the renames; all 258 unit tests and all browser suites pass.

Older entries below use the old file names (`src/sim.js`, `main.js` for scene code, and so on).

## The organised update: a cleaner screen, the phone, Today, the Notebook, Expert levels, time trials, the Puzzle maker — October 2026

**A cleaner screen that grows with you**
- The 18-button grid is gone. The toolbar has two rows: WIRE, + BUILD, DELETE, UNDO, REDO, then LEVELS ★, TODAY, PHONE and ? HINT.
- **Unlock as you go:** a brand-new player sees only WIRE, LEVELS and HINT. UNDO arrives after level 1, TODAY and the PHONE after level 2, DELETE after level 4 and + BUILD after level 6 (or on reaching that player level). Each new button pops in with a "New!" tag, and the game says what it does. A level always shows the tools it needs.
- **The Engineer's phone** holds everything else as apps in five tabs (Town, World, Me, Make, Settings): Shop, Orders, Daily, Skip time, Clear board, Count lights, World map, Power lines, Clothes, Notebook, Records, Stickers, Puzzle maker, Play a code, Settings (music, sound, Sparky, emergencies), How to play, and Save & title. Apps unlock by level too, and show badges.
- An older save sees only the brand-new things as New!, in one message.

**Today** — one board that says what to do next: any emergency or storm repair, the next unfinished level, where Captain Short Circuit is (and what beating him opens), an open Expert level, waiting orders, the daily gift and puzzle, and new Notebook cards. Each has a Go button.

**Engineer's Notebook** — 24 cards (loops, sharing wires, short circuits, resistors, LEDs, switches, capacitors, batteries, solar, transformers, series, parallel, Ohm's law, AND/OR, backup power, the grid...). Each unlocks when you finish the level that teaches it, with a picture or a little circuit drawing and one line of explanation.

**Harder late game**
- An **Expert level** for every world (12 new levels): bigger boards with traps to find, parts you shouldn't use, and copper so tight there's no room for a spare wire. Each opens once the world's ten levels are finished.
- Copper budgets get tighter as you travel: 30% spare early, 20% from Neon City, 15% from Robot Factory.

**Time trials and the No-undo challenge** — on any level you've finished: race the clock for a personal record, or win with no UNDO and no HINT. Records live in PHONE → Me → Records, which also shows how much of the game you've done (in %).

**Puzzle maker** (PHONE → Make): 1 Build (place up to 16 parts and any starting wires), 2 Goal (tap lights: ✓ must be bright, ✗ must stay dark), 3 Test (solve it yourself, which proves it can be done), then name it and pick the budget. You get a share code (ECE-...) a friend types into "Play a code". Codes carry a check, so typos are caught.

**More things to buy**
- 6 buildings: Library, Hotel, Cinema, Fire station, Arcade, and the Stadium (too much for the little generator: it needs a hydro dam or stronger).
- A **Lights & fun** shop tab with decorations that light up and are wired like buildings: Street light, Twinkly tree, Light-up fountain, Billboard, Ferris wheel.
- 6 plain decorations: hedge, mailbox, picnic table, flag pole, slide, gazebo.
- 12 outfits, including mustache, party hat, team jersey, chef hat, cowboy hat, tuxedo, pirate hat, gold medal, space suit.
- 4 stickers: Expert Engineer, Speedy Sparks, Steady Hands, Puzzle Maker (25 in total).
- The clothes, shop, build and sticker lists scroll (mouse wheel, ▲/▼, or drag the handle) and remember where you were.

**Fixes from play-testing**
- **LED advice says exactly what's wrong:**
  - "Resistor R0 is a Small one and it's still connected";
  - "L0 shares resistor R0 with L1 — give each LED its own Medium";
  - "your power plant is hardly making power" (a wind turbine in a storm, solar at night, a nuclear plant warming up);
  - "the generator is worn out by buildings".

  It never tells you to use a smaller resistor when that would pop the LED.
- **The Captain is easy to find.** A locked world says "Beat Captain Short Circuit in Sparkville first", and its button is "Find the Captain →", which goes straight there. The fight button is now "Fight the Captain!", and Today points to him too.
- **Scenery no longer sits behind GEN or GND** in any world (the left column is kept clear).
- **Sparky's explanations are clearer.** A light that goes from dark to lit reads "0 V → 10 V", where before it looked like the volts went down.
- **Clothes:** the space helmet no longer runs off the screen.
- The RUN CHECK and SOUND buttons moved into the phone (Count lights; Settings).

**Tests**
- New unit suite `tests/progress.test.mjs` (25): unlocks, Today, the Notebook, records, share codes, playing a shared puzzle.
- `features.test.mjs`: every pair of the 8 part types wired one after another and side by side (128 circuits), each part's job, the new LED advice, and the stadium's power needs.
- `campaign.test.mjs`: 132 levels, Expert rules, harder later worlds.
- A new browser suite plays every new feature on the real screen. All the older suites were updated for the new toolbar.

## The "real game" update: title screen, campaign, power plants, power lines, emergencies, 12 worlds, 3 save files — October 2026

**Title screen and polish**
- A start screen with the ECE CITY logo, your own engineer in the clothes you're wearing, and CONTINUE / SAVE FILES / SETTINGS. MENU → "Save & title screen" brings it back.
- **Up to 3 save files.** An empty file starts a new game; files can be erased (with an "are you sure?"). File 1 is your existing save.
- **Music:** a short chiptune song for the title and for each of the 12 worlds (`src/music.js`). The SOUND button cycles ON → MUSIC OFF → SOUND OFF; Settings has music, sound, Sparky and emergencies.
- The screen shakes when something pops, rewards fly up to the coin counter as coins, and wires throw sparks when they connect.

**A living town**
- People walk the pavements and cars drive the road, with headlights at night. Fewer people are out at night.
- Lights flicker on one by one at dusk.
- While houses are lit, people move in (up to 6 + 5 per lit house); every 20 people there's a party (+10 coins). The count shows under the board.

**Campaign: 120 levels, 3 stars each**
- 10 hand-made levels per world on a winding level-select path (LEVELS ★). Each level teaches one idea.
- ★ finish it, ★ stay within the parts budget, ★ use few wires and pop nothing.
- **Wire and parts budget:** wire costs $1 per 40 px, parts have prices, and every world has tight-budget levels where you can't overspend.
- Missions moved into LEVELS → Training.

**Power plants (SHOP → Power plants)**
- 10 plants: little generator, solar farm (sleeps at night), wind turbine (blades turn; brakes in a storm), hydro dam, coal (4 coins of coal each morning), nuclear (warms up), geothermal, biogas, tidal (needs the sea), fusion reactor. Each has a "good at" and a "catch".
- A one-way valve in the solver stops a battery draining backwards into a sleeping plant.

**Power lines between towns (MAP → Power lines)**
- Join two neighbouring towns with a line and pick a transformer: no transformer loses 57% on the way, ×10 loses 5%, ×100 loses 1%. Joined towns share power, so a neighbour's dam keeps a solar town lit at night. Pylons show on the map.

**12 emergencies**
- Hospital needs power, squirrel bites a wire, a tree falls, heat spike, power surge, a stuck switch, a sneaky shortcut, overheating plant, science-fair night, the wire gremlin, drained battery, and a solar eclipse. Each one really breaks something in your town, has a timer, and pays coins and XP when fixed. Can be turned off in Settings.

**12 worlds**
- New: Windmill Valley, Waterfall Woods, Neon City, Frosty Tundra, Volcano Island, Robot Factory, Storm Coast and Moon Base (with a space sky). Each has its own ground, scenery, song, starter town, home power plant, levels and a hand-made Captain Short Circuit boss.
- Levels now run to 25, with 4 new outfits and 8 new stickers (21 in total).

**Tests**
- New unit suites: `tests/plants.test.mjs` (23), `tests/campaign.test.mjs` (20 — replays all 120 levels and checks every budget is reachable but tight), `tests/emergencies.test.mjs` (18). `game` and `world` suites extended (save files, 12 regions, every boss break combination).
- New browser suites drive the title screen, save files, levels, plants and lines, every emergency, all 12 worlds, every boss and the living town through the real game screen.

## Fix: an LED that popped could never light again — October 2026

A player wired a resistor to an LED, tried every size, and it would not light. Two things caused this:
- The resistor menu lists Small (100Ω) first, and Small lets too much current through, so the LED pops.
- **A popped LED stayed popped forever.** Swapping to the right resistor did nothing, so it looked as if no resistor works.

What changed:
- **A popped LED can be replaced.** Tap it, or change any wire in its chain of parts (the parts between GEN and GND that it sits in), and a new LED goes in. If the circuit still sends too much current, it pops again straight away, and the message says so ("popped again — put a Medium (470Ω) resistor in front of it"). Deleting the part next to it also fits a new one. UNDO brings back the popped one. Sparky's predictions take this into account. The rule is `poppedLEDsTouched` in `src/helper.js`.
- **The resistor menu says what each size does to an LED:**
  - Small: "pops an LED!"
  - Medium: "best for an LED"
  - Large: "makes an LED dim"
- **The pop message and the "Why is it dark?" helper** both say how to fix it: a Medium resistor, then tap the LED to fit a new one.
- **The LED picture follows the game's verdict.** A dim LED (Large resistor) used to look fully lit, even though orders counted it as dim.
- **Every building lights when wired alone to the generator, in any weather, day or night.** Before, a school, a bakery or a hospital on its own stayed dim during a heat-wave night, or a school on any night, and nothing could fix it. Night now adds the same load whatever the weather (`environmentFor` in `src/game.js`: night 0.7, which was 0.6, or 0.48 in a heat wave).

Tests:
- `tests/features.test.mjs` has 12 new device tests:
  - each resistor with an LED;
  - the refit rule;
  - two LEDs in a row;
  - a backwards LED;
  - every building in every weather, day and night;
  - a switch;
  - solar and battery.
- A new browser suite (`devices_e2e`) drives every device through the real game screen, including the exact "Small, then Medium, then Large on the same LED" steps from the report.

## The world update: a map with four regions, Captain Short Circuit, a sidekick, a sticker book — October 2026

**World map (MAP button).** Four regions, each with its own story, characters, people for orders, look and parts:

| Region | Opens at | Parts it teaches | Characters | Look |
|---|---|---|---|---|
| Sparkville | Level 1 | houses, resistor, LED, switch | Mayor Volt, Grandma Rosa | grass and trees |
| Battery Bay | Level 4 + beat the Sparkville boss | capacitor, battery | Captain Coral, Fisher Finn | sand, palms, boats, a lighthouse |
| Solar Desert | Level 6 + beat the Battery Bay boss | solar panel | Professor Sunny, Cactus Carl | dunes and cacti; almost always sunny |
| Transformer Mountains | Level 8 + beat the Solar Desert boss | transformer | Engineer Ella, Yeti Yuri | alpine meadow, snowy pines, a peak |

- Each region keeps its own saved town.
- Travelling starts that region's orders fresh.
- Decorations stay where you put them.
- A building you bought counts across every region, so one bakery can't be placed twice.
- Parts now unlock in region order: battery at level 5, solar at 6, transformer at 8.
- A "!" on MAP means a new region or boss is waiting.

**Blackout bosses: Captain Short Circuit.** From a region's page on the map, "Fight the blackout!" shows up at that region's boss level (3, 5, 7, 9).
- The town goes dark, and the Captain appears with a countdown and taunts.
- He has broken a big circuit. Light every building and LED before time runs out.
- Each region has its own hand-made boss circuit and a list of ways to break it:
  - cut wires
  - a switch flipped off
  - an LED turned backwards
  - a shortcut wire
  - a building moved onto the wrong (step-down) transformer
- Difficulty decides how many breaks and how much time:

  | Difficulty | Breaks | Time | Hints | Coins |
  |---|---|---|---|---|
  | Easy | 2 | 3:00 | yes | 40 |
  | Medium | 3 | 2:30 | yes | 70 |
  | Hard | 4 | 2:00 | yes | 110 |
  | Extreme | 5 | 1:30 | none | 160 |

- The clock stops while a question or menu is open.
- In a fight, Sparky always asks (every few seconds). Each right guess **zaps** the Captain: +8 seconds and +5 coins, up to 5 zaps.
- Winning: confetti, the Captain flies off, coins and XP (full the first time per difficulty, a quarter after), a star on the map, and the next region opens.
- Losing just means "try again".
- The tests check every boss: it starts fully lit when solved, still lit after 3 minutes, every break really breaks it, and 300 random fights per difficulty per region all start broken and can be fixed.

**Your sidekick.** A pup sits at your engineer's feet in the corner. CLOTHES now has two tabs: Engineer and Sidekick.
- Switch between the dog and **Sparky the robot**.
- Buy colours: golden, black or spotty pup; red, green or gold Sparky.
- Buy tiny hats (cap, party hat, wizard hat, crown) and extras (bandana, bow tie, goggles, hero cape).
- The engineer gets 6 new items: lightning tee, hoodie, red pants, scarf, headphones, propeller cap.

**Sticker book (STICKERS button).** 13 badges, each worth +10 coins when earned:
- First Light
- LED Saver
- Sharp Guesser
- Night Owl
- Storm Chaser
- Sun Catcher
- Puzzle Pro
- Order Up!
- Town Builder
- Dressed Up
- Explorer
- Breaker Fixer
- Extreme Hero

**How to play.** The first time the game opens, a box explains how to earn coins and how to level up. **HOW TO** shows it again.

**Toolbar** is now 6 × 3, adding MAP, STICKERS and HOW TO. The title shows the region you're in.

**Fixed while testing:**
- The pixel font joined "fi" into a glyph that looked like "A" ("fights" read "Aghts", "fix" read "Ax"). Ligatures are now off in all game text.
- Older saves move their town into Sparkville automatically.

**Files.**
- New: `src/world.js` (regions, bosses, stickers, sidekick — pure logic) and `tests/world.test.mjs` (26 tests).
- Changed: art in `src/gameart.js`, region scenery and sidekick builders in `src/factory.js`, new screens in `src/gamescreens.js`, plus `main.js`, `src/ui.js`, `src/game.js` and `src/font.js`.

---

## The game update: power orders, Sparky's guessing game, come back every day, and your own little engineer — October 2026

ECE City is now a real game with a town of your own that's saved in the browser. Everything still runs by double-clicking `index.html`, with no install and no image or sound files.

**Your little engineer (top-right corner).** A pixel-art engineer stands next to your coins, level, XP bar and Sparky streak. Tap him, or the **CLOTHES** button, to dress him: 16 items in four slots (hats, shirts, trousers, extras), from a red cap and glasses up to a lab coat, wizard hat, hero suit, cape and crown. Better items unlock at higher levels. Tap an item to buy it and put it on; tap it again to take it off for free.

**1. Power orders (the Hay Day part).**
- **ORDERS** shows three requests from townspeople, for example:
  - "Grandma Rosa: Please bring power to house H2!"
  - "Mayor Volt: Light up 3 buildings at the same time!"
  - "Science fair: We need 2 bright LEDs!"
  - "Keep the hospital lit for 45 seconds straight!"
  - "Power the bakery with sunshine only!"
  - "Keep house H1 lit at night on battery power!"
- An order pays its coins and XP automatically the moment it is done. Bigger jobs and bigger buildings pay more. A new order arrives 12 seconds later, and you can skip one you don't want.
- Orders are never handed out already finished, so there are no free coins.
- **SHOP** sells buildings and decorations:
  - The park, bakery, ice-cream shop, school and hospital each have different power needs. The bakery's oven draws twice what a cottage does, and the school needs at least 10 volts.
  - Flower beds, benches, lamp posts, a fountain, a duck pond and a statue are just for looks.
  - DELETE puts a building or decoration back in your BUILD box, so nothing you buy is ever lost.
- **Levels unlock parts in teaching order:**

  | Level | Unlocks |
  |---|---|
  | 1 | Houses and wires |
  | 2 | Resistor and LED |
  | 3 | Switch |
  | 4 | Capacitor |
  | 5 | Transformer |
  | 6 | Solar panel |
  | 7 | Battery |

  Missions 3–5 unlock along the same path. Reaching a level throws a party that names what's new. All parts now live in the **+ BUILD** menu, where locked ones show the level they need.

**2. Predict, then test (Sparky's guessing game).**
- Before a wire goes in or comes out, or a switch flips, Sparky asks: "Will the bakery (H3) get brighter, dimmer, or stay the same?"
- The game works out the real answer by solving the circuit both ways on a copy. Then it makes the change for real so the kid sees what happens.
- A right guess pays 5 coins. 3 right in a row doubles coins (orders included) and 6 in a row triples them.
- A wrong guess gets a one-line explanation with the real voltages, for example "Same — H3's voltage changed only a little (9.6 V → 9.3 V), not enough to change how bright it looks." There is no penalty.
- Sparky asks only when something would visibly change, at most every 15 seconds. "Skip question" or tapping outside still makes the change. The "Sparky's guessing game" toggle turns it off.

**3. Come back every day.**
- **Daily gift chest** pops up once a day. It gives coins (more for a longer login streak) or, sometimes, a decoration.
- **Daily puzzle**: 12 hand-made circuit puzzles in `src/puzzles.js`, one a day, the same for everyone:
  - Chain trouble
  - Pick the right resistor
  - Backwards!
  - The shortcut
  - Too many houses
  - Not enough volts
  - Stored power
  - The school needs more
  - Sunshine power
  - and more

  Solving one pays coins and XP and keeps a puzzle streak going. "Back to my town" brings your town back exactly as you left it.
- **Weather**, the same for everyone each day:
  - Sunny days boost solar panels.
  - Clouds halve them.
  - A heat wave makes every building need more power.
  - On storm days lightning knocks down a busy power line. A dashed red line marks it, and you reconnect it for a reward. Storm damage can't be undone with UNDO.
- **Day and night that matter.** A day lasts 4 minutes, the last 80 seconds of which are night.
  - At night buildings need more power, so three houses that were bright in the day go dim on one generator.
  - Solar panels rest at night.
  - A **battery** charged during the day keeps buildings lit after dark.
  - **SKIP TIME** jumps to the next morning or evening, and batteries really charge or drain through the skipped time.
  - The old Night time toggle is gone: night now comes with the clock.

**New parts (real physics in `src/sim.js`).**
- **Solar panel**: a small source whose output follows the sun (0 at night).
- **Battery**: the capacitor model with a much bigger store.
- Every building has its own load and its own "bright" voltage. The "Why is it dark?" helper knows about all of them, for example: "it's night — no sunshine", "battery B0 is only 12% full", "every building needs extra power right now", and the school needing 10 volts.

**Missions** now pay 30 coins + 30 XP the first time and run on their own board. Your town is saved, not undone, and "Back to my town" returns to it.

**Saving.** Coins, XP, clothes, buildings, decorations, orders, streaks and the whole town (every part and wire) are saved in this browser, after changes and when the page is closed.
- A damaged or hand-edited save is cleaned up rather than breaking the game.
- If the browser blocks storage, the game still works; it just doesn't remember.

**Files.**
- New: `src/game.js` (all the rules, pure logic), `src/puzzles.js`, `src/gameart.js` (all new pixel art) and `src/gamescreens.js` (all new screens).
- Changed: `main.js`, `src/ui.js` (new HUD), `src/sim.js`, `src/helper.js`, `src/factory.js`, `src/state.js` and `src/sound.js` (new coin, wrong-answer, thunder and gift sounds).

**Fixed while testing.** The random-tapping fuzzer once caught closing the CLOTHES screen also placing a part on the board. Pop-ups now record the tap that closed them, and the board ignores any tap while a pop-up is open or that same tap.

**Tests.**
- `tests/game.test.mjs` is new (40 tests). Every one of the 12 puzzles is replayed to prove it can be solved and isn't already solved.
- New solver tests (solar, battery, building loads, night load) and helper tests bring the totals to 35 + 42 + 40 = **117 unit tests**. Run them with `node tests/<name>.test.mjs`, or double-click `tests/run-in-browser.html`.
- Checked in a real browser by clicking through the game:
  - every earlier suite;
  - 62 new end-to-end checks covering orders, levels, the shop, decorations, clothes, Sparky, the gift, the daily puzzle (all 12 solved by tapping), storms, rain, day/night, solar, batteries, saving and reloading, junk saves and level locks;
  - long random-tapping fuzz runs that check the town, coins, orders and buildings after every tap;
  - 12,000 random circuits checked for energy balance.

---

## Retro pixel-art makeover + 3 more features — October 2026

**New look.** Everything is redrawn as retro pixel art (`src/pixelart.js`): sprites are drawn in code on a small grid with a tiny drawing kit and turned into crisp textures at startup, so there are still no image files and double-clicking `index.html` still works. Palette: Sweetie 16 plus a few subject colours.
- Power station with two smokestacks (it puffs smoke while supplying current — more current, more smoke) and windows that light up when it's working.
- Cottages whose windows go dim amber / bright yellow; capacitor can with its minus stripe and longer + leg; transformer core with an orange input coil and blue output coil; knife switch whose blade is down when ON and up when OFF; LED with a dome that glows and a longer + leg; pixel trees, pines, flowers, rocks, grass, sky and a dashed road.
- **Resistors show their real colour-code stripes** for their value (100 Ω brown-black-brown, 470 Ω yellow-violet-brown, 1000 Ω brown-black-red), and the resistor menu names them.
- Pixel font (Pixelify Sans, SIL OFL — `lib/PIXELIFY-SANS-LICENSE.txt`), embedded in `src/font.js` as a data: URI so it also works from `file://`. The game waits for it before starting (never more than 2 s).
- Chunky retro buttons that press down, a dark title plaque, pixel menus with drop shadows, square cyan "current sparks" on the wires, crisp `pixelArt` scaling.
- Connection dots are at exactly the same spots as before, so wiring, dragging, undo snapshots and every earlier test are unaffected.

**New features**
1. **Retro sound effects** (`src/sound.js`): 8-bit style blips synthesized live with Web Audio (no sound files) for placing, wiring, deleting, flipping a switch, an LED popping, lights coming on, the helper, undo/redo and a mission-complete jingle. **♪ SOUND ON/OFF** button; the choice is remembered.
2. **Night time** toggle: the town goes dark blue, unlit parts dim, lit windows and LEDs glow, the generator's windows shine, fireflies come out.
3. **"What is this?" cards** (`describePart` in `src/helper.js`): tap a resistor, capacitor, transformer, generator or ground for a kid-friendly card with real details — its stripes and value, how full the capacitor is right now, step up or down, the generator's live current.

Tests: 6 new unit tests for the info cards (61 total in Node or `tests/run-in-browser.html`).

---

## New kid-friendly features — October 2026

Three features aimed at turning the sandbox from "a complicated connecting diagram" into something a kid can play, fix and understand:

1. **Drag to move.** Press on any part's body and drag it; its dots, wires and (for a switch) its tap zone move with it. Parts stay fully on the field, a tiny wobble still counts as a tap, and one UNDO puts it back. In a PLACE tool, pressing on an existing part now moves it instead of stacking a new part on top of it. GEN and GND stay fixed.
2. **"Why is it dark?" helper** (`src/helper.js`). Tap a house or LED: its loop glows (green when lit, yellow when not), the broken spot pulses red, and a speech bubble explains in kid language — not wired, no power in, no way home to GND, switch OFF, popped LED in the way, LED backwards, capacitor blocking, a shortcut wire around it, or not enough volts (naming the resistor or step-down transformer, or the overloaded generator, that's to blame).
3. **Missions** (`src/missions.js`). ★ MISSIONS opens five short goals — Light it up!, The whole street, Save the LED, Light switch, Capacitor power — each with a starting board, a goal banner in the title spot, a ? HINT, and a confetti celebration when done. Completed missions get a ✓ that's remembered in this browser. UNDO right after starting a mission brings the previous build back.

Bug found while building these: **a house wired "backwards" read as dark** even though full current flowed through it (the readout used the signed voltage). A house is a plain load and now lights either way round.

Tests: `tests/features.test.mjs` (27 tests: every helper diagnosis on a real solved circuit, and a win/no-win circuit for every mission) plus a new solver test for the backwards house — `node tests/features.test.mjs`, or `tests/run-in-browser.html` runs both suites.

---

## Fix pass 2 — October 2026

Found by a new random-click fuzzer (thousands of random taps on every button, dot, part body, menu and undo/redo, with invariants checked after every action) plus a re-read aimed at kid usability:

- **Dismissing a pop-up menu acted on the board underneath.** Tapping outside the resistor/capacitor/transformer picker (or the Clear All question) to close it also reached the game: in a PLACE tool it placed a part there, in the DELETE tool it deleted whatever was under the tap. Overlay taps now stop there, and tapping the panel's own empty space no longer closes it.
- **Connection dots were hard to hit.** The tap target is now an 18px-radius circle around each dot (the drawing is unchanged), and a tap always goes to the dot *nearest* the finger, so dots that sit close together (the starter town has a pair 12px apart) never steal each other's taps.
- **Capacitors showed nothing.** A capacitor now fills up with a blue gauge as it charges, and shows its voltage when "Show Numbers" is on.
- **Blank screen with no internet.** Phaser 3.90.0 is now bundled in `lib/` (MIT, license included), with the CDN as a fallback and a plain-language message if neither loads.
- **WIRE tool, tapping a part's body did nothing.** It now explains to tap the round dots.
- **Charged capacitors couldn't power anything on their own.** Only parts wired (through some chain) to GEN were ever solved, so unplugging a charged capacitor instantly dropped it to 0V, and a charged capacitor wired to a house couldn't light it once the generator was disconnected — the main thing a capacitor teaches. Any island holding a charged capacitor is now solved too (an island that never touches GND uses the cap's own return lead as its 0V reference), and a fully isolated cap simply keeps its charge. 4 new solver tests, including the RC discharge curve (~37% left after one time constant).

Verification for this pass: 27 solver tests; 30 real-click browser checks; 8,000 random circuits (with and without charged capacitors) where generator power + capacitor power exactly equals power dissipated; and ~3,000 random UI actions across three seeds with invariants checked after every action (no live orphaned tap targets, no wires to missing parts, no wire preview outside the WIRE tool, no part dots off the field, undo→redo restores the exact build, no JS errors).

---

## Fix pass — October 2026

A full review of the game (every file read, the real game driven by mouse clicks in a browser, the solver fuzzed with 4,000 random circuits) turned up the bugs below. All are fixed, and each one has a regression test that fails on the old code and passes on the new.

**Physics (`src/sim.js`)**
- **Backwards LEDs conducted.** The LED was stamped as "2V drop + 10Ω" in both directions, so an LED wired backwards ran as a battery in reverse: it read OFF but pulled ~1.15A, dimming every house beside it. LEDs are now true one-way diodes, solved by iterating each LED between conducting and blocking until the network settles.
- **LEDs below 2V back-fed the generator.** The same flaw made an under-voltage LED (e.g. behind a ×0.1 transformer) push current *into* the source. Fixed by the same diode iteration.
- **A popped LED froze every readout.** Burnout was detected *after* the solve and nothing re-solved, so wires kept showing current flowing to a dead LED, the generator kept "supplying" it, and neighbouring houses stayed dimmed until something else changed. The network is now re-solved immediately after any burnout.
- A solver error no longer silently discharges every capacitor to 0V.
- Fuzz check: across 4,000 random circuits, power from the generator now equals power dissipated to within 1e-9 (the old solver violated this or another invariant in 834 of them).

**Game (`main.js`, `src/ui.js`, `src/factory.js`)**
- **Deleted switches left a ghost.** The switch's tap-to-flip zone was never destroyed, so the empty spot kept flipping a deleted switch and swallowed every click there (you couldn't place anything on it). Now destroyed with the part, on Delete, Clear All, and Undo/Redo.
- **Capacitors charged on clicks.** Every placement/wire/toggle advanced capacitor charge by an extra 1/30s. Only real frame time charges them now.
- **DELETE could only hit the tiny dots.** Tapping a part's body now deletes it, as the tool label always promised.
- **Parts placed near the edges were unwireable.** Their lower dot landed off-canvas, or their upper dot under the toolbar. Placement is now clamped so both dots are always on the field.
- **Layout:** the grass stopped 45px short, leaving a black band at the bottom; status messages printed over the parts and ran off-screen; the WIRE tool hint was hidden under the buttons. There's now a word-wrapped status bar along the bottom edge and a shorter hint.
- Finishing a wire now says "Connected A to B" instead of leaving "Now tap the OTHER dot..." on screen.

**Tests**
- `node tests/sim.test.mjs` failed **all 16 tests** with "computePower is not defined": the test never loaded `src/sim.js` outside a browser. It now loads it itself, and 7 new regression tests bring the total to 23.

---

What changed in this pass, why, what was deliberately left out, and what's still weak. See `docs/AUDIT.md` for the pre-rewrite findings this addresses and `docs/DESIGN.md` for the research behind the new UX. Every claim about the physics below is backed by a hand-derived, independently-checked test in `tests/sim.test.mjs` (16/16 passing) — not just asserted here.

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
- **Dark→yellow→red wire tinting** as load approaches a documented (cosmetic) threshold, layered on top of the dots (Poly Bridge steal).
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
