import { useEffect, useMemo, useRef, useState } from 'react';
import { Client } from 'boardgame.io/client';
import { PolitikumGame } from './engine/game.js';

const BOT_NAMES = ['Гертруда', 'Ульрих', 'Ингеборга', 'Тибальт'];
const baseId = (id) => String(id || '').split('#')[0];
const score = (player) => (player?.coalition || []).reduce((sum, card) => sum + Number(card.vp || 0), 0);
const BUILD_VERSION = __BUILD_VERSION__;
const UI = {
  ru: { rivals: 'Соперники', start: 'Начать локальную игру', intro: 'Всё состояние живёт в браузере. Никаких аккаунтов, API или сервера.', salon: 'Политический салон', yourTurn: 'Ваш ход', thinking: 'думает', deck: 'карт в колоде', newGame: 'Новая игра', log: 'Хроника', you: 'Вы', draw: 'Взять карту', secondDraw: 'Взять вторую · конец хода', end: 'Конец хода', auto: 'Разрешить выбор', choose: 'Выбрать', close: 'Нажмите вне карты, чтобы закрыть', ended: 'Партия окончена', won: 'Вы победили', wins: 'побеждает', again: 'Ещё одну', playAfterDraw: 'Сыграйте карту после взятия.', reportBug: 'Сообщить об ошибке', reportTitle: 'Сообщить об ошибке', reportHint: 'К отчёту будет приложена последняя история партии.', reportPlaceholder: 'Что произошло? (необязательно)', send: 'Отправить', cancel: 'Отмена', sent: 'Отчёт отправлен. Спасибо!', failed: 'Не удалось отправить отчёт.' },
  en: { rivals: 'Opponents', start: 'Start local game', intro: 'Everything lives in this browser. No accounts, APIs, or server.', salon: 'Political Salon', yourTurn: 'Your turn', thinking: 'is thinking', deck: 'cards in deck', newGame: 'New game', log: 'Chronicle', you: 'You', draw: 'Draw card', secondDraw: 'Draw second · end turn', end: 'End turn', auto: 'Auto-pick', choose: 'Choose', close: 'Tap outside the card to close', ended: 'Game over', won: 'You win', wins: 'wins', again: 'Play again', playAfterDraw: 'Play a card after drawing.', reportBug: 'Report bug', reportTitle: 'Report a bug', reportHint: 'The recent game history will be attached.', reportPlaceholder: 'What happened? (optional)', send: 'Send report', cancel: 'Cancel', sent: 'Report sent. Thank you!', failed: 'Could not send the report.' },
};
const cardImage = (card, language) => language === 'en' ? card.img?.replace('/cards/', '/cards/eng/') : card.img;
function englishLog(line) {
  const replacements = [
    ['Игра окончена. Победитель:', 'Game over. Winner:'], ['Конец раунда:', 'End of round:'], ['Осталось ходов:', 'Turns remaining:'], ['Старт игры', 'Game started'], ['старт игры', 'game started'], ['игроков:', 'players:'],
    ['Работа на Кремль', 'Working for the Kremlin'], ['Белое пальто', 'White Coat'], ['ИНОАГЕНТ', 'Foreign Agent'], ['Вывод во внешний контур', 'External Circuit'], ['Событие', 'Event'],
    ['Вам выпал', 'You drew'], ['вам выпал', 'you drew'], ['вы вытянули', 'you drew'], ['вытянул', 'drew'], ['взяла', 'drew'], ['взял', 'drew'], ['берет', 'draws'], ['возьмите', 'draw'], ['карту', 'a card'], ['карты', 'cards'], ['карт', 'cards'],
    ['разыграли', 'played'], ['разыграл', 'played'], ['сыграл', 'played'], ['добавил', 'played'], ['использовали', 'used'], ['использовал', 'used'], ['использует', 'uses'], ['способность', 'ability'], ['готов.', 'is ready.'], ['присоединился.', 'joined.'],
    ['сбросил', 'discarded'], ['сбросьте', 'discard'], ['сбрасывает', 'discards'], ['из коалиции', 'from the coalition'], ['в коалицию', 'to the coalition'], ['своей коалиции', 'their coalition'], ['вашей коалиции', 'your coalition'],
    ['выберите', 'choose'], ['персонажа', 'a resident'], ['персону', 'a resident'], ['персоны', 'residents'], ['соперника', 'an opponent'], ['коалиции', 'coalition'], ['правых', 'the right-wing'], ['левых', 'the left-wing'], ['фракцию', 'faction'],
    ['жетонов', 'tokens'], ['жетон', 'token'], ['украл', 'stole'], ['защитил', 'protected'], ['заблокировал', 'blocked'], ['отменил', 'cancelled'],
    ['нет цели', 'no target'], ['нечего сбрасывать', 'nothing to discard'], ['пропуск', 'skipped'], ['ход', 'turn'], ['победитель', 'winner'], ['защищён', 'protected'], ['защищен', 'protected'], ['коалиция', 'coalition'],
  ];
  const translated = replacements.reduce((text, [from, to]) => text.replaceAll(from, to), String(line));
  const letters = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  return translated.replace(/[А-Яа-яЁё]/g, (letter) => {
    const value = letters[letter.toLowerCase()] || '';
    return letter === letter.toUpperCase() ? value.toUpperCase() : value;
  });
}

