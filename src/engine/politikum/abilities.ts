import type { PolitikumState, PolitikumCard, PolitikumPlayer } from '../politikum';

export type AbilityCtx = {
  G: PolitikumState;
  me: PolitikumPlayer;
  card: PolitikumCard;
  // for future: ctx/events/random
};

export type AbilityFn = (ctx: AbilityCtx) => void;

function baseId(instId: string) {
  return String(instId || '').split('#')[0];
}

function applyTokenDelta(card: any, delta: number) {
  card.vpDelta = Number(card.vpDelta || 0) + delta;
  const base = Number(card.baseVp ?? 0);
  const tok = Number(card.vpDelta ?? 0);
  const pas = Number(card.passiveVpDelta ?? 0);
  card.vp = base + tok + pas;
}

function ruYou(name: any) {
  const n = String(name || '');
  if (n === 'You') return 'Вы';
  return n;
}

function eventTitleByBaseId(bid: string) {
  switch (String(bid || '')) {
    case 'event_1': return 'ЭКОКРЕДИТЫ';
    case 'event_2': return 'Сладкий Подарок';
    case 'event_3': return 'Грант Госдепа';
    case 'event_10': return 'Перевод в криптоколонию';
    case 'event_12a': return 'Набег единорогов';
    case 'event_12b': return 'Срач в твиттере: Секс скандал';
    case 'event_12c': return 'Срач в твиттере - русский флаг';
    case 'event_16': return 'Политический [РОСКОМНАДЗОР]';
    default: return '';
  }
}

function eventTitle(card: any) {
  const bid = baseId(String(card?.id || ''));
  return String((card as any)?.text || (card as any)?.name || eventTitleByBaseId(bid) || card?.id || '');
}

function drawOneFromDeck({ G, me, source }: { G: PolitikumState; me: PolitikumPlayer; source?: string }) {
  const c = G.deck.shift();
  if (!c) return;
  if (c.type === 'event') {
    G.lastEvent = c;
    const src = String(source || '');
    const srcBid = src.split('#')[0];
    if (srcBid === 'event_15') {
      G.log.push(`Вам выпал ЧЕРНЫЙ ЛЕБЕДЬ`);
    } else if (srcBid === 'event_10') {
      G.log.push(`${me.name} попался "Перевод в криптоколонию"`);
    } else if (!logEvent11Draw(G, me, 'event', src)) {
      const bid = baseId(String(c.id));
      const title = eventTitle(c);
      const isBot = String(me.name || '').startsWith('[B]');
      // For token-placement events, keep only the effect line (less spam), especially for bots.
      if (!(isBot && (bid === 'event_1' || bid === 'event_2' || bid === 'event_3' || bid === 'event_10'))) {
        G.log.push(`${ruYou(me.name)} вытянул ${title}`);
      }
    }
    runAbility(c.abilityKey, { G, me, card: c });
    G.discard.push(c);
    return;
  }
  me.hand.push(c);
  const src = String(source || '');
  const srcBid = src.split('#')[0];
  if (srcBid === 'event_12a') {
    G.log.push(`Вы взяли одну карту после набега единорогов`);
  } else if (srcBid === 'event_12c') {
    G.log.push(`${ruYou(me.name)} взял карту из-за срача в твиттере.`);
  } else if (!logEvent11Draw(G, me, 'card', src)) {
    G.log.push(`${ruYou(me.name)} взял карту из ${source || 'ability'}.`);
  }
}

function drawNCards({ G, me, source, count }: { G: PolitikumState; me: PolitikumPlayer; source?: string; count: number }) {
  const n = Math.max(0, Number(count || 0));
  for (let i = 0; i < n; i++) drawOneFromDeck({ G, me, source });
}

function logEvent11Draw(G: PolitikumState, me: PolitikumPlayer, what: 'event' | 'card', eventId: string) {
  if (String(eventId).split('#')[0] !== 'event_11') return false;
  if (what === 'event') {
    G.log.push(`${me.name} попался тайный удвоитель!`);
  } else {
    G.log.push(`${me.name} берёт карту в результате тайного удвоителя`);
  }
  return true;
}

