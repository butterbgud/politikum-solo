import { INVALID_MOVE } from 'boardgame.io/dist/cjs/core.js';
import { POLITIKUM_CARDS } from './politikum/cards';
import { runAbility } from './politikum/abilities';

export type PolitikumCardType = 'persona' | 'event' | 'action';

export type PolitikumCard = {
  id: string;
  type: PolitikumCardType;
  img?: string;
  name?: string;

  // Scoring
  baseVp?: number; // printed VP
  vp?: number; // current VP (base + token deltas + passive deltas)
  vpDelta?: number; // token delta (e.g. +1/-1 tokens)
  plusTokens?: number; // visible positive token count
  minusTokens?: number; // visible negative token count
  passiveVpDelta?: number; // computed delta (e.g. per-male penalty)

  tags?: string[]; // faction/traits, copied from cards.yaml

  // status markers applied by certain actions (MVP: minimal flags)
  blockedAbilities?: boolean; // action_7: this persona's abilities are disabled
  shielded?: boolean; // action_13: cannot be targeted; +1 gains reduced by 1
  shieldedBy?: string | null; // action_13 card id (instance)

  // ability wiring (from cards.yaml)
  abilityKey?: string;
  params?: Record<string, any>;
};

export type PolitikumPlayer = {
  id: string;
  name: string;
  hand: PolitikumCard[];
  coalition: PolitikumCard[];

  // Lobby wiring (Citadel MP style)
  isBot?: boolean;
  active?: boolean; // if false, this seat is ignored by turn order
};

export type PolitikumState = {
  players: PolitikumPlayer[];
  deck: PolitikumCard[];
  discard: PolitikumCard[];

  // Deck parts kept during lobby (startGame will deal + combine into deck)
  preDealDeck?: PolitikumCard[];
  eventDeck?: PolitikumCard[];

  // Selected seats to rotate turns through (set at startGame)
  activePlayerIds?: string[];

  log: string[];
  chat?: Array<{ sender: string; text: string }>;
  gameOver?: boolean;
  winnerId?: string | null;
  winnerIds?: string[];
  isDraw?: boolean;
  victoryReason?: 'milov_prediction' | null;
  responseTimeSeconds?: 5 | 10;
  handRevealPlayerId?: string | null;
  handRevealUntilMs?: number | null;
  debugTrace?: Array<{ at: number; event: string; details?: Record<string, any> }>;

  // round-end handling: once someone reaches 7 coalition, finish the round
  roundEnding?: boolean;
  roundEndTurn?: number | null; // ctx.turn at which the game should end (after the last player finishes)

  // score history for charts
  history?: Array<{ turn: number; scores: Record<string, number> }>;

  // pending interaction (for action cards & persona abilities)
  pending?:
    | { kind: 'action_4_discard'; attackerId: string; targetId: string; sourceCardId: string }
    | { kind: 'action_4_discard_cost'; playerId: string; sourceCardId: string }
    | { kind: 'action_4_choose_target'; playerId: string; sourceCardId: string; costCardId: string }
    | { kind: 'action_9_discard_persona'; attackerId: string; playerId: string; targetId: string; sourceCardId: string }
    | { kind: 'action_7_block_persona'; attackerId: string }
    | { kind: 'action_13_shield_persona'; attackerId: string }
    | { kind: 'action_17_choose_opponent_persona'; attackerId: string }
    | { kind: 'action_18_pick_persona_from_discard'; attackerId: string }
    | { kind: 'place_tokens_plus_vp'; playerId: string; remaining: number; delta: number; sourceCardId: string; targetCardId?: string }
    | { kind: 'discard_one_persona_from_any_coalition'; playerId: string; sourceCardId: string }
    | { kind: 'persona_3_choice'; playerId: string; sourceCardId: string }
    | { kind: 'persona_5_pick_liberal'; playerId: string; sourceCardId: string }
    | { kind: 'persona_7_swap_two_in_coalition'; playerId: string; sourceCardId: string }
    | { kind: 'persona_45_steal_from_opponent'; playerId: string; sourceCardId: string }
    | { kind: 'persona_16_discard3_from_hand'; playerId: string; sourceCardId: string }
    | { kind: 'persona_21_pick_target_invert'; playerId: string; sourceCardId: string }
    | { kind: 'persona_23_choose_self_inflict_draw'; playerId: string; sourceCardId: string; taken?: number }
    | { kind: 'persona_26_pick_red_nationalist'; playerId: string; sourceCardId: string }
    | { kind: 'persona_28_pick_non_fbk'; playerId: string; sourceCardId: string }
    | { kind: 'persona_37_pick_opponent_persona'; playerId: string; sourceCardId: string }
    | { kind: 'persona_33_choose_faction'; playerId: string; sourceCardId: string }
    | { kind: 'persona_34_guess_topdeck'; playerId: string; sourceCardId: string }
    | { kind: 'persona_39_activate'; playerId: string; sourceCardId: string }
    | { kind: 'persona_20_pick_from_discard'; playerId: string; sourceCardId: string }
    | { kind: 'persona_17_pick_opponent'; playerId: string; sourceCardId: string }
    | { kind: 'persona_17_pick_persona_from_hand'; playerId: string; sourceCardId: string; targetId: string }
    | { kind: 'persona_11_offer'; playerId: string; sourceCardId: string }
    | { kind: 'persona_11_pick_opponent_persona'; playerId: string; sourceCardId: string }
    | { kind: 'persona_32_pick_bounce_target'; playerId: string; sourceCardId: string; cancellable?: boolean }
    | { kind: 'resolve_persona_after_response'; playerId: string; sourceCardId: string; personaId: string; abilityKey?: string }
    | { kind: 'persona_13_pick_target'; playerId: string; attackerId: string; sourceCardId: string }
    | { kind: 'persona_13_skip'; playerId: string; sourceCardId: string }
    | { kind: 'event_12b_discard_from_hand'; playerId: string; sourceCardId: string; targetIds: string[] }
    | { kind: 'event_16_discard_self_persona_then_draw1'; playerId: string; sourceCardId: string }
    | { kind: 'discard_down_to_7'; playerId: string; sourceCardId: string }
    | null;

  // response windows (out-of-turn cancels)
  response?:
    | {
        kind: 'cancel_action';
        playedBy: string;
        actionCard: PolitikumCard;
        expiresAtMs: number;
      }
    | {
        kind: 'cancel_persona';
        playedBy: string;
        personaCard: PolitikumCard;
        expiresAtMs: number;
      }
    | {
        kind: 'cancel_persona_ability';
        playedBy: string;
        expiresAtMs: number;
      }
    | null;

  // bot pacing
  botNextActAtMs?: number | null;
  botPauseUntilMs?: number | null; // global pause (prevents bot chaining across seats)

  // transient UI hints (auto-hide in UI)
  lastEvent?: PolitikumCard | null;
  lastAction?: PolitikumCard | null;
  lastEventSkipped?: { cardId: string; title: string; reason: string } | null;

  // turn flags
  hasDrawn: boolean;
  hasPlayed: boolean;

  // per-turn play limits (used by action_5)
  playsThisTurn?: number;
  maxPlaysThisTurn?: number;
  playVpDelta?: number; // applied to each persona played this turn

  // draw options
  drawsThisTurn?: number; // normally 1; can draw a 2nd instead of playing
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// mkCard removed (cards now sourced from cards.yaml)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(deck: PolitikumCard[], players: PolitikumPlayer[], n: number) {
  const d = [...deck];
  const ps = players.map((p) => ({ ...p, hand: [...p.hand], coalition: [...p.coalition] }));
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < ps.length; i++) {
      const c = d.shift();
      if (!c) break;
      ps[i].hand.push(c);
    }
  }
  return { deck: d, players: ps };
}


function materializeCopies(defs: { id: string; type: PolitikumCardType; vp?: number; count?: number; text?: string; abilityKey?: string; params?: Record<string, any>; tags?: string[] }[]) {
  const out: PolitikumCard[] = [];
  for (const d of defs) {
    const c = Math.max(1, Number(d.count || 1));
    for (let i = 1; i <= c; i++) {
      const instId = c === 1 ? d.id : `${d.id}#${i}`;
      const baseVp = d.vp ?? (d.type === 'event' ? 0 : 1);
      out.push({
        id: instId,
        type: d.type,
        img: `/cards/${d.id}.webp`,
        name: d.text || d.id,
        baseVp,
        vp: baseVp,
        vpDelta: 0,
        passiveVpDelta: 0,
        tags: (d as any).tags,
        abilityKey: d.abilityKey,
        params: d.params,
      });
    }
  }
  return out;
}

function baseId(instId: string) {
  return String(instId || '').split('#')[0];
}

function scorePlayer(pp: any) {
  return (pp.coalition || []).reduce((s: number, c: any) => s + Number(c.vp ?? (c.baseVp || 0)), 0);
}

function action4BotDiscardIndex(player: any) {
  const coalition: any[] = Array.isArray(player?.coalition) ? player.coalition : [];
  const eligible = coalition
    .map((card: any, index: number) => ({ card, index }))
    .filter(({ card }) => card?.type === 'persona' && baseId(String(card.id)) !== 'persona_31' && !card.shielded);
  if (!eligible.length) return -1;

  const heldOrCoalition = new Set<string>([
    ...coalition,
    ...(Array.isArray(player?.hand) ? player.hand : []),
  ].map((card: any) => baseId(String(card?.id || ''))));
  const hasTrioCombo = (bid: string) => {
    if (!LEFT_BONUS_PERSONAS.has(bid)) return false;
    return [...LEFT_BONUS_PERSONAS].some((other) => other !== bid && heldOrCoalition.has(other));
  };
  const hasKagalitskyCombo = () => (player?.hand || []).some((card: any) => baseId(String(card?.id || '')) === 'action_7');
  const comboProtection = (card: any) => {
    const bid = baseId(String(card?.id || ''));
    if (hasTrioCombo(bid)) return 1000;
    if (bid === 'persona_36' && hasKagalitskyCombo()) return 1000;
    return 0;
  };

  eligible.sort((a, b) => {
    const protectedDelta = comboProtection(a.card) - comboProtection(b.card);
    if (protectedDelta) return protectedDelta;
    return Number(a.card.vp ?? a.card.baseVp ?? 0) - Number(b.card.vp ?? b.card.baseVp ?? 0);
  });
  return eligible[0].index;
}

function clearDetachedPersonaTokens(card: any) {
  if (!card || card.type !== 'persona') return;
  card.vpDelta = 0;
  card.plusTokens = 0;
  card.minusTokens = 0;
  card.passiveVpDelta = 0;
  card.vp = Number(card.baseVp ?? 0);
}

function recalcPassives(G: PolitikumState) {
  const allPlayers = (G.players || []);

  // Tokens belong to a persona only while it is in a coalition. This also
  // cleans up legacy state when a card is discarded or returned to a hand.
  for (const p of allPlayers) for (const card of (p.hand || [])) clearDetachedPersonaTokens(card);
  for (const card of (G.discard || [])) clearDetachedPersonaTokens(card);

  const countLeftwing = (cards: any[]) => (cards || []).filter((c: any) => c.type === 'persona' && Array.isArray(c.tags) && c.tags.includes('faction:leftwing')).length;

  for (const p of allPlayers) {
    const coal = (p.coalition || []);
    const males = coal.filter((c: any) => (c.type === 'persona') && Array.isArray(c.tags) && c.tags.includes('gender:m')).length;
    const nonLeftwing = coal.filter((c: any) => (c.type === 'persona') && (!Array.isArray(c.tags) || !c.tags.includes('faction:leftwing'))).length;

    const myLeft = countLeftwing(coal);
    const otherLeft = allPlayers
      .filter((pp: any) => String(pp.id) != String(p.id))
      .reduce((s: number, pp: any) => s + countLeftwing(pp.coalition || []), 0);

    for (let i = 0; i < coal.length; i++) {
      const c: any = coal[i];
      if (c.type !== 'persona') continue;

      const bid = baseId(c.id);

      // reset every recalc to avoid stale passiveVpDelta on cards that used to have passives
      c.passiveVpDelta = 0;

      // action_7 / persona_37: if abilities are blocked, also disable passives
      if (c.blockedAbilities) {
        const base = Number(c.baseVp ?? 0);
        const tok = Number(c.vpDelta ?? 0);
        c.vp = base + tok;
        continue;
      }

      // p2: -1 per OTHER male in your coalition (exclude itself)
      if (bid === 'persona_2') {
        const selfMale = (c.type === 'persona') && Array.isArray(c.tags) && c.tags.includes('gender:m');
        c.passiveVpDelta = -(males - (selfMale ? 1 : 0));
      }

      // p25: +1 per persona to his left
      if (bid === 'persona_25') {
        const leftCount = coal.slice(0, i).filter((x: any) => x.type === 'persona').length;
        c.passiveVpDelta = leftCount;
      }

      // p27: -1 per (distinct) faction in YOUR coalition, excluding leftwing.
      // i.e. only count factions that differ from leftwing among personas currently in your coalition.
      if (bid === 'persona_27') {
        const factions = new Set<string>();
        for (const cc of (coal || [])) {
          if (!cc || cc.type !== 'persona') continue;
          const tags: any[] = Array.isArray((cc as any).tags) ? (cc as any).tags : [];
          const f = tags.find((t) => typeof t === 'string' && t.startsWith('faction:'));
          if (!f) continue;
          if (f === 'faction:leftwing') continue;
          factions.add(String(f));
        }
        c.passiveVpDelta = -factions.size;
      }

      // p24: +1 per leftwing in other coalitions; -1 per leftwing in your coalition
      if (bid === 'persona_24') {
        c.passiveVpDelta = otherLeft - myLeft;
      }

      // p33: chosen faction scaler (+1 per persona with chosen faction in your coalition, incl itself)
      if (bid === 'persona_33') {
        const chosen = String((c as any).chosenFactionTag || '');
        if (chosen) {
          const cnt = (coal || []).filter((x: any) => x === c || (x.type === 'persona' && Array.isArray(x.tags) && x.tags.includes(chosen))).length;
          c.passiveVpDelta = cnt;
        }
      }

      // p18: -3 VP for each adjacent FBK persona
      if (bid === 'persona_18') {
        const left = i > 0 ? coal[i - 1] : null;
        const right = (i < coal.length - 1) ? coal[i + 1] : null;
        const isFbk = (x: any) => x && x.type === 'persona' && Array.isArray(x.tags) && x.tags.includes('faction:fbk');
        const adj = (isFbk(left) ? 1 : 0) + (isFbk(right) ? 1 : 0);
        c.passiveVpDelta = -3 * adj;
      }

      const base = Number(c.baseVp ?? 0);
      const tok = Number(c.vpDelta ?? 0);
      const pas = Number(c.passiveVpDelta ?? 0);
      c.vp = base + tok + pas;
    }
  }
}

function applyTokenDelta(G: PolitikumState, card: any, delta: number, _fromP15Mirror = false) {
  // persona_43: whenever it would gain N × +1, it gains (N-1) instead (min 0)
  try {
    if (delta > 0 && baseId(String(card?.id || '')) === 'persona_43') {
      delta = Math.max(0, delta - 1);
    }
  } catch {}

  const prevPlus = Number((card as any).plusTokens ?? Math.max(0, Number(card.vpDelta || 0)));
  const prevMinus = Number((card as any).minusTokens ?? Math.max(0, -Number(card.vpDelta || 0)));
  let plus = prevPlus;
  let minus = prevMinus;
  if (delta > 0) plus += delta;
  if (delta < 0) minus += Math.abs(delta);
  (card as any).plusTokens = plus;
  (card as any).minusTokens = minus;
  card.vpDelta = plus - minus;
  const base = Number(card.baseVp ?? 0);
  const tok = Number(card.vpDelta ?? 0);
  const pas = Number(card.passiveVpDelta ?? 0);
  card.vp = base + tok + pas;

  // persona_15: whenever any persona_22 gains +1/-1 tokens, each persona_15 gains the same type +1 extra.
  // (+N => +(N+1); -N => -(N+1))
  try {
    if (!_fromP15Mirror && delta !== 0 && baseId(String(card?.id || '')) === 'persona_22') {
      const extra = delta > 0 ? 1 : -1;
      const give = delta + extra;
      const turnN = Number((G as any).turnN || 0);
      for (const pp of (G.players || [])) {
        for (const cc of (pp.coalition || [])) {
          if (baseId(String(cc.id)) !== 'persona_15') continue;
          // p15 should only start mirroring after it has been on the table for at least 1 full turn.
          // This prevents “instant” mirroring on the same turn it entered.
          const armedAt = Number((cc as any)._p15ArmedTurn ?? 0);
          if (armedAt && turnN < armedAt) continue;
          applyTokenDelta(G, cc as any, give, true);
        }
      }
    }
  } catch {}
}

function persona44OnPersonaDiscarded(G: PolitikumState) {
  for (const pp of (G.players || [])) {
    for (const cc of (pp.coalition || [])) {
      if (baseId(String(cc.id)) === 'persona_44') applyTokenDelta(G, cc as any, 1);
    }
  }
}

function ruYou(name: any) {
  const n = String(name || '');
  if (n === 'You') return 'Вы';
  return n;
}

function ruDrewVerb(name: any) {
  const who = ruYou(name);
  // keep existing style in logs: "Вы вытянул ..."
  if (who === 'Вы') return 'вытянул';
  const n = String(name || '');
  // extremely rough gender guess by name ending
  if (/[ая]$/u.test(n)) return 'вытянула';
  return 'вытянул';
}

function eventTitleByBaseId(bid: string) {
  switch (String(bid || '')) {
    case 'event_1': return 'Экокредиты';
    case 'event_2': return 'Сладкий Подарок';
    case 'event_3': return 'Грант Госдепа';
    case 'event_10': return 'Перевод в Криптоколонию';
    case 'event_11': return 'Тайный Удвоитель';
    case 'event_12a': return 'Набег единорогов';
    case 'event_12b': return 'Срач в твиттере: Секс скандал';
    case 'event_12c': return 'Срач в твиттере - русский флаг';
    case 'event_16': return 'Политический [РОСКОМНАДЗОР]';
    default: return '';
  }
}

function factionTitle(tag: string) {
  switch (String(tag || '')) {
    case 'faction:red_nationalist': return 'Красный Националист';
    case 'faction:liberal': return 'Либерал';
    case 'faction:rightwing': return 'Правый';
    case 'faction:leftwing': return 'Левый';
    case 'faction:fbk': return 'ФБК';
    case 'faction:system': return 'Системный';
    case 'faction:neutral': return 'Нейтрал';
    default: return tag;
  }
}

function actionTitleByBaseId(bid: string) {
  switch (String(bid || '')) {
    case 'action_4': return 'Умри ты сегодня а я завтра';
    case 'action_5': return 'культура политики в восточной европе';
    case 'action_9': return 'Вывод во внешний контур';
    case 'action_14': return 'Волонтёрство';
    case 'action_8': return 'Работа на Кремль';
    case 'action_17': return 'Ася Несоевая';
    default: return '';
  }
}

function personaTitleByBaseId(bid: string) {
  try {
    const c: any = (POLITIKUM_CARDS as any)?.[String(bid || '')];
    return String(c?.name || c?.text || bid || '');
  } catch {
    return String(bid || '');
  }
}

function milovEligiblePersonaBaseIds(G: PolitikumState, playerId: string) {
  const player = (G.players || []).find((p: any) => String(p.id) === String(playerId));
  if (!player) return new Set<string>();
  // A named persona cannot be the next card if it is publicly out of the deck,
  // or already known in Milov's own hand. Opponents' hidden hands remain fair
  // guesses, exactly as on the physical table.
  const unavailable = new Set<string>([
    ...(G.discard || []),
    ...(G.players || []).flatMap((p: any) => p.coalition || []),
    ...(player.hand || []),
  ].filter((c: any) => c?.type === 'persona').map((c: any) => baseId(String(c.id))));
  return new Set(Object.values(POLITIKUM_CARDS || {})
    .filter((c: any) => c?.type === 'persona' && !unavailable.has(String(c.id)))
    .map((c: any) => String(c.id)));
}

function eventTitle(card: any) {
  const bid = baseId(String(card?.id || ''));
  const raw = String((card as any)?.text || (card as any)?.name || '').trim();
  if (!raw || /^event_\d+/u.test(raw) || raw === bid) return String(eventTitleByBaseId(bid) || raw || card?.id || '');
  return raw || String(eventTitleByBaseId(bid) || card?.id || '');
}

function debugTrace(G: any, event: string, details: Record<string, any> = {}) {
  const trace = Array.isArray(G.debugTrace) ? G.debugTrace : (G.debugTrace = []);
  trace.push({ at: Date.now(), event, details });
  if (trace.length > 120) trace.splice(0, trace.length - 120);
}

function eventRevealDurationMs(G: any) {
  return Number(G?.responseTimeSeconds || 5) === 10 ? 5200 : 2200;
}

function pauseBotsForEventReveal(G: any) {
  const until = nowMs() + eventRevealDurationMs(G);
  G.eventRevealPauseUntilMs = Math.max(Number(G.eventRevealPauseUntilMs || 0), until);
}

function actionTitle(card: any) {
  const bid = baseId(String(card?.id || ''));
  const mapped = actionTitleByBaseId(bid);
  const raw = String((card as any)?.text || (card as any)?.name || '').trim();

  // If the card has no human-readable title (often raw === "action_8"), prefer our RU map.
  if (mapped && (!raw || /^action_\d+/u.test(raw) || raw === bid)) return mapped;

  return raw || mapped || String(card?.id || '');
}

function cardTitle(x: any) {
  const id = typeof x === 'string' ? x : String(x?.id || '');
  const bid = baseId(id);
  if (/^event_\d+/u.test(bid) || /^event_\d+[a-z]/u.test(bid)) return eventTitleByBaseId(bid) || bid;
  if (/^action_\d+/u.test(bid)) return actionTitleByBaseId(bid) || bid;
  if (/^persona_\d+/u.test(bid)) return personaTitleByBaseId(bid) || bid;
  return bid || id || '';
}

const BOT_ACTIONS_WITH_EFFECT = new Set(['action_5', 'action_13']);