function Card({ card, language, onClick, onPreview, dim = false }) {
  if (!card) return null;
  const inspectOrPlay = () => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) onPreview?.(card, onClick);
    else onClick?.();
  };
  return <button className={`card ${dim ? 'dim' : ''}`} onClick={inspectOrPlay} title={`${card.name || baseId(card.id)} · ${card.vp ?? 0} VP`}>
    <img src={cardImage(card, language)} alt={card.name || card.id} />
    {card.type === 'persona' && <b className="vp">{card.vp ?? 0}</b>}
    {card.blockedAbilities && <i className="marker">×</i>}
  </button>;
}

function pendingText(pending, language) {
  const copy = language === 'en' ? {
    place_tokens_plus_vp: 'Choose a resident in your coalition for tokens.', action_4_discard: 'Choose a card in your coalition to discard.', action_9_discard_persona: 'Choose an unprotected resident in an opponent coalition.', action_17_choose_opponent_persona: 'Choose an opponent resident.', action_18_pick_persona_from_discard: 'Choose a discarded resident to return to your hand.', persona_23_choose_self_inflict_draw: 'Persona 23: choose −1, −2, or −3 VP tokens, then draw that many cards.', persona_5_pick_liberal: 'Pevchikh: choose an unprotected Liberal in an opponent coalition.', persona_21_pick_target_invert: 'Choose a resident to invert their tokens.', persona_26_pick_red_nationalist: 'Choose a Red Nationalist.', persona_28_pick_non_fbk: 'Choose a non-FBK resident.', persona_37_pick_opponent_persona: 'Choose an opponent resident.', discard_down_to_7: 'Discard from your hand down to 7 cards.',
  } : {
    place_tokens_plus_vp: 'Выберите персонажа в своей коалиции для жетонов.',
    action_4_discard: 'Выберите карту из своей коалиции для сброса.',
    action_9_discard_persona: 'Выберите конкретного незащищённого персонажа в коалиции соперника.',
    action_7_block_persona: 'Выберите персонажа для блокировки.',
    action_13_shield_persona: 'Выберите персонажа для защиты.',
    action_17_choose_opponent_persona: 'Выберите персонажа соперника.',
    action_18_pick_persona_from_discard: 'Выберите персонажа из сброса, чтобы вернуть его в руку.',
    persona_23_choose_self_inflict_draw: 'Персона 23: выберите −1, −2 или −3 жетона VP и возьмите столько же карт.',
    persona_5_pick_liberal: 'Певчих: выберите либерала соперника без защиты «Белого халата».',
    persona_21_pick_target_invert: 'Выберите персонажа: его жетоны поменяются местами.',
    persona_26_pick_red_nationalist: 'Выберите красного националиста.',
    persona_28_pick_non_fbk: 'Выберите не-ФБК персонажа.',
    persona_37_pick_opponent_persona: 'Выберите персонажа соперника.',
    discard_down_to_7: 'Сбросьте карту из руки до лимита 7.',
  };
  return copy[pending?.kind] || (pending ? (language === 'en' ? `Decision needed: ${pending.kind}` : `Нужно решение: ${pending.kind}`) : '');
}

