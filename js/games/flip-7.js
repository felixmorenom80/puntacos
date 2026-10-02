/* ===================== Juego: Flip 7 ===================== */
/*
 * Implementación del contrato de juego de Puntacos.
 *
 * El anotador registra las cartas que cada jugador tiene al cerrar la ronda:
 * - números 0..12 (se permite registrar duplicados para poder marcar bust)
 * - x2
 * - modificadores +2/+4/+6/+8/+10
 * - estado: activo, plantado, congelado o eliminado
 *
 * Puntuación oficial: suma de números -> x2 -> modificadores -> +15 por Flip 7.
 * El x2 solo multiplica la suma de números.
 */
window.PuntacosGames = window.PuntacosGames || {};

(function () {
  const GAME_ID = 'flip-7';
  const TARGET = 200;
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 8;
  const NUMBERS = Array.from({ length: 13 }, (_, i) => i);
  const MODIFIERS = [2, 4, 6, 8, 10];
  const STATUSES = {
    active: 'Activo',
    planted: 'Plantado',
    frozen: 'Congelado',
    eliminated: 'Eliminado'
  };
  const DOT_COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];

  function esc(v) {
    return window.escapeHtml ? window.escapeHtml(v) : String(v);
  }

  function defaultPlayerRound(status = 'active') {
    const numbers = {};
    NUMBERS.forEach((n) => { numbers[n] = 0; });
    const modifiers = {};
    MODIFIERS.forEach((n) => { modifiers[n] = 0; });
    return {
      numbers,
      x2: false,
      modifiers,
      status: Object.prototype.hasOwnProperty.call(STATUSES, status) ? status : 'active',
      flip7: false
    };
  }

  function cloneRoundData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function normalizePlayerRound(raw) {
    const base = defaultPlayerRound();
    const src = raw && typeof raw === 'object' ? raw : {};
    NUMBERS.forEach((n) => {
      base.numbers[n] = Math.max(0, Number(src.numbers && src.numbers[n]) || 0);
    });
    MODIFIERS.forEach((n) => {
      base.modifiers[n] = Math.max(0, Number(src.modifiers && src.modifiers[n]) || 0);
    });
    base.x2 = Boolean(src.x2);
    base.status = Object.prototype.hasOwnProperty.call(STATUSES, src.status) ? src.status : 'active';
    base.flip7 = Boolean(src.flip7);
    return base;
  }

  function numericCount(draft) {
    return NUMBERS.reduce((sum, n) => sum + draft.numbers[n], 0);
  }

  function distinctNumericCount(draft) {
    return NUMBERS.reduce((sum, n) => sum + (draft.numbers[n] > 0 ? 1 : 0), 0);
  }

  function hasDuplicate(draft) {
    return NUMBERS.some((n) => draft.numbers[n] > 1);
  }

  function modifierTotal(draft) {
    return MODIFIERS.reduce((sum, n) => sum + (n * draft.modifiers[n]), 0);
  }

  function roundScore(draft) {
    if (draft.status === 'eliminated' || hasDuplicate(draft)) return 0;
    const numberSum = NUMBERS.reduce((sum, n) => sum + (n * draft.numbers[n]), 0);
    const multiplied = numberSum * (draft.x2 ? 2 : 1);
    return multiplied + modifierTotal(draft) + (draft.flip7 ? 15 : 0);
  }

  function isFlip7Available(draft) {
    return distinctNumericCount(draft) >= 7 && !hasDuplicate(draft);
  }

  function statusLabel(status) {
    return STATUSES[status] || STATUSES.active;
  }

  function configScreen(container, roster, onStart) {
    let count = Math.min(Math.max(roster.length || MIN_PLAYERS, MIN_PLAYERS), MAX_PLAYERS);
    const currentNames = [];
    for (let i = 0; i < MAX_PLAYERS; i++) currentNames[i] = roster[i] || '';

    function renderSlots() {
      return Array.from({ length: count }, (_, i) => {
        const color = DOT_COLORS[i % DOT_COLORS.length];
        const name = currentNames[i] || `Jugador ${i + 1}`;
        return `
          <div class="f7-player-slot" data-i="${i}">
            <span class="f7-dot" style="background:${color}"></span>
            <span class="f7-player-name ${currentNames[i] ? '' : 'placeholder'}">${esc(name)}</span>
            <span class="f7-chevron">›</span>
          </div>`;
      }).join('');
    }

    function savePlayerToRoster(name) {
      if (!window.Store) return;
      const players = window.Store.getPlayers().slice();
      if (!players.some((p) => p.trim().toLowerCase() === name.trim().toLowerCase())) {
        players.push(name.trim());
        window.Store.setPlayers(players);
      }
    }

    function openPlayerSheet(index) {
      const overlay = document.createElement('div');
      overlay.className = 'f7-overlay';
      overlay.innerHTML = `
        <div class="f7-sheet">
          <div class="f7-handle"></div>
          <div class="f7-sheet-title">Elegir jugador</div>
          <div class="f7-sheet-list">
            ${roster.map((name, ri) => `
              <button type="button" class="f7-roster-row" data-name="${esc(name)}">
                <span class="f7-dot" style="background:${DOT_COLORS[ri % DOT_COLORS.length]}"></span>
                <span>${esc(name)}</span>
                ${name === currentNames[index] ? '<strong>✓</strong>' : ''}
              </button>
            `).join('') || '<p class="pc-muted">Aún no tienes jugadores guardados.</p>'}
          </div>
          <div class="f7-new-player">
            <input class="pc-input" id="f7_new_player" placeholder="O escribe un nombre nuevo">
            <button class="pc-btn" id="f7_add_player">Añadir</button>
          </div>
          <div class="f7-error" id="f7_player_error"></div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      const close = () => {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 180);
      };
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelectorAll('.f7-roster-row').forEach((row) => {
        row.addEventListener('click', () => {
          currentNames[index] = row.dataset.name;
          container.querySelector('#f7_slots').innerHTML = renderSlots();
          close();
        });
      });
      overlay.querySelector('#f7_add_player').addEventListener('click', () => {
        const input = overlay.querySelector('#f7_new_player');
        const error = overlay.querySelector('#f7_player_error');
        const value = input.value.trim();
        if (!value) {
          error.textContent = 'Escribe un nombre para el jugador.';
          return;
        }
        if (roster.some((p) => p.trim().toLowerCase() === value.toLowerCase())) {
          error.textContent = `Ya existe un jugador llamado "${value}".`;
          return;
        }
        roster.push(value);
        savePlayerToRoster(value);
        currentNames[index] = value;
        container.querySelector('#f7_slots').innerHTML = renderSlots();
        close();
      });
    }

    container.innerHTML = `
      <div class="f7-section-label">Número de jugadores</div>
      <div class="f7-count-row">
        ${Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS)
          .map((n) => `<button type="button" class="f7-count ${n === count ? 'active' : ''}" data-count="${n}">${n}</button>`).join('')}
      </div>

      <div class="f7-section-label" style="margin-top:16px;">Jugadores</div>
      <div id="f7_slots">${renderSlots()}</div>

      <div class="f7-config-row">
        <label class="f7-label" for="f7_tag">Nombre de la partida (opcional)</label>
        <input class="pc-input" id="f7_tag" placeholder="Ej. Flip 7 del viernes">
      </div>

      <button class="pc-btn full-margin" id="f7_start">Iniciar partida →</button>
    `;

    container.querySelectorAll('.f7-count').forEach((button) => {
      button.addEventListener('click', () => {
        count = Number(button.dataset.count);
        container.querySelectorAll('.f7-count').forEach((b) => b.classList.toggle('active', b === button));
        container.querySelector('#f7_slots').innerHTML = renderSlots();
      });
    });

    container.querySelector('#f7_slots').addEventListener('click', (e) => {
      const slot = e.target.closest('.f7-player-slot');
      if (slot) openPlayerSheet(Number(slot.dataset.i));
    });

    container.querySelector('#f7_start').addEventListener('click', () => {
      const players = [];
      for (let i = 0; i < count; i++) {
        players.push((currentNames[i] || '').trim() || `Jugador ${i + 1}`);
      }
      const duplicate = players.some((name, i) => players.findIndex((other) => other.toLowerCase() === name.toLowerCase()) !== i);
      if (duplicate) {
        alert('No puede haber dos jugadores con el mismo nombre.');
        return;
      }
      players.forEach(savePlayerToRoster);
      const config = { target: TARGET };
      const tag = container.querySelector('#f7_tag').value.trim();
      onStart(config, tag, players);
    });
  }

  function playScreen(container, players, config, savedState, callbacks) {
    let state = savedState || {
      round: 1,
      total: Object.fromEntries(players.map((p) => [p, 0])),
      roundData: Object.fromEntries(players.map((p) => [p, defaultPlayerRound()])),
      rounds: [],
      statusByPlayer: Object.fromEntries(players.map((p) => [p, 'active']))
    };

    state.round = Math.max(1, Number(state.round) || 1);
    state.total = state.total && typeof state.total === 'object' ? state.total : {};
    state.roundData = state.roundData && typeof state.roundData === 'object' ? state.roundData : {};
    state.rounds = Array.isArray(state.rounds) ? state.rounds : [];
    state.statusByPlayer = state.statusByPlayer && typeof state.statusByPlayer === 'object' ? state.statusByPlayer : {};
    players.forEach((name) => {
      state.total[name] = Number(state.total[name]) || 0;
      state.roundData[name] = normalizePlayerRound(state.roundData[name]);
      // El estado persistente del jugador es la fuente de verdad entre rondas.
      // Si existe en roundData pero falta en partidas antiguas, lo recuperamos.
      const persisted = state.statusByPlayer[name];
      state.statusByPlayer[name] = Object.prototype.hasOwnProperty.call(STATUSES, persisted)
        ? persisted
        : (Object.prototype.hasOwnProperty.call(STATUSES, state.roundData[name].status)
          ? state.roundData[name].status
          : 'active');
      state.roundData[name].status = state.statusByPlayer[name];
    });

    function save() { callbacks.onStateChange(state); }

    function resetRoundData() {
      players.forEach((name) => {
        const status = state.statusByPlayer[name] || 'active';
        state.roundData[name] = defaultPlayerRound(status);
      });
    }

    function playerRoundScore(name) {
      return roundScore(state.roundData[name]);
    }

    function sortedTotals() {
      return players.slice().sort((a, b) => {
        const diff = state.total[b] - state.total[a];
        return diff || players.indexOf(a) - players.indexOf(b);
      });
    }

    function finishResults() {
      return sortedTotals().map((name) => ({ name, score: state.total[name] }));
    }

    function winnerAfterRound() {
      const max = Math.max(...players.map((p) => state.total[p]));
      if (max < config.target) return null;
      const leaders = players.filter((p) => state.total[p] === max);
      // Regla de esta implementación: un empate con 200 o más puntos
      // obliga a jugar rondas adicionales hasta que haya un único ganador.
      if (leaders.length > 1) return null;
      return leaders[0];
    }

    function closeRound() {
      const flip7Player = players.find((name) => state.roundData[name].flip7);
      const roundSnapshot = {};
      players.forEach((name) => {
        const data = normalizePlayerRound(state.roundData[name]);
        const score = roundScore(data);
        roundSnapshot[name] = {
          score,
          status: data.status,
          flip7: data.flip7,
          numbers: cloneRoundData(data.numbers),
          x2: data.x2,
          modifiers: cloneRoundData(data.modifiers)
        };
        state.total[name] += score;
      });
      state.rounds.push({ round: state.round, players: roundSnapshot });
      players.forEach((name) => {
        // Persistimos el estado elegido en el cierre de ronda antes de decidir
        // si la partida termina o pasa a la siguiente ronda.
        state.statusByPlayer[name] = roundSnapshot[name].status;
        state.roundData[name].status = roundSnapshot[name].status;
      });

      const winner = winnerAfterRound();
      if (winner) {
        save();
        callbacks.onFinish(finishResults());
        return;
      }

      state.round += 1;
      resetRoundData();
      save();
      render();
      if (flip7Player) {
        setTimeout(() => alert(`${flip7Player} consiguió Flip 7. Se ha anotado el bonus de +15.`), 0);
      }
    }

    function render() {
      const leader = sortedTotals()[0];
      const max = state.total[leader];
      const rows = sortedTotals().map((name, index) => {
        const data = state.roundData[name];
        const displayStatus = state.statusByPlayer[name] || data.status;
        const roundPts = playerRoundScore(name);
        const distinct = distinctNumericCount(data);
        const bust = hasDuplicate(data);
        const status = statusLabel(displayStatus);
        const remaining = Math.max(0, config.target - state.total[name]);
        return `
          <div class="f7-score-card ${displayStatus === 'eliminated' ? 'eliminated' : ''}">
            <div class="f7-score-top">
              <span class="f7-position">${index + 1}º</span>
              <div class="f7-score-name-wrap">
                <strong>${esc(name)}</strong>
                <span class="f7-status ${displayStatus}">${status}</span>
              </div>
              <div class="f7-total">${state.total[name]}<small> pts</small></div>
            </div>
            <div class="f7-score-meta">
              <span>${remaining ? `${remaining} pts para ${config.target}` : 'Meta alcanzada'}</span>
              <span>Ronda: ${roundPts} pts</span>
            </div>
            <div class="f7-score-progress"><span style="width:${Math.min(100, (state.total[name] / config.target) * 100)}%"></span></div>
            <div class="f7-round-summary">
              <span>${distinct} números distintos</span>
              ${bust ? '<span class="f7-bust">BUST · 0 pts</span>' : ''}
              ${data.flip7 ? '<span class="f7-flip7-mini">FLIP 7 · +15</span>' : ''}
            </div>
          </div>`;
      }).join('');

      container.innerHTML = `
        <div class="f7-game-header">
          <div>
            <div class="pc-title" style="margin-bottom:2px;">Flip 7</div>
            <div class="pc-muted">Ronda ${state.round}</div>
          </div>
          <div class="f7-leader-chip">👑 ${esc(leader)} · ${max}</div>
        </div>
        <div class="f7-rule-banner">Suma números → ×2 → modificadores → +15 si consigues Flip 7.</div>
        ${rows}
        <div class="f7-actions">
          <button class="pc-btn full-margin" id="f7_close_round">Cerrar ronda</button>
          <button class="pc-btn secondary" id="f7_finish">Terminar partida</button>
        </div>
      `;

      container.querySelector('#f7_close_round').addEventListener('click', openRoundSheet);
      container.querySelector('#f7_finish').addEventListener('click', () => {
        if (!confirm('¿Terminar la partida? El resultado actual se guardará en el historial.')) return;
        callbacks.onFinish(finishResults());
      });
    }

    function openRoundSheet() {
      const overlay = document.createElement('div');
      overlay.className = 'f7-overlay';
      overlay.innerHTML = `
        <div class="f7-round-sheet">
          <div class="f7-sheet-head">
            <div>
              <div class="f7-sheet-title">Cerrar ronda ${state.round}</div>
              <div class="pc-muted">Introduce las cartas de cada jugador. La puntuación se calcula automáticamente.</div>
            </div>
            <button type="button" class="f7-close" aria-label="Cerrar">✕</button>
          </div>
          <div class="f7-round-scroll" id="f7_round_scroll"></div>
          <div class="f7-sheet-footer">
            <button class="pc-btn secondary" id="f7_cancel_round">Cancelar</button>
            <button class="pc-btn" id="f7_confirm_round">Confirmar ronda</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      const scroll = overlay.querySelector('#f7_round_scroll');
      const draft = Object.fromEntries(players.map((name) => [name, normalizePlayerRound(state.roundData[name])]));

      function playerCard(name, index) {
        const data = draft[name];
        const numberButtons = NUMBERS.map((n) => `
          <div class="f7-number-cell ${data.numbers[n] ? 'selected' : ''} ${data.numbers[n] > 1 ? 'duplicate' : ''}">
            <button type="button" class="f7-number" data-player="${esc(name)}" data-number="${n}">${n}</button>
            <span class="f7-number-count">${data.numbers[n] || ''}</span>
          </div>`).join('');
        const modButtons = MODIFIERS.map((n) => `
          <button type="button" class="f7-mod ${data.modifiers[n] ? 'selected' : ''}" data-player="${esc(name)}" data-mod="${n}">+${n}</button>
        `).join('');
        const numberSum = NUMBERS.reduce((sum, n) => sum + n * data.numbers[n], 0);
        const multiplied = numberSum * (data.x2 ? 2 : 1);
        const mods = modifierTotal(data);
        const score = roundScore(data);
        const duplicate = hasDuplicate(data);
        const flipReady = isFlip7Available(data);
        return `
          <section class="f7-round-player ${data.status === 'eliminated' ? 'is-eliminated' : ''}" data-player-section="${esc(name)}">
            <div class="f7-round-player-head">
              <span class="f7-dot" style="background:${DOT_COLORS[index % DOT_COLORS.length]}"></span>
              <strong>${esc(name)}</strong>
              <span class="f7-live-score">${score} pts</span>
            </div>
            <div class="f7-status-row">
              ${Object.entries(STATUSES).map(([key, label]) => `<button type="button" class="f7-status-btn ${data.status === key ? 'active ' + key : ''}" data-player="${esc(name)}" data-status="${key}">${label}</button>`).join('')}
            </div>
            <div class="f7-card-label">Cartas numéricas <span>${distinctNumericCount(data)}/7 distintas</span></div>
            <div class="f7-number-grid">${numberButtons}</div>
            ${duplicate ? '<div class="f7-warning">Número repetido: este jugador queda eliminado de la ronda y puntúa 0.</div>' : ''}
            <div class="f7-card-label">Bonus</div>
            <div class="f7-bonus-grid">
              <button type="button" class="f7-bonus f7-x2 ${data.x2 ? 'active' : ''}" data-player="${esc(name)}">×2</button>
              ${modButtons.replaceAll('class="f7-mod"', 'class="f7-bonus f7-mod"')}
            </div>
            ${data.flip7 ? '<div class="f7-flip7-banner">🎉 Flip 7 marcado · +15 puntos</div>' : `
              <button type="button" class="f7-flip7" data-player="${esc(name)}" ${flipReady ? '' : 'disabled'}>👑 Marcar Flip 7 (+15 bonus)</button>
              <div class="f7-flip7-help">${flipReady ? '7 números distintos: puedes marcar Flip 7.' : 'Necesitas 7 números distintos para activar Flip 7.'}</div>
            `}
            <div class="f7-breakdown">
              <span>Números: ${numberSum}</span>
              <span>×2: ${multiplied}</span>
              <span>Mods: +${mods}</span>
              <strong>Total ronda: ${score}</strong>
            </div>
          </section>`;
      }

      function renderDraft() {
        scroll.innerHTML = players.map((name, i) => playerCard(name, i)).join('');
      }

      function setStatus(name, status) {
        draft[name].status = status;
        if (status === 'eliminated') draft[name].flip7 = false;
      }

      scroll.addEventListener('click', (event) => {
        const numberButton = event.target.closest('.f7-number');
        const statusButton = event.target.closest('.f7-status-btn');
        const x2Button = event.target.closest('.f7-x2');
        const modButton = event.target.closest('.f7-mod');
        const flipButton = event.target.closest('.f7-flip7');

        if (numberButton) {
          const name = numberButton.dataset.player;
          const n = Number(numberButton.dataset.number);
          const data = draft[name];
          data.numbers[n] = data.numbers[n] === 0 ? 1 : (data.numbers[n] === 1 ? 2 : 0);
          if (data.numbers[n] > 1) data.status = 'eliminated';
          if (data.numbers[n] === 0 && data.flip7) data.flip7 = false;
          renderDraft();
          return;
        }
        if (statusButton) {
          setStatus(statusButton.dataset.player, statusButton.dataset.status);
          renderDraft();
          return;
        }
        if (x2Button) {
          const data = draft[x2Button.dataset.player];
          data.x2 = !data.x2;
          renderDraft();
          return;
        }
        if (modButton) {
          const data = draft[modButton.dataset.player];
          const n = Number(modButton.dataset.mod);
          data.modifiers[n] = data.modifiers[n] ? 0 : 1;
          renderDraft();
          return;
        }
        if (flipButton) {
          const name = flipButton.dataset.player;
          if (!isFlip7Available(draft[name])) return;
          draft[name].flip7 = true;
          renderDraft();
        }
      });

      function close() {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 180);
      }
      overlay.querySelector('.f7-close').addEventListener('click', close);
      overlay.querySelector('#f7_cancel_round').addEventListener('click', close);
      overlay.querySelector('#f7_confirm_round').addEventListener('click', () => {
        const flip7Count = players.filter((name) => draft[name].flip7).length;
        if (flip7Count > 1) {
          alert('Solo un jugador puede marcar Flip 7 en una ronda.');
          return;
        }
        players.forEach((name) => { state.roundData[name] = normalizePlayerRound(draft[name]); });
        close();
        closeRound();
      });

      renderDraft();
    }

    save();
    render();
  }

  window.PuntacosGames[GAME_ID] = {
    id: GAME_ID,
    name: 'Flip 7',
    icon: '7️⃣',
    desc: 'Números, riesgo y bonus Flip 7',
    gradient: 'linear-gradient(135deg, #f97316, #ef4444)',
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    configScreen,
    playScreen
  };
})();
