/* ===================== Juego: Anotador Universal ===================== */
/* Implementación de referencia del contrato de juego documentado en la
   cabecera de shell.js (window.PuntacosGames[id] = {...}). Este archivo
   define su propio `config` (rondas, meta, condición de victoria...) y su
   propio `state` (roundScore, total, round, history, undoStack) — el Shell
   no conoce ni depende de ninguno de esos dos formatos. */
window.PuntacosGames = window.PuntacosGames || {};

(function () {
  const GAME_ID = 'anotador-universal';

  function cssId(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  const DOT_COLORS = ['#6c63ff', '#f59e0b', '#22c55e', '#ec4899', '#06b6d4', '#ef4444'];

  /* ---------------- Config screen ---------------- */
  function configScreen(container, roster, onStart) {
    let count = Math.min(Math.max(roster.length, 2), 6);
    let winCondition = 'highest';
    let roundsVal = 10;
    const currentNames = [];
    for (let i = 0; i < 6; i++) currentNames[i] = roster[i] || '';

    function renderSlot(i) {
      const color = DOT_COLORS[i % DOT_COLORS.length];
      const displayName = currentNames[i] || `Jugador ${i + 1}`;
      return `
        <div class="au-player-slot au-player-slot-tap" data-i="${i}">
          <span class="au-dot" style="background:${color}; width:14px; height:14px;"></span>
          <span class="au-player-name-display ${!currentNames[i] ? 'placeholder' : ''}">${window.escapeHtml(displayName)}</span>
          <span class="au-slot-chevron">›</span>
        </div>
      `;
    }

    function playerSlotsHtml() {
      let html = '';
      for (let i = 0; i < count; i++) html += renderSlot(i);
      return html;
    }

    function regenerateSlots() {
      container.querySelector('#au_player_slots').innerHTML = playerSlotsHtml();
    }

    function openPlayerSheet(i) {
      const overlay = document.createElement('div');
      overlay.className = 'au-sheet-overlay';
      overlay.innerHTML = `
        <div class="au-sheet">
          <div class="au-sheet-handle"></div>
          <div class="au-sheet-title">Elegir jugador</div>
          <div class="au-sheet-list">
            ${roster.map((name, ri) => `
              <div class="au-sheet-row" data-name="${window.escapeHtml(name)}">
                <span class="au-dot" style="background:${DOT_COLORS[ri % DOT_COLORS.length]}"></span>
                <span class="au-sheet-row-name">${window.escapeHtml(name)}</span>
                ${name === currentNames[i] ? '<span class="au-sheet-check">✓</span>' : ''}
              </div>
            `).join('') || '<p class="pc-muted">Aún no tienes jugadores guardados.</p>'}
          </div>
          <div class="au-sheet-new">
            <input class="pc-input" id="au_sheet_new_input" placeholder="O escribe un nombre nuevo" style="margin:0;">
            <button class="pc-btn" id="au_sheet_new_btn">Añadir y elegir</button>
          </div>
          <div id="au_sheet_error" class="pc-muted" style="color:var(--danger); margin-top:6px;"></div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      function close() {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 200);
      }

      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelectorAll('.au-sheet-row').forEach((row) => {
        row.addEventListener('click', () => {
          currentNames[i] = row.dataset.name;
          regenerateSlots();
          close();
        });
      });
      const newInput = overlay.querySelector('#au_sheet_new_input');
      const errorBox = overlay.querySelector('#au_sheet_error');
      newInput.addEventListener('input', () => { errorBox.textContent = ''; });
      overlay.querySelector('#au_sheet_new_btn').addEventListener('click', () => {
        const val = newInput.value.trim();
        if (!val) {
          errorBox.textContent = 'Escribe un nombre para el jugador.';
          return;
        }
        const isDuplicate = roster.some((n) => n.trim().toLowerCase() === val.toLowerCase());
        if (isDuplicate) {
          errorBox.textContent = `Ya existe un jugador llamado "${val}".`; // textContent: sin riesgo de HTML, no requiere escapeHtml
          return;
        }
        // Los jugadores creados dentro de una partida forman parte del registro global.
        if (window.Store) {
          const globalPlayers = window.Store.getPlayers();
          if (!globalPlayers.some((name) => name.trim().toLowerCase() === val.toLowerCase())) {
            globalPlayers.push(val);
            window.Store.setPlayers(globalPlayers);
          }
        }
        roster.push(val);
        currentNames[i] = val;
        regenerateSlots();
        close();
      });
    }

    container.innerHTML = `
      <div class="au-section-label">Número de jugadores</div>
      <div class="au-count-row" id="au_count_row">
        ${[2, 3, 4, 5, 6].map((n) => `<button type="button" class="au-count-pill ${n === count ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
      </div>

      <div class="au-section-label" style="margin-top:14px;">Jugadores guardados</div>
      <div id="au_player_slots">${playerSlotsHtml()}</div>

      <div class="au-config-row" style="margin-top:14px;">
        <label class="au-config-label">Etiqueta de la partida (opcional)</label>
        <input class="pc-input" id="au_tag" placeholder="Ej. Parchís del sábado">
      </div>

      <div class="au-config-row">
        <label class="au-config-label">¿Quién gana?</label>
        <div class="au-pill-row">
          <button type="button" class="au-pill active" id="au_win_high">🔼 Más puntos gana</button>
          <button type="button" class="au-pill" id="au_win_low">🔽 Menos puntos gana</button>
        </div>
      </div>

      <div class="au-section-label">Opciones</div>
      <div class="pc-card" style="padding:0;">
        <div class="au-option-row" id="au_target_row">
          <div class="au-option-text">
            <div class="au-option-title">Puntos para ganar</div>
            <div class="pc-muted">Termina al alcanzar la meta</div>
          </div>
          <input class="au-option-input" type="number" id="au_target" value="100" min="1">
          <label class="pc-switch">
            <input type="checkbox" id="au_target_on" checked>
            <span class="pc-switch-slider"></span>
          </label>
        </div>
        <div class="au-option-row" id="au_rounds_row">
          <div class="au-option-text">
            <div class="au-option-title">Número de rondas</div>
            <div class="pc-muted">Termina tras N rondas</div>
          </div>
          <div class="au-stepper">
            <button type="button" class="au-stepper-btn" id="au_step_minus">−</button>
            <span id="au_rounds_val">10</span>
            <button type="button" class="au-stepper-btn" id="au_step_plus">+</button>
          </div>
          <label class="pc-switch">
            <input type="checkbox" id="au_rounds_on" checked>
            <span class="pc-switch-slider"></span>
          </label>
        </div>
        <div class="au-option-row">
          <div class="au-option-text">
            <div class="au-option-title">Puntuación negativa</div>
            <div class="pc-muted">Permite puntos por debajo de cero</div>
          </div>
          <label class="pc-switch">
            <input type="checkbox" id="au_negative">
            <span class="pc-switch-slider"></span>
          </label>
        </div>
        <div class="au-option-row disabled">
          <div class="au-option-text">
            <div class="au-option-title">Temporizador</div>
            <div class="pc-muted">Próximamente</div>
          </div>
          <label class="pc-switch">
            <input type="checkbox" disabled>
            <span class="pc-switch-slider"></span>
          </label>
        </div>
      </div>

      <button class="pc-btn full-margin" id="au_start_btn">Iniciar partida →</button>
    `;

    container.querySelectorAll('.au-count-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        count = parseInt(btn.dataset.n, 10);
        container.querySelectorAll('.au-count-pill').forEach((b) => b.classList.toggle('active', b === btn));
        regenerateSlots();
      });
    });

    container.querySelector('#au_player_slots').addEventListener('click', (e) => {
      const tapSlot = e.target.closest('.au-player-slot-tap');
      if (tapSlot) openPlayerSheet(parseInt(tapSlot.dataset.i, 10));
    });

    container.querySelector('#au_win_high').addEventListener('click', () => {
      winCondition = 'highest';
      container.querySelector('#au_win_high').classList.add('active');
      container.querySelector('#au_win_low').classList.remove('active');
    });
    container.querySelector('#au_win_low').addEventListener('click', () => {
      winCondition = 'lowest';
      container.querySelector('#au_win_low').classList.add('active');
      container.querySelector('#au_win_high').classList.remove('active');
    });

    container.querySelector('#au_target_on').addEventListener('change', function () {
      container.querySelector('#au_target').disabled = !this.checked;
      container.querySelector('#au_target_row').classList.toggle('disabled-field', !this.checked);
    });
    container.querySelector('#au_rounds_on').addEventListener('change', function () {
      container.querySelector('#au_rounds_row').classList.toggle('disabled-field', !this.checked);
    });
    container.querySelector('#au_step_minus').addEventListener('click', () => {
      roundsVal = Math.max(1, roundsVal - 1);
      container.querySelector('#au_rounds_val').textContent = roundsVal;
    });
    container.querySelector('#au_step_plus').addEventListener('click', () => {
      roundsVal += 1;
      container.querySelector('#au_rounds_val').textContent = roundsVal;
    });

    container.querySelector('#au_start_btn').addEventListener('click', () => {
      const players = [];
      for (let i = 0; i < count; i++) {
        players.push((currentNames[i] || '').trim() || `Jugador ${i + 1}`);
      }

      // Los jugadores usados en la partida se conservan en el registro global sin sustituir a otros.
      if (window.Store) {
        const newRoster = window.Store.getPlayers().slice();
        players.forEach((name) => {
          if (!newRoster.some((existing) => existing.trim().toLowerCase() === name.toLowerCase())) {
            newRoster.push(name);
          }
        });
        window.Store.setPlayers(newRoster);
      }

      const tag = container.querySelector('#au_tag').value.trim();
      const targetOn = container.querySelector('#au_target_on').checked;
      const roundsOn = container.querySelector('#au_rounds_on').checked;
      const targetVal = parseInt(container.querySelector('#au_target').value, 10);
      const config = {
        target: targetOn && !isNaN(targetVal) ? targetVal : null,
        rounds: roundsOn ? roundsVal : null,
        winCondition: winCondition,
        allowNegative: container.querySelector('#au_negative').checked
      };
      onStart(config, tag, players);
    });
  }

  /* ---------------- Play screen ---------------- */
  function playScreen(container, players, config, savedState, callbacks) {
    let state = savedState || { roundScore: {}, total: {}, round: 1, history: [], undoStack: [] };
    // Migración desde el modelo antiguo (un único total sin rondas)
    if (state.scores && !state.roundScore) {
      state = {
        roundScore: {},
        total: Object.assign({}, state.scores),
        round: state.round || 1,
        history: state.history || [],
        undoStack: []
      };
    }
    // Migración: la antigua acción única de deshacer pasa a ser la pila
    if (!state.undoStack) {
      state.undoStack = (state.lastAction && state.lastAction.delta)
        ? [{ type: 'score', name: state.lastAction.name, delta: state.lastAction.delta }]
        : [];
    }
    delete state.lastAction;
    players.forEach((p) => {
      if (!(p in state.roundScore)) state.roundScore[p] = 0;
      if (!(p in state.total)) state.total[p] = 0;
    });

    let activeTab = 'ranking';
    let editingPlayer = null;

    function save() {
      callbacks.onStateChange(state);
    }

    function liveTotal(name) {
      return state.total[name] + state.roundScore[name];
    }

    function rankedPlayers() {
      const arr = players.slice();
      arr.sort((a, b) => config.winCondition === 'lowest'
        ? liveTotal(a) - liveTotal(b)
        : liveTotal(b) - liveTotal(a));
      return arr;
    }

    function medalFor(rank) {
      if (rank === 0) return '👑';
      if (rank === 1) return '🥈';
      if (rank === 2) return '🥉';
      return '';
    }

    function clampRound(name, val) {
      if (!config.allowNegative && state.total[name] + val < 0) return -state.total[name];
      return val;
    }

    function pushUndo(entry) {
      state.undoStack.push(entry);
      if (state.undoStack.length > 100) state.undoStack.shift();
    }

    function adjust(name, delta) {
      const before = state.roundScore[name];
      const after = clampRound(name, before + delta);
      if (after === before) return;
      pushUndo({ type: 'score', name, delta: after - before });
      state.roundScore[name] = after;
      save();
      if (window.haptic) window.haptic('tap');
      render();
    }

    function undo() {
      const entry = state.undoStack.pop();
      if (!entry) return;
      if (window.haptic) window.haptic('undo');
      if (entry.type === 'score') {
        state.roundScore[entry.name] -= entry.delta;
      } else if (entry.type === 'round') {
        const last = state.history.pop();
        if (last) {
          players.forEach((p) => {
            const pts = last.scores[p] || 0;
            state.total[p] -= pts;
            state.roundScore[p] = pts;
          });
          state.round = last.round;
        }
      }
      editingPlayer = null;
      save();
      render();
    }

    function undoLabel() {
      const top = state.undoStack[state.undoStack.length - 1];
      if (!top) return '↩️ Deshacer';
      if (top.type === 'round') return '↩️ Deshacer cambio de ronda';
      return `↩️ Deshacer ${top.delta > 0 ? '+' : ''}${top.delta} de ${window.escapeHtml(top.name)}`;
    }

    function startEdit(name) {
      editingPlayer = name;
      render();
    }

    function confirmEdit(name, rawValue) {
      const before = state.roundScore[name];
      let val = parseInt(rawValue, 10);
      if (isNaN(val)) val = before;
      val = clampRound(name, val);
      if (val !== before) pushUndo({ type: 'score', name, delta: val - before });
      state.roundScore[name] = val;
      editingPlayer = null;
      save();
      if (val !== before && window.haptic) window.haptic('tap');
      render();
    }

    function nextRound() {
      state.history.push({ round: state.round, scores: Object.assign({}, state.roundScore) });
      players.forEach((p) => {
        state.total[p] += state.roundScore[p];
        state.roundScore[p] = 0;
      });
      state.round += 1;
      pushUndo({ type: 'round' });
      save();
      render();
    }

    function finishGame() {
      const ranked = rankedPlayers();
      const results = ranked.map((name) => ({ name, score: liveTotal(name) }));
      if (window.haptic) window.haptic('finish');
      callbacks.onFinish(results);
    }

    function render() {
      const ranked = rankedPlayers();
      const rankIndex = {};
      ranked.forEach((p, i) => { rankIndex[p] = i; });

      const metaParts = [];
      metaParts.push(config.rounds ? `Ronda ${state.round}/${config.rounds}` : `Ronda ${state.round}`);
      if (config.target) metaParts.push(`Meta ${config.target} pts`);

      const roundLimitReached = config.rounds != null && state.round >= config.rounds;
      const targetReached = config.target != null && players.some((p) => liveTotal(p) >= config.target);
      const limitReached = roundLimitReached || targetReached;

      const scoreRows = players.map((name) => {
        const color = window.avatarColor ? window.avatarColor(name) : '#6c63ff';
        const isEditing = editingPlayer === name;
        const scoreDisplay = isEditing
          ? `<input class="au-score-edit" type="number" inputmode="numeric" id="au_edit_${cssId(name)}" value="${state.roundScore[name]}">`
          : `<span class="au-score-num" onclick="window.__auEditStart('${cssId(name)}')">${state.roundScore[name]}</span>`;

        return `
          <div class="au-player-row">
            <div class="au-player-medal">${medalFor(rankIndex[name])}</div>
            <div class="au-player-bar" style="background:${color}"></div>
            <div class="au-player-main">
              <div class="au-player-name">${window.escapeHtml(name)}</div>
              <div class="pc-muted">Total: ${liveTotal(name)}</div>
            </div>
            ${scoreDisplay}
            <div class="au-score-btns">
              <button class="au-score-btn plus" onclick="window.__auAdjust('${cssId(name)}',1)">+</button>
              <button class="au-score-btn minus" onclick="window.__auAdjust('${cssId(name)}',-1)">−</button>
            </div>
          </div>
        `;
      }).join('');

      const rankingTab = ranked.map((name, i) => {
        const color = window.avatarColor ? window.avatarColor(name) : '#6c63ff';
        return `
          <div class="pc-row">
            <span>${medalFor(i)} <span class="au-dot" style="background:${color}"></span> ${window.escapeHtml(name)}</span>
            <strong>${liveTotal(name)} pts</strong>
          </div>
        `;
      }).join('');

      const historyTab = state.history.length
        ? state.history.map((h) => `
            <div class="pc-history-item">
              <div class="pc-history-top"><span>Ronda ${h.round}</span></div>
              <div class="pc-muted">${players.map((p) => `${window.escapeHtml(p)}: ${h.scores[p] || 0}`).join(' · ')}</div>
            </div>
          `).join('')
        : '<p class="pc-muted">Aún no hay rondas registradas.</p>';

      container.innerHTML = `
        <div class="au-header">
          <div class="pc-title" style="margin-bottom:2px;">Partida</div>
          <div class="pc-muted">${metaParts.join(' · ')} · puntos de esta ronda</div>
        </div>
        <button class="au-undo-btn" onclick="window.__auUndo()" ${state.undoStack.length ? '' : 'disabled'}>${undoLabel()}</button>

        ${scoreRows}

        <div class="au-tabs">
          <button class="au-tab ${activeTab === 'ranking' ? 'active' : ''}" onclick="window.__auTab('ranking')">🏆 Ranking</button>
          <button class="au-tab ${activeTab === 'historial' ? 'active' : ''}" onclick="window.__auTab('historial')">📋 Historial</button>
        </div>
        <div class="pc-card">
          ${activeTab === 'ranking' ? rankingTab : historyTab}
        </div>

        <div class="au-bottom-actions">
          ${limitReached
            ? '<div class="au-btn-outline disabled">🏁 Última ronda — pulsa Terminar para ver el resultado</div>'
            : '<button class="au-btn-outline" onclick="window.__auNextRound()">⏩ Sig. ronda</button>'}
          <button class="au-btn-danger" onclick="window.__auFinish()">🏁 Terminar</button>
        </div>
      `;

      if (editingPlayer !== null) {
        const input = container.querySelector('.au-score-edit');
        if (input) {
          input.focus();
          input.select();
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
          });
          input.addEventListener('blur', () => {
            const name = players.find((p) => cssId(p) === input.id.replace('au_edit_', ''));
            confirmEdit(name, input.value);
          });
        }
      }
    }

    window.__auAdjust = (cid, delta) => {
      const name = players.find((p) => cssId(p) === cid);
      adjust(name, delta);
    };
    window.__auUndo = () => undo();
    window.__auEditStart = (cid) => {
      const name = players.find((p) => cssId(p) === cid);
      startEdit(name);
    };
    window.__auTab = (tab) => { activeTab = tab; render(); };
    window.__auNextRound = () => nextRound();
    window.__auFinish = () => finishGame();

    render();
  }

  window.PuntacosGames[GAME_ID] = {
    id: GAME_ID,
    name: 'Anotador Universal',
    icon: '🎲',
    desc: 'Para cualquier juego de mesa',
    gradient: 'linear-gradient(135deg, #6c63ff, #8b7fff)',
    minPlayers: 2,
    maxPlayers: 6,
    configScreen: configScreen,
    playScreen: playScreen
  };
})();
