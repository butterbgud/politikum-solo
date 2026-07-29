import { useEffect, useMemo, useRef, useState } from 'react';
import { Client } from 'boardgame.io/client';
import { PolitikumGame } from './engine/game.js';

const BOT_NAMES = ['Гертруда', 'Ульрих', 'Ингеборга', 'Тибальт'];
const baseId = (id) => String(id || '').split('#')[0];
const score = (player) => (player?.coalition || []).reduce((sum, card) => sum + Number(card.vp || 0), 0);

function Card({ card, onClick, dim = false }) {
  if (!card) return null;
  return <button className={`card ${dim ? 'dim' : ''}`} onClick={onClick} title={`${card.name || baseId(card.id)} · ${card.vp ?? 0} VP`}>
    <img src={card.img} alt={card.name || card.id} />
    {card.type === 'persona' && <b className="vp">{card.vp ?? 0}</b>}
    {card.blockedAbilities && <i className="marker">×</i>}
  </button>;
}

function pendingText(pending) {
  const copy = {
    place_tokens_plus_vp: 'Выберите персонажа в своей коалиции для жетонов.',
    action_4_discard: 'Выберите карту из своей коалиции для сброса.',
    action_9_discard_persona: 'Выберите персонажа в своей коалиции для сброса.',
    action_7_block_persona: 'Выберите персонажа для блокировки.',
    action_13_shield_persona: 'Выберите персонажа для защиты.',
    action_17_choose_opponent_persona: 'Выберите персонажа соперника.',
    persona_5_pick_liberal: 'Певчих: выберите либерала соперника без защиты «Белого халата».',
    persona_21_pick_target_invert: 'Выберите персонажа: его жетоны поменяются местами.',
    persona_26_pick_red_nationalist: 'Выберите красного националиста.',
    persona_28_pick_non_fbk: 'Выберите не-ФБК персонажа.',
    persona_37_pick_opponent_persona: 'Выберите персонажа соперника.',
    discard_down_to_7: 'Сбросьте карту из руки до лимита 7.',
  };
  return copy[pending?.kind] || (pending ? `Нужно решение: ${pending.kind}` : '');
}

function isPevchihTarget(owner, card) {
  return owner.id !== '0'
    && card.type === 'persona'
    && !card.shielded
    && baseId(card.id) !== 'persona_31'
    && card.tags?.includes('faction:liberal');
}

