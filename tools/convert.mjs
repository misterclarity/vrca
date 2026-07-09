// Batch-convert capoeiraNice Mixamo FBX -> GLB for the VR sparring sim.
//
//  - model.fbx        -> assets/opponent.glb   (textured skinned mesh, loaded once)
//  - <each move>.fbx  -> assets/clips/<slug>.glb (animation-only clip, lazy-loaded)
//  - writes assets/moves.json manifest: [{ slug, title, file, type }]
//
// Requires fbx2gltf (npm). Run:
//   NODE_PATH=<node_modules-with-fbx2gltf> node tools/convert.mjs [srcFbxDir]
//
// Default srcFbxDir = ../capoeiraNice/assets/fbx relative to this repo.

import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import convert from 'fbx2gltf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const srcDir = resolve(process.argv[2] || join(repoRoot, '..', 'capoeiraNice', 'assets', 'fbx'));
const assetsDir = join(repoRoot, 'assets');
const clipsDir = join(assetsDir, 'clips');

const MESH_FBX = 'model.fbx';          // the skinned, textured mesh
const SKIP = new Set([MESH_FBX, 'License.txt']);

// Rough offensive/defensive tag by keyword (refined later in game wiring).
const OFFENSIVE = /martelo|chapa|queixada|meia-lua|armada|ponteira|ben[cç]|rabo|rasteira|compasso|corrupio|chap[eé]u/i;

const slugify = s => s
  .replace(/\.fbx$/i, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

async function main() {
  if (!existsSync(srcDir)) { console.error('src FBX dir not found:', srcDir); process.exit(1); }
  mkdirSync(clipsDir, { recursive: true });

  // 1) textured opponent mesh
  console.log('mesh:', MESH_FBX, '-> assets/opponent.glb');
  await convert(join(srcDir, MESH_FBX), join(assetsDir, 'opponent.glb'), ['--binary']);

  // 2) animation clips
  const fbxFiles = readdirSync(srcDir).filter(f => f.toLowerCase().endsWith('.fbx') && !SKIP.has(f));
  const seen = new Map();
  const manifest = [];

  for (const f of fbxFiles) {
    let slug = slugify(f);
    if (seen.has(slug)) slug = `${slug}-${seen.get(slug) + 1}`; // dedup collisions
    seen.set(slug, (seen.get(slug) || 0) + 1);

    const out = join(clipsDir, `${slug}.glb`);
    process.stdout.write(`clip: ${f} -> clips/${slug}.glb ... `);
    try {
      await convert(join(srcDir, f), out, ['--binary']);
      manifest.push({
        slug,
        title: f.replace(/\.fbx$/i, ''),
        file: `assets/clips/${slug}.glb`,
        type: OFFENSIVE.test(f) ? 'offensive' : 'defensive',
      });
      console.log('ok');
    } catch (e) {
      console.log('FAIL', e?.message || e);
    }
  }

  manifest.sort((a, b) => a.title.localeCompare(b.title));
  writeFileSync(join(assetsDir, 'moves.json'), JSON.stringify(manifest, null, 2));
  console.log(`\ndone: ${manifest.length} clips + opponent.glb + moves.json`);
}

main();
