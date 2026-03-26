import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CATALOG_PATH = path.join(ROOT, 'data/dino-catalog.json');
const STATS_PATH = path.join(ROOT, 'data/dino-stats.json');

// ── Geo coordinates for map (by region in locationFormation) ───────────────
const REGION_COORDS = {
  'North America': { lat: 42, lng: -100 },
  'South America': { lat: -20, lng: -60 },
  'Europe': { lat: 50, lng: 10 },
  'Asia': { lat: 40, lng: 90 },
  'Africa': { lat: 5, lng: 25 },
  'Antarctica': { lat: -80, lng: 0 },
  'Australia': { lat: -25, lng: 135 },
  'India': { lat: 22, lng: 78 },
};

// Specific overrides for species with known precise locations
const COORD_OVERRIDES = {
  alamosaurus: { lat: 36.5, lng: -108.5 },
  alioramus: { lat: 44, lng: 100 },
  allosaurus: { lat: 39, lng: -110 },
  alpkarakush: { lat: 41, lng: 73 },
  ankylosaurus: { lat: 47, lng: -106 },
  austroraptor: { lat: -40, lng: -68 },
  brachiosaurus: { lat: 39.5, lng: -109 },
  caletordraco: { lat: 49.5, lng: 0.5 },
  camarasaurus: { lat: 39, lng: -109.5 },
  ceratosaurus: { lat: 38.5, lng: -110 },
  chasmosaurus: { lat: 51, lng: -111 },
  coelophysis: { lat: 36, lng: -107 },
  compsognathus: { lat: 48.8, lng: 11 },
  corythosaurus: { lat: 51.5, lng: -111.5 },
  cryolophosaurus: { lat: -84, lng: 165 },
  dakosaurus: { lat: 48.5, lng: 11 },
  daspletosaurus: { lat: 51, lng: -112 },
  deinonychus: { lat: 45, lng: -108 },
  dicraeosaurus: { lat: -10, lng: 35 },
  dimetrodon: { lat: 33, lng: -97 },
  dimorphodon: { lat: 50.7, lng: -2.9 },
  einiosaurus: { lat: 48, lng: -113 },
  ekrixinatosaurus: { lat: -38, lng: -68 },
  eonatator: { lat: 33, lng: -87 },
  eoraptor: { lat: -30, lng: -68 },
  gigantspinosaurus: { lat: 29, lng: 104 },
  glacialisaurus: { lat: -84, lng: 165 },
  guanlong: { lat: 44, lng: 88 },
  hatzegopteryx: { lat: 45.5, lng: 23 },
  herrerasaurus: { lat: -30.5, lng: -68 },
  iguanodon: { lat: 50.5, lng: 4.3 },
  inawentu: { lat: -39, lng: -69 },
  ischigualastia: { lat: -30.2, lng: -68 },
  kronosaurus: { lat: -22, lng: 142 },
  marshosaurus: { lat: 39, lng: -109 },
  mastodonsaurus: { lat: 49, lng: 9 },
  medusaceratops: { lat: 48, lng: -110 },
  pachycephalosaurus: { lat: 46.5, lng: -105 },
  panphagia: { lat: -30, lng: -68 },
  pinacosaurus: { lat: 44, lng: 100 },
  plateosaurus: { lat: 48, lng: 9 },
  promastodontosaurus: { lat: -30, lng: -68 },
  pterodactylus: { lat: 48.8, lng: 11 },
  qianzhousaurus: { lat: 25, lng: 114 },
  rajasaurus: { lat: 22, lng: 74 },
  rhamphorhynchus: { lat: 48.8, lng: 11 },
  rhomaleosaurus: { lat: 54, lng: -1 },
  riparovenator: { lat: 50.7, lng: -1.2 },
  sarcosuchus: { lat: 17, lng: 8 },
  sauropelta: { lat: 45, lng: -108 },
  saurosuchus: { lat: -30, lng: -68 },
  scelidosaurus: { lat: 50.7, lng: -2.9 },
  shonisaurus: { lat: 39, lng: -118 },
  silesaurus: { lat: 50.7, lng: 18 },
  smilosuchus: { lat: 36, lng: -110 },
  stegoceras: { lat: 51, lng: -111 },
  stegosaurus: { lat: 39, lng: -110 },
  styxosaurus: { lat: 39, lng: -100 },
  unaysaurus: { lat: -29.5, lng: -53 },
  yutyrannus: { lat: 42, lng: 121 },
};

