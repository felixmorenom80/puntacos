/* ===================== Puntacos - Contenedor ===================== */
/*
 * CONTRATO entre el Shell (este archivo) y un módulo de juego (p.ej.
 * anotador-universal.js, y en el futuro sushi-go.js, etc.).
 *
 * El Shell solo conoce esta interfaz; nunca lee ni depende de campos
 * internos de un juego concreto. Cada juego es libre de tener sus propias
 * reglas, su propia forma de estado y su propia UI dentro de los <div>
 * que el Shell le entrega para montar su contenido.
 *
 * Un juego se registra así:
 *
 *   window.PuntacosGames[id] = {
 *     // --- Identificación (id y name obligatorios; el resto es opcional,
 *     //     el Shell ya tiene un valor por defecto si faltan) ---
 *     id,                 // string único, es la clave del propio registro
 *     name,                // string, nombre mostrado en Inicio/Ranking/etc.
 *     icon,                 // string (emoji), opcional — por defecto 🎲
 *     desc,                 // string, opcional — subtítulo en la card de Inicio
 *     gradient,             // string CSS (linear-gradient...), opcional
 *     minPlayers, maxPlayers, // number, opcional — solo se usan para mostrar
 *                              // el rango "2–6 jugadores" en Inicio
 *
 *     // --- Pantalla de configuración ---
 *     // El Shell monta esta función dentro de un <div> vacío cuando el
 *     // usuario elige el juego. El propio juego decide toda su UI: cuántos
 *     // jugadores, cuáles (a partir del roster completo que recibe), y
 *     // qué opciones de partida existen.
 *     //   container: nodo DOM donde pintar el formulario de configuración
 *     //   roster:    string[] — TODOS los jugadores guardados (el juego
 *     //              decide cuáles usar; el Shell no filtra nada)
 *     //   onStart(config, tag, players): el juego llama a esto cuando el
 *     //              usuario pulsa "Iniciar partida"
 *     //     config:  cualquier valor serializable en JSON, con la forma
 *     //              que el juego necesite (el Shell lo trata como caja
 *     //              negra: solo lo guarda y se lo vuelve a pasar tal cual
 *     //              a playScreen)
 *     //     tag:     string, etiqueta libre de la partida (puede ir vacía)
 *     //     players: string[], los jugadores finales de la partida, en el
 *     //              orden que decida el propio juego
 *     configScreen(container, roster, onStart),
 *
 *     // --- Pantalla de partida (arranque y reanudación) ---
 *     //   container:  nodo DOM donde pintar el marcador
 *     //   players:    string[], el mismo array que el juego pasó a onStart
 *     //   config:     el mismo objeto que el juego pasó a onStart
 *     //   savedState: `null` en una partida nueva, o exactamente el último
 *     //               valor que el juego pasó a callbacks.onStateChange (al
 *     //               reanudar). El juego debe saber reconstruirse a partir
 *     //               de este valor solo, y manejar el caso `null`.
 *     //   callbacks.onStateChange(state): llamar cada vez que haya que
 *     //               persistir el progreso (p.ej. tras cada punto). `state`
 *     //               puede ser cualquier valor serializable en JSON — el
 *     //               Shell lo guarda sin mirarlo y es justo lo que luego
 *     //               llega como `savedState` si el usuario reanuda.
 *     //   callbacks.onFinish(results): llamar cuando la partida termina.
 *     //               results: Array<{name, score}>, SIEMPRE ordenado de
 *     //               ganador a último (results[0] es quien ganó, sea cual
 *     //               sea la métrica interna del juego para decidirlo —
 *     //               más puntos, menos puntos, lo que sea).
 *     playScreen(container, players, config, savedState, {onStateChange, onFinish})
 *   }
 *
 * El Anotador Universal (anotador-universal.js) es la implementación de
 * referencia de este contrato.
 */

window.PuntacosGames = window.PuntacosGames || {};

const Store = {
  getPlayers() {
    return JSON.parse(localStorage.getItem('pc_players') || '[]');
  },
  setPlayers(list) {
    localStorage.setItem('pc_players', JSON.stringify(list));
  },
  getActive() {
    const raw = localStorage.getItem('pc_active');
    return raw ? JSON.parse(raw) : null;
  },
  setActive(active) {
    if (active) localStorage.setItem('pc_active', JSON.stringify(active));
    else localStorage.removeItem('pc_active');
  },
  getHistory() {
    return JSON.parse(localStorage.getItem('pc_history') || '[]');
  },
  addHistory(entry) {
    const h = Store.getHistory();
    h.unshift(entry);
    localStorage.setItem('pc_history', JSON.stringify(h));
  },
  getSettings() {
    return Object.assign(
      { darkMode: false, wakeLock: false },
      JSON.parse(localStorage.getItem('pc_settings') || '{}')
    );
  },
  setSettings(settings) {
    localStorage.setItem('pc_settings', JSON.stringify(settings));
  }
};
window.Store = Store;

