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
    persona_21_pick_target_invert: 'Выберите персонажа: его жетоны поменяются местами.',
    persona_26_pick_red_nationalist: 'Выберите красного националиста.',
    persona_28_pick_non_fbk: 'Выберите не-ФБК персонажа.',
    persona_37_pick_opponent_persona: 'Выберите персонажа соперника.',
    discard_down_to_7: 'Сбросьте карту из руки до лимита 7.',
  };
  return copy[pending?.kind] || (pending ? `Нужно решение: ${pending.kind}` : '');
}

export default function App() {
  const [bots, setBots] = useState(2);
  const [client, setClient] = useState(null);
  const [state, setState] = useState(null);
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
    if (!client || !G || active || G.gameOver || G.pending || G.response) return undefined;
    const timer = setInterval(() => client.moves.tickBot(), 700);
    return () => clearInterval(timer);
  }, [client, G, active]);

  const play = (card) => {
    if (!client || !active || G.pending || G.response) return;
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
    else if (pending.kind === 'persona_21_pick_target_invert') client.moves.persona21InvertTokens(owner.id, id);
    else if (pending.kind === 'persona_26_pick_red_nationalist') client.moves.persona26PurgeRedNationalist(owner.id, id);
    else if (pending.kind === 'persona_28_pick_non_fbk') client.moves.persona28StealPlusTokens(owner.id, id, 3);
    else if (pending.kind === 'persona_37_pick_opponent_persona' && owner.id !== '0') client.moves.persona37BribeAndSilence(owner.id, id);
  };

  if (!client) return <main className="welcome"><div><p>Politikum · solo</p><h1>Политика без сервера</h1><span>Соперники</span><div className="picker">{[1, 2, 3, 4].map((n) => <button className={bots === n ? 'picked' : ''} onClick={() => setBots(n)} key={n}>{n}</button>)}</div><button className="start" onClick={start}>Начать локальную игру</button><small>Всё состояние живёт в браузере. Никаких аккаунтов, API или сервера.</small></div></main>;

  if (!G) return <main className="welcome"><div>Загрузка колоды…</div></main>;
  const winner = G.gameOver ? [...G.players].filter((p) => p.active).sort((a, b) => score(b) - score(a))[0] : null;
  return <main className="app">
    <header><div><p>POLITIKUM · SOLO</p><h1>Политический салон</h1></div><div className="turn"><b>{active ? 'Ваш ход' : `${G.players.find((p) => p.id === String(ctx?.currentPlayer))?.name || 'Бот'} думает`}</b><small>{G.deck.length} карт в колоде</small></div><button onClick={start}>Новая игра</button></header>
    {G.pending && <div className="prompt">{pendingText(G.pending)}</div>}
    <section className="table">
      <aside className="log"><b>Хроника</b>{[...G.log].slice(-40).reverse().map((line, index) => <small key={`${index}-${line}`}>{line}</small>)}</aside>
      <section className="coalitions">{G.players.filter((p) => p.active).map((player) => <article className={player.id === '0' ? 'player human' : 'player'} key={player.id}><div className="player-head"><b>{player.id === '0' ? 'Вы' : player.name}</b><strong>{score(player)} VP</strong></div><div className="coalition">{player.coalition.map((card) => <Card card={card} key={card.id} onClick={() => resolveClick(player, card)} />)}</div></article>)}</section>
      <aside className="controls"><button disabled={!active || !!G.pending || !!G.response || G.hasDrawn} onClick={() => client.moves.drawCard()}>Взять карту</button><button disabled={!active || !!G.pending || !!G.response || !G.hasDrawn || !G.hasPlayed} onClick={() => client.moves.endTurn()}>Конец хода</button><small>{G.response ? 'Окно ответа: ждём…' : 'Сыграйте карту после взятия.'}</small></aside>
    </section>
    <section className="hand"><div><b>Ваша рука</b><small>{me?.hand?.length || 0} карт</small></div><div className="fan">{me?.hand?.map((card) => <Card card={card} key={card.id} dim={!active || !!G.pending || !!G.response} onClick={() => G.pending?.kind === 'discard_down_to_7' ? client.moves.discardFromHandDownTo7(card.id) : play(card)} />)}</div></section>
    {winner && <div className="ending"><div><p>Партия окончена</p><h2>{winner.id === '0' ? 'Вы победили' : `${winner.name} побеждает`}</h2><strong>{score(winner)} VP</strong><button onClick={start}>Ещё одну</button></div></div>}
  </main>;
}