export default function App() {
  const [bots, setBots] = useState(2);
  const [client, setClient] = useState(null);
  const [state, setState] = useState(null);
  const [clock, setClock] = useState(Date.now());
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
    if (!client || G.pending) return;
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
      const target = G.players.filter((p) => p.id !== '0' && p.active).sort((a, b) => score(b) - score(a))[0]?.id;
      client.moves.playAction(card.id, target);
    }
  };

  const resolveClick = (owner, card) => {
    const pending = G?.pending;
    if (!client || !pending || String(pending.playerId) !== '0') return;
    const id = card.id;
    if (pending.kind === 'place_tokens_plus_vp' && owner.id === '0') client.moves.applyPendingToken(id);
    else if (pending.kind === 'action_4_discard' && owner.id === '0') client.moves.discardFromCoalition(id);
    else if (pending.kind === 'action_9_discard_persona' && owner.id === '0') client.moves.discardFromCoalition(id);
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
    if (!client || !pending || String(pending.playerId) !== '0') return;
    const own = G.players.find((player) => player.id === '0');
    const opponent = G.players.find((player) => player.id !== '0' && player.active);
    const anyCoalition = G.players.flatMap((player) => (player.coalition || []).map((card) => ({ player, card })));
    const first = (items) => items.find(Boolean);
    const call = (name, ...args) => client.moves[name]?.(...args);
    if (pending.kind === 'place_tokens_plus_vp') return call('applyPendingToken', own.coalition[0]?.id);
    if (pending.kind === 'action_4_discard') return call('discardFromCoalition', own.coalition[0]?.id);
    if (pending.kind === 'action_9_discard_persona') return call('discardFromCoalition', own.coalition[0]?.id);
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

  if (!client) return <main className="welcome"><div><p>Politikum · solo</p><h1>Политика без сервера</h1><span>Соперники</span><div className="picker">{[1, 2, 3, 4].map((n) => <button className={bots === n ? 'picked' : ''} onClick={() => setBots(n)} key={n}>{n}</button>)}</div><button className="start" onClick={start}>Начать локальную игру</button><small>Всё состояние живёт в браузере. Никаких аккаунтов, API или сервера.</small></div></main>;

  if (!G) return <main className="welcome"><div>Загрузка колоды…</div></main>;
  const winner = G.gameOver ? [...G.players].filter((p) => p.active).sort((a, b) => score(b) - score(a))[0] : null;
  const responseSeconds = G.response ? Math.max(0, Math.ceil((Number(G.response.expiresAtMs || 0) - clock) / 1000)) : 0;
  const responseCards = new Set(G.response?.kind === 'cancel_action' ? ['action_6', 'action_14'] : G.response?.kind === 'cancel_persona' ? ['action_8'] : []);
  return <main className="app">
    <header><div><p>POLITIKUM · SOLO</p><h1>Политический салон</h1></div><div className="turn"><b>{active ? 'Ваш ход' : `${G.players.find((p) => p.id === String(ctx?.currentPlayer))?.name || 'Бот'} думает`}</b><small>{G.deck.length} карт в колоде</small></div><button onClick={start}>Новая игра</button></header>
    {G.pending && <div className="prompt">{pendingText(G.pending)}</div>}
    {G.response && <div className="prompt response">Ответ: {responseSeconds}с · сыграйте {G.response.kind === 'cancel_action' ? '«Волонтёрство» или карту отмены действия' : '«Работа на Кремль»'}.</div>}
    <section className="table">
      <aside className="log"><b>Хроника</b>{[...G.log].slice(-40).reverse().map((line, index) => <small key={`${index}-${line}`}>{line}</small>)}</aside>
      <section className="coalitions">{G.players.filter((p) => p.active).map((player) => {
        const selectingPevchih = G.pending?.kind === 'persona_5_pick_liberal' && String(G.pending.playerId) === '0';
        const visibleCards = selectingPevchih ? player.coalition.filter((card) => isPevchihTarget(player, card)) : player.coalition;
        return <article className={player.id === '0' ? 'player human' : 'player'} key={player.id}><div className="player-head"><b>{player.id === '0' ? 'Вы' : player.name}</b><strong>{score(player)} VP</strong></div><div className="coalition">{visibleCards.map((card) => <Card card={card} key={card.id} onClick={() => resolveClick(player, card)} />)}</div></article>;
      })}</section>
      <aside className="controls"><button disabled={!active || !!G.pending || !!G.response || G.hasDrawn} onClick={() => client.moves.drawCard()}>Взять карту</button><button disabled={!active || !!G.pending || !!G.response || !G.hasDrawn || !G.hasPlayed} onClick={() => client.moves.endTurn()}>Конец хода</button>{G.pending && String(G.pending.playerId) === '0' && <button className="resolve" onClick={resolveFirstChoice}>Разрешить выбор</button>}<small>{G.response ? `Окно ответа: ${responseSeconds}с` : 'Сыграйте карту после взятия.'}</small></aside>
    </section>
    <section className="hand"><div><b>Ваша рука</b><small>{me?.hand?.length || 0} карт</small></div><div className="fan">{me?.hand?.map((card) => { const canRespond = responseCards.has(baseId(card.id)); return <Card card={card} key={card.id} dim={G.response ? !canRespond : (!active || !!G.pending)} onClick={() => G.pending?.kind === 'discard_down_to_7' ? client.moves.discardFromHandDownTo7(card.id) : play(card)} />; })}</div></section>
    {winner && <div className="ending"><div><p>Партия окончена</p><h2>{winner.id === '0' ? 'Вы победили' : `${winner.name} побеждает`}</h2><strong>{score(winner)} VP</strong><button onClick={start}>Ещё одну</button></div></div>}
  </main>;
}