let _wakeLock = null;

function applyTheme() {
  const s = Store.getSettings();
  document.documentElement.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', s.darkMode ? '#1b1b1f' : '#f7f7fa');
}

// Feedback háptico centralizado: vibraciones muy breves, sin permisos ni ajustes.
// Si el navegador/dispositivo no soporta navigator.vibrate, no hace nada.
const HAPTIC_MS = { tap: 10, undo: 15, rematch: 20, finish: 30 };

function haptic(kind) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(HAPTIC_MS[kind] || HAPTIC_MS.tap);
  } catch (e) { /* bloqueado o sin soporte real: se ignora */ }
}

function applyWakeLock() {
  const s = Store.getSettings();
  if (s.wakeLock && 'wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then((lock) => { _wakeLock = lock; }).catch(() => {});
  } else if (_wakeLock) {
    _wakeLock.release().catch(() => {});
    _wakeLock = null;
  }
}

const app = document.getElementById('app');

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 5H4a1 1 0 00-1 1v1a4 4 0 004 4M17 5h3a1 1 0 011 1v1a4 4 0 01-4 4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1.5"/><rect x="3" y="15" width="18" height="5" rx="1.5"/></svg>'
};

function render(html) {
  app.innerHTML = `<div class="pc-screen">${html}</div>`;
}

function renderWithNav(html, activeTab) {
  render(`
    <div class="pc-screen-content">${html}</div>
    <div class="pc-tabbar">
      <button class="pc-tab ${activeTab === 'home' ? 'active' : ''}" onclick="screenHome()">
        <span class="pc-tab-icon">${ICONS.home}</span><span>Inicio</span>
      </button>
      <button class="pc-tab ${activeTab === 'ranking' ? 'active' : ''}" onclick="screenRankings()">
        <span class="pc-tab-icon">${ICONS.trophy}</span><span>Ranking</span>
      </button>
      <button class="pc-tab ${activeTab === 'settings' ? 'active' : ''}" onclick="screenSettings()">
        <span class="pc-tab-icon">${ICONS.settings}</span><span>Ajustes</span>
      </button>
    </div>
  `);
}

function el(id) {
  return document.getElementById(id);
}

/* ---------------- Home ---------------- */
let _homeView = 'list';

function toggleHomeView() {
  _homeView = _homeView === 'list' ? 'grid' : 'list';
  screenHome();
}

function screenHome() {
  const active = Store.getActive();
  const games = Object.values(window.PuntacosGames);

  let banner = '';
  if (active) {
    banner = `
      <div class="pc-resume-row">
        <div class="pc-resume-info" onclick="resumeActive()">
          <span class="pc-resume-icon">▶️</span>
          <div>
            <div class="pc-resume-title">Partida en curso · ${gameName(active.gameId)}</div>
            <div class="pc-muted">${active.players.length} jugadores · toca para reanudar</div>
          </div>
        </div>
        <button class="pc-resume-close" onclick="discardActive()" title="Descartar">✕</button>
      </div>
    `;
  }

  const gameItems = games.map(g => {
    const playerRange = g.minPlayers && g.maxPlayers
      ? `${g.minPlayers}–${g.maxPlayers} jugadores`
      : (g.minPlayers ? `${g.minPlayers}+ jugadores` : '');

    if (_homeView === 'grid') {
      return `
      <div class="pc-game-card pc-game-card-grid" onclick="startGameFlow('${g.id}')" style="--game-gradient: ${g.gradient || 'linear-gradient(135deg, #6c63ff, #8b7fff)'}">
        <div class="pc-game-top pc-game-top-grid">
          <div class="pc-game-name pc-game-name-grid">${g.name}</div>
        </div>
        <div class="pc-game-bottom pc-game-bottom-grid">
          <span class="pc-game-meta">👥 ${g.minPlayers || 2}–${g.maxPlayers || 6}</span>
        </div>
      </div>
    `;
    }

    return `
    <div class="pc-game-card" onclick="startGameFlow('${g.id}')" style="--game-gradient: ${g.gradient || 'linear-gradient(135deg, #6c63ff, #8b7fff)'}">
      <div class="pc-game-top">
        <div class="pc-game-name">${g.name}</div>
        <div class="pc-game-desc">${g.desc || ''}</div>
      </div>
      <div class="pc-game-bottom">
        <span class="pc-game-meta">👥 ${playerRange}</span>
        <span class="pc-game-play">Jugar →</span>
      </div>
    </div>
  `;
  }).join('') || '<p class="pc-muted">Todavía no hay juegos instalados.</p>';

  renderWithNav(`
    <div class="pc-header">
      <div class="pc-logo"><span class="pc-logo-badge">P</span>Puntacos</div>
      <button class="pc-icon-btn" onclick="toggleHomeView()" title="Cambiar vista">${_homeView === 'list' ? ICONS.grid : ICONS.list}</button>
    </div>
    ${banner}
    <div class="pc-section-label">Elige un juego</div>
    <div class="${_homeView === 'grid' ? 'pc-game-grid' : ''}">
      ${gameItems}
    </div>
  `, 'home');
}