// ── Special moves per species ──────────────────────────────────────────────
const SPECIAL_MOVES = {
  alamosaurus: [
    { name: 'Titan Stomp', type: 'attack', power: 40, description: 'Crushes foes beneath massive feet' },
    { name: 'Tail Sweep', type: 'attack', power: 35, description: 'Whip-like tail clears everything nearby' },
  ],
  alioramus: [
    { name: 'Snout Slash', type: 'attack', power: 30, description: 'Crested snout rakes across opponent' },
    { name: 'Ambush Rush', type: 'attack', power: 35, description: 'Quick burst from cover surprises prey' },
  ],
  allosaurus: [
    { name: 'Serrated Bleed', type: 'attack', power: 35, description: 'Serrated teeth inflict bleeding wounds' },
    { name: 'Claw Pin', type: 'attack', power: 30, description: 'Three-fingered grip pins prey down' },
  ],
  alpkarakush: [
    { name: 'Sky Assault', type: 'attack', power: 35, description: 'Diving attack from great height' },
    { name: 'Wing Gust', type: 'defense', power: 20, description: 'Massive wingspan creates disorienting wind' },
  ],
  ankylosaurus: [
    { name: 'Tail Club Smash', type: 'attack', power: 45, description: 'Bone club shatters legs and jaws' },
    { name: 'Armored Shell', type: 'defense', power: 0, description: 'Osteoderms absorb incoming damage' },
  ],
  austroraptor: [
    { name: 'Sickle Slash', type: 'attack', power: 30, description: 'Hyperextended sickle claw strikes' },
    { name: 'Fish Snatch', type: 'attack', power: 25, description: 'Conical teeth snag slippery prey' },
  ],
  brachiosaurus: [
    { name: 'Massive Stomp', type: 'attack', power: 45, description: 'Enormous weight crushes anything below' },
    { name: 'Neck Whip', type: 'attack', power: 30, description: 'Long neck swings like a battering ram' },
  ],
  caletordraco: [
    { name: 'Dragon Bite', type: 'attack', power: 30, description: 'Powerful jaws snap with surprising force' },
    { name: 'Sprint Attack', type: 'attack', power: 25, description: 'Quick charge closes distance fast' },
  ],
  camarasaurus: [
    { name: 'Rearing Crush', type: 'attack', power: 35, description: 'Rears up and slams down with full weight' },
    { name: 'Herd Momentum', type: 'defense', power: 0, description: 'Draws strength from nearby allies' },
  ],
  ceratosaurus: [
    { name: 'Deep Slash', type: 'attack', power: 35, description: 'Longest proportional teeth inflict deep cuts' },
    { name: 'Horn Strike', type: 'attack', power: 25, description: 'Nasal horn gores the opponent' },
  ],
  chasmosaurus: [
    { name: 'Frill Charge', type: 'attack', power: 30, description: 'Massive frill acts as battering shield' },
    { name: 'Horn Gore', type: 'attack', power: 30, description: 'Three horns thrust forward with force' },
  ],
  coelophysis: [
    { name: 'Pack Swarm', type: 'attack', power: 25, description: 'Overwhelming numbers harry the foe' },
    { name: 'Quick Snap', type: 'attack', power: 20, description: 'Lightning fast jaw snaps at soft tissue' },
  ],
  compsognathus: [
    { name: 'Quick Strike', type: 'attack', power: 20, description: 'Tiny but rapid bites with high crit chance' },
    { name: 'Evasion', type: 'defense', power: 0, description: 'Tiny size makes it nearly impossible to hit' },
  ],
  corythosaurus: [
    { name: 'Crest Call', type: 'defense', power: 0, description: 'Resonating crest disorients the attacker' },
    { name: 'Tail Lash', type: 'attack', power: 25, description: 'Heavy tail whips sideways' },
  ],
  cryolophosaurus: [
    { name: 'Frost Bite', type: 'attack', power: 30, description: 'Antarctic predator strikes with cold precision' },
    { name: 'Crest Display', type: 'defense', power: 0, description: 'Fan-shaped crest intimidates opponents' },
  ],
  dakosaurus: [
    { name: 'Orca Bite', type: 'attack', power: 35, description: 'Blade-like teeth slice through flesh' },
    { name: 'Aquatic Pursuit', type: 'attack', power: 30, description: 'Shark-like tail enables deadly pursuit' },
  ],
  daspletosaurus: [
    { name: 'Bone Crusher', type: 'attack', power: 40, description: 'Immensely powerful bite crushes bone' },
    { name: 'Pack Hunt', type: 'attack', power: 35, description: 'Coordinated family group overwhelms prey' },
  ],
  deinonychus: [
    { name: 'Killing Claw', type: 'attack', power: 35, description: 'Retractable sickle claw pins and grapples' },
    { name: 'Prey Exhaust', type: 'attack', power: 25, description: 'Relentless pursuit wears down stamina' },
  ],
  dicraeosaurus: [
    { name: 'Spine Lash', type: 'attack', power: 25, description: 'Forked neural spines rake the attacker' },
    { name: 'Stomp', type: 'attack', power: 30, description: 'Heavy weight drives downward' },
  ],
  dimetrodon: [
    { name: 'Canine Bite', type: 'attack', power: 30, description: 'Three tooth types deliver varied wounds' },
    { name: 'Sail Intimidate', type: 'defense', power: 0, description: 'Sail display makes predator back off' },
  ],
  dimorphodon: [
    { name: 'Fang Snap', type: 'attack', power: 20, description: 'Large fang-like front teeth deliver quick bites' },
    { name: 'Air Burst', type: 'defense', power: 0, description: 'Short burst flight evades ground attacks' },
  ],
  einiosaurus: [
    { name: 'Curved Horn', type: 'attack', power: 25, description: 'Forward-curving nasal horn hooks and trips' },
    { name: 'Herd Shield', type: 'defense', power: 0, description: 'Large herd provides collective protection' },
  ],
  ekrixinatosaurus: [
    { name: 'Explosive Bite', type: 'attack', power: 35, description: 'Name means "explosion-born lizard" — bites with fury' },
    { name: 'Power Charge', type: 'attack', power: 30, description: 'Thick-bodied charge knocks opponent back' },
  ],
  eonatator: [
    { name: 'Ambush Lunge', type: 'attack', power: 25, description: 'Small mosasaur strikes from concealment' },
    { name: 'Coil Escape', type: 'defense', power: 0, description: 'Serpentine body twists away from danger' },
  ],
  eoraptor: [
    { name: 'Dawn Strike', type: 'attack', power: 20, description: 'One of the earliest dinosaurs, quick and agile' },
    { name: 'Adapt', type: 'defense', power: 0, description: 'Omnivore adaptability provides survival edge' },
  ],
  gigantspinosaurus: [
    { name: 'Shoulder Spike', type: 'attack', power: 35, description: 'Enormous shoulder spines impale attackers' },
    { name: 'Spine Guard', type: 'defense', power: 0, description: 'Defensive spikes deter approach' },
  ],
  glacialisaurus: [
    { name: 'Frozen Stomp', type: 'attack', power: 25, description: 'Antarctic herbivore strikes with heavy feet' },
    { name: 'Endurance', type: 'defense', power: 0, description: 'Extreme cold survival toughens the body' },
  ],
  guanlong: [
    { name: 'Crest Slash', type: 'attack', power: 25, description: 'Head crest aids slicing attacks' },
    { name: 'Proto-tyrant', type: 'attack', power: 30, description: 'Ancestor of T-rex fights with raw fury' },
  ],
  hatzegopteryx: [
    { name: 'Stork Strike', type: 'attack', power: 40, description: 'Aircraft-sized pterosaur strikes like a giant stork' },
    { name: 'Wide Gape Crush', type: 'attack', power: 35, description: 'Enormous jaw swallows prey too large for others' },
  ],
  herrerasaurus: [
    { name: 'Primal Bite', type: 'attack', power: 30, description: 'One of the earliest predators bites with force' },
    { name: 'Sprint Ambush', type: 'attack', power: 25, description: 'Bipedal speed enables surprise attacks' },
  ],
  iguanodon: [
    { name: 'Thumb Spike', type: 'attack', power: 30, description: 'Iconic thumb spike stabs attackers' },
    { name: 'Herd Stampede', type: 'attack', power: 25, description: 'Group movement tramples threats' },
  ],
  inawentu: [
    { name: 'Tail Slam', type: 'attack', power: 30, description: 'Long tail delivers devastating sideways blow' },
    { name: 'Size Shield', type: 'defense', power: 0, description: 'Sheer bulk deters most predators' },
  ],
  ischigualastia: [
    { name: 'Tusked Ram', type: 'attack', power: 25, description: 'Dicynodont tusks and bulk ram opponents' },
    { name: 'Dig In', type: 'defense', power: 0, description: 'Low stance and heavy body resist knockback' },
  ],
  kronosaurus: [
    { name: 'Fang Strike', type: 'attack', power: 45, description: 'Tusk-like front teeth deliver devastating bites' },
    { name: 'Predatory Surge', type: 'attack', power: 35, description: 'Powerful swimming generates crushing momentum' },
  ],
  marshosaurus: [
    { name: 'Slash and Dash', type: 'attack', power: 25, description: 'Quick slashing bite then retreats' },
    { name: 'Agile Strike', type: 'attack', power: 20, description: 'Light build enables rapid repositioning' },
  ],
  mastodonsaurus: [
    { name: 'Jaw Trap', type: 'attack', power: 30, description: 'Massive flat head conceals powerful jaws' },
    { name: 'Lurk', type: 'defense', power: 0, description: 'Ambush predator waits motionless' },
  ],
  medusaceratops: [
    { name: 'Medusa Frill', type: 'attack', power: 30, description: 'Snake-like frill horns slash in all directions' },
    { name: 'Horn Charge', type: 'attack', power: 25, description: 'Ceratopsian charge at full gallop' },
  ],
  pachycephalosaurus: [
    { name: 'Cranial Bash', type: 'attack', power: 40, description: '25cm thick skull dome delivers concussive impact' },
    { name: 'Dome Shield', type: 'defense', power: 0, description: 'Bony knobs and spikes absorb blows' },
  ],
  panphagia: [
    { name: 'Versatile Bite', type: 'attack', power: 20, description: 'Mixed dentition handles any food — or foe' },
    { name: 'Survivor', type: 'defense', power: 0, description: 'Ultimate omnivore outlasts through adaptability' },
  ],
  pinacosaurus: [
    { name: 'Club Swing', type: 'attack', power: 30, description: 'Tail club connects with jarring force' },
    { name: 'Low Profile', type: 'defense', power: 0, description: 'Armored body hugs the ground' },
  ],
  plateosaurus: [
    { name: 'Rearing Strike', type: 'attack', power: 25, description: 'Bipedal stance enables downward strikes' },
    { name: 'Thumb Claw', type: 'attack', power: 25, description: 'Large thumb claw rakes opponents' },
  ],
  promastodontosaurus: [
    { name: 'Snap Ambush', type: 'attack', power: 25, description: 'Giant amphibian jaws snap shut rapidly' },
    { name: 'Submerge', type: 'defense', power: 0, description: 'Sinks below water to avoid attacks' },
  ],
  pterodactylus: [
    { name: 'Aerial Dive', type: 'attack', power: 20, description: 'Swoops down from above with precision' },
    { name: 'Quick Escape', type: 'defense', power: 0, description: 'Takes to the air to evade ground threats' },
  ],
  qianzhousaurus: [
    { name: 'Long Snout Bite', type: 'attack', power: 30, description: 'Elongated snout reaches farther than expected' },
    { name: 'Pinocchio Rush', type: 'attack', power: 25, description: 'Nicknamed "Pinocchio Rex" — charges with snout' },
  ],
  rajasaurus: [
    { name: 'Royal Bite', type: 'attack', power: 35, description: 'The "King Lizard" bites with authority' },
    { name: 'Horn Butt', type: 'attack', power: 25, description: 'Single nasal horn delivers blunt impact' },
  ],
  rhamphorhynchus: [
    { name: 'Swoop Snatch', type: 'attack', power: 20, description: 'Needle-like teeth snag prey mid-flight' },
    { name: 'Tail Rudder', type: 'defense', power: 0, description: 'Diamond-shaped tail vane enables sharp dodges' },
  ],
  rhomaleosaurus: [
    { name: 'Grip Bite', type: 'attack', power: 30, description: 'Conical teeth grip prey in unbreakable hold' },
    { name: 'Scent Track', type: 'defense', power: 0, description: 'Underwater smell sense detects prey like a shark' },
  ],
  riparovenator: [
    { name: 'Riverside Ambush', type: 'attack', power: 30, description: 'Spinosaurid hunts along waterways' },
    { name: 'Crocodile Snap', type: 'attack', power: 30, description: 'Crocodile-like snout delivers rapid bites' },
  ],
  sarcosuchus: [
    { name: 'Death Roll', type: 'attack', power: 40, description: 'Giant crocodilian spins to dismember prey' },
    { name: 'Armored Hide', type: 'defense', power: 0, description: 'Thick scutes protect from counterattacks' },
  ],
  sauropelta: [
    { name: 'Spike Shoulder', type: 'attack', power: 25, description: 'Large shoulder spines deter predators' },
    { name: 'Shield Plates', type: 'defense', power: 0, description: 'Rows of bony plates absorb damage' },
  ],
  saurosuchus: [
    { name: 'Apex Lunge', type: 'attack', power: 35, description: 'Top Triassic predator lunges at full speed' },
    { name: 'Scaly Armor', type: 'defense', power: 0, description: 'Osteoderms along back provide protection' },
  ],
  scelidosaurus: [
    { name: 'Scute Bash', type: 'attack', power: 20, description: 'Armored body slams into opponent' },
    { name: 'Bony Armor', type: 'defense', power: 0, description: 'Rows of scutes absorb all but the strongest hits' },
  ],
  shonisaurus: [
    { name: 'Giant Ram', type: 'attack', power: 40, description: 'Whale-sized ichthyosaur charges with massive bulk' },
    { name: 'Deep Dive', type: 'defense', power: 0, description: 'Dives to unreachable depths to escape' },
  ],
  silesaurus: [
    { name: 'Beak Peck', type: 'attack', power: 15, description: 'Beak-like jaw tip pecks rapidly' },
    { name: 'Nimble Dodge', type: 'defense', power: 0, description: 'Lightweight frame darts out of harm' },
  ],
  smilosuchus: [
    { name: 'Phytosaur Snap', type: 'attack', power: 30, description: 'Crocodile-like jaws snap with ambush speed' },
    { name: 'River Lurk', type: 'defense', power: 0, description: 'Semi-aquatic camouflage conceals position' },
  ],
  stegoceras: [
    { name: 'Head Ram', type: 'attack', power: 25, description: 'Dome-headed charge stuns opponents' },
    { name: 'Thick Skull', type: 'defense', power: 0, description: 'Dense skull absorbs counterattacks' },
  ],
  stegosaurus: [
    { name: 'Thagomizer', type: 'attack', power: 40, description: 'Four tail spikes deliver devastating blows' },
    { name: 'Plate Display', type: 'defense', power: 0, description: 'Dorsal plates make body appear much larger' },
  ],
  styxosaurus: [
    { name: 'Neck Lash', type: 'attack', power: 30, description: 'Extremely long neck whips sideways' },
    { name: 'Styx Dive', type: 'defense', power: 0, description: 'Named for the River Styx — vanishes into the deep' },
  ],
  unaysaurus: [
    { name: 'Tail Swipe', type: 'attack', power: 20, description: 'Balanced tail delivers quick swipes' },
    { name: 'Forager Grit', type: 'defense', power: 0, description: 'Early sauropodomorph toughness perseveres' },
  ],
  yutyrannus: [
    { name: 'Feathered Fury', type: 'attack', power: 35, description: 'Largest known feathered predator attacks in flurry' },
    { name: 'Winter Hunter', type: 'attack', power: 30, description: 'Cold-adapted tyrannosaur hunts through snow' },
  ],
};

