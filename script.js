(() => {
  /* ── State ──────────────────────────────────────────── */
  let catalog = [];
  let stats = {};
  let leafletMap = null;
  let markers = [];
  let cardFilters = { period: 'all', meal: 'all', habitat: 'all', search: '' };
  let mapEra = 'all';

  // Battle state
  let playerDino = null;
  let cpuDino = null;
  let playerHP = 0;
  let cpuHP = 0;
  let playerMaxHP = 0;
  let cpuMaxHP = 0;
  let isPlayerTurn = true;
  let battleOver = false;
  let autoBattle = false;

  let playerDefending = false;
  let wins = 0;
  let losses = 0;

  /* ── Load data ──────────────────────────────────────── */
  Promise.all([
    fetch('data/dino-catalog.json').then(r => { if (!r.ok) throw new Error('Failed to load catalog'); return r.json(); }),
    fetch('data/dino-stats.json').then(r => { if (!r.ok) throw new Error('Failed to load stats'); return r.json(); }),
  ]).then(([cat, st]) => {
    catalog = cat.species;
    stats = st;
    initTabs();
    initMap();
    renderCards();
    renderPicker();
    initCreateTab();
  }).catch(err => {
    document.getElementById('cards-grid').innerHTML = `<div class="no-results">Error loading data: ${err.message}. Make sure to serve via HTTP (not file://).</div>`;
  });

  /* ── Tab switching ──────────────────────────────────── */
  function initTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'map' && leafletMap) {
          setTimeout(() => leafletMap.invalidateSize(), 100);
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════
     WORLD MAP
     ══════════════════════════════════════════════════════ */
  function initMap() {
    if (typeof L === 'undefined') {
      document.getElementById('leaflet-map').innerHTML = '<div style="padding:2rem;text-align:center;color:#666">Map requires internet connection to load.</div>';
      return;
    }
    leafletMap = L.map('leaflet-map', {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      worldCopyJump: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
    }).addTo(leafletMap);

    addMapMarkers();

    // Era filter
    document.querySelector('.map-filters').addEventListener('click', e => {
      const btn = e.target.closest('.map-pill');
      if (!btn) return;
      document.querySelectorAll('.map-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      mapEra = btn.dataset.era;
      updateMapMarkers();
    });
  }

  function addMapMarkers() {
    catalog.forEach(dino => {
      const s = stats[dino.slug];
      if (!s || !s.coords) return;
      // Jitter overlapping coords slightly (small offset ~50km)
      const jitter = () => (Math.random() - 0.5) * 0.8;
      const lat = s.coords.lat + jitter();
      const lng = s.coords.lng + jitter();

      const icon = L.divIcon({
        className: '',
        html: `<div class="dino-marker era-${dino.periodGroup}">
                 <img src="${dino.localOptimizedImage}" alt="${dino.displayName}" loading="lazy">
               </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(leafletMap);
      marker._dinoSlug = dino.slug;
      marker._dinoPeriod = dino.periodGroup;

      const popupContent = document.createElement('div');
      popupContent.className = 'dino-popup';
      popupContent.innerHTML = `
          <img src="${dino.localOptimizedImage}" alt="${dino.displayName}">
          <h3>${dino.displayName}</h3>
          <div class="popup-meta">${dino.periodGroup} &middot; ${dino.mealTypeNormalized} &middot; ${dino.habitatNormalized}</div>
          <div class="popup-meta">${dino.locationFormation}</div>
          <button class="popup-btn">View Card</button>
      `;
      popupContent.querySelector('.popup-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        leafletMap.closePopup();
        openModal(dino.slug);
      });
      marker.bindPopup(popupContent);

      markers.push(marker);
    });
  }

  function updateMapMarkers() {
    markers.forEach(m => {
      if (mapEra === 'all' || m._dinoPeriod === mapEra) {
        if (!leafletMap.hasLayer(m)) leafletMap.addLayer(m);
      } else {
        if (leafletMap.hasLayer(m)) leafletMap.removeLayer(m);
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     DINO CARDS
     ══════════════════════════════════════════════════════ */
  const cardsGrid = document.getElementById('cards-grid');
  const cardsCount = document.getElementById('cards-count');
  const searchInput = document.getElementById('search');

  // Filter handlers
  document.querySelectorAll('#tab-cards .pills').forEach(group => {
    group.addEventListener('click', e => {
      const btn = e.target.closest('.pill');
      if (!btn) return;
      group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.value;
      if (group.id === 'period-filters') cardFilters.period = val;
      else if (group.id === 'meal-filters') cardFilters.meal = val;
      else if (group.id === 'habitat-filters') cardFilters.habitat = val;
      renderCards();
    });
  });
  searchInput.addEventListener('input', e => {
    cardFilters.search = e.target.value.toLowerCase();
    renderCards();
  });

  function getFiltered() {
    return catalog.filter(s => {
      if (cardFilters.period !== 'all' && s.periodGroup !== cardFilters.period) return false;
      if (cardFilters.meal !== 'all' && s.mealTypeNormalized !== cardFilters.meal) return false;
      if (cardFilters.habitat !== 'all' && s.habitatNormalized !== cardFilters.habitat) return false;
      if (cardFilters.search && !s.displayName.toLowerCase().includes(cardFilters.search) && !s.slug.includes(cardFilters.search)) return false;
      return true;
    });
  }

  function renderCards() {
    const filtered = getFiltered();
    cardsCount.textContent = `${filtered.length} species`;
    if (filtered.length === 0) {
      cardsGrid.innerHTML = '<div class="no-results">No species match the current filters.</div>';
      return;
    }
    cardsGrid.innerHTML = filtered.map(s => {
      const st = stats[s.slug]?.stats || { hp: 0, attack: 0, defense: 0, speed: 0 };
      return `
      <div class="card" data-slug="${s.slug}">
        <div class="card-img-wrap">
          <img src="${s.localOptimizedImage}" alt="${s.displayName}" loading="lazy">
        </div>
        <div class="card-body">
          <div class="card-name" title="${s.displayName}">${s.displayName}</div>
          <div class="card-tags">
            <span class="tag tag-period">${s.periodGroup}</span>
            <span class="tag tag-meal">${s.mealTypeNormalized}</span>
            <span class="tag tag-habitat" data-h="${s.habitatNormalized}">${s.habitatNormalized}</span>
          </div>
          <div class="card-stats">
            ${miniStat('HP', st.hp, 'hp')}
            ${miniStat('ATK', st.attack, 'atk')}
            ${miniStat('DEF', st.defense, 'def')}
            ${miniStat('SPD', st.speed, 'spd')}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function miniStat(label, val, cls) {
    const pct = Math.min(100, (val / 200) * 100);
    return `<div class="card-stat">
      <span>${label}</span>
      <div class="card-stat-bar"><div class="card-stat-fill fill-${cls}" style="width:${pct}%"></div></div>
    </div>`;
  }

  // Card click → modal
  cardsGrid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    openModal(card.dataset.slug);
  });

  /* ── Modal ──────────────────────────────────────────── */
  const modal = document.getElementById('card-modal');
  window.__openModal = openModal; // for map popup button

  function openModal(slug) {
    const s = catalog.find(x => x.slug === slug);
    const st = stats[slug];
    if (!s || !st) return;

    document.getElementById('modal-img').src = s.localOptimizedImage;
    document.getElementById('modal-img').alt = s.displayName;
    document.getElementById('modal-name').textContent = s.displayName;
    document.getElementById('modal-period').textContent = s.periodGroup;
    document.getElementById('modal-time').textContent = s.timeStagesText;
    document.getElementById('modal-diet').textContent = (Array.isArray(s.foodTypeRaw) ? s.foodTypeRaw.join(', ') : String(s.foodTypeRaw || '')) + ` (${s.mealTypeNormalized})`;
    document.getElementById('modal-habitat').textContent = s.habitatNormalized;
    document.getElementById('modal-location').textContent = s.locationFormation || '\u2014';
    const dim = s.dimensions || {};
    document.getElementById('modal-length').textContent = dim.length || '\u2014';
    const h = String(dim.height || '\u2014');
    document.getElementById('modal-height').textContent = h.includes('Compare') ? '\u2014' : h;
    document.getElementById('modal-weight').textContent = dim.weight || '\u2014';
    const wsRow = document.getElementById('modal-wingspan-row');
    if (dim.wingspan) {
      wsRow.style.display = '';
      document.getElementById('modal-wingspan').textContent = dim.wingspan;
    } else {
      wsRow.style.display = 'none';
    }
    document.getElementById('modal-class').textContent = st.battleClass;
    document.getElementById('modal-link').href = s.factsAppPageUrl;

    // Tags
    document.getElementById('modal-tags').innerHTML = `
      <span class="tag tag-period">${s.periodGroup}</span>
      <span class="tag tag-meal">${s.mealTypeNormalized}</span>
      <span class="tag tag-habitat" data-h="${s.habitatNormalized}">${s.habitatNormalized}</span>
    `;

    // Stats bars
    const statsDef = [
      { key: 'hp', label: 'HP', color: '#2e7d32', max: 200 },
      { key: 'attack', label: 'ATK', color: '#d32f2f', max: 100 },
      { key: 'defense', label: 'DEF', color: '#1565c0', max: 100 },
      { key: 'speed', label: 'SPD', color: '#f9a825', max: 100 },
      { key: 'stamina', label: 'STA', color: '#7b1fa2', max: 100 },
    ];
    document.getElementById('modal-stats').innerHTML = statsDef.map(d => {
      const val = st.stats[d.key];
      const pct = (val / d.max) * 100;
      return `<div class="stat-row">
        <span class="stat-label">${d.label}</span>
        <div class="stat-bar-wrap"><div class="stat-bar-inner" style="width:${pct}%;background:${d.color}"></div></div>
        <span class="stat-val">${val}</span>
      </div>`;
    }).join('');

    // Moves
    const movesHtml = st.moves.map(m => `
      <div class="move-card">
        <span class="move-name">${m.name}</span>
        <span class="move-type">${m.type}${m.power ? ' \u2022 Power ' + m.power : ''}</span>
        <div class="move-desc">${m.description}</div>
      </div>
    `).join('');
    document.getElementById('modal-moves').innerHTML = `<h4>Special Moves</h4>${movesHtml}`;

    modal.classList.add('open');
  }

  document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('open'); });

  /* ══════════════════════════════════════════════════════
     BATTLE TAB
     ══════════════════════════════════════════════════════ */
  const pickerGrid = document.getElementById('picker-grid');
  const pickerSearch = document.getElementById('picker-search');

  function renderPicker(filter = '') {
    const filtered = filter
      ? catalog.filter(s => s.displayName.toLowerCase().includes(filter) || s.slug.includes(filter))
      : catalog;
    pickerGrid.innerHTML = filtered.map(s => `
      <div class="picker-card" data-slug="${s.slug}">
        <img src="${s.localOptimizedImage}" alt="${s.displayName}" loading="lazy">
        <div class="picker-name">${s.displayName.split(' ')[0]}</div>
      </div>
    `).join('');
  }

  pickerSearch.addEventListener('input', e => renderPicker(e.target.value.toLowerCase()));

  pickerGrid.addEventListener('click', e => {
    const card = e.target.closest('.picker-card');
    if (!card) return;
    selectPlayerDino(card.dataset.slug);
  });

  function selectPlayerDino(slug) {
    playerDino = catalog.find(x => x.slug === slug);
    rollCPU();
    showPhase('battle-matchup');
    document.getElementById('mu-player-img').src = playerDino.localOptimizedImage;
    document.getElementById('mu-player-name').textContent = playerDino.displayName;
    updateCPUMatchup();
  }

  function rollCPU() {
    const pool = catalog.filter(s => s.slug !== playerDino.slug);
    cpuDino = pool[Math.floor(Math.random() * pool.length)];
  }

  function updateCPUMatchup() {
    document.getElementById('mu-cpu-img').src = cpuDino.localOptimizedImage;
    document.getElementById('mu-cpu-name').textContent = cpuDino.displayName;
  }

  document.getElementById('reroll-btn').addEventListener('click', () => {
    rollCPU();
    updateCPUMatchup();
  });

  document.getElementById('back-pick-btn').addEventListener('click', () => showPhase('battle-pick'));

  document.getElementById('start-fight-btn').addEventListener('click', () => {
    autoBattle = false;
    startFight();
  });

  document.getElementById('auto-fight-btn').addEventListener('click', () => {
    autoBattle = true;
    startFight();
  });

  document.getElementById('rematch-btn').addEventListener('click', () => {
    autoBattle = false;
    startFight();
  });

  document.getElementById('new-fight-btn').addEventListener('click', () => {
    showPhase('battle-pick');
    pickerSearch.value = '';
    renderPicker();
  });

  function showPhase(id) {
    document.querySelectorAll('.battle-phase').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }

  /* ── Fight engine ───────────────────────────────────── */
  function startFight() {
    const ps = stats[playerDino.slug];
    const cs = stats[cpuDino.slug];
    playerMaxHP = ps.stats.hp;
    cpuMaxHP = cs.stats.hp;
    playerHP = playerMaxHP;
    cpuHP = cpuMaxHP;
    isPlayerTurn = ps.stats.speed >= cs.stats.speed;
    battleOver = false;
    playerDefending = false;

    showPhase('battle-fight');

    // Setup arena
    document.getElementById('arena-p-name').textContent = playerDino.displayName;
    document.getElementById('arena-c-name').textContent = cpuDino.displayName;
    document.getElementById('arena-p-img').src = playerDino.localOptimizedImage;
    document.getElementById('arena-c-img').src = cpuDino.localOptimizedImage;
    document.getElementById('battle-log').innerHTML = '';

    updateHPBars();
    renderMoveButtons();

    if (autoBattle) {
      runAutoBattle();
    } else {
      setTurn(isPlayerTurn);
    }
  }

  function updateHPBars() {
    const pPct = Math.max(0, (playerHP / playerMaxHP) * 100);
    const cPct = Math.max(0, (cpuHP / cpuMaxHP) * 100);
    document.getElementById('arena-p-hp').style.width = pPct + '%';
    document.getElementById('arena-c-hp').style.width = cPct + '%';
    document.getElementById('arena-p-hp-text').textContent = `${Math.max(0, playerHP)} / ${playerMaxHP}`;
    document.getElementById('arena-c-hp-text').textContent = `${Math.max(0, cpuHP)} / ${cpuMaxHP}`;
  }

  function renderMoveButtons() {
    const ps = stats[playerDino.slug];
    const moves = ps.moves;
    const basicAtk = { name: 'Basic Attack', type: 'attack', power: 15, description: 'A basic attack' };
    const defend = { name: 'Defend', type: 'defense', power: 0, description: 'Brace for next hit, reduce damage' };
    const allMoves = [...moves, basicAtk, defend];

    document.getElementById('move-buttons').innerHTML = allMoves.map((m, i) => `
      <button class="move-btn" data-idx="${i}">
        <div class="mb-name">${m.name}</div>
        <div class="mb-meta">${m.type}${m.power ? ' \u2022 Power ' + m.power : ''}</div>
        <div class="mb-desc">${m.description}</div>
      </button>
    `).join('');

    document.querySelectorAll('.move-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (battleOver || !isPlayerTurn || autoBattle) return;
        const idx = parseInt(btn.dataset.idx);
        const ps2 = stats[playerDino.slug];
        const allMoves2 = [...ps2.moves, basicAtk, defend];
        const move = allMoves2[idx];
        executePlayerTurn(move);
      });
    });
  }

  function setTurn(player) {
    isPlayerTurn = player;
    const indicator = document.getElementById('turn-indicator');
    indicator.textContent = player ? 'Your Turn' : 'CPU Turn';
    document.querySelectorAll('.move-btn').forEach(b => b.disabled = !player);

    if (!player && !battleOver && !autoBattle) {
      setTimeout(executeCPUTurn, 800);
    }
  }

  function calcDamage(attacker, defender, move) {
    const atkStat = stats[attacker.slug].stats.attack;
    const defStat = stats[defender.slug].stats.defense;
    const spdStat = stats[attacker.slug].stats.speed;

    if (move.type === 'defense') return 0;

    const basePower = move.power || 15;
    const atkMod = atkStat / 50;
    const defMod = defStat / 100;
    let dmg = Math.round(basePower * atkMod * (1 - defMod * 0.4));

    // Crit chance (speed-based)
    if (Math.random() * 100 < spdStat / 4) {
      dmg = Math.round(dmg * 1.5);
      return { dmg, crit: true, miss: false };
    }

    // Miss chance (low accuracy vs high speed defender)
    const defSpd = stats[defender.slug].stats.speed;
    if (Math.random() * 100 < defSpd / 8) {
      return { dmg: 0, crit: false, miss: true };
    }

    // Variance
    dmg = Math.max(1, dmg + Math.round((Math.random() - 0.5) * 6));
    return { dmg, crit: false, miss: false };
  }

  function addLog(html) {
    const log = document.getElementById('battle-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = html;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function shakeImg(id) {
    const img = document.getElementById(id);
    img.classList.add('hit');
    setTimeout(() => img.classList.remove('hit'), 350);
  }

  function executePlayerTurn(move) {
    if (battleOver) return;

    if (move.type === 'defense') {
      playerDefending = true;
      addLog(`<b>${playerDino.displayName.split(' ')[0]}</b> braces for impact! (damage halved next hit)`);
      setTurn(false);
      return;
    }

    const result = calcDamage(playerDino, cpuDino, move);
    if (result.miss) {
      addLog(`<b>${playerDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="miss">Miss!</span>`);
    } else {
      cpuHP -= result.dmg;
      shakeImg('arena-c-img');
      const critTxt = result.crit ? ' <b>CRITICAL!</b>' : '';
      addLog(`<b>${playerDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="dmg">${result.dmg} dmg</span>${critTxt}`);
    }
    updateHPBars();

    if (cpuHP <= 0) {
      endBattle(true);
      return;
    }
    setTurn(false);
  }

  function executeCPUTurn() {
    if (battleOver) return;
    const cs = stats[cpuDino.slug];
    const moves = cs.moves.filter(m => m.type === 'attack');
    const move = moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : { name: 'Basic Attack', type: 'attack', power: 15 };

    const result = calcDamage(cpuDino, playerDino, move);
    if (result.miss) {
      addLog(`<b>${cpuDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="miss">Miss!</span>`);
    } else {
      let finalDmg = result.dmg;
      let defTxt = '';
      if (playerDefending) {
        finalDmg = Math.max(1, Math.round(finalDmg / 2));
        defTxt = ' (blocked!)';
        playerDefending = false;
      }
      playerHP -= finalDmg;
      shakeImg('arena-p-img');
      const critTxt = result.crit ? ' <b>CRITICAL!</b>' : '';
      addLog(`<b>${cpuDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="dmg">${finalDmg} dmg</span>${critTxt}${defTxt}`);
    }
    updateHPBars();

    if (playerHP <= 0) {
      endBattle(false);
      return;
    }
    setTurn(true);
  }

  /* ── Auto battle ────────────────────────────────────── */
  async function runAutoBattle() {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    let turn = isPlayerTurn;

    while (!battleOver) {
      await delay(600);
      if (turn) {
        // Player auto-picks a random attack move
        const ps = stats[playerDino.slug];
        const atkMoves = ps.moves.filter(m => m.type === 'attack');
        const move = atkMoves.length > 0 ? atkMoves[Math.floor(Math.random() * atkMoves.length)] : { name: 'Basic Attack', type: 'attack', power: 15 };
        const result = calcDamage(playerDino, cpuDino, move);
        if (result.miss) {
          addLog(`<b>${playerDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="miss">Miss!</span>`);
        } else {
          cpuHP -= result.dmg;
          shakeImg('arena-c-img');
          const critTxt = result.crit ? ' <b>CRITICAL!</b>' : '';
          addLog(`<b>${playerDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="dmg">${result.dmg} dmg</span>${critTxt}`);
        }
        updateHPBars();
        if (cpuHP <= 0) { endBattle(true); return; }
      } else {
        const cs = stats[cpuDino.slug];
        const atkMoves = cs.moves.filter(m => m.type === 'attack');
        const move = atkMoves.length > 0 ? atkMoves[Math.floor(Math.random() * atkMoves.length)] : { name: 'Basic Attack', type: 'attack', power: 15 };
        const result = calcDamage(cpuDino, playerDino, move);
        if (result.miss) {
          addLog(`<b>${cpuDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="miss">Miss!</span>`);
        } else {
          playerHP -= result.dmg;
          shakeImg('arena-p-img');
          const critTxt = result.crit ? ' <b>CRITICAL!</b>' : '';
          addLog(`<b>${cpuDino.displayName.split(' ')[0]}</b> used <b>${move.name}</b> \u2014 <span class="dmg">${result.dmg} dmg</span>${critTxt}`);
        }
        updateHPBars();
        if (playerHP <= 0) { endBattle(false); return; }
      }
      turn = !turn;
      document.getElementById('turn-indicator').textContent = turn ? 'Your Turn' : 'CPU Turn';
    }
  }

  function endBattle(playerWon) {
    battleOver = true;
    if (playerWon) wins++; else losses++;
    updateScoreboard();

    setTimeout(() => {
      showPhase('battle-result');
      const banner = document.getElementById('result-banner');
      const details = document.getElementById('result-details');

      // Populate result matchup images
      document.getElementById('result-player-img').src = playerDino.localOptimizedImage;
      document.getElementById('result-cpu-img').src = cpuDino.localOptimizedImage;
      document.getElementById('result-player-name').textContent = playerDino.displayName;
      document.getElementById('result-cpu-name').textContent = cpuDino.displayName;
      document.getElementById('result-player-hp').textContent = `${Math.max(0, playerHP)} / ${playerMaxHP} HP`;
      document.getElementById('result-cpu-hp').textContent = `${Math.max(0, cpuHP)} / ${cpuMaxHP} HP`;

      const pFighter = document.getElementById('result-player');
      const cFighter = document.getElementById('result-cpu');
      pFighter.className = 'result-fighter ' + (playerWon ? 'winner' : 'loser');
      cFighter.className = 'result-fighter ' + (playerWon ? 'loser' : 'winner');
      document.getElementById('result-player-trophy').textContent = '\uD83C\uDFC6';
      document.getElementById('result-cpu-trophy').textContent = '\uD83C\uDFC6';

      if (playerWon) {
        banner.textContent = 'Victory!';
        banner.className = 'result-banner win';
        details.textContent = `${playerDino.displayName} defeated ${cpuDino.displayName}!`;
      } else {
        banner.textContent = 'Defeated!';
        banner.className = 'result-banner lose';
        details.textContent = `${cpuDino.displayName} defeated ${playerDino.displayName}!`;
      }
    }, 800);
  }

  /* ── Scoreboard ─────────────────────────────────────── */
  function updateScoreboard() {
    document.getElementById('score-wins').textContent = wins;
    document.getElementById('score-losses').textContent = losses;
  }

  function getTrainerName() {
    return document.getElementById('trainer-name').value.trim() || 'Trainer';
  }

  function getShareText(context) {
    const name = getTrainerName();
    if (context === 'score') {
      return `${name}'s Dino World record: ${wins}W - ${losses}L\n\nCan you beat my score? Play Dino World!`;
    }
    // battle result
    const lastWon = document.getElementById('result-banner').classList.contains('win');
    if (lastWon) {
      return `${name}'s ${playerDino.displayName} just defeated ${cpuDino.displayName} in Dino World! Record: ${wins}W-${losses}L`;
    }
    return `${name}'s ${playerDino.displayName} was defeated by ${cpuDino.displayName} in Dino World! Record: ${wins}W-${losses}L`;
  }

  /* ── Share handlers ─────────────────────────────────── */
  document.getElementById('share-btn').addEventListener('click', () => {
    shareToClipboard(getShareText('score'));
  });

  document.getElementById('share-result-btn').addEventListener('click', () => {
    shareToClipboard(getShareText('result'));
  });

  document.getElementById('share-x-btn').addEventListener('click', () => {
    const text = encodeURIComponent(getShareText('result'));
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'width=550,height=420');
  });

  async function shareToClipboard(text) {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (_) { /* user cancelled or not supported */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch (_) {
      showToast('Could not copy');
    }
  }

  /* ── Toast ──────────────────────────────────────────── */
  let toastEl = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ══════════════════════════════════════════════════════
     CREATE DINO TAB
     ══════════════════════════════════════════════════════ */
  const DINO_NAMES_FIRST = [
    'Mega','Thunder','Blaze','Frost','Shadow','Storm','Turbo','Spike',
    'Razor','Fang','Iron','Crystal','Chaos','Nitro','Cosmic','Magma',
    'Phantom','Neon','Pixel','Ultra','Star','Atomic','Hyper','Solar',
    'Crunchy','Fluffy','Silly','Wobble','Grumpy','Jolly','Snappy','Dizzy',
  ];
  const DINO_NAMES_SECOND = [
    'saurus','raptor','don','tops','dactyl','claw','tooth','bite',
    'horn','tail','wing','jaw','skull','spine','scale','frill',
    'chomp','stomp','zilla','tron','asaur','odon','nyx','rex',
    'munch','wiggle','snout','plop','bonk','flop','derp','noodle',
  ];

  let placedParts = [];
  let createScale = 1;
  let createColor = 'none';
  let loadedImages = {};
  let dragPart = null;

  function initCreateTab() {
    const partsGrid = document.getElementById('parts-grid');
    // Use catalog dino images as "parts"
    catalog.forEach(s => {
      const thumb = document.createElement('div');
      thumb.className = 'part-thumb';
      thumb.innerHTML = `<img src="${s.localOptimizedImage}" alt="${s.displayName}" loading="lazy">`;
      thumb.addEventListener('click', () => addPartToCanvas(s));
      partsGrid.appendChild(thumb);
    });

    // Random name button
    document.getElementById('random-name-btn').addEventListener('click', () => {
      document.getElementById('create-name').value = generateDinoName();
    });
    // Auto-fill a name on load
    document.getElementById('create-name').value = generateDinoName();

    // Size pills
    document.getElementById('size-pills').addEventListener('click', e => {
      const pill = e.target.closest('.size-pill');
      if (!pill) return;
      document.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      createScale = parseFloat(pill.dataset.size);
      redrawCanvas();
    });

    // Color swatches
    document.getElementById('color-swatches').addEventListener('click', e => {
      const sw = e.target.closest('.swatch');
      if (!sw) return;
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      createColor = sw.dataset.color;
      redrawCanvas();
    });

    // Canvas drag support
    const canvas = document.getElementById('create-canvas');
    canvas.addEventListener('mousedown', onCanvasPointerDown);
    canvas.addEventListener('mousemove', onCanvasPointerMove);
    canvas.addEventListener('mouseup', onCanvasPointerUp);
    canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', onCanvasPointerUp);

    // Clear
    document.getElementById('create-clear-btn').addEventListener('click', () => {
      placedParts = [];
      redrawCanvas();
      document.getElementById('canvas-hint').classList.remove('hidden');
    });

    // Share
    document.getElementById('create-share-btn').addEventListener('click', shareCreation);
    document.getElementById('create-download-btn').addEventListener('click', downloadCreation);
  }

  function generateDinoName() {
    const a = DINO_NAMES_FIRST[Math.floor(Math.random() * DINO_NAMES_FIRST.length)];
    const b = DINO_NAMES_SECOND[Math.floor(Math.random() * DINO_NAMES_SECOND.length)];
    return a + b;
  }

  function addPartToCanvas(species) {
    document.getElementById('canvas-hint').classList.add('hidden');
    const canvas = document.getElementById('create-canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    // Place in a random-ish position near center
    const cx = canvas.width / 2 + (Math.random() - 0.5) * 200;
    const cy = canvas.height / 2 + (Math.random() - 0.5) * 150;

    const part = {
      slug: species.slug,
      src: species.localOptimizedImage,
      x: cx,
      y: cy,
      w: 100,
      h: 100,
      rotation: (Math.random() - 0.5) * 30,
      flipX: Math.random() > 0.5,
    };

    // Preload image if not loaded
    if (!loadedImages[part.src]) {
      const img = new Image();
      img.onload = () => {
        loadedImages[part.src] = img;
        redrawCanvas();
      };
      img.src = part.src;
    }

    placedParts.push(part);
    redrawCanvas();
  }

  function getCanvasCoord(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function hitTestPart(mx, my) {
    // Check from top (last placed) to bottom
    for (let i = placedParts.length - 1; i >= 0; i--) {
      const p = placedParts[i];
      const s = createScale;
      const hw = (p.w * s) / 2;
      const hh = (p.h * s) / 2;
      if (mx >= p.x - hw && mx <= p.x + hw && my >= p.y - hh && my <= p.y + hh) {
        return i;
      }
    }
    return -1;
  }

  function onCanvasPointerDown(e) {
    const canvas = document.getElementById('create-canvas');
    const { x, y } = getCanvasCoord(e, canvas);
    const idx = hitTestPart(x, y);
    if (idx >= 0) {
      dragPart = { idx, offsetX: x - placedParts[idx].x, offsetY: y - placedParts[idx].y };
      // Move to front
      const part = placedParts.splice(idx, 1)[0];
      placedParts.push(part);
      dragPart.idx = placedParts.length - 1;
    }
  }

  function onCanvasTouchStart(e) {
    e.preventDefault();
    onCanvasPointerDown(e);
  }

  function onCanvasPointerMove(e) {
    if (!dragPart) return;
    const canvas = document.getElementById('create-canvas');
    const { x, y } = getCanvasCoord(e, canvas);
    placedParts[dragPart.idx].x = x - dragPart.offsetX;
    placedParts[dragPart.idx].y = y - dragPart.offsetY;
    redrawCanvas();
  }

  function onCanvasTouchMove(e) {
    e.preventDefault();
    onCanvasPointerMove(e);
  }

  function onCanvasPointerUp() {
    dragPart = null;
  }

  function redrawCanvas() {
    const canvas = document.getElementById('create-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each placed part
    for (const part of placedParts) {
      const img = loadedImages[part.src];
      if (!img) continue;
      const s = createScale;
      const w = part.w * s;
      const h = part.h * s;

      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate((part.rotation * Math.PI) / 180);
      if (part.flipX) ctx.scale(-1, 1);

      // Draw image, optionally tinted
      if (createColor !== 'none') {
        // Render tinted version via offscreen canvas
        const off = document.createElement('canvas');
        off.width = Math.ceil(w);
        off.height = Math.ceil(h);
        const oc = off.getContext('2d');
        oc.drawImage(img, 0, 0, w, h);
        oc.globalCompositeOperation = 'source-atop';
        oc.fillStyle = createColor;
        oc.globalAlpha = 0.4;
        oc.fillRect(0, 0, w, h);
        ctx.drawImage(off, -w / 2, -h / 2);
      } else {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }

      ctx.restore();
    }

    // Watermark
    if (placedParts.length > 0) {
      const name = document.getElementById('create-name').value.trim() || 'Unnamed';
      const trainer = document.getElementById('trainer-name')?.value.trim() || '';
      ctx.save();
      ctx.font = '600 14px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.textAlign = 'right';
      const credit = trainer ? `${name} - made by ${trainer} in Dino World` : `${name} - Dino World`;
      ctx.fillText(credit, canvas.width - 12, canvas.height - 12);
      ctx.restore();
    }
  }

  function getExportCanvas() {
    // Re-render with watermark baked in
    redrawCanvas();
    return document.getElementById('create-canvas');
  }

  function shareCreation() {
    const canvas = getExportCanvas();
    canvas.toBlob(async (blob) => {
      if (!blob) { showToast('Could not create image'); return; }
      const name = document.getElementById('create-name').value.trim() || 'My Dino';
      const trainer = document.getElementById('trainer-name')?.value.trim() || '';
      const text = trainer
        ? `Check out "${name}" - my custom dinosaur made by ${trainer} in Dino World!`
        : `Check out "${name}" - my custom dinosaur from Dino World!`;

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'my-dino.png', { type: 'image/png' });
        const shareData = { text, files: [file] };
        if (navigator.canShare(shareData)) {
          try { await navigator.share(shareData); return; } catch (_) {}
        }
      }
      // Fallback: copy text
      try {
        await navigator.clipboard.writeText(text);
        showToast('Caption copied! Save the image with Download button.');
      } catch (_) {
        showToast('Use Download button to save your dino');
      }
    }, 'image/png');
  }

  function downloadCreation() {
    const canvas = getExportCanvas();
    const name = document.getElementById('create-name').value.trim() || 'my-dino';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const link = document.createElement('a');
    link.download = `${slug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Dino saved!');
  }

  // Name input triggers canvas redraw (for watermark)
  document.getElementById('create-name')?.addEventListener('input', redrawCanvas);
})();
