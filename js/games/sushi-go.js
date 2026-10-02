/* ===================== Juego: Sushi Go! ===================== */
/* Implementación del contrato de juego documentado en la cabecera de
   shell.js (window.PuntacosGames[id] = {...}).

   FASE 1 — solo estructura. Esta fase NO implementa ninguna lógica de
   puntuación ni de cartas (Maki, Tempura, Sashimi, Gyoza, Nigiri, Wasabi,
   Palillos, Pudin). Eso llega en una fase posterior.

   `config` de este juego: { cardsPerPlayer, roundsTotal }
   `state` de este juego: { round, cardLimit, cardsRegistered, rounds }
     - round:           ronda actual (1..roundsTotal)
     - cardLimit:        cartas FÍSICAS repartidas esta ronda (depende del
                          número de jugadores, igual en las 3 rondas)
     - cardsRegistered:  { [nombreJugador]: number } — cartas físicas ya
                          registradas en la ronda actual. OJO: en fases
                          futuras una sola acción (p.ej. Nigiri + Wasabi)
                          podrá consumir más de 1 carta física a la vez, así
                          que este contador cuenta CARTAS, no "acciones" ni
                          "pulsaciones". No asumas una equivalencia 1:1.
     - rounds:           historial de rondas ya cerradas de ESTA partida
                          (vacío en Fase 1; se rellenará cuando exista el
                          cierre de ronda en una fase posterior)
   El Shell no conoce ni depende de ninguno de los dos formatos anteriores. */
window.PuntacosGames = window.PuntacosGames || {};

