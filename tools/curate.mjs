// Curate assets/moves.json categories by hand (the convert.mjs keyword heuristic
// is too rough). Sets each move's `type` to one of:
//   idle       - the base sway (ginga); the FSM's loop
//   offensive  - kicks / sweeps the opponent throws at the player (block these)
//   defensive  - evasions, escapes, floreios, movement
//   exclude    - Mixamo gym/dance filler, not capoeira; kept as files but out of play
// Run: node tools/curate.mjs

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(repoRoot, 'assets', 'moves.json');

const IDLE = ['ginga'];

const OFFENSIVE = [
  'armada-or-meia-lua-de-costas', 'armada-to-esquiva', 'bencao',
  'chapa', 'chapa-from-a-step-back', 'chapa-giratoria', 'chapa-giratoria-pulada',
  'chapeu-de-couro', 'corrupio',
  'martelo', 'martelo-from-a-step-forward', 'martelo-no-chao',
  'martelo-no-chao-sem-mao', 'martelo-pulado',
  'meia-lua-de-coluna', 'meia-lua-de-compasso', 'meia-lua-de-compasso-back',
  'meia-lua-de-compasso-double', 'meia-lua-de-frente',
  'mma-chapa', 'mma-chapa-giratoria', 'mma-martelo', 'mma-martelo-low', 'mma-martelo-rotado',
  'ponteira', 'queixada', 'queixada-from-a-step-back', 'rabo-de-arraia',
  'rasteira-de-costas', 'rasteira-de-fronte', 'rasteira-em-pe',
  'rasteira-meia-lua-de-frente', 'rasteira-rabo-de-arraia',
];

const DEFENSIVE = [
  'au', 'au-batido', 'au-de-coluna', 'au-giratoria', 'au-sem-mao', 'au-sideways', 'au-to-role',
  'cocorinha', 'esquiva-de-costas', 'esquiva-de-frente', 'esquiva-lateral', 'esquiva-to-role',
  'ginga-com-balanca', 'ginga-low', 'ginga-variation',
  'macaco', 'macaco-lateral', 'queda-de-rins', 'role', 'troca-de-pe',
  'piao-de-cabeca', 'mariposa', 'mola', 'backflip',
];

const EXCLUDE = [
  'arm-stretch-dance', 'leg-stretch-dance', 'burpee', 'jump-push-up', 'situps', 'pike-walk',
];

const cat = (slug) =>
  IDLE.includes(slug) ? 'idle' :
  OFFENSIVE.includes(slug) ? 'offensive' :
  DEFENSIVE.includes(slug) ? 'defensive' :
  EXCLUDE.includes(slug) ? 'exclude' : null;

const moves = JSON.parse(readFileSync(path, 'utf8'));
const unknown = [];
for (const m of moves) {
  const c = cat(m.slug);
  if (!c) { unknown.push(m.slug); continue; }
  m.type = c;
}
if (unknown.length) {
  console.error('UNCATEGORIZED (fix curate.mjs):', unknown);
  process.exit(1);
}

writeFileSync(path, JSON.stringify(moves, null, 2) + '\n');
const count = (t) => moves.filter((m) => m.type === t).length;
console.log(`curated ${moves.length}: idle ${count('idle')}, offensive ${count('offensive')}, defensive ${count('defensive')}, exclude ${count('exclude')}`);