function persona38OnEventPlayed(G: PolitikumState, eventCard: any) {
  try {
    const bid = baseId(String(eventCard?.id || ''));
    if (!(bid === 'event_1' || bid === 'event_2' || bid === 'event_3' || bid === 'event_10')) return;

    // VotVot (persona_38): vacuum 1 token from token-placement events.
    // IMPORTANT: this is not "create a new token" — it should REDUCE the remaining tokens
    // in the current place_tokens_plus_vp pending (if any), otherwise we duplicate value.
    // We implement it as: each persona_38 in play steals 1 token from the event's pool.

    const pend: any = (G as any).pending;
    const pendingMatchesEvent = pend && pend.kind === 'place_tokens_plus_vp' && String(pend.sourceCardId || '').split('#')[0] === bid;

    // Count all persona_38 on the table (normally 1).
    const vacuums: Array<{ ownerName: string; card: any }> = [];
    for (const pp of (G.players || [])) {
      for (const cc of (pp.coalition || [])) {
        if (baseId(String(cc.id)) === 'persona_38') vacuums.push({ ownerName: String(pp.name || pp.id), card: cc });
      }
    }

    if (!vacuums.length) return;

    const canSteal = pendingMatchesEvent ? Math.max(0, Number(pend.remaining || 0)) : 0;
    const want = vacuums.length;
    const take = pendingMatchesEvent ? Math.min(want, canSteal) : 0;

    // Apply the stolen tokens to persona_38 cards.
    for (let i = 0; i < take; i++) {
      const v = vacuums[i];
      applyTokenDelta(G, v.card as any, 1);
    }

    if (pendingMatchesEvent && take > 0) {
      pend.remaining = Math.max(0, Number(pend.remaining || 0) - take);
      // If VotVot stole the last token(s), close the pending immediately.
      if (Number(pend.remaining || 0) <= 0) (G as any).pending = null;
      try {
        const who = (take === 1) ? 'VotVot' : `${take}× VotVot`;
        const evTitle = eventTitleByBaseId(bid) || bid;
        G.log.push(`${who} забрал ${take} жетон(ов) из события ${evTitle}. (осталось: ${Math.max(0, Number(pend.remaining || 0))})`);
      } catch {}
    }
  } catch {}
}

function endGameNow(G: PolitikumState, ctx: any, events: any) {
  const activePlayers = (G.players || []).filter((pp: any) => pp.active !== false);
  const bestScore = activePlayers.reduce((best: number, pp: any) => Math.max(best, scorePlayer(pp)), 0);
  const winners = activePlayers.filter((pp: any) => scorePlayer(pp) === bestScore);
  const best = winners[0] || null;
  const isDraw = winners.length > 1;
  G.gameOver = true;
  G.winnerId = isDraw ? null : (best ? String(best.id) : null);
  G.winnerIds = winners.map((pp: any) => String(pp.id));
  G.isDraw = isDraw;
  G.victoryReason = null;
  const winnerPlayerId = isDraw ? null : (best ? String(best.id) : null);
  const winnerName = isDraw ? null : (best ? String(best.name || best.id) : null);

  // Ensure score history includes the FINAL state (UI chart reads G.history).
  try {
    const scoreNow = (pp: any) => (pp.coalition || []).reduce((s: number, c: any) => s + Number(c.vp || 0), 0);
    const scores: Record<string, number> = Object.fromEntries((G.players || []).map((pp: any) => [String(pp.id), scoreNow(pp)]));
    (G.history ||= []).push({ turn: Number(ctx?.turn || 0), scores });
  } catch {}

  G.log.push(isDraw
    ? `Игра окончена. Ничья: ${winners.map((pp: any) => pp.name || pp.id).join(', ')} (${bestScore} vp).`
    : `Игра окончена. Победитель: ${(winnerName || best?.id)} (${bestScore} vp).`);
  // Write into ctx.gameover (and metadata.gameover) for admin/stat harvesting.
  events.endGame?.({ winnerPlayerId, winnerName });
}

function maybeTriggerRoundEnd(G: PolitikumState, ctx: any) {
  if (G.roundEnding) return;
  const trigger = (G.players || []).find((pp: any) => (pp.coalition || []).length >= 7);
  if (!trigger) return;

  // Finish the round: allow remaining ACTIVE players (after the current player) to take their turns,
  // until it's the current player's turn again.
  // Note: ctx.numPlayers includes inactive seats; we must use only active seats.
  const active = (G.activePlayerIds || []).map(String).filter((id) => {
    const p = (G.players || []).find((pp: any) => String(pp.id) === String(id));
    return !!p?.active;
  });

  // After someone reaches 7 coalition, finish the round: let EVERY OTHER active player
  // take exactly one more turn (regardless of current position in the ring).
  const remaining = Math.max(0, active.length - 1);
  G.roundEnding = true;
  G.roundEndTurn = Number(ctx.turn || 0) + remaining;
  G.log.push(`Конец раунда: кто-то собрал 7 карт. Осталось ходов: ${remaining}.`);
}

function maybeEndAfterRound(G: PolitikumState, ctx: any, events: any) {
  if (!G.roundEnding) return false;

  // Do not end the game while any pending interaction or response window exists.
  // Otherwise the last-turn player can get a pending modal while the winner already sees gameOver.
  try {
    if ((G as any).pending) return false;
    if ((G as any).response && !responseExpired(G)) return false;
  } catch {}

  const t = Number(G.roundEndTurn ?? -1);
  if (t < 0) return false;
  if (Number(ctx.turn || 0) >= t) {
    endGameNow(G, ctx, events);
    return true;
  }
  return false;
}

const nowMs = () => Date.now();
const RESPONSE_BOT_MS = 1000;
const LEFT_BONUS_PERSONAS = new Set(['persona_1', 'persona_19', 'persona_42']);

// A human deserves time to read and react; bot-only windows are merely a
// pacing beat, so they should never make solo play feel like network latency.
function responseWindowMs(G: PolitikumState, kind: 'cancel_action' | 'cancel_persona' | 'cancel_persona_ability', playedBy: string, persona8Swap?: any) {
  const human: any = (G.players || []).find((p: any) => String(p.id) === '0' && p.active);
  if (!human || String(playedBy) === '0') return RESPONSE_BOT_MS;
  const hasReaction = kind === 'cancel_persona'
    ? (human.hand || []).some((card: any) => baseId(String(card.id)) === 'action_8')
    : kind === 'cancel_persona_ability'
      ? (human.hand || []).some((card: any) => baseId(String(card.id)) === 'action_14')
    : (human.hand || []).some((card: any) => {
        const id = baseId(String(card.id));
        return id === 'action_6' || id === 'action_14';
      });
  const hasPersona8Swap = String(persona8Swap?.playerId || '') === '0';
  return hasReaction || hasPersona8Swap
    ? Number(G.responseTimeSeconds || 5) * 1000
    : RESPONSE_BOT_MS;
}
const MAX_COALITION = 7;

function responseExpired(G: PolitikumState) {
  const r: any = (G as any).response;
  if (!r) return true;

  // If nobody can respond, expire immediately.  Bot-only persona cancel
  // windows still need to stay open for tickBot: bots can use Action 8.
  const haveHumanResponders = (G.players || []).some((pp: any) => {
    if (!pp?.active) return false;
    if (String(pp.id) === String(r.playedBy)) return false;
    const isBot = !!pp?.isBot || String(pp?.name || '').startsWith('[B]');
    return !isBot;
  });
  const haveBotPersonaResponder = r.kind === 'cancel_persona' && baseId(String(r.personaCard?.id || '')) !== 'persona_33'
    && (G.players || []).some((pp: any) => {
      if (!pp?.active) return false;
      if (String(pp.id) === String(r.playedBy)) return false;
      const responderIsBot = !!pp?.isBot || String(pp?.name || '').startsWith('[B]');
      if (!responderIsBot) return false;
      if (!botShouldCancelPersona(G, r)) return false;
      return (pp.hand || []).some((c: any) => c?.type === 'action' && baseId(String(c.id)) === 'action_8');
    });
  if (!haveHumanResponders && !haveBotPersonaResponder) return true;

  // Small grace to avoid client/server clock skew and click-latency “did nothing”.
  return nowMs() >= (Number(r.expiresAtMs || 0) + 3500);
}

// Action 8 is a scarce response card. Bots should reserve it for a genuinely
// valuable intervention instead of cancelling every persona that appears.
function botShouldCancelPersona(G: PolitikumState, response: any) {
  const card: any = response?.personaCard;
  if (!card || baseId(String(card.id || '')) === 'persona_33') return false;
  const bid = baseId(String(card.id || ''));
  if (bid === 'persona_14') return true; // Roizman: immediate coalition discard.
  if (Number(card.vp || 0) >= 4) return true;

  const owner: any = (G.players || []).find((pp: any) =>
    (pp.coalition || []).some((cc: any) => String(cc.id) === String(card.id)));
  const coalition: any[] = owner?.coalition || [];
  const at = coalition.findIndex((cc: any) => String(cc.id) === String(card.id));

  // Girkin is especially dangerous when he lands beside Strelkov.
  if (bid === 'persona_19' && at >= 0) {
    const neighbours = [coalition[at - 1], coalition[at + 1]];
    if (neighbours.some((cc: any) => baseId(String(cc?.id || '')) === 'persona_42')) return true;
  }

  // Nadezhdin is a low-value early play, but worth cancelling late in the
  // round when coalition space and victory points are becoming decisive.
  if (bid === 'persona_25') {
    const largestCoalition = Math.max(0, ...(G.players || []).map((pp: any) => (pp.coalition || []).length));
    if (G.roundEnding || largestCoalition >= 5 || (G.deck || []).length <= 10) return true;
  }

  // Shtefanov can invert positive tokens. Cancel him when his owner has a
  // meaningful positive stack to protect.
  if (bid === 'persona_21' && owner) {
    const positive = coalition.reduce((sum: number, cc: any) => sum + Math.max(0, Number(cc?.vpDelta || 0)), 0);
    if (positive >= 3) return true;
  }
  return false;
}

function expireResponseAndResolveDeferred(G: PolitikumState) {
  try {
    const response: any = (G as any).response;
    const pending: any = (G as any).pending;
    if (response && responseExpired(G) && response.kind === 'cancel_persona_ability' && pending?.kind === 'discard_one_persona_from_any_coalition' && pending?.nakiTargetId) {
      const owner: any = (G.players || []).find((p: any) => String(p.id) === String(pending.nakiTargetOwnerId));
      const idx = (owner?.coalition || []).findIndex((c: any) => String(c.id) === String(pending.nakiTargetId));
      if (owner && idx >= 0) {
        const [drop] = owner.coalition.splice(idx, 1);
        if (drop) {
          G.discard.push(drop);
          if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
          const actor: any = (G.players || []).find((p: any) => String(p.id) === String(pending.playerId));
          G.log.push(`${ruYou(actor?.name || pending.playerId)} использовал способность ${cardTitle({ id: String(pending.sourceCardId || '') })}: сбросил ${drop.name || drop.id} из коалиции ${owner.name}.`);
        }
      }
      (G as any).pending = null;
      (G as any).response = null;
      recalcPassives(G);
    } else if (response && responseExpired(G)) {
      (G as any).response = null;
    }
  } catch {}
  try { maybeResolveDeferredPersona(G); } catch {}
  try {
    // Resume all queued Kaz events until one creates its own pending choice;
    // then continue with the remaining queue on the next resolver tick.
    for (let guard = 0; guard < 4; guard++) {
      if ((G as any).pending || (G as any).response || !(G as any).persona16AfterEvents) break;
      const q: any = (G as any).persona16AfterEvents;
      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(q.playerId));
      const events: any[] = Array.isArray(q.events) ? q.events : [];
      if (events.length > 0) {
        const next: any = events.shift();
        q.events = events;
        (G as any).lastEvent = next;
        pauseBotsForEventReveal(G);
        const title = eventTitle(next);
        G.log.push(`${ruYou(me?.name)} вытянул Событие "${title}" из способности ${q.sourceCardId}.`);
        runAbility(String(next.abilityKey || ''), { G, me, card: next } as any);
        (G.discard || []).push(next);
      } else {
        (G as any).pending = { kind: 'persona_16_discard3_from_hand', playerId: String(q.playerId), sourceCardId: String(q.sourceCardId) } as any;
        (G as any).persona16AfterEvents = null;
      }
    }
  } catch {}
  try {
    if (!(G as any).pending && (G as any).pendingDeferred) {
      // restore deferred pending even if response just ended
      (G as any).pending = (G as any).pendingDeferred;
      (G as any).pendingDeferred = null;
    }
  } catch {}
}

function actorWithPersona(me: any, personaBase: string) {
  const p = (me?.coalition || []).find((c: any) => baseId(String(c.id)) === String(personaBase));
  const pname = String(p?.name || p?.text || personaBase);
  return `${ruYou(me?.name)} ${pname}`;
}

const NAKI_CANCELLABLE_ABILITIES = new Set([
  'persona_3_choice',
  'persona_5_pick_liberal',
  'persona_21_pick_target_invert',
  'persona_26_pick_red_nationalist',
  'persona_28_pick_non_fbk',
  'persona_37_pick_opponent_persona',
  'discard_one_persona_from_any_coalition',
]);

function openNakiResponseForPending(G: any) {
  const pend: any = G.pending;
  if (!pend || !NAKI_CANCELLABLE_ABILITIES.has(String(pend.kind)) || G.response) return;
  const actorId = String(pend.playerId || '');
  if (!actorId) return;
  const sourceId = baseId(String(pend.sourceCardId || ''));
  if (!sourceId.startsWith('persona_')) return;
  const owner: any = (G.players || []).find((pp: any) => String(pp.id) !== actorId
    && (pp.coalition || []).some((c: any) => c?.type === 'persona' && baseId(String(c.id)) === 'persona_10'));
  if (!owner) return;
  G.response = {
    kind: 'cancel_persona_ability',
    playedBy: actorId,
    expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_persona_ability', actorId),
    allowPersona10By: String(owner.id),
  } as any;
  (G as any).botPauseUntilMs = Number(G.response.expiresAtMs);
}

function applyAdjacencyBonusesAround(G: PolitikumState, owner: any, placedCard: any) {
  try {
    if (!owner || !placedCard) return;
    const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(placedCard.id));
    if (idx < 0) return;

    const neighbors: any[] = [];
    if (idx > 0) neighbors.push(owner.coalition[idx - 1]);
    if (idx < (owner.coalition || []).length - 1) neighbors.push(owner.coalition[idx + 1]);

    // If the newly placed card itself has adjacency bonus, its on-enter ability already handles it.
    // Here we only ensure adjacent cards that have adjacency bonus get a chance to trigger now.
    for (const n of neighbors) {
      if (!n || n.type !== 'persona') continue;
      if (String((n as any).abilityKey || '') !== 'on_enter_adjacent_bonus') continue;
      try { runAbility('on_enter_adjacent_bonus', { G, me: owner, card: n }); } catch {}
    }
  } catch {}
}

function maybeResolveDeferredPersona(G: PolitikumState) {
  const pend: any = (G as any).pending;
  if (!pend || pend.kind !== 'resolve_persona_after_response') return false;
  // Only resolve once response window is gone.
  if (G.response && !responseExpired(G)) return false;
  if (G.response && responseExpired(G)) G.response = null;

  // Give Action 14 a chance to stop a bot's character ability before its
  // on-enter effect resolves. The pending marker prevents reopening the same
  // window after it expires.
  const ownerBefore: any = (G.players || []).find((pp: any) => (pp.coalition || []).some((cc: any) => String(cc.id) === String(pend.personaId || '')));
  const human: any = (G.players || []).find((pp: any) => String(pp.id) === '0' && pp.active);
  if (!(pend as any).abilityResponseOffered
    && ownerBefore && String(ownerBefore.id) !== '0'
    && human?.hand?.some((card: any) => baseId(String(card.id)) === 'action_14')) {
    (pend as any).abilityResponseOffered = true;
    G.response = {
      kind: 'cancel_persona_ability',
      playedBy: String(ownerBefore.id),
      expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_persona_ability', String(ownerBefore.id)),
    } as any;
    (G as any).botPauseUntilMs = Number(G.response.expiresAtMs);
    return false;
  }

  try {
    const pid = String(pend.personaId || '');
    const owner: any = (G.players || []).find((pp: any) => (pp.coalition || []).some((cc: any) => String(cc.id) === pid));
    const card: any = owner?.coalition?.find((cc: any) => String(cc.id) === pid);
    if (owner && card) {
      const key = String(pend.abilityKey || card.abilityKey || '');
      if (key) runAbility(key, { G, me: owner, card });
      applyAdjacencyBonusesAround(G, owner, card);
      openNakiResponseForPending(G);
    }
  } catch {}

  // Clear ONLY the deferred marker pending. If the resolved ability created a new pending (e.g. persona_17), keep it.
  try {
    const pk: any = (G as any).pending;
    if (pk && pk.kind === 'resolve_persona_after_response') (G as any).pending = null;
  } catch {}
  try { recalcPassives(G); } catch {}
  return true;
}

function tracePush(G: any, entry: any) {
  try {
    const arr: any[] = Array.isArray(G.trace) ? G.trace : [];
    arr.push(entry);
    const CAP = 300;
    if (arr.length > CAP) arr.splice(0, arr.length - CAP);
    G.trace = arr;
  } catch {}
}

function argSummary(args: any[]) {
  try {
    const s = JSON.stringify(args ?? []);
    if (s.length <= 180) return s;
    return s.slice(0, 180) + '…';
  } catch {
    try { return String(args ?? ''); } catch { return '' }
  }
}

function wrapMoves(moves: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [name, fn] of Object.entries(moves || {})) {
    if (typeof fn !== 'function') { out[name] = fn; continue; }
    out[name] = (arg0: any, ...rest: any[]) => {
      const G = arg0?.G;
      const ctx = arg0?.ctx;
      const playerID = arg0?.playerID;
      const beforePend = String((G as any)?.pending?.kind || '');
      const beforeResp = String((G as any)?.response?.kind || '');
      let res: any;
      try {
        res = fn(arg0, ...rest);
        return res;
      } finally {
        try {
          tracePush(G, {
            ts: Date.now(),
            turn: Number(ctx?.turn ?? 0),
            phase: String(ctx?.phase ?? ''),
            currentPlayer: String(ctx?.currentPlayer ?? ''),
            playerID: String(playerID ?? ''),
            move: String(name),
            args: argSummary(rest),
            result: res === undefined ? 'ok' : String(res),
            pending: beforePend,
            response: beforeResp,
          });
        } catch {}
      }
    };
  }
  return out;
}

