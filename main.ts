// Solmaris — a working gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder, plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library
// and no network request), and the program hands it in: it copies game/
// and screenshots/ from beside this file to /output and writes
// /output/dossier.json with the vendored make.fun library.
//
// Solmaris is an original open-world crime game: a sun-soaked coastal
// city of five districts on a real road graph, explored on foot and by
// car, with traffic and pedestrians, car theft, a 0-5 star wanted system
// with police chases, roadblocks and a helicopter, a six-mission story
// chain ("The Solmaris Job"), combat, shops and an economy, a HUD with
// a circular minimap, title / pause / WASTED / BUSTED screens, a
// localStorage save, and WebAudio-synthesized sound. No Rockstar name,
// logo, character, map or asset anywhere.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly, before copying anything, when the entry is incomplete:
// a missing game/ or screenshots/ would otherwise hand in a broken entry.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('Solmaris: game/index.html is missing — the entry cannot be handed in');
}
if (!existsSync(join(here, 'screenshots'))) {
  throw new Error('Solmaris: screenshots/ is missing — the entry cannot be handed in');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
