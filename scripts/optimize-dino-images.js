import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const RAW_DIR = path.join(ROOT, 'assets/dinos/raw');
const OPT_DIR = path.join(ROOT, 'assets/dinos/optimized');
const CATALOG_PATH = path.join(ROOT, 'data/dino-catalog.json');

const MAX_DIMENSION = 1024;
const WEBP_QUALITY = 80;

async function main() {
  console.log('Dino World P0 — Optimizing images\n');

  await fs.ensureDir(OPT_DIR);

  const catalog = await fs.readJson(CATALOG_PATH);
  let optimized = 0;
  let skipped = 0;
  let totalRawBytes = 0;
  let totalOptBytes = 0;

  for (const entry of catalog.species) {
    if (!entry.imageDownloaded) {
      console.log(`[SKIP] ${entry.slug} — no raw image`);
      skipped++;
      continue;
    }

    const rawPath = path.join(ROOT, entry.localRawImage);
    const optPath = path.join(ROOT, entry.localOptimizedImage);

    if (!(await fs.pathExists(rawPath))) {
      console.log(`[SKIP] ${entry.slug} — raw file missing: ${rawPath}`);
      entry.imageDownloaded = false;
      entry.notes = (entry.notes ? entry.notes + ' ' : '') + 'Raw file missing at optimize time.';
      skipped++;
      continue;
    }

    try {
      const rawStat = await fs.stat(rawPath);
      totalRawBytes += rawStat.size;

      const metadata = await sharp(rawPath).metadata();

      let pipeline = sharp(rawPath);

      // Resize if larger than max dimension
      if (
        (metadata.width && metadata.width > MAX_DIMENSION) ||
        (metadata.height && metadata.height > MAX_DIMENSION)
      ) {
        pipeline = pipeline.resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      await pipeline.webp({ quality: WEBP_QUALITY }).toFile(optPath);

      const optStat = await fs.stat(optPath);
      totalOptBytes += optStat.size;

      entry.imageVerified = true;
      optimized++;

      const savings = (((rawStat.size - optStat.size) / rawStat.size) * 100).toFixed(1);
      console.log(
        `[OK] ${entry.slug} — ${(rawStat.size / 1024).toFixed(0)} KB → ${(optStat.size / 1024).toFixed(0)} KB (${savings}% saved)`
      );
    } catch (err) {
      console.error(`[ERR] ${entry.slug} — ${err.message}`);
      entry.notes = (entry.notes ? entry.notes + ' ' : '') + `Optimize error: ${err.message}.`;
      skipped++;
    }
  }

  // Write updated catalog
  await fs.writeJson(CATALOG_PATH, catalog, { spaces: 2 });

  // Summary
  console.log('\n── Summary ──');
  console.log(`Optimized: ${optimized}`);
  console.log(`Skipped: ${skipped}`);
  console.log(
    `Raw total: ${(totalRawBytes / 1024 / 1024).toFixed(1)} MB`
  );
  console.log(
    `Optimized total: ${(totalOptBytes / 1024 / 1024).toFixed(1)} MB`
  );
  if (totalRawBytes > 0) {
    console.log(
      `Savings: ${(((totalRawBytes - totalOptBytes) / totalRawBytes) * 100).toFixed(1)}%`
    );
  }
  console.log(`Catalog updated: ${CATALOG_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