function isPevchihTarget(owner, card) {
  return owner.id !== '0'
    && card.type === 'persona'
    && !card.shielded
    && baseId(card.id) !== 'persona_31'
    && card.tags?.includes('faction:liberal');
}

function isAction9Target(pending, owner, card) {
  return owner.id !== '0'
    && (!pending.targetId || String(owner.id) === String(pending.targetId))
    && card.type === 'persona'
    && !card.shielded
    && baseId(card.id) !== 'persona_31';
}

function ScoreChart({ history = [], players = [] }) {
  const width = 560;
  const height = 235;
  const margin = { top: 14, right: 16, bottom: 34, left: 42 };
  const scores = history.flatMap((entry) => players.map((player) => Number(entry.scores?.[player.id] || 0)));
  const minScore = Math.min(0, ...scores);
  const maxScore = Math.max(1, ...scores);
  const range = Math.max(1, maxScore - minScore);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (index) => margin.left + (history.length < 2 ? plotWidth / 2 : index / (history.length - 1) * plotWidth);
  const y = (value) => margin.top + (maxScore - value) / range * plotHeight;
  const colors = ['#f5cc75', '#68c9c8', '#e97950', '#bc91e4', '#9ec56b'];
  const ticks = Array.from({ length: 5 }, (_, index) => minScore + range * index / 4);

  return <div className="score-chart"><div className="chart-legend">{players.map((player, index) => <span key={player.id}><i style={{ background: colors[index] }} />{player.id === '0' ? 'Вы' : player.name}</span>)}</div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Victory points by turn">
    {ticks.map((value) => <g key={value}><line x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} /><text x={margin.left - 8} y={y(value) + 4}>{Math.round(value)}</text></g>)}
    <line className="chart-axis" x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} />
    {history.map((entry, index) => <text className="chart-turn" key={`${entry.turn}-${index}`} x={x(index)} y={height - 12}>{entry.turn}</text>)}
    {players.map((player, playerIndex) => { const points = history.map((entry, index) => `${x(index)},${y(Number(entry.scores?.[player.id] || 0))}`).join(' '); return <g className="chart-series" key={player.id}><polyline points={points} style={{ stroke: colors[playerIndex] }} />{history.map((entry, index) => <circle key={index} cx={x(index)} cy={y(Number(entry.scores?.[player.id] || 0))} r="3.5" style={{ fill: colors[playerIndex] }}><title>{`${player.name}, ход ${entry.turn}: ${entry.scores?.[player.id] || 0} VP`}</title></circle>)}</g>; })}
    <text className="chart-label" x="13" y={height / 2} transform={`rotate(-90 13 ${height / 2})`}>VP</text><text className="chart-label" x={width / 2} y={height - 1}>ход</text>
  </svg></div>;
}