function gameName(id) {
  return (window.PuntacosGames[id] && window.PuntacosGames[id].name) || id;
}

/* ---------------- Players (roster) ---------------- */
const AVATAR_COLORS = ['#6c63ff', '#22c55e', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6', '#10b981'];

function avatarColor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

function escapeJs(str) {
  return String(str).replace(/'/g, "\\'");
}

// Única función de escape HTML de la app. Úsala en cualquier dato introducido
// por el usuario (nombre de jugador, etiqueta de partida...) antes de insertarlo
// en una plantilla HTML (innerHTML, atributos, etc.).
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function playerStats(name) {
  const history = Store.getHistory();
  let games = 0, wins = 0;
  history.forEach((h) => {
    const found = h.players.find((p) => p.name === name);
    if (found) {
      games++;
      if (h.players[0] && h.players[0].name === name) wins++;
    }
  });
  return { games, wins };
}

function fullPlayerStats(name) {
  const history = Store.getHistory();
  let games = 0, wins = 0, points = 0;
  const byGame = {};
  history.forEach((h) => {
    const found = h.players.find((p) => p.name === name);
    if (!found) return;
    games++;
    points += found.score;
    const isWin = h.players[0] && h.players[0].name === name;
    if (isWin) wins++;
    if (!byGame[h.gameId]) byGame[h.gameId] = { gameId: h.gameId, gameName: h.gameName, games: 0, wins: 0, points: 0 };
    byGame[h.gameId].games++;
    byGame[h.gameId].points += found.score;
    if (isWin) byGame[h.gameId].wins++;
  });
  return {
    games, wins, points,
    winPct: games ? Math.round((wins / games) * 100) : 0,
    byGame: Object.values(byGame)
  };
}

let _addingPlayer = false;
let _addPlayerError = '';
let _addPlayerDraft = '';

// Compara nombres de jugador ignorando mayúsculas/minúsculas y espacios exteriores.
function namesMatch(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function screenPlayers() {
  const players = Store.getPlayers();
  const rows = players.map((p, i) => {
    const stats = playerStats(p);
    return `
    <div class="pc-player-card">
      <div class="pc-player-avatar" style="background:${avatarColor(p)}" onclick="screenPlayerStats('${escapeHtml(escapeJs(p))}')">${escapeHtml(initials(p))}</div>
      <div class="pc-player-info" onclick="screenPlayerStats('${escapeHtml(escapeJs(p))}')">
        <div class="pc-player-name">${escapeHtml(p)}</div>
        <div class="pc-muted">${stats.games} partidas · ${stats.wins} victorias</div>
      </div>
      <div class="pc-player-wins">${stats.wins}🏆</div>
      <button class="pc-player-delete" onclick="removePlayer(${i})" title="Eliminar">🗑️</button>
    </div>
  `;
  }).join('') || '<p class="pc-muted">Añade jugadores para empezar.</p>';

  const addBlock = _addingPlayer
    ? `
      <div class="pc-player-card">
        <input class="pc-input" id="newPlayerName" placeholder="Nombre del jugador" style="margin:0 0 6px 0;" value="${escapeHtml(_addPlayerDraft)}" onkeydown="if(event.key==='Enter') addPlayer()">
        ${_addPlayerError ? `<div style="color:var(--danger); font-size:13px; margin-bottom:8px;">${escapeHtml(_addPlayerError)}</div>` : ''}
        <button class="pc-btn" onclick="addPlayer()">Guardar</button>
      </div>
    `
    : `
      <div class="pc-player-add" onclick="_addingPlayer=true; _addPlayerError=''; _addPlayerDraft=''; screenPlayers(); document.getElementById('newPlayerName').focus();">
        <span>+ Añadir jugador</span>
      </div>
    `;

  renderWithNav(`
    <div class="pc-header">
      <div>
        <div class="pc-title" style="margin-bottom:2px;">Jugadores</div>
        <div class="pc-muted">Gestiona perfiles y reutilízalos en partidas</div>
      </div>
    </div>
    ${rows}
    ${addBlock}
  `, 'players');
}

function addPlayer() {
  const input = el('newPlayerName');
  _addPlayerDraft = input.value;
  const name = _addPlayerDraft.trim();

  if (!name) {
    _addPlayerError = 'Escribe un nombre para el jugador.';
    screenPlayers();
    focusAddPlayerInput();
    return;
  }

  const players = Store.getPlayers();
  if (players.some((p) => namesMatch(p, name))) {
    _addPlayerError = `Ya existe un jugador llamado "${name}".`;
    screenPlayers();
    focusAddPlayerInput();
    return;
  }

  players.push(name);
  Store.setPlayers(players);
  _addingPlayer = false;
  _addPlayerError = '';
  _addPlayerDraft = '';
  screenPlayers();
}

function focusAddPlayerInput() {
  const input = document.getElementById('newPlayerName');
  if (!input) return;
  input.focus();
  const end = input.value.length;
  if (input.setSelectionRange) input.setSelectionRange(end, end);
}

function showConfirmDialog(title, message, confirmLabel, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'pc-confirm-overlay';
  overlay.innerHTML = `
    <div class="pc-confirm-box">
      <div class="pc-confirm-title">${title}</div>
      <div class="pc-confirm-message">${message}</div>
      <div class="pc-confirm-actions">
        <button class="pc-btn secondary" id="pc_confirm_cancel">Cancelar</button>
        <button class="pc-btn danger" id="pc_confirm_ok">${confirmLabel}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  function close() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#pc_confirm_cancel').addEventListener('click', close);
  overlay.querySelector('#pc_confirm_ok').addEventListener('click', () => {
    close();
    onConfirm();
  });
}

function removePlayer(index) {
  const players = Store.getPlayers();
  const name = players[index];
  showConfirmDialog(
    `¿Eliminar a "${escapeHtml(name)}"?`,
    'Este jugador dejará de aparecer en la lista de jugadores guardados. Sus partidas e historial no se eliminarán.',
    'Eliminar',
    () => {
      const p = Store.getPlayers();
      p.splice(index, 1);
      Store.setPlayers(p);
      screenPlayers();
    }
  );
}

function screenPlayerStats(name) {
  const stats = fullPlayerStats(name);
  const gameRows = stats.byGame.length
    ? stats.byGame.map((g) => {
        const pct = g.games ? Math.round((g.wins / g.games) * 100) : 0;
        const icon = (window.PuntacosGames[g.gameId] && window.PuntacosGames[g.gameId].icon) || '🎲';
        return `
          <div class="pc-game-stat-card">
            <div class="pc-game-stat-top">
              <div class="pc-game-stat-icon">${icon}</div>
              <div class="pc-game-stat-name">${g.gameName}</div>
              <div class="pc-game-stat-trophy">${g.wins}🏆 / ${g.games}</div>
            </div>
            <div class="pc-progress-track"><div class="pc-progress-fill" style="width:${pct}%"></div></div>
            <div class="pc-game-stat-bottom">
              <span>${pct}% victorias</span>
              <span>${g.points} pts totales</span>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="pc-muted">Aún no ha jugado ninguna partida.</p>';

  render(`
    <div class="pc-header">
      <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
        <button class="pc-icon-btn" onclick="screenPlayers()" title="Volver">←</button>
        <div class="pc-title" style="margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(name)}</div>
      </div>
    </div>

    <div class="pc-player-stats-hero">
      <div class="pc-player-avatar-lg" style="background:${avatarColor(name)}">${escapeHtml(initials(name))}</div>
      <div class="pc-player-stats-name">${escapeHtml(name)}</div>
    </div>

    <div class="pc-stat-grid">
      <div class="pc-stat-box"><div class="pc-stat-num accent">${stats.wins}</div><div class="pc-stat-label">Victorias</div></div>
      <div class="pc-stat-box"><div class="pc-stat-num">${stats.games}</div><div class="pc-stat-label">Partidas</div></div>
      <div class="pc-stat-box"><div class="pc-stat-num success">${stats.winPct}%</div><div class="pc-stat-label">% Victorias</div></div>
      <div class="pc-stat-box"><div class="pc-stat-num warn">${stats.points}</div><div class="pc-stat-label">Puntos totales</div></div>
    </div>

    <div class="pc-section-label" style="margin-top:18px;">Por juego</div>
    ${gameRows}
  `);
}

/* ---------------- Settings ---------------- */
function screenSettings() {
  const s = Store.getSettings();
  renderWithNav(`
    <div class="pc-title" style="margin-bottom:16px;">Ajustes</div>

    <div class="pc-section-label">General</div>
    <div class="pc-settings-card">
      <div class="pc-settings-link" onclick="screenPlayers()">
        <div class="pc-settings-icon" style="background:#ede9fe; color:#7c3aed;">👤</div>
        <div class="pc-settings-text">
          <div class="pc-settings-link-title">Jugadores</div>
          <div class="pc-muted">Gestiona el listado de jugadores</div>
        </div>
        <span class="pc-settings-chevron">›</span>
      </div>
      <div class="pc-settings-link disabled">
        <div class="pc-settings-icon" style="background:#fef3c7; color:#d97706;">📊</div>
        <div class="pc-settings-text">
          <div class="pc-settings-link-title">Estadísticas y trofeos</div>
          <div class="pc-muted">Próximamente</div>
        </div>
        <span class="pc-settings-chevron">›</span>
      </div>
    </div>

    <div class="pc-section-label" style="margin-top:20px;">Preferencias</div>
    <div class="pc-settings-card">
      <div class="pc-settings-link no-tap">
        <div class="pc-settings-icon" style="background:#e0e7ff; color:#4f46e5;">🌙</div>
        <div class="pc-settings-text">
          <div class="pc-settings-link-title">Modo oscuro</div>
          <div class="pc-muted">Cambia el tema de la aplicación</div>
        </div>
        <label class="pc-switch">
          <input type="checkbox" id="set_dark" ${s.darkMode ? 'checked' : ''} onchange="toggleSetting('darkMode', this.checked)">
          <span class="pc-switch-slider"></span>
        </label>
      </div>
      <div class="pc-settings-link no-tap">
        <div class="pc-settings-icon" style="background:#fef9c3; color:#ca8a04;">💡</div>
        <div class="pc-settings-text">
          <div class="pc-settings-link-title">Pantalla encendida</div>
          <div class="pc-muted">Evita que el móvil se apague en partida</div>
        </div>
        <label class="pc-switch">
          <input type="checkbox" id="set_wake" ${s.wakeLock ? 'checked' : ''} onchange="toggleSetting('wakeLock', this.checked)">
          <span class="pc-switch-slider"></span>
        </label>
      </div>
    </div>

    <div class="pc-section-label" style="margin-top:20px;">Datos</div>
    <div class="pc-settings-card">
      <div class="pc-settings-link" onclick="exportBackup()">
        <div class="pc-settings-icon" style="background:#dcfce7; color:#16a34a;">⬇️</div>
        <div class="pc-settings-text">
          <div class="pc-settings-link-title">Exportar copia de seguridad</div>
          <div class="pc-muted">Descarga tus jugadores y partidas en un archivo</div>
        </div>
      </div>
      <div class="pc-settings-link" onclick="triggerImport()">
        <div class="pc-settings-icon" style="background:#dbeafe; color:#2563eb;">⬆️</div>
        <div class="pc-settings-text">
          <div class="pc-settings-link-title">Importar copia de seguridad</div>
          <div class="pc-muted">Restaura desde un archivo exportado antes</div>
        </div>
      </div>
    </div>
  `, 'settings');
}

function toggleSetting(key, value) {
  const s = Store.getSettings();
  s[key] = value;
  Store.setSettings(s);
  if (key === 'darkMode') applyTheme();
  if (key === 'wakeLock') applyWakeLock();
}

function exportBackup() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    players: Store.getPlayers(),
    history: Store.getHistory(),
    settings: Store.getSettings()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `puntacos-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Limpia una lista de jugadores importada: ignora entradas que no sean texto,
// recorta espacios exteriores, descarta vacíos y evita duplicados sin distinguir
// mayúsculas/minúsculas (se queda con la primera aparición). Nunca lanza excepción,
// pase lo que pase en `rawList`.
function sanitizePlayerList(rawList) {
  const result = [];
  const seen = new Set();
  if (!Array.isArray(rawList)) return result;
  rawList.forEach((entry) => {
    if (typeof entry !== 'string') return;
    const name = entry.trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(name);
  });
  return result;
}

// Valida una entrada del historial: forma mínima y segura para la app (sin
// validar exhaustivamente cada campo). Comprueba justo lo que el resto del
// código necesita para no romperse (p.ej. h.players.forEach, h.players[0].name).
function isValidHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.gameId !== 'string' || !entry.gameId) return false;
  if (typeof entry.gameName !== 'string' || !entry.gameName) return false;
  if (typeof entry.date !== 'string' || isNaN(Date.parse(entry.date))) return false;
  if (!Array.isArray(entry.players) || entry.players.length === 0) return false;
  return entry.players.every((p) =>
    p && typeof p === 'object' &&
    typeof p.name === 'string' && p.name.trim() &&
    typeof p.score === 'number' && Number.isFinite(p.score)
  );
}

// El historial se valida como bloque: si una sola entrada tiene una forma
// inesperada, se considera inválido en conjunto y no se importa nada de él
// (se mantiene el historial actual), en vez de intentar salvar partes sueltas.
function isValidHistoryList(rawHistory) {
  return Array.isArray(rawHistory) && rawHistory.every(isValidHistoryEntry);
}

function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.players) || !Array.isArray(data.history)) {
          alert('El archivo no parece una copia de seguridad válida de Puntacos.');
          return;
        }
        const cleanPlayers = sanitizePlayerList(data.players);
        const historyValid = isValidHistoryList(data.history);
        const historyCountForMsg = historyValid ? data.history.length : Store.getHistory().length;
        const confirmMsg = `Esto reemplazará tus datos actuales (${Store.getPlayers().length} jugadores, ${Store.getHistory().length} partidas) por los del archivo (${cleanPlayers.length} jugadores, ${historyCountForMsg} partidas)${historyValid ? '' : ' · el historial del archivo no es válido, se mantendrá el actual'}. ¿Continuar?`;
        if (!confirm(confirmMsg)) return;
        Store.setPlayers(cleanPlayers);
        if (historyValid) {
          localStorage.setItem('pc_history', JSON.stringify(data.history));
        }
        if (data.settings) Store.setSettings(data.settings);
        applyTheme();
        applyWakeLock();
        alert(historyValid
          ? 'Copia de seguridad importada correctamente.'
          : 'Jugadores importados. El historial de partidas del archivo no es válido, así que no se ha importado: se mantiene tu historial actual.');
        screenSettings();
      } catch (e) {
        alert('No se pudo leer el archivo. ¿Seguro que es un backup de Puntacos?');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

/* ---------------- Start game flow ---------------- */
let _pendingGameId = null;

function startGameFlow(gameId) {
  _pendingGameId = gameId;
  screenGameConfig();
}

function screenGameConfig() {
  const game = window.PuntacosGames[_pendingGameId];
  render(`
    <button class="pc-nav-back" onclick="screenHome()">← Volver</button>
    <div class="pc-card">
      <div class="pc-title">${game.name}</div>
      <div id="gameConfigMount"></div>
    </div>
  `);
  game.configScreen(el('gameConfigMount'), Store.getPlayers(), onGameConfigured);
}

function onGameConfigured(config, tag, players) {
  const active = {
    gameId: _pendingGameId,
    players: players,
    config: config,
    tag: tag || '',
    state: null,
    startedAt: new Date().toISOString()
  };
  Store.setActive(active);
  screenPlay(active);
}

/* ---------------- Resume / discard ---------------- */
function resumeActive() {
  const active = Store.getActive();
  if (active) screenPlay(active);
}

function discardActive() {
  if (confirm('¿Descartar la partida en curso? No se podrá recuperar.')) {
    Store.setActive(null);
    screenHome();
  }
}

/* ---------------- Play screen ---------------- */
function screenPlay(active) {
  const game = window.PuntacosGames[active.gameId];
  render(`
    <div class="pc-play-topbar">
      <button class="pc-icon-btn" onclick="pauseAndGoHome()" title="Volver">←</button>
    </div>
    <div id="gamePlayMount"></div>
  `);
  game.playScreen(
    el('gamePlayMount'),
    active.players,
    active.config,
    active.state,
    {
      onStateChange: (state) => {
        const cur = Store.getActive();
        cur.state = state;
        Store.setActive(cur);
      },
      onFinish: (results) => onGameFinished(active, results)
    }
  );
}

function pauseAndGoHome() {
  // El estado ya se autoguarda en cada onStateChange, así que solo navegamos.
  screenHome();
}

/* ---------------- Finish screen ---------------- */
let _lastFinished = null;

function onGameFinished(active, results) {
  // El estado más reciente de la partida vive en el almacén, no en `active`
  const latestActive = Store.getActive() || active;
  const historyEntry = {
    id: Date.now().toString(36),
    gameId: active.gameId,
    gameName: gameName(active.gameId),
    tag: active.tag || '',
    players: results,
    date: new Date().toISOString()
  };
  Store.addHistory(historyEntry);
  Store.setActive(null);
  _lastFinished = { active: latestActive, entryId: historyEntry.id };
  screenFinish(historyEntry);
}

function undoFinish() {
  if (!_lastFinished) return;
  haptic('undo');
  const restored = _lastFinished.active;
  const history = Store.getHistory().filter((h) => h.id !== _lastFinished.entryId);
  localStorage.setItem('pc_history', JSON.stringify(history));
  Store.setActive(restored);
  _lastFinished = null;
  screenPlay(restored);
}

function startRematch() {
  if (!_lastFinished) return;
  haptic('rematch');
  const prev = _lastFinished.active;
  // Objeto totalmente nuevo: copias profundas (sin referencias compartidas con la
  // partida terminada), estado a null (el juego arranca limpio) y nueva fecha de inicio.
  const fresh = {
    gameId: prev.gameId,
    players: JSON.parse(JSON.stringify(prev.players)),
    config: JSON.parse(JSON.stringify(prev.config)),
    tag: prev.tag || '',
    state: null,
    startedAt: new Date().toISOString()
  };
  _lastFinished = null;
  Store.setActive(fresh);
  screenPlay(fresh);
}

function screenFinish(entry) {
  const rows = entry.players.map((p, i) => `
    <div class="pc-ranking-row ${i === 0 ? 'first' : ''}">
      <span class="pc-ranking-pos">${i + 1}º</span>
      <span class="pc-ranking-name">${escapeHtml(p.name)}</span>
      <span class="pc-ranking-score">${p.score}</span>
    </div>
  `).join('');

  render(`
    <div class="pc-card">
      <div class="pc-title">🏁 ${entry.gameName}${entry.tag ? ' · ' + escapeHtml(entry.tag) : ''}</div>
      ${rows}
      <button class="pc-btn full-margin" onclick="shareResults('${entry.id}')">Compartir por WhatsApp</button>
      ${_lastFinished && _lastFinished.entryId === entry.id
        ? '<button class="pc-btn" onclick="startRematch()">🔁 Revancha</button>'
        : ''}
      ${_lastFinished && _lastFinished.entryId === entry.id
        ? '<button class="pc-btn secondary" onclick="undoFinish()">↩️ Deshacer y reanudar partida</button>'
        : ''}
      <button class="pc-btn secondary" onclick="screenHome()">Volver al inicio</button>
    </div>
  `);
}

function shareResults(entryId) {
  const entry = Store.getHistory().find(h => h.id === entryId);
  if (!entry) return;
  const lines = entry.players.map((p, i) => `${i + 1}º ${p.name}: ${p.score}`).join('\n');
  const text = `Puntacos - ${entry.gameName}${entry.tag ? ' (' + entry.tag + ')' : ''}\n\n${lines}`;

  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    const url = 'https://wa.me/?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
  }
}

/* ---------------- Rankings / history ---------------- */
function computeGameStats(gameFilter) {
  const history = Store.getHistory().filter((h) => !gameFilter || h.gameId === gameFilter);
  const map = {};
  history.forEach((h) => {
    h.players.forEach((p, idx) => {
      if (!map[p.name]) map[p.name] = { name: p.name, games: 0, wins: 0, points: 0, lastDate: null };
      const m = map[p.name];
      m.games++;
      m.points += p.score;
      if (idx === 0) m.wins++;
      if (!m.lastDate || h.date > m.lastDate) m.lastDate = h.date;
    });
  });
  return Object.values(map).map((m) => ({
    name: m.name,
    games: m.games,
    wins: m.wins,
    winPct: m.games ? Math.round((m.wins / m.games) * 100) : 0,
    avgPoints: m.games ? Math.round(m.points / m.games) : 0,
    lastDate: m.lastDate
  })).sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
}

const MIN_GAMES_FOR_RANKING = 3;

function screenRankings(gameFilter) {
  gameFilter = gameFilter || null;
  const games = Object.values(window.PuntacosGames);
  const allStats = computeGameStats(gameFilter);
  const stats = allStats.filter((p) => p.games >= MIN_GAMES_FOR_RANKING);
  const unranked = allStats.filter((p) => p.games < MIN_GAMES_FOR_RANKING);

  const chips = `
    <button type="button" class="pc-rank-chip ${!gameFilter ? 'active' : ''}" onclick="screenRankings(null)">🌍 Todo</button>
    ${games.map((g) => `<button type="button" class="pc-rank-chip ${gameFilter === g.id ? 'active' : ''}" onclick="screenRankings('${g.id}')">${g.icon || '🎲'} ${g.name}</button>`).join('')}
  `;

  let podium = '';
  if (stats.length > 0) {
    const top3 = stats.slice(0, 3);
    const order = [top3[1], top3[0], top3[2]];
    const classes = ['silver', 'gold', 'bronze'];
    const medals = ['🥈', '🥇', '🥉'];
    podium = `
      <div class="pc-podium">
        ${order.map((p, i) => p ? `
          <div class="pc-podium-col pc-podium-${classes[i]}">
            <div class="pc-player-avatar" style="background:${avatarColor(p.name)}; width:${i === 1 ? 64 : 52}px; height:${i === 1 ? 64 : 52}px; font-size:${i === 1 ? 20 : 16}px; margin:0 auto 6px auto;">${escapeHtml(initials(p.name))}</div>
            <div class="pc-podium-name">${escapeHtml(p.name)}</div>
            <div class="pc-podium-sub">${p.wins}🏆 · ${p.winPct}%</div>
            <div class="pc-podium-plaque"><span>${medals[i]}</span></div>
          </div>
        ` : '<div class="pc-podium-col"></div>').join('')}
      </div>
    `;
  }

  function rankRow(p, crown) {
    return `
      <div class="pc-rank-row">
        <div class="pc-player-avatar" style="background:${avatarColor(p.name)}; width:44px; height:44px; font-size:15px;">${escapeHtml(initials(p.name))}</div>
        <div class="pc-rank-info">
          <div class="pc-rank-name">${crown ? '👑 ' : ''}${escapeHtml(p.name)}</div>
          <div class="pc-muted">${p.games} partidas · media ${p.avgPoints} pts · ${p.lastDate ? new Date(p.lastDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''}</div>
          <div class="pc-progress-track" style="margin-top:6px;"><div class="pc-progress-fill" style="width:${p.winPct}%; background:${avatarColor(p.name)}"></div></div>
        </div>
        <div class="pc-rank-pct">
          <div class="pc-stat-num accent" style="font-size:20px;">${p.winPct}%</div>
          <div class="pc-muted">${p.wins}V / ${p.games}J</div>
        </div>
      </div>
    `;
  }

  const list = stats.length
    ? stats.map((p) => rankRow(p, stats[0].name === p.name)).join('')
    : '<p class="pc-muted">Aún no hay jugadores con suficientes partidas.</p>';

  const unrankedSection = unranked.length ? `
    <div class="pc-section-label" style="margin-top:20px;">Aún sin clasificar (menos de ${MIN_GAMES_FOR_RANKING} partidas)</div>
    ${unranked.map((p) => rankRow(p, false)).join('')}
  ` : '';

  renderWithNav(`
    <div class="pc-title" style="margin-bottom:14px;">Ranking</div>
    <div class="pc-rank-chips">${chips}</div>
    ${podium}
    <div class="pc-section-label" style="margin-top:18px;">Ranking · % efectividad</div>
    ${list}
    ${unrankedSection}
  `, 'ranking');
}

/* ---------------- Init ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  const splash = document.createElement('div');
  splash.id = 'pc-splash';
  splash.innerHTML = '<div class="pc-splash-badge">P</div>';
  document.body.appendChild(splash);

  applyTheme();
  applyWakeLock();
  screenHome();

  setTimeout(() => {
    splash.classList.add('pc-splash-hide');
    setTimeout(() => splash.remove(), 300);
  }, 550);

  // Oculta la barra inferior mientras el teclado está abierto (evita que "flote" sobre él)
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('input, textarea')) {
      const bar = document.querySelector('.pc-tabbar');
      if (bar) bar.classList.add('pc-tabbar-hidden');
    }
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.matches('input, textarea')) {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || !active.matches('input, textarea')) {
          const bar = document.querySelector('.pc-tabbar');
          if (bar) bar.classList.remove('pc-tabbar-hidden');
        }
      }, 60);
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