// ── Stats derivation from metadata ─────────────────────────────────────────

function parseWeight(weightStr) {
  if (!weightStr) return 100;
  const cleaned = weightStr.replace(/[~]/g, '').trim();
  // Handle ranges like "1.7-2.7 tons" or "500-750 kg"
  const match = cleaned.match(/([\d.]+)/);
  if (!match) return 100;
  let val = parseFloat(match[1]);
  if (cleaned.toLowerCase().includes('tons') || cleaned.toLowerCase().includes('tonnes')) {
    val *= 1000; // convert to kg
  }
  return val;
}

function parseLength(lengthStr) {
  if (!lengthStr) return 3;
  const match = lengthStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 3;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function deriveStats(entry) {
  const weightKg = parseWeight(entry.dimensions?.weight);
  const lengthM = parseLength(entry.dimensions?.length);
  const habitat = entry.habitatNormalized;
  const meal = entry.mealTypeNormalized;

  // Base HP: derived from weight (heavier = more HP)
  // Range: 60-200
  let hp;
  if (weightKg >= 10000) hp = 180 + Math.min(20, weightKg / 5000);
  else if (weightKg >= 1000) hp = 120 + (weightKg / 200);
  else if (weightKg >= 100) hp = 80 + (weightKg / 30);
  else hp = 60 + (weightKg / 5);
  hp = Math.round(clamp(hp, 60, 200));

  // Attack: carnivores get bonus, size helps
  let attack;
  if (meal === 'carnivore') attack = 50 + (lengthM * 3) + (weightKg > 1000 ? 15 : 0);
  else if (meal === 'omnivore') attack = 40 + (lengthM * 2);
  else if (meal === 'piscivore') attack = 45 + (lengthM * 2);
  else attack = 30 + (lengthM * 1.5);
  attack = Math.round(clamp(attack, 30, 100));

  // Defense: herbivores with armor get bonus, heavier = more defense
  let defense = 30 + (weightKg > 2000 ? 20 : weightKg > 500 ? 10 : 0);
  if (meal === 'herbivore') defense += 15;
  if (['ankylosaurus', 'pinacosaurus', 'sauropelta', 'scelidosaurus', 'gigantspinosaurus', 'stegosaurus'].includes(entry.slug)) {
    defense += 20; // armored species
  }
  defense = Math.round(clamp(defense, 25, 100));

  // Speed: smaller/lighter = faster, air = bonus, water = medium
  let speed;
  if (habitat === 'air') speed = 75 + Math.min(25, 30 / (weightKg + 1) * 10);
  else if (habitat === 'water') speed = 55 + Math.min(25, 500 / (weightKg + 1));
  else {
    if (weightKg < 50) speed = 85;
    else if (weightKg < 200) speed = 70;
    else if (weightKg < 1000) speed = 55;
    else if (weightKg < 5000) speed = 40;
    else speed = 25;
    // Raptors/small theropods get speed bonus
    if (meal === 'carnivore' && weightKg < 500) speed += 15;
  }
  speed = Math.round(clamp(speed, 20, 100));

  // Stamina: omnivores/herbivores get endurance, size helps
  let stamina = 50;
  if (meal === 'herbivore') stamina += 15;
  if (meal === 'omnivore') stamina += 10;
  if (weightKg > 5000) stamina += 10;
  if (weightKg < 50) stamina += 10; // small ones are nimble
  stamina = Math.round(clamp(stamina, 40, 100));

  return { hp, attack, defense, speed, stamina };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Generating dino stats and special moves...\n');

  const catalog = await fs.readJson(CATALOG_PATH);
  const statsData = {};

  for (const entry of catalog.species) {
    const stats = deriveStats(entry);
    const region = entry.locationFormation.split(',')[0].trim();
    const coords = COORD_OVERRIDES[entry.slug] || REGION_COORDS[region] || { lat: 0, lng: 0 };
    const moves = SPECIAL_MOVES[entry.slug] || [
      { name: 'Bite', type: 'attack', power: 20, description: 'Basic bite attack' },
      { name: 'Brace', type: 'defense', power: 0, description: 'Braces for incoming attack' },
    ];

    statsData[entry.slug] = {
      stats,
      moves,
      coords,
      battleClass: getBattleClass(entry, stats),
    };
  }

  await fs.writeJson(STATS_PATH, statsData, { spaces: 2 });
  console.log(`Stats generated for ${Object.keys(statsData).length} species`);
  console.log(`Written to: ${STATS_PATH}`);
}

function getBattleClass(entry, stats) {
  const h = entry.habitatNormalized;
  if (h === 'air') {
    return stats.attack >= 70 ? 'striker' : 'scout';
  }
  if (h === 'water') {
    return stats.attack >= 70 ? 'heavy predator' : 'ambusher';
  }
  // land
  if (stats.defense >= 70) return 'tank';
  if (stats.speed >= 70) return 'speedster';
  if (stats.attack >= 80) return 'bruiser';
  return 'balanced';
}

main().catch(err => { console.error(err); process.exit(1); });
