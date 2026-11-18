// Solmar Heat's hand-in program (Node 22, standard library only). The game
// itself is plain static files under game/ — one HTML shell and ES modules,
// no libraries, no network — and this script stages it for the judge: it
// copies game/ and screenshots/ next to the dossier into the output folder,
// then asks the vendored make.fun library to summarise the entry. The output
// folder is /output inside the grader, or MAKEFUN_OUTPUT_DIR anywhere else:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Play it locally instead with `node serve.ts`, then http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const entryDir = dirname(fileURLToPath(import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function stageFolder(name) {
  const source = join(entryDir, name);
  const target = join(destination, name);
  if (!existsSync(source)) return false;
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  return true;
}

mkdirSync(destination, { recursive: true });
stageFolder('game');
if (!stageFolder('screenshots')) {
  mkdirSync(join(destination, 'screenshots'), { recursive: true });
}

// The scorer's caps, from the competition's gate: the text budget shapes the
// dossier bytes, and the rest refuse an entry the scorer would refuse — at
// most 4 screenshots, each at most 256 KiB; game/ at most 993 files and
// 48 MiB in all, with no path over 1000 bytes.
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(destination, 'dossier.json'), dossier);
console.log(`Solmar Heat staged in ${destination}`);
