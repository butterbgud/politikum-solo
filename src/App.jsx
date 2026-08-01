import { useEffect, useMemo, useRef, useState } from 'react';
import { Client } from 'boardgame.io/client';
import { PolitikumGame } from './engine/game.js';
import { POLITIKUM_CARDS_LIST } from './engine/politikum/cards.js';

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
  const cardTitles = [
    ['ЭКОКРЕДИТЫ', 'EcoCredits'], ['Экокредиты', 'EcoCredits'], ['Сладкий Подарок', 'Sweet Gift'], ['Грант Госдепа', 'State Department Grant'], ['Перевод в Криптоколонию', 'Transfer to Crypto-Colony'], ['Перевод в криптоколонию', 'Transfer to Crypto-Colony'], ['Тайный Удвоитель', 'Secret Doubler'], ['тайный удвоитель', 'secret doubler'], ['Набег единорогов', 'Unicorn Raid'], ['Срач в Твиттере: Секс скандал', 'Twitter Squabble: Sex Scandal'], ['Срач в твиттере: Секс скандал', 'Twitter Squabble: Sex Scandal'], ['Срач в твиттере:Секс скандал', 'Twitter Squabble: Sex Scandal'], ['Срач в твиттере - русский флаг', 'Twitter Squabble: Russian Flag'], ['Черный лебедь', 'Black Swan'], ['ЧЕРНЫЙ ЛЕБЕДЬ', 'Black Swan'], ['Политический [РОСКОМНАДЗОР]', 'Political [REDACTED]'], ['политический [РОСКОМНАДЗОР]', 'Political [REDACTED]'],
    ['event_12a', 'Unicorn Raid'], ['event_12b', 'Twitter Squabble: Sex Scandal'], ['event_12c', 'Twitter Squabble: Russian Flag'], ['event_10', 'Transfer to Crypto-Colony'], ['event_11', 'Secret Doubler'], ['event_15', 'Black Swan'], ['event_16', 'Political [REDACTED]'], ['event_1', 'EcoCredits'], ['event_2', 'Sweet Gift'], ['event_3', 'State Department Grant'],
    ['Умри ты сегодня а я завтра', 'You Die Today, I Tomorrow'], ['культура политики в восточной европе', 'Political Culture in Eastern Europe'], ['Вывод во внешний контур', 'External Circuit'], ['Волонтёрство', 'Volunteering'], ['Работа на Кремль', 'Working for the Kremlin'], ['Ася Несоевая', 'Asya Nesoevaya'], ['Белое пальто', 'White Coat'], ['ИНОАГЕНТ', 'Foreign Agent'], ['воскресить политический труп', 'Raise a Political Corpse'],
  ];
  const replacements = [
    ['Игра окончена. Победитель:', 'Game over. Winner:'], ['Конец раунда:', 'End of round:'], ['Осталось ходов:', 'Turns remaining:'], ['Старт игры', 'Game started'], ['старт игры', 'game started'], ['игроков:', 'players:'],
    ['Событие', 'Event'],
    ['Вам выпал', 'You drew'], ['вам выпал', 'you drew'], ['Вы', 'You'], ['вы вытянули', 'you drew'], ['вытянул', 'drew'], ['взяла', 'drew'], ['взял', 'drew'], ['берет', 'draws'], ['возьмите', 'draw'], ['карту', 'a card'], ['карты', 'cards'], ['карт', 'cards'],
    ['разыграли', 'played'], ['разыграл', 'played'], ['сыграл', 'played'], ['добавил', 'played'], ['использовали', 'used'], ['использовал', 'used'], ['использует', 'uses'], ['способность', 'ability'], ['готов.', 'is ready.'], ['присоединился.', 'joined.'],
    ['сбросил', 'discarded'], ['сбросьте', 'discard'], ['сбрасывает', 'discards'], ['из коалиции', 'from the coalition'], ['в коалицию', 'to the coalition'], ['своей коалиции', 'their coalition'], ['вашей коалиции', 'your coalition'],
    ['выберите', 'choose'], ['персонажа', 'a resident'], ['персону', 'a resident'], ['персоны', 'residents'], ['соперника', 'an opponent'], ['коалиции', 'coalition'], ['правых', 'the right-wing'], ['левых', 'the left-wing'], ['фракцию', 'faction'],
    ['жетонов', 'tokens'], ['жетон', 'token'], ['украл', 'stole'], ['защитил', 'protected'], ['заблокировал', 'blocked'], ['отменил', 'cancelled'],
    ['нет цели', 'no target'], ['нечего сбрасывать', 'nothing to discard'], ['пропуск', 'skipped'], ['ход', 'turn'], ['победитель', 'winner'], ['защищён', 'protected'], ['защищен', 'protected'], ['коалиция', 'coalition'],
  ];
  let translated = cardTitles.reduce((text, [from, to]) => text.replaceAll(from, to), String(line));
  translated = translated
    .replace(/^В стопке сброса ничего не нашлось!$/u, 'No action card was found in the discard pile.')
    .replace(/^Вы использовали Быкова: выберите карту действия из стопки сброса себе в руку$/u, 'You used Bykov: choose an action card from the discard pile to return to your hand.')
    .replace(/^(.+) используя Быкова взял (.+) из сброса\.$/u, '$1 used Bykov to take $2 from the discard pile.')
    .replace(/^Вы Событие - (.+): некуда ставить жетоны \(пропуск\)\.?$/u, 'You drew "$1": no token target (skipped).')
    .replace(/поставьте (\d+) жетон\(ов\) \(\+1\) на свою коалицию\./gi, 'place $1 +1 tokens in your coalition.')
    .replace(/распредилил четыре \+1 токена/gi, 'distributed four +1 tokens')
    .replace(/некуда ставить жетоны \(пропуск\)/gi, 'no token target (skipped)');
  // Event resolvers emit several complete Russian sentences. Translate them as
  // sentences before the word-level fallback so English never degrades into
  // transliteration when a less common event branch fires.
  translated = translated
    .replace(/^(.+) вытянул Black Swan, все карты из рук перемешались и раздались обратно$/u, '$1 drew Black Swan: all hands were shuffled and redealt.')
    .replace(/^(.+) EVENT Black Swan: все руки перемешались и раздали заново\.$/u, '$1 drew Black Swan: all hands were shuffled and redealt.')
    .replace(/^(.+) попался "(.+)"$/u, '$1 drew "$2".')
    .replace(/^(.+) попался secret doubler!$/iu, '$1 drew Secret Doubler!')
    .replace(/^(.+) берёт карту в результате secret doubler$/iu, '$1 draws a card from Secret Doubler.')
    .replace(/^Вы взяли одну карту после Unicorn Raid$/u, 'You drew one card after Unicorn Raid.')
    .replace(/^(.+) взял карту из-за Twitter Squabble\.$/u, '$1 drew a card because of Twitter Squabble.')
    .replace(/^(.+) взял карту из (.+)\.$/u, '$1 drew a card from $2.')
    .replace(/^(.+) как жаль что EcoCredits некуда ставить!$/u, '$1 drew EcoCredits, but had no resident to receive tokens.')
    .replace(/^(.+) не кому было отдать госдеповские гранты!$/u, '$1 drew State Department Grant, but had no resident to receive tokens.')
    .replace(/^(.+) попался Sweet Gift: поставьте 2 жетона \(\+1\) на свою коалицию\.$/u, '$1 drew Sweet Gift: place 2 +1 tokens in your coalition.')
    .replace(/^(.+) State Department Grant: поставьте 5 жетон\(ов\) \(\+1\) на свою коалицию\.$/u, '$1 drew State Department Grant: place 5 +1 tokens in your coalition.')
    .replace(/^(.+): (\d+) персонаж\(ей\) (либерала|ФБК) получает -1, затем вы берёте карту\.$/u, (_, title, count, faction) => `${title}: ${count} ${faction === 'либерала' ? 'Liberal' : 'FBK'} resident(s) get −1, then you draw a card.`)
    .replace(/^Вам выпал Unicorn Raid, но в игре нет никого из ФБК, тем ни менее 1 карта ваша\.$/u, 'You drew Unicorn Raid: no FBK residents are in play, but you still draw 1 card.')
    .replace(/^(.+): нет персонажей (.+), но карту всё равно берёте\.$/u, '$1: no matching residents are in play, but you still draw a card.')
    .replace(/^(.+): (.+) сбросил 1 карту с руки\.$/u, '$1: $2 discarded 1 card from hand.')
    .replace(/^(.+): остальные игроки должны сбросить 1 карту\.$/u, '$1: all other players must discard 1 card.')
    .replace(/^Political \[REDACTED\] ушел в отбой никого не сбросив\.$/u, 'Political [REDACTED] fizzled: no resident was discarded.')
    .replace(/^(.+) Political \[REDACTED\]: нечего сбрасывать \(все персоны защищены\/неподвижны\)\.$/u, '$1: Political [REDACTED] has no eligible resident to discard.')
    .replace(/^(.+) Event Political \[REDACTED\]: сбросьте 1 персону из коалиции, затем возьмите 1 карту\.$/u, '$1 drew Political [REDACTED]: discard 1 resident from your coalition, then draw 1 card.')
    .replace(/^(.+) сбросил (.+) из своей коалиции из-за события Political \[REDACTED\]\.$/u, '$1 discarded $2 from their coalition due to Political [REDACTED].')
    .replace(/^(.+) (вытянул|взял) (.+), после Political \[REDACTED\]\.$/u, '$1 drew $3 after Political [REDACTED].')
    .replace(/^(.+) (вытянул|взял) (.+) \(из "(.+)"\)$/u, '$1 drew $3 from "$4".')
    .replace(/^Зато взяли карту\.$/u, 'They drew a card afterward.')
    .replace(/^(.+) вытянул (.+)$/u, '$1 drew $2.');
  translated = translated
    .replace(/^(.+) \((.+)\): левых на поле нет\.$/u, '$1 ($2): no left-wing residents are in play.')
    .replace(/^Ни одного либерала на всю игру\. Это провал!$/u, 'There are no Liberals in play.')
    .replace(/^(.+) использовали способность Каспарова: выберите коалицию и двух персон для перестановки\.$/u, '$1 used Kasparov: choose a coalition and two residents to swap.')
    .replace(/^(.+) \((.+)\) способность: забирает случайную карту из руки оппонента$/u, '$1 ($2) takes a random card from an opponent hand.')
    .replace(/^(.+) разыграл способность Демушкина: выберите красного националиста, чтобы сбросить и унаследовать его \+1 токены$/u, '$1 used Demushkin: discard a Red Nationalist and inherit their +1 tokens.')
    .replace(/^(.+) разыграл способность Ведута: выберите персонажа не из ФБК, и заберите у него до 3-ёх \+1 токенов$/u, '$1 used Veduta: choose a non-FBK resident and steal up to 3 +1 tokens.')
    .replace(/^(.+) Ни у кого не нашлось токенов\. Это какой-то провал!$/u, '$1: no +1 tokens were available.')
    .replace(/^(.+) \((.+)\): выберите персону в своей коалиции, чтобы вернуть в руку\.$/u, '$1 ($2): choose a resident in your coalition to return to hand.')
    .replace(/^(.+) \(persona_37\): нет цели для подкупа\.$/u, '$1 (Persona 37): no resident can be bribed.')
    .replace(/^(.+) \((.+)\): угадайте верхнюю карту колоды\.$/u, '$1 ($2): guess the top card of the deck.')
    .replace(/^(.+) пропустил гадание\.$/u, '$1 skipped Milov’s prediction.')
    .replace(/^(.+) загадал (.+), но в колоде больше нет персон\.$/u, '$1 named $2, but no personas remain in the deck.')
    .replace(/^(.+) загадал (.+)\. Следующая персона в колоде \((\d+) пропущено\): (.+)\.$/u, '$1 named $2. The next persona in the deck (after $3 non-persona card(s)) is $4.')
    .replace(/^(.+) загадал (.+)\. Следующая персона в колоде: (.+)\.$/u, '$1 named $2. The next persona in the deck is $3.')
    .replace(/^(.+): угадал — мгновенная победа для (.+)\.$/u, '$1 guessed correctly — instant victory for $2!')
    .replace(/^(.+) \((.+)\) высосал (\d+) × \+1 у правых\.$/u, '$1 ($2) drained $3 +1 tokens from right-wing residents.')
    .replace(/^(.+) \((.+)\) пассивка: получает \+1 когда кого-то обвинили в работе на кремль\.$/u, '$1 ($2) gains +1 whenever someone is accused of Working for the Kremlin.')
    .replace(/^(.+) \((.+)\) усилил (\d+) либерал\(ов\) в своей коалиции \(\+1\)\.$/u, '$1 ($2) gave +1 to $3 Liberal resident(s) in their coalition.')
    .replace(/^(.+) \((.+)\): выберите соперника — посмотрите его руку и заберите 1 персону\.$/u, '$1 ($2): choose an opponent, inspect their hand, and take 1 resident.')
    .replace(/^(.+): (\d+) персонаж\(ей\) (.+) получает -1, затем вы берёте карту\.$/u, '$1: $2 $3 resident(s) receive −1, then you draw a card.')
    .replace(/^(.+) \((.+)\): выберите персону в любой коалиции для сброса\.$/u, '$1 ($2): choose a resident in any coalition to discard.')
    .replace(/^(.+): способность заблокирована \((.+), (.+)\)\.$/u, '$1: ability blocked ($2, $3).')
    .replace(/^(.+): способность TODO \((.+), (.+)\)$/u, '$1: ability not implemented yet ($2, $3).');
  translated = replacements.reduce((text, [from, to]) => text.replaceAll(from, to), translated);
  const letters = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  return translated.replace(/[А-Яа-яЁё]/g, (letter) => {
    const value = letters[letter.toLowerCase()] || '';
    return letter === letter.toUpperCase() ? value.toUpperCase() : value;
  });
}

