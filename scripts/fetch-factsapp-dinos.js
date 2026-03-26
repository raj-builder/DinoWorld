import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────────────

const SANITY_PROJECT = 'r19ry25y';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = 'v2021-10-21';

const GROQ_QUERY = `*[_type == 'dinosaur']{
  "slug": slug.current,
  name,
  diet,
  dimensions,
  timePeriod,
  location,
  "imageRef": images.front.image.asset._ref,
  "imageAlt": images.front.alt
} | order(name.genus asc)`;

const API_URL = `https://${SANITY_PROJECT}.apicdn.sanity.io/${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${encodeURIComponent(GROQ_QUERY)}`;

const RAW_DIR = path.join(ROOT, 'assets/dinos/raw');
const DATA_DIR = path.join(ROOT, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'dino-catalog.json');

const DOWNLOAD_DELAY_MS = 500;
const MAX_RETRIES = 3;

// ── Encyclopedia period map (52 listed species) ─────────────────────────────

const ENCYCLOPEDIA_PERIOD_MAP = {
  // Permian
  dimetrodon: 'Permian',
  // Triassic
  coelophysis: 'Triassic',
  eoraptor: 'Triassic',
  herrerasaurus: 'Triassic',
  ischigualastia: 'Triassic',
  mastodonsaurus: 'Triassic',
  panphagia: 'Triassic',
  plateosaurus: 'Triassic',
  promastodontosaurus: 'Triassic',
  saurosuchus: 'Triassic',
  shonisaurus: 'Triassic',
  silesaurus: 'Triassic',
  smilosuchus: 'Triassic',
  unaysaurus: 'Triassic',
  // Jurassic
  allosaurus: 'Jurassic',
  alpkarakush: 'Jurassic',
  brachiosaurus: 'Jurassic',
  camarasaurus: 'Jurassic',
  ceratosaurus: 'Jurassic',
  compsognathus: 'Jurassic',
  cryolophosaurus: 'Jurassic',
  dakosaurus: 'Jurassic',
  dicraeosaurus: 'Jurassic',
  dimorphodon: 'Jurassic',
  gigantspinosaurus: 'Jurassic',
  glacialisaurus: 'Jurassic',
  guanlong: 'Jurassic',
  marshosaurus: 'Jurassic',
  pterodactylus: 'Jurassic',
  rhamphorhynchus: 'Jurassic',
  rhomaleosaurus: 'Jurassic',
  scelidosaurus: 'Jurassic',
  stegosaurus: 'Jurassic',
  // Cretaceous
  alamosaurus: 'Cretaceous',
  alioramus: 'Cretaceous',
  ankylosaurus: 'Cretaceous',
  austroraptor: 'Cretaceous',
  caletordraco: 'Cretaceous',
  chasmosaurus: 'Cretaceous',
  corythosaurus: 'Cretaceous',
  daspletosaurus: 'Cretaceous',
  deinonychus: 'Cretaceous',
  einiosaurus: 'Cretaceous',
  ekrixinatosaurus: 'Cretaceous',
  eonatator: 'Cretaceous',
  hatzegopteryx: 'Cretaceous',
  iguanodon: 'Cretaceous',
  inawentu: 'Cretaceous',
  kronosaurus: 'Cretaceous',
  medusaceratops: 'Cretaceous',
  pachycephalosaurus: 'Cretaceous',
  pinacosaurus: 'Cretaceous',
};

// ── Habitat overrides ───────────────────────────────────────────────────────

const HABITAT_OVERRIDES = {
  // Pterosaurs → air
  pterodactylus: 'air',
  dimorphodon: 'air',
  rhamphorhynchus: 'air',
  hatzegopteryx: 'air',
  alpkarakush: 'air',
  // Marine reptiles → water
  kronosaurus: 'water',
  dakosaurus: 'water',
  rhomaleosaurus: 'water',
  shonisaurus: 'water',
  eonatator: 'water',
  styxosaurus: 'water',
};

// ── Utility functions ───────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function parseSanityRef(ref) {
  const match = ref.match(/^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/);
  if (!match) throw new Error(`Invalid image ref: ${ref}`);
  return { hash: match[1], dimensions: match[2], ext: match[3] };
}

function sanityImageUrl(ref) {
  const { hash, dimensions, ext } = parseSanityRef(ref);
  return `https://cdn.sanity.io/images/${SANITY_PROJECT}/${SANITY_DATASET}/${hash}-${dimensions}.${ext}`;
}

function periodFromMya(startMya) {
  if (startMya >= 252) return 'Permian';
  if (startMya >= 201.4) return 'Triassic';
  if (startMya >= 145) return 'Jurassic';
  return 'Cretaceous';
}

function normalizeMealType(dietArray) {
  if (!dietArray || dietArray.length === 0) return 'unknown';

  const has = (item) => dietArray.includes(item);
  const hasMeat = has('Meat');
  const hasPlants = has('Plants');
  const hasFish = has('Fish');
  const hasInsects = has('Insects');

  // Any combo with plants + animal protein → omnivore
  if (hasPlants && (hasMeat || hasFish || hasInsects)) return 'omnivore';

  // Plants only → herbivore
  if (hasPlants) return 'herbivore';

  // Fish only → piscivore
  if (hasFish && !hasMeat && !hasInsects) return 'piscivore';

  // Insects only → insectivore
  if (hasInsects && !hasMeat && !hasFish) return 'insectivore';

  // Any remaining animal-protein combo → carnivore
  if (hasMeat || hasFish || hasInsects) return 'carnivore';

  return 'unknown';
}

function normalizeHabitat(slug) {
  return HABITAT_OVERRIDES[slug] || 'land';
}

