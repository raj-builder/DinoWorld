/**
 * Add a custom dinosaur to the catalog.
 *
 * Usage:
 *   node scripts/add-dino.js \
 *     --name "Spinosaurus aegyptiacus" \
 *     --image ./path/to/spinosaurus.png \
 *     --source "https://en.wikipedia.org/wiki/Spinosaurus" \
 *     --period Cretaceous \
 *     --diet carnivore \
 *     --habitat land \
 *     --length "15 M" \
 *     --weight "7.4 tons" \
 *     --fact "Largest known carnivorous dinosaur"
 *
 * Required: --name, --image
 * Optional: --source, --period, --diet, --habitat, --length, --weight, --fact
 */

import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CATALOG_PATH = path.join(ROOT, 'data/dino-catalog.json');
const STATS_PATH = path.join(ROOT, 'data/dino-stats.json');
const RAW_DIR = path.join(ROOT, 'assets/dinos/raw');
const OPT_DIR = path.join(ROOT, 'assets/dinos/optimized');

// ── Parse args ──────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return parsed;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!args.name) {
    console.error('Error: --name is required');
    console.log('\nUsage: node scripts/add-dino.js --name "Dino Name" --image ./image.png [options]');
    console.log('\nOptions:');
    console.log('  --name      Species name (required)');
    console.log('  --image     Path to image file (required)');
    console.log('  --source    Source URL for the species info');
    console.log('  --period    Permian | Triassic | Jurassic | Cretaceous (default: Cretaceous)');
    console.log('  --diet      carnivore | herbivore | omnivore | piscivore (default: carnivore)');
    console.log('  --habitat   land | air | water (default: land)');
    console.log('  --length    Length string, e.g. "15 M"');
    console.log('  --weight    Weight string, e.g. "7 tons"');
    console.log('  --fact      Fun fact or note about the species');
    process.exit(1);
  }

  if (!args.image) {
    console.error('Error: --image is required');
    process.exit(1);
  }

  const imagePath = path.resolve(args.image);
  if (!await fs.pathExists(imagePath)) {
    console.error(`Error: Image not found at ${imagePath}`);
    process.exit(1);
  }

  const name = args.name;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const period = args.period || 'Cretaceous';
  const diet = args.diet || 'carnivore';
  const habitat = args.habitat || 'land';
  const length = args.length || null;
  const weight = args.weight || null;
  const fact = args.fact || '';
  const source = args.source || '';

  console.log(`\nAdding: ${name}`);
  console.log(`  Slug: ${slug}`);
  console.log(`  Image: ${imagePath}`);

  // ── Copy raw image ──
  await fs.ensureDir(RAW_DIR);
  const ext = path.extname(imagePath);
  const rawDest = path.join(RAW_DIR, `${slug}${ext}`);
  await fs.copy(imagePath, rawDest);
  console.log(`  Raw: ${rawDest}`);

  // ── Optimize image ──
  await fs.ensureDir(OPT_DIR);
  const optDest = path.join(OPT_DIR, `${slug}.webp`);
  const metadata = await sharp(imagePath).metadata();
  let pipeline = sharp(imagePath);
  if ((metadata.width && metadata.width > 1024) || (metadata.height && metadata.height > 1024)) {
    pipeline = pipeline.resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true });
  }
  await pipeline.webp({ quality: 80 }).toFile(optDest);
  const rawSize = (await fs.stat(rawDest)).size;
  const optSize = (await fs.stat(optDest)).size;
  console.log(`  Optimized: ${optDest} (${(rawSize/1024).toFixed(0)} KB → ${(optSize/1024).toFixed(0)} KB)`);

  // ── Generate stats ──
  const weightKg = weight ? parseFloat(weight) * (weight.toLowerCase().includes('ton') ? 1000 : 1) : 500;
  const lengthM = length ? parseFloat(length) : 5;

  const hp = Math.round(Math.min(200, Math.max(60, 80 + weightKg / 30)));
  const attack = Math.round(Math.min(100, diet === 'carnivore' ? 50 + lengthM * 3 : 35 + lengthM * 2));
  const defense = Math.round(Math.min(100, diet === 'herbivore' ? 55 + weightKg / 100 : 35 + weightKg / 150));
  const speed = Math.round(Math.min(100, habitat === 'air' ? 80 : habitat === 'water' ? 60 : weightKg < 200 ? 70 : 45));
  const stamina = Math.round(Math.min(100, 50 + (diet === 'herbivore' ? 15 : 0)));

  const battleClass = habitat === 'air' ? (attack >= 70 ? 'striker' : 'scout')
    : habitat === 'water' ? (attack >= 70 ? 'heavy predator' : 'ambusher')
    : defense >= 70 ? 'tank' : speed >= 70 ? 'speedster' : attack >= 80 ? 'bruiser' : 'balanced';

  const statsEntry = {
    stats: { hp, attack, defense, speed, stamina },
    moves: [
      { name: 'Primal Strike', type: 'attack', power: 25 + Math.floor(attack / 5), description: fact || `${name} attacks with raw power` },
      { name: 'Ancient Fury', type: 'attack', power: 20 + Math.floor(attack / 6), description: `A fierce assault from ${name.split(' ')[0]}` },
    ],
    coords: { lat: 0, lng: 0 },
    battleClass,
  };

  // ── Update catalog ──
  const catalog = await fs.readJson(CATALOG_PATH);

  // Check for duplicate slug
  if (catalog.species.find(s => s.slug === slug)) {
    console.error(`\nError: Slug "${slug}" already exists in catalog. Use a different name.`);
    process.exit(1);
  }

  const catalogEntry = {
    slug,
    displayName: name,
    factsAppPageUrl: source || '',
    localRawImage: `assets/dinos/raw/${slug}${ext}`,
    localOptimizedImage: `assets/dinos/optimized/${slug}.webp`,
    periodGroup: period,
    timeStagesText: '',
    foodTypeRaw: diet === 'carnivore' ? ['Meat'] : diet === 'herbivore' ? ['Plants'] : diet === 'omnivore' ? ['Meat', 'Plants'] : ['Fish'],
    mealTypeNormalized: diet,
    habitatNormalized: habitat,
    locationFormation: '',
    dimensions: { length, height: null, weight, wingspan: null },
    imageDownloaded: true,
    imageVerified: true,
    listedOnEncyclopedia: false,
    notes: fact,
  };

  catalog.species.push(catalogEntry);
  catalog.totalSpecies = catalog.species.length;
  await fs.writeJson(CATALOG_PATH, catalog, { spaces: 2 });

  // ── Update stats ──
  const allStats = await fs.readJson(STATS_PATH);
  allStats[slug] = statsEntry;
  await fs.writeJson(STATS_PATH, allStats, { spaces: 2 });

  console.log(`\n  Added to catalog (${catalog.totalSpecies} total species)`);
  console.log(`  Stats: HP=${hp} ATK=${attack} DEF=${defense} SPD=${speed} STA=${stamina}`);
  console.log(`  Class: ${battleClass}`);
  console.log(`\nDone! Run 'npm run serve' and refresh to see the new card.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