function Card({ card, language, onClick, onPreview, dim = false, selected = false, showVictory = true }) {
  if (!card) return null;
  const plusTokens = Number(card.plusTokens ?? Math.max(0, Number(card.vpDelta || 0)));
  const minusTokens = Number(card.minusTokens ?? Math.max(0, -Number(card.vpDelta || 0)));
  const inspectOrPlay = () => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) onPreview?.(card, onClick);
    else onClick?.();
  };
  return <button className={`card ${dim ? 'dim' : ''} ${selected ? 'selected' : ''}`} onClick={inspectOrPlay} title={`${card.name || baseId(card.id)} · ${card.vp ?? 0} VP`}>
    {card.shieldedBy === 'action_13' && <img className="white-coat" src={cardImage({ img: '/cards/action_13.webp' }, language)} alt="White Coat" />}
    <img src={cardImage(card, language)} alt={card.name || card.id} />
    {card.type === 'persona' && <span className="card-stats">{showVictory && <b className="vp">{card.vp ?? 0}</b>}{plusTokens > 0 && <i className="token-plus">+{plusTokens}</i>}{minusTokens > 0 && <i className="token-minus">−{minusTokens}</i>}</span>}
    {card.blockedAbilities && <i className="marker">×</i>}
  </button>;
}

