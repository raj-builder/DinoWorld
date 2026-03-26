# 🦕 Dino World

A fun dinosaur battle game built by a dad for his kid. Browse 60 prehistoric species on a world map, collect dino cards with real stats, and battle them in turn-based 1v1 fights.

**This is a personal project for educational and entertainment purposes only. Not intended for commercial use.**

---

## Play It

Visit the live site or run locally:

```bash
npm install
npm run serve
# Open http://localhost:8080
```

No build step needed — it's plain HTML/CSS/JS served as static files.

---

## What's Inside

### 🗺️ World Map
Interactive Leaflet.js map showing where each species' fossils were discovered. Markers are color-coded by geological era (Permian, Triassic, Jurassic, Cretaceous). Click any marker to see the species info and open its full card.

### 🃏 Dino Cards
All 60 species displayed as cards with filterable tags (period, diet, habitat) and stat bars (HP, ATK, DEF, SPD, STA). Click a card to see the full detail modal with dimensions, location, battle class, and special moves.

### ⚔️ Battle
Turn-based 1v1 fights. Pick your dinosaur, CPU picks a random opponent (reroll if you don't like it). Choose from special moves unique to each species, or defend to halve incoming damage. Auto-battle mode lets the AI play both sides. Trainer scoreboard tracks your win/loss record across the session. Share results to X or clipboard.

### 🎨 Create Your Own Dino
A fun creative mode — tap dino parts from the palette to place them on a canvas. Drag parts around to arrange your custom creature. Give it a silly name (with a random name generator for inspiration), pick a size (small / medium / huge), apply a color tint, then download or share your creation with a "made by" watermark.

---

## How It Was Built

### Approach

The project follows a **local-first asset pipeline** philosophy: download everything from the source, optimize it, store it locally, then build the game entirely from local data. No remote image URLs in the final app.

### Phase 0 — Asset Pipeline

1. **Data source discovery**: Facts.app runs on Sanity CMS with a publicly accessible GROQ API. Instead of scraping HTML pages, a single API call fetches structured JSON for all 60 species — names, diet arrays, dimensions, time periods, locations, and Sanity image asset references.

2. **Image acquisition** (`scripts/fetch-factsapp-dinos.js`): Parses Sanity image refs to construct CDN URLs, downloads the hero PNG for each species into `assets/dinos/raw/`, with retry logic and rate limiting.

3. **Image optimization** (`scripts/optimize-dino-images.js`): Converts raw PNGs to WebP at max 1024px using Sharp. Achieved 96.2% size reduction (120.8 MB raw → 4.6 MB optimized).

4. **Metadata normalization**: Raw diet arrays mapped to normalized meal types (carnivore, herbivore, omnivore, piscivore). Habitat inferred from taxonomy (pterosaurs → air, marine reptiles → water, rest → land). Period groups assigned from encyclopedia index with time-based fallback.

5. **Stats generation** (`scripts/generate-stats.js`): Battle stats (HP, ATK, DEF, SPD, STA) derived proportionally from species metadata — heavier species get more HP, carnivores get higher attack, armored herbivores get defense bonuses, smaller/flying species are faster. Special moves researched from Facts.app species pages and assigned to each species.

6. **Verification** (`scripts/generate-p0-report.js`): Validates every catalog entry, checks all images exist, aggregates stats by period/diet/habitat, produces `data/p0-report.json`.

The entire pipeline runs with `npm run p0`.

### Phase 1 — The Game

Pure vanilla HTML/CSS/JS. No frameworks, no bundler, no dependencies at runtime. Leaflet.js loaded from CDN for the map. Everything reads from two local JSON files (`dino-catalog.json` and `dino-stats.json`) and local WebP images.

---

## Project Structure

```
DinoWorld/
├── index.html                          # Single-page app
├── style.css                           # All styles
├── script.js                           # All game logic
├── assets/dinos/
│   ├── raw/                            # Original PNGs (gitignored, ~121 MB)
│   └── optimized/                      # WebP versions (~4.6 MB, committed)
├── data/
│   ├── dino-catalog.json               # 60 species with full metadata
│   ├── dino-stats.json                 # Battle stats, moves, coordinates
│   └── p0-report.json                  # Pipeline verification report
├── scripts/
│   ├── fetch-factsapp-dinos.js         # Sanity API fetch + image download
│   ├── optimize-dino-images.js         # PNG → WebP conversion
│   ├── generate-stats.js              # Stats + moves generation
│   └── generate-p0-report.js          # Verification + reporting
└── package.json
```

---

## Species Breakdown

| Period | Count |
|---|---|
| Permian | 1 |
| Triassic | 13 |
| Jurassic | 19 |
| Cretaceous | 27 |

| Habitat | Count |
|---|---|
| Land | 49 |
| Air | 5 |
| Water | 6 |

| Diet | Count |
|---|---|
| Carnivore | 34 |
| Herbivore | 21 |
| Omnivore | 4 |
| Piscivore | 1 |

---

## Credits & Thank You

This project would not exist without the following sources and tools. Thank you to everyone who makes knowledge free and accessible.

- **[Facts.app Encyclopedia](https://www.facts.app/encyclopedia)** — All dinosaur species data, scientific metadata, and 3D rendered imagery used in this project come from Facts.app. Their encyclopedia is an incredible resource with beautifully crafted 3D models and well-researched paleontological information. The 3D dinosaur art is created by artists including **Raul Ramos**, with paleontology consultation by **Taylor Oswald**. This project uses their content strictly for personal, non-commercial, educational purposes.

- **[Sanity.io](https://www.sanity.io)** — Facts.app's CMS backend, whose public API made structured data retrieval possible.

- **[Leaflet.js](https://leafletjs.com)** — The interactive map library, created by **Volodymyr Agafonkin**. Open source and beautifully designed.

- **[CARTO](https://carto.com) & [OpenStreetMap](https://www.openstreetmap.org)** — Map tiles and geographic data. OSM is maintained by thousands of volunteers worldwide.

- **[Sharp](https://sharp.pixelplumbing.com)** — High-performance image processing library by **Lovell Fuller**, used for PNG to WebP optimization.

- **[Claude](https://claude.ai)** — AI assistant by Anthropic, used to help build this project.

---

## Disclaimer

This is a fan project made by a dad for his kid to learn about dinosaurs in a fun way. It is **not intended for commercial use** and is **not affiliated with, endorsed by, or connected to Facts.app** in any way. All dinosaur imagery and scientific data are the property of their respective creators. If any content owner has concerns, please open an issue and it will be addressed promptly.

---

## License

This project's code is open source under the MIT License. The dinosaur imagery and data sourced from Facts.app remain the property of their respective creators and are used here under fair use for personal, non-commercial, educational purposes only.