export default function App() {
  const [bots, setBots] = useState(2);
  const [client, setClient] = useState(null);
  const [state, setState] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const [preview, setPreview] = useState(null);
  const [language, setLanguage] = useState('ru');
  const [bugOpen, setBugOpen] = useState(false);
  const [bugText, setBugText] = useState('');
  const [bugStatus, setBugStatus] = useState('');
  const clientRef = useRef(null);

  const start = () => {
    clientRef.current?.stop?.();
    const next = Client({ game: PolitikumGame, numPlayers: bots + 1, playerID: '0', debug: false });
    next.subscribe((snapshot) => setState(snapshot));
    next.start();
    for (let i = 0; i < bots; i++) next.moves.addBot();
    next.moves.startGame();
    clientRef.current = next;
    setClient(next);
  };

  useEffect(() => () => clientRef.current?.stop?.(), []);
  const G = state?.G;
  const ctx = state?.ctx;
  const me = G?.players?.find((player) => player.id === '0');
  const active = String(ctx?.currentPlayer) === '0';

  useEffect(() => {
    if (!client || !G || active || G.gameOver || G.response) return undefined;
    const timer = setInterval(() => client.moves.tickBot(), 700);
    return () => clearInterval(timer);
  }, [client, G, active]);

  // Keep a visible five-second response window for the three reaction cards.
  // The original MP client delegated this clock to the network UI.
  useEffect(() => {
    if (!client || !G?.response || G.gameOver) return undefined;
    const tick = setInterval(() => setClock(Date.now()), 100);
    const left = Math.max(0, Number(G.response.expiresAtMs || 0) - Date.now());
    const close = setTimeout(() => client.moves.skipResponseWindow(), left + 40);
    return () => { clearInterval(tick); clearTimeout(close); };
  }, [client, G?.response, G?.gameOver]);

  const play = (card) => {
    // Persona responses keep their source ability pending until the window
    // closes; that pending state must not make a valid response card inert.
    if (!client || (G.pending && !G.response)) return;
    const bid = baseId(card.id);
    if (G.response) {
      if (['action_6', 'action_8', 'action_14'].includes(bid)) client.moves.playAction(card.id);
      return;
    }
    if (!active) return;
    if (card.type === 'persona') {
      const target = baseId(card.id) === 'persona_9' ? G.players.find((p) => p.id !== '0' && p.active)?.id : undefined;
      client.moves.playPersona(card.id, undefined, 'right', target);
    } else if (card.type === 'action') {
      if (bid === 'action_9') return client.moves.playAction(card.id);
      const target = G.players.filter((p) => p.id !== '0' && p.active).sort((a, b) => score(b) - score(a))[0]?.id;
      client.moves.playAction(card.id, target);
    }
  };

  const resolveClick = (owner, card) => {
    const pending = G?.pending;
    if (!client || !pending || String(pending.playerId ?? pending.attackerId) !== '0') return;
    const id = card.id;
    if (pending.kind === 'place_tokens_plus_vp' && owner.id === '0') client.moves.applyPendingToken(id);
    else if (pending.kind === 'action_4_discard' && owner.id === '0') client.moves.discardFromCoalition(id);
    else if (pending.kind === 'action_9_discard_persona' && isAction9Target(pending, owner, card)) client.moves.discardFromCoalition(id);
    else if (pending.kind === 'action_7_block_persona') client.moves.blockPersonaForAction7(owner.id, id);
    else if (pending.kind === 'action_13_shield_persona' && owner.id === '0') client.moves.shieldPersonaForAction13(id);
    else if (pending.kind === 'action_17_choose_opponent_persona' && owner.id !== '0') client.moves.applyAction17ToPersona(id);
    else if (pending.kind === 'persona_5_pick_liberal' && isPevchihTarget(owner, card)) client.moves.persona5PickLiberal(owner.id, id);
    else if (pending.kind === 'persona_21_pick_target_invert') client.moves.persona21InvertTokens(owner.id, id);
    else if (pending.kind === 'persona_26_pick_red_nationalist') client.moves.persona26PurgeRedNationalist(owner.id, id);
    else if (pending.kind === 'persona_28_pick_non_fbk') client.moves.persona28StealPlusTokens(owner.id, id, 3);
    else if (pending.kind === 'persona_37_pick_opponent_persona' && owner.id !== '0') client.moves.persona37BribeAndSilence(owner.id, id);
  };

  const resolveFirstChoice = () => {
    const pending = G?.pending;
    if (!client || !pending || String(pending.playerId ?? pending.attackerId) !== '0') return;
    const own = G.players.find((player) => player.id === '0');
    const opponent = G.players.find((player) => player.id !== '0' && player.active);
    const anyCoalition = G.players.flatMap((player) => (player.coalition || []).map((card) => ({ player, card })));
    const first = (items) => items.find(Boolean);
    const call = (name, ...args) => client.moves[name]?.(...args);
    if (pending.kind === 'place_tokens_plus_vp') return call('applyPendingToken', own.coalition[0]?.id);
    if (pending.kind === 'action_4_discard') return call('discardFromCoalition', own.coalition[0]?.id);
    if (pending.kind === 'action_9_discard_persona') { const target = first(anyCoalition.filter(({ player, card }) => isAction9Target(pending, player, card))); return target && call('discardFromCoalition', target.card.id); }
    if (pending.kind === 'action_7_block_persona') { const target = first(anyCoalition); return target && call('blockPersonaForAction7', target.player.id, target.card.id); }
    if (pending.kind === 'action_13_shield_persona') return call('shieldPersonaForAction13', own.coalition[0]?.id);
    if (pending.kind === 'action_17_choose_opponent_persona') return call('applyAction17ToPersona', opponent?.coalition?.[0]?.id);
    if (pending.kind === 'action_18_pick_persona_from_discard') return call('pickPersonaFromDiscardForAction18', G.discard.find((card) => card.type === 'persona')?.id);
    if (pending.kind === 'persona_3_choice') return call('persona3ChooseOption', 'b');
    if (pending.kind === 'persona_5_pick_liberal') { const target = first(anyCoalition.filter(({ player, card }) => isPevchihTarget(player, card))); return target && call('persona5PickLiberal', target.player.id, target.card.id); }
    if (pending.kind === 'persona_7_swap_two_in_coalition') { const host = G.players.find((player) => player.coalition.length > 1); return host && call('persona7SwapTwoInCoalition', host.id, host.coalition[0].id, host.coalition[1].id); }
    if (pending.kind === 'persona_45_steal_from_opponent') return call('persona45StealFromOpponent', opponent?.id);
    if (pending.kind === 'persona_16_discard3_from_hand') { const ids = own.hand.slice(0, 3).map((card) => card.id); return call('persona16Discard3FromHand', ids[0], ids[1], ids[2]); }
    if (pending.kind === 'persona_21_pick_target_invert') { const target = first(anyCoalition); return target && call('persona21InvertTokens', target.player.id, target.card.id); }
    if (pending.kind === 'persona_23_choose_self_inflict_draw') return call('persona23ChooseSelfInflict', 0);
    if (pending.kind === 'persona_26_pick_red_nationalist') { const target = first(anyCoalition.filter(({ card }) => card.tags?.includes('faction:red_nationalist'))); return target && call('persona26PurgeRedNationalist', target.player.id, target.card.id); }
    if (pending.kind === 'persona_28_pick_non_fbk') { const target = first(anyCoalition.filter(({ card }) => !card.tags?.includes('faction:fbk'))); return target && call('persona28StealPlusTokens', target.player.id, target.card.id, 3); }
    if (pending.kind === 'persona_37_pick_opponent_persona') return call('persona37BribeAndSilence', opponent?.id, opponent?.coalition?.[0]?.id);
    if (pending.kind === 'persona_33_choose_faction') return call('persona33ChooseFaction', 'faction:liberal');
    if (pending.kind === 'persona_34_guess_topdeck') return call('persona34GuessTopdeck', 'skip');
    if (pending.kind === 'persona_39_activate') return call('persona39ActivateRecycle');
    if (pending.kind === 'persona_20_pick_from_discard') return call('persona20PickFromDiscard', G.discard[0]?.id);
    if (pending.kind === 'persona_17_pick_opponent') return call('persona17PickOpponent', opponent?.id);
    if (pending.kind === 'persona_17_pick_persona_from_hand') return call('persona17StealPersonaFromHand', opponent?.hand?.find((card) => card.type === 'persona')?.id);
    if (pending.kind === 'persona_11_offer') return call('persona11Skip');
    if (pending.kind === 'persona_11_pick_opponent_persona') return call('persona11DiscardOpponentPersona', opponent?.id, opponent?.coalition?.[0]?.id);
    if (pending.kind === 'persona_32_pick_bounce_target') return call('persona32CancelBounce');
    if (pending.kind === 'persona_13_pick_target' || pending.kind === 'persona_13_skip') return call('persona13Skip');
    if (pending.kind === 'event_12b_discard_from_hand') return call('discardFromHandForEvent12b', own.hand[0]?.id);
    if (pending.kind === 'event_16_discard_self_persona_then_draw1') return call('discardPersonaFromOwnCoalitionForEvent16', own.coalition[0]?.id);
    if (pending.kind === 'discard_down_to_7') return call('discardFromHandDownTo7', own.hand[0]?.id);
  };

  const ui = UI[language];
  const submitBug = async () => {
    setBugStatus('sending');
    try {
      const response = await fetch('/api/bugreport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: bugText, version: BUILD_VERSION, language, url: window.location.href, userAgent: navigator.userAgent, history: (G?.log || []).slice(-30), game: G ? { turn: ctx?.turn, pending: G.pending?.kind || null, response: G.response?.kind || null, deck: G.deck?.length || 0 } : null }) });
      if (!response.ok) throw new Error('Bug report request failed');
      setBugStatus('sent');
      setBugText('');
    } catch { setBugStatus('failed'); }
  };
  if (!client) return <main className="welcome"><div><p>Politikum · solo</p><h1>{language === 'en' ? 'Politics without a server' : 'Политика без сервера'}</h1><div className="language"><button className={language === 'ru' ? 'picked' : ''} onClick={() => setLanguage('ru')}>Русский</button><button className={language === 'en' ? 'picked' : ''} onClick={() => setLanguage('en')}>English</button></div><span>{ui.rivals}</span><div className="picker">{[1, 2, 3, 4].map((n) => <button className={bots === n ? 'picked' : ''} onClick={() => setBots(n)} key={n}>{n}</button>)}</div><button className="start" onClick={start}>{ui.start}</button><small>{ui.intro}</small></div></main>;

  if (!G) return <main className="welcome"><div>Загрузка колоды…</div></main>;
  const winner = G.gameOver ? [...G.players].filter((p) => p.active).sort((a, b) => score(b) - score(a))[0] : null;
  const responseSeconds = G.response ? Math.max(0, Math.ceil((Number(G.response.expiresAtMs || 0) - clock) / 1000)) : 0;
  const canAnswerResponse = G.response && String(G.response.playedBy) !== '0';
  const responseCards = new Set(canAnswerResponse ? (G.response.kind === 'cancel_action' ? ['action_6', 'action_14'] : G.response.kind === 'cancel_persona' ? ['action_8'] : []) : []);
  return <main className="app">
    <header><div><p>POLITIKUM · SOLO</p><h1>{ui.salon}</h1><small className="version">#{BUILD_VERSION}</small></div><div className="turn"><b>{active ? ui.yourTurn : `${G.players.find((p) => p.id === String(ctx?.currentPlayer))?.name || 'Bot'} ${ui.thinking}`}</b><small>{G.deck.length} {ui.deck}</small></div><div className="header-actions"><button className="report-button" onClick={() => { setBugStatus(''); setBugOpen(true); }}>{ui.reportBug}</button><button onClick={start}>{ui.newGame}</button></div></header>
    {G.pending && <div className="prompt">{pendingText(G.pending, language)}</div>}
    {G.response && canAnswerResponse && <div className="prompt response">{language === 'en' ? `Response: ${responseSeconds}s · play ${G.response.kind === 'cancel_action' ? 'Volunteering or another action-cancel card' : 'Working for the Kremlin'}.` : `Ответ: ${responseSeconds}с · сыграйте ${G.response.kind === 'cancel_action' ? '«Волонтёрство» или карту отмены действия' : '«Работа на Кремль»'}.`}</div>}
    {G.response?.persona8Swap?.playerId === '0' && <button className="persona8-response" onClick={() => client.moves.persona8SwapWithPlayedPersona()}>{language === 'en' ? `Swap Persona 8 for ${G.response.personaCard?.name || 'the played resident'}` : `Поменять Персону 8 на ${G.response.personaCard?.name || 'сыгранного персонажа'}`}</button>}
    <section className="table">
      <aside className="log"><b>{ui.log}</b>{[...G.log].slice(-40).reverse().map((line, index) => <small key={`${index}-${line}`}>{language === 'en' ? englishLog(line) : line}</small>)}</aside>
      <section className="coalitions">{G.players.filter((p) => p.active).map((player) => {
        const selectingPevchih = G.pending?.kind === 'persona_5_pick_liberal' && String(G.pending.playerId) === '0';
        const selectingAction9 = G.pending?.kind === 'action_9_discard_persona' && String(G.pending.playerId) === '0';
        const visibleCards = selectingPevchih ? player.coalition.filter((card) => isPevchihTarget(player, card)) : selectingAction9 ? player.coalition.filter((card) => isAction9Target(G.pending, player, card)) : player.coalition;
        return <article className={player.id === '0' ? 'player human' : 'player'} key={player.id}><div className="player-head"><b>{player.id === '0' ? ui.you : player.name}</b><strong>{score(player)} VP</strong></div><div className="coalition">{visibleCards.map((card) => <Card card={card} language={language} key={card.id} onClick={() => resolveClick(player, card)} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></article>;
      })}</section>
      <aside className="controls"><button disabled={!active || !!G.pending || !!G.response || G.hasPlayed || Number(G.drawsThisTurn || 0) >= 2} onClick={() => client.moves.drawCard()}>{Number(G.drawsThisTurn || 0) === 1 ? ui.secondDraw : ui.draw}</button><button disabled={!active || !!G.pending || !!G.response || !G.hasDrawn || !G.hasPlayed} onClick={() => client.moves.endTurn()}>{ui.end}</button>{G.pending && String(G.pending.playerId ?? G.pending.attackerId) === '0' && <button className="resolve" onClick={resolveFirstChoice}>{ui.auto}</button>}<small>{G.response ? `Окно ответа: ${responseSeconds}с` : ui.playAfterDraw}</small></aside>
    </section>
    {G.pending?.kind === 'action_18_pick_persona_from_discard' && String(G.pending.attackerId) === '0' && <section className="discard-picker"><b>{language === 'en' ? 'Choose a discarded resident' : 'Выберите персонажа из сброса'}</b><div className="fan">{G.discard.filter((card) => card.type === 'persona').map((card) => <Card card={card} language={language} key={card.id} onClick={() => client.moves.pickPersonaFromDiscardForAction18(card.id)} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></section>}
    {G.pending?.kind === 'persona_23_choose_self_inflict_draw' && String(G.pending.playerId) === '0' && <section className="persona23-choice"><b>{language === 'en' ? 'Persona 23 — choose the cost' : 'Персона 23 — выберите цену'}</b><div>{[1, 2, 3].map((n) => <button key={n} disabled={n > 3 - Number(G.pending.taken || 0)} onClick={() => client.moves.persona23ChooseSelfInflict(n)}>{language === 'en' ? `−${n} VP · draw ${n}` : `−${n} VP · взять ${n}`}</button>)}</div></section>}
    <section className="hand"><div className="fan">{me?.hand?.map((card) => { const canRespond = responseCards.has(baseId(card.id)); return <Card card={card} language={language} key={card.id} dim={G.response ? !canRespond : (!active || !!G.pending)} onClick={() => G.pending?.kind === 'discard_down_to_7' ? client.moves.discardFromHandDownTo7(card.id) : play(card)} onPreview={(picked, action) => setPreview({ card: picked, action })} />; })}</div></section>
    {bugOpen && <div className="bug-modal" onClick={() => bugStatus !== 'sending' && setBugOpen(false)}><form onSubmit={(event) => { event.preventDefault(); submitBug(); }} onClick={(event) => event.stopPropagation()}><h2>{ui.reportTitle}</h2><p>{ui.reportHint}</p><textarea autoFocus value={bugText} onChange={(event) => setBugText(event.target.value)} placeholder={ui.reportPlaceholder} maxLength="1200" />{bugStatus === 'sent' ? <strong className="bug-success">{ui.sent}</strong> : bugStatus === 'failed' ? <strong className="bug-failed">{ui.failed}</strong> : null}<div><button type="button" onClick={() => setBugOpen(false)} disabled={bugStatus === 'sending'}>{ui.cancel}</button><button className="start" type="submit" disabled={bugStatus === 'sending'}>{ui.send}</button></div></form></div>}
    {preview && <div className="card-preview" onClick={() => setPreview(null)}><div className="preview-card" onClick={(event) => event.stopPropagation()}><img src={cardImage(preview.card, language)} alt={preview.card.name || preview.card.id} /><button onClick={() => { preview.action?.(); setPreview(null); }}>{ui.choose}</button><small>{ui.close}</small></div></div>}
    {winner && <div className="ending"><div><p>{ui.ended}</p><h2>{winner.id === '0' ? ui.won : `${winner.name} ${ui.wins}`}</h2><strong>{score(winner)} VP</strong><ScoreChart history={G.history} players={G.players.filter((player) => player.active)} /><button onClick={start}>{ui.again}</button></div></div>}
  </main>;
}
