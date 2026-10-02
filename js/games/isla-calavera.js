/* ===================== Puntacos · Isla Calavera ===================== */
window.PuntacosGames = window.PuntacosGames || {};

(function () {
  const GAME_ID = 'isla-calavera';
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 5;
  const DEFAULT_TARGET = 6000;
  const FACES = ['skulls', 'sabers', 'monkeys', 'parrots', 'coins', 'diamonds'];
  const CARDS = [
    ['skull1', '☠️', 'Calavera ×1'],
    ['skull2', '☠️', 'Calavera ×2'],
    ['pirate', '🏴‍☠️', 'Pirata'],
    ['sorceress', '🧙', 'Hechicera'],
    ['treasure', '🏴‍☠️', 'Tesoro'],
    ['coin', '🪙', 'Moneda'],
    ['diamond', '💎', 'Diamante'],
    ['animals', '🐒🦜', 'Mono y Loro'],
    ['ship2', '⚔️', 'Barco 2 sables'],
    ['ship3', '⚔️', 'Barco 3 sables'],
    ['ship4', '⚔️', 'Barco 4 sables']
  ];
  const SHIPS = { ship2: { need: 2, value: 300 }, ship3: { need: 3, value: 500 }, ship4: { need: 4, value: 1000 } };

  function esc(v) { return window.escapeHtml ? window.escapeHtml(v) : String(v); }
  function freshDice() { return { skulls: 0, sabers: 0, monkeys: 0, parrots: 0, coins: 0, diamonds: 0 }; }
  function freshTurn() { return { card: null, island: false, dice: freshDice(), treasure: freshDice(), eightBonus: false }; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function normalizeDice(raw) {
    const d = freshDice();
    FACES.forEach(k => { d[k] = Math.max(0, Math.min(8, Math.floor(Number(raw && raw[k]) || 0))); });
    return d;
  }
  function normalizeTurn(raw) {
    const t = freshTurn();
    if (!raw || typeof raw !== 'object') return t;
    t.card = CARDS.some(c => c[0] === raw.card) ? raw.card : null;
    t.island = Boolean(raw.island);
    t.dice = normalizeDice(raw.dice);
    t.treasure = normalizeDice(raw.treasure);
    t.eightBonus = Boolean(raw.eightBonus);
    if (t.card !== 'treasure') t.treasure = freshDice();
    return t;
  }

  function cardSkulls(card) { return card === 'skull1' ? 1 : card === 'skull2' ? 2 : 0; }

  function faceCombo(count) {
    if (count < 3) return 0;
    return ({3:100, 4:200, 5:500, 6:1000, 7:2000, 8:4000})[count] || 0;
  }

  function scoreDetails(turn) {
    const t = normalizeTurn(turn);
    const d = t.dice;
    const tr = t.card === 'treasure' ? t.treasure : freshDice();
    const totalPhysical = FACES.reduce((sum, k) => sum + d[k] + tr[k], 0);
    const effectiveSkulls = d.skulls + cardSkulls(t.card);
    const treasureBust = t.card === 'treasure' && d.skulls >= 3;
    const scoringDiceSource = treasureBust ? tr : d;
    const all = {};
    FACES.forEach(k => { all[k] = scoringDiceSource[k] + tr[k] * (treasureBust ? 0 : 0); });
    // Normally the treasure is part of the scoring pool; when 3 skulls appear,
    // only the dice already stored in the treasure survive.
    if (!treasureBust) FACES.forEach(k => { all[k] = d[k] + tr[k]; });

    if (t.island) return { score: 0, eliminated: false, island: true, effectiveSkulls, eightEligible: false, magicPirates: false, breakdown: ['Isla Calavera: 0 puntos'] };

    if (effectiveSkulls >= 3 && !treasureBust) return { score: 0, eliminated: true, island: false, effectiveSkulls, eightEligible: false, magicPirates: false, breakdown: ['3 o más calaveras: 0 puntos'] };

    const animals = t.card === 'animals' ? all.monkeys + all.parrots : null;
    const groups = [['sables', all.sabers], ['monedas', all.coins], ['diamantes', all.diamonds]];
    if (t.card === 'animals') groups.push(['animales', animals]);
    else groups.push(['monos', all.monkeys], ['loros', all.parrots]);
    let comboPoints = 0;
    const combos = [];
    groups.forEach(([label, count]) => { const pts = faceCombo(count); if (pts) { comboPoints += pts; combos.push(`${label}: ${pts}`); } });

    const individual = (all.coins + all.diamonds) * 100;
    let ship = 0;
    let shipFailed = false;
    if (SHIPS[t.card]) {
      if (all.sabers >= SHIPS[t.card].need) ship = SHIPS[t.card].value;
      else shipFailed = true;
    }
    if (shipFailed) return { score: -SHIPS[t.card].value, eliminated: false, island: false, effectiveSkulls, eightEligible: false, magicPirates: false, breakdown: [`Barco no cumplido: −${SHIPS[t.card].value}`] };

    let base = comboPoints + individual + ship;
    const physicalScoringDice = all.sabers + all.monkeys + all.parrots + all.coins + all.diamonds;
    const eightEligible = physicalScoringDice === 8 && effectiveSkulls === 0;
    const bonus = t.eightBonus && eightEligible ? 500 : 0;
    const sameGroup9 = [all.sabers, all.coins, all.diamonds, t.card === 'animals' ? animals : all.monkeys, t.card === 'animals' ? animals : all.parrots].some(n => n >= 9);
    const magicPirates = sameGroup9;
    if (t.card === 'pirate') base *= 2;
    const score = base + bonus;
    const breakdown = [];
    if (comboPoints) breakdown.push(`Combinaciones: ${comboPoints}`);
    if (individual) breakdown.push(`Monedas/diamantes: ${individual}`);
    if (ship) breakdown.push(`Barco: +${ship}`);
    if (t.card === 'pirate') breakdown.push('Pirata: ×2');
    if (bonus) breakdown.push('8 dados: +500');
    if (treasureBust) breakdown.push('Tesoro: dados guardados protegidos');
    if (magicPirates) breakdown.push('🏴‍☠️ Magia de los Piratas');
    if (!breakdown.length) breakdown.push('Sin puntuación');
    return { score, eliminated: false, island: false, effectiveSkulls, eightEligible, magicPirates, breakdown };
  }
  function configScreen(container, roster, onStart) {
    let count = Math.min(Math.max(roster.length || MIN_PLAYERS, MIN_PLAYERS), MAX_PLAYERS);
    const names = Array.from({length: MAX_PLAYERS}, (_, i) => roster[i] || '');
    function slots() {
      return Array.from({length: count}, (_, i) => `
        <div class="ic-player-slot" data-i="${i}"><span class="ic-dot"></span><span class="ic-player-name ${names[i] ? '' : 'placeholder'}">${esc(names[i] || `Jugador ${i+1}`)}</span><span>›</span></div>`).join('');
    }
    function saveRoster(name) {
      if (!window.Store) return;
      const p = window.Store.getPlayers().slice();
      if (!p.some(x => x.trim().toLowerCase() === name.trim().toLowerCase())) { p.push(name.trim()); window.Store.setPlayers(p); }
    }
    function sheet(i) {
      const ov = document.createElement('div'); ov.className = 'ic-overlay';
      ov.innerHTML = `<div class="ic-sheet"><div class="ic-handle"></div><div class="ic-sheet-head"><strong>Elegir jugador</strong><button class="ic-close">✕</button></div><div class="ic-roster-list">${roster.map((n,ri)=>`<button class="ic-roster-row" data-name="${esc(n)}"><span class="ic-dot"></span><span>${esc(n)}</span>${n===names[i]?'<b>✓</b>':''}</button>`).join('') || '<p class="pc-muted">No hay jugadores guardados.</p>'}</div><div class="ic-new-player"><input class="pc-input" id="ic_new" placeholder="O escribe un nombre nuevo"><button class="pc-btn" id="ic_add">Añadir</button></div><div class="ic-error" id="ic_err"></div></div>`;
      document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add('open'));
      const close=()=>{ov.classList.remove('open');setTimeout(()=>ov.remove(),180)};
      ov.querySelector('.ic-close').onclick=close; ov.addEventListener('click',e=>{if(e.target===ov)close()});
      ov.querySelectorAll('.ic-roster-row').forEach(b=>b.onclick=()=>{names[i]=b.dataset.name;container.querySelector('#ic_slots').innerHTML=slots();close()});
      ov.querySelector('#ic_add').onclick=()=>{const v=ov.querySelector('#ic_new').value.trim(); const er=ov.querySelector('#ic_err'); if(!v){er.textContent='Escribe un nombre.';return} if(roster.some(x=>x.trim().toLowerCase()===v.toLowerCase())){er.textContent='Ese jugador ya existe.';return} roster.push(v); saveRoster(v); names[i]=v; container.querySelector('#ic_slots').innerHTML=slots();close()};
    }
    container.innerHTML = `<div class="ic-section-label">Número de jugadores</div><div class="ic-count-row">${Array.from({length:4},(_,i)=>i+2).map(n=>`<button class="ic-count ${n===count?'active':''}" data-n="${n}">${n}</button>`).join('')}</div><div class="ic-section-label">Jugadores</div><div id="ic_slots">${slots()}</div><div class="ic-config-row"><label>Nombre de la partida (opcional)</label><input class="pc-input" id="ic_tag" placeholder="Ej. Isla Calavera del viernes"></div><div class="ic-config-row"><label>Puntos para ganar</label><input class="pc-input" id="ic_target" type="number" min="1" step="100" value="${DEFAULT_TARGET}"><div class="ic-help">Meta oficial: 6000 puntos</div></div><button class="pc-btn full-margin" id="ic_start">Iniciar partida →</button>`;
    container.querySelectorAll('.ic-count').forEach(b=>b.onclick=()=>{count=Number(b.dataset.n);container.querySelectorAll('.ic-count').forEach(x=>x.classList.toggle('active',x===b));container.querySelector('#ic_slots').innerHTML=slots()});
    container.querySelector('#ic_slots').onclick=e=>{const s=e.target.closest('.ic-player-slot');if(s)sheet(Number(s.dataset.i))};
    container.querySelector('#ic_start').onclick=()=>{const ps=names.slice(0,count).map((n,i)=>n.trim()||`Jugador ${i+1}`);if(new Set(ps.map(n=>n.toLowerCase())).size!==ps.length){alert('No puede haber dos jugadores con el mismo nombre.');return}ps.forEach(saveRoster);const target=Math.max(1,Number(container.querySelector('#ic_target').value)||DEFAULT_TARGET);onStart({target},container.querySelector('#ic_tag').value.trim(),ps)};
  }

  function playScreen(container, players, config, savedState, callbacks) {
    let state = savedState || { round:1, total:Object.fromEntries(players.map(p=>[p,0])), rounds:[], roundTurns:{}, phase:'normal', finalTrigger:null, finalQueue:[] };
    state.round=Math.max(1,Number(state.round)||1); state.total=state.total||{}; state.rounds=Array.isArray(state.rounds)?state.rounds:[]; state.roundTurns=state.roundTurns&&typeof state.roundTurns==='object'?state.roundTurns:{}; state.phase=state.phase||'normal'; state.finalQueue=Array.isArray(state.finalQueue)?state.finalQueue:[];
    players.forEach(p=>{state.total[p]=Number(state.total[p])||0});
    function save(){callbacks.onStateChange(state)}
    function ranked(){return players.slice().sort((a,b)=>state.total[b]-state.total[a]||players.indexOf(a)-players.indexOf(b))}
    function results(){return ranked().map(p=>({name:p,score:state.total[p]}))}
    function targetReached(){return players.some(p=>state.total[p]>=config.target)}

    function openRoundSheet() {
      const draft=Object.fromEntries(players.map(p=>[p,normalizeTurn(state.roundTurns[p])]));
      let activePlayer=0;
      const ov=document.createElement('div'); ov.className='ic-overlay';
      ov.innerHTML=`<div class="ic-round-sheet"><div class="ic-sheet-head"><div><strong>Cerrar ronda ${state.round}</strong><div class="ic-muted">Introduce los dados y la carta de cada jugador</div></div><button class="ic-close">✕</button></div><div class="ic-player-tabs">${players.map((p,i)=>`<button data-i="${i}" class="ic-player-tab ${i===0?'active':''}">${esc(p)}</button>`).join('')}</div><div id="ic_round_content"></div><div class="ic-sheet-footer"><button class="pc-btn secondary" id="ic_cancel">Cancelar</button><button class="pc-btn" id="ic_confirm">Confirmar ronda</button></div></div>`;
      document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add('open'));
      const content=ov.querySelector('#ic_round_content');
      function renderPlayer(){
        const name=players[activePlayer], t=draft[name], detail=scoreDetails(t);
        const cardButtons=CARDS.map(c=>`<button class="ic-card-choice ${t.card===c[0]?'selected':''}" data-card="${c[0]}"><span>${c[1]}</span><small>${c[2]}</small></button>`).join('');
        const counter=(key,label,icon)=>`<div class="ic-counter"><span>${icon} ${label}</span><button data-face="${key}" data-delta="-1">−</button><b>${t.dice[key]}</b><button data-face="${key}" data-delta="1">+</button></div>`;
        const island=`<div class="ic-island-row"><span>🏝️ Isla Calavera</span><label class="ic-switch"><input type="checkbox" id="ic_island" ${t.island?'checked':''}><span></span></label></div>`;
        let bonus='';
        if(detail.eightEligible) bonus=`<button class="ic-eight ${t.eightBonus?'active':''}" id="ic_eight">🏆 ¡8 dados puntuando! <b>+500</b></button>`;
        if(detail.magicPirates) bonus += `<div class="ic-magic">🏴‍☠️ Magia de los Piratas · 9 dados</div>`;
        if(t.card==='treasure'){
          bonus+=`<button class="ic-treasure-open" id="ic_treasure">🏴‍☠️ Editar dados guardados en el Tesoro</button>`;
        }
        content.innerHTML=`<div class="ic-current-player"><strong>${esc(name)}</strong><span>${state.total[name]} pts</span></div><div class="ic-section-label">Carta de pirata</div><div class="ic-card-grid">${cardButtons}</div>${island}<div class="ic-section-label">Dados obtenidos</div><div class="ic-counters">${counter('skulls','Calaveras','☠️')}${counter('sabers','Sables','⚔️')}${counter('monkeys','Monos','🐒')}${counter('parrots','Loros','🦜')}${counter('coins','Monedas','🪙')}${counter('diamonds','Diamantes','💎')}</div>${bonus}<div class="ic-result"><div class="ic-result-title">Puntos este turno</div><div class="ic-result-score">${detail.score}</div><div class="ic-breakdown">${detail.breakdown.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`;
        content.querySelectorAll('.ic-card-choice').forEach(b=>b.onclick=()=>{t.card=b.dataset.card; if(t.card!=='treasure')t.treasure=freshDice(); renderPlayer()});
        content.querySelector('#ic_island').onchange=e=>{t.island=e.target.checked;renderPlayer()};
        content.querySelectorAll('.ic-counter button').forEach(b=>b.onclick=()=>{const k=b.dataset.face;t.dice[k]=Math.max(0,Math.min(8,t.dice[k]+Number(b.dataset.delta)));t.eightBonus=false;renderPlayer()});
        const eight=content.querySelector('#ic_eight'); if(eight)eight.onclick=()=>{t.eightBonus=!t.eightBonus;renderPlayer()};
        const treasure=content.querySelector('#ic_treasure'); if(treasure)treasure.onclick=()=>openTreasure(t,renderPlayer);
      }
      function openTreasure(t,after){
        const tv=clone(t.treasure); const tov=document.createElement('div'); tov.className='ic-overlay ic-overlay-top';
        tov.innerHTML=`<div class="ic-mini-sheet"><div class="ic-sheet-head"><strong>🏴‍☠️ Tesoro</strong><button class="ic-close">✕</button></div><div class="ic-muted">Dados que quedaron guardados y siguen puntuando</div><div class="ic-counters">${[['sabers','Sables','⚔️'],['monkeys','Monos','🐒'],['parrots','Loros','🦜'],['coins','Monedas','🪙'],['diamonds','Diamantes','💎']].map(([k,l,i])=>`<div class="ic-counter"><span>${i} ${l}</span><button data-face="${k}" data-delta="-1">−</button><b>${tv[k]}</b><button data-face="${k}" data-delta="1">+</button></div>`).join('')}</div><button class="pc-btn" id="ic_tsave">Guardar</button></div>`;
        document.body.appendChild(tov);requestAnimationFrame(()=>tov.classList.add('open'));
        const close=()=>{tov.classList.remove('open');setTimeout(()=>tov.remove(),160)};
        tov.querySelector('.ic-close').onclick=close;
        tov.querySelectorAll('.ic-counter button').forEach(b=>b.onclick=()=>{const k=b.dataset.face;tv[k]=Math.max(0,Math.min(8,tv[k]+Number(b.dataset.delta)));tov.querySelectorAll(`[data-face="${k}"]`).forEach(x=>{if(x.tagName==='BUTTON'){} }); const row=b.closest('.ic-counter');row.querySelector('b').textContent=tv[k]});
        tov.querySelector('#ic_tsave').onclick=()=>{t.treasure=tv;close();after()};
      }
      ov.querySelectorAll('.ic-player-tab').forEach(b=>b.onclick=()=>{activePlayer=Number(b.dataset.i);ov.querySelectorAll('.ic-player-tab').forEach(x=>x.classList.toggle('active',x===b));renderPlayer()});
      const close=()=>{ov.classList.remove('open');setTimeout(()=>ov.remove(),180)};
      ov.querySelector('.ic-close').onclick=close;ov.addEventListener('click',e=>{if(e.target===ov)close()});ov.querySelector('#ic_cancel').onclick=close;
      ov.querySelector('#ic_confirm').onclick=()=>{state.roundTurns=Object.fromEntries(players.map(p=>[p,normalizeTurn(draft[p])]));close();finishRound()};
      renderPlayer();
    }

    function finishRound(){
      const snapshots={};
      players.forEach(p=>{const turn=normalizeTurn(state.roundTurns[p]);const d=scoreDetails(turn);snapshots[p]={turn:clone(turn),score:d.score,detail:d};state.total[p]+=d.score});
      state.rounds.push({round:state.round,players:snapshots});
      const reached=players.filter(p=>state.total[p]>=config.target);
      if(state.phase==='normal' && reached.length){
        const max=Math.max(...players.map(p=>state.total[p])); const leaders=players.filter(p=>state.total[p]===max);
        if(leaders.length===1){state.phase='final';state.finalTrigger=leaders[0];state.finalQueue=players.filter(p=>p!==leaders[0]);}
      }
      if(state.phase==='final'){
        const trigger=state.finalTrigger;
        if(state.finalQueue.length){state.round+=1;state.roundTurns={};save();render();setTimeout(()=>openSingleFinalRound(state.finalQueue.shift()),50);return}
        const leader=ranked()[0];
        if(leader===trigger){save();callbacks.onFinish(results());return}
        state.finalTrigger=leader;state.finalQueue=players.filter(p=>p!==leader);state.round+=1;state.roundTurns={};save();render();setTimeout(()=>openSingleFinalRound(state.finalQueue.shift()),50);return;
      }
      state.round+=1;state.roundTurns={};save();render();
    }

    function openSingleFinalRound(name){
      // In the final phase, only the queued player enters a turn; the other players keep their totals.
      const t=normalizeTurn(state.roundTurns[name]);
      const fake={ [name]:t };
      const originalPlayers=players.slice();
      // Reuse a compact one-player editor to avoid changing the normal UI.
      const ov=document.createElement('div');ov.className='ic-overlay';ov.innerHTML=`<div class="ic-round-sheet"><div class="ic-sheet-head"><div><strong>Último turno · ${esc(name)}</strong><div class="ic-muted">Introduce el resultado de su turno</div></div></div><div id="ic_final_content"></div><div class="ic-sheet-footer"><button class="pc-btn" id="ic_final_confirm">Confirmar turno</button></div></div>`;document.body.appendChild(ov);requestAnimationFrame(()=>ov.classList.add('open'));
      const content=ov.querySelector('#ic_final_content');
      function renderOne(){
        const detail=scoreDetails(t);content.innerHTML=`<div class="ic-section-label">Carta de pirata</div><div class="ic-card-grid">${CARDS.map(c=>`<button class="ic-card-choice ${t.card===c[0]?'selected':''}" data-card="${c[0]}"><span>${c[1]}</span><small>${c[2]}</small></button>`).join('')}</div><div class="ic-island-row"><span>🏝️ Isla Calavera</span><label class="ic-switch"><input type="checkbox" id="ic_fisland" ${t.island?'checked':''}><span></span></label></div><div class="ic-section-label">Dados obtenidos</div><div class="ic-counters">${FACES.map(k=>{const lab={skulls:'Calaveras',sabers:'Sables',monkeys:'Monos',parrots:'Loros',coins:'Monedas',diamonds:'Diamantes'}[k];const ic={skulls:'☠️',sabers:'⚔️',monkeys:'🐒',parrots:'🦜',coins:'🪙',diamonds:'💎'}[k];return `<div class="ic-counter"><span>${ic} ${lab}</span><button data-face="${k}" data-delta="-1">−</button><b>${t.dice[k]}</b><button data-face="${k}" data-delta="1">+</button></div>`}).join('')}</div>${detail.eightEligible?`<button class="ic-eight ${t.eightBonus?'active':''}" id="ic_feight">🏆 ¡8 dados puntuando! <b>+500</b></button>`:''}<div class="ic-result"><div class="ic-result-title">Puntos este turno</div><div class="ic-result-score">${detail.score}</div><div class="ic-breakdown">${detail.breakdown.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`;
        content.querySelectorAll('.ic-card-choice').forEach(b=>b.onclick=()=>{t.card=b.dataset.card;renderOne()});content.querySelector('#ic_fisland').onchange=e=>{t.island=e.target.checked;renderOne()};content.querySelectorAll('.ic-counter button').forEach(b=>b.onclick=()=>{const k=b.dataset.face;t.dice[k]=Math.max(0,Math.min(8,t.dice[k]+Number(b.dataset.delta)));t.eightBonus=false;renderOne()});const eb=content.querySelector('#ic_feight');if(eb)eb.onclick=()=>{t.eightBonus=!t.eightBonus;renderOne()};
      }
      renderOne();ov.querySelector('#ic_final_confirm').onclick=()=>{state.roundTurns[name]=t;const detail=scoreDetails(t);state.total[name]+=detail.score;state.rounds.push({round:state.round,players:{[name]:{turn:clone(t),score:detail.score,detail}}});ov.remove();const leader=ranked()[0];if(leader===state.finalTrigger){save();callbacks.onFinish(results())}else{state.finalTrigger=leader;state.finalQueue=players.filter(p=>p!==leader);state.round+=1;state.roundTurns={};save();setTimeout(()=>openSingleFinalRound(state.finalQueue.shift()),50)}};
    }

    function render(){
      const rank=ranked();
      container.innerHTML=`<div class="ic-main-head"><div><div class="ic-title">Isla Calavera</div><div class="ic-muted">Ronda ${state.round} · Meta: ${config.target}</div></div></div>${state.phase==='final'?`<div class="ic-final-banner">🏁 Final de partida · turnos finales</div>`:''}${rank.map((p,i)=>`<div class="ic-score-card"><div><span class="ic-pos">${i+1}º</span><strong>${esc(p)}</strong></div><div class="ic-score">${state.total[p]} <small>pts</small></div><div class="ic-remaining">${state.total[p]>=config.target?'Meta alcanzada':`${Math.max(0,config.target-state.total[p])} pts para la meta`}</div></div>`).join('')}<button class="pc-btn full-margin" id="ic_close_round">Cerrar turno</button><button class="pc-btn secondary full-margin" id="ic_finish">Terminar</button>`;
      container.querySelector('#ic_close_round').onclick=openRoundSheet;
      container.querySelector('#ic_finish').onclick=()=>{if(confirm('¿Terminar la partida? Se guardará el resultado actual.')) callbacks.onFinish(results())};
    }
    save();render();
  }

  window.PuntacosGames[GAME_ID]={id:GAME_ID,name:'Isla Calavera',icon:'🏴‍☠️',desc:'Dados, tesoros y riesgo',gradient:'linear-gradient(135deg, #0f766e, #164e63)',minPlayers:MIN_PLAYERS,maxPlayers:MAX_PLAYERS,configScreen,playScreen};
})();