export const PolitikumGame = {
  name: 'politikum',

  setup: ({ ctx }: any): PolitikumState => {
    const numPlayers = ctx.numPlayers;

    // Build deck from cards.yaml definitions (source of truth)
    const defs = Object.values(POLITIKUM_CARDS || {});
    const personaDefs = defs.filter((d: any) => d.type === 'persona');
    const actionDefs = defs.filter((d: any) => d.type === 'action');
    const eventDefs = defs.filter((d: any) => d.type === 'event');

    const personas = materializeCopies(personaDefs as any);
    const actions = materializeCopies(actionDefs as any);
    const events = materializeCopies(eventDefs as any);

    // Lobby: do NOT deal yet.
    // We keep preDealDeck + eventDeck in G and only deal when startGame is called.
    const preDealDeck = shuffle([...personas, ...actions]);
    const eventDeck = shuffle([...events]);

    const players: PolitikumPlayer[] = range(numPlayers).map((n) => {
      const id = String(n - 1);
      if (n === 1) {
        return { id, name: 'You', hand: [], coalition: [], isBot: false, active: true };
      }
      return { id, name: `[H] Seat ${id}`, hand: [], coalition: [], isBot: false, active: false };
    });

    const scores0: Record<string, number> = Object.fromEntries(players.map((pp: any) => [String(pp.id), 0]));

    return {
      players,
      deck: [],
      discard: [],
      preDealDeck,
      eventDeck,
      activePlayerIds: ['0'],
      log: ['Politikum: lobby opened.'],
      chat: [],
      history: [{ turn: 0, scores: scores0 }],
      pending: null,
      response: null,
      botNextActAtMs: null,
      botPauseUntilMs: null,
      hasDrawn: false,
      hasPlayed: false,
      playsThisTurn: 0,
      maxPlaysThisTurn: 1,
      playVpDelta: 0,
      drawsThisTurn: 0,
    };
  },

  phases: {
    lobby: {
      start: true,
      next: 'action',
      turn: { activePlayers: { all: 'lobby' } } as any,
    },

    action: {
      turn: {
        // Only rotate through active seats (chosen in lobby).
        order: {
          first: ({ G }: any) => {
            const id = String((G.activePlayerIds || [])[0] || '0');
            return parseInt(id, 10) || 0;
          },
          next: ({ G, ctx }: any) => {
            const ids = (G.activePlayerIds || []).map(String).filter(Boolean);
            if (!ids.length) return (Number(ctx.playOrderPos || 0) + 1) % Number(ctx.numPlayers || 1);
            const cur = String(ctx.currentPlayer);
            const i = ids.indexOf(cur);
            const nextId = ids[(i >= 0 ? i + 1 : 0) % ids.length];
            return parseInt(String(nextId), 10) || 0;
          },
        },

        // allow out-of-turn cancels; we enforce legality inside moves
        activePlayers: { all: 'all' } as any,

        onBegin: ({ G, ctx, events }: any) => {
          // If round-end quota is already exhausted, end immediately before granting a fresh turn.
          try {
            if (G.roundEnding) {
              const t = Number(G.roundEndTurn ?? -1);
              if (t >= 0 && Number(ctx?.turn || 0) >= t && !(G as any).pending && !(G as any).response) {
                endGameNow(G, ctx, events);
                return;
              }
            }
          } catch {}

          // Reset per-turn flags
          (G as any).turnStartedAtMs = nowMs();
          // Keep current turn number on G for helpers that don't receive ctx.
          (G as any).turnN = Number(ctx?.turn || 0);
          G.hasDrawn = false;
          G.hasPlayed = false;
          G.playsThisTurn = 0;
          G.maxPlaysThisTurn = 1;
          G.playVpDelta = 0;
          G.drawsThisTurn = 0;

          // Bot delay: small pause at start of bot turns to let UI update
          try {
            const cur: any = (G.players || []).find((pp: any) => String(pp.id) === String(ctx.currentPlayer));
            const isBot = !!cur?.isBot || String(cur?.name || '').startsWith('[B]');
            G.botNextActAtMs = isBot ? (nowMs() + 2000) : null;
          } catch {
            G.botNextActAtMs = null;
          }

          // persona_11 (Solovei): offer at start of turn (before draw)
          try {
            const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(ctx.currentPlayer));
            if (me && (me.coalition || []).some((c: any) => baseId(String(c.id)) === 'persona_11' && !c.blockedAbilities)) {
              const haveTargets = (G.players || []).some((pp: any) => {
                if (String(pp.id) === String(me.id)) return false;
                return (pp.coalition || []).some((c: any) => c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded);
              });
              if (haveTargets) {
                (G as any).pending = { kind: 'persona_11_offer', playerId: String(me.id), sourceCardId: 'persona_11' } as any;
              }
            }
          } catch {}
        },

        onEnd: ({ G, ctx, events }: any) => {
          try {
            const scoreNow = (pp: any) => (pp.coalition || []).reduce((s: number, c: any) => s + Number(c.vp || 0), 0);
            const scores: Record<string, number> = Object.fromEntries((G.players || []).map((pp: any) => [String(pp.id), scoreNow(pp)]));
            (G.history ||= []).push({ turn: Number(ctx.turn || 0), scores });
          } catch {}

          // Rules: game ends if deck is empty at end of a turn.
          try {
            if (!G.gameOver && Array.isArray(G.deck) && G.deck.length <= 0) {
              endGameNow(G, ctx, events);
            }
          } catch {}
        },

        // (bot actions are driven by moves.tickBot for pacing)
      },
    },
  },

  moves: wrapMoves({
    setPlayerIdentity: ({ G, ctx, playerID }: any, payload: any) => {
      if (String(ctx.phase || '') !== 'lobby') return INVALID_MOVE;
      const p = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE;
      const playerId = String(payload?.playerId || '').trim();
      const email = payload?.email == null ? null : String(payload.email || '').trim().toLowerCase();
      if (!playerId) return INVALID_MOVE;
      (p as any).identity = { playerId, email };
      return;
    },

    setPlayerName: ({ G, ctx, playerID }: any, name: string) => {
      if (String(ctx.phase || '') !== 'lobby') return INVALID_MOVE;
      const p = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE;

      const n = String(name || '').trim();
      if (!n) return INVALID_MOVE;

      p.name = n;
      p.isBot = false;
      p.active = true;

      const ids = new Set((G.activePlayerIds || []).map(String));
      ids.add(String(p.id));
      // Keep host first; other seats ascending.
      const rest = Array.from(ids).filter((x) => x !== '0').sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ['0', ...rest];
      G.log.push(`${ruYou(p.name)} готов.`);
    },

    addBot: ({ G, ctx, playerID }: any) => {
      if (String(ctx.phase || '') !== 'lobby') return INVALID_MOVE;
      if (String(playerID) !== '0') return INVALID_MOVE;

      const BOT_NAMES = [
        'Runov', 'Serezhko', 'SVTV', 'Yashin', 'Pevchih', 'Kashin', 'Kasparov', 'Lazerson', 'Ponomarev', 'Naki',
        'Solovei', 'Savin', 'Venediktov', 'Roizman', 'Pozharskii', 'Kaz', 'Arno', 'Sobol', 'Girkin', 'Bykov',
        'Shtefanov', 'Svetov', 'Volkov', 'Latynina', 'Nadezhdin', 'Demushkin', 'Yudin', 'Veduta', 'Yuneman', 'Hodorkovsky',
        'Shlosberg', 'Plushev', 'Sobchak', 'Milov', 'Zhdanov', 'Kagalicky', 'Guriev', 'VotVot', 'Left', 'Duncova',
        'Dozd', 'Strelkov', 'Doxa', 'Rudoi', 'Shulman',
      ];
      const pickBotName = () => BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

      const seat = (G.players || []).find((pp: any) => String(pp.id) !== '0' && !pp.active);
      if (!seat) return INVALID_MOVE;

      seat.isBot = true;
      seat.active = true;
      seat.name = `[B] ${pickBotName()}`;

      const ids = new Set((G.activePlayerIds || []).map(String));
      ids.add(String(seat.id));
      const rest = Array.from(ids).filter((x) => x !== '0').sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ['0', ...rest];
      G.log.push(`${seat.name} присоединился.`);
    },

    removePlayer: ({ G, ctx, playerID }: any, targetId: string) => {
      if (String(ctx.phase || '') !== 'lobby') return INVALID_MOVE;
      if (String(playerID) !== '0') return INVALID_MOVE;
      if (String(targetId) === '0') return INVALID_MOVE;

      const p = (G.players || []).find((pp: any) => String(pp.id) === String(targetId));
      if (!p) return INVALID_MOVE;

      p.isBot = false;
      p.active = false;
      p.name = `[H] Seat ${String(p.id)}`;

      const ids = (G.activePlayerIds || []).map(String).filter((x) => x !== String(targetId));
      const rest = Array.from(new Set(ids)).filter((x) => x !== '0').sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ['0', ...rest];
      G.log.push(`Место ${String(targetId)} освобождено.`);
    },

    submitChat: ({ G }: any, text: string, sender?: string) => {
      const msg = String(text || '').trim();
      if (!msg) return INVALID_MOVE;
      (G.chat ||= []).push({ sender: String(sender || 'Anon'), text: msg });
      // cap
      if ((G.chat || []).length > 80) G.chat = (G.chat || []).slice(-80);
    },

    forceSkipTurn: ({ G, ctx, playerID, events }: any) => {
      // Thermonuclear rescue: if bots wedge, let any human advance the turn.
      if (String(ctx.phase || '') !== 'action') return INVALID_MOVE;
      const cur: any = (G.players || []).find((pp: any) => String(pp.id) === String(ctx.currentPlayer));
      const curIsBot = !!cur?.isBot || String(cur?.name || '').startsWith('[B]');
      if (!curIsBot) return INVALID_MOVE;

      try { (G as any).pending = null; } catch {}
      try { (G as any).response = null; } catch {}
      try { (G as any).botPauseUntilMs = 0; } catch {}

      // Mark the turn as "done enough" so endTurn isn't blocked by flags.
      try { (G as any).hasDrawn = true; } catch {}
      try { (G as any).hasPlayed = true; } catch {}

      try { G.log.push(`${ruYou(cur?.name || 'Bot')} turn force-skipped by ${ruYou((G.players || []).find((pp: any) => String(pp.id)===String(playerID))?.name || playerID)}.`); } catch {}

      try { if (maybeEndAfterRound(G, ctx, events)) return; } catch {}
      events.endTurn?.();
    },

    startGame: ({ G, ctx, playerID, events }: any, responseTimeSeconds = 5) => {
      if (String(ctx.phase || '') !== 'lobby') return INVALID_MOVE;
      if (String(playerID) !== '0') return INVALID_MOVE;

      G.responseTimeSeconds = Number(responseTimeSeconds) === 10 ? 10 : 5;

      const activeIds = (G.activePlayerIds || []).map(String).filter((id) => {
        const p = (G.players || []).find((pp: any) => String(pp.id) === id);
        return !!p?.active;
      });
      if (activeIds.length < 2) return INVALID_MOVE;

      // seed chat with who is playing
      try {
        const names = activeIds.map((id) => (G.players || []).find((pp: any) => String(pp.id) === String(id))?.name || id);
        (G.chat ||= []).push({ sender: 'System', text: `Game starting: ${names.join(', ')}` });
      } catch {}

      // Reset all players hands/coalitions; keep only active seats in turn order.
      for (const p of (G.players || [])) {
        p.hand = [];
        p.coalition = [];
      }

      const pre = shuffle([...(G.preDealDeck || [])]);
      const evs = shuffle([...(G.eventDeck || [])]);

      // Deal 5 to each active seat.
      for (let k = 0; k < 5; k++) {
        for (const id of activeIds) {
          const c = pre.shift();
          if (!c) break;
          const p = (G.players || []).find((pp: any) => String(pp.id) === String(id));
          if (p) p.hand.push(c);
        }
      }

      G.deck = shuffle([...pre, ...evs]);
      G.discard = [];
      G.pending = null;
      G.response = null;
      G.gameOver = false;
      G.winnerId = null;
      G.winnerIds = [];
      G.isDraw = false;
      G.victoryReason = null;
      G.roundEnding = false;
      G.roundEndTurn = null;
      G.handRevealPlayerId = null;
      G.handRevealUntilMs = null;
      G.lastEvent = null;
      G.lastAction = null;
      G.hasDrawn = false;
      G.hasPlayed = false;
      G.playsThisTurn = 0;
      G.maxPlaysThisTurn = 1;
      G.playVpDelta = 0;
      G.drawsThisTurn = 0;

      // Persist the final active order for the action phase.
      const rest = activeIds.filter((x) => x !== '0').sort((a, b) => Number(a) - Number(b));
      G.activePlayerIds = ['0', ...rest];

      const scoreNow = (pp: any) => (pp.coalition || []).reduce((s: number, c: any) => s + Number(c.vp || 0), 0);
      const scores0: Record<string, number> = Object.fromEntries((G.players || []).map((pp: any) => [String(pp.id), scoreNow(pp)]));
      G.history = [{ turn: 0, scores: scores0 }];

      G.log.push(`Politikum: старт игры — игроков: ${activeIds.length}.`);

      events.setPhase?.('action');
      events.endTurn?.({ next: '0' });
    },

    skipResponseWindow: ({ G, ctx, playerID, events }: any) => {
      const r: any = (G as any).response;
      if (!r) return INVALID_MOVE;

      // Allow BOTH the actor and responders to close the response window early.
      // Use-case: if the actor wants to end turn immediately (no need to wait 8s).
      (G as any).response = null;

      // If we had a deferred on-enter persona ability waiting for this response window,
      // resolve it now that the window is closed.
      try { maybeResolveDeferredPersona(G); } catch {}
      try { recalcPassives(G); } catch {}

      // If the current player is done, end immediately.
      try {
        if (String(ctx?.currentPlayer || '') === String(playerID) && !G.response && !(G as any).pending && G.hasDrawn && G.hasPlayed) {
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
      } catch {}
    },

    applyPendingToken: ({ G, ctx, playerID }: any, coalitionCardId: string) => {
      expireResponseAndResolveDeferred(G);
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'place_tokens_plus_vp') return INVALID_MOVE;
      // Token placement can become out-of-sync in rare cases (e.g. reconnect / tick-driver quirks).
      // Allow the pending owner to resolve it even if it's not currently their turn.
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const idx = (me.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const c: any = me.coalition[idx];

      // Token placement UX: ALL remaining tokens are placed onto ONE persona in a single click.
      // (Applies to events + abilities that create place_tokens_plus_vp pending.)
      const burst = Math.max(1, Number(pend.remaining || 1));

      let delta = Number(pend.delta || 1) * burst;

      // Shield (action_13): text says “if persona would receive any number of +1, it receives 1 less”.
      // Interpret as a ONE-TIME -1 applied per token-placement effect (not per click).
      // Implementation: for a place_tokens_plus_vp pending, the first +1 applied to a shielded persona is reduced by 1.
      if (c.shielded && delta > 0) {
        if (!(pend as any).shieldTaxApplied) {
          delta = Math.max(0, delta - 1);
          (pend as any).shieldTaxApplied = true;
        }
      }

      if (!delta) {
        G.log.push(`${ruYou(me.name)} выбрал защищённого персонажа (${c.name || c.id}); +1 не сработал.`);
      } else {
        applyTokenDelta(G, c, delta);
      }

      pend.remaining = Math.max(0, Number(pend.remaining || 0) - burst);
      const left = Math.max(0, Number(pend.remaining || 0));
      G.log.push(`${ruYou(me.name)} поставил +${delta} на ${c.name || c.id}. (осталось: ${left})`);

      if (left <= 0) {
        (G as any).pending = null;
        try { expireResponseAndResolveDeferred(G); } catch {}
      }
      recalcPassives(G);
    },

    discardPersonaFromCoalition: ({ G, ctx, playerID }: any, ownerId: string, coalitionCardId: string) => {
      expireResponseAndResolveDeferred(G);
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'discard_one_persona_from_any_coalition') return INVALID_MOVE;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE;

      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;
      if (target?.shielded) return INVALID_MOVE;

      const hasNaki = String(owner.id) !== String(playerID) && (owner.coalition || []).some((c: any) => c?.type === 'persona' && baseId(String(c.id)) === 'persona_10');
      if (hasNaki) {
        if (G.response && !responseExpired(G)) return INVALID_MOVE;
        pend.nakiTargetId = String(coalitionCardId);
        pend.nakiTargetOwnerId = String(owner.id);
        G.response = { kind: 'cancel_persona_ability', playedBy: String(playerID), expiresAtMs: nowMs() + RESPONSE_ACTION_MS, allowPersona10By: String(owner.id) } as any;
        return;
      }

      const [c] = owner.coalition.splice(idx, 1);
      if (c) { G.discard.push(c); if ((c as any).type === 'persona') persona44OnPersonaDiscarded(G); }
      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      const src = String(pend?.sourceCardId || '');
      const srcName = src ? cardTitle({ id: src }) : '';
      if (srcName) {
        G.log.push(`${ruYou(me?.name || playerID)} использовал способность ${srcName}: сбросил ${c?.name || c?.id} из коалиции ${owner.name}.`);
      } else {
        G.log.push(`${ruYou(me?.name || playerID)} сбросил ${c?.name || c?.id} из коалиции ${owner.name}.`);
      }

      (G as any).pending = null;
      recalcPassives(G);
    },

    persona3Skip: ({ G, ctx, playerID, events }: any) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_3_choice') return INVALID_MOVE;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      G.log.push(`${ruYou(me.name)} (${pend.sourceCardId}): пропустил способность.`);
      (G as any).pending = null;
      recalcPassives(G);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    persona3ChooseOption: ({ G, ctx, playerID, events }: any, option: 'a' | 'b', targetId?: string, coalitionCardId?: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_3_choice') return INVALID_MOVE;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      if (option === 'a') {
        // Discard any leftwing persona from any coalition.
        const tid = String(targetId || '');
        const owner = (G.players || []).find((pp: any) => String(pp.id) === tid);
        if (!owner) return INVALID_MOVE;
        let j = -1;
        if (coalitionCardId) {
          j = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
        }
        if (j < 0) {
          j = (owner.coalition || []).findIndex((c: any) => c.type === 'persona' && Array.isArray(c.tags) && c.tags.includes('faction:leftwing'));
        }
        if (j < 0) return INVALID_MOVE;
        const target: any = owner.coalition[j];
        if (!target || target.type !== 'persona') return INVALID_MOVE;
        if (!Array.isArray(target.tags) || !target.tags.includes('faction:leftwing')) return INVALID_MOVE;
        if (target?.shielded) return INVALID_MOVE;
        const [drop] = owner.coalition.splice(j, 1);
        if (drop) {
          G.discard.push(drop);
          if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
        }
        G.log.push(`${ruYou(me.name)} (${pend.sourceCardId}): сбросил ${drop?.name || drop?.id} (левые) у ${owner.name}.`);
      } else {
        // Remove every +1 token from leftwing personas currently in play.
        let removed = 0;
        for (const p of (G.players || [])) {
          for (const c of (p.coalition || [])) {
            if (c.type !== 'persona') continue;
            if (!Array.isArray(c.tags) || !c.tags.includes('faction:leftwing')) continue;
            const cur = Number(c.vpDelta || 0);
            const take = Math.max(0, cur);
            if (take > 0) {
              applyTokenDelta(G, c, -take);
              removed += take;
            }
          }
        }
        G.log.push(`${ruYou(me.name)} (${pend.sourceCardId}): снял ${removed} × +1 со всех левых.`);
      }

      // Both announced SVTV options cost one −1 token.
      try {
        const self: any = (me.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_3');
        if (self) applyTokenDelta(G, self, -1);
      } catch {}

      (G as any).pending = null;
      recalcPassives(G);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    persona12ChooseAdjacentRed: ({ G, ctx, playerID }: any, targetCoalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_12_choose_adjacent_red') return INVALID_MOVE;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const tid = String(targetCoalitionCardId || '');
      if (!(tid === String(pend.leftId) || tid === String(pend.rightId))) return INVALID_MOVE;

      const t: any = (me.coalition || []).find((c: any) => String(c.id) === tid);
      if (!t || t.type !== 'persona') return INVALID_MOVE;
      if (!Array.isArray(t.tags) || !t.tags.includes('faction:red_nationalist')) return INVALID_MOVE;
      if (t.shielded) return INVALID_MOVE;

      applyTokenDelta(G, t, 2);
      G.log.push(`${me.name} (${pend.sourceCardId}) buffed ${t.name || t.id} (+2).`);
      (G as any).pending = null;
      recalcPassives(G);
      return;
    },

    persona5PickLiberal: ({ G, ctx, playerID, events }: any, ownerId: string, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_5_pick_liberal') return INVALID_MOVE;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;
      const self = (me.coalition || []).find((c: any) => String(c.id) === String(pend.sourceCardId));
      if (!self) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner || String(owner.id) === String(playerID)) return INVALID_MOVE;

      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;
      const target: any = owner.coalition[idx];
      if (target?.shielded) return INVALID_MOVE;
      if (!Array.isArray(target?.tags) || !target.tags.includes('faction:liberal')) return INVALID_MOVE;

      const [drop] = owner.coalition.splice(idx, 1);
      if (drop) G.discard.push(drop);

      // Transfer tokens
      const tok = Number(drop?.vpDelta || 0);
      if (tok) {
        applyTokenDelta(G, self, tok);
        drop.vpDelta = 0;
        (drop as any).plusTokens = 0;
        (drop as any).minusTokens = 0;
      }
      G.log.push(`${ruYou(me.name)} (${self?.name || self?.text || 'persona_5'}): сбросил ${drop?.name || drop?.id} и украл ${tok} жетон(ов).`);

      (G as any).pending = null;
      recalcPassives(G);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },


    discardFromHandForEvent12b: ({ G, playerID }: any, cardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'event_12b_discard_from_hand') return INVALID_MOVE;

      const targets: string[] = Array.isArray(pend.targetIds) ? pend.targetIds.map(String) : [];
      if (!targets.includes(String(playerID))) return INVALID_MOVE;

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const idx = (me.hand || []).findIndex((c: any) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE;

      const [drop] = me.hand.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
        const bid = baseId(String(pend.sourceCardId || ''));
        const ev = eventTitle({ id: pend.sourceCardId });
        const subtitle = String(ev).split(':').slice(-1)[0].trim();
        const prefix = bid === 'event_12b' ? 'Секс скандал' : (subtitle || ev || pend.sourceCardId);
        G.log.push(`${prefix}:: ${ruYou(me.name)} сбросил 1 карту с руки.`);
      }

      pend.targetIds = targets.filter((id) => id !== String(playerID));
      if (!pend.targetIds.length) {
        (G as any).pending = null;
        try { expireResponseAndResolveDeferred(G); } catch {}
      }
    },

    // Hand limit: if you end turn with >7 cards, discard down to 7 by clicking hand cards.
    discardFromHandDownTo7: ({ G, ctx, playerID, events }: any, cardId: string) => {
      const pend: any = (G as any).pending;
      const wasHandLimit = pend?.kind === 'discard_down_to_7';
      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      // Allow discard even if pending wasn't created (mobile clients failing to call endTurn).
      if (!pend || pend.kind !== 'discard_down_to_7') {
        const isCurrent = String(ctx?.currentPlayer || '') === String(playerID);
        const overLimit = Number((me.hand || []).length) > 7;
        if (!isCurrent || !overLimit) return INVALID_MOVE;
      } else {
        if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      }

      const idx = (me.hand || []).findIndex((c: any) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE;

      const [drop] = me.hand.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
      }

      if (Number((me.hand || []).length) <= 7) {
        (G as any).pending = null;
        if (wasHandLimit) {
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
      }
      recalcPassives(G);
    },

    discardSelectedDownTo7: ({ G, ctx, playerID, events }: any, cardIds: string[]) => {
      const pend: any = G.pending;
      if (!pend || pend.kind !== 'discard_down_to_7' || String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;
      const ids = Array.from(new Set((Array.isArray(cardIds) ? cardIds : []).map(String)));
      const needed = Math.max(0, (me.hand || []).length - 7);
      if (ids.length !== needed) return INVALID_MOVE;
      for (const id of ids) {
        const idx = (me.hand || []).findIndex((c: any) => String(c.id) === id);
        if (idx < 0) return INVALID_MOVE;
      }
      for (const id of ids) {
        const idx = me.hand.findIndex((c: any) => String(c.id) === id);
        const [drop] = me.hand.splice(idx, 1);
        if (drop) {
          G.discard.push(drop);
          if (drop.type === 'persona') persona44OnPersonaDiscarded(G);
        }
      }
      G.pending = null;
      recalcPassives(G);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    discardPersonaFromOwnCoalitionForEvent16: ({ G, playerID }: any, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'event_16_discard_self_persona_then_draw1') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const idx = (me.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const c: any = me.coalition[idx];
      if (!c || c.type !== 'persona') return INVALID_MOVE;
      if (baseId(String(c.id)) === 'persona_31') return INVALID_MOVE;
      if (c.shielded) return INVALID_MOVE; // shielded personas cannot be targeted by events

      me.coalition.splice(idx, 1);
      G.discard.push(c);
      if ((c as any).type === 'persona') persona44OnPersonaDiscarded(G);
      const srcBid = baseId(String(pend.sourceCardId || ''));
      if (srcBid === 'event_16') {
        G.log.push(`${ruYou(me.name)} сбросил ${c.name || c.id} из своей коалиции из-за события политический [РОСКОМНАДЗОР].`);
      } else {
        G.log.push(`${ruYou(me.name)} сбросил ${c.name || c.id} из своей коалиции из-за "${cardTitle(pend.sourceCardId)}".`);
      }

      // draw 1 card (event-style draw that can chain events)
      const draw = () => {
        const next = G.deck.shift();
        if (!next) return;
        if (next.type === 'event') {
          G.lastEvent = next;
          pauseBotsForEventReveal(G);
          const evName = eventTitle(next);
          const srcBid2 = baseId(String(pend.sourceCardId || ''));
          const nextBid = baseId(String(next.id || ''));
          if (srcBid2 === 'event_16' && nextBid === 'event_10') {
            G.log.push(`${ruYou(me.name)} ${ruDrewVerb(me.name)} ${evName}, после политический [РОСКОМНАДЗОР].`);
          } else {
            G.log.push(`${ruYou(me.name)} ${ruDrewVerb(me.name)} ${evName} (из "${cardTitle(pend.sourceCardId)}")`);
          }
          runAbility(next.abilityKey, { G, me, card: next });
          persona38OnEventPlayed(G, next);
          G.discard.push(next);
        } else {
          me.hand.push(next);
          const srcBid2 = baseId(String(pend.sourceCardId || ''));
          if (srcBid2 === 'event_16') G.log.push(`Зато взяли карту.`);
          else G.log.push(`${ruYou(me.name)} взял карту из "${cardTitle(pend.sourceCardId)}".`);
        }
      };
      draw();

      (G as any).pending = null;
    },

    // Persona 7: on-enter, swap two personas within a chosen coalition.
    // Robustness: some clients accidentally send the wrong ownerId (mobile/old UI path).
    // If ownerId doesn't match, infer the owner by locating BOTH persona instance ids in the same coalition.
    persona7SwapTwoInCoalition: ({ G, ctx, playerID }: any, ownerId: string, firstPersonaId: string, secondPersonaId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_7_swap_two_in_coalition') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      if (String(ctx?.currentPlayer || '') !== String(playerID)) return INVALID_MOVE;

      const fid = String(firstPersonaId || '');
      const sid = String(secondPersonaId || '');
      if (!fid || !sid || fid === sid) return INVALID_MOVE;

      let owner: any = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));

      const findOwnerByBoth = () => {
        return (G.players || []).find((pp: any) => {
          const ids = new Set((pp.coalition || []).map((c: any) => String(c?.id || '')));
          return ids.has(fid) && ids.has(sid);
        });
      };

      // Fallback if ownerId is wrong or cards aren't in that coalition.
      if (!owner) owner = findOwnerByBoth();

      const idxA0 = (owner?.coalition || []).findIndex((c: any) => String(c.id) === fid);
      const idxB0 = (owner?.coalition || []).findIndex((c: any) => String(c.id) === sid);
      if (!owner || idxA0 < 0 || idxB0 < 0) owner = findOwnerByBoth();

      const idxA = (owner?.coalition || []).findIndex((c: any) => String(c.id) === fid);
      const idxB = (owner?.coalition || []).findIndex((c: any) => String(c.id) === sid);
      if (!owner || idxA < 0 || idxB < 0 || idxA === idxB) return INVALID_MOVE;

      const ca: any = owner.coalition[idxA];
      const cb: any = owner.coalition[idxB];
      if (!ca || !cb || ca.type !== 'persona' || cb.type !== 'persona') return INVALID_MOVE;

      owner.coalition[idxA] = cb;
      owner.coalition[idxB] = ca;

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      G.log.push(`${ruYou(me?.name || playerID)} использовали способность Каспарова и поменяли местами ${ca.name || ca.id} и ${cb.name || cb.id} у ${owner.name}.`);

      (G as any).pending = null;
      recalcPassives(G);
    },

    // Persona 8: swap Lazerson (p8) with the just-played persona (during cancel_persona response window)
    persona8SwapWithPlayedPersona: ({ G, playerID }: any) => {
      const r: any = (G as any).response;
      if (!r || r.kind !== 'cancel_persona') return INVALID_MOVE;
      if (responseExpired(G)) return INVALID_MOVE;
      const spec = r.persona8Swap;
      if (!spec || String(spec.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      const owner: any = (G.players || []).find((pp: any) => String(pp.id) === String(spec.ownerId));
      if (!me || !owner) return INVALID_MOVE;

      const iP8 = (me.coalition || []).findIndex((c: any) => baseId(String(c.id)) === 'persona_8');
      if (iP8 < 0) return INVALID_MOVE;

      const iPlayed = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(spec.playedPersonaId));
      if (iPlayed < 0) return INVALID_MOVE;

      const p8 = me.coalition[iP8];
      const played = owner.coalition[iPlayed];
      // p8 can only trigger once while it stays on the table.
      (p8 as any)._p8Used = true;
      if (!p8 || !played || p8.type !== 'persona' || played.type !== 'persona') return INVALID_MOVE;

      me.coalition.splice(iP8, 1);
      owner.coalition[iPlayed] = p8;
      me.coalition.push(played);

      // Safety: ensure swapped persona isn't also stuck in any hand (tournament desync reports).
      try {
        for (const pp of (G.players || [])) {
          const hi = (pp.hand || []).findIndex((c: any) => String(c.id) === String(played.id));
          if (hi >= 0) pp.hand.splice(hi, 1);
        }
      } catch {}

      G.log.push(`${actorWithPersona(me, 'persona_8')} поменялся с ${played.name || played.id}.`);
      recalcPassives(G);

      // After swap, close the response window and resolve the played
      // persona's deferred ability against its new coalition owner.  Without
      // this handoff, a bot's pre-swap pending ability can remain associated
      // with the old owner (the classic Lazerson/Roizman limbo).
      (G as any).response = null;
      try { maybeResolveDeferredPersona(G); } catch {}
      (G as any).botPauseUntilMs = 0;
      (G as any).botNextActAtMs = nowMs() + 250;
    },

    // Persona 10 (Naki): discard persona_10 from YOUR COALITION to cancel an effect targeting your coalition
    persona10CancelFromHand: ({ G, playerID }: any, _cardId: string) => {
      // Back-compat wrapper: older UI used hand click. Keep move name but discard from coalition.
      const r: any = (G as any).response;
      if (!r || (r.kind !== 'cancel_action' && r.kind !== 'cancel_persona_ability')) return INVALID_MOVE;
      if (responseExpired(G)) return INVALID_MOVE;
      if (String(r.allowPersona10By || '') !== String(playerID)) return INVALID_MOVE;
      if (!(G.pending?.kind === 'action_4_discard' || G.pending?.kind === 'action_9_discard_persona' || NAKI_CANCELLABLE_ABILITIES.has(String(G.pending?.kind)))) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const idx = (me.coalition || []).findIndex((c: any) => c?.type === 'persona' && baseId(String(c.id)) === 'persona_10');
      if (idx < 0) return INVALID_MOVE;
      const [drop] = (me.coalition || []).splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
      }

      G.pending = null;
      (G as any).response = null;
      G.log.push(`${ruYou(me.name)} сбросил ${drop?.name || drop?.id || 'persona_10'}, отменив эффект на своей коалиции.`);
      recalcPassives(G);
    },

    persona10CancelFromCoalition: ({ G, playerID }: any) => {
      const r: any = (G as any).response;
      if (!r || (r.kind !== 'cancel_action' && r.kind !== 'cancel_persona_ability')) return INVALID_MOVE;
      if (responseExpired(G)) return INVALID_MOVE;
      if (String(r.allowPersona10By || '') !== String(playerID)) return INVALID_MOVE;
      if (!(G.pending?.kind === 'action_4_discard' || G.pending?.kind === 'action_9_discard_persona' || NAKI_CANCELLABLE_ABILITIES.has(String(G.pending?.kind)))) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const idx = (me.coalition || []).findIndex((c: any) => c?.type === 'persona' && baseId(String(c.id)) === 'persona_10');
      if (idx < 0) return INVALID_MOVE;
      const [drop] = (me.coalition || []).splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
      }

      G.pending = null;
      (G as any).response = null;
      G.log.push(`${ruYou(me.name)} сбросил ${drop?.name || drop?.id || 'persona_10'}, отменив эффект на своей коалиции.`);
      recalcPassives(G);
    },

    // Persona 45: on-enter, choose opponent then steal 1 facedown card from their hand.
    persona21InvertTokens: ({ G, playerID }: any, ownerId: string, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_21_pick_target_invert') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE;
      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;

      const before = Number(target.vpDelta || 0);
      const prevPlus = Number((target as any).plusTokens ?? Math.max(0, before));
      const prevMinus = Number((target as any).minusTokens ?? Math.max(0, -before));
      (target as any).plusTokens = prevMinus;
      (target as any).minusTokens = prevPlus;
      target.vpDelta = -before;
      recalcPassives(G);

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      G.log.push(`${ruYou(me?.name || playerID)} перевернул жетоны на ${target.name || target.id} (${before} → ${target.vpDelta}).`);

      (G as any).pending = null;
    },

    persona23ChooseSelfInflict: ({ G, playerID }: any, n: number) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_23_choose_self_inflict_draw') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const self: any = (me.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_23');
      if (!self) return INVALID_MOVE;

      // Incremental mode: you can call this multiple times.
      // n=0 finishes early; otherwise applies up to 3 total.
      const already = Math.max(0, Math.min(3, Number(pend.taken || 0)));
      const want = Number(n || 0);
      if (want === 0) {
        (G as any).pending = null;
        recalcPassives(G);
        return;
      }

      const remaining = Math.max(0, 3 - already);
      const k = Math.max(0, Math.min(remaining, want));
      if (!k) return INVALID_MOVE;

      applyTokenDelta(G, self, -k);
      for (let i = 0; i < k; i++) {
        const next = G.deck.shift();
        if (!next) break;
        if (next.type === 'event') {
          G.lastEvent = next;
          pauseBotsForEventReveal(G);
          const evName = eventTitle(next);
          G.log.push(`${ruYou(me.name)} ${ruDrewVerb(me.name)} ${evName} из-за способности Волкова.`);
          runAbility(next.abilityKey, { G, me, card: next });
          persona38OnEventPlayed(G, next);
          // If the event created a pending interaction (e.g. token placement), stop drawing until it's resolved.
          if ((G as any).pending) break;
          G.discard.push(next);
        } else {
          me.hand.push(next);
          G.log.push(`${ruYou(me.name)} взял карту из-за способности Волкова.`);
        }
      }

      pend.taken = already + k;
      G.log.push(`${actorWithPersona(me, 'persona_23')} взял ${k} × -1 и вытянул ${k} карт. (total ${pend.taken}/3)`);

      // If a chained event created a pending interaction (e.g. token placement), keep it.
      if ((G as any).pending && (G as any).pending.kind !== 'persona_23_choose_self_inflict_draw') {
        recalcPassives(G);
        return;
      }

      if (Number(pend.taken || 0) >= 3) (G as any).pending = null;
      recalcPassives(G);
    },

    persona26PurgeRedNationalist: ({ G, playerID }: any, ownerId: string, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_26_pick_red_nationalist') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const self: any = (me.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_26');
      if (!self) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE;
      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;
      if (!Array.isArray(target.tags) || !target.tags.includes('faction:red_nationalist')) return INVALID_MOVE;
      if (target.shielded) return INVALID_MOVE;

      const plus = Math.max(0, Number(target.vpDelta || 0));
      owner.coalition.splice(idx, 1);
      G.discard.push(target);
      if ((target as any).type === 'persona') persona44OnPersonaDiscarded(G);

      if (plus) applyTokenDelta(G, self, plus);
      recalcPassives(G);
      G.log.push(`${actorWithPersona(me, 'persona_26')} сбросил ${target.name || target.id} и унаследовал ${plus} × +1.`);

      (G as any).pending = null;
    },

    persona28StealPlusTokens: ({ G, playerID }: any, ownerId: string, coalitionCardId: string, n?: number) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_28_pick_non_fbk') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const self: any = (me.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_28');
      if (!self) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE;
      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;
      if (Array.isArray(target.tags) && target.tags.includes('faction:fbk')) return INVALID_MOVE;
      if (target.shielded) return INVALID_MOVE;

      const want = Math.max(0, Math.min(3, Number(n ?? 3)));
      const avail = Number((target as any).plusTokens ?? Math.max(0, Number(target.vpDelta || 0)));
      const take = Math.min(want, avail);
      if (take) {
        const minus = Number((target as any).minusTokens ?? Math.max(0, -Number(target.vpDelta || 0)));
        (target as any).plusTokens = avail - take;
        (target as any).minusTokens = minus;
        target.vpDelta = (avail - take) - minus;
        applyTokenDelta(G, self, take);
      }
      recalcPassives(G);
      G.log.push(`${actorWithPersona(me, 'persona_28')} украл ${take} × +1 у ${target.name || target.id}.`);

      (G as any).pending = null;
    },

    // Persona 11 (Solovei): optional at start of turn
    persona11Skip: ({ G, ctx, playerID }: any) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_11_offer') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE;
      // Decline
      (G as any).pending = null;
    },

    persona11Use: ({ G, ctx, playerID }: any) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_11_offer') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE;
      if (G.hasDrawn) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;
      const i11 = (me.coalition || []).findIndex((c: any) => baseId(String(c.id)) === 'persona_11');
      if (i11 < 0) return INVALID_MOVE;

      const haveTargets = (G.players || []).some((pp: any) => {
        if (String(pp.id) === String(me.id)) return false;
        return (pp.coalition || []).some((c: any) => c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded);
      });
      if (!haveTargets) {
        (G as any).pending = null;
        return INVALID_MOVE;
      }

      // Skip draw this turn.
      G.hasDrawn = true;
      G.drawsThisTurn = 1;
      G.log.push(`${ruYou(me.name)} использует Соловья: добор пропущен.`);

      (G as any).pending = { kind: 'persona_11_pick_opponent_persona', playerId: String(playerID), sourceCardId: 'persona_11' } as any;
    },

    persona11DiscardOpponentPersona: ({ G, ctx, playerID }: any, ownerId: string, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_11_pick_opponent_persona') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;
      const i11 = (me.coalition || []).findIndex((c: any) => baseId(String(c.id)) === 'persona_11');
      if (i11 < 0) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner || String(owner.id) === String(playerID)) return INVALID_MOVE;
      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;
      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;
      if (target.shielded) return INVALID_MOVE;

      // Discard Solovei
      const [sol] = me.coalition.splice(i11, 1);
      if (sol) { G.discard.push(sol); if ((sol as any).type === 'persona') persona44OnPersonaDiscarded(G); }

      // Discard target
      const [drop] = owner.coalition.splice(idx, 1);
      if (drop) { G.discard.push(drop); if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G); }

      G.log.push(`${ruYou(me.name)} (Соловей): сбросил себя и ${drop?.name || drop?.id} у ${owner.name}.`);

      (G as any).pending = null;
      recalcPassives(G);
    },

    // Persona 17 (Arno): choose opponent, reveal hand, steal a persona into your hand.
    persona17PickOpponent: ({ G, ctx, playerID, events }: any, targetId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_17_pick_opponent') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE;

      const tid = String(targetId || '');
      if (!tid || tid === String(playerID)) return INVALID_MOVE;
      const target = (G.players || []).find((pp: any) => String(pp.id) === tid);
      if (!target) return INVALID_MOVE;

      const personaCount = (target.hand || []).filter((c: any) => c && c.type === 'persona').length;
      if (personaCount <= 0) {
        G.log.push(`${ruYou(String((G.players || []).find((pp: any) => String(pp.id) === String(playerID))?.name || ''))} (Арно): у ${target.name} нет персон в руке (пропуск).`);
        (G as any).pending = null;
        recalcPassives(G);
        // If turn is otherwise complete, auto-end.
        if (G.hasDrawn && G.hasPlayed && !G.response) {
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
        return;
      }

      (G as any).pending = { kind: 'persona_17_pick_persona_from_hand', playerId: String(playerID), sourceCardId: String(pend.sourceCardId || 'persona_17'), targetId: tid } as any;
    },

    persona17StealPersonaFromHand: ({ G, ctx, playerID }: any, cardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_17_pick_persona_from_hand') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      const target: any = (G.players || []).find((pp: any) => String(pp.id) === String(pend.targetId));
      if (!me || !target) return INVALID_MOVE;

      const idx = (target.hand || []).findIndex((c: any) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE;
      const c: any = target.hand[idx];
      if (!c || c.type !== 'persona') return INVALID_MOVE;

      target.hand.splice(idx, 1);
      me.hand.push(c);
      G.log.push(`${ruYou(me.name)} (Арно) забрал ${c.name || c.id} из руки ${target.name}.`);

      if (me.hand.length > 7) { (G as any).pending = { kind: 'discard_down_to_7', playerId: String(playerID), sourceCardId: 'hand_limit' } as any; } else { (G as any).pending = null; }
      recalcPassives(G);
    },

    // Persona 32: return a chosen persona from your coalition to your hand.
    persona32BounceToHand: ({ G, playerID }: any, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_32_pick_bounce_target') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      // this move resolves the pick; cancel is a separate move

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const idx = (me.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = me.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;

      me.coalition.splice(idx, 1);
      me.hand.push(target);
      G.log.push(`${actorWithPersona(me, 'persona_32')} вернул ${target.name || target.id} в руку.`);

      (G as any).pending = null;
      recalcPassives(G);
    },

    // Generic cancel for selected pendings (stability)
    cancelPending: ({ G, ctx, playerID }: any) => {
      const pend: any = (G as any).pending;
      if (!pend) return;

      // Only current player can cancel their own decision pendings.
      const ownerId = String(pend.playerId || pend.attackerId || pend.targetId || '');
      if (ownerId && String(ownerId) !== String(playerID)) return INVALID_MOVE;
      if (String(ctx.currentPlayer) !== String(playerID)) return INVALID_MOVE;

      const k = String(pend.kind || '');
      const ALLOW = new Set([
        'persona_3_choice',
        'persona_5_pick_liberal',
        'persona_7_swap_two_in_coalition',
        'persona_11_offer',
        'persona_11_pick_opponent_persona',
        'persona_13_pick_target',
        'persona_16_discard3_from_hand',
        'persona_17_pick_opponent',
        'persona_17_pick_persona_from_hand',
        'persona_20_pick_from_discard',
        'persona_21_pick_target_invert',
        'persona_23_choose_self_inflict_draw',
        'persona_26_pick_red_nationalist',
        'persona_28_pick_non_fbk',
        'persona_32_pick_bounce_target',
        'persona_33_choose_faction',
        'persona_34_guess_topdeck',
        'persona_37_pick_opponent_persona',
        'persona_45_steal_from_opponent',
        'action_7_block_persona',
        'action_13_shield_persona',
        'action_17_choose_opponent_persona',
        'action_18_pick_persona_from_discard',
      ]);
      if (!ALLOW.has(k)) return INVALID_MOVE;

      // Special: if canceling Action 7 targeting, refund the card and don't spend the turn.
      if (k === 'action_7_block_persona') {
        try {
          const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
          const la: any = (G as any).lastAction;
          if (me && la && baseId(String(la.id)) === 'action_7') {
            const di = (G.discard || []).findIndex((cc: any) => String(cc.id) === String(la.id));
            if (di >= 0) {
              const [back] = (G.discard || []).splice(di, 1);
              if (back) me.hand.push(back);
            }
            (G as any).lastAction = null;
            (G as any).hasPlayed = false;
          }
        } catch {}
      }

      // Clear pending.
      (G as any).pending = null;
      // NOTE: do not clear G.response here; response windows have their own skip.
      try { recalcPassives(G); } catch {}
    },

    // Persona 32: cancel (do nothing)
    persona32CancelBounce: ({ G, playerID }: any) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_32_pick_bounce_target') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      (G as any).pending = null;
    },

    persona37BribeAndSilence: ({ G, playerID }: any, ownerId: string, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_37_pick_opponent_persona') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner || String(owner.id) === String(playerID)) return INVALID_MOVE;
      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;
      if (target.shielded) return INVALID_MOVE;

      applyTokenDelta(G, target, 2);
      target.blockedAbilities = true;
      recalcPassives(G);

      const self37: any = (me.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_37');
      const selfName = String(self37?.name || self37?.text || 'persona_37');
      G.log.push(`${ruYou(me.name)} ${selfName} подкупил ${target.name || target.id} (+2) и навсегда заблокировал способности.`);

      (G as any).pending = null;
    },

    persona33ChooseFaction: ({ G, playerID }: any, factionTag: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_33_choose_faction') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const self: any = (me.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_33');
      if (!self) return INVALID_MOVE;

      const tag = String(factionTag || '');
      if (!tag.startsWith('faction:')) return INVALID_MOVE;

      // allow only known factions
      const KNOWN = new Set(['faction:liberal','faction:rightwing','faction:leftwing','faction:fbk','faction:red_nationalist','faction:system']);
      if (!KNOWN.has(tag)) return INVALID_MOVE;

      (self as any).chosenFactionTag = tag;
      recalcPassives(G);
      const pname = String(self?.name || self?.text || 'persona_33');
      G.log.push(`${ruYou(me.name)} ${pname} выбрала фракцию ${factionTitle(tag)}.`);

      (G as any).pending = null;
    },

    persona34GuessTopdeck: ({ G, ctx, playerID, events }: any, guessBaseId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_34_guess_topdeck') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const guess = String(guessBaseId || '');
      if (!guess || guess === 'skip') {
        (G as any).pending = null;
        G.log.push(`${actorWithPersona(me, 'persona_34')} пропустил гадание.`);
        return;
      }

      if (!milovEligiblePersonaBaseIds(G, String(playerID)).has(guess)) return INVALID_MOVE;

      // Look ahead for the next PERSONA card in the deck (skip events/actions).
      const deck: any[] = Array.isArray(G.deck) ? G.deck : [];
      let found: any = null;
      let skipped = 0;
      for (const c of deck) {
        if (!c) continue;
        if (c.type === 'persona') { found = c; break; }
        skipped++;
      }

      if (!found) {
        const guessName = personaTitleByBaseId(guess);
        G.log.push(`${actorWithPersona(me, 'persona_34')} загадал ${guessName}, но в колоде больше нет персон.`);
        (G as any).pending = null;
        return;
      }

      const actual = baseId(String(found.id));
      const guessName = personaTitleByBaseId(guess);
      const actualName = personaTitleByBaseId(actual);
      G.log.push(`${actorWithPersona(me, 'persona_34')} загадал ${guessName}. Следующая персона в колоде (${skipped} пропущено): ${actualName}.`);

      if (guess === actual) {
        G.gameOver = true;
        G.winnerId = String(playerID);
        G.victoryReason = 'milov_prediction';
        G.log.push(`${actorWithPersona(me, 'persona_34')}: угадал — мгновенная победа для ${ruYou(me.name)}.`);
        events.endGame?.();
      }

      (G as any).pending = null;
    },

    persona39ActivateRecycle: ({ G, ctx, playerID }: any) => {
      if (String(ctx.phase || '') !== 'action') return INVALID_MOVE;
      if (String(playerID) !== String(ctx.currentPlayer)) return INVALID_MOVE;
      if (G.pending) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const idx = (me.coalition || []).findIndex((c: any) => baseId(String(c.id)) === 'persona_39');
      if (idx < 0) return INVALID_MOVE;
      const [self] = me.coalition.splice(idx, 1);
      if (self) {
        // shuffle back into deck
        (G.deck || []).push(self);
        G.deck = shuffle(G.deck);
      }

      let buffed = 0;
      for (const c of (me.coalition || [])) {
        if (c.type !== 'persona') continue;
        if (Array.isArray((c as any).tags) && (c as any).tags.includes('faction:red_nationalist')) {
          applyTokenDelta(G, c as any, 2);
          buffed++;
        }
      }
      recalcPassives(G);
      G.log.push(`${actorWithPersona(me, 'persona_39')} вернул себя в колоду и усилил ${buffed} красн.нац. персонаж(ей) (+2).`);
    },

    persona45StealFromOpponent: ({ G, playerID }: any, targetId: string) => { 
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_45_steal_from_opponent') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const target = (G.players || []).find((pp: any) => String(pp.id) === String(targetId));
      if (!target || String(target.id) === String(playerID)) return INVALID_MOVE;

      const hand = target.hand || [];
      if (!hand.length) {
        G.log.push(`${ruYou(me.name)} (${pend.sourceCardId}) хотел украсть карту у ${target.name}, но у него пустая рука.`);
        (G as any).pending = null;
        return;
      }

      const idx = Math.floor(Math.random() * hand.length);
      const [stolen] = hand.splice(idx, 1);
      if (stolen) {
        me.hand.push(stolen);
        G.log.push(`Вы с Шульман забрали 1 карту у ${target.name}.`);
      }

      (G as any).pending = null;
    },

    // Action 7: pick any persona (any coalition); its abilities are blocked and all vpDelta tokens are cleared.
    blockPersonaForAction7: ({ G, playerID, ctx, events }: any, ownerId: string, coalitionCardId: string) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'action_7_block_persona') return INVALID_MOVE;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE;

      const owner = (G.players || []).find((pp: any) => String(pp.id) === String(ownerId));
      if (!owner) return INVALID_MOVE;
      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;

      // persona_36 ignores action_7; if targeted, it gains +4 instead.
      if (baseId(String(target.id)) === 'persona_36') {
        applyTokenDelta(G, target, 4);
        recalcPassives(G);
        const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
        G.log.push(`${ruYou(me?.name || playerID)} выдал ${target.name || target.id} статус ИНОАГЕНТА, но тот проигнорировал и получил +4.`);
      } else {
        // Clear token deltas.
        target.vpDelta = 0;
        (target as any).plusTokens = 0;
        (target as any).minusTokens = 0;
        target.passiveVpDelta = 0;
        target.vp = Number(target.baseVp ?? 0);
        recalcPassives(G);
        target.blockedAbilities = true;
        target.blockedBy = 'action_7';

        const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
        G.log.push(`${ruYou(me?.name || playerID)} выдал ${target.name || target.id} статус ИНОАГЕНТА: способности заблокированы, жетоны сброшены.`);
      }

      (G as any).pending = null;
      // Action card itself was already discarded on playAction; turn already marked played.
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    // Action 13: shield one of YOUR personas – cannot be targeted; +1 gains reduced by 1.
    shieldPersonaForAction13: ({ G, playerID, ctx, events }: any, coalitionCardId: string) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'action_13_shield_persona') return INVALID_MOVE;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE;

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;
      const idx = (me.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = me.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;

      target.shielded = true;
      target.shieldedBy = 'action_13';
      G.log.push(`${ruYou(me.name)} разыграл Белое пальто на ${target.name || target.id}`);

      (G as any).pending = null;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    // Action 17: attacker chooses an opponent persona to receive -1 tokens (normally 2, or 4 for special ids).
    applyAction17ToPersona: ({ G, playerID, ctx, events }: any, targetPersonaId: string) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'action_17_choose_opponent_persona') return INVALID_MOVE;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE;

      // find persona in opponents' coalitions
      const owner = (G.players || []).find((pp: any) => String(pp.id) !== String(playerID) && (pp.coalition || []).some((c: any) => String(c.id) === String(targetPersonaId)));
      if (!owner) return INVALID_MOVE;
      const idx = (owner.coalition || []).findIndex((c: any) => String(c.id) === String(targetPersonaId));
      if (idx < 0) return INVALID_MOVE;

      const target: any = owner.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;
      if (target.shielded) return INVALID_MOVE; // cannot target shielded personas

      const base = baseId(String(target.id));
      const special = base === 'persona_3' || base === 'persona_38' || base === 'persona_41' || base === 'persona_43';
      const tokens = special ? 4 : 2;

      applyTokenDelta(G, target, -tokens);

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      const an = actionTitle((G as any).lastAction) || 'ACTION 17';
      G.log.push(`${ruYou(me?.name || playerID)} использовал ${an} на ${target.name || target.id}: ${special ? '4' : '2'} × -1.`);

      (G as any).pending = null;
      recalcPassives(G);
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    // Action 18: return a persona from discard to your hand.
    pickPersonaFromDiscardForAction18: ({ G, playerID, ctx, events }: any, cardId: string) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'action_18_pick_persona_from_discard') return INVALID_MOVE;
      if (String(pend.attackerId) !== String(playerID)) return INVALID_MOVE;

      const idx = (G.discard || []).findIndex((c: any) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE;
      const c: any = G.discard[idx];
      if (!c || c.type !== 'persona') return INVALID_MOVE;
      if (baseId(String(c.id)) === 'persona_31') return INVALID_MOVE;

      G.discard.splice(idx, 1);
      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;
      me.hand.push(c);

      G.log.push(`${ruYou(me.name)} вернул ${c.name || c.id} из сброса в руку используя "воскресить политический труп".`);

      (G as any).pending = null;
      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    persona16Discard3FromHand: ({ G, playerID }: any, cardIdA: string, cardIdB: string, cardIdC: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_16_discard3_from_hand') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      const ids = [cardIdA, cardIdB, cardIdC].map(String);
      // allow discarding fewer if hand smaller
      const unique = Array.from(new Set(ids)).filter((x) => x && x !== 'undefined' && x !== 'null');
      const toDiscard = unique.slice(0, Math.min(3, (me.hand || []).length));

      for (const id of toDiscard) {
        const i = (me.hand || []).findIndex((c: any) => String(c.id) === String(id));
        if (i >= 0) {
          const [drop] = me.hand.splice(i, 1);
          if (drop) {
            G.discard.push(drop);
            if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
          }
        }
      }

      (G as any).pending = null;
      try { expireResponseAndResolveDeferred(G); } catch {}
      recalcPassives(G);
      G.log.push(`${ruYou(me.name)} (${pend.sourceCardId}) сбросил ${toDiscard.length} карт(ы) после добора 3.`);
    },

    // Persona 20: pick an action card from discard.
    persona20PickFromDiscard: ({ G, playerID }: any, cardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_20_pick_from_discard') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;

      const idx = (G.discard || []).findIndex((c: any) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE;
      const c: any = G.discard[idx];
      if (!c) return INVALID_MOVE;
      if (c.type !== 'action') return INVALID_MOVE;

      G.discard.splice(idx, 1);
      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;
      me.hand.push(c);

      const title = c.type === 'action' ? actionTitle(c) : (c.name || c.id);
      G.log.push(`${ruYou(me.name)} используя Быкова взял «${title}» из сброса.`);

      (G as any).pending = null;
    },

    // Tick for human turns too: clears expired response windows, resolves deferred abilities,
    // and can auto-end a stuck human turn after the response window closes.
    tick: ({ G, ctx, events }: any) => {
      try {
        if (String(ctx.phase || '') !== 'action') return INVALID_MOVE;
        expireResponseAndResolveDeferred(G);

        // If the current player already drew+played, end the turn even if pending belongs to OTHER players.
        const pk: any = (G as any).pending;
        const pendingBlocksCurrent = (() => {
          if (!pk) return false;
          if (pk.kind === 'event_12b_discard_from_hand') {
            const targets: string[] = Array.isArray(pk.targetIds) ? pk.targetIds.map(String) : [];
            return targets.includes(String(ctx.currentPlayer));
          }
          return true;
        })();

        if (!G.response && !pendingBlocksCurrent && G.hasDrawn && G.hasPlayed) {
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
      } catch {}
    },

    tickBot: ({ G, ctx, events }: any) => {
      try {
        if (String(ctx.phase || '') !== 'action') return INVALID_MOVE;
        // Keep bot turns progressing even if a response window expired or a deferred ability is ready.
        expireResponseAndResolveDeferred(G);

        // Response windows: never auto-clear if a human could still react (action_6/action_8).
        const rr: any = (G as any).response;
        // Ensure global pause never outlives the response.
        if (rr && Number((G as any).botPauseUntilMs || 0) > Number(rr.expiresAtMs || 0)) {
          (G as any).botPauseUntilMs = Number(rr.expiresAtMs || 0);
        }
        if (rr && responseExpired(G)) {
          (G as any).response = null;
        }
        // Bots must be able to answer a human's persona play out of turn.
        // Previously tickBot only drove the current player, so Action 8 sat unused
        // whenever the human was still the active player during the response window.
        if (rr && rr.kind === 'cancel_persona' && !responseExpired(G) && baseId(String(rr.personaCard?.id || '')) !== 'persona_33') {
          const responder: any = (G.players || []).find((pp: any) => {
            const isBot = !!pp?.isBot || String(pp?.name || '').startsWith('[B]');
            return isBot
              && String(pp.id) !== String(rr.playedBy)
              && botShouldCancelPersona(G, rr)
              && (pp.hand || []).some((c: any) => c?.type === 'action' && baseId(String(c.id)) === 'action_8');
          });
          if (responder) {
            const handIndex = responder.hand.findIndex((c: any) => c?.type === 'action' && baseId(String(c.id)) === 'action_8');
            const [cancel] = responder.hand.splice(handIndex, 1);
            if (cancel) G.discard.push(cancel);
            const playedId = String(rr.personaCard?.id || '');
            for (const owner of (G.players || [])) {
              const coalitionIndex = (owner.coalition || []).findIndex((c: any) => String(c.id) === playedId);
              if (coalitionIndex < 0) continue;
              const [removed] = owner.coalition.splice(coalitionIndex, 1);
              if (removed) {
                G.discard.push(removed);
                if ((removed as any).type === 'persona') persona44OnPersonaDiscarded(G);
              }
              break;
            }
            (G as any).pending = null;
            (G as any).response = null;
            for (const pp of (G.players || [])) for (const card of (pp.coalition || [])) {
              const bid = baseId(String(card.id));
              if (bid === 'persona_6') applyTokenDelta(G, card, 1);
              if (bid === 'persona_29') applyTokenDelta(G, card, -1);
            }
            recalcPassives(G);
            G.log.push(`${responder.name} сыграл «Работа на Кремль» и отменил ${rr.personaCard?.name || rr.personaCard?.id}.`);
            (G as any).botPauseUntilMs = 0;
            // The played bot had already completed its play, but its turn was
            // held open while the response window was active.  Finish that
            // turn immediately after cancellation; otherwise the cancelled
            // bot can sit forever with hasPlayed=true and no pending move.
            const cancelledPlayer: any = (G.players || []).find((pp: any) => String(pp.id) === String(rr.playedBy));
            if (String(ctx.currentPlayer) === String(rr.playedBy)
              && cancelledPlayer
              && (!!cancelledPlayer.isBot || String(cancelledPlayer.name || '').startsWith('[B]'))
              && G.hasDrawn && G.hasPlayed && !(G as any).pending) {
              if (maybeEndAfterRound(G, ctx, events)) return;
              events.endTurn?.();
            } else {
              G.botNextActAtMs = nowMs() + 250;
            }
            return;
          }
        }
        const p = (G.players || []).find((pp: any) => String(pp.id) === String(ctx.currentPlayer));
        const isBot = !!(p as any)?.isBot || String(p?.name || '').startsWith('[B]');
        if (!p || !isBot) return INVALID_MOVE;
        debugTrace(G, 'bot_tick', {
          player: String(p.id), turn: Number(ctx.turn || 0),
          hasDrawn: !!G.hasDrawn, hasPlayed: !!G.hasPlayed,
          draws: Number(G.drawsThisTurn || 0), plays: Number(G.playsThisTurn || 0),
          pending: G.pending?.kind || null, response: G.response?.kind || null,
          turnStartedAtMs: Number(G.turnStartedAtMs || 0),
          botNextActAtMs: Number(G.botNextActAtMs || 0), botPauseUntilMs: Number(G.botPauseUntilMs || 0),
        });

        // Keep bot turns visibly paused during the event flyby, but continue
        // ticking so the hard-cap watchdog can recover genuinely stuck turns.
        if (Number((G as any).eventRevealPauseUntilMs || 0) > nowMs()) return;

        // Hard cap: if a bot turn takes too long, force-skip it.
        try {
          const started = Number((G as any).turnStartedAtMs || 0);
          if (started && (nowMs() - started) > 20_000) {
            debugTrace(G, 'bot_hard_cap', { player: String(p.id), elapsedMs: nowMs() - started });
            try { (G as any).pending = null; } catch {}
            try { (G as any).response = null; } catch {}
            try { (G as any).botPauseUntilMs = 0; } catch {}
            try { (G as any).hasDrawn = true; } catch {}
            try { (G as any).hasPlayed = true; } catch {}
            try { G.log.push(`${ruYou(p.name)} turn auto-skipped (20s hard cap).`); } catch {}
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
            return;
          }
        } catch {}

        const pause = Number((G as any).botPauseUntilMs || 0);
        if (pause && nowMs() < pause) return; // global wait

        const t = Number(G.botNextActAtMs || 0);
        if (t && nowMs() < t) return; // wait

        // If a response window is open (e.g. action_8 cancel), don't let bots chain-play and overwrite the target.
        if (G.response && !responseExpired(G)) {
          G.botNextActAtMs = nowMs() + 250;
          return;
        }

        // Resolve bot-owned pendings first (prevents stalls)
        const pend0: any = (G as any).pending;

        // persona_11 offer: bots always skip (keeps them from self-nuking their draw)
        if (pend0 && pend0.kind === 'persona_11_offer' && String(pend0.playerId) === String(p.id)) {
          (G as any).pending = null;
          G.botNextActAtMs = nowMs() + 250;
          return;
        }

        // Action 4: bots also pay the casting cost and choose a target instead
        // of leaving the new two-step interaction pending indefinitely.
        if (pend0 && pend0.kind === 'action_4_discard_cost' && String(pend0.playerId) === String(p.id)) {
          const cost = (p.hand || [])[0];
          if (!cost) {
            (G as any).pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          p.hand.splice(0, 1);
          G.discard.push(cost);
          G.pending = { kind: 'action_4_choose_target', playerId: String(p.id), sourceCardId: String(pend0.sourceCardId), costCardId: String(cost.id) } as any;
          G.log.push(`${ruYou(p.name)} сбросил ${cost.name || cost.id} как стоимость действия.`);
          G.botNextActAtMs = nowMs() + 300;
          return;
        }

        if (pend0 && pend0.kind === 'action_4_choose_target' && String(pend0.playerId) === String(p.id)) {
          const target: any = [...(G.players || [])]
            .filter((pp: any) => pp.active && String(pp.id) !== String(p.id))
            .sort((a: any, b: any) => scorePlayer(b) - scorePlayer(a))[0];
          if (!target) {
            (G as any).pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          const tid = String(target.id);
          const actionCard: any = (G.lastAction && baseId(String(G.lastAction.id)) === 'action_4') ? G.lastAction : { id: pend0.sourceCardId, type: 'action' };
          G.response = {
            kind: 'cancel_action', playedBy: String(p.id), actionCard,
            expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_action', String(p.id)),
            allowPersona10By: (target.coalition || []).some((x: any) => baseId(String(x.id)) === 'persona_10') ? tid : null,
          } as any;
          G.pending = { kind: 'action_4_discard', attackerId: String(p.id), targetId: tid, sourceCardId: String(pend0.sourceCardId) } as any;
          G.log.push(`${ruYou(p.name)} выбрал целью действия ${target.name}.`);
          if (String(target.name || '').startsWith('[B]')) {
            const dropIndex = action4BotDiscardIndex(target);
            const drop = dropIndex >= 0 ? (target.coalition || []).splice(dropIndex, 1)[0] : null;
            if (drop) { G.discard.push(drop); if (drop.type === 'persona') persona44OnPersonaDiscarded(G); G.log.push(`${target.name} сбросил ${drop.name || drop.id} из коалиции.`); }
            G.pending = null;
            G.response = null;
            recalcPassives(G);
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
          }
          return;
        }

        // persona_17: pick opponent with most personas in hand, then steal first persona
        if (pend0 && pend0.kind === 'persona_17_pick_opponent' && String(pend0.playerId) === String(p.id)) {
          let best: any = null;
          let bestCount = -1;
          for (const opp of (G.players || [])) {
            if (String(opp.id) === String(p.id)) continue;
            const cnt = (opp.hand || []).filter((c: any) => c && c.type === 'persona').length;
            if (cnt > bestCount) { bestCount = cnt; best = opp; }
          }
          if (!best || bestCount <= 0) {
            (G as any).pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          (G as any).pending = { kind: 'persona_17_pick_persona_from_hand', playerId: String(p.id), sourceCardId: String(pend0.sourceCardId || 'persona_17'), targetId: String(best.id) } as any;
          G.botNextActAtMs = nowMs() + 250;
          return;
        }

        if (pend0 && pend0.kind === 'persona_17_pick_persona_from_hand' && String(pend0.playerId) === String(p.id)) {
          const target: any = (G.players || []).find((pp: any) => String(pp.id) === String(pend0.targetId));
          const idx = (target?.hand || []).findIndex((c: any) => c && c.type === 'persona');
          if (!target || idx < 0) {
            (G as any).pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }
          const c: any = target.hand[idx];
          target.hand.splice(idx, 1);
          p.hand.push(c);
          G.log.push(`${ruYou(p.name)} (Арно) забрал ${c.name || c.id} из руки ${target.name}.`);
          (G as any).pending = null;
          recalcPassives(G);
          G.botNextActAtMs = nowMs() + 600;
          return;
        }

        if (pend0 && pend0.kind === 'place_tokens_plus_vp' && String(pend0.playerId) === String(p.id)) {
          const coal = (p.coalition || []).filter((x: any) => x && x.type === 'persona');
          if (!coal.length) {
            try {
              const src = String(pend0.sourceCardId || '');
              const title = eventTitle({ id: src });
              G.log.push(`${ruYou(p.name)} Событие - ${title}: некуда ставить жетоны (пропуск).`);
            } catch {
              G.log.push(`${ruYou(p.name)}: некуда ставить жетоны (автоскип).`);
            }
            (G as any).pending = null;
            recalcPassives(G);
            return;
          }
          const target: any = coal.find((x: any) => String(x.id) === String(pend0.targetCardId)) || coal[0];
          pend0.targetCardId = String(target.id);
          const burst = Math.max(0, Number(pend0.remaining || 0) * Number(pend0.delta || 1));
          const applied = target.shielded && burst > 0 ? Math.max(0, burst - 1) : burst;
          if (applied) applyTokenDelta(G, target, applied);
          pend0.remaining = 0;
          (G as any).pending = null;
          recalcPassives(G);
          try { expireResponseAndResolveDeferred(G); } catch {}
          if (!(G as any).pending && !(G as any).persona16AfterEvents && G.hasDrawn && G.hasPlayed && !(G as any).response) {
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
          } else G.botNextActAtMs = nowMs() + 900;
          return;
        }

        // Resolve deferred persona abilities once cancel window is gone.
        if (maybeResolveDeferredPersona(G)) {
          // The deferred ability may have created a bot-owned picker (for
          // example Duntsova's token placement). Service it on the next tick
          // without adding another visible turn-sized pause.
          G.botNextActAtMs = nowMs() + 100;
          return;
        }

        // Draw if needed
        if (!G.hasDrawn) {
          const c = G.deck.shift();
          if (c) {
            if (c.type === 'event') {
              G.lastEvent = c;
              pauseBotsForEventReveal(G);
              const bid = baseId(String(c.id));
              if (bid === 'event_10') {
                G.log.push(`${p.name} попался "Перевод в криптоколонию"`);
              } else if (bid === 'event_11') {
                G.log.push(`${p.name} попался тайный удвоитель!`);
              } else if (bid === 'event_15') {
                G.log.push(`${ruYou(p.name)}: вам выпал ЧЕРНЫЙ ЛЕБЕДЬ`);
              } else {
                const evName = eventTitle(c);
                G.log.push(`${ruYou(p.name)} ${ruDrewVerb(p.name)} ${evName}`);
              }

              // Persona_4: whenever a twitter squabble is played, it gets two -1 tokens.
              try {
                if (Array.isArray((c as any).tags) && (c as any).tags.includes('event_type:twitter_squabble')) {
                  for (const pp of (G.players || [])) {
                    for (const cc of (pp.coalition || [])) {
                      if (baseId(String(cc.id)) === 'persona_4') applyTokenDelta(G, cc, -2);
                    }
                  }
                }
              } catch {}

              runAbility(c.abilityKey, { G, me: p, card: c });

              persona38OnEventPlayed(G, c);

              recalcPassives(G);
              G.discard.push(c);
            } else {
              p.hand.push(c);
              G.log.push(`${p.name} берет карту`);
            }
          }
          G.hasDrawn = true;
          G.drawsThisTurn = 1;
        }

        // Resolve pending interactions for bots.
        // Note: some bot persona abilities create pendings on-enter; we must resolve those even if a response window exists.
        const pend: any = (G as any).pending;

        // If a response window is active, only pause if there is no bot-owned pending to resolve.
        if (G.response && !responseExpired(G)) {
          const ownerId = String(pend?.playerId ?? pend?.attackerId ?? '');
          if (ownerId !== String(p.id)) return;
        }
        if (pend) {
          // Roizman: bots discard the strongest eligible opponent persona,
          // falling back to any eligible persona only when necessary.
          if (pend.kind === 'discard_one_persona_from_any_coalition' && String(pend.playerId) === String(p.id)) {
            const owners = [...(G.players || [])].sort((a: any, b: any) => Number(String(b.id) !== String(p.id)) - Number(String(a.id) !== String(p.id)));
            let owner: any = null;
            let index = -1;
            let bestVp = -Infinity;
            for (const candidate of owners) {
              for (let i = 0; i < (candidate.coalition || []).length; i++) {
                const card: any = candidate.coalition[i];
                if (!card || card.type !== 'persona' || card.shielded) continue;
                const vp = Number(card.vp || 0);
                if (vp > bestVp) { owner = candidate; index = i; bestVp = vp; }
              }
              if (owner && String(owner.id) !== String(p.id)) break;
            }
            if (owner && index >= 0) {
              const [drop] = owner.coalition.splice(index, 1);
              if (drop) { G.discard.push(drop); persona44OnPersonaDiscarded(G); }
              G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}) сбросил ${drop?.name || drop?.id} из коалиции ${owner.name}.`);
            }
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // Katz: bots deterministically discard up to three cards after drawing.
          // This used to have no bot resolver, leaving the turn permanently pending.
          if (pend.kind === 'persona_16_discard3_from_hand' && String(pend.playerId) === String(p.id)) {
            const drops = (p.hand || []).splice(0, Math.min(3, (p.hand || []).length));
            for (const drop of drops) {
              if (!drop) continue;
              G.discard.push(drop);
              if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
            }
            (G as any).pending = null;
            recalcPassives(G);
            G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}) сбросил ${drops.length} карт(ы) после добора 3.`);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // token placement
          if (pend.kind === 'place_tokens_plus_vp' && String(pend.playerId) === String(p.id)) {
            const myCoal = (p.coalition || []).filter((c: any) => c && c.type === 'persona');
            const target: any = myCoal.find((c: any) => String(c.id) === String(pend.targetCardId)) || myCoal[0];
            if (target) pend.targetCardId = String(target.id);
            if (target) {
              const burst = Math.max(0, Number(pend.remaining || 0) * Number(pend.delta || 1));
              const delta = target.shielded && burst > 0 ? Math.max(0, burst - 1) : burst;
              if (delta) applyTokenDelta(G, target, delta);
              const srcBid = String(pend.sourceCardId || '').split('#')[0];
              if (Number(pend.remaining || 0) === 4 && srcBid === 'event_10') {
                G.log.push(`${ruYou(p.name)} распределил четыре +1 токена на ${target.name || target.id}.`);
              }
              pend.remaining = 0;
              (G as any).pending = null;
            } else {
              (G as any).pending = null;
            }
            recalcPassives(G);
            try { expireResponseAndResolveDeferred(G); } catch {}
            if (!(G as any).pending && !(G as any).persona16AfterEvents && G.hasDrawn && G.hasPlayed && !(G as any).response) {
              if (maybeEndAfterRound(G, ctx, events)) return;
              events.endTurn?.();
            } else G.botNextActAtMs = nowMs() + 600;
            return;
          }

          // persona_3 choice: bots only discard an opponent's left-wing persona;
          // if none is available they take option B instead of hurting themselves.
          if (pend.kind === 'persona_3_choice' && String(pend.playerId) === String(p.id)) {
            try {
              const owners = (G.players || []).filter((pp: any) => String(pp.id) !== String(p.id) && (pp.coalition || []).some((c: any) => c.type === 'persona' && Array.isArray(c.tags) && c.tags.includes('faction:leftwing') && !c.shielded));
              const owner = owners[0];
              if (owner) {
                const j = (owner.coalition || []).findIndex((c: any) => c.type === 'persona' && Array.isArray(c.tags) && c.tags.includes('faction:leftwing') && !c.shielded);
                if (j >= 0) {
                  const [drop] = owner.coalition.splice(j, 1);
                  if (drop) G.discard.push(drop);
                  G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}): сбросил ${drop?.name || drop?.id} (левые) у ${owner.name}.`);
                }
              } else {
                let removed = 0;
                for (const pp of (G.players || [])) {
                  for (const c of (pp.coalition || [])) {
                    if (c.type !== 'persona') continue;
                    if (!Array.isArray(c.tags) || !c.tags.includes('faction:leftwing')) continue;
                    const cur = Number(c.vpDelta || 0);
                    const take = Math.max(0, cur);
                    if (take > 0) { applyTokenDelta(G, c, -take); removed += take; }
                  }
                }
                G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}): снял ${removed} × +1 со всех левых.`);
              }
            } catch {}
            try {
              const self: any = (p.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_3');
              if (self) applyTokenDelta(G, self, -1);
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_5 pick liberal: discard first available liberal persona from opponents.
          if (pend.kind === 'persona_5_pick_liberal' && String(pend.playerId) === String(p.id)) {
            try {
              const self: any = (p.coalition || []).find((c: any) => String(c.id) === String(pend.sourceCardId));
              const owners = (G.players || []).filter((pp: any) => String(pp.id) !== String(p.id));
              let picked = false;
              for (const owner of owners) {
                const j = (owner.coalition || []).findIndex((c: any) => c.type === 'persona' && !['persona_31', 'persona_9'].includes(baseId(String(c.id))) && !c.shielded && Array.isArray(c.tags) && c.tags.includes('faction:liberal'));
                if (j < 0) continue;
                const [drop] = owner.coalition.splice(j, 1);
                if (drop) {
                  G.discard.push(drop);
                  const tok = Number(drop.vpDelta || 0);
                  if (tok && self) applyTokenDelta(G, self, tok);
                  G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}): сбросил ${drop?.name || drop?.id} и украл ${tok} жетон(ов).`);
                }
                picked = true;
                break;
              }
              if (!picked) G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}): нет либерала для сброса.`);
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            // Critical: if bot doesn't have a client ticking, end the turn proactively.
            try {
              if (!G.response && !(G as any).pending && G.hasDrawn && G.hasPlayed) {
                if (maybeEndAfterRound(G, ctx, events)) return;
                events.endTurn?.();
                return;
              }
            } catch {}
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_20 pick from discard: take first ACTION card
          if (pend.kind === 'persona_20_pick_from_discard' && String(pend.playerId) === String(p.id)) {
            try {
              const idx = (G.discard || []).findIndex((c: any) => c && c.type === 'action');
              if (idx >= 0) {
                const [c] = G.discard.splice(idx, 1);
                if (c) {
                  p.hand.push(c);
                  const actionName = actionTitle(c);
                  G.log.push(`${p.name} используя Быкова взял ${actionName} из сброса.`);
                }
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_21 invert tokens: punish the current opponent leader's strongest +token stack.
          if (pend.kind === 'persona_21_pick_target_invert' && String(pend.playerId) === String(p.id)) {
            try {
              const eligible = (owner: any) => (owner.coalition || []).filter((cc: any) => cc?.type === 'persona' && baseId(String(cc.id)) !== 'persona_31' && !cc.shielded);
              const plus = (cc: any) => Number((cc as any).plusTokens ?? Math.max(0, Number(cc.vpDelta || 0)));
              const opponents = (G.players || []).filter((pp: any) => String(pp.id) !== String(p.id) && pp.active);
              const ranked = [...opponents].sort((a: any, b: any) => scorePlayer(b) - scorePlayer(a));
              let owner: any = ranked.find((pp: any) => eligible(pp).length) || null;
              let card: any = owner ? [...eligible(owner)].sort((a: any, b: any) => plus(b) - plus(a))[0] : null;

              // If the leader has no eligible persona, use the biggest positive stack anywhere else.
              if (!card || plus(card) <= 0) {
                const choices = opponents.flatMap((pp: any) => eligible(pp).map((cc: any) => ({ owner: pp, card: cc })));
                choices.sort((a: any, b: any) => plus(b.card) - plus(a.card));
                owner = choices[0]?.owner || null;
                card = choices[0]?.card || null;
              }
              if (owner && card) {
                const before = Number(card.vpDelta || 0);
                const prevPlus = Number((card as any).plusTokens ?? Math.max(0, before));
                const prevMinus = Number((card as any).minusTokens ?? Math.max(0, -before));
                (card as any).plusTokens = prevMinus;
                (card as any).minusTokens = prevPlus;
                card.vpDelta = -before;
                recalcPassives(G);
                G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}) перевернул жетоны на ${card.name || card.id} (${before} → ${card.vpDelta}).`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_23 self-inflict: pick 0..3 (bots pick 2)
          if (pend.kind === 'persona_23_choose_self_inflict_draw' && String(pend.playerId) === String(p.id)) {
            try {
              const self: any = (p.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_23');
              const k = self ? 2 : 0;
              if (self && k) applyTokenDelta(G, self, -k);
              for (let i = 0; i < k; i++) {
                const next = (G.deck || []).shift();
                if (!next) break;
                if (next.type === 'event') {
                  G.lastEvent = next;
                  const evName = eventTitle(next);
                  G.log.push(`${ruYou(p.name)} ${ruDrewVerb(p.name)} ${evName} (из "${cardTitle(pend.sourceCardId)}")`);
                  runAbility(next.abilityKey, { G, me: p, card: next });
                  persona38OnEventPlayed(G, next);
                  G.discard.push(next);
                } else {
                  p.hand.push(next);
                  G.log.push(`${ruYou(p.name)} взял карту из ${pend.sourceCardId}.`);
                }
              }
              G.log.push(`${actorWithPersona(p, 'persona_23')} взял ${k} × -1 и вытянул ${k} карт.`);
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 600;
            return;
          }

          // persona_28 steal plus tokens: pick first valid non-FBK persona
          if (pend.kind === 'persona_28_pick_non_fbk' && String(pend.playerId) === String(p.id)) {
            try {
              const self: any = (p.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_28');
              if (self) {
                const candidates: any[] = (G.players || [])
                  .filter((owner: any) => String(owner.id) !== String(p.id) && owner.active)
                  .flatMap((owner: any) => (owner.coalition || [])
                    .filter((cc: any) => cc?.type === 'persona' && baseId(String(cc.id)) !== 'persona_31' && !cc.shielded && !(cc.tags || []).includes('faction:fbk'))
                    .map((card: any) => ({ owner, card, plus: Number(card.plusTokens ?? Math.max(0, Number(card.vpDelta || 0))) })));
                const leader = [...(G.players || [])]
                  .filter((owner: any) => String(owner.id) !== String(p.id) && owner.active)
                  .sort((a: any, b: any) => scorePlayer(b) - scorePlayer(a))[0];
                // Prefer the largest stealable stack. The leader is only a
                // tie-breaker, so a rich non-leader beats a leader with 0.
                candidates.sort((a: any, b: any) => (b.plus - a.plus)
                  || (String(a.owner.id) === String(leader?.id) ? -1 : 0)
                  || (String(b.owner.id) === String(leader?.id) ? 1 : 0));
                const target = candidates[0]?.card || null;
                const targetOwner = candidates[0]?.owner || null;
                if (target && targetOwner) {
                  const want = 3;
                  const avail = Number((target as any).plusTokens ?? Math.max(0, Number(target.vpDelta || 0)));
                  const take = Math.min(want, avail);
                  if (take) {
                    const minus = Number((target as any).minusTokens ?? Math.max(0, -Number(target.vpDelta || 0)));
                    (target as any).plusTokens = avail - take;
                    (target as any).minusTokens = minus;
                    target.vpDelta = (avail - take) - minus;
                    applyTokenDelta(G, self, take);
                  }
                  recalcPassives(G);
                  G.log.push(`${actorWithPersona(p, 'persona_28')} украл ${take} × +1 у ${target.name || target.id}.`);
                }
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_32 bounce: shed the coalition's worst current VP burden.
          // Current VP already includes printed value, passive effects, and +/- tokens.
          if (pend.kind === 'persona_32_pick_bounce_target' && String(pend.playerId) === String(p.id)) {
            try {
              const candidates = (p.coalition || []).filter((c: any) => c?.type === 'persona');
              candidates.sort((a: any, b: any) => Number(a.vp ?? a.baseVp ?? 0) - Number(b.vp ?? b.baseVp ?? 0));
              const target: any = candidates[0];
              if (target && Number(target.vp ?? target.baseVp ?? 0) < 0) {
                const index = p.coalition.findIndex((c: any) => String(c.id) === String(target.id));
                if (index >= 0) {
                  p.coalition.splice(index, 1);
                  p.hand.push(target);
                  G.log.push(`${actorWithPersona(p, 'persona_32')} вернул ${target.name || target.id} в руку, избавившись от ${target.vp} VP.`);
                }
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_33 choose faction: bots auto-pick a faction (avoid wedging the match)
          if (pend.kind === 'persona_33_choose_faction' && String(pend.playerId) === String(p.id)) {
            try {
              const KNOWN = ['faction:liberal','faction:rightwing','faction:leftwing','faction:fbk','faction:red_nationalist','faction:system'];
              const counts: Record<string, number> = {};
              for (const cc of (p.coalition || [])) {
                if (!cc || cc.type !== 'persona') continue;
                const tags: any[] = Array.isArray((cc as any).tags) ? (cc as any).tags : [];
                const ft = tags.find((t) => typeof t === 'string' && t.startsWith('faction:')) as (string | undefined);
                if (ft && KNOWN.includes(ft)) counts[ft] = (counts[ft] || 0) + 1;
              }
              let tag = 'faction:liberal';
              let best = -1;
              for (const k of Object.keys(counts)) {
                const v = counts[k] || 0;
                if (v > best) { best = v; tag = k; }
              }
              const self: any = (p.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_33');
              if (self) {
                (self as any).chosenFactionTag = tag;
                G.log.push(`${actorWithPersona(p, 'persona_33')} выбрал фракцию ${tag}.`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 250;
            return;
          }

          // persona_34 guess: make a real legal prediction and reveal both sides
          // in the Chronicle. Hidden opponent hands intentionally stay eligible.
          if (pend.kind === 'persona_34_guess_topdeck' && String(pend.playerId) === String(p.id)) {
            const choices = [...milovEligiblePersonaBaseIds(G, String(p.id))];
            const guess = choices[Math.floor(Math.random() * choices.length)];
            const nextPersona = (G.deck || []).find((c: any) => c?.type === 'persona');
            if (!guess) {
              G.log.push(`${actorWithPersona(p, 'persona_34')} пропустил гадание: подходящих персон не осталось.`);
            } else if (!nextPersona) {
              G.log.push(`${actorWithPersona(p, 'persona_34')} загадал ${personaTitleByBaseId(guess)}, но в колоде больше нет персон.`);
            } else {
              const actual = baseId(String(nextPersona.id));
              G.log.push(`${actorWithPersona(p, 'persona_34')} загадал ${personaTitleByBaseId(guess)}. Следующая персона в колоде: ${personaTitleByBaseId(actual)}.`);
              if (guess === actual) {
                G.gameOver = true;
                G.winnerId = String(p.id);
                G.victoryReason = 'milov_prediction';
                G.log.push(`${actorWithPersona(p, 'persona_34')}: угадал — мгновенная победа для ${ruYou(p.name)}.`);
                events.endGame?.();
              }
            }
            (G as any).pending = null;
            G.botNextActAtMs = nowMs() + 250;
            return;
          }

          // persona_13 retaliation: bots pick first attacker persona
          if (pend.kind === 'persona_13_pick_target' && String(pend.playerId) === String(p.id)) {
            try {
              const attacker: any = (G.players || []).find((pp: any) => String(pp.id) === String(pend.attackerId));
              const target: any = (attacker?.coalition || []).find((c: any) => c && c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded);
              if (target) {
                applyTokenDelta(G, target, -1);
                recalcPassives(G);
                G.log.push(`${ruYou(p.name)} (Венедитков): дал -1 на ${target.name || target.id}.`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 250;
            return;
          }

          // action_7 block persona: bots pick first valid persona
          if (pend.kind === 'action_7_block_persona' && String(pend.attackerId) === String(p.id)) {
            try {
              let target: any = null;
              for (const owner of (G.players || [])) {
                for (const cc of (owner.coalition || [])) {
                  if (!cc || cc.type !== 'persona') continue;
                  if (baseId(String(cc.id)) === 'persona_31') continue;
                  if (cc.shielded) continue;
                  target = cc;
                  break;
                }
                if (target) break;
              }
              if (target) {
                target.vpDelta = 0;
                (target as any).plusTokens = 0;
                (target as any).minusTokens = 0;
                target.passiveVpDelta = 0;
                target.vp = Number(target.baseVp ?? 0);
                target.blockedAbilities = true;
                target.blockedBy = 'action_7';
                recalcPassives(G);
                G.log.push(`${ruYou(p.name)} (ACTION 7): заблокировал ${target.name || target.id}.`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // action_13 shield: bots protect their strongest unshielded persona.
          if (pend.kind === 'action_13_shield_persona' && String(pend.attackerId) === String(p.id)) {
            try {
              const target: any = (p.coalition || [])
                .filter((c: any) => c && c.type === 'persona' && !c.shielded)
                .sort((a: any, b: any) => Number(b.vp ?? b.baseVp ?? 0) - Number(a.vp ?? a.baseVp ?? 0))[0];
              if (target) {
                target.shielded = true;
                target.shieldedBy = 'action_13';
                G.log.push(`${ruYou(p.name)} защитил ${target.name || target.id} (ACTION 13).`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 250;
            return;
          }

          // action_17 choose opponent persona: bots pick first valid opponent persona
          if (pend.kind === 'action_17_choose_opponent_persona' && String(pend.attackerId) === String(p.id)) {
            try {
              const target: any = (G.players || [])
                .filter((pp: any) => String(pp.id) !== String(p.id))
                .flatMap((pp: any) => (pp.coalition || []))
                .find((c: any) => c && c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded);
              if (target) {
                const base = baseId(String(target.id));
                const special = base === 'persona_3' || base === 'persona_38' || base === 'persona_41' || base === 'persona_43';
                const tokens = special ? 4 : 2;
                applyTokenDelta(G, target, -tokens);
                recalcPassives(G);
                G.log.push(`${ruYou(p.name)} использовал ${actionTitleByBaseId('action_17')} на ${target.name || target.id}: ${special ? '4' : '2'} × -1.`);
              } else {
                G.log.push(`${ruYou(p.name)} использовал ${actionTitleByBaseId('action_17')}, но не нашёл цели.`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // action_18 pick persona from discard: bots take first persona
          if (pend.kind === 'action_18_pick_persona_from_discard' && String(pend.attackerId) === String(p.id)) {
            try {
              const idx = (G.discard || []).findIndex((c: any) => c && c.type === 'persona' && baseId(String(c.id)) !== 'persona_31');
              if (idx >= 0) {
                const [c] = G.discard.splice(idx, 1);
                if (c) p.hand.push(c);
                G.log.push(`${ruYou(p.name)} вернул ${c?.name || c?.id} из сброса в руку (ACTION 18).`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_26 purge red_nationalist: bots choose the sole target
          // immediately; with several targets, prefer the point leader and
          // then the target carrying the most stealable +1 tokens.
          if (pend.kind === 'persona_26_pick_red_nationalist' && String(pend.playerId) === String(p.id)) {
            try {
              const self: any = (p.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_26');
              const candidates: any[] = (G.players || []).flatMap((owner: any) => (owner.coalition || [])
                .filter((c: any) => c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded && Array.isArray(c.tags) && c.tags.includes('faction:red_nationalist'))
                .map((card: any) => ({ owner, card, plus: Math.max(0, Number(card.vpDelta || 0)) })));
              const opponents = candidates.filter((entry) => String(entry.owner.id) !== String(p.id));
              const pool = opponents.length ? opponents : candidates;
              pool.sort((a, b) => (scorePlayer(b.owner) - scorePlayer(a.owner)) || (b.plus - a.plus));
              const picked = pool[0];
              if (picked) {
                const { owner, card: target, plus } = picked;
                const j = owner.coalition.findIndex((c: any) => String(c.id) === String(target.id));
                owner.coalition.splice(j, 1);
                G.discard.push(target);
                if ((target as any).type === 'persona') persona44OnPersonaDiscarded(G);
                if (plus && self) applyTokenDelta(G, self, plus);
                G.log.push(`${actorWithPersona(p, 'persona_26')} сбросил ${target?.name || target?.id} и унаследовал ${plus} × +1.`);
              } else {
                G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}): нет красн.нац. для сброса.`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_7 swap: default bot behavior — swap first two personas in its own coalition (if possible), otherwise skip.
          if (pend.kind === 'persona_7_swap_two_in_coalition' && String(pend.playerId) === String(p.id)) {
            const myCoal = (p.coalition || []).filter((c: any) => c.type === 'persona');
            if (myCoal.length >= 2) {
              const owner = p;
              const idxA = (owner.coalition || []).findIndex((c: any) => c.type === 'persona');
              const idxB = (owner.coalition || []).findIndex((c: any, j: number) => c.type === 'persona' && j !== idxA);
              if (idxA >= 0 && idxB >= 0) {
                const ca: any = owner.coalition[idxA];
                const cb: any = owner.coalition[idxB];
                owner.coalition[idxA] = cb;
                owner.coalition[idxB] = ca;
                G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}) поменял местами двух персонажей в своей коалиции.`);
              }
            } else {
              G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}): некого менять местами (автоскип).`);
            }
            (G as any).pending = null;
            recalcPassives(G);
            // End bot turn proactively (no client tick guarantee).
            try {
              if (!G.response && !(G as any).pending && G.hasDrawn && G.hasPlayed) {
                if (maybeEndAfterRound(G, ctx, events)) return;
                events.endTurn?.();
                return;
              }
            } catch {}
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_37 bribe & silence: pick best opponent persona (prefer those with abilities/passives), +2 and block.
          if (pend.kind === 'persona_37_pick_opponent_persona' && String(pend.playerId) === String(p.id)) {
            try {
              const PASSIVE = new Set([
                'persona_2','persona_4','persona_6','persona_15','persona_18','persona_22','persona_24','persona_25','persona_27','persona_29','persona_38','persona_43','persona_44',
              ]);
              let best: any = null;
              let bestOwner: any = null;
              let bestScore = -1;
              for (const owner of (G.players || [])) {
                if (String(owner.id) === String(p.id)) continue;
                for (const c of (owner.coalition || [])) {
                  if (!c || c.type !== 'persona') continue;
                  if (baseId(String(c.id)) === 'persona_31') continue;
                  if (c.shielded) continue;
                  const bid = baseId(String(c.id));
                  const hasAbility = !!(c as any).abilityKey;
                  const isPassive = PASSIVE.has(bid);
                  const sc = (hasAbility ? 3 : 0) + (isPassive ? 2 : 0) + Math.min(3, Math.max(0, Number(c.baseVp ?? 0)) / 2);
                  if (sc > bestScore) { bestScore = sc; best = c; bestOwner = owner; }
                }
              }
              if (best && bestOwner) {
                applyTokenDelta(G, best, 2);
                best.blockedAbilities = true;
                recalcPassives(G);
                const self37: any = (p.coalition || []).find((c: any) => baseId(String(c.id)) === 'persona_37');
                const selfName = String(self37?.name || self37?.text || 'persona_37');
                G.log.push(`${ruYou(p.name)} ${selfName} подкупил ${best.name || best.id} (+2) и навсегда заблокировал способности.`);
              } else {
                G.log.push(`${actorWithPersona(p, 'persona_37')}: нет цели для подкупа.`);
              }
            } catch {}
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // persona_45 steal: prefer targeting the highest-VP opponent (avoid bullying the weakest).
          if (pend.kind === 'persona_45_steal_from_opponent' && String(pend.playerId) === String(p.id)) {
            const opps = (G.players || []).filter((pp: any) => String(pp.id) !== String(p.id));
            const scored = opps
              .map((pp: any) => ({
                p: pp,
                vp: scorePlayer(pp),
                coal: (pp.coalition || []).filter((c: any) => c.type === 'persona').length,
                hand: (pp.hand || []).length,
              }))
              .sort((a, b) => (b.vp - a.vp) || (b.coal - a.coal) || (b.hand - a.hand));

            // simple cooldown: don't target the same player twice if there are alternatives.
            const last = String((p as any).botLastOffTargetId || '');
            let target = scored.find((x) => String(x.p?.id) !== last)?.p || scored[0]?.p;
            if (target) (p as any).botLastOffTargetId = String(target.id);

            if (target && (target.hand || []).length) {
              const idx = Math.floor(Math.random() * target.hand.length);
              const [stolen] = target.hand.splice(idx, 1);
              if (stolen) {
                p.hand.push(stolen);
                G.log.push(`${p.name} забрал 1 карту у ${target.name}.`);
              }
            } else {
              G.log.push(`${ruYou(p.name)} (${pend.sourceCardId}) хотел украсть карту, но подходящей руки соперника не нашлось.`);
            }
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 400;
            return;
          }

          // event_16 self discard then draw
          if (pend.kind === 'event_16_discard_self_persona_then_draw1' && String(pend.playerId) === String(p.id)) {
            const j = (p.coalition || []).findIndex((c: any) => c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded);
            if (j >= 0) {
              const [drop] = p.coalition.splice(j, 1);
              if (drop) G.discard.push(drop);
            }
            // draw 1
            const next = G.deck.shift();
            if (next) {
              if (next.type === 'event') {
                G.lastEvent = next;
                const evName = eventTitle(next);
                G.log.push(`${ruYou(p.name)} ${ruDrewVerb(p.name)} ${evName} (из "${cardTitle(pend.sourceCardId)}")`);
                runAbility(next.abilityKey, { G, me: p, card: next });
                persona38OnEventPlayed(G, next);
                G.discard.push(next);
              } else {
                p.hand.push(next);
                const srcBid2 = baseId(String(pend.sourceCardId || ''));
                if (srcBid2 === 'event_16') G.log.push(`Зато взяли карту.`);
                else G.log.push(`${ruYou(p.name)} взял карту из "${cardTitle(pend.sourceCardId)}".`);
              }
            }
            (G as any).pending = null;
            recalcPassives(G);
            G.botNextActAtMs = nowMs() + 600;
            return;
          }

          // If a bot is current player and there's some pending it can't resolve, clear it to avoid softlocks.
          if (String(pend.playerId || pend.attackerId || '') === String(p.id)) {
            (G as any).pending = null;
            recalcPassives(G);
            if (G.hasDrawn && G.hasPlayed && !(G as any).response) {
              if (maybeEndAfterRound(G, ctx, events)) return;
              events.endTurn?.();
              return;
            }
          }
        }

        // If the bot has no persona or meaningful action, prefer the second
        // draw while there is hand capacity instead of burning a no-op action.
        if (G.hasDrawn && !G.hasPlayed && Number(G.drawsThisTurn || 0) < 2 && (p.hand || []).length < 7) {
          const hasPersona = (p.hand || []).some((cc: any) => cc.type === 'persona');
          const hasUsefulAction = (p.hand || []).some((cc: any) => cc.type === 'action' && BOT_ACTIONS_WITH_EFFECT.has(baseId(String(cc.id))));
          if (!hasPersona && !hasUsefulAction) {
            const second = G.deck.shift();
            if (second) {
              G.drawsThisTurn = 2;
              if (second.type === 'event') {
                G.lastEvent = second;
                pauseBotsForEventReveal(G);
                G.log.push(`${ruYou(p.name)} ${ruDrewVerb(p.name)} ${eventTitle(second)}`);
                runAbility(second.abilityKey, { G, me: p, card: second });
                persona38OnEventPlayed(G, second);
                recalcPassives(G);
                G.discard.push(second);
              } else {
                p.hand.push(second);
                G.log.push(`${p.name} берет вторую карту`);
              }
            }
            G.hasPlayed = true;
            if (!(G as any).pending && !(G as any).response) {
              if (maybeEndAfterRound(G, ctx, events)) return;
              events.endTurn?.();
            } else G.botNextActAtMs = nowMs() + 400;
            return;
          }
        }

        // Play something if needed
        if (!G.hasPlayed) {
          // Prefer persona, else action.
          // Bot heuristic: prioritize adjacency trio p1/p19/p42.
          const TRIO = LEFT_BONUS_PERSONAS;
          const haveOnBoard = new Set((p.coalition || []).filter((x: any) => x?.type === 'persona').map((x: any) => baseId(String(x.id))));
          const idxP0 = (p.hand || []).findIndex((cc: any) => cc.type === 'persona' && TRIO.has(baseId(String(cc.id))) && (haveOnBoard.has('persona_1') || haveOnBoard.has('persona_19') || haveOnBoard.has('persona_42')));
          const idxP = (idxP0 >= 0) ? idxP0 : (p.hand || []).findIndex((cc: any) => cc.type === 'persona');
          if (idxP >= 0) {
            if (Number((p.coalition || []).length) >= MAX_COALITION) {
              // can't play more personas; end bot turn
              G.hasPlayed = true;
              G.botNextActAtMs = nowMs() + 600;
              if (maybeEndAfterRound(G, ctx, events)) return;
              events.endTurn?.();
              return;
            }
            const plays = Number(G.playsThisTurn || 0);
            const maxPlays = Number(G.maxPlaysThisTurn || 1);
            if (plays >= maxPlays) {
              G.hasPlayed = true;
              return;
            }

            const c = p.hand[idxP];
            p.hand.splice(idxP, 1);
            if (LEFT_BONUS_PERSONAS.has(baseId(String(c.id)))) p.coalition.unshift(c);
            else p.coalition.push(c);
            debugTrace(G, 'bot_play_persona', { player: String(p.id), card: String(c.id), ability: String(c.abilityKey || ''), coalitionSize: Number(p.coalition.length) });

            // action_5 modifier: -1 token/VP to each played persona this turn
            const dv = Number(G.playVpDelta || 0);
            if (dv && !(c as any)._turnPlayVpDeltaApplied) {
              (c as any)._turnPlayVpDeltaApplied = true;
              applyTokenDelta(G, c, dv);
            }

            G.playsThisTurn = plays + 1;
            G.hasPlayed = (plays + 1) >= maxPlays;
            // Russian-ish bot log for persona plays
            try {
              const cardName = String((c as any).name || (c as any).text || c.id);
              const ruAcc = (s: string) => {
                if (/ин$/u.test(s)) return s + 'а';
                if (/ов$/u.test(s)) return s + 'а';
                if (/ев$/u.test(s)) return s + 'а';
                if (/ский$/u.test(s)) return s.replace(/ский$/u, 'ского');
                return s;
              };
              if (c.type === 'persona') {
                // Persona_9 (Ponomarev) must enter an opponent coalition.
                try {
                  if (baseId(String(c.id)) === 'persona_9') {
                    const target = (G.players || []).find((pp: any) => String(pp.id) !== String(p.id) && pp.active && Number((pp.coalition || []).length) < MAX_COALITION);
                    if (target) {
                      // remove from own coalition (we pushed it just above) and move to target
                      p.coalition.pop();
                      target.coalition.push(c);
                      G.log.push(`${p.name} добавил ${ruAcc(cardName)} в коалицию ${target.name}`);
                      // Keep resolving this play: Persona 9 can still be
                      // cancelled by "Working for the Kremlin" after it enters
                      // the opponent's coalition.
                    }
                  }
                } catch {}
                G.log.push(`${p.name} добавил ${ruAcc(cardName)} в коалицию`);
              } else {
                G.log.push(`${p.name} played ${c.name || c.id} to Coalition.`);
              }
            } catch {
              G.log.push(`${p.name} played ${c.name || c.id} to Coalition.`);
            }
            // Do not execute on-enter abilities before the action_8 response
            // window.  In particular, Arno creates a follow-up picker; if
            // another bot cancels Arno, that picker must never be created.
            // Human plays already use this deferred path below.
            if (c.abilityKey) {
              (G as any).pending = {
                kind: 'resolve_persona_after_response',
                playerId: String(p.id),
                sourceCardId: String(c.id),
                personaId: String(c.id),
                abilityKey: String(c.abilityKey),
              } as any;
            }
            recalcPassives(G);

            // Response window: allow others to cancel this persona with action_8
            let persona8Swap: any = null;
            try {
              const owner = (G.players || []).find((pp: any) => (pp.coalition || []).some((cc: any) => String(cc.id) === String(c.id)));
              for (const pp of (G.players || [])) {
                if (String(pp.id) === String(p.id) || String(pp.id) === String(owner?.id)) continue;
                const hasReadyP8 = (pp.coalition || []).some((x: any) => baseId(String(x.id)) === 'persona_8' && !(x as any)._p8Used);
                if (hasReadyP8) { persona8Swap = { playerId: String(pp.id), ownerId: String(owner?.id), playedPersonaId: String(c.id) }; break; }
              }
            } catch {}
            G.response = {
              kind: 'cancel_persona',
              playedBy: String(p.id),
              personaCard: c,
              expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_persona', String(p.id), persona8Swap),
              persona8Swap,
            };
            // Prevent other bots from immediately overwriting the cancel target.
            (G as any).botPauseUntilMs = Number((G as any).response.expiresAtMs);

            // If this play created a bot-owned pending interaction, resolve it on subsequent tick(s) before ending turn.
            G.botNextActAtMs = nowMs() + (G.pending ? 600 : 1100);
            if (G.pending) return;

            // If action_5 allows more plays, keep going.
            if (!G.hasPlayed) {
              G.botNextActAtMs = nowMs() + 650;
              return;
            }

            // End bot turn immediately; response cancels are out-of-turn anyway.
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
            return;
          } else {
            // Action 8 is a response card, not a useful ordinary play. Keep
            // it for a valuable persona rather than throwing it away.
            const idxA = (p.hand || []).findIndex((cc: any) => cc.type === 'action' && baseId(String(cc.id)) !== 'action_8');
            if (idxA >= 0) {
              const c = p.hand[idxA];
              p.hand.splice(idxA, 1);
              G.discard.push(c);
              G.lastAction = c;
              G.hasPlayed = true;

              const bid = baseId(String(c.id));
              if (bid === 'action_13') {
                const j = (p.coalition || []).findIndex((cc: any) => cc.type === 'persona' && !cc.shielded);
                if (j >= 0) {
                  const target: any = p.coalition[j];
                  target.shielded = true;
                  target.shieldedBy = 'action_13';
                  G.log.push(`${p.name} разыграл Белое пальто на ${target.name || target.id}`);
                } else {
                  G.log.push(`${p.name} разыграл Белое пальто, но в коалиции нет подходящей персоны`);
                }
              } else if (bid === 'action_5') {
                G.maxPlaysThisTurn = 2;
                G.playVpDelta = -1;
                G.hasPlayed = false; // still need to play personas
                G.log.push(`${p.name} разыграл культуру политики в восточной европе: разыграйте до 2-ух персонажей, но каждый выходит с -1`);
              } else {
                G.log.push(`${p.name} played ${actionTitle(c)}.`);
              }
            } else {
              G.hasPlayed = true;
            }
          }
        }

        if (G.hasDrawn && G.hasPlayed) {
          // If we're "done", don't wait for another tick — end immediately.
          if (!G.response && !(G as any).pending) {
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
            return;
          }
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }
      } catch {}
    },

    endTurn: ({ G, ctx, playerID, events }: any) => {
      expireResponseAndResolveDeferred(G);
      // Resolve deferred persona abilities before gating on pending.
      if (G.pending && (G as any).pending?.kind === 'resolve_persona_after_response') return INVALID_MOVE;
      if (playerID !== ctx.currentPlayer) {
        (G as any).debugLastEndTurnReject = 'not_current_player';
        return INVALID_MOVE;
      }
      if (G.pending) {
        // Special-case: some events require OTHER players to respond (out of turn).
        // Don't wedge the active player's endTurn if they are not one of the responders.
        const pk: any = (G as any).pending;
        if (pk?.kind === 'event_12b_discard_from_hand') {
          const targets: string[] = Array.isArray(pk.targetIds) ? pk.targetIds.map(String) : [];
          if (!targets.includes(String(playerID))) {
            // allow endTurn while others discard
          } else {
            (G as any).debugLastEndTurnReject = `pending:${String(pk?.kind || '')}`;
            return INVALID_MOVE;
          }
        } else if (pk?.kind === 'persona_13_pick_target') {
          // Allow the attacker (current player) to finish their turn while the target resolves p13 out-of-turn.
          if (String(pk.playerId) !== String(playerID)) {
            // ok
          } else {
            (G as any).debugLastEndTurnReject = `pending:${String(pk?.kind || '')}`;
            return INVALID_MOVE;
          }
        } else {
          (G as any).debugLastEndTurnReject = `pending:${String(pk?.kind || '')}`;
          return INVALID_MOVE;
        }
      }
      if (!G.hasDrawn || !G.hasPlayed) {
        (G as any).debugLastEndTurnReject = `need_draw_play (drawn=${String(!!G.hasDrawn)} played=${String(!!G.hasPlayed)})`;
        return INVALID_MOVE;
      }
      (G as any).debugLastEndTurnReject = null;
      // Basic bot: if host is ending a bot turn, auto-play 1 card if possible
      try {
        const p = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
        if (p && String(p.name || '').startsWith('[B]') && !G.hasPlayed) {
          const c = (p.hand || [])[0];
          if (c) {
            p.hand.splice(0, 1);
            p.coalition.push(c);
            G.hasPlayed = true;
            G.log.push(`${p.name} played ${c.name || c.id}.`);
          }
        }
      } catch {}

      // Hand limit: discard down to 7 before ending turn.
      try {
        const p: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
        const nHand = Number((p?.hand || []).length);
        const isBot = !!p?.isBot || String(p?.name || '').startsWith('[B]');
        if (nHand > 7) {
          if (isBot) {
            while (Number((p.hand || []).length) > 7) {
              const drop = p.hand.pop();
              if (drop) G.discard.push(drop);
            }
          } else {
            (G as any).pending = { kind: 'discard_down_to_7', playerId: String(playerID), sourceCardId: 'hand_limit' } as any;
            (G as any).debugLastEndTurnReject = 'hand_limit';
            // This is a valid pause before ending the turn. Returning
            // INVALID_MOVE here rolls the pending modal state back.
            return;
          }
        }
      } catch {}

      // If someone already triggered round-end previously and this is the final turn, end now.
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn();
    },

    drawCard: ({ G, playerID, ctx, events }: any) => {
      expireResponseAndResolveDeferred(G);
      // Resolve deferred persona abilities before gating on pending.
      if (G.pending && (G as any).pending?.kind === 'resolve_persona_after_response') return INVALID_MOVE;
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      if (G.pending) return INVALID_MOVE;

      const draws = Number(G.drawsThisTurn || 0);
      if (draws >= 2) return INVALID_MOVE;
      if (draws >= 1 && !G.hasDrawn) G.hasDrawn = true;
      if (draws >= 1 && G.hasPlayed) return INVALID_MOVE; // can't draw after playing

      // first draw is required; second draw is an alternative to playing
      if (draws === 0 && G.hasDrawn) return INVALID_MOVE;
      if (draws === 1 && !G.hasDrawn) return INVALID_MOVE;
      const p = G.players.find((pp: any) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE;

      const c = G.deck.shift();
      if (!c) return INVALID_MOVE;

      if (c.type === 'event') {
        // Events auto-resolve on draw
        G.lastEvent = c;
        pauseBotsForEventReveal(G);
        const evName = eventTitle(c);
        const bid = baseId(String(c.id));
        const isBot = !!(p as any)?.isBot || String(p?.name || '').startsWith('[B]');
        // For some events, keep only the effect line (less spam) to avoid duplicate logs.
        // NOTE: bot detection is flaky for some names (e.g. "buggo"), so gate by event id, not isBot.
        if (!(
          (bid === 'event_1' || bid === 'event_2' || bid === 'event_3' || bid === 'event_10') ||
          (bid === 'event_15')
        )) {
          // Special-case twitter squabble phrasing.
          if (bid === 'event_12b') G.log.push(`${ruYou(p.name)} ${ruDrewVerb(p.name)} Срач в Твиттере: Секс скандал!`);
          else if (bid === 'event_12c') G.log.push(`${ruYou(p.name)} ${ruDrewVerb(p.name)} "${evName}"`);
          else G.log.push(`${ruYou(p.name)} ${ruDrewVerb(p.name)} ${evName}`);
        }

        // Persona_4: whenever a twitter squabble is played, it gets two -1 tokens.
        try {
          if (Array.isArray((c as any).tags) && (c as any).tags.includes('event_type:twitter_squabble')) {
            for (const pp of (G.players || [])) {
              for (const cc of (pp.coalition || [])) {
                if (baseId(String(cc.id)) === 'persona_4') applyTokenDelta(G, cc, -2);
              }
            }
          }
        } catch {}

        runAbility(c.abilityKey, { G, me: p, card: c });

        persona38OnEventPlayed(G, c);

        recalcPassives(G);
        G.discard.push(c);
      } else {
        p.hand.push(c);
        G.log.push(`${p.name} берет карту`);
      }

      G.drawsThisTurn = draws + 1;
      G.hasDrawn = true;

      // 2nd draw ends your turn immediately (MVP rule)
      if (G.drawsThisTurn >= 2) {
        if (String(playerID) === '0') {
          G.handRevealPlayerId = '0';
          G.handRevealUntilMs = nowMs() + 3000;
        }
        G.hasPlayed = true;
        if (maybeEndAfterRound(G, ctx, events)) return;
        events.endTurn?.();
      }
    },

    playPersona: ({ G, playerID, ctx, events }: any, cardId: string, placeAfterId?: string, side?: 'left' | 'right', targetPlayerId?: string) => {
      expireResponseAndResolveDeferred(G);

      // Normal play: only active player can play.
      if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
      if (G.pending) return INVALID_MOVE;
      if (G.response && !responseExpired(G)) return INVALID_MOVE;
      if (!G.hasDrawn) return INVALID_MOVE;
      const plays = Number(G.playsThisTurn || 0);
      const maxPlays = Number(G.maxPlaysThisTurn || 1);
      if (plays >= maxPlays) return INVALID_MOVE;
      const p = G.players.find((pp: any) => String(pp.id) === String(playerID));
      if (!p) return INVALID_MOVE;

      const idx = (p.hand || []).findIndex((c: any) => c.id === cardId);
      if (idx === -1) return INVALID_MOVE;
      const c = p.hand[idx];
      if (c.type !== 'persona') return INVALID_MOVE;

      const base = baseId(String(c.id));

      // Persona 8 becomes ready again only after it left play and is deployed anew.
      if (base === 'persona_8') delete (c as any)._p8Used;

      // Persona 9 (Ponomarev) must be played into AN OPPONENT coalition.
      const mustTargetOpponentCoalition = base === 'persona_9';

      // Persona 22 (Svetov): global enter trigger should only apply to personas entering AFTER p22 was already in play.
      const have22Before = (G.players || []).some((pp: any) => (pp.coalition || []).some((x: any) => baseId(String(x.id)) === 'persona_22'));

      p.hand.splice(idx, 1);

      // action_5 modifier: -1 token/VP to each played persona this turn
      // Guard against accidental double-application (e.g. repeated playPersona dispatches).
      const dv = Number(G.playVpDelta || 0);
      if (dv && !(c as any)._turnPlayVpDeltaApplied) {
        (c as any)._turnPlayVpDeltaApplied = true;
        applyTokenDelta(G, c, dv);
      }

      let owner: any = p;
      if (mustTargetOpponentCoalition) {
        const tid = String(targetPlayerId || '');
        const target = (G.players || []).find((pp: any) => String(pp.id) === tid);
        if (!target || String(target.id) === String(playerID)) return INVALID_MOVE;
        owner = target;
      }

      // Coalition size cap
      if (Number((owner.coalition || []).length) >= MAX_COALITION) return INVALID_MOVE;

      // Coalition placement (within chosen owner's coalition)
      if (base === 'persona_15') {
        // Arm p15 mirroring starting next turn (prevents “instant” mirror on entry).
        (c as any)._p15ArmedTurn = Number((G as any).turnN || ctx?.turn || 0) + 1;
      }

      if (placeAfterId) {
        const j = (owner.coalition || []).findIndex((cc: any) => String(cc.id) === String(placeAfterId));
        if (j >= 0) {
          const insertAt = (side === 'left') ? j : (j + 1);
          owner.coalition.splice(insertAt, 0, c);
        } else {
          owner.coalition.push(c);
        }
      } else if (owner === p && (owner.coalition || []).some((cc: any) => baseId(String(cc.id)) === 'persona_25' && !cc.blockedAbilities)) {
        // Nadezhdin scores by the number of personas to his left, so once he
        // is active every later persona joins on the left to maximize that bonus.
        owner.coalition.unshift(c);
      } else if (LEFT_BONUS_PERSONAS.has(base)) {
        owner.coalition.unshift(c);
      } else {
        owner.coalition.push(c);
      }

      // Global enter triggers (p22): whenever ANY liberal enters any coalition => EACH p22 gets -1.
      // Whenever ANY rightwing enters any coalition => EACH p22 gets +2.
      // IMPORTANT: applies only if p22 already existed BEFORE this persona entered (and doesn't trigger on p22 itself).
      try {
        if (have22Before && base !== 'persona_22') {
          const isLiberal = Array.isArray((c as any).tags) && (c as any).tags.includes('faction:liberal');
          const isRight = Array.isArray((c as any).tags) && (c as any).tags.includes('faction:rightwing');
          const delta = isLiberal ? -1 : (isRight ? 2 : 0);
          if (delta) {
            for (const pp of (G.players || [])) {
              for (const cc of (pp.coalition || [])) {
                if (baseId(String(cc.id)) === 'persona_22') applyTokenDelta(G, cc as any, delta);
              }
            }
          }
        }
      } catch {}

      recalcPassives(G);
      G.playsThisTurn = plays + 1;
      G.hasPlayed = (plays + 1) >= maxPlays;
      // Russian-ish bot logs
      try {
        const isBot = !!(p as any)?.isBot || String(p?.name || '').startsWith('[B]');
        const cardName = String((c as any).name || (c as any).text || c.id);
        const ruAcc = (s: string) => {
          // super minimal accusative: Демушкин->Демушкина, Волков->Волкова, etc.
          if (/ин$/u.test(s)) return s + 'а';
          if (/ов$/u.test(s)) return s + 'а';
          if (/ев$/u.test(s)) return s + 'а';
          if (/ский$/u.test(s)) return s.replace(/ский$/u, 'ского');
          return s;
        };
        if (c.type === 'persona') {
          const who = ruAcc(cardName);
          const where = (owner === p) ? 'в коалицию' : `в коалицию ${owner.name}`;
          const actorName = isBot ? p.name : ruYou(p.name);
          G.log.push(`${actorName} добавил ${who} ${where}`);
        } else {
          G.log.push(`${p.name} played ${c.name || c.id} to ${owner === p ? 'their' : `${owner.name}'s`} Coalition.`);
        }
      } catch {
        G.log.push(`${p.name} played ${c.name || c.id} to ${owner === p ? 'their' : `${owner.name}'s`} Coalition.`);
      }

      // Response window: allow others to cancel this persona with action_8
      // Also (p8): allow a specific opponent who has persona_8 in coalition to swap it with the played persona.
      let persona8Swap: any = null;
      try {
        const ownerId = String(owner?.id);
        for (const pp of (G.players || [])) {
          if (String(pp.id) === String(playerID)) continue; // don't let the actor swap
          if (String(pp.id) === ownerId) continue; // no swap when persona enters your coalition
          const hasReadyP8 = (pp.coalition || []).some((x: any) => baseId(String(x.id)) === 'persona_8' && !(x as any)._p8Used);
          if (hasReadyP8) {
            persona8Swap = { playerId: String(pp.id), ownerId, playedPersonaId: String(c.id) };
            break;
          }
        }
      } catch {}

      const haveAction8Responders = (G.players || []).some((pp: any) => {
        if (!pp?.active) return false;
        if (String(pp.id) === String(playerID)) return false;
        // Only open the 8s response window if someone can actually cancel (action_8 in hand).
        try {
          return (pp.hand || []).some((hc: any) => hc?.type === 'action' && baseId(String(hc.id)) === 'action_8');
        } catch {
          return false;
        }
      });

      const needResponseWindow = haveAction8Responders || !!persona8Swap;

      if (needResponseWindow) {
        G.response = {
          kind: 'cancel_persona',
          playedBy: String(playerID),
          personaCard: c,
          expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_persona', String(playerID), persona8Swap),
          persona8Swap,
        } as any;
        // Prevent other bots from immediately overwriting the cancel target.
        (G as any).botPauseUntilMs = Number((G as any).response.expiresAtMs);

        // Abilities (wired via cards.yaml)
        // IMPORTANT: do not resolve on-enter abilities until the cancel window has closed.
        (G as any).pending = {
          kind: 'resolve_persona_after_response',
          playerId: String(playerID),
          sourceCardId: String(c.id),
          personaId: String(c.id),
          abilityKey: (c as any).abilityKey,
        } as any;
      } else {
        // No responders: don't open a cancel window; resolve immediately.
        G.response = null;
        try {
          runAbility(String((c as any).abilityKey || ''), { G, me: owner, card: c });
          applyAdjacencyBonusesAround(G, owner, c);
          openNakiResponseForPending(G);
        } catch {}
      }

      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;

      // If more plays are allowed this turn, don't auto-end yet.
      if (!G.hasPlayed) return;

      // If this play created a pending interaction (e.g. token placement), don't auto-end.
      if (G.pending) return;

      // MVP: auto end turn after you play
      events.endTurn?.();
    },

    action4DiscardCastingCost: ({ G, playerID }: any, cardId: string) => {
      const pending: any = G.pending;
      if (!pending || pending.kind !== 'action_4_discard_cost' || String(pending.playerId) !== String(playerID)) return INVALID_MOVE;
      const me: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      const idx = (me?.hand || []).findIndex((c: any) => String(c.id) === String(cardId));
      if (idx < 0) return INVALID_MOVE;
      const [cost] = me.hand.splice(idx, 1);
      G.discard.push(cost);
      G.pending = { kind: 'action_4_choose_target', playerId: String(playerID), sourceCardId: String(pending.sourceCardId), costCardId: String(cost.id) };
      G.log.push(`${ruYou(me.name)} сбросил ${cost.name || cost.id} как стоимость действия.`);
    },

    action4ChooseTarget: ({ G, playerID, ctx, events }: any, targetId: string) => {
      const pending: any = G.pending;
      if (!pending || pending.kind !== 'action_4_choose_target' || String(pending.playerId) !== String(playerID)) return INVALID_MOVE;
      const target: any = (G.players || []).find((pp: any) => String(pp.id) === String(targetId) && pp.active);
      if (!target || String(target.id) === String(playerID)) return INVALID_MOVE;
      const actor: any = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      const actionCard: any = (G.lastAction && baseId(String(G.lastAction.id)) === 'action_4')
        ? G.lastAction
        : { id: pending.sourceCardId, type: 'action' };
      const tid = String(target.id);
      const allowPersona10By = (target.coalition || []).some((x: any) => baseId(String(x.id)) === 'persona_10') ? tid : null;
      G.response = {
        kind: 'cancel_action',
        playedBy: String(playerID),
        actionCard,
        expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_action', String(playerID)),
        allowPersona10By,
      } as any;
      G.pending = { kind: 'action_4_discard', attackerId: String(playerID), targetId: tid, sourceCardId: String(pending.sourceCardId) };
      G.log.push(`${ruYou(actor?.name || playerID)} выбрал целью действия ${target.name}.`);

      if (String(target.name || '').startsWith('[B]')) {
        const dropIndex = action4BotDiscardIndex(target);
        const drop = dropIndex >= 0 ? (target.coalition || [])[dropIndex] : null;
        if (drop) {
          target.coalition.splice(dropIndex, 1);
          G.discard.push(drop);
          if (drop.type === 'persona') persona44OnPersonaDiscarded(G);
          G.log.push(`${target.name} сбросил ${drop.name || drop.id} из коалиции.`);
        } else G.log.push(`${target.name} had no Coalition cards to discard.`);
        G.pending = null;
        G.response = null;
        maybeTriggerRoundEnd(G, ctx);
        if (maybeEndAfterRound(G, ctx, events)) return;
        events.endTurn?.();
      }
    },

    playAction: ({ G, playerID, ctx, events }: any, cardId: string, targetId?: string) => {
      expireResponseAndResolveDeferred(G);
      // Normal play: only active player can play.
      // Exception: out-of-turn cancels (action_6/action_8).

      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      if (!me) return INVALID_MOVE;

      // Allow response cards even if a bot has already ended its turn and the
      // human has become currentPlayer.  The response itself is still limited
      // to someone other than the original player below.
      const held = (me.hand || []).find((c: any) => c.id === cardId);
      const isResponseCard = ['action_6', 'action_8', 'action_14'].includes(baseId(String(held?.id || '')));
      const mayAnswerOpenResponse = !!G.response
        && isResponseCard
        && String(G.response.playedBy) !== String(playerID);
      if (String(playerID) !== String(ctx.currentPlayer) || mayAnswerOpenResponse) {
        const idx = (me.hand || []).findIndex((c: any) => c.id === cardId);
        if (idx === -1) return INVALID_MOVE;
        const c = me.hand[idx];
        if (c.type !== 'action') return INVALID_MOVE;
        const base = baseId(c.id);

        // action_6 cancels currently-played action
        if (base === 'action_6' && G.response?.kind === 'cancel_action' && String(G.response.playedBy) !== String(playerID) && !responseExpired(G)) {
          me.hand.splice(idx, 1);
          G.discard.push(c);
          G.lastAction = c;

          // cancel the action: move cancelled action card to discard
          G.discard.push(G.response.actionCard);

          // also cancel any pending follow-up (e.g. action_4 discard prompt)
          G.pending = null;

          G.log.push(`${ruYou(me.name)} ОТМЕНИЛ действие ${G.response.actionCard.id} (в сброс).`);
          G.response = null;
          return;
        }

        // action_8 cancels currently-played persona
        if (base === 'action_8' && G.response?.kind === 'cancel_persona' && String(G.response.playedBy) !== String(playerID)) {
          const exp = Number(G.response.expiresAtMs || 0);
          if (exp && nowMs() > exp + 3000) return INVALID_MOVE;
          // persona_33 cannot be cancelled by action_8
          if (baseId(String(G.response.personaCard?.id || '')) === 'persona_33') return INVALID_MOVE;

          me.hand.splice(idx, 1);
          G.discard.push(c);
          G.lastAction = c;

          // If this persona had a deferred on-enter ability, drop it (do not resolve after cancel)
          // Also, unconditionally clear pending as the persona is being cancelled.
          (G as any).pending = null;

          // Find the cancelled persona in whatever coalition it just entered and remove it.
          try {
            for (const pp of (G.players || [])) {
              const j = (pp.coalition || []).findIndex((cc: any) => cc.id === G.response.personaCard.id);
              if (j >= 0) {
                const [undo] = pp.coalition.splice(j, 1);
                if (undo) {
                  G.discard.push(undo);
                  if ((undo as any).type === 'persona') persona44OnPersonaDiscarded(G);
                }
                break;
              }
            }
          } catch (e) {}

          // Passive: persona_6 gains +1 token whenever action_8 is played
          try {
            for (const pp of (G.players || [])) {
              for (const cc of (pp.coalition || [])) {
                const b = baseId(String(cc.id));
                if (b === 'persona_6') applyTokenDelta(G, cc, 1);
                if (b === 'persona_29') applyTokenDelta(G, cc, -1);
              }
            }
            recalcPassives(G);
          } catch (e) {}

          const targetName = String((G.response.personaCard as any)?.name || (G.response.personaCard as any)?.text || (G.response.personaCard as any)?.id || 'персонажа');
          const cancelledPlayerId = String(G.response.playedBy || '');
          G.log.push(`${me.name} обвинил ${targetName} в работе на кремль!`);
          G.response = null;
          // The cancelled bot must be allowed to finish its already-played
          // turn on the next bot tick; otherwise botPauseUntilMs can leave it
          // waiting until the stale response deadline.
          (G as any).botPauseUntilMs = 0;
          (G as any).botNextActAtMs = nowMs() + 250;
          const cancelledPlayer: any = (G.players || []).find((pp: any) => String(pp.id) === cancelledPlayerId);
          if (String(ctx.currentPlayer) === cancelledPlayerId
            && cancelledPlayer
            && (!!cancelledPlayer.isBot || String(cancelledPlayer.name || '').startsWith('[B]'))
            && G.hasDrawn && G.hasPlayed && !(G as any).pending) {
            if (maybeEndAfterRound(G, ctx, events)) return;
            events.endTurn?.();
          }
          return;
        }

        // action_14: if YOU are the target of an action (e.g. action_4/9), cancel its effect.
        if (base === 'action_14' && G.response?.kind === 'cancel_persona_ability' && !responseExpired(G) && String(G.response.playedBy) !== String(playerID)) {
          me.hand.splice(idx, 1);
          G.discard.push(c);
          G.lastAction = c;
          G.pending = null;
          G.log.push(`${ruYou(me.name)} отменил способность персонажа используя "${actionTitle(c)}".`);
          G.response = null;
          (G as any).botPauseUntilMs = 0;
          return;
        }

        const cancelableActionPending = G.pending?.kind === 'action_4_discard'
          || G.pending?.kind === 'action_9_discard_persona'
          || G.pending?.kind === 'action_17_choose_opponent_persona';
        const actionTargetsMe = G.pending?.kind === 'action_17_choose_opponent_persona'
          || String(G.pending?.targetId) === String(playerID);
        if (base === 'action_14' && G.response?.kind === 'cancel_action' && !responseExpired(G) && cancelableActionPending && actionTargetsMe) {
          me.hand.splice(idx, 1);
          G.discard.push(c);
          G.lastAction = c;

          // discard the offending action card as well
          if (G.response.actionCard) {
            G.discard.push(G.response.actionCard);
          }

          G.pending = null;
          const offender = actionTitleByBaseId(baseId(String(G.response.actionCard?.id || ''))) || actionTitle(G.response.actionCard) || String(G.response.actionCard?.id || '');
          const canceller = actionTitleByBaseId(baseId(String(c?.id || ''))) || actionTitle(c) || 'ACTION 14';
          G.log.push(`${ruYou(me.name)} отменил эффект действия "${offender}" на своей коалиции используя "${canceller}".`);
          G.response = null;
          return;
        }


        return INVALID_MOVE;
      }

      // active player's normal action play
      if (G.pending) return INVALID_MOVE;
      if (!G.hasDrawn) return INVALID_MOVE;
      if (G.hasPlayed) return INVALID_MOVE;
      if (G.pending) return INVALID_MOVE;
      if (G.response && !responseExpired(G)) return INVALID_MOVE;

      const idx = (me.hand || []).findIndex((c: any) => c.id === cardId);
      if (idx === -1) return INVALID_MOVE;
      const c = me.hand[idx];
      if (c.type !== 'action') return INVALID_MOVE;

      const base = baseId(c.id);

      // action_6 / action_8 / action_14 are RESPONSE cards only (out-of-turn). Never playable as normal actions.
      if (base === 'action_6' || base === 'action_8' || base === 'action_14') return INVALID_MOVE;

      // Action 4 is a two-stage action: pay a card from hand, then choose the
      // opponent. The response window opens only after both choices are made.
      if (base === 'action_4') {
        // The action card itself plus one additional card are required.
        if ((me.hand || []).length < 2) return INVALID_MOVE;
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: 'action_4_discard_cost', playerId: String(playerID), sourceCardId: String(c.id) };
        G.log.push(`${ruYou(me.name)} разыграл "${actionTitleByBaseId(baseId(String(c.id))) || actionTitle(c)}": выберите карту как стоимость розыгрыша.`);
        return;
      }

      // Action 9: in solo, the human chooses any exact persona, including their own.
      if (base === 'action_9') {
        const tid = String(targetId ?? '');
        const target = tid ? (G.players || []).find((pp: any) => String(pp.id) === tid) : null;
        if (tid && !target) return INVALID_MOVE;

        me.hand.splice(idx, 1);
        const allowPersona10By = target && (target.coalition || []).some((x: any) => baseId(String(x.id)) === 'persona_10') ? tid : null;
        G.response = {
          kind: 'cancel_action',
          playedBy: String(playerID),
          actionCard: c,
          expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_action', String(playerID)),
          allowPersona10By,
        } as any;
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: 'action_9_discard_persona', attackerId: String(playerID), playerId: String(playerID), targetId: tid, sourceCardId: String(c.id) };
        G.log.push(target ? `${ruYou(me.name)} разыграл Вывод во внешний контур на ${target.name}.` : `${ruYou(me.name)} разыграл Вывод во внешний контур: выберите персонажа в любой коалиции.`);

        // If target is a bot, auto-discard immediately (first persona)
        if (target && String(playerID) !== '0' && String(target.name || '').startsWith('[B]')) {
          const j = (target.coalition || []).findIndex((cc: any) => cc.type === 'persona');
          if (j >= 0) {
            const [drop] = target.coalition.splice(j, 1);
            if (drop) {
              G.discard.push(drop);
              if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
              G.log.push(`${target.name} сбросил ${drop.name || drop.id} из коалиции.`);
            }
          } else {
            G.log.push(`${target.name} had no persona to discard.`);
          }
          G.pending = null;

          // persona_13 (Venediktov): retaliate after an opponent action targeted your coalition
          try {
            const haveP13 = (target.coalition || []).some((cc: any) => baseId(String(cc.id)) === 'persona_13');
            const attacker = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
            const attackerHasPersona = !!(attacker?.coalition || []).some((cc: any) => cc.type === 'persona');
            if (haveP13 && attacker && attackerHasPersona) {
              // Target is a bot here, so auto-resolve immediately (avoid wedging the human turn).
              const opts = (attacker.coalition || []).filter((cc: any) => cc && cc.type === 'persona' && baseId(String(cc.id)) !== 'persona_31' && !cc.shielded);
              if (opts.length) {
                applyTokenDelta(G, opts[0], -1);
                recalcPassives(G);
                G.log.push(`${target.name} (Венедитков): дал -1 на ${opts[0].name || opts[0].id}.`);
              }
              // no pending
            }
          } catch {}

          maybeTriggerRoundEnd(G, ctx);
          if (maybeEndAfterRound(G, ctx, events)) return;
          events.endTurn?.();
        }

        return;
      }

      // Action 5: allow up to 2 personas this turn; each played persona gets -1 VP token.
      if (base === 'action_5') {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.log.push(`${ruYou(me.name)} разыграли культуру политики в восточной европе: разыграйте до 2-ух персонажей, но каждый выходит с -1`);

        G.maxPlaysThisTurn = 2;
        G.playVpDelta = -1;

        // Do NOT end turn; player continues to play personas.
        return;
      }

      // Action 7: go into persona-targeting mode (any coalition persona).
      if (base === 'action_7') {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: 'action_7_block_persona', attackerId: String(playerID) } as any;
        G.log.push(`${ruYou(me.name)} сыграл «ИНОАГЕНТ»: выберите персону в любой коалиции.`);
        return;
      }

      // Action 13: pick one of YOUR personas to shield.
      if (base === 'action_13') {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: 'action_13_shield_persona', attackerId: String(playerID) } as any;
        const an = actionTitle(c) || 'Белое пальто';
        G.log.push(`${ruYou(me.name)} разыграл «${an}»: защищает одного из ваших персонажей.`);
        return;
      }

      // Action 17: attacker chooses an opponent persona to receive -1 tokens.
      if (base === 'action_17') {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: 'action_17_choose_opponent_persona', attackerId: String(playerID) } as any;
        G.response = {
          kind: 'cancel_action',
          playedBy: String(playerID),
          actionCard: c,
          expiresAtMs: nowMs() + responseWindowMs(G, 'cancel_action', String(playerID)),
        };
        // UI will prompt via pending; avoid noisy/English log line here.
        return;
      }

      // Action 18: pick a persona from discard and return it to your hand.
      if (base === 'action_18') {
        me.hand.splice(idx, 1);
        G.discard.push(c);
        G.lastAction = c;
        G.hasPlayed = true;
        G.pending = { kind: 'action_18_pick_persona_from_discard', attackerId: String(playerID) } as any;
        // log will be written after the player picks a persona from discard
        return;
      }

      // default: action just discards (effects later)
      me.hand.splice(idx, 1);
      G.discard.push(c);
      G.lastAction = c;
      G.hasPlayed = true;
      G.log.push(`${me.name} played ${actionTitle(c)}.`);

      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      // MVP: auto end turn after you play
      events.endTurn?.();
    },

    discardFromCoalition: ({ G, playerID, ctx, events }: any, cardId: string) => {
      if (G.response && responseExpired(G)) G.response = null;
      const pending = G.pending;
      if (!pending || (pending.kind !== 'action_4_discard' && pending.kind !== 'action_9_discard_persona')) return INVALID_MOVE;
      if (pending.kind !== 'action_9_discard_persona' && String(playerID) !== String(pending.targetId)) return INVALID_MOVE;
      if (pending.kind === 'action_9_discard_persona' && String(playerID) !== String(pending.attackerId)) return INVALID_MOVE;

      const target = pending.kind === 'action_9_discard_persona' && !pending.targetId
        ? (G.players || []).find((pp: any) => (pp.coalition || []).some((c: any) => c.id === cardId))
        : (G.players || []).find((pp: any) => String(pp.id) === String(pending.targetId));
      if (!target) return INVALID_MOVE;

      const idx = (target.coalition || []).findIndex((c: any) => c.id === cardId);
      if (idx === -1) return INVALID_MOVE;
      const drop: any = target.coalition[idx];
      if (pending.kind === 'action_9_discard_persona' && drop?.type !== 'persona') return INVALID_MOVE;
      if (drop?.type === 'persona' && baseId(String(drop.id)) === 'persona_31') return INVALID_MOVE;
      if (drop?.shielded) return INVALID_MOVE; // shielded personas cannot be targeted by actions

      target.coalition.splice(idx, 1);
      if (drop) {
        G.discard.push(drop);
        if ((drop as any).type === 'persona') persona44OnPersonaDiscarded(G);
        G.log.push(`${target.name} сбросил ${drop.name || drop.id} из коалиции.`);
      }

      G.pending = null;

      // persona_13 (Venediktov): retaliate after an opponent action targeted your coalition
      try {
        const haveP13 = (target.coalition || []).some((c: any) => baseId(String(c.id)) === 'persona_13');
        const attacker = (G.players || []).find((pp: any) => String(pp.id) === String(pending.attackerId));
        const attackerHasPersona = !!(attacker?.coalition || []).some((c: any) => c.type === 'persona');
        if (haveP13 && attacker && String(target.id) !== String(attacker.id) && attackerHasPersona) {
          (G as any).pending = { kind: 'persona_13_pick_target', playerId: String(target.id), attackerId: String(attacker.id), sourceCardId: String((pending as any).sourceCardId || '') } as any;
          return;
        }
      } catch {}

      maybeTriggerRoundEnd(G, ctx);
      if (maybeEndAfterRound(G, ctx, events)) return;
      events.endTurn?.();
    },

    // Persona 13: pick attacker persona to receive -1
    persona13PickTarget: ({ G, ctx, playerID }: any, ownerId: string, coalitionCardId: string) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_13_pick_target') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      // out-of-turn allowed (retaliation)

      const attacker = (G.players || []).find((pp: any) => String(pp.id) === String(pend.attackerId));
      if (!attacker) return INVALID_MOVE;
      if (String(ownerId) !== String(attacker.id)) return INVALID_MOVE;

      const idx = (attacker.coalition || []).findIndex((c: any) => String(c.id) === String(coalitionCardId));
      if (idx < 0) return INVALID_MOVE;
      const target: any = attacker.coalition[idx];
      if (!target || target.type !== 'persona') return INVALID_MOVE;
      if (target.shielded) return INVALID_MOVE;

      applyTokenDelta(G, target, -1);
      recalcPassives(G);
      const me = (G.players || []).find((pp: any) => String(pp.id) === String(playerID));
      G.log.push(`${ruYou(me?.name || playerID)} (Венедитков): дал -1 на ${target.name || target.id}.`);

      (G as any).pending = null;
    },

    persona13Skip: ({ G, playerID }: any) => {
      const pend: any = (G as any).pending;
      if (!pend || pend.kind !== 'persona_13_pick_target') return INVALID_MOVE;
      if (String(pend.playerId) !== String(playerID)) return INVALID_MOVE;
      (G as any).pending = null;
      return;
    },

    clearLastEventSkipped: ({ G }: any) => {
      (G as any).lastEventSkipped = null;
      return;
    },
  }),
} as const;