function formatDimensions(dim) {
  if (!dim) return { length: null, height: null, weight: null, wingspan: null };
  return {
    length: dim.length ? `${dim.length} M` : null,
    height: dim.height ? `${dim.height} M` : null,
    weight:
      dim.weight && dim.weight.amount
        ? `${dim.weight.amount} ${dim.weight.unit || 'tons'}`
        : null,
    wingspan: dim.wingspan ? `${dim.wingspan} M` : null,
  };
}

function formatLocation(loc) {
  if (!loc) return '';
  const parts = [loc.region, loc.specific].filter(Boolean);
  return parts.join(', ');
}

function formatTimeStages(tp) {
  if (!tp) return '';
  return `${tp.start} million to ${tp.end} million years ago`;
}

// ── Image download ──────────────────────────────────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function downloadImage(url, destPath) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());

      // Verify PNG magic bytes
      if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
        // Not a PNG — might still be valid (some are JPEG). Save anyway.
        console.warn(`  ⚠ Not a PNG (${buffer.length} bytes), saving anyway`);
      }

      await fs.writeFile(destPath, buffer);
      return { success: true, size: buffer.length };
    } catch (err) {
      console.warn(`  Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await delay(1000 * attempt);
    }
  }
  return { success: false, error: 'All retries exhausted' };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Dino World P0 — Fetching species from Facts.app Sanity API\n');

  // Ensure directories exist
  await fs.ensureDir(RAW_DIR);
  await fs.ensureDir(DATA_DIR);

  // 1. Fetch all species from API
  console.log('Fetching species data from Sanity API...');
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`API request failed: HTTP ${response.status}`);
  }
  const data = await response.json();
  const apiEntries = data.result;
  console.log(`  Found ${apiEntries.length} species\n`);

  // 2. Process each species
  const species = [];
  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < apiEntries.length; i++) {
    const entry = apiEntries[i];
    const slug = entry.slug;
    const genus = entry.name?.genus || slug;
    const speciesName = entry.name?.species || '';
    const displayName = speciesName ? `${genus} ${speciesName}` : genus;

    console.log(`[${i + 1}/${apiEntries.length}] ${displayName}`);

    // Period assignment
    const listedOnEncyclopedia = slug in ENCYCLOPEDIA_PERIOD_MAP;
    let periodGroup;
    let notes = '';

    if (listedOnEncyclopedia) {
      periodGroup = ENCYCLOPEDIA_PERIOD_MAP[slug];
      // Cross-check with time data
      if (entry.timePeriod?.start) {
        const inferredPeriod = periodFromMya(entry.timePeriod.start);
        if (inferredPeriod !== periodGroup) {
          notes += `Period discrepancy: encyclopedia says ${periodGroup}, time data (${entry.timePeriod.start} MYA) suggests ${inferredPeriod}. `;
        }
      }
    } else {
      periodGroup = entry.timePeriod?.start
        ? periodFromMya(entry.timePeriod.start)
        : 'unknown';
      notes += 'Not listed on encyclopedia index page. ';
    }

    // Build image URL
    let sourceImageUrl = null;
    let imageDownloaded = false;
    let imageSize = 0;

    if (entry.imageRef) {
      try {
        sourceImageUrl = sanityImageUrl(entry.imageRef);
      } catch (e) {
        notes += `Image ref parse error: ${e.message}. `;
      }
    } else {
      notes += 'No image reference in API data. ';
    }

    // Download image
    if (sourceImageUrl) {
      const ext = entry.imageRef.split('-').pop(); // png, jpg, etc.
      const destFile = `${slug}.${ext}`;
      const destPath = path.join(RAW_DIR, destFile);

      const result = await downloadImage(sourceImageUrl, destPath);
      if (result.success) {
        imageDownloaded = true;
        imageSize = result.size;
        downloaded++;
        console.log(`  ✓ Downloaded (${(imageSize / 1024).toFixed(0)} KB)`);
      } else {
        failed++;
        notes += `Download failed: ${result.error}. `;
        console.log(`  ✗ Download failed`);
      }

      // Rate limiting
      if (i < apiEntries.length - 1) await delay(DOWNLOAD_DELAY_MS);
    }

    const ext = entry.imageRef ? entry.imageRef.split('-').pop() : 'png';

    species.push({
      slug,
      displayName,
      factsAppPageUrl: `https://www.facts.app/dinosaur/${slug}`,
      localRawImage: `assets/dinos/raw/${slug}.${ext}`,
      localOptimizedImage: `assets/dinos/optimized/${slug}.webp`,
      periodGroup,
      timeStagesText: formatTimeStages(entry.timePeriod),
      foodTypeRaw: entry.diet || [],
      mealTypeNormalized: normalizeMealType(entry.diet),
      habitatNormalized: normalizeHabitat(slug),
      locationFormation: formatLocation(entry.location),
      dimensions: formatDimensions(entry.dimensions),
      imageDownloaded,
      imageVerified: false, // Set by optimize/report scripts
      listedOnEncyclopedia,
      notes: notes.trim(),
    });
  }

  // 3. Write catalog
  const catalog = {
    generatedAt: new Date().toISOString(),
    sourceApi: API_URL.split('?')[0],
    totalSpecies: species.length,
    species,
  };

  await fs.writeJson(CATALOG_PATH, catalog, { spaces: 2 });

  // 4. Summary
  console.log('\n── Summary ──');
  console.log(`Total species: ${species.length}`);
  console.log(`Images downloaded: ${downloaded}`);
  console.log(`Images failed: ${failed}`);
  console.log(`Catalog written to: ${CATALOG_PATH}`);

  const byPeriod = {};
  for (const s of species) {
    byPeriod[s.periodGroup] = (byPeriod[s.periodGroup] || 0) + 1;
  }
  console.log(`By period: ${JSON.stringify(byPeriod)}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
