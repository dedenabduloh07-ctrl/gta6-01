[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dedenabduloh07-ctrl/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dedenabduloh07-ctrl/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

An original top-down open-world crime game in the spirit of the early GTA
games, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01):
make the most complete original open-world crime game playable offline in a
desktop browser. Jax Rivera owes the fixer Vince Kovac $5,000, and five jobs
stand between him and a clean slate.

Everything is drawn in code and synthesised in the browser — no image, audio
or font files, no libraries, no network requests. The city is generated from
a single fixed seed, so every run builds the same Solmar.

## The city

- An 8×8 road grid with named streets, three road classes (the Ocean Drive
  highway, avenues, streets), lane arrows, stop lines, crosswalks and
  street-name paint, across eight districts.
- Twelve named locations: the hospital, police HQ, Vince's garage, the
  safehouse, the paint shop, the First Bank of Solmar, the chop shop, the
  Galleria, the stadium, the motel, the marina and the Port docks.
- Palm Beach: a wide sand band with volleyball courts, food stalls, swimmers,
  surfers, sunbathers, sandcastles and a lifeguard tower, down to the water.
- A GPS route line that follows the roads to the current objective, in the
  world and on the minimap, with district labels and a north indicator.

## The game

- **Five story jobs** from Vince: steal and deliver a car, a timed getaway
  with pursuers, three timed drops, stealing the guarded Veloce GT, and the
  bank job — with an ending card when the debt is paid.
- **Wanted system**: stars rise only from witnessed crimes, never from time
  or proximity. Police spawn at a distance, chase without pinning, and the
  bust meter needs sustained closeness plus a slow getaway. Lay low to cool
  off, or pay $150 for a repaint.
- **Driving and combat**: arcade car physics with drifting, damage, smoke,
  fire and chain-reaction explosions; pistol and rifle (unlocked in job 3),
  drive-by shooting, punching, guards who hold posts and strafe.
- **A living city**: traffic that follows the roads and stops at lights,
  parked cars to steal, pedestrians who stroll, queue, flee and witness
  crimes, hidden cash stashes and health packs.
- **HUD, menus and save**: money and debt, health, wanted stars, objective
  banner, prompts, toasts, title / pause / how-to screens, and localStorage
  saves at the safehouse and on mission progress.
- **Sound**: fully synthesised WebAudio — engine hum, sirens, gunshots,
  explosions, pickups and mission stingers, with M to mute.

## Controls

WASD / arrows to walk and drive, mouse to aim, click / hold to shoot, E / F
to interact, Space to punch or use the handbrake, Shift to sprint, 1 / 2 for
weapons, H for the horn, P / Esc to pause, M to mute, Enter to dismiss
messages.

## Run

```sh
node serve.ts
```

Then open http://localhost:8080. Or open `game/index.html` directly in a
desktop browser. The hand-in program is `main.ts` (Node 22, standard library
only): it stages `game/` and `screenshots/` into the output folder and writes
the dossier with the vendored make.fun library.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshots

The four screenshots in `screenshots/` are real captures of the game running
its deterministic staged scenes (`shots.json`, seed 20261117): a police
chase, a drive down Solmar Blvd, the bank firefight, and the opening by
Vince's garage.

## Structure

- `game/index.html` — the shell; `game/src/main.js` boots the game.
- `game/src/` — one module per system: city generation, traffic, pedestrians,
  police, vehicles, weapons, enemies, missions, player, rendering, HUD,
  audio, input, effects, saving, and the staged screenshot scenes.
- `main.ts` — the hand-in program; `serve.ts` — the local server.
- `vendor/makefun-game.ts` — the make.fun dossier library, unchanged from the
  competition kit.

## License

MIT — see [LICENSE](LICENSE).

---

Built for [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