(function () {
  const GAME_ID = 'sushi-go';
  const ROUNDS_TOTAL = 3;
  const CARDS_BY_PLAYER_COUNT = { 2: 10, 3: 9, 4: 8, 5: 7 };
  const DOT_COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#6c63ff', '#06b6d4'];

  function cardsForCount(n) {
    return CARDS_BY_PLAYER_COUNT[n] || null;
  }

  function esc(v) {
    return window.escapeHtml ? window.escapeHtml(v) : String(v);
  }

  /* ---------------- Config screen ---------------- */
  function configScreen(container, roster, onStart) {
    const counts = Object.keys(CARDS_BY_PLAYER_COUNT).map(Number); // [2,3,4,5]
    let count = Math.min(Math.max(roster.length || 2, 2), 5);
    if (!counts.includes(count)) count = 2;
    const currentNames = [];
    for (let i = 0; i < 5; i++) currentNames[i] = roster[i] || '';

    function renderSlot(i) {
      const color = DOT_COLORS[i % DOT_COLORS.length];
      const displayName = currentNames[i] || `Jugador ${i + 1}`;
      return `
        <div class="sg-player-slot sg-player-slot-tap" data-i="${i}">
          <span class="sg-dot" style="background:${color}"></span>
          <span class="sg-player-name-display ${!currentNames[i] ? 'placeholder' : ''}">${esc(displayName)}</span>
          <span class="sg-slot-chevron">›</span>
        </div>
      `;
    }

    function playerSlotsHtml() {
      let html = '';
      for (let i = 0; i < count; i++) html += renderSlot(i);
      return html;
    }

    function regenerateSlots() {
      container.querySelector('#sg_player_slots').innerHTML = playerSlotsHtml();
    }

    function cardsInfoHtml() {
      const cards = cardsForCount(count);
      return `Con ${count} jugador${count === 1 ? '' : 'es'}, cada uno recibe <strong>${cards} cartas</strong> por ronda.`;
    }

    function openPlayerSheet(i) {
      const overlay = document.createElement('div');
      overlay.className = 'sg-sheet-overlay';
      overlay.innerHTML = `
        <div class="sg-sheet">
          <div class="sg-sheet-handle"></div>
          <div class="sg-sheet-title">Elegir jugador</div>
          <div class="sg-sheet-list">
            ${roster.map((name, ri) => `
              <div class="sg-sheet-row" data-name="${esc(name)}">
                <span class="sg-dot" style="background:${DOT_COLORS[ri % DOT_COLORS.length]}"></span>
                <span class="sg-sheet-row-name">${esc(name)}</span>
                ${name === currentNames[i] ? '<span class="sg-sheet-check">✓</span>' : ''}
              </div>
            `).join('') || '<p class="pc-muted">Aún no tienes jugadores guardados.</p>'}
          </div>
          <div class="sg-sheet-new">
            <input class="pc-input" id="sg_sheet_new_input" placeholder="O escribe un nombre nuevo" style="margin:0;">
            <button class="pc-btn" id="sg_sheet_new_btn">Añadir y elegir</button>
          </div>
          <div id="sg_sheet_error" class="pc-muted" style="color:var(--danger); margin-top:6px;"></div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      function close() {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 200);
      }

      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelectorAll('.sg-sheet-row').forEach((row) => {
        row.addEventListener('click', () => {
          currentNames[i] = row.dataset.name;
          regenerateSlots();
          close();
        });
      });

      const newInput = overlay.querySelector('#sg_sheet_new_input');
      const errorBox = overlay.querySelector('#sg_sheet_error');
      newInput.addEventListener('input', () => { errorBox.textContent = ''; });
      overlay.querySelector('#sg_sheet_new_btn').addEventListener('click', () => {
        const val = newInput.value.trim();
        if (!val) {
          errorBox.textContent = 'Escribe un nombre para el jugador.';
          return;
        }
        const isDuplicate = roster.some((n) => n.trim().toLowerCase() === val.toLowerCase());
        if (isDuplicate) {
          errorBox.textContent = `Ya existe un jugador llamado "${val}".`;
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
      <div class="sg-section-label">Número de jugadores</div>
      <div class="sg-count-row" id="sg_count_row">
        ${counts.map((n) => `<button type="button" class="sg-count-pill ${n === count ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
      </div>

      <div class="sg-section-label" style="margin-top:14px;">Jugadores guardados</div>
      <div id="sg_player_slots">${playerSlotsHtml()}</div>

      <div class="sg-config-row" style="margin-top:14px;">
        <label class="sg-config-label">Etiqueta de la partida (opcional)</label>
        <input class="pc-input" id="sg_tag" placeholder="Ej. Sushi del viernes">
      </div>

      <div class="sg-section-label">Reparto de cartas</div>
      <div class="pc-card" id="sg_cards_info">
        <p class="pc-muted" style="margin:0;" id="sg_cards_info_text">${cardsInfoHtml()}</p>
      </div>

      <div class="sg-section-label" style="margin-top:14px;">Rondas</div>
      <div class="pc-card">
        <p class="pc-muted" style="margin:0;">Sushi Go! se juega a <strong>${ROUNDS_TOTAL} rondas</strong>.</p>
      </div>

      <button class="pc-btn full-margin" id="sg_start_btn">Iniciar partida →</button>
    `;

    container.querySelectorAll('.sg-count-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        count = parseInt(btn.dataset.n, 10);
        container.querySelectorAll('.sg-count-pill').forEach((b) => b.classList.toggle('active', b === btn));
        regenerateSlots();
        container.querySelector('#sg_cards_info_text').innerHTML = cardsInfoHtml();
      });
    });

    container.querySelector('#sg_player_slots').addEventListener('click', (e) => {
      const tapSlot = e.target.closest('.sg-player-slot-tap');
      if (tapSlot) openPlayerSheet(parseInt(tapSlot.dataset.i, 10));
    });

    container.querySelector('#sg_start_btn').addEventListener('click', () => {
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

      const tag = container.querySelector('#sg_tag').value.trim();
      const config = {
        cardsPerPlayer: cardsForCount(count),
        roundsTotal: ROUNDS_TOTAL
      };
      onStart(config, tag, players);
    });
  }

  /* ---------------- Play screen ---------------- */
  function playScreen(container, players, config, savedState, callbacks) {
    const defaultPlayerCards = () => ({
      maki1: 0, maki2: 0, maki3: 0,
      tempura: 0, sashimi: 0, gyoza: 0,
      nigiriTortilla: 0, nigiriTortillaWasabi: 0,
      nigiriSalmon: 0, nigiriSalmonWasabi: 0,
      nigiriCalamar: 0, nigiriCalamarWasabi: 0,
      wasabi: 0, chopsticks: 0, pudding: 0
    });

    let state = savedState || {
      round: 1,
      cardLimit: config.cardsPerPlayer,
      cardsRegistered: {},
      cards: {},
      rounds: []
    };
    state.round = Number(state.round) || 1;
    state.cardLimit = Number(state.cardLimit) || config.cardsPerPlayer;
    state.cardsRegistered = state.cardsRegistered || {};
    state.cards = state.cards || {};
    state.rounds = Array.isArray(state.rounds) ? state.rounds : [];

    players.forEach((p) => {
      const old = state.cards[p] || {};
      state.cards[p] = Object.assign(defaultPlayerCards(), old);
      Object.keys(state.cards[p]).forEach((k) => { state.cards[p][k] = Number(state.cards[p][k]) || 0; });
      if (!(p in state.cardsRegistered)) state.cardsRegistered[p] = 0;
    });

    function physicalCardCount(c) {
      return c.maki1 + c.maki2 + c.maki3 + c.tempura + c.sashimi + c.gyoza
        + c.nigiriTortilla + c.nigiriSalmon + c.nigiriCalamar
        + (2 * c.nigiriTortillaWasabi) + (2 * c.nigiriSalmonWasabi) + (2 * c.nigiriCalamarWasabi)
        + c.wasabi + c.chopsticks + c.pudding;
    }

    function makiIcons(c) { return c.maki1 + (2 * c.maki2) + (3 * c.maki3); }

    function immediateScore(c) {
      const gyozaTable = [0, 1, 3, 6, 10, 15];
      return (Math.floor(c.tempura / 2) * 5)
        + (Math.floor(c.sashimi / 3) * 10)
        + gyozaTable[Math.min(c.gyoza, 5)]
        + c.nigiriTortilla + (3 * c.nigiriTortillaWasabi)
        + (2 * c.nigiriSalmon) + (6 * c.nigiriSalmonWasabi)
        + (3 * c.nigiriCalamar) + (9 * c.nigiriCalamarWasabi);
    }

    function syncPlayer(name) {
      state.cardsRegistered[name] = physicalCardCount(state.cards[name]);
    }

    function save() {
      players.forEach(syncPlayer);
      callbacks.onStateChange(state);
    }

    function scoreLabel(c) {
      const pts = immediateScore(c);
      return `${pts} pt${pts === 1 ? '' : 's'}`;
    }

    const rules = {
      maki: 'Se puntúa al cerrar la ronda: mayoría 6 puntos y segundo 3. Consulta los empates en las reglas.',
      tempura: 'Cada pareja de 2 Tempuras = 5 puntos. Las sueltas no puntúan.',
      sashimi: 'Cada grupo de 3 Sashimis = 10 puntos. Los que queden sueltos no puntúan.',
      gyoza: '1=1 · 2=3 · 3=6 · 4=10 · 5 o más=15 puntos.',
      tortilla: '1 punto. Con Wasabi = 3 puntos. La combinación ocupa 2 cartas físicas.',
      salmon: '2 puntos. Con Wasabi = 6 puntos. La combinación ocupa 2 cartas físicas.',
      calamar: '3 puntos. Con Wasabi = 9 puntos. La combinación ocupa 2 cartas físicas.',
      wasabi: 'Wasabi suelto = 0 puntos. Ocupa 1 carta física.',
      chopsticks: '0 puntos. Permite coger 2 cartas en un turno y después se devuelve a la baraja.',
      pudding: 'No puntúa durante las rondas. Se acumula y se puntúa solo al final de la 3.ª ronda: mayoría +6 y minoría −6, con las reglas de empate.'
    };

    function row(key, title, subtitle, rule) {
      return `
        <div class="sg-entry-card sg-entry-row">
          <div class="sg-entry-copy">
            <div class="sg-entry-title">${title}</div>
            ${subtitle ? `<div class="sg-entry-subtitle">${subtitle}</div>` : ''}
            <div class="sg-entry-rule">${rule}</div>
          </div>
          <div class="sg-entry-controls">
            <button class="sg-step" data-key="${key}" data-delta="-1">−</button>
            <strong id="sg_${key}">0</strong>
            <button class="sg-step" data-key="${key}" data-delta="1">+</button>
          </div>
        </div>`;
    }

    function openCardSheet(name) {
      const cards = state.cards[name];
      const overlay = document.createElement('div');
      overlay.className = 'sg-sheet-overlay';
      overlay.innerHTML = `
        <div class="sg-sheet sg-card-sheet">
          <div class="sg-sheet-fixed">
            <div class="sg-sheet-handle"></div>
            <div class="sg-sheet-title">Anotar cartas · ${esc(name)}</div>
            <div class="sg-sticky-score sg-modal-score">
              <div class="sg-score-title">PUNTOS AHORA</div>
              <div class="sg-score-value" id="sg_live_score">0 puntos</div>
              <div class="sg-score-note" id="sg_live_note">Los Makis se puntúan al cerrar la ronda · los Pudines al final de la 3.ª ronda</div>
            </div>
          </div>
          <div class="sg-sheet-scroll">
            <div class="sg-sheet-card-count" id="sg_sheet_count"></div>

            <div class="sg-card-section-title">Maki</div>
            <div class="sg-card-entry-grid">
              ${row('maki1', '🍣 1 Maki', '', rules.maki)}
              ${row('maki2', '🍣 2 Makis', '', rules.maki)}
              ${row('maki3', '🍣 3 Makis', '', rules.maki)}
            </div>

            <div class="sg-card-section-title">Otras cartas</div>
            <div class="sg-card-entry-grid">
              ${row('tempura', '🍤 Tempura', '', rules.tempura)}
              ${row('sashimi', '🐟 Sashimi', '', rules.sashimi)}
              ${row('gyoza', '🥟 Gyoza', '', rules.gyoza)}
              ${row('chopsticks', '🥢 Palillos', '', rules.chopsticks)}
              ${row('pudding', '🍮 Pudin', 'Se acumula', rules.pudding)}
              ${row('wasabi', '🟩 Wasabi', 'Wasabi suelto', rules.wasabi)}
            </div>

            <div class="sg-card-section-title">Nigiris</div>
            <div class="sg-nigiri-grid">
              <div class="sg-nigiri-head">Normal</div>
              <div class="sg-nigiri-head">Con Wasabi</div>
              ${row('nigiriTortilla', '🍳 Tortilla', '', rules.tortilla)}
              ${row('nigiriTortillaWasabi', '🍳 Tortilla + Wasabi', '', rules.tortilla)}
              ${row('nigiriSalmon', '🐟 Salmón', '', rules.salmon)}
              ${row('nigiriSalmonWasabi', '🐟 Salmón + Wasabi', '', rules.salmon)}
              ${row('nigiriCalamar', '🦑 Calamar', '', rules.calamar)}
              ${row('nigiriCalamarWasabi', '🦑 Calamar + Wasabi', '', rules.calamar)}
            </div>

            <div id="sg_sheet_error" class="pc-muted sg-error"></div>
            <button class="pc-btn full-margin" id="sg_save_cards">Guardar cartas</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      const draft = Object.assign(defaultPlayerCards(), cards);
      const countBox = overlay.querySelector('#sg_sheet_count');
      const errorBox = overlay.querySelector('#sg_sheet_error');

      function renderDraft() {
        Object.keys(draft).forEach((key) => {
          const el = overlay.querySelector('#sg_' + key);
          if (el) el.textContent = draft[key];
        });
        const total = physicalCardCount(draft);
        const pts = immediateScore(draft);
        const icons = makiIcons(draft);
        countBox.textContent = `${total}/${state.cardLimit} cartas · ${icons} iconos Maki · ${draft.pudding} pudines`;
        const liveScore = overlay.querySelector('#sg_live_score');
        if (liveScore) liveScore.textContent = `${pts} puntos`;
        overlay.querySelectorAll('.sg-step[data-delta="1"]').forEach((btn) => { btn.disabled = total >= state.cardLimit; });
      }

      function close() {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 200);
      }

      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelectorAll('.sg-step').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.key;
          const delta = Number(btn.dataset.delta);
          const next = draft[key] + delta;
          if (next < 0) return;
          const physicalDelta = key.endsWith('Wasabi') ? 2 * delta : delta;
          if (physicalCardCount(draft) + physicalDelta > state.cardLimit) {
            errorBox.textContent = `No puedes superar las ${state.cardLimit} cartas de esta ronda. Un Nigiri con Wasabi cuenta como 2 cartas físicas.`;
            return;
          }
          errorBox.textContent = '';
          draft[key] = next;
          renderDraft();
        });
      });

      overlay.querySelector('#sg_save_cards').addEventListener('click', () => {
        Object.assign(cards, draft);
        syncPlayer(name);
        save();
        close();
        render();
      });
      renderDraft();
    }

    function render() {
      players.forEach(syncPlayer);
      const totalRoundScore = players.reduce((sum, p) => sum + immediateScore(state.cards[p]), 0);
      const header = "";

      const rows = players.map((name) => {
        const color = window.avatarColor ? window.avatarColor(name) : '#f43f5e';
        const cards = state.cards[name];
        const reg = physicalCardCount(cards);
        const pts = immediateScore(cards);
        return `
          <div class="sg-player-card">
            <div class="sg-player-top">
              <span class="sg-dot" style="background:${color}; width:14px; height:14px;"></span>
              <span class="sg-player-name">${esc(name)}</span>
              <span class="sg-card-count">${reg} / ${state.cardLimit}</span>
            </div>
            <div class="sg-player-summary">
              <span>⭐ ${pts} pts ahora</span>
              <span>🍣 ${makiIcons(cards)} makis</span>
              <span>🍮 ${cards.pudding} pudines</span>
            </div>
            <button class="pc-btn sg-score-btn" data-player="${esc(name)}">Anotar cartas</button>
          </div>`;
      }).join('');

      container.innerHTML = `
        <div class="sg-header">
          <div class="pc-title" style="margin-bottom:2px;">Sushi Go!</div>
          <div class="pc-muted">Ronda ${state.round}/${config.roundsTotal} · ${state.cardLimit} cartas por jugador</div>
        </div>
        ${header}
        ${rows}
      `;

      container.querySelectorAll('.sg-score-btn').forEach((btn) => {
        btn.addEventListener('click', () => openCardSheet(btn.dataset.player));
      });
    }

    save();
    render();
  }

  window.PuntacosGames[GAME_ID] = {
    id: GAME_ID,
    name: 'Sushi Go!',
    icon: '🍣',
    desc: 'Reparte, elige y puntúa',
    gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)',
    minPlayers: 2,
    maxPlayers: 5,
    configScreen: configScreen,
    playScreen: playScreen
  };
})();