function pendingText(pending, language) {
  const copy = language === 'en' ? {
    place_tokens_plus_vp: 'Choose a resident in your coalition for tokens.', action_4_discard_cost: 'Choose a card to pay the Volunteering casting cost.', action_4_choose_target: 'Choose a target player for Volunteering.', action_4_discard: 'Choose a card in your coalition to discard.', action_9_discard_persona: 'Choose an unprotected resident in any coalition.', action_17_choose_opponent_persona: 'Choose an opponent resident.', action_18_pick_persona_from_discard: 'Choose a discarded resident to return to your hand.', persona_3_choice: 'SVTV: discard a displayed left-wing resident, or use the SVTV panel to remove all their +1 tokens.', persona_32_pick_bounce_target: 'Plyushchev: choose a resident in your coalition to return to your hand.', persona_23_choose_self_inflict_draw: 'Persona 23: choose −1, −2, or −3 VP tokens, then draw that many cards.', persona_33_choose_faction: 'Sobchak: choose a faction. She gains +1 for each resident of that faction in your coalition, including herself.', persona_34_guess_topdeck: 'Milov: name the next persona in the deck for an immediate win.', persona_45_steal_from_opponent: 'Shulman: choose an opponent whose hand to steal from.', persona_5_pick_liberal: 'Pevchikh: choose an unprotected Liberal in an opponent coalition.', persona_21_pick_target_invert: 'Choose a resident to invert their tokens.', persona_26_pick_red_nationalist: 'Choose a Red Nationalist.', persona_28_pick_non_fbk: 'Choose a non-FBK resident.', persona_37_pick_opponent_persona: 'Choose an opponent resident.', discard_down_to_7: 'Discard from your hand down to 7 cards.',
  } : {
    place_tokens_plus_vp: 'Выберите персонажа в своей коалиции для жетонов.',
    action_4_discard_cost: 'Выберите карту как стоимость «Волонтёрства».',
    action_4_choose_target: 'Выберите игрока-цель для «Волонтёрства».',
    action_4_discard: 'Выберите карту из своей коалиции для сброса.',
    action_9_discard_persona: 'Выберите конкретного незащищённого персонажа в любой коалиции.',
    action_7_block_persona: 'Выберите персонажа для блокировки.',
    action_13_shield_persona: 'Выберите персонажа для защиты.',
    action_17_choose_opponent_persona: 'Выберите персонажа соперника.',
    action_18_pick_persona_from_discard: 'Выберите персонажа из сброса, чтобы вернуть его в руку.',
    persona_3_choice: 'SVTV: сбросьте показанного левого персонажа или используйте панель SVTV, чтобы снять со всех левых +1 жетоны.',
    persona_32_pick_bounce_target: 'Плющев: выберите персону в своей коалиции, чтобы вернуть её в руку.',
    persona_23_choose_self_inflict_draw: 'Персона 23: выберите −1, −2 или −3 жетона VP и возьмите столько же карт.',
    persona_33_choose_faction: 'Собчак: выберите фракцию. Она получит +1 за каждого персонажа этой фракции в вашей коалиции, включая себя.',
    persona_34_guess_topdeck: 'Милов: назовите следующего персонажа в колоде для мгновенной победы.', persona_45_steal_from_opponent: 'Шульман: выберите соперника, у которого украсть случайную карту.',
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
  return (!pending.targetId || String(owner.id) === String(pending.targetId))
    && card.type === 'persona'
    && !card.shielded
    && baseId(card.id) !== 'persona_31';
}

function isSvtvTarget(card) {
  return card.type === 'persona' && !card.shielded && card.tags?.includes('faction:leftwing');
}

function isRoizmanTarget(card) {
  return card.type === 'persona' && !card.shielded;
}

function isPlyushchevTarget(owner, card) {
  return owner.id === '0' && card.type === 'persona';
}

function milovChoices(G) {
  const me = G?.players?.find((player) => player.id === '0');
  if (!me) return [];
  const unavailable = new Set([
    ...(G.discard || []),
    ...(G.players || []).flatMap((player) => player.coalition || []),
    ...(me.hand || []),
  ].filter((card) => card.type === 'persona').map((card) => baseId(card.id)));
  return POLITIKUM_CARDS_LIST
    .filter((card) => card.type === 'persona' && !unavailable.has(card.id))
    .map((card) => ({ ...card, name: card.text || card.id, baseVp: card.vp, vp: card.vp, img: `/cards/${card.id}.webp` }));
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
  const [responseTime, setResponseTime] = useState(5);
  const [bugOpen, setBugOpen] = useState(false);
  const [bugText, setBugText] = useState('');
  const [bugStatus, setBugStatus] = useState('');
  const [actionNotice, setActionNotice] = useState(null);
  const [katzSelected, setKatzSelected] = useState([]);
  const [handLimitSelected, setHandLimitSelected] = useState([]);
  const [kasparovFirst, setKasparovFirst] = useState(null);
  const [eventReveal, setEventReveal] = useState(null);
  const clientRef = useRef(null);
  const actionNoticeRef = useRef(null);

  const start = () => {
    clientRef.current?.stop?.();
    const next = Client({ game: PolitikumGame, numPlayers: bots + 1, playerID: '0', debug: false });
    next.subscribe((snapshot) => setState(snapshot));
    next.start();
    for (let i = 0; i < bots; i++) next.moves.addBot();
    next.moves.startGame(responseTime);
    clientRef.current = next;
    setClient(next);
  };

  useEffect(() => () => clientRef.current?.stop?.(), []);
  const G = state?.G;
  const ctx = state?.ctx;
  const me = G?.players?.find((player) => player.id === '0');
  const active = String(ctx?.currentPlayer) === '0';

  useEffect(() => {
    // Keep the watchdog alive during event flybys. The engine pauses bot
    // actions itself, so hard-cap recovery still works while the card is shown.
    if (!client || !G || G.gameOver || (active && !G.response)) return undefined;
    const timer = setInterval(() => client.moves.tickBot(), 700);
    return () => clearInterval(timer);
  }, [client, G, active]);

  useEffect(() => {
    if (!client || !G || !active || G.gameOver || G.response || G.pending || !G.hasDrawn || !G.hasPlayed) return undefined;
    const timer = setTimeout(() => client.moves.endTurn(), 120);
    return () => clearTimeout(timer);
  }, [client, G, active]);

  // Human reaction windows are five seconds; bot-only windows are one second.
  useEffect(() => {
    if (!client || !G?.response || G.gameOver) return undefined;
    const tick = setInterval(() => setClock(Date.now()), 100);
    const left = Math.max(0, Number(G.response.expiresAtMs || 0) - Date.now());
    const close = setTimeout(() => client.moves.skipResponseWindow(), left + 40);
    return () => { clearInterval(tick); clearTimeout(close); };
  }, [client, G?.response, G?.gameOver]);

  useEffect(() => {
    if (!G?.handRevealUntilMs || Date.now() >= Number(G.handRevealUntilMs)) return undefined;
    const tick = setInterval(() => setClock(Date.now()), 100);
    return () => clearInterval(tick);
  }, [G?.handRevealUntilMs]);

  useEffect(() => {
    const action = G?.lastAction;
    if (!action || actionNoticeRef.current === action.id) return undefined;
    actionNoticeRef.current = action.id;
    const isBotAction = String(G.response?.playedBy || '') !== '0';
    const targetsYou = String(G.pending?.targetId || '') === '0';
    if (!isBotAction || !targetsYou) return undefined;
    setActionNotice(action.name || action.text || baseId(action.id));
    const timer = setTimeout(() => setActionNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [G?.lastAction?.id, G?.response?.playedBy, G?.pending?.targetId]);

  useEffect(() => {
    if (G?.pending?.kind !== 'persona_16_discard3_from_hand') setKatzSelected([]);
  }, [G?.pending?.kind, G?.pending?.sourceCardId]);

  useEffect(() => {
    if (G?.pending?.kind !== 'discard_down_to_7') setHandLimitSelected([]);
  }, [G?.pending?.kind, G?.pending?.sourceCardId]);

  useEffect(() => {
    if (G?.pending?.kind !== 'persona_7_swap_two_in_coalition') setKasparovFirst(null);
  }, [G?.pending?.kind, G?.pending?.sourceCardId]);

  useEffect(() => {
    if (!G?.lastEvent?.id) return undefined;
    setEventReveal(G.lastEvent);
    const timer = setTimeout(() => setEventReveal(null), 2000);
    return () => clearTimeout(timer);
  }, [G?.lastEvent?.id]);

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
      if (bid === 'action_9' || bid === 'action_4') return client.moves.playAction(card.id);
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
    else if (pending.kind === 'discard_one_persona_from_any_coalition' && isRoizmanTarget(card)) client.moves.discardPersonaFromCoalition(owner.id, id);
    else if (pending.kind === 'persona_32_pick_bounce_target' && isPlyushchevTarget(owner, card)) client.moves.persona32BounceToHand(id);
    else if (pending.kind === 'action_17_choose_opponent_persona' && owner.id !== '0') client.moves.applyAction17ToPersona(id);
    else if (pending.kind === 'persona_3_choice' && isSvtvTarget(card)) client.moves.persona3ChooseOption('a', owner.id, id);
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
    if (pending.kind === 'action_4_discard_cost') return call('action4DiscardCastingCost', own.hand[0]?.id);
    if (pending.kind === 'action_4_choose_target') return call('action4ChooseTarget', opponent?.id);
    if (pending.kind === 'action_4_discard') return call('discardFromCoalition', own.coalition[0]?.id);
    if (pending.kind === 'action_9_discard_persona') { const target = first(anyCoalition.filter(({ player, card }) => isAction9Target(pending, player, card))); return target && call('discardFromCoalition', target.card.id); }
    if (pending.kind === 'action_7_block_persona') { const target = first(anyCoalition); return target && call('blockPersonaForAction7', target.player.id, target.card.id); }
    if (pending.kind === 'action_13_shield_persona') return call('shieldPersonaForAction13', own.coalition[0]?.id);
    if (pending.kind === 'action_17_choose_opponent_persona') return call('applyAction17ToPersona', opponent?.coalition?.[0]?.id);
    if (pending.kind === 'action_18_pick_persona_from_discard') return call('pickPersonaFromDiscardForAction18', G.discard.find((card) => card.type === 'persona')?.id);
    if (pending.kind === 'persona_3_choice') { const target = first(anyCoalition.filter(({ card }) => isSvtvTarget(card))); return target ? call('persona3ChooseOption', 'a', target.player.id, target.card.id) : call('persona3ChooseOption', 'b'); }
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
      const cardInfo = (card) => card ? { id: card.id, type: card.type, vp: card.vp, vpDelta: card.vpDelta, blocked: !!card.blockedAbilities, shielded: !!card.shielded } : null;
      const debug = G ? {
        phase: ctx?.phase, turn: ctx?.turn, currentPlayer: ctx?.currentPlayer,
        currentPlayerName: G.players?.find((p) => String(p.id) === String(ctx?.currentPlayer))?.name || null,
        flags: { hasDrawn: !!G.hasDrawn, hasPlayed: !!G.hasPlayed, drawsThisTurn: G.drawsThisTurn || 0, playsThisTurn: G.playsThisTurn || 0 },
        timers: { turnStartedAtMs: G.turnStartedAtMs || 0, botNextActAtMs: G.botNextActAtMs || 0, botPauseUntilMs: G.botPauseUntilMs || 0, eventRevealPauseUntilMs: G.eventRevealPauseUntilMs || 0 },
        pending: G.pending || null,
        response: G.response ? { kind: G.response.kind, playedBy: G.response.playedBy, expiresAtMs: G.response.expiresAtMs, personaCard: cardInfo(G.response.personaCard), actionCard: cardInfo(G.response.actionCard) } : null,
        deck: G.deck?.length || 0, lastEvent: cardInfo(G.lastEvent), lastAction: cardInfo(G.lastAction),
        trace: (G.debugTrace || []).slice(-60),
        players: (G.players || []).map((p) => ({ id: p.id, name: p.name, isBot: !!p.isBot, handSize: p.hand?.length || 0, hand: (p.hand || []).map(cardInfo), coalition: (p.coalition || []).map(cardInfo) })),
      } : null;
      const response = await fetch('/api/bugreport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: bugText, version: BUILD_VERSION, language, url: window.location.href, userAgent: navigator.userAgent, history: (G?.log || []).slice(-30), debug, game: G ? { turn: ctx?.turn, pending: G.pending?.kind || null, response: G.response?.kind || null, deck: G.deck?.length || 0 } : null }) });
      if (!response.ok) throw new Error('Bug report request failed');
      setBugStatus('sent');
      setBugText('');
    } catch { setBugStatus('failed'); }
  };
  if (!client) return <main className="welcome"><div><p>Politikum · solo</p><h1>{language === 'en' ? 'Politics without a server' : 'Политикум'}</h1><div className="language"><button className={language === 'ru' ? 'picked' : ''} onClick={() => setLanguage('ru')}>Русский</button><button className={language === 'en' ? 'picked' : ''} onClick={() => setLanguage('en')}>English</button></div><span>{ui.rivals}</span><div className="picker">{[1, 2, 3, 4].map((n) => <button className={bots === n ? 'picked' : ''} onClick={() => setBots(n)} key={n}>{n}</button>)}</div><span>{language === 'en' ? 'Response time' : 'Время ответа'}</span><div className="picker">{[5, 10].map((n) => <button className={responseTime === n ? 'picked' : ''} onClick={() => setResponseTime(n)} key={n}>{n}s</button>)}</div><button className="start" onClick={start}>{ui.start}</button><small>{ui.intro}</small></div></main>;

  if (!G) return <main className="welcome"><div>Загрузка колоды…</div></main>;
  const finalPlayers = G.gameOver ? G.players.filter((p) => p.active) : [];
  const finalScore = finalPlayers.length ? Math.max(...finalPlayers.map(score)) : 0;
  const drawPlayers = G.gameOver && G.isDraw ? finalPlayers.filter((p) => score(p) === finalScore) : [];
  const isDraw = drawPlayers.length > 1;
  const winner = G.gameOver && !isDraw ? (G.players.find((p) => p.id === String(G.winnerId)) || finalPlayers.sort((a, b) => score(b) - score(a))[0]) : null;
  const milovVictory = G.victoryReason === 'milov_prediction';
  const responseSeconds = G.response ? Math.max(0, Math.ceil((Number(G.response.expiresAtMs || 0) - clock) / 1000)) : 0;
  const canAnswerResponse = G.response && String(G.response.playedBy) !== '0';
  const canNakiCancel = canAnswerResponse && String(G.response?.allowPersona10By || '') === '0';
  const responseCards = new Set(canAnswerResponse ? (G.response.kind === 'cancel_action'
    ? ['action_6', ...(String(G.pending?.targetId) === '0' ? ['action_14'] : [])]
    : G.response.kind === 'cancel_persona' && baseId(G.response.personaCard?.id || '') !== 'persona_33' ? ['action_8'] : []) : []);
  const handDecisionPending = ['persona_16_discard3_from_hand', 'persona_17_pick_persona_from_hand', 'event_12b_discard_from_hand', 'discard_down_to_7', 'action_4_discard_cost'].includes(G.pending?.kind);
  const handRevealActive = String(G.handRevealPlayerId || '') === '0' && Number(G.handRevealUntilMs || 0) > clock;
  const fullHandVisible = (active && !G.response && !G.pending) || handRevealActive;
  const katzDiscardPending = G.pending?.kind === 'persona_16_discard3_from_hand' && String(G.pending.playerId) === '0';
  const katzDiscardCount = Math.min(3, me?.hand?.length || 0);
  const handLimitDiscardCount = Math.max(0, (me?.hand?.length || 0) - 7);
  const handLimitPending = G.pending?.kind === 'discard_down_to_7' && String(G.pending.playerId) === '0';
  const visibleHand = katzDiscardPending ? [] : (fullHandVisible || handDecisionPending ? (me?.hand || []) : (me?.hand || []).filter((card) => responseCards.has(baseId(card.id))));
  const arnoOpponents = G.players.filter((player) => player.active && player.id !== '0');
  const arnoTarget = G.pending?.kind === 'persona_17_pick_persona_from_hand'
    ? G.players.find((player) => String(player.id) === String(G.pending.targetId))
    : null;
  return <main className="app">
    <header><div className="brand"><p>POLITIKUM · SOLO</p><small className="version">#{BUILD_VERSION}</small><div className="header-actions"><button className="report-button" onClick={() => { setBugStatus(''); setBugOpen(true); }}>{ui.reportBug}</button><button onClick={start}>{ui.newGame}</button></div></div><div className="turn"><b>{active ? ui.yourTurn : `${G.players.find((p) => p.id === String(ctx?.currentPlayer))?.name || 'Bot'} ${ui.thinking}`}</b><small>{G.deck.length} {ui.deck}</small></div></header>
    {G.pending && <div className="prompt">{pendingText(G.pending, language)}</div>}
    {G.response && canAnswerResponse && <div className="prompt response">{language === 'en' ? `Response: ${responseSeconds}s · ${G.response.kind === 'cancel_action' ? 'play Volunteering or another action-cancel card' : G.response.kind === 'cancel_persona_ability' ? 'discard Naki to cancel this ability' : 'play Working for the Kremlin'}.` : `Ответ: ${responseSeconds}с · ${G.response.kind === 'cancel_action' ? 'сыграйте «Волонтёрство» или карту отмены действия' : G.response.kind === 'cancel_persona_ability' ? 'сбросьте Наки, чтобы отменить способность' : 'сыграйте «Работа на Кремль»'}.`}{canNakiCancel && <button onClick={() => client.moves.persona10CancelFromCoalition()}>{language === 'en' ? 'Discard Naki: cancel effect' : 'Сбросить Наки: отменить эффект'}</button>}</div>}
    {actionNotice && <div className="action-notice">{language === 'en' ? `“${actionNotice}” was played against you` : `Против вас сыграли «${actionNotice}»`}</div>}
    {G.response?.persona8Swap?.playerId === '0' && <button className="persona8-response" onClick={() => client.moves.persona8SwapWithPlayedPersona()}>{language === 'en' ? `Swap Persona 8 for ${G.response.personaCard?.name || 'the played resident'}` : `Поменять Персону 8 на ${G.response.personaCard?.name || 'сыгранного персонажа'}`}</button>}
    {eventReveal && <div className="event-flyby" aria-live="polite"><img src={cardImage(eventReveal, language)} alt={eventReveal.name || eventReveal.id} /></div>}
    {G.pending?.kind === 'action_4_discard_cost' && String(G.pending.playerId) === '0' && <div className="discard-picker-modal"><section className="discard-picker"><b>{language === 'en' ? 'Volunteering — choose a card to discard as the casting cost' : 'Волонтёрство — выберите карту как стоимость розыгрыша'}</b><small>{language === 'en' ? 'The action card has already been played.' : 'Карта действия уже разыграна.'}</small><div className="fan">{(me?.hand || []).map((card) => <Card card={card} language={language} key={card.id} onClick={() => client.moves.action4DiscardCastingCost(card.id)} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></section></div>}
    {G.pending?.kind === 'action_4_choose_target' && String(G.pending.playerId) === '0' && <div className="discard-picker-modal"><section className="discard-picker persona45-choice"><b>{language === 'en' ? 'Volunteering — choose a target player' : 'Волонтёрство — выберите игрока-цель'}</b><small>{language === 'en' ? 'They will discard one card from their coalition.' : 'Он сбросит одну карту из своей коалиции.'}</small><div className="persona45-opponents">{G.players.filter((player) => player.active && player.id !== '0').map((player) => <button key={player.id} onClick={() => client.moves.action4ChooseTarget(player.id)}><strong>{player.name}</strong></button>)}</div></section></div>}
    {G.pending?.kind === 'persona_45_steal_from_opponent' && String(G.pending.playerId) === '0' && <div className="discard-picker-modal"><section className="discard-picker persona45-choice"><b>{language === 'en' ? 'Shulman — choose an opponent' : 'Шульман — выберите соперника'}</b><small>{language === 'en' ? 'A random card will be stolen from their hand.' : 'Из его руки будет украдена случайная карта.'}</small><div className="persona45-opponents">{G.players.filter((player) => player.active && player.id !== '0').map((player) => <button key={player.id} onClick={() => client.moves.persona45StealFromOpponent(player.id)}><strong>{player.name}</strong><span>{player.hand.length} {language === 'en' ? 'cards in hand' : 'карт в руке'}</span></button>)}</div></section></div>}
    {G.pending?.kind === 'event_16_discard_self_persona_then_draw1' && String(G.pending.playerId) === '0' && <div className="discard-picker-modal"><section className="discard-picker"><b>{language === 'en' ? 'Political [REDACTED] — choose a resident to discard' : 'Политический [РОСКОМНАДЗОР] — выберите персону для сброса'}</b><div className="fan">{(me?.coalition || []).filter((card) => isRoizmanTarget(card) && baseId(card.id) !== 'persona_31').map((card) => <Card card={card} language={language} key={card.id} onClick={() => client.moves.discardPersonaFromOwnCoalitionForEvent16(card.id)} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></section></div>}
    {G.pending?.kind === 'persona_7_swap_two_in_coalition' && String(G.pending.playerId) === '0' && <div className="discard-picker-modal"><section className="discard-picker"><b>{language === 'en' ? `Kasparov — choose ${kasparovFirst ? 'the second resident in the same coalition' : 'the first resident'}` : `Каспаров — выберите ${kasparovFirst ? 'вторую персону в той же коалиции' : 'первую персону'}`}</b><div className="fan">{(kasparovFirst ? (G.players.find((p) => p.id === kasparovFirst.ownerId)?.coalition || []).filter((card) => card.type === 'persona' && card.id !== kasparovFirst.cardId) : G.players.flatMap((player) => (player.coalition || []).filter((card) => card.type === 'persona').map((card) => ({ ...card, ownerId: player.id })))).map((card) => <Card card={card} language={language} key={card.id} onClick={() => { if (!kasparovFirst) setKasparovFirst({ ownerId: card.ownerId, cardId: card.id }); else client.moves.persona7SwapTwoInCoalition(kasparovFirst.ownerId, kasparovFirst.cardId, card.id); }} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div>{kasparovFirst && <button onClick={() => setKasparovFirst(null)}>{language === 'en' ? 'Choose first again' : 'Выбрать первую заново'}</button>}</section></div>}
    <section className="table">
      <aside className="log"><b>{ui.log}</b>{[...G.log].slice(-40).reverse().map((line, index) => <small key={`${index}-${line}`}>{language === 'en' ? englishLog(line) : line}</small>)}</aside>
      <section className="coalitions">{G.players.filter((p) => p.active).map((player) => {
        const selectingSvtv = G.pending?.kind === 'persona_3_choice' && String(G.pending.playerId) === '0';
        const selectingPevchih = G.pending?.kind === 'persona_5_pick_liberal' && String(G.pending.playerId) === '0';
        const selectingAction9 = G.pending?.kind === 'action_9_discard_persona' && String(G.pending.playerId) === '0';
        const selectingRoizman = G.pending?.kind === 'discard_one_persona_from_any_coalition' && String(G.pending.playerId) === '0';
        const selectingPlyushchev = G.pending?.kind === 'persona_32_pick_bounce_target' && String(G.pending.playerId) === '0';
        const visibleCards = selectingSvtv ? player.coalition.filter(isSvtvTarget) : selectingPevchih ? player.coalition.filter((card) => isPevchihTarget(player, card)) : selectingAction9 ? player.coalition.filter((card) => isAction9Target(G.pending, player, card)) : selectingRoizman ? player.coalition.filter(isRoizmanTarget) : selectingPlyushchev ? player.coalition.filter((card) => isPlyushchevTarget(player, card)) : player.coalition;
        return <article className={player.id === '0' ? 'player human' : 'player'} key={player.id}><div className="player-head"><b>{player.id === '0' ? ui.you : player.name}</b><strong>{score(player)} VP</strong></div><div className="coalition">{visibleCards.map((card) => <Card card={card} language={language} key={card.id} onClick={() => resolveClick(player, card)} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></article>;
      })}</section>
      <aside className="controls"><button disabled={!active || !!G.pending || !!G.response || G.hasPlayed || Number(G.drawsThisTurn || 0) >= 2} onClick={() => client.moves.drawCard()}>{Number(G.drawsThisTurn || 0) === 1 ? ui.secondDraw : ui.draw}</button><button disabled={!active || !!G.pending || !!G.response || !G.hasDrawn || !G.hasPlayed} onClick={() => client.moves.endTurn()}>{ui.end}</button>{G.pending?.kind === 'persona_11_offer' && String(G.pending.playerId) === '0' && <><button onClick={() => client.moves.persona11Use()}>{language === 'en' ? 'Use Solovyov' : 'Использовать Соловьёва'}</button><button onClick={() => client.moves.persona11Skip()}>{language === 'en' ? 'Skip Solovyov' : 'Пропустить Соловьёва'}</button></>}{G.pending && String(G.pending.playerId ?? G.pending.attackerId) === '0' && !['persona_11_offer', 'action_4_discard_cost', 'action_4_choose_target'].includes(G.pending.kind) && <button className="resolve" onClick={resolveFirstChoice}>{ui.auto}</button>}<small>{G.response ? `Окно ответа: ${responseSeconds}с` : ui.playAfterDraw}</small></aside>
    </section>
    {G.pending?.kind === 'persona_3_choice' && String(G.pending.playerId) === '0' && <section className="svtv-choice"><b>SVTV</b><div><button onClick={() => client.moves.persona3ChooseOption('b')}>{language === 'en' ? 'Take −1: remove every +1 from left-wing residents' : 'Взять −1: снять все +1 с левых'}</button><small>{language === 'en' ? 'Or click a displayed left-wing resident to take −1 and discard it.' : 'Или нажмите на показанного левого персонажа: взять −1 и сбросить его.'}</small><button onClick={() => client.moves.persona3Skip()}>{language === 'en' ? 'Skip SVTV ability' : 'Пропустить способность СВТВ'}</button></div></section>}
    {katzDiscardPending && <div className="discard-picker-modal"><section className="discard-picker katz-picker"><b>{language === 'en' ? `Katz — choose ${katzDiscardCount} cards to discard` : `Кац — выберите ${katzDiscardCount} карты для сброса`}</b><strong>{language === 'en' ? `${katzSelected.length}/${katzDiscardCount} cards selected for discard` : `Выбрано для сброса: ${katzSelected.length}/${katzDiscardCount}`}</strong><div className="fan">{(me?.hand || []).map((card) => { const selected = katzSelected.includes(card.id); return <Card card={card} language={language} key={card.id} selected={selected} dim={!selected && katzSelected.length >= katzDiscardCount} onClick={() => setKatzSelected((chosen) => selected ? chosen.filter((id) => id !== card.id) : chosen.length < katzDiscardCount ? [...chosen, card.id] : chosen)} onPreview={(picked, action) => setPreview({ card: picked, action })} />; })}</div><button className="katz-confirm" disabled={katzSelected.length !== katzDiscardCount} onClick={() => client.moves.persona16Discard3FromHand(katzSelected[0], katzSelected[1], katzSelected[2])}>{language === 'en' ? 'Discard selected cards' : 'Сбросить выбранные карты'}</button></section></div>}
    {handLimitPending && <div className="discard-picker-modal"><section className="discard-picker katz-picker"><b>{language === 'en' ? 'End of turn — choose cards to discard' : 'Конец хода — выберите карты для сброса'}</b><small>{language === 'en' ? `You have ${me?.hand?.length || 0} cards. Discard ${handLimitDiscardCount} to keep 7.` : `У вас ${me?.hand?.length || 0} карт. Сбросьте ${handLimitDiscardCount}, чтобы оставить 7.`}</small><strong>{language === 'en' ? `${handLimitSelected.length}/${handLimitDiscardCount} cards selected` : `Выбрано: ${handLimitSelected.length}/${handLimitDiscardCount}`}</strong><div className="fan">{(me?.hand || []).map((card) => { const selected = handLimitSelected.includes(card.id); return <Card card={card} language={language} key={card.id} selected={selected} dim={!selected && handLimitSelected.length >= handLimitDiscardCount} onClick={() => setHandLimitSelected((chosen) => selected ? chosen.filter((id) => id !== card.id) : chosen.length < handLimitDiscardCount ? [...chosen, card.id] : chosen)} onPreview={(picked, action) => setPreview({ card: picked, action })} />; })}</div><button className="katz-confirm" disabled={handLimitSelected.length !== handLimitDiscardCount} onClick={() => client.moves.discardSelectedDownTo7(handLimitSelected)}>{language === 'en' ? 'Discard selected cards' : 'Сбросить выбранные карты'}</button></section></div>}
    {G.pending?.kind === 'persona_17_pick_opponent' && String(G.pending.playerId) === '0' && <div className="discard-picker-modal"><section className="discard-picker arno-picker"><b>{language === 'en' ? 'Arno — choose an opponent to inspect' : 'Арно — выберите соперника, чью руку посмотреть'}</b><div className="arno-targets">{arnoOpponents.map((player) => <button key={player.id} onClick={() => client.moves.persona17PickOpponent(player.id)}>{player.name}</button>)}</div></section></div>}
    {arnoTarget && <div className="discard-picker-modal"><section className="discard-picker arno-picker"><b>{language === 'en' ? `Arno — ${arnoTarget.name}'s hand` : `Арно — рука игрока ${arnoTarget.name}`}</b><small>{language === 'en' ? 'Choose one persona to take into your hand.' : 'Выберите персону, которую хотите забрать в руку.'}</small><div className="fan">{(arnoTarget.hand || []).map((card) => <Card card={card} language={language} key={card.id} dim={card.type !== 'persona'} onClick={() => { if (card.type === 'persona') client.moves.persona17StealPersonaFromHand(card.id); }} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></section></div>}
    {G.pending?.kind === 'action_18_pick_persona_from_discard' && String(G.pending.playerId ?? G.pending.attackerId) === '0' && <div className="discard-picker-modal"><section className="discard-picker"><b>{language === 'en' ? 'Choose a discarded resident' : 'Выберите персонажа из сброса'}</b><div className="fan">{G.discard.filter((card) => card.type === 'persona' && baseId(card.id) !== 'persona_31').map((card) => <Card card={card} language={language} key={card.id} onClick={() => client.moves.pickPersonaFromDiscardForAction18(card.id)} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></section></div>}
    {G.pending?.kind === 'persona_23_choose_self_inflict_draw' && String(G.pending.playerId) === '0' && <section className="persona23-choice"><b>{language === 'en' ? 'Persona 23 — choose the cost' : 'Персона 23 — выберите цену'}</b><div>{[1, 2, 3].map((n) => <button key={n} disabled={n > 3 - Number(G.pending.taken || 0)} onClick={() => client.moves.persona23ChooseSelfInflict(n)}>{language === 'en' ? `−${n} VP · draw ${n}` : `−${n} VP · взять ${n}`}</button>)}</div></section>}
    {G.pending?.kind === 'persona_33_choose_faction' && String(G.pending.playerId) === '0' && <section className="sobchak-choice"><b>{language === 'en' ? 'Sobchak — choose a faction' : 'Собчак — выберите фракцию'}</b><small>{language === 'en' ? 'She gains +1 for every matching resident in your coalition, including herself.' : 'Она получит +1 за каждого совпадающего персонажа в вашей коалиции, включая себя.'}</small><div>{[['faction:liberal', language === 'en' ? 'Liberal' : 'Либералы'], ['faction:rightwing', language === 'en' ? 'Right-wing' : 'Правые'], ['faction:leftwing', language === 'en' ? 'Left-wing' : 'Левые'], ['faction:fbk', 'FBK'], ['faction:red_nationalist', language === 'en' ? 'Red Nationalist' : 'Красные националисты'], ['faction:system', language === 'en' ? 'System' : 'Системные']].map(([tag, label]) => <button key={tag} onClick={() => client.moves.persona33ChooseFaction(tag)}>{label}</button>)}</div></section>}
    {G.pending?.kind === 'persona_34_guess_topdeck' && String(G.pending.playerId) === '0' && <div className="discard-picker-modal"><section className="milov-choice"><b>{language === 'en' ? 'Milov — name the next persona' : 'Милов — назовите следующую персону'}</b><small>{language === 'en' ? 'Pick any persona that could still be in the deck. A correct prediction wins immediately.' : 'Выберите любого персонажа, который ещё может быть в колоде. Верный ответ — мгновенная победа.'}</small><div className="fan">{milovChoices(G).map((card) => <Card card={card} language={language} key={card.id} onClick={() => client.moves.persona34GuessTopdeck(card.id)} onPreview={(picked, action) => setPreview({ card: picked, action })} />)}</div></section></div>}
    <section className="hand"><div className="fan">{visibleHand.map((card) => { const canRespond = responseCards.has(baseId(card.id)); return <Card card={card} language={language} key={card.id} showVictory={false} dim={G.response ? !canRespond : ((!active && !handRevealActive) || !!G.pending)} onClick={() => G.pending?.kind === 'discard_down_to_7' ? client.moves.discardFromHandDownTo7(card.id) : play(card)} onPreview={(picked, action) => setPreview({ card: picked, action })} />; })}</div></section>
    {bugOpen && <div className="bug-modal" onClick={() => bugStatus !== 'sending' && setBugOpen(false)}><form onSubmit={(event) => { event.preventDefault(); submitBug(); }} onClick={(event) => event.stopPropagation()}><h2>{ui.reportTitle}</h2><p>{ui.reportHint}</p><textarea autoFocus value={bugText} onChange={(event) => setBugText(event.target.value)} placeholder={ui.reportPlaceholder} maxLength="1200" />{bugStatus === 'sent' ? <strong className="bug-success">{ui.sent}</strong> : bugStatus === 'failed' ? <strong className="bug-failed">{ui.failed}</strong> : null}<div><button type="button" onClick={() => setBugOpen(false)} disabled={bugStatus === 'sending'}>{ui.cancel}</button><button className="start" type="submit" disabled={bugStatus === 'sending'}>{ui.send}</button></div></form></div>}
    {preview && <div className="card-preview" onClick={() => setPreview(null)}><div className="preview-card" onClick={(event) => event.stopPropagation()}><img onClick={() => setPreview(null)} src={cardImage(preview.card, language)} alt={preview.card.name || preview.card.id} /><button onClick={() => { preview.action?.(); setPreview(null); }}>{ui.choose}</button><small>{ui.close}</small></div></div>}
    {(winner || isDraw) && <div className={`ending ${milovVictory ? 'milov-ending' : ''} ${isDraw ? 'draw-ending' : ''}`}>{winner && String(G.winnerId) === '0' && <div className="fireworks" aria-hidden="true">{Array.from({ length: 30 }, (_, index) => <i key={index} style={{ '--x': `${(index * 37) % 100}%`, '--delay': `${(index % 9) * -0.27}s`, '--dx': `${(index % 7 - 3) * 48}px`, '--dy': `${(index % 5 - 3) * 54}px`, '--hue': index * 31 }} />)}</div>}<div>{isDraw ? <><p>{language === 'en' ? 'The game ends in a draw' : 'Игра завершилась вничью'}</p><h2>{drawPlayers.map((player) => player.name).join(' · ')}</h2><strong>{finalScore} VP</strong></> : milovVictory ? <><p>{language === 'en' ? 'A momentous prediction!' : 'Судьбоносное предсказание!'}</p><h2>{winner.id === '0' ? (language === 'en' ? 'Milov has seen the future — you win!' : 'Милов увидел будущее — вы победили!') : (language === 'en' ? `${winner.name} saw the future!` : `${winner.name} увидел будущее!`)}</h2><strong>✦ MILOV ✦</strong></> : <><p>{ui.ended}</p><h2>{winner.id === '0' ? ui.won : `${winner.name} ${ui.wins}`}</h2><strong>{score(winner)} VP</strong></>}<ScoreChart history={G.history} players={G.players.filter((player) => player.active)} /><button onClick={start}>{ui.again}</button></div></div>}
  </main>;
}