export const ABILITIES: Record<string, AbilityFn> = {
  // Starter abilities
  draw_1: ({ G, me, card }) => {
    drawNCards({ G, me, source: card?.id || 'draw_1', count: 1 });
  },

  // MVP placeholder: adjacency scoring handled at score-time later.
  adj_vp_plus1_if_neighbor_tag: ({ G, me, card }) => {
    G.log.push(`${ruYou(me.name)}: способность TODO (соседство): ${card.id}`);
  },

  // Passive guard: if a persona is marked blockedAbilities (action_7), skip its ability.
  // Callers (playPersona, events) may still invoke runAbility, but this hook ensures
  // blocked personas don't fire further effects in future extensions.

  steal_1_random_from_opponent: ({ G, me }) => {
    const opps = (G.players || []).filter((p) => p.id !== me.id);
    const target = opps.sort((a, b) => (b.hand?.length || 0) - (a.hand?.length || 0))[0];
    if (!target || !(target.hand || []).length) return;
    const idx = Math.floor(Math.random() * target.hand.length);
    const [stolen] = target.hand.splice(idx, 1);
    if (stolen) {
      me.hand.push(stolen);
      G.log.push(`${ruYou(me.name)} украл 1 карту у ${target.name}.`);
    }
  },

  // Events
  place_tokens_plus_vp: ({ G, me, card }) => {
    const tokens = Number(card?.params?.tokens ?? 1);
    const delta = Number(card?.params?.delta ?? 1);

    const myCoal = (me.coalition || []).filter((c: any) => c.type === 'persona');
    if (!myCoal.length) {
      const bid = baseId(String(card?.id || ''));
      const title = eventTitle(card);
      if (bid === 'event_1') {
        G.log.push(`${ruYou(me.name)} как жаль что ЭКОКРЕДИТЫ некуда ставить!`);
      } else if (bid === 'event_3') {
        G.log.push(`${me.name} не кому было отдать госдеповские гранты!`);
      } else {
        G.log.push(`${ruYou(me.name)} Событие - ${title}: некуда ставить жетоны (пропуск).`);
      }
      // Set flag so UI can show "skipped" modal below the event card
      G.lastEventSkipped = { cardId: String(card.id), title, reason: 'no_targets' };
      return;
    }

    G.pending = { kind: 'place_tokens_plus_vp', playerId: String(me.id), remaining: tokens, delta, sourceCardId: String(card.id) } as any;

    // Russian flavor for specific events
    const bid = baseId(String(card?.id || ''));
    if (bid === 'event_1' && tokens === 3 && delta === 1) {
      G.log.push(`"Экокредиты": поставьте 3 жетон(ов) (+1) на свою коалицию.`);
    } else if (bid === 'event_2' && tokens === 2 && delta === 1) {
      G.log.push(`${me.name} попался Сладкий Подарок: поставьте 2 жетона (+1) на свою коалицию.`);
    } else if (bid === 'event_3' && tokens === 5 && delta === 1) {
      G.log.push(`${me.name} Грант Госдепа: поставьте 5 жетон(ов) (+1) на свою коалицию.`);
    } else if (bid === 'event_10' && tokens === 4 && delta === 1) {
      G.log.push(`${me.name} распредилил четыре +1 токена`);
    } else {
      const bid2 = baseId(String(card?.id || ''));
      if (bid2 === 'persona_40' && tokens === 3 && delta === 1) {
        G.log.push(`${ruYou(me.name)} использовала способность Дунцовой: поставьте ${tokens} жетон(ов) (${delta > 0 ? '+' : ''}${delta}) на свою коалицию.`);
      } else {
        const title = eventTitle(card);
        G.log.push(`${ruYou(me.name)} ${title}: поставьте ${tokens} жетон(ов) (${delta > 0 ? '+' : ''}${delta}) на свою коалицию.`);
      }
    }
  },

  // Personas
  on_enter_adjacent_bonus: ({ G, me, card }) => {
    // One-time adjacency bonus (applies when the required neighbor is adjacent).
    // IMPORTANT: award the bonus to BOTH the card and the matching adjacent neighbor.
    // (Playtest expectation: e.g. persona_42 adjacent to persona_1 -> both get +4.)

    const neighbors: string[] = Array.isArray((card as any)?.params?.neighbors)
      ? (card as any).params.neighbors.map(String)
      : [];
    const tokens = Number((card as any)?.params?.tokens ?? 4);

    const idx = (me.coalition || []).findIndex((c) => String(c.id) === String(card.id));
    if (idx < 0) return;
    const leftCard: any = idx > 0 ? me.coalition[idx - 1] : null;
    const rightCard: any = (idx < (me.coalition || []).length - 1) ? me.coalition[idx + 1] : null;

    const leftBid = leftCard ? baseId(String(leftCard.id)) : null;
    const rightBid = rightCard ? baseId(String(rightCard.id)) : null;

    const matchLeft = leftBid && neighbors.includes(leftBid);
    const matchRight = rightBid && neighbors.includes(rightBid);
    if (!matchLeft && !matchRight) return;

    const affected: any[] = [];
    const tryGive = (c: any) => {
      if (!c || c.type !== 'persona') return;
      if ((c as any)._adjBonusApplied) return;
      (c as any)._adjBonusApplied = true;
      applyTokenDelta(c as any, tokens);
      affected.push(c);
    };

    // Give to self + the matching neighbor.
    tryGive(card);
    if (matchLeft) tryGive(leftCard);
    if (matchRight) tryGive(rightCard);

    if (affected.length) {
      const names = affected.map((x) => String(x.name || x.id)).join(' + ');
      G.log.push(`${me.name} adjacency bonus: +${tokens} (${names}).`);
    }
  },

  persona_4_on_enter_twitter_penalty: ({ G, me, card }) => {
    const n = (G.discard || []).filter((c: any) => Array.isArray(c.tags) && c.tags.includes('event_type:twitter_squabble')).length;
    if (!n) return;
    applyTokenDelta(card as any, -2 * n);
    G.log.push(`${me.name} (${card.name || card.id}) got ${2 * n} × -1 from twitter squabbles in discard.`);
  },

  persona_12_on_enter_adjacent_red_buff: ({ G, me, card }) => {
    // If Savin enters adjacent to a red_nationalist, buff one adjacent red_nationalist by +2.
    const idx = (me.coalition || []).findIndex((c: any) => String(c.id) === String(card.id));
    const left = idx > 0 ? (me.coalition || [])[idx - 1] : null;
    const right = (idx >= 0 && idx < (me.coalition || []).length - 1) ? (me.coalition || [])[idx + 1] : null;
    const isRed = (x: any) => x && x.type === 'persona' && Array.isArray(x.tags) && x.tags.includes('faction:red_nationalist') && !x.shielded;

    const L = isRed(left);
    const R = isRed(right);
    if (!L && !R) return;

    if (L && !R) {
      applyTokenDelta(left as any, 2);
      G.log.push(`${me.name} (${card.name || card.id}) buffed ${left.name || left.id} (+2).`);
      return;
    }
    if (R && !L) {
      applyTokenDelta(right as any, 2);
      G.log.push(`${me.name} (${card.name || card.id}) buffed ${right.name || right.id} (+2).`);
      return;
    }

    // Both sides qualify → ask player to choose.
    (G as any).pending = {
      kind: 'persona_12_choose_adjacent_red',
      playerId: String(me.id),
      sourceCardId: String(card.id),
      leftId: String(left.id),
      rightId: String(right.id),
    } as any;
    G.log.push(`${me.name} (${card.name || card.id}) choose adjacent red_nationalist to buff (+2).`);
  },

  persona_3_on_enter_choice: ({ G, me, card }) => {
    // On enter: choose one of two effects. Cost (-1) applies only if the chosen option actually changes something.
    G.pending = { kind: 'persona_3_choice', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    // UI will show the prompt; avoid duplicate/noisy log line.
  },

  persona_5_discard_liberal_steal_tokens: ({ G, me, card }) => {
    // If there are no valid liberal personas to pick, do nothing immediately (avoid wedging the game).
    const haveTarget = (G.players || []).some((pp: any) => {
      if (!pp || String(pp.id) === String(me.id)) return false;
      return (pp.coalition || []).some((c: any) => c && c.type === 'persona' && !c.shielded && baseId(String(c.id)) !== 'persona_31' && Array.isArray(c.tags) && c.tags.includes('faction:liberal'));
    });

    if (!haveTarget) {
      G.log.push(`Ни одного либерала на всю игру. Это провал!`);
      return;
    }

    G.pending = { kind: 'persona_5_pick_liberal', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    // UI will prompt; avoid noisy log line.
  },

  persona_7_swap_two_in_coalition: ({ G, me, card }) => {
    (G as any).pending = {
      kind: 'persona_7_swap_two_in_coalition',
      playerId: String(me.id),
      sourceCardId: String(card.id),
    };
    G.log.push(`${ruYou(me.name)} использовали способность Каспарова: выберите коалицию и двух персон для перестановки.`);
  },

  persona_45_steal_from_opponent: ({ G, me, card }) => {
    (G as any).pending = {
      kind: 'persona_45_steal_from_opponent',
      playerId: String(me.id),
      sourceCardId: String(card.id),
    };
    G.log.push(`${me.name} (${card.name || card.id}) способность: забирает случайную карту из руки оппонента`);
  },

  // p35: no special abilities
  persona_35_no_ability: () => {},

  persona_21_on_enter_invert_tokens: ({ G, me, card }) => {
    (G as any).pending = { kind: 'persona_21_pick_target_invert', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    G.log.push(`${me.name} (${card.name || card.id}) ability: choose any persona to invert its VP tokens.`);
  },

  persona_22_global_enter_mods: () => {
    // Implemented in politikum.ts as a global hook when any persona enters a coalition.
  },

  persona_23_on_enter_self_inflict_draw: ({ G, me, card }) => {
    (G as any).pending = { kind: 'persona_23_choose_self_inflict_draw', playerId: String(me.id), sourceCardId: String(card.id), taken: 0 } as any;
    G.log.push(`${me.name} (${card.name || card.id}) ability: choose 0..3 (-1) tokens to place on self, then draw that many.`);
  },

  persona_24_passive_dual_leftwing_scaler: () => {
    // Implemented in recalcPassives in politikum.ts
  },

  persona_26_on_enter_purge_red_inherit_plus: ({ G, me, card }) => {
    const haveTarget = (G.players || []).some((pp: any) => (pp.coalition || []).some((c: any) => c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded && Array.isArray((c as any).tags) && (c as any).tags.includes('faction:red_nationalist')));
    if (!haveTarget) {
      G.log.push(`${me.name} (${card.name || card.id}) ability: no red_nationalist persona to discard.`);
      return;
    }
    (G as any).pending = { kind: 'persona_26_pick_red_nationalist', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    G.log.push(`${me.name} разыграл способность Демушкина: выберите красного националиста, чтобы сбросить и унаследовать его +1 токены`);
  },

  persona_28_on_enter_steal_plus_tokens: ({ G, me, card }) => {
    // If nobody has any +1 tokens, skip the whole interaction (no pending).
    try {
      const haveAnyPlus = (G.players || []).some((pp: any) => (pp.coalition || []).some((c: any) => c?.type === 'persona' && !c?.shielded && baseId(String(c?.id || '')) !== 'persona_31' && Number(c?.vpDelta || 0) > 0));
      if (!haveAnyPlus) {
        G.log.push(`${me.name} разыграл способность Ведута: выберите персонажа не из ФБК, и заберите у него до 3-ёх +1 токенов`);
        G.log.push(`${me.name} Ни у кого не нашлось токенов. Это какой-то провал!`);
        return;
      }
    } catch {}

    (G as any).pending = { kind: 'persona_28_pick_non_fbk', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    G.log.push(`${me.name} разыграл способность Ведута: выберите персонажа не из ФБК, и заберите у него до 3-ёх +1 токенов`);
  },

  persona_32_activate_bounce: ({ G, me, card }) => {
    (G as any).pending = { kind: 'persona_32_pick_bounce_target', playerId: String(me.id), sourceCardId: String(card.id), cancellable: true } as any;
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): выберите персону в своей коалиции, чтобы вернуть в руку.`);
  },

  persona_38_global_event_token_vacuum: () => {
    // Implemented in politikum.ts as a global hook when event_1/2/3/10 are played.
  },

  persona_41_on_enter_buff_fbk: ({ G, me, card }) => {
    let affected = 0;
    for (const c of (me.coalition || [])) {
      if (c.type !== 'persona') continue;
      if (!Array.isArray((c as any).tags) || !(c as any).tags.includes('faction:fbk')) continue;
      applyTokenDelta(c as any, 1);
      affected++;
    }
    G.log.push(`${me.name} (${card.name || card.id}) buffed ${affected} FBK persona(s) in their coalition (+1).`);
  },

  persona_36_passive_ignore_action7: () => {
    // Implemented in politikum.ts inside action_7 resolution.
  },

  persona_37_on_enter_bribe_and_silence: ({ G, me, card }) => {
    // If there are no valid opponent personas, don't create a pending (avoids softlock).
    const haveTarget = (G.players || []).some((pp: any) => {
      if (String(pp.id) === String(me.id)) return false;
      return (pp.coalition || []).some((c: any) => c.type === 'persona' && baseId(String(c.id)) !== 'persona_31' && !c.shielded);
    });
    if (!haveTarget) {
      G.log.push(`${ruYou(me.name)} (persona_37): нет цели для подкупа.`);
      return;
    }

    (G as any).pending = { kind: 'persona_37_pick_opponent_persona', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    // no prompt log; keep only the resolution log (target chosen)
  },

  persona_16_on_enter_draw3_discard3: ({ G, me, card }) => {
    const queuedEvents: any[] = [];
    for (let i = 0; i < 3; i++) {
      const next: any = (G.deck || []).shift();
      if (!next) break;
      if (next.type === 'event') queuedEvents.push(next);
      else me.hand.push(next);
    }

    (G as any).persona16AfterEvents = {
      playerId: String(me.id),
      sourceCardId: String(card.id),
      events: queuedEvents,
    } as any;

    const srcName = String((card as any)?.text || (card as any)?.name || (card as any)?.id || '').trim();
    if (queuedEvents.length > 0) {
      const next: any = queuedEvents.shift();
      (G as any).persona16AfterEvents.events = queuedEvents;
      G.lastEvent = next;
      const title = eventTitle(next);
      G.log.push(`${ruYou(me.name)} вытянул Событие "${title}" из способности ${srcName}.`);
      runAbility(next.abilityKey, { G, me, card: next });
      G.discard.push(next);
    } else {
      (G as any).pending = { kind: 'persona_16_discard3_from_hand', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    }
    G.log.push(`${me.name} (${card.name || card.id}) drew 3, now discard 3 from hand.`);
  },


  persona_33_on_enter_choose_faction: ({ G, me, card }) => {
    (G as any).pending = { kind: 'persona_33_choose_faction', playerId: String(me.id), sourceCardId: String(card.id) } as any;
  },

  persona_34_on_enter_guess_topdeck: ({ G, me, card }) => {
    (G as any).pending = { kind: 'persona_34_guess_topdeck', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): угадайте верхнюю карту колоды.`);
  },

  // persona_39 is activated via move during your turn (no on-enter pending)

  persona_43_on_enter_drain_rightwing: ({ G, me, card }) => {
    let took = 0;
    for (const pp of (G.players || [])) {
      for (const c of (pp.coalition || [])) {
        if (c.type !== 'persona') continue;
        if (!Array.isArray((c as any).tags) || !(c as any).tags.includes('faction:rightwing')) continue;
        const cur = Number((c as any).vpDelta || 0);
        if (cur > 0) {
          applyTokenDelta(c as any, -1);
          took++;
        }
      }
    }
    if (took) applyTokenDelta(card as any, took);
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}) высосал ${took} × +1 у правых.`);
  },

  persona_6_on_action8_plus1: ({ G, me, card }) => {
    // Passive trigger is handled in politikum.ts when action_8 is played.
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}) пассивка: получает +1 когда кого-то обвинили в работе на кремль.`);
  },

  persona_30_on_enter_buff_liberals: ({ G, me, card }) => {
    let affected = 0;
    for (const c of (me.coalition || [])) {
      if (c.type !== 'persona') continue;
      if (!Array.isArray((c as any).tags) || !(c as any).tags.includes('faction:liberal')) continue;
      applyTokenDelta(c as any, 1);
      affected++;
    }
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}) усилил ${affected} либерал(ов) в своей коалиции (+1).`);
  },

  persona_17_on_enter_steal_persona: ({ G, me, card }) => {
    (G as any).pending = { kind: 'persona_17_pick_opponent', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): выберите соперника — посмотрите его руку и заберите 1 персону.`);
  },

  // persona_13 retaliation is implemented in politikum.ts (after action targeting is confirmed)
  persona_13_retaliate_on_targeted_action: () => {},

  persona_20_on_enter_take_from_discard: ({ G, me, card }) => {
    const discard = (G.discard || []).filter((c: any) => c && c.type === 'action');
    if (!discard.length) {
      G.log.push(`В стопке сброса ничего не нашлось!`);
      return;
    }

    if (discard.length === 1) {
      const [only] = discard.splice(0, 1);
      if (only) {
        me.hand.push(only);
        const actionName = String((only as any)?.text || (only as any)?.name || only.name || only.id);
        G.log.push(`${ruYou(me.name)} используя Быкова взял ${actionName} из сброса.`);
      }
      return;
    }

    (G as any).pending = {
      kind: 'persona_20_pick_from_discard',
      playerId: String(me.id),
      sourceCardId: String(card.id),
    };
    G.log.push(`${ruYou(me.name)} использовали Быкова: выберите карту действия из стопки сброса себе в руку`);
  },

  event_draw_cards: ({ G, me, card }) => {
    const count = Number(card?.params?.count ?? 1);
    drawNCards({ G, me, source: card?.id || 'event_draw_cards', count });
  },

  event_faction_minus1_draw1: ({ G, me, card }) => {
    const factionTag = String(card?.params?.factionTag || '');
    if (!factionTag) return;

    let affected = 0;
    for (const p of G.players || []) {
      for (const c of p.coalition || []) {
        if (c.type !== 'persona') continue;
        const tags = (c as any).tags || [];
        if (!Array.isArray(tags)) continue;
        if (!tags.includes(factionTag)) continue;
        applyTokenDelta(c as any, -1);
        affected++;
      }
    }

    const bid = baseId(String(card?.id || ''));
    const title = (bid === 'event_12a') ? 'Набег единорогов'
      : (bid === 'event_12c') ? 'Срач в твиттере - русский флаг'
      : `EVENT ${card.id}`;

    const factionWord = (factionTag === 'faction:liberal') ? 'либерала'
      : (factionTag === 'faction:fbk') ? 'ФБК'
      : factionTag;

    if (affected > 0) {
      G.log.push(`${title}: ${affected} персонаж(ей) ${factionWord} получает -1, затем вы берёте карту.`);
    } else {
      if (bid === 'event_12a') {
        G.log.push(`Вам выпал набег единорогов, но в игре нет никого из ФБК, тем ни менее 1 карта ваша.`);
      } else {
        G.log.push(`${title}: нет персонажей ${factionWord}, но карту всё равно берёте.`);
      }
    }

    drawNCards({ G, me, source: card?.id || 'event_faction_minus1_draw1', count: 1 });
  },

  event_12b_discard_others_hand: ({ G, me, card }) => {
    const bid = baseId(String(card?.id || ''));
    const title = (bid === 'event_12b') ? 'Срач в твиттере:Секс скандал' : eventTitle(card);
    const short = (bid === 'event_12b') ? 'Секс скандал' : title;

    const others = (G.players || [])
      .filter((p) => String(p.id) !== String(me.id))
      .filter((p: any) => !!p?.active);
    const humanTargets: string[] = [];

    for (const p of others) {
      const hand = p.hand || [];
      if (!hand.length) continue;
      const isBot = String(p.name || '').startsWith('[B]');
      if (isBot) {
        hand.splice(0, 1);
        G.log.push(`${short}: ${p.name} сбросил 1 карту с руки.`);
      } else {
        humanTargets.push(String(p.id));
      }
    }

    if (humanTargets.length) {
      (G as any).pending = {
        kind: 'event_12b_discard_from_hand',
        playerId: String(me.id),
        sourceCardId: String(card.id),
        targetIds: humanTargets,
      };
      // keep prompt minimal; UI already shows a chooser
      G.log.push(`${short}: остальные игроки должны сбросить 1 карту.`);
    }
  },

  event_shuffle_all_hands_redeal: ({ G, me, card }) => {
    const pool: any[] = [];
    const counts: Record<string, number> = {};

    for (const p of G.players || []) {
      const hand = p.hand || [];
      counts[String(p.id)] = hand.length;
      while (hand.length) {
        pool.push(hand.shift());
      }
    }

    // simple shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (const p of G.players || []) {
      const need = counts[String(p.id)] || 0;
      p.hand = [];
      for (let i = 0; i < need && pool.length; i++) {
        const c = pool.shift();
        if (c) p.hand.push(c);
      }
    }

    if (String(card?.id || '').split('#')[0] === 'event_15') {
      G.log.push(`${ruYou(me.name)} вытянул Черный лебедь, все карты из рук перемешались и раздались обратно`);
    } else {
      G.log.push(`${ruYou(me.name)} EVENT ${card.id}: все руки перемешались и раздали заново.`);
    }
  },

  event_16_discard_self_persona_then_draw1: ({ G, me, card }) => {
    // If there is no valid persona to discard (shielded or immovable), this event should fizzle.
    const canDiscard = (me.coalition || []).some((c: any) =>
      c?.type === 'persona' &&
      String(c?.id || '').split('#')[0] !== 'persona_31' &&
      !c?.shielded
    );

    const evName = String((card as any)?.text || (card as any)?.name || card.id);
    if (!canDiscard) {
      // No pending; just discard the event card as usual.
      const bid = String(card?.id || '').split('#')[0];
      if (bid === 'event_16') {
        G.log.push(`Политический [РОСКОМНАДЗОР] ушел в отбой никого не сбросив.`);
      } else {
        G.log.push(`${ruYou(me.name)} ${evName}: нечего сбрасывать (все персоны защищены/неподвижны).`);
      }
      return;
    }

    (G as any).pending = {
      kind: 'event_16_discard_self_persona_then_draw1',
      playerId: String(me.id),
      sourceCardId: String(card.id),
    };

    if (String(card?.id || '').split('#')[0] === 'event_16') {
      // no prompt line (too spammy); keep only the resolution logs
    } else {
      G.log.push(`${ruYou(me.name)} EVENT ${evName}: сбросьте 1 персону из коалиции, затем возьмите 1 карту.`);
    }
  },

  discard_one_persona_from_any_coalition: ({ G, me, card }) => {
    G.pending = { kind: 'discard_one_persona_from_any_coalition', playerId: String(me.id), sourceCardId: String(card.id) } as any;
    G.log.push(`${ruYou(me.name)} (${card.name || card.id}): выберите персону в любой коалиции для сброса.`);
  },
};

export function runAbility(key: string | undefined, ctx: AbilityCtx) {
  if (!key) return;

  // If this card has been "switched off" by action_7, ignore its ability.
  if ((ctx.card as any)?.blockedAbilities) {
    ctx.G.log.push(`${ruYou(ctx.me.name)}: способность заблокирована (${key}, ${ctx.card.id}).`);
    return;
  }

  const fn = ABILITIES[key];
  if (!fn) {
    ctx.G.log.push(`${ruYou(ctx.me.name)}: способность TODO (${key}, ${ctx.card.id})`);
    return;
  }
  fn(ctx);
}
