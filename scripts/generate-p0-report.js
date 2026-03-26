import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const RAW_DIR = path.join(ROOT, 'assets/dinos/raw');
const OPT_DIR = path.join(ROOT, 'assets/dinos/optimized');
const CATALOG_PATH = path.join(ROOT, 'data/dino-catalog.json');
const REPORT_PATH = path.join(ROOT, 'data/p0-report.json');

const VALID_PERIODS = ['Permian', 'Triassic', 'Jurassic', 'Cretaceous'];
const VALID_MEALS = ['carnivore', 'herbivore', 'omnivore', 'piscivore', 'insectivore', 'mixed', 'unknown'];
const VALID_HABITATS = ['land', 'air', 'water'];

async function main() {
  console.log('Dino World P0 — Generating verification report\n');

  const catalog = await fs.readJson(CATALOG_PATH);
  const species = catalog.species;
  const issues = [];

  // Validate each entry
  let imagesDownloaded = 0;
  let imagesOptimized = 0;
  let imagesFailed = 0;
  let rawBytes = 0;
  let optBytes = 0;

  for (const entry of species) {
    // Check required fields
    if (!entry.slug) issues.push({ slug: entry.slug, issue: 'Missing slug' });
    if (!entry.displayName) issues.push({ slug: entry.slug, issue: 'Missing displayName' });
    if (!entry.periodGroup || !VALID_PERIODS.includes(entry.periodGroup)) {
      issues.push({ slug: entry.slug, issue: `Invalid periodGroup: ${entry.periodGroup}` });
    }
    if (!VALID_MEALS.includes(entry.mealTypeNormalized)) {
      issues.push({ slug: entry.slug, issue: `Invalid mealTypeNormalized: ${entry.mealTypeNormalized}` });
    }
    if (!VALID_HABITATS.includes(entry.habitatNormalized)) {
      issues.push({ slug: entry.slug, issue: `Invalid habitatNormalized: ${entry.habitatNormalized}` });
    }

    // Check raw image
    const rawPath = path.join(ROOT, entry.localRawImage);
    if (await fs.pathExists(rawPath)) {
      const stat = await fs.stat(rawPath);
      if (stat.size < 100) {
        issues.push({ slug: entry.slug, issue: `Raw image suspiciously small: ${stat.size} bytes` });
      } else {
        imagesDownloaded++;
        rawBytes += stat.size;
      }
    } else if (entry.imageDownloaded) {
      issues.push({ slug: entry.slug, issue: 'imageDownloaded=true but file missing' });
      imagesFailed++;
    } else {
      imagesFailed++;
    }

    // Check optimized image
    const optPath = path.join(ROOT, entry.localOptimizedImage);
    if (await fs.pathExists(optPath)) {
      const stat = await fs.stat(optPath);
      if (stat.size < 100) {
        issues.push({ slug: entry.slug, issue: `Optimized image suspiciously small: ${stat.size} bytes` });
      } else {
        imagesOptimized++;
        optBytes += stat.size;
      }
    }
  }

  // Aggregate by period
  const byPeriod = {};
  for (const p of VALID_PERIODS) {
    const matching = species.filter((s) => s.periodGroup === p);
    byPeriod[p] = { count: matching.length, species: matching.map((s) => s.slug) };
  }

  // Aggregate by meal type
  const byMealType = {};
  for (const m of VALID_MEALS) {
    byMealType[m] = species.filter((s) => s.mealTypeNormalized === m).length;
  }

  // Aggregate by habitat
  const byHabitat = {};
  for (const h of VALID_HABITATS) {
    byHabitat[h] = species.filter((s) => s.habitatNormalized === h).length;
  }

  // Unlisted species
  const unlisted = species.filter((s) => !s.listedOnEncyclopedia).map((s) => s.slug);

  const report = {
    generatedAt: new Date().toISOString(),
    phase: 'P0',
    summary: {
      totalSpeciesInCatalog: species.length,
      totalListedOnEncyclopedia: species.length - unlisted.length,
      imagesDownloaded,
      imagesOptimized,
      imagesFailed,
    },
    byPeriod,
    byMealType,
    byHabitat,
    unlistedOnEncyclopedia: unlisted,
    issues,
    diskUsage: {
      rawImagesBytes: rawBytes,
      rawImagesMB: +(rawBytes / 1024 / 1024).toFixed(2),
      optimizedImagesBytes: optBytes,
      optimizedImagesMB: +(optBytes / 1024 / 1024).toFixed(2),
      savingsPercent: rawBytes > 0 ? +(((rawBytes - optBytes) / rawBytes) * 100).toFixed(1) : 0,
    },
  };

  await fs.writeJson(REPORT_PATH, report, { spaces: 2 });

  // Print report
  console.log('── P0 Verification Report ──\n');
  console.log(`Total species: ${report.summary.totalSpeciesInCatalog}`);
  console.log(`Listed on encyclopedia: ${report.summary.totalListedOnEncyclopedia}`);
  console.log(`Images downloaded: ${report.summary.imagesDownloaded}`);
  console.log(`Images optimized: ${report.summary.imagesOptimized}`);
  console.log(`Images failed: ${report.summary.imagesFailed}`);
  console.log();
  console.log('By period:');
  for (const [period, data] of Object.entries(report.byPeriod)) {
    console.log(`  ${period}: ${data.count}`);
  }
  console.log();
  console.log('By meal type:');
  for (const [type, count] of Object.entries(report.byMealType)) {
    if (count > 0) console.log(`  ${type}: ${count}`);
  }
  console.log();
  console.log('By habitat:');
  for (const [hab, count] of Object.entries(report.byHabitat)) {
    console.log(`  ${hab}: ${count}`);
  }
  console.log();
  console.log(`Disk usage: ${report.diskUsage.rawImagesMB} MB raw → ${report.diskUsage.optimizedImagesMB} MB optimized (${report.diskUsage.savingsPercent}% saved)`);

  if (report.issues.length > 0) {
    console.log(`\n⚠ Issues found: ${report.issues.length}`);
    for (const issue of report.issues) {
      console.log(`  - ${issue.slug}: ${issue.issue}`);
    }
  } else {
    console.log('\n✓ No issues found');
  }

  if (unlisted.length > 0) {
    console.log(`\nUnlisted on encyclopedia (${unlisted.length}): ${unlisted.join(', ')}`);
  }

  console.log(`\nReport written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
