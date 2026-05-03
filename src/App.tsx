import { useState, useEffect, useCallback, useRef } from 'react';
import Card from './components/Card';
import ScorePanel, { Bonus } from './components/ScorePanel';
import SpaceBackground from './components/SpaceBackground';
import './App.css';

interface GameCard {
  id: number;
  emoji: string;
  pairId: string; // stable identity for bonus/trap/match, separate from display emoji
  isFlipped: boolean;
  isMatched: boolean;
  isWrong?: boolean;
  isHinted?: boolean;
  rotation?: number; // 0, 90, 180, 270 for round condition level 13
  colorIndex?: number; // for level 8 color matching
  contentHidden?: boolean; // hideOpenCards trap: card stays flipped but emoji is hidden
  isBlurred?: boolean; // blur trap: card stays blurred even when flipped back
}

interface MemoryGameTestSnapshot {
  level: number;
  timeLeft: number;
  score: number;
  gameWon: boolean;
  gameOver: boolean;
  timerFrozen: boolean;
  boardFrozen: boolean;
  freezeCountdown: number | null;
  trapShiftCountdown: number | null;
  bonusesCollected: number;
  trapsTriggered: number;
  roundConditionId: string | null;
  availableBonuses: string[];
  bonusMapByPairId: Record<string, { id: string; description: string }>;
  trapPairIds: string[];
  bonuses: Array<{ id: string; description: string; count: number }>;
  roundModifiers: RoundModifiers;
  cards: Array<{
    id: number;
    index: number;
    emoji: string;
    pairId: string;
    rotation?: number;
    isFlipped: boolean;
    isMatched: boolean;
    isHinted: boolean;
    contentHidden: boolean;
  }>;
}

declare global {
  interface Window {
    __MEMORY_GAME_TEST_API__?: {
      getSnapshot: () => MemoryGameTestSnapshot;
      setTimeLeftForTest: (value: number) => void;
      startLevelForTest: (level: number, forcedBonusIds?: string[]) => void;
    };
  }
}

// All available emojis (16 for variety across levels)
const ALL_EMOJIS = ['🚀', '🌟', '🪐', '👽', '🌙', '☄️', '🛸', '🌌', '🔮', '🎭', '🦄', '🐉', '🦋', '🌺', '🍄', '⚡', '🎃', '🎯', '🦊'];

// Fixed mapping: each card emoji always gives the same bonus
const EMOJI_BONUS_MAP: Record<string, Bonus> = {
  '🚀': { id: 'timer10', emoji: '⏳', name: 'Песочные часы', description: '+10 секунд к таймеру', count: 0 },
  '🌟': { id: 'sticky5', emoji: '📌', name: 'Прилипала', description: '5 сек карточки не закрываются', count: 0 },
  '🪐': { id: 'autopair', emoji: '🪐', name: 'Планета', description: 'Открывает случайную пару', count: 0 },
  '👽': { id: 'xray', emoji: '👁️', name: 'Рентген', description: 'На 0.5 сек показывает все карточки', count: 0 },
  '🌙': { id: 'autoshield', emoji: '🛡️', name: 'Автозащита', description: 'При таймере 0:00 добавит 10 сек', count: 0 },
  '☄️': { id: 'anchor', emoji: '⚓', name: 'Якорь', description: 'Следующая карта не перемещается', count: 0 },
  '🛸': { id: 'freeze', emoji: '❄️', name: 'Заморозка', description: '10 сек: таймер и всё заморожено', count: 0 },
  '🌌': { id: 'superpos', emoji: '🔮', name: 'Суперпозиция', description: 'Следующая карта остаётся открытой', count: 0 },
  '🔮': { id: 'microblast', emoji: '💥', name: 'Микровзрыв', description: 'Открывает карту + 4 соседних', count: 0 },
  '🎭': { id: 'canceltrap', emoji: '🚫', name: 'Анти-ловушка', description: 'Отменяет текущую/следующую ловушку', count: 0 },
  '🦄': { id: 'trapglow', emoji: '🔦', name: 'Детектор', description: 'На 0.5 сек подсвечивает ловушки', count: 0 },
  '🐉': { id: 'silhouettes', emoji: '🎭', name: 'Силуэты', description: 'На 3 сек показывает силуэты всех карт', count: 0 },
  '🦋': { id: 'sort', emoji: '📊', name: 'Сортировка', description: 'Собранные пары перемещаются вверх', count: 0 },
  '🌺': { id: 'show3pairs', emoji: '💡', name: 'Подсказка', description: 'На 1 сек показывает 3 случайные пары', count: 0 },
  '🍄': { id: 'pause', emoji: '⏸️', name: 'Пауза', description: 'Останавливает игру на 10 секунд', count: 0 },
  '⚡': { id: 'doublepoints', emoji: '✨', name: 'Двойные очки', description: '10 сек: удваивает очки за пары', count: 0 },
};

// Static mapping from bonus ID to card emoji (no randomization)
const BONUS_ID_TO_EMOJI: Record<string, string> = {
  'timer10': '🚀',
  'sticky5': '🌟',
  'autopair': '🪐',
  'xray': '👽',
  'autoshield': '🌙',
  'anchor': '☄️',
  'freeze': '🛸',
  'superpos': '🌌',
  'microblast': '🔮',
  'canceltrap': '🎭',
  'trapglow': '🦄',
  'silhouettes': '🐉',
  'sort': '🦋',
  'show3pairs': '🌺',
  'pause': '🍄',
  'doublepoints': '⚡',
};

// Level definitions — 16 levels, gradual progression
interface LevelConfig {
  pairs: number;
  time: number;
  bonusCount: number;
  trapCount: number;
}

const LEVELS: LevelConfig[] = [
  { pairs: 4, time: 60, bonusCount: 1, trapCount: 1 },    // 1
  { pairs: 5, time: 65, bonusCount: 1, trapCount: 1 },    // 2
  { pairs: 6, time: 70, bonusCount: 2, trapCount: 1 },    // 3
  { pairs: 7, time: 75, bonusCount: 2, trapCount: 1 },    // 4
  { pairs: 8, time: 80, bonusCount: 3, trapCount: 2 },    // 5
  { pairs: 9, time: 85, bonusCount: 3, trapCount: 2 },    // 6
  { pairs: 10, time: 90, bonusCount: 3, trapCount: 2 },   // 7
  { pairs: 12, time: 100, bonusCount: 0, trapCount: 0 },  // 8 — color match, no bonuses or traps
  { pairs: 13, time: 105, bonusCount: 3, trapCount: 3 },  // 9
  { pairs: 14, time: 110, bonusCount: 3, trapCount: 3 },  // 10
  { pairs: 15, time: 115, bonusCount: 3, trapCount: 3 },  // 11
  { pairs: 16, time: 120, bonusCount: 3, trapCount: 3 },  // 12
  { pairs: 17, time: 125, bonusCount: 3, trapCount: 3 },  // 13
  { pairs: 18, time: 130, bonusCount: 3, trapCount: 3 },  // 14
  { pairs: 18, time: 130, bonusCount: 3, trapCount: 3 },  // 15 — 6x6 grid for shiftLine
  { pairs: 10, time: 120, bonusCount: 0, trapCount: 3 },  // 16 — 20 cards, no bonuses!
];

const MAX_LEVEL = LEVELS.length;


// Trap types
interface TrapDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  apply: (ctx: TrapContext) => void;
}

interface RoundModifiers {
  hideOpenCards: boolean;
  slowOpen: boolean;
  floating: boolean;
  silhouetteOpen: boolean;
  blurCount: number;
  timerSpeed: number;
  fastOpen: boolean;
  singleCardMode: boolean;
  ghostMode: boolean;
  doublePoints: boolean;
  anchorNext: boolean;
  superposNext: boolean;
  cancelTrapNext: boolean;
  stickyOpen: boolean;
  autoshieldActive: boolean;
  microblastNext: boolean;
  paused: boolean;
}

const DEFAULT_MODIFIERS: RoundModifiers = {
  hideOpenCards: false,
  slowOpen: false,
  floating: false,
  silhouetteOpen: false,
  blurCount: 0,
  timerSpeed: 1,
  fastOpen: false,
  singleCardMode: false,
  ghostMode: false,
  doublePoints: false,
  anchorNext: false,
  superposNext: false,
  cancelTrapNext: false,
  stickyOpen: false,
  autoshieldActive: false,
  microblastNext: false,
  paused: false,
};

interface TrapContext {
  setCards: React.Dispatch<React.SetStateAction<GameCard[]>>;
  setTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  setBoardFrozen: React.Dispatch<React.SetStateAction<boolean>>;
  setRoundModifiers: React.Dispatch<React.SetStateAction<RoundModifiers>>;
  setMarkedTraps: React.Dispatch<React.SetStateAction<Set<number>>>;
  setGameOver: React.Dispatch<React.SetStateAction<boolean>>;
  setIsActive: React.Dispatch<React.SetStateAction<boolean>>;
  cards: GameCard[];
  markedTraps: Set<number>;
  showTrapMessage: (msg: string) => void;
}

// Block 1 traps (levels 1-4)
const TRAP_BLOCK_1: TrapDef[] = [
  {
    id: 'freeze3', name: 'Лёгкая заморозка', emoji: '🧊',
    description: 'Поле замораживается на 3 секунды!',
    apply: ({ setBoardFrozen, showTrapMessage }) => {
      showTrapMessage('🧊 Заморозка! Поле заморожено на 3 секунды!');
      setBoardFrozen(true);
      setTimeout(() => setBoardFrozen(false), 3000);
    }
  },
  {
    id: 'swap2', name: 'Обмен', emoji: '🔄',
    description: '2 закрытые карточки меняются местами!',
    apply: ({ setCards, showTrapMessage }) => {
      showTrapMessage('🔄 Обмен! 2 карточки поменялись местами!');
      setCards(prev => {
        const closedIndices = prev.map((c, i) => (!c.isFlipped && !c.isMatched) ? i : -1).filter(i => i >= 0);
        if (closedIndices.length < 2) return prev;
        const shuffled = shuffleArray(closedIndices);
        const [a, b] = [shuffled[0], shuffled[1]];
        const newCards = [...prev];
        const tempEmoji = newCards[a].emoji;
        newCards[a] = { ...newCards[a], emoji: newCards[b].emoji };
        newCards[b] = { ...newCards[b], emoji: tempEmoji };
        return newCards;
      });
    }
  },
  {
    id: 'hideOpen', name: 'Скрытие', emoji: '🌫️',
    description: 'До конца раунда открытые карточки скрываются!',
    apply: ({ setCards, setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('🌫️ Скрытие! Открытые карточки будут прятаться!');
      setRoundModifiers(prev => ({ ...prev, hideOpenCards: true }));
      setCards(prev => prev.map(c => (c.isFlipped) ? { ...c, contentHidden: true } : c));
    }
  },
  {
    id: 'slowOpen', name: 'Замедление', emoji: '🐌',
    description: 'До конца раунда карточки открываются медленнее!',
    apply: ({ setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('🐌 Замедление! Карточки открываются медленнее!');
      setRoundModifiers(prev => ({ ...prev, slowOpen: true }));
    }
  },
];

// Block 2 traps (levels 5-8)
const TRAP_BLOCK_2: TrapDef[] = [
  {
    id: 'unmatch', name: 'Разбор пар', emoji: '🔀',
    description: 'Все собранные пары закрываются и перемешиваются!',
    apply: ({ setCards, showTrapMessage }) => {
      showTrapMessage('🔀 Разбор! Собранные пары перемешаны!');
      setCards(prev => {
        const matched = prev.filter(c => c.isMatched);
        const unmatched = prev.filter(c => !c.isMatched);
        if (matched.length === 0) return prev;
        const shuffledEmojis = shuffleArray(matched.map(c => c.emoji));
        const newMatched = matched.map((card, i) => ({
          ...card,
          emoji: shuffledEmojis[i],
          isFlipped: false,
          isMatched: false,
          isWrong: false,
          isHinted: false,
        }));
        return [...unmatched, ...newMatched];
      });
    }
  },
  {
    id: 'freeze5', name: 'Заморозка', emoji: '❄️',
    description: 'Поле замораживается на 5 секунд!',
    apply: ({ setBoardFrozen, showTrapMessage }) => {
      showTrapMessage('❄️ Заморозка! Поле заморожено на 5 секунд!');
      setBoardFrozen(true);
      setTimeout(() => setBoardFrozen(false), 5000);
    }
  },
  {
    id: 'float', name: 'Плавание', emoji: '🌊',
    description: '10 секунд карточки плавают по экрану!',
    apply: ({ setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('🌊 Плавание! Карточки плавают по экрану!');
      setRoundModifiers(prev => ({ ...prev, floating: true }));
      setTimeout(() => setRoundModifiers(prev => ({ ...prev, floating: false })), 10000);
    }
  },
  {
    id: 'silhouette', name: 'Силуэты', emoji: '🎭',
    description: '10 секунд карточки открываются чёрно-белыми!',
    apply: ({ setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('🎭 Силуэты! Карточки открываются чёрно-белыми!');
      setRoundModifiers(prev => ({ ...prev, silhouetteOpen: true }));
      setTimeout(() => setRoundModifiers(prev => ({ ...prev, silhouetteOpen: false })), 10000);
    }
  },
];

// Block 3 traps (levels 9-12)
const TRAP_BLOCK_3: TrapDef[] = [
  {
    id: 'moveMarks', name: 'Перелёт меток', emoji: '🔀',
    description: 'Метки ловушек перелетают на другие карточки!',
    apply: ({ setMarkedTraps, setCards, markedTraps, showTrapMessage }) => {
      showTrapMessage('🔀 Перелёт! Метки ловушек сместились!');
      const count = markedTraps.size;
      if (count === 0) return;
      setCards(prev => {
        const closedIndices = prev.map((c, i) => (!c.isFlipped && !c.isMatched) ? i : -1).filter(i => i >= 0);
        const newMarks = new Set(shuffleArray(closedIndices).slice(0, count));
        setMarkedTraps(newMarks);
        return prev;
      });
    }
  },
  {
    id: 'blur', name: 'Размытие', emoji: '🫧',
    description: 'Следующие 6 открытий будут размытыми!',
    apply: ({ setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('🫧 Размытие! Следующие 6 открытий размыты!');
      setRoundModifiers(prev => ({ ...prev, blurCount: 6 }));
    }
  },
  {
    id: 'speedUp', name: 'Ускорение', emoji: '⏩',
    description: '10 секунд таймер идёт быстрее, но карточки открываются быстрее!',
    apply: ({ setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('⏩ Ускорение! Таймер быстрее, карточки быстрее!');
      setRoundModifiers(prev => ({ ...prev, timerSpeed: 2, fastOpen: true }));
      setTimeout(() => setRoundModifiers(prev => ({ ...prev, timerSpeed: 1, fastOpen: false })), 10000);
    }
  },
  {
    id: 'unmatch2', name: 'Закрытие пар', emoji: '🔄',
    description: 'До 2 собранных пар закрываются!',
    apply: ({ setCards, showTrapMessage }) => {
      showTrapMessage('🔄 Закрытие! 2 собранные пары закрылись!');
      setCards(prev => {
        // Find unique matched pairIds (each pair)
        const matchedPairIds = [...new Set(prev.filter(c => c.isMatched).map(c => c.pairId))];
        const toClosePairIds = shuffleArray(matchedPairIds).slice(0, Math.min(2, matchedPairIds.length));
        return prev.map(c => toClosePairIds.includes(c.pairId) && c.isMatched
          ? { ...c, isMatched: false, isFlipped: false }
          : c
        );
      });
    }
  },
];

// Block 4 traps (levels 13-16)
const TRAP_BLOCK_4: TrapDef[] = [
  {
    id: 'death', name: 'Смерть', emoji: '☠️',
    description: 'Мгновенный проигрыш! (Если не помечана)',
    apply: ({ setGameOver, setIsActive, showTrapMessage }) => {
      showTrapMessage('☠️ Смерть! Ловушка не была помечена — проигрыш!');
      setGameOver(true);
      setIsActive(false);
    }
  },
  {
    id: 'shuffleAll', name: 'Перемешивание', emoji: '🔀',
    description: 'Все карточки перемешиваются!',
    apply: ({ setCards, showTrapMessage }) => {
      showTrapMessage('🔀 Перемешивание! Все карточки перемешаны!');
      setCards(prev => {
        const shuffledEmojis = shuffleArray(prev.map(c => c.emoji));
        return prev.map((card, i) => ({
          ...card,
          emoji: shuffledEmojis[i],
          isFlipped: false,
          isWrong: false,
          isHinted: false,
        }));
      });
    }
  },
  {
    id: 'singleCard', name: 'Одиночество', emoji: '🔒',
    description: '5 секунд можно открывать только по одной карте!',
    apply: ({ setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('🔒 Одиночество! Только по одной карте 5 секунд!');
      setRoundModifiers(prev => ({ ...prev, singleCardMode: true }));
      setTimeout(() => setRoundModifiers(prev => ({ ...prev, singleCardMode: false })), 5000);
    }
  },
  {
    id: 'ghost', name: 'Призрак', emoji: '👻',
    description: 'До конца раунда карточки показываются на 0.5с и исчезают!',
    apply: ({ setRoundModifiers, showTrapMessage }) => {
      showTrapMessage('👻 Призрак! Карточки появляются на мгновение!');
      setRoundModifiers(prev => ({ ...prev, ghostMode: true }));
    }
  },
];

// All trap blocks indexed by block number (1-4)
const TRAP_BLOCKS: TrapDef[][] = [TRAP_BLOCK_1, TRAP_BLOCK_2, TRAP_BLOCK_3, TRAP_BLOCK_4];

// Round conditions for special levels 8-16
interface RoundCondition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  level: number;
}

const ROUND_CONDITIONS: RoundCondition[] = [
  { id: 'colorMatch', name: 'ЦветовоеMatching', emoji: '🎨', description: 'На карточках только цвета — собирайте пары по цвету! Ловушек и новых бонусов нет.', level: 8 },
  { id: 'jumpPair', name: 'Прыгающие пары', emoji: '🦘', description: 'Собранные пары прыгают как кролик и перепрыгивают на соседнюю ячейку!', level: 9 },
  { id: 'trapShift', name: 'Блуждающие ловушки', emoji: '🔮', description: 'Невозможно отметить ловушки! Каждые 10 сек ловушки меняются местами со случайными закрытыми картами.', level: 10 },
  { id: 'floating', name: 'Свободное плавание', emoji: '🌀', description: 'Карточки расположены хаотичным облаком и плавно вращаются по часовой стрелке!', level: 11 },
  { id: 'sections', name: 'Секции', emoji: '🧩', description: 'Поле поделено на 4 секции. В чётных можно выбирать, в нечётных — заблокировано. После каждых 3 карточек секции меняются!', level: 12 },
  { id: 'rotated', name: 'Повороты', emoji: '🔄', description: 'Все картинки на карточках случайно повёрнуты на 90°, 180° или 270°!', level: 13 },
  { id: 'mirror', name: 'Зеркало', emoji: '🪞', description: 'После каждой собранной пары поле отражается по вертикали или горизонтали!', level: 14 },
  { id: 'shiftLine', name: 'Сдвиг линии', emoji: '↔️', description: 'За каждые 6 неудачных открытий линия у последней карты смещается!', level: 15 },
  { id: 'fadePair', name: 'Исчезающие пары', emoji: '👻', description: 'Через 10 секунд собранная пара начинает пропадать, а через 15 — переворачивается обратно!', level: 16 },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Setup level: pick emojis, assign bonuses to ALL pairs & traps to some non-bonus ones
function setupLevel(level: number, forcedBonusIds: string[] = []): {
  cards: GameCard[];
  bonusMap: Record<string, Bonus>;
  bonusOrder: string[]; // ordered pairId list for "top bonus lost" mechanic
  trapPairIds: string[];
  trapDefs: TrapDef[];
} {
  const config = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const pairCount = config.pairs;

  // Level 8: color matching — cards show only color, no emoji, no traps
  const isColorMatch = level === 8;

  // Assign bonuses first: pick bonus IDs (shuffled for variety), get their static emojis
  const requestedBonusIds = forcedBonusIds.filter((id, index) =>
    Object.prototype.hasOwnProperty.call(BONUS_ID_TO_EMOJI, id) && forcedBonusIds.indexOf(id) === index
  );
  const randomBonusIds = shuffleArray(
    Object.keys(BONUS_ID_TO_EMOJI).filter(id => !requestedBonusIds.includes(id))
  );
  const bonusIds = [...requestedBonusIds, ...randomBonusIds];
  const selectedBonuses = bonusIds.slice(0, config.bonusCount);
  const bonusEmojis = selectedBonuses.map(id => BONUS_ID_TO_EMOJI[id]);

  // Build pairIds: bonus emojis first, then fill with non-conflicting random emojis
  const bonusEmojiSet = new Set(bonusEmojis);
  const nonBonusPool = shuffleArray(ALL_EMOJIS.filter(e => !bonusEmojiSet.has(e)));
  const pairIds = [...bonusEmojis, ...nonBonusPool.slice(0, pairCount - bonusEmojis.length)];

  // Build bonusMap using bonus emojis as keys
  const bonusPairIds: string[] = [];
  const bonusMap: Record<string, Bonus> = {};
  const bonusOrder: string[] = [];
  selectedBonuses.forEach((bonusId, i) => {
    const bonusEmoji = bonusEmojis[i];
    const bonusDef = Object.values(EMOJI_BONUS_MAP).find(b => b.id === bonusId);
    if (bonusDef && bonusEmoji) {
      bonusMap[bonusEmoji] = { ...bonusDef, count: 0 };
      bonusOrder.push(bonusEmoji);
      bonusPairIds.push(bonusEmoji);
    }
  });

  // Display emoji: for level 8 show empty (color only), otherwise same as pairId
  const displayEmojis = isColorMatch
    ? Array(pairCount).fill('')
    : [...pairIds];

  // Pick trap pairIds (from non-bonus pairs) — level 8 has no traps
  const bonusPairIdSet = new Set(bonusPairIds);
  const nonBonusPairIds = pairIds.filter(id => !bonusPairIdSet.has(id));
  const trapPairIds = isColorMatch ? [] : shuffleArray(nonBonusPairIds).slice(0, config.trapCount);

  // Assign trap types based on level blocks
  // 1-4: 1 from block 1
  // 5-8: 1 from block 2 + 1 from block 1
  // 9-12: 1 from block 1 + 1 from block 2 + 1 from block 3
  // 13-16: 1 from block 2 + 1 from block 3 + 1 from block 4
  let blockSources: number[] = [];
  if (level <= 4) blockSources = [1];
  else if (level <= 8) blockSources = [2, 1];
  else if (level <= 12) blockSources = [1, 2, 3];
  else blockSources = [2, 3, 4];

  const trapDefs = trapPairIds.map((_, i) => {
    const blockIdx = blockSources[i % blockSources.length] - 1;
    const block = TRAP_BLOCKS[blockIdx];
    return block[Math.floor(Math.random() * block.length)];
  });

  const cards = pairIds.flatMap((pairId, index) => [
    { id: index * 2, emoji: displayEmojis[index], pairId, isFlipped: false, isMatched: false, isWrong: false, isHinted: false, contentHidden: false, isBlurred: false, colorIndex: isColorMatch ? index : undefined },
    { id: index * 2 + 1, emoji: displayEmojis[index], pairId, isFlipped: false, isMatched: false, isWrong: false, isHinted: false, contentHidden: false, isBlurred: false, colorIndex: isColorMatch ? index : undefined },
  ]);

  return { cards: shuffleArray(cards), bonusMap, bonusOrder, trapPairIds, trapDefs };
}

function App() {
  const [level, setLevel] = useState(1);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(LEVELS[0].time);
  const [isActive, setIsActive] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [timerFrozen, setTimerFrozen] = useState(false);
  const timerFrozenRef = useRef(false);
  const [boardFrozen, setBoardFrozen] = useState(false);
  const boardFrozenRef = useRef(false);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [bonusMap, setBonusMap] = useState<Record<string, Bonus>>({});
  const [bonusOrder, setBonusOrder] = useState<string[]>([]); // ordered emojis for "top bonus lost"
  void bonusOrder;
  const [availableBonuses, setAvailableBonuses] = useState<string[]>([]); // emojis still available to collect
  const [trapsTriggered, setTrapsTriggered] = useState(0); // count of traps triggered this round
  const [triggeredTrapIds, setTriggeredTrapIds] = useState<Set<string>>(new Set()); // which trap pairIds have been triggered
  const [bonusesCollected, setBonusesCollected] = useState(0); // count of bonuses collected this round
  const [score, setScore] = useState(0); // total score across rounds
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [trapPairIds, setTrapPairIds] = useState<string[]>([]);
  const [trapDefs, setTrapDefs] = useState<TrapDef[]>([]);
  const [markedTraps, setMarkedTraps] = useState<Set<number>>(new Set());
  const [roundModifiers, setRoundModifiers] = useState<RoundModifiers>({ ...DEFAULT_MODIFIERS });
  const roundModifiersRef = useRef<RoundModifiers>({ ...DEFAULT_MODIFIERS });
  // Keep ref in sync with state to avoid stale closures
  useEffect(() => { roundModifiersRef.current = roundModifiers; }, [roundModifiers]);
  const [roundCondition, setRoundCondition] = useState<RoundCondition | null>(null);
  const [showRoundCondition, setShowRoundCondition] = useState(false);
  const [sectionPhase, setSectionPhase] = useState(0); // level 12: 0=even open, 1=odd open
  const [cardsOpenedInPhase, setCardsOpenedInPhase] = useState(0); // level 12: count opens per phase
  const [failCounter, setFailCounter] = useState(0); // level 15: consecutive fails
  const failCounterRef = useRef(0);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  const [bonusMessage, setBonusMessage] = useState<string>('');
  const [trapMessage, setTrapMessage] = useState<string>('');
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelCompleting, setLevelCompleting] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [backdoorClicks, setBackdoorClicks] = useState(0);
  // backdoorClicks is used implicitly via setBackdoorClicks
  void backdoorClicks;
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const [swappingIndices, setSwappingIndices] = useState<Set<number>>(new Set());
  const pendingSwapRef = useRef<(() => void) | null>(null);
  const [trapShiftCountdown, setTrapShiftCountdown] = useState<number | null>(null);
  const [freezeCountdown, setFreezeCountdown] = useState<number | null>(null);
  const [debugLogs, setDebugLogs] = useState<{ text: string; type: string }[]>([]);
  const [showDebugLog, setShowDebugLog] = useState(false);

  // Keyboard listener for F10 to toggle debug log
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        setShowDebugLog(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const backdoorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bonusMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trapMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideContentTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Initialize level
  const initLevel = useCallback((lvl: number, forcedBonusIds: string[] = []) => {
    const setup = setupLevel(lvl, forcedBonusIds);
    const config = LEVELS[Math.min(lvl - 1, LEVELS.length - 1)];
    setCards(setup.cards);
    setBonusMap(setup.bonusMap);
    setBonusOrder(setup.bonusOrder);
    setAvailableBonuses([...setup.bonusOrder]);
    grantedRef.current = new Set();
    setTrapPairIds(setup.trapPairIds);
    setTrapDefs(setup.trapDefs);
    setTrapsTriggered(0);
    setTriggeredTrapIds(new Set());
    setMarkedTraps(new Set());
    setRoundModifiers({ ...DEFAULT_MODIFIERS });
    roundModifiersRef.current = { ...DEFAULT_MODIFIERS };
    setFlippedCards([]);
    setTimeLeft(config.time);
    setIsActive(false);
    setGameWon(false);
    setGameOver(false);
    setTimerFrozen(false);
    setBoardFrozen(false);
    setConfetti([]);
    setBonusMessage('');
    setTrapMessage('');
    if (bonusMsgTimerRef.current) clearTimeout(bonusMsgTimerRef.current);
    if (trapMsgTimerRef.current) clearTimeout(trapMsgTimerRef.current);
    hideContentTimersRef.current.forEach(t => clearTimeout(t));
    hideContentTimersRef.current.clear();
    setLevelCompleting(false);
    setSectionPhase(0);
    setCardsOpenedInPhase(0);
    setFailCounter(0);
    failCounterRef.current = 0;

    // Check for special round condition
    const condition = ROUND_CONDITIONS.find(c => c.level === lvl) || null;
    setRoundCondition(condition);
    if (condition) {
      setShowRoundCondition(true);
    }

    // Level 13: assign random rotations to cards
    if (condition?.id === 'rotated') {
      const rotations = [90, 180, 270];
      setup.cards.forEach(card => {
        card.rotation = rotations[Math.floor(Math.random() * rotations.length)];
      });
    }
  }, []);

  useEffect(() => {
    window.__MEMORY_GAME_TEST_API__ = {
      getSnapshot: () => ({
        level,
        timeLeft,
        score,
        gameWon,
        gameOver,
        timerFrozen,
        boardFrozen,
        freezeCountdown,
        trapShiftCountdown,
        bonusesCollected,
        trapsTriggered,
        roundConditionId: roundCondition?.id || null,
        availableBonuses: [...availableBonuses],
        bonusMapByPairId: Object.fromEntries(
          Object.entries(bonusMap).map(([pairId, bonus]) => [
            pairId,
            { id: bonus.id, description: bonus.description },
          ])
        ),
        trapPairIds: [...trapPairIds],
        bonuses: bonuses.map(({ id, description, count }) => ({ id, description, count })),
        roundModifiers: { ...roundModifiers },
        cards: cards.map((card, index) => ({
          id: card.id,
          index,
          emoji: card.emoji,
          pairId: card.pairId,
          rotation: card.rotation,
          isFlipped: !!card.isFlipped,
          isMatched: !!card.isMatched,
          isHinted: !!card.isHinted,
          contentHidden: !!card.contentHidden,
        })),
      }),
      setTimeLeftForTest: (value: number) => setTimeLeft(value),
      startLevelForTest: (targetLevel: number, forcedBonusIds: string[] = []) => {
        setLevel(targetLevel);
        initLevel(targetLevel, forcedBonusIds);
        setShowIntro(false);
        setShowRoundCondition(false);
      },
    };

    return () => {
      delete window.__MEMORY_GAME_TEST_API__;
    };
  }, [
    availableBonuses,
    boardFrozen,
    bonusMap,
    bonuses,
    bonusesCollected,
    cards,
    freezeCountdown,
    gameOver,
    gameWon,
    initLevel,
    level,
    roundModifiers,
    roundCondition,
    score,
    timeLeft,
    timerFrozen,
    trapShiftCountdown,
    trapsTriggered,
    trapPairIds,
  ]);

  useEffect(() => {
    initLevel(1);
    setBonuses([]);
  }, []);

  // Auto-close level selector when level changes (fixes React state batching issue)
  useEffect(() => {
    if (showLevelSelect) {
      setShowLevelSelect(false);
    }
  }, [level]);

  // Countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && !gameWon && !gameOver) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (roundModifiersRef.current.autoshieldActive) {
              setRoundModifiers(rm => ({ ...rm, autoshieldActive: false }));
              roundModifiersRef.current = { ...roundModifiersRef.current, autoshieldActive: false };
              showBonusMsg('🛡️ Автозащита! +10 секунд!');
              return prev + 10;
            }
            setGameOver(true);
            setIsActive(false);
            return 0;
          }
          return timerFrozen ? prev : prev - roundModifiersRef.current.timerSpeed;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, gameWon, gameOver, timerFrozen, roundModifiers.timerSpeed]);

  // Level 10: trapShift — every 10s, unopened trap cards swap with random unopened non-trap cards
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // Keep frozen refs in sync
  useEffect(() => { timerFrozenRef.current = timerFrozen; }, [timerFrozen]);
  useEffect(() => { boardFrozenRef.current = boardFrozen; }, [boardFrozen]);

  useEffect(() => {
    if (roundCondition?.id !== 'trapShift' || !isActive || gameWon || gameOver) {
      setTrapShiftCountdown(null);
      return;
    }
    setTrapShiftCountdown(10);
    const countdownInterval = setInterval(() => {
      if (timerFrozenRef.current || boardFrozenRef.current || roundModifiersRef.current.paused) return;
      setTrapShiftCountdown(prev => prev !== null && prev > 1 ? prev - 1 : 10);
    }, 1000);
    const swapInterval = setInterval(() => {
      if (timerFrozenRef.current || boardFrozenRef.current || roundModifiersRef.current.paused) return;
      const currentCards = cardsRef.current;
      const trapIndices = currentCards.map((c, i) => ({ c, i }))
        .filter(x => !x.c.isFlipped && !x.c.isMatched && trapPairIds.includes(x.c.pairId))
        .map(x => x.i);
      if (trapIndices.length === 0) return;

      const nonTrapIndices = currentCards.map((c, i) => ({ c, i }))
        .filter(x => !x.c.isFlipped && !x.c.isMatched && !trapPairIds.includes(x.c.pairId))
        .map(x => x.i);
      if (nonTrapIndices.length === 0) return;

      const trapIdx = trapIndices[Math.floor(Math.random() * trapIndices.length)];
      const nonTrapIdx = nonTrapIndices[Math.floor(Math.random() * nonTrapIndices.length)];

      // Start swap animation: shrink → swap → grow
      setSwappingIndices(new Set([trapIdx, nonTrapIdx]));
      pendingSwapRef.current = () => {
        setCards(prev => {
          const result = [...prev];
          const temp = { ...result[trapIdx] };
          result[trapIdx] = { ...result[nonTrapIdx] };
          result[nonTrapIdx] = temp;
          return result;
        });
        showBonusMsg('🔮 Ловушки переместились!');
      };
      setTrapShiftCountdown(10);
    }, 10000);
    return () => {
      clearInterval(countdownInterval);
      clearInterval(swapInterval);
    };
  }, [roundCondition?.id, isActive, gameWon, gameOver, trapPairIds]);

  // Check win condition (level complete) — when all non-trap pairs are matched
  useEffect(() => {
    if (cards.length === 0 || levelCompleting) return;
    // All non-trap cards must be matched; trap cards are never opened
    const allNonTrapMatched = cards.every((card) =>
      card.isMatched || trapPairIds.includes(card.pairId)
    );
    if (allNonTrapMatched && !gameWon && !gameOver) {
      setLevelCompleting(true);
      setIsActive(false);

      // Auto-mark trap cards as matched (they stay face-down but count as done)
      setCards(prev => prev.map(card =>
        trapPairIds.includes(card.pairId) ? { ...card, isMatched: true } : card
      ));

      // Just show info about unmarked traps (they already fired during gameplay)
      const unmarkedTraps = trapPairIds.filter((trapPairId) => {
        const trapCardIndices = cards
          .map((card, i) => ({ card, i }))
          .filter(c => c.card.pairId === trapPairId)
          .map(c => c.i);
        return !trapCardIndices.every(idx => markedTraps.has(idx));
      });

      if (unmarkedTraps.length > 0) {
        showTrapMsg(`⚠️ ${unmarkedTraps.length} непомеченн${unmarkedTraps.length === 1 ? 'ая' : unmarkedTraps.length < 5 ? 'ые' : 'ых'} ловушк${unmarkedTraps.length === 1 ? 'а' : unmarkedTraps.length < 5 ? 'и' : 'ок'} сработали!`);
      } else if (trapPairIds.length > 0) {
        showBonusMsg('🛡️ Все ловушки нейтрализованы пометками!');
      }

      completeLevel();
    }
  }, [cards, gameWon, gameOver, trapPairIds, trapDefs, markedTraps, levelCompleting]);

  // Swap animation: shrink → swap → grow
  // When swappingIndices is set, cards shrink. After 500ms, the actual swap happens and indices clear (cards grow back).
  // When swappingIndices becomes empty and there was a pending swap, play grow animation via CSS transition.

  // Execute pending swap after shrink completes (500ms)
  useEffect(() => {
    if (swappingIndices.size > 0 && pendingSwapRef.current) {
      const timer = setTimeout(() => {
        pendingSwapRef.current!();
        pendingSwapRef.current = null;
        setSwappingIndices(new Set()); // triggers grow
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [swappingIndices]);

  const completeLevel = () => {
    // Calculate round score: remaining seconds × (bonuses - traps), minimum multiplier 1
    const multiplier = Math.max(1, bonusesCollected - trapsTriggered);
    const roundScore = timeLeft * multiplier * (roundModifiers.doublePoints ? 2 : 1);
    setScore(prev => prev + roundScore);

    if (level >= MAX_LEVEL) {
      setGameWon(true);
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff1493'];
      setConfetti(Array.from({ length: 100 }, (_, i) => ({
        id: i, x: Math.random() * 100, y: -10,
        color: colors[Math.floor(Math.random() * colors.length)],
      })));
      setTimeout(() => setConfetti([]), 5000);
    } else {
      setShowLevelUp(true);
      setTimeout(() => {
        setShowLevelUp(false);
        setLevel(prev => prev + 1);
        initLevel(level + 1);
      }, 2000);
    }
  };


  const showBonusMsg = (msg: string) => {
    setBonusMessage(msg);
    if (bonusMsgTimerRef.current) clearTimeout(bonusMsgTimerRef.current);
    bonusMsgTimerRef.current = setTimeout(() => setBonusMessage(''), 2000);
  };

  const showTrapMsg = (msg: string) => {
    setTrapMessage(msg);
    if (trapMsgTimerRef.current) clearTimeout(trapMsgTimerRef.current);
    trapMsgTimerRef.current = setTimeout(() => setTrapMessage(''), 3000);
  };

  const grantedRef = useRef<Set<string>>(new Set());

  const grantBonus = useCallback((pairId: string) => {
    const bonusDef = bonusMap[pairId];
    if (!bonusDef) return;
    // Guard against double-granting
    if (grantedRef.current.has(pairId)) {
      console.log(`[GRANT BONUS BLOCKED] pairId=${pairId} — already granted`);
      return;
    }
    grantedRef.current.add(pairId);

    // Find display emoji for this pairId (for level 8, display differs from pairId)
    const displayEmoji = cards.find(c => c.pairId === pairId)?.emoji || pairId;

    setBonuses(prev => {
      const existing = prev.find(b => b.id === bonusDef.id);
      if (existing) {
        return prev.map(b => b.id === bonusDef.id ? { ...b, count: b.count + 1 } : b);
      }
      return [...prev, { ...bonusDef, count: 1, cardEmoji: displayEmoji }];
    });
    console.log(`[GRANT BONUS] pairId=${pairId} bonus=${bonusDef.name}`);
    setDebugLogs(prev => [...prev.slice(-20), { text: `[GRANT BONUS] ${pairId} → ${bonusDef.name}`, type: 'bonus' }]);
    showBonusMsg(`Бонус получен: ${bonusDef.name}!`);
  }, [bonusMap, cards]);

  // Right-click to mark/unmark a card as trap (disabled in round 10 — trapShift)
  const handleRightClick = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (gameOver || gameWon || boardFrozen) return;
    if (roundCondition?.id === 'trapShift') return; // cannot mark traps in round 10
    if (cards[index].isFlipped || cards[index].isMatched) return;

    console.log(`[RIGHT-CLICK] card=${index} — mark/unmark trap`);
    setDebugLogs(prev => [...prev.slice(-20), { text: `[RIGHT-CLICK] #${index} — mark/unmark trap`, type: 'click' }]);
    setMarkedTraps(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        // Limit marks to number of trap cards (trapPairIds.length * 2)
        if (next.size >= trapPairIds.length * 2) return prev;
        next.add(index);
      }
      return next;
    });
  }, [cards, gameOver, gameWon, boardFrozen, trapPairIds]);

  const handleUseBonus = useCallback((bonusId: string) => {
    setBonuses(prev => {
      const bonus = prev.find(b => b.id === bonusId);
      if (!bonus || bonus.count <= 0) return prev;

      const newBonuses = prev.map(b =>
        b.id === bonusId ? { ...b, count: b.count - 1 } : b
      );

      switch (bonusId) {
        case 'timer10': {
          setTimeLeft(prev => prev + 10);
          showBonusMsg('⏳ +10 секунд!');
          break;
        }
        case 'sticky5': {
          setRoundModifiers(prev => ({ ...prev, stickyOpen: true }));
          showBonusMsg('📌 Прилипала! 5 сек карточки не закрываются!');
          setTimeout(() => {
            setRoundModifiers(prev => ({ ...prev, stickyOpen: false }));
            // Close non-matched flipped cards after sticky ends
            setCards(prev => prev.map(c => (!c.isMatched && c.isFlipped) ? { ...c, isFlipped: false } : c));
            setFlippedCards([]);
          }, 5000);
          break;
        }
        case 'xray': {
          setCards(prev => prev.map(c => ({ ...c, isFlipped: true })));
          showBonusMsg('👁️ Рентген! Все карточки открыты на 0.5 сек!');
          setTimeout(() => {
            setCards(prev => prev.map(c => (!c.isMatched) ? { ...c, isFlipped: false } : c));
            setFlippedCards([]);
          }, 500);
          break;
        }
        case 'autoshield': {
          setRoundModifiers(prev => ({ ...prev, autoshieldActive: true }));
          showBonusMsg('🛡️ Автозащита активирована! Сработает при 0:00');
          break;
        }
        case 'anchor': {
          setRoundModifiers(prev => ({ ...prev, anchorNext: true }));
          showBonusMsg('⚓ Якорь! Следующая карта не будет перемещена!');
          break;
        }
        case 'autopair': {
          setCards(prevCards => {
            const unmatched = prevCards.map((card, i) => ({ card, i }))
              .filter(c => !c.card.isMatched && !c.card.isFlipped);
            if (unmatched.length < 2) return prevCards;
            const emojiGroups: Record<string, number[]> = {};
            unmatched.forEach(c => {
              if (!emojiGroups[c.card.emoji]) emojiGroups[c.card.emoji] = [];
              emojiGroups[c.card.emoji].push(c.i);
            });
            const pairEmojis = Object.entries(emojiGroups).filter(([, indices]) => indices.length >= 2);
            if (pairEmojis.length === 0) return prevCards;
            const [emoji, indices] = pairEmojis[Math.floor(Math.random() * pairEmojis.length)];
            showBonusMsg(`🪐 Планета нашла пару: ${emoji}!`);
            return prevCards.map((card, i) =>
              indices.includes(i) ? { ...card, isMatched: true, isFlipped: true } : card
            );
          });
          break;
        }
        case 'freeze': {
          setTimerFrozen(true);
          setBoardFrozen(true);
          setFreezeCountdown(10);
          showBonusMsg('❄️ Заморозка! 10 сек');
          if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
          const interval = setInterval(() => {
            setFreezeCountdown(prev => {
              if (prev === null || prev <= 1) {
                clearInterval(interval);
                setTimerFrozen(false);
                setBoardFrozen(false);
                setFreezeCountdown(null);
                return null;
              }
              const next = prev - 1;
              showBonusMsg(`❄️ Заморозка! ${next} сек`);
              return next;
            });
          }, 1000);
          freezeTimerRef.current = setTimeout(() => {
            clearInterval(interval);
            setTimerFrozen(false);
            setBoardFrozen(false);
            setFreezeCountdown(null);
          }, 10000);
          break;
        }
        case 'superpos': {
          setRoundModifiers(prev => ({ ...prev, superposNext: true }));
          showBonusMsg('🔮 Суперпозиция! Следующая карта останется открытой!');
          break;
        }
        case 'microblast': {
          // Will be handled on next card click via roundModifiers
          setRoundModifiers(prev => ({ ...prev, microblastNext: true }));
          showBonusMsg('💥 Микровзрыв! Следующая карта откроется с соседями!');
          break;
        }
        case 'canceltrap': {
          setRoundModifiers(prev => ({ ...prev, cancelTrapNext: true }));
          showBonusMsg('🚫 Анти-ловушка! Следующая ловушка будет отменена!');
          break;
        }
        case 'trapglow': {
          // Highlight trap cards for 0.5s
          setCards(prev => prev.map((c) =>
            trapPairIds.includes(c.pairId) && !c.isMatched ? { ...c, isHinted: true } : c
          ));
          showBonusMsg('🔦 Детектор! Ловушки подсвечены на 0.5 сек!');
          setTimeout(() => {
            setCards(prev => prev.map(c => ({ ...c, isHinted: false })));
          }, 500);
          break;
        }
        case 'silhouettes': {
          setRoundModifiers(prev => ({ ...prev, silhouetteOpen: true }));
          showBonusMsg('🎭 Силуэты! Все рисунки видны на 3 сек!');
          setCards(prev => prev.map(c => (!c.isMatched && !c.isFlipped) ? { ...c, isFlipped: true, contentHidden: true } : c));
          setTimeout(() => {
            setCards(prev => prev.map(c => (!c.isMatched && c.contentHidden) ? { ...c, isFlipped: false, contentHidden: false } : c));
            setRoundModifiers(prev => ({ ...prev, silhouetteOpen: false }));
            setFlippedCards([]);
          }, 3000);
          break;
        }
        case 'sort': {
          setCards(prev => {
            const matched = prev.filter(c => c.isMatched);
            const unmatched = prev.filter(c => !c.isMatched);
            return [...matched, ...unmatched];
          });
          showBonusMsg('📊 Сортировка! Собранные пары перемещены вверх!');
          break;
        }
        case 'show3pairs': {
          setCards(prevCards => {
            const unmatched = prevCards.map((card, i) => ({ card, i }))
              .filter(c => !c.card.isMatched && !c.card.isFlipped);
            const emojiGroups: Record<string, number[]> = {};
            unmatched.forEach(c => {
              if (!emojiGroups[c.card.emoji]) emojiGroups[c.card.emoji] = [];
              emojiGroups[c.card.emoji].push(c.i);
            });
            const pairEmojis = Object.entries(emojiGroups).filter(([, indices]) => indices.length >= 2);
            if (pairEmojis.length === 0) return prevCards;
            const chosen = shuffleArray(pairEmojis).slice(0, 3);
            const revealIndices = chosen.flatMap(([, indices]) => indices.slice(0, 2));
            showBonusMsg('💡 Подсказка! 3 пары показаны на 1 сек!');
            const newCards = prevCards.map((card, i) =>
              revealIndices.includes(i) ? { ...card, isHinted: true } : card
            );
            setTimeout(() => {
              setCards(prev => prev.map(card => ({ ...card, isHinted: false })));
            }, 1000);
            return newCards;
          });
          break;
        }
        case 'pause': {
          setTimerFrozen(true);
          setBoardFrozen(true);
          showBonusMsg('⏸️ Пауза! 10 секунд чтобы подумать');
          setRoundModifiers(prev => ({ ...prev, paused: true }));
          roundModifiersRef.current = { ...roundModifiersRef.current, paused: true };
          // Auto-unpause after 10 seconds
          setTimeout(() => {
            setRoundModifiers(prev => ({ ...prev, paused: false }));
            roundModifiersRef.current = { ...roundModifiersRef.current, paused: false };
            setTimerFrozen(false);
            setBoardFrozen(false);
          }, 10000);
          break;
        }
        case 'doublepoints': {
          setRoundModifiers(prev => ({ ...prev, doublePoints: true }));
          showBonusMsg('✨ Двойные очки! 10 сек удвоения!');
          setTimeout(() => {
            setRoundModifiers(prev => ({ ...prev, doublePoints: false }));
          }, 10000);
          break;
        }
      }
      return newBonuses;
    });
  }, [trapPairIds, cards, showBonusMsg]);

  const handleCardClick = useCallback(
    (index: number) => {
      // Pause: unpause on any click
      if (roundModifiersRef.current.paused) {
        setRoundModifiers(prev => ({ ...prev, paused: false }));
        roundModifiersRef.current = { ...roundModifiersRef.current, paused: false };
        setTimerFrozen(false);
        setBoardFrozen(false);
        return;
      }
      if (gameOver || gameWon || boardFrozen) return;
      if (roundModifiers.singleCardMode && flippedCards.length >= 1) return;
      if (!isActive) setIsActive(true);
      if (flippedCards.length === 2) return;
      if (cards[index].isFlipped || cards[index].isMatched || cards[index].isHinted) return;
      console.log(`[CLICK] card=${index} emoji=${cards[index].emoji} pairId=${cards[index].pairId} flipped=${flippedCards.length}`);
      setDebugLogs(prev => [...prev.slice(-20), { text: `[CLICK] #${index} ${cards[index].emoji} pairId=${cards[index].pairId}`, type: 'click' }]);

      // Microblast: open this card + 4 neighbors, then close non-matched
      if (roundModifiers.microblastNext) {
        setRoundModifiers(prev => ({ ...prev, microblastNext: false }));
        const cols = cards.length > 14 ? 6 : 4;
        const neighbors = [index - cols, index + cols, index - 1, index + 1].filter(n =>
          n >= 0 && n < cards.length && !cards[n].isFlipped && !cards[n].isMatched &&
          !(index % cols === 0 && n === index - 1) && !(index % cols === cols - 1 && n === index + 1)
        );
        const allIndices = [index, ...neighbors];
        setCards(prev => prev.map((c, i) => allIndices.includes(i) ? { ...c, isFlipped: true } : c));
        setFlippedCards([index]);
        // Check for matches among opened cards
        setTimeout(() => {
          setCards(prev => {
            const opened = allIndices.filter(i => prev[i].isFlipped && !prev[i].isMatched);
            const emojiGroups: Record<string, number[]> = {};
            opened.forEach(i => {
              if (!emojiGroups[prev[i].emoji]) emojiGroups[prev[i].emoji] = [];
              emojiGroups[prev[i].emoji].push(i);
            });
            const matchedIndices = new Set<number>();
            Object.values(emojiGroups).forEach(indices => {
              if (indices.length >= 2) {
                matchedIndices.add(indices[0]);
                matchedIndices.add(indices[1]);
              }
            });
            return prev.map((c, i) => {
              if (allIndices.includes(i)) {
                if (matchedIndices.has(i)) return { ...c, isMatched: true };
                return { ...c, isFlipped: false };
              }
              return c;
            });
          });
          setFlippedCards([]);
        }, 1000);
        return;
      }

      // Level 12: sections — block clicks in closed sections
      if (roundCondition?.id === 'sections') {
        const cols = cards.length > 14 ? 6 : 4;
        const rows = Math.ceil(cards.length / cols);
        const row = Math.floor(index / cols);
        const col = index % cols;
        const sectionRow = row < rows / 2 ? 0 : 1;
        const sectionCol = col < cols / 2 ? 0 : 1;
        const sectionNum = sectionRow * 2 + sectionCol; // 0,1,2,3
        const isEvenSection = sectionNum % 2 === 0;
        // phase 0: even sections open, phase 1: odd sections open
        if (sectionPhase === 0 && !isEvenSection) return;
        if (sectionPhase === 1 && isEvenSection) return;
      }

      const newCards = [...cards];
      newCards[index].isFlipped = true;
      newCards[index].isWrong = false;
      newCards[index].contentHidden = false;
      if (roundModifiers.blurCount > 0) {
        newCards[index].isBlurred = true;
      }
      setCards(newCards);

      // Decrement blur count
      if (roundModifiers.blurCount > 0) {
        setRoundModifiers(prev => ({ ...prev, blurCount: prev.blurCount - 1 }));
      }

      const newFlipped = [...flippedCards, index];
      setFlippedCards(newFlipped);

      // Level 12: track cards opened in current phase
      if (roundCondition?.id === 'sections') {
        const newCount = cardsOpenedInPhase + 1;
        setCardsOpenedInPhase(newCount);
        if (newCount >= 3) {
          setSectionPhase(prev => (prev === 0 ? 1 : 0));
          setCardsOpenedInPhase(0);
        }
      }

      // Level 10: trapShift — cannot mark traps, traps swap with random unopened cards every 10s
      // (handled by useEffect timer, see below)

      // Ghost mode: card shows for 0.5s then hides
      if (roundModifiers.ghostMode && !cards[index].isMatched) {
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => i === index ? { ...c, isFlipped: false } : c));
        }, 500);
      }

      // Hide open cards modifier: show this card briefly, then hide its content after 1.5s
      if (roundModifiers.hideOpenCards) {
        const hideIdx = index;
        // Clear any previous hide timer for this card
        const prevTimer = hideContentTimersRef.current.get(hideIdx);
        if (prevTimer) clearTimeout(prevTimer);
        const timer = setTimeout(() => {
          setCards(prev => prev.map((c, i) => i === hideIdx && c.isFlipped ? { ...c, contentHidden: true } : c));
          hideContentTimersRef.current.delete(hideIdx);
        }, 1500);
        hideContentTimersRef.current.set(hideIdx, timer);
      }

      if (newFlipped.length === 2) {
        const [first, second] = newFlipped;

        // Cancel hide timers for both cards during comparison
        if (roundModifiers.hideOpenCards) {
          const t1 = hideContentTimersRef.current.get(first);
          const t2 = hideContentTimersRef.current.get(second);
          if (t1) { clearTimeout(t1); hideContentTimersRef.current.delete(first); }
          if (t2) { clearTimeout(t2); hideContentTimersRef.current.delete(second); }
        }

        // Match by pairId (stable identity), or by colorIndex for level 8
        const isMatch = roundCondition?.id === 'colorMatch'
          ? cards[first].colorIndex === cards[second].colorIndex
          : cards[first].pairId === cards[second].pairId;

        if (isMatch) {
          const matchedPairId = cards[first].pairId;
          const matchDelay = roundModifiers.slowOpen ? 1200 : roundModifiers.fastOpen ? 300 : 600;
          setTimeout(() => {
            setCards((prev) => {
              let updated = prev.map((card, i) =>
                i === first || i === second ? { ...card, isMatched: true, isBlurred: false } : card
              );

              // Level 9: jumpPair — matched pair jumps one cell in random direction
              if (roundCondition?.id === 'jumpPair' && !roundModifiers.anchorNext) {
                const directions = [
                  { dr: -1, dc: 0 }, // up
                  { dr: 1, dc: 0 },  // down
                  { dr: 0, dc: -1 }, // left
                  { dr: 0, dc: 1 },  // right
                ];
                const cols = updated.length > 14 ? 6 : 4;
                const swapPairs: [number, number][] = [];
                [first, second].forEach(idx => {
                  const row = Math.floor(idx / cols);
                  const col = idx % cols;
                  const dir = directions[Math.floor(Math.random() * directions.length)];
                  const newRow = Math.max(0, Math.min(Math.ceil(updated.length / cols) - 1, row + dir.dr));
                  const newCol = Math.max(0, Math.min(cols - 1, col + dir.dc));
                  const targetIdx = newRow * cols + newCol;
                  if (targetIdx !== idx && targetIdx < updated.length) {
                    swapPairs.push([idx, targetIdx]);
                  }
                });
                if (swapPairs.length > 0) {
                  const allSwapIndices = swapPairs.flat();
                  // Defer the actual swap — first mark matched, then animate shrink, then swap + grow
                  setSwappingIndices(new Set(allSwapIndices));
                  pendingSwapRef.current = () => {
                    setCards(prev => {
                      const result = [...prev];
                      swapPairs.forEach(([a, b]) => {
                        const temp = { ...result[a] };
                        result[a] = { ...result[b] };
                        result[b] = temp;
                      });
                      return result;
                    });
                  };
                }
              }

              // Level 14: mirror — reflect field after match
              if (roundCondition?.id === 'mirror') {
                const horizontal = Math.random() < 0.5;
                if (horizontal) {
                  updated = [...updated].reverse();
                } else {
                  const cols = updated.length > 14 ? 6 : 4;
                  const rows = Math.ceil(updated.length / cols);
                  const result: GameCard[] = [];
                  for (let r = 0; r < rows; r++) {
                    const rowCards = updated.slice(r * cols, (r + 1) * cols);
                    result.push(...[...rowCards].reverse());
                    // pad if last row is short
                    while (result.length < (r + 1) * cols) result.push(updated[result.length] || updated[0]);
                  }
                  updated = result.slice(0, updated.length);
                }
              }

              return updated;
            });
            setFlippedCards([]);

            // Level 16: fadePair — matched pair starts fading after 10s, flips back after 15s
            if (roundCondition?.id === 'fadePair') {
              setTimeout(() => {
                setCards(prev => prev.map((c, i) =>
                  (i === first || i === second) && c.isMatched ? { ...c, isHinted: true } : c
                ));
              }, 10000);
              setTimeout(() => {
                setCards(prev => prev.map((c, i) =>
                  (i === first || i === second) ? { ...c, isMatched: false, isFlipped: false, isHinted: false } : c
                ));
              }, 15000);
            }

            // Check if it's a trap pair (traps are separate from bonuses now)
            if (trapPairIds.includes(matchedPairId)) {
              const trapIdx = trapPairIds.indexOf(matchedPairId);
              const trapCardIndices = cards
                .map((c, i) => ({ c, i }))
                .filter(x => x.c.pairId === matchedPairId)
                .map(x => x.i);
              const bothMarked = trapCardIndices.every(idx => markedTraps.has(idx));
              if (bothMarked) {
                console.log(`[TRAP NEUTRALIZED] pairId=${matchedPairId} — both cards marked`);
                setDebugLogs(prev => [...prev.slice(-20), { text: `[TRAP NEUTRALIZED] ${matchedPairId} — both marked`, type: 'bonus' }]);
                showBonusMsg(`🛡️ Ловушка нейтрализована пометкой!`);
              } else if (roundModifiersRef.current.cancelTrapNext) {
                setRoundModifiers(prev => ({ ...prev, cancelTrapNext: false }));
                roundModifiersRef.current = { ...roundModifiersRef.current, cancelTrapNext: false };
                console.log(`[TRAP CANCELLED] pairId=${matchedPairId} — cancelTrapNext was active`);
                setDebugLogs(prev => [...prev.slice(-20), { text: `[TRAP CANCELLED] ${matchedPairId} — анти-ловушка!`, type: 'bonus' }]);
                showBonusMsg(`🚫 Анти-ловушка отменила ловушку!`);
              } else {
                const trapDef = trapDefs[trapIdx];
                if (trapDef) {
                  console.log(`[TRAP TRIGGERED] pairId=${matchedPairId} trap=${trapDef.id} name=${trapDef.name}`);
                  setDebugLogs(prev => [...prev.slice(-20), { text: `[TRAP TRIGGERED] ${matchedPairId} → ${trapDef.id} ${trapDef.name}`, type: 'trap' }]);
                  setTrapsTriggered(prev => prev + 1);
                  setTriggeredTrapIds(prev => new Set(prev).add(matchedPairId));
                  showTrapMsg(`⚠️ Ловушка! ${trapDef.emoji} ${trapDef.name}: ${trapDef.description}`);
                  trapDef.apply({
                    setCards,
                    setTimeLeft,
                    setBoardFrozen,
                    setRoundModifiers,
                    setMarkedTraps,
                    setGameOver,
                    setIsActive,
                    cards,
                    markedTraps,
                    showTrapMessage: showTrapMsg,
                  });
                }
              }
              // Trap pairs don't interact with bonus mechanic — skip it
            } else if (availableBonuses.includes(matchedPairId)) {
              // This pair's bonus is still available — collect it!
              console.log(`[BONUS COLLECTED] pairId=${matchedPairId} bonus=${bonusMap[matchedPairId]?.name}`);
              setDebugLogs(prev => [...prev.slice(-20), { text: `[BONUS COLLECTED] ${matchedPairId} → ${bonusMap[matchedPairId]?.name}`, type: 'bonus' }]);
              grantBonus(matchedPairId);
              setAvailableBonuses(prev => prev.filter(e => e !== matchedPairId));
              setBonusesCollected(prev => prev + 1);
            } else if (availableBonuses.length > 0) {
              // This pair's bonus was already collected/lost — lose the top available bonus
              const lostEmoji = availableBonuses[0];
              const lostBonus = bonusMap[lostEmoji];
              console.log(`[BONUS LOST] lost=${lostEmoji} bonus=${lostBonus?.name}`);
              setDebugLogs(prev => [...prev.slice(-20), { text: `[BONUS LOST] ${lostEmoji} → ${lostBonus?.name}`, type: 'trap' }]);
              setAvailableBonuses(prev => prev.slice(1));
              showBonusMsg(`❌ Бонус ${lostBonus?.emoji || ''} ${lostBonus?.name || ''} потерян!`);
            }

            // If hideOpenCards is active, hide matched cards' content after showing briefly
            if (roundModifiers.hideOpenCards) {
              [first, second].forEach(idx => {
                const timer = setTimeout(() => {
                  setCards(prev => prev.map((c, i) => i === idx && c.isFlipped ? { ...c, contentHidden: true } : c));
                  hideContentTimersRef.current.delete(idx);
                }, 1500);
                hideContentTimersRef.current.set(idx, timer);
              });
            }
          }, matchDelay);

          // Reset anchorNext after match
          if (roundModifiers.anchorNext) {
            setRoundModifiers(prev => ({ ...prev, anchorNext: false }));
            showBonusMsg('⚓ Якорь! Карточка не перемещена!');
          }

          // Reset superposNext after successful match (pair found)
          if (roundModifiers.superposNext) {
            setRoundModifiers(prev => ({ ...prev, superposNext: false }));
          }

          // Reset fail counter on successful match
          failCounterRef.current = 0;
          setFailCounter(0);
        } else {
          // Failed match
          const newFailCount = failCounterRef.current + 1;
          failCounterRef.current = newFailCount;
          setFailCounter(newFailCount);

          // StickyOpen: cards stay open (handled by bonus timeout)
          if (roundModifiers.stickyOpen) {
            setFlippedCards([]);
            // Cards will be closed when stickyOpen expires (5s timeout in handleUseBonus)
            return;
          }

          // Superposition: first card stays open until its pair is found
          const superposActive = roundModifiers.superposNext;
          if (superposActive) {
            showBonusMsg('🔮 Суперпозиция! Карточка остаётся открытой!');
            // Don't reset superposNext yet — keep it active until pair is found
          }

          const wrongDelay = roundModifiers.slowOpen ? 1500 : roundModifiers.fastOpen ? 600 : 1000;
          setTimeout(() => {
            setCards((prev) =>
              prev.map((card, i) => {
                if (i === first || i === second) {
                  if (superposActive && i === first) return card; // keep first card open
                  return { ...card, isFlipped: false, isWrong: false };
                }
                return card;
              })
            );
            if (superposActive) {
              setFlippedCards([first]);
            } else {
              setFlippedCards([]);
            }
          }, wrongDelay);
          // ShiftLine handling after cards are closed
          let didShift = false;
          let shiftType = '';
          setTimeout(() => {
            setCards((prev) => {
              const updated = [...prev];

              // Level 15: shiftLine — every 6 fails, shift a row/column at last card position
              if (roundCondition?.id === 'shiftLine' && newFailCount % 6 === 0) {
                const cols = 6; // level 15 is always 6x6
                const lastIdx = second;
                const isHorizontal = Math.random() < 0.5;
                shiftType = isHorizontal ? 'строка' : 'столбец';
                didShift = true;
                if (isHorizontal) {
                  // Shift row
                  const row = Math.floor(lastIdx / cols);
                  const startIdx = row * cols;
                  const rowCards = updated.slice(startIdx, startIdx + cols);
                  if (rowCards.length > 1) {
                    const rotated = [rowCards[rowCards.length - 1], ...rowCards.slice(0, -1)];
                    for (let c = 0; c < cols && startIdx + c < updated.length; c++) {
                      updated[startIdx + c] = rotated[c];
                    }
                  }
                } else {
                  // Shift column
                  const col = lastIdx % cols;
                  const rows = Math.ceil(updated.length / cols);
                  const colCards: GameCard[] = [];
                  for (let r = 0; r < rows; r++) {
                    const idx = r * cols + col;
                    if (idx < updated.length) colCards.push(updated[idx]);
                  }
                  if (colCards.length > 1) {
                    const rotated = [colCards[colCards.length - 1], ...colCards.slice(0, -1)];
                    for (let r = 0; r < rows; r++) {
                      const idx = r * cols + col;
                      if (idx < updated.length) updated[idx] = rotated[r];
                    }
                  }
                }
              }

              return updated;
            });
            if (didShift) {
              showBonusMsg(`↔️ Сдвиг! ${shiftType} сместился!`);
            }
            setFlippedCards([]);
          }, wrongDelay);
        }
      }
    },
    [cards, flippedCards, isActive, gameWon, gameOver, boardFrozen, trapPairIds, bonusMap, grantBonus, roundModifiers, markedTraps, trapDefs, roundCondition, sectionPhase, cardsOpenedInPhase, failCounter]
  );

  const handleRestart = () => {
    setLevel(1);
    initLevel(1);
    setBonuses([]);
    setScore(0);
    setBonusesCollected(0);
    setTrapsTriggered(0);
    setTriggeredTrapIds(new Set());
    setShowNameEntry(false);
    setPlayerName('');
    setShowIntro(false);
    if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
  };

  // Backdoor: 6 clicks on Рекорд reveals all non-trap cards + grants bonuses
  const handleBackdoor = useCallback(() => {
    if (backdoorTimerRef.current) clearTimeout(backdoorTimerRef.current);
    setBackdoorClicks(prev => {
      const next = prev + 1;
      if (next >= 6) {
        // First: reveal bonus cards and grant their bonuses
        setCards(prevCards => {
          const bonusCards = prevCards.filter(c => availableBonuses.includes(c.pairId));
          bonusCards.forEach(c => {
            if (availableBonuses.includes(c.pairId)) {
              grantBonus(c.pairId);
              setAvailableBonuses(prev => prev.filter(e => e !== c.pairId));
              setBonusesCollected(prev => prev + 1);
            }
          });
          return prevCards.map(card =>
            availableBonuses.includes(card.pairId) || (availableBonuses.length === 0 && bonusMap[card.pairId])
              ? { ...card, isFlipped: true, isMatched: true, contentHidden: false }
              : card
          );
        });
        // Then: reveal remaining non-trap cards after 500ms
        setTimeout(() => {
          setCards(prevCards => prevCards.map(card =>
            !trapPairIds.includes(card.pairId) ? { ...card, isFlipped: true, isMatched: true, contentHidden: false } : card
          ));
        }, 500);
        showBonusMsg('🔓 Бэкдор! Все карточки открыты + бонусы получены!');
        return 0;
      }
      backdoorTimerRef.current = setTimeout(() => setBackdoorClicks(0), 2000);
      return next;
    });
  }, [trapPairIds, availableBonuses, bonusMap, grantBonus]);

  const config = LEVELS[Math.min(level - 1, LEVELS.length - 1)];

  // Cloud positions for round 11 — simple spiral with collision check during placement
  const [cloudPos, setCloudPos] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (roundCondition?.id !== 'floating' || cards.length === 0) {
      setCloudPos([]);
      return;
    }
    const W = 900, H = 700; // much larger container
    const cx = W / 2, cy = H / 2;
    const cardW = 80, cardH = 80;
    const minDist = cardW + 20; // minimum distance between centers

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const positions: { x: number; y: number }[] = [];

    for (let i = 0; i < cards.length; i++) {
      const angle = i * goldenAngle;
      const radius = 40; // start from center with some offset
      let placed = false;

      // Increase radius until we find a non-overlapping position
      for (let r = radius; r < Math.max(W, H); r += 10) {
        const px = cx + Math.cos(angle) * r - cardW / 2;
        const py = cy + Math.sin(angle) * r - cardH / 2;

        // Bounds check
        if (px < 0 || py < 0 || px + cardW > W || py + cardH > H) continue;

        // Collision check
        let overlap = false;
        for (const p of positions) {
          const dx = (px + cardW / 2) - (p.x + cardW / 2);
          const dy = (py + cardH / 2) - (p.y + cardH / 2);
          if (Math.hypot(dx, dy) < minDist) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          positions.push({ x: px, y: py });
          placed = true;
          break;
        }
      }

      // Fallback: place at angle on outer boundary
      if (!placed) {
        const outerRadius = Math.min(W, H) / 2 - cardW / 2 - 20;
        const px = cx + Math.cos(angle) * outerRadius - cardW / 2;
        const py = cy + Math.sin(angle) * outerRadius - cardH / 2;
        positions.push({ x: px, y: py });
      }
    }

    setCloudPos(positions);
  }, [roundCondition?.id, cards.length]);

  // Calculate card size based on available space and card count
  const getCardSize = (): React.CSSProperties => {
    let cols = 4;
    if (cards.length > 14) cols = 6;
    if (cards.length > 24) cols = 8;
    const rows = Math.ceil(cards.length / cols);
    const availH = typeof window !== 'undefined' ? window.innerHeight - 200 : 500;
    const availW = 860; // board max width minus padding
    const maxCardW = (availW - (cols - 1) * 10) / cols;
    const maxCardH = (availH - (rows - 1) * 10) / rows;
    const size = Math.min(maxCardW, maxCardH, 80);
    return { width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.4}px` };
  };

  // Calculate max width for flex container based on columns
  const getGridMaxWidth = (): string => {
    const cs = getCardSize();
    const sizeNum = parseFloat(String(cs.width || '60'));
    let cols = 4;
    if (cards.length > 14) cols = 6;
    if (cards.length > 24) cols = 8;
    const gap = 12; // gap-3 = 12px
    return `${cols * sizeNum + (cols - 1) * gap}px`;
  };

  return (
    <div className="h-screen space-bg text-white relative overflow-hidden flex flex-col">
      <SpaceBackground />

      <div className="flex flex-col h-full px-3 py-2 w-full mx-auto relative z-10">
        {/* Bonus/Trap message popups */}
        {trapShiftCountdown !== null && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-4 py-2 rounded-xl shadow-2xl font-bold text-sm border-2 border-purple-400 flex items-center gap-2">
              🔮 Перемещение через <span className="text-yellow-300 text-lg">{trapShiftCountdown}</span>с
            </div>
          </div>
        )}
        {bonusMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50">
            <div className="animate-bounceIn bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 px-4 py-2 rounded-xl shadow-2xl font-bold text-sm border-2 border-yellow-300">
              {bonusMessage}
            </div>
          </div>
        )}
        {trapMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50">
            <div className="animate-bounceIn bg-gradient-to-r from-red-600 to-red-800 text-white px-4 py-2 rounded-xl shadow-2xl font-bold text-sm border-2 border-red-400 animate-trap-flash">
              {trapMessage}
            </div>
          </div>
        )}

        {/* Score Panel (full width header) */}
        <ScorePanel
          level={level}
          maxLevel={MAX_LEVEL}
          timeLeft={timeLeft}
          maxTime={config.time}
          score={score}
          onRestart={() => setShowRestartConfirm(true)}
          onBackdoor={handleBackdoor}
          onFAQ={() => setShowFAQ(true)}
          onLongRightPress={() => setShowLevelSelect(true)}
          timerFrozen={timerFrozen}
          boardFrozen={boardFrozen}
        />

        {/* Main game area: Bonuses | Board | Traps */}
        <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 mt-2">
          {/* Left panel: Bonuses — hidden on small screens, shown below on medium */}
          <div className="hidden lg:flex flex-1 flex-col items-end gap-1.5 overflow-y-auto py-1">
            <div className="text-sm text-green-300 uppercase font-bold w-full text-right">🎁 Бонусы</div>
            {(() => {
              // Available bonuses: not yet collected, shown as pending (hidden in color match round — no emojis)
              const availableEntries = level === 8 ? [] : availableBonuses.map(pairId => ({ pairId, bonusType: bonusMap[pairId] })).filter(e => e.bonusType);
              // Collected bonuses: have count > 0
              const collectedBonuses = bonuses.filter(b => b.count > 0);
              return <>
                {availableEntries.length > 0 && (
                  <div className="text-xs text-green-300 uppercase w-full text-right border-b border-green-400/20 pb-1 mb-1">Можно получить</div>
                )}
                {availableEntries.map((info) => {
                  const displayEmoji = cards.find(c => c.pairId === info.pairId)?.emoji || info.pairId;
                  return (
                    <div key={info.pairId}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-400/30 bg-green-500/10 text-lg"
                    >
                      <span className="text-3xl">{displayEmoji}</span>
                      <span className="text-sm text-green-200">{info.bonusType.description}</span>
                      <span className="px-2 py-1 font-bold rounded text-sm bg-indigo-700 text-indigo-400">×0</span>
                    </div>
                  );
                })}
                {collectedBonuses.length > 0 && (
                  <div className="text-xs text-yellow-400/70 uppercase w-full text-right border-b border-yellow-400/20 pb-1 mb-1 mt-2">Полученные</div>
                )}
                {collectedBonuses.map((bonus) => {
                  const cardEmoji = bonus.cardEmoji || Object.entries(bonusMap).find(([, b]) => b.id === bonus.id)?.[0] || '';
                  return (
                    <div key={bonus.id}
                      onClick={!gameWon && !gameOver && !boardFrozen ? () => handleUseBonus(bonus.id) : undefined}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-400/30 bg-yellow-500/20 text-lg cursor-pointer hover:bg-yellow-500/30 hover:scale-105 active:scale-95 transition-all"
                    >
                      {cardEmoji && <span className="text-3xl">{cardEmoji}</span>}
                      <span className="text-sm text-yellow-200">{bonus.description}</span>
                      <span className="px-2 py-1 font-bold rounded text-sm bg-green-400 text-green-900">×{bonus.count}</span>
                    </div>
                  );
                })}
                {availableEntries.length === 0 && collectedBonuses.length === 0 && (
                  <div className="text-sm text-green-400/40 italic">Нет бонусов</div>
                )}
              </>;
            })()}
          </div>

          {/* Center: Game Board — same width as header */}
          <div className={`shrink-0 max-w-[896px] w-full flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 transition-all ${boardFrozen ? 'board-frozen' : ''}`}>
            {roundCondition?.id === 'floating' ? (
              <div className="cloud-rotate relative" style={{ width: '900px', height: '700px' }}>
                {cards.map((card, index) => {
                  const pos = cloudPos[index] || { x: 0, y: 0 };
                  return (
                    <div key={`${level}-${card.id}`} className="absolute transition-all duration-300 ease-out" style={{ left: `${pos.x}px`, top: `${pos.y}px` }}>
                      <Card
                        emoji={card.emoji}
                        isFlipped={card.isFlipped}
                        isMatched={card.isMatched}
                        isWrong={card.isWrong}
                        isHinted={card.isHinted}
                        onClick={() => handleCardClick(index)}
                        onContextMenu={(e) => handleRightClick(index, e)}
                        isMarkedTrap={markedTraps.has(index)}
                        disabled={flippedCards.length === 2 || gameWon || gameOver || boardFrozen}
                        index={index}
                        cardSize={getCardSize()}
                        isSilhouette={roundModifiers.silhouetteOpen && card.isFlipped && !card.isMatched}
                        isBlurred={card.isBlurred || false}
                        isGhost={roundModifiers.ghostMode}
                        rotation={card.rotation}
                        colorIndex={card.colorIndex}
                        isSlowOpen={roundModifiers.slowOpen}
                        isContentHidden={card.contentHidden}
                        isColorMode={false}
                        isSectionBlocked={false}
                        isTriggeredTrap={triggeredTrapIds.has(card.pairId)}
                        isSwapping={swappingIndices.has(index)}
                        isAnchored={roundModifiers.anchorNext}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div ref={boardRef} className="flex flex-wrap justify-center gap-3" style={{ maxWidth: getGridMaxWidth() }}>
                {cards.map((card, index) => (
                  <Card
                    key={`${level}-${card.id}`}
                    emoji={card.emoji}
                    isFlipped={card.isFlipped}
                    isMatched={card.isMatched}
                    isWrong={card.isWrong}
                    isHinted={card.isHinted}
                    onClick={() => handleCardClick(index)}
                    onContextMenu={(e) => handleRightClick(index, e)}
                    isMarkedTrap={markedTraps.has(index)}
                    disabled={flippedCards.length === 2 || gameWon || gameOver || boardFrozen}
                    index={index}
                    cardSize={getCardSize()}
                    isFloating={roundModifiers.floating || roundCondition?.id === 'floating'}
                    isSilhouette={roundModifiers.silhouetteOpen && card.isFlipped && !card.isMatched}
                    isBlurred={card.isBlurred || false}
                    isGhost={roundModifiers.ghostMode}
                    rotation={card.rotation}
                    colorIndex={card.colorIndex}
                    isSlowOpen={roundModifiers.slowOpen}
                    isContentHidden={card.contentHidden}
                    isColorMode={roundCondition?.id === 'colorMatch'}
                    isTriggeredTrap={triggeredTrapIds.has(card.pairId)}
                    isSwapping={swappingIndices.has(index)}
                    isAnchored={roundModifiers.anchorNext}
                    isSectionBlocked={(() => {
                      if (roundCondition?.id !== 'sections') return false;
                      const cols = cards.length > 14 ? 6 : 4;
                      const rows = Math.ceil(cards.length / cols);
                      const row = Math.floor(index / cols);
                      const col = index % cols;
                      const sectionRow = row < rows / 2 ? 0 : 1;
                      const sectionCol = col < cols / 2 ? 0 : 1;
                      const sectionNum = sectionRow * 2 + sectionCol;
                      const isEvenSection = sectionNum % 2 === 0;
                      return (sectionPhase === 0 && !isEvenSection) || (sectionPhase === 1 && isEvenSection);
                    })()}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Traps — hidden on small screens */}
          <div className="hidden lg:flex flex-1 flex-col items-start gap-1.5 overflow-y-auto py-1">
            <div className="text-sm text-red-300 uppercase font-bold">⚠️ Ловушки</div>
            {trapPairIds.map((pairId, i) => {
              const def = trapDefs[i];
              const trapCardIndices = cards.map((c, idx) => ({ c, idx })).filter(x => x.c.pairId === pairId).map(x => x.idx);
              const mc = trapCardIndices.filter(idx => markedTraps.has(idx)).length;
              const isNeutralized = mc >= 2;
              const isTriggered = triggeredTrapIds.has(pairId);
              const displayEmoji = cards.find(c => c.pairId === pairId)?.emoji || pairId;
              return (
                <div key={pairId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-lg ${isNeutralized ? 'border-green-400/30 bg-green-500/10' : isTriggered ? 'border-red-400/60 bg-red-500/30 shadow-lg shadow-red-500/30' : 'border-red-400/30 bg-red-500/10'}`}>
                  <div className="text-3xl relative">
                    <span className="absolute inset-0" style={{ filter: 'drop-shadow(0 0 4px #ef4444) drop-shadow(0 0 8px #ef4444)' }}>{displayEmoji}</span>
                    <span style={{ filter: 'grayscale(1) brightness(0.15) contrast(3)' }}>{displayEmoji}</span>
                  </div>
                  <span className="text-sm text-red-400/70">{def?.description || 'Штраф!'}</span>
                  {isNeutralized && <span className="text-base">🛡️</span>}
                  {isTriggered && !isNeutralized && <span className="text-base">🔥</span>}
                </div>
              );
            })}
            {trapPairIds.length === 0 && (
              <div className="text-sm text-red-400/40 italic">Нет ловушек</div>
            )}
            <div className="text-sm text-red-400/50 mt-1">
              {roundCondition?.id === 'trapShift' ? '🚫 Пометка недоступна' : 'ПКМ = пометить'}
            </div>
          </div>
        </div>

        {/* Compact info bar for narrow screens */}
        <div className="lg:hidden flex gap-2 mt-1 text-xs">
          <div className="flex-1 bg-green-500/10 rounded-lg px-2 py-1 border border-green-400/20">
            <span className="text-green-300">🎁</span> {bonuses.filter(b => b.count > 0).reduce((s, b) => s + b.count, 0)} бонусов
          </div>
        </div>

        {/* Round Condition overlay — shown before special rounds */}
        {showRoundCondition && roundCondition && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-orange-600 to-red-700 rounded-3xl p-8 text-center shadow-2xl border border-orange-300/30 max-w-md mx-4 animate-bounceIn">
              <div className="text-6xl mb-4">{roundCondition.emoji}</div>
              <h2 className="text-2xl font-bold mb-2 text-white">Уровень {roundCondition.level}</h2>
              <h3 className="text-xl font-bold mb-4 text-orange-200">{roundCondition.name}</h3>
              <p className="text-orange-100 text-base mb-6">{roundCondition.description}</p>
              <button
                onClick={() => setShowRoundCondition(false)}
                className="px-8 py-3 bg-white text-orange-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 text-lg"
              >
                Понял, играть!
              </button>
            </div>
          </div>
        )}

        {/* Restart confirmation overlay */}
        {showRestartConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-indigo-700 to-purple-800 rounded-3xl p-8 text-center shadow-2xl border border-indigo-300/30 max-w-sm mx-4 animate-bounceIn">
              <div className="text-5xl mb-3">🔄</div>
              <h2 className="text-xl font-bold mb-3 text-white">Начать заново?</h2>
              <p className="text-indigo-200 text-sm mb-6">Весь текущий прогресс будет потерян. Уверены, что хотите начать игру сначала?</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => { handleRestart(); setShowRestartConfirm(false); }}
                  className="px-6 py-2.5 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-400 hover:scale-105 transition-all active:scale-95"
                >
                  Да
                </button>
                <button
                  onClick={() => setShowRestartConfirm(false)}
                  className="px-6 py-2.5 bg-indigo-500 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-400 hover:scale-105 transition-all active:scale-95"
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Level selector backdoor overlay */}
        {showLevelSelect && (
          <div data-testid="level-select-overlay" tabIndex={0} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn outline-none"
            onClick={(e) => { if (e.target === e.currentTarget) setShowLevelSelect(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowLevelSelect(false); }}
          >
            <div className="bg-gradient-to-br from-indigo-700 to-purple-800 rounded-3xl p-8 text-center shadow-2xl border border-indigo-300/30 max-w-md mx-4 animate-bounceIn">
              <div className="text-4xl mb-3">🔓</div>
              <h2 className="text-xl font-bold mb-4 text-white">Выбор раунда</h2>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map(lvl => (
                  <button
                    key={lvl}
                    data-testid={`level-btn-${lvl}`}
                    onClick={() => {
                      console.log(`[LEVEL SELECT] clicking level ${lvl}, closing overlay`);
                      setLevel(lvl);
                      initLevel(lvl);
                      // Use setTimeout to bypass React state batching
                      setTimeout(() => setShowLevelSelect(false), 0);
                    }}
                    className={`px-3 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 ${lvl === level ? 'bg-yellow-400 text-yellow-900' : 'bg-indigo-500/60 text-white hover:bg-indigo-400/60'}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="px-6 py-2.5 bg-indigo-500 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-400 hover:scale-105 transition-all active:scale-95"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* FAQ overlay */}
        {showFAQ && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-center shadow-2xl border border-indigo-300/30 max-w-md mx-4 animate-bounceIn">
              <h2 className="text-3xl font-bold mb-4 text-white">❓ Как играть</h2>
              <div className="text-indigo-100 text-base text-left space-y-3 mb-6">
                <p>🖱️ <strong className="text-white">ЛКМ</strong> на квадраты — собирайте пары одинаковых карточек.</p>
                <p>⏱️ У вас ограниченное <strong className="text-white">время</strong> — успейте собрать все пары!</p>
                <p>🎁 Некоторые пары дают <strong className="text-green-300">бонусы</strong>, которые можно копить и использовать.</p>
                <p>⚠️ Некоторые пары — <strong className="text-red-300">ловушки</strong>, которые дают штрафы.</p>
                <p>🛡️ Отмечайте ловушки <strong className="text-white">ПКМ</strong> — если обе карточки пары помечены, ловушка нейтрализуется!</p>
                <p>🎲 С <strong className="text-white">8 по 16 раунд</strong> появляются сложные дополнительные условия!</p>
                <p>🏆 <strong className="text-yellow-300">Очки</strong> = оставшиеся секунды × (бонусы − ловушки)</p>
              </div>
              {roundCondition && (
                <div className="border-t border-indigo-400/30 pt-3 mb-3">
                  <h3 className="text-lg font-bold text-indigo-200 mb-2">{roundCondition.emoji} Особенность раунда {level}</h3>
                  <p className="text-indigo-100 text-sm">{roundCondition.description}</p>
                </div>
              )}
              <button
                onClick={() => setShowFAQ(false)}
                className="px-8 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 text-lg"
              >
                Понятно!
              </button>
            </div>
          </div>
        )}

        {/* Intro overlay — shown only at first game start */}
        {showIntro && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-center shadow-2xl border border-indigo-300/30 max-w-md mx-4 animate-bounceIn">
              <div className="text-6xl mb-4">🧠</div>
              <h2 className="text-3xl font-bold mb-4 text-white">Вспомнить всё</h2>
              <div className="text-indigo-100 text-base text-left space-y-3 mb-6">
                <p>🖱️ <strong className="text-white">ЛКМ</strong> на квадраты — собирайте пары одинаковых карточек.</p>
                <p>⏱️ У вас ограниченное <strong className="text-white">время</strong> — успейте собрать все пары!</p>
                <p>🎁 Некоторые пары дают <strong className="text-green-300">бонусы</strong>, которые можно копить и использовать.</p>
                <p>⚠️ Некоторые пары — <strong className="text-red-300">ловушки</strong>, которые дают штрафы.</p>
                <p>🛡️ Отмечайте ловушки <strong className="text-white">ПКМ</strong> — если обе карточки пары помечены, ловушка нейтрализуется!</p>
                <p>🎲 С <strong className="text-white">8 по 16 раунд</strong> появляются сложные дополнительные условия!</p>
              </div>
              <button
                onClick={() => setShowIntro(false)}
                className="px-8 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 text-lg"
              >
                Играть!
              </button>
            </div>
          </div>
        )}

        {/* Level Up overlay */}
        {showLevelUp && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 text-center shadow-2xl border border-green-300/30 max-w-sm mx-4 animate-level-up">
              <div className="text-5xl mb-2">⭐</div>
              <h2 className="text-2xl font-bold mb-1">Уровень {level} пройден!</h2>
              <p className="text-green-100 text-sm">Уровень {level + 1}...</p>
            </div>
          </div>
        )}

        {/* Win Overlay (all levels complete) */}
        {gameWon && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            {confetti.map((c) => (
              <div
                key={c.id}
                className="fixed w-3 h-3 rounded-full animate-confetti-fall"
                style={{
                  left: `${c.x}%`,
                  backgroundColor: c.color,
                  animationDelay: `${c.id * 0.05}s`,
                }}
              />
            ))}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-center shadow-2xl border border-white/20 max-w-md mx-4 animate-bounceIn">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-bold mb-2">Все уровни пройдены!</h2>
              <p className="text-purple-200 mb-2">
                Ты прошёл все {MAX_LEVEL} уровней!
              </p>
              <p className="text-yellow-300 text-2xl font-bold mb-4">
                Итоговые очки: {score}
              </p>
              {!showNameEntry ? (
                <button
                  onClick={() => setShowNameEntry(true)}
                  className="px-8 py-3 bg-yellow-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95 mb-3"
                >
                  Сохранить результат
                </button>
              ) : (
                <div className="mb-3">
                  <input
                    type="text"
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    placeholder="Ваше имя"
                    className="px-4 py-2 rounded-lg text-black text-center text-lg mb-2 w-48"
                    maxLength={20}
                    autoFocus
                  />
                  <br />
                  <button
                    onClick={() => {
                      if (playerName.trim()) {
                        const records = JSON.parse(localStorage.getItem('memoryGameRecords') || '[]');
                        records.push({ name: playerName.trim(), score, date: new Date().toISOString() });
                        records.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
                        localStorage.setItem('memoryGameRecords', JSON.stringify(records.slice(0, 100)));
                        setShowNameEntry(false);
                        setPlayerName('');
                      }
                    }}
                    className="px-6 py-2 bg-green-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95"
                  >
                    Сохранить
                  </button>
                </div>
              )}
              <br />
              <button
                onClick={handleRestart}
                className="px-8 py-4 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
              >
                Играть снова
              </button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameOver && !gameWon && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-red-800 to-red-900 rounded-3xl p-8 text-center shadow-2xl border border-red-500/30 max-w-md mx-4 animate-bounceIn">
              <div className="text-6xl mb-4">💀</div>
              <h2 className="text-3xl font-bold mb-2">Игра окончена!</h2>
              <p className="text-red-200 mb-4">
                Время вышло!
              </p>
              <p className="text-red-300 mb-2">
                Уровень: <span className="text-white font-bold">{level}</span>
              </p>
              <p className="text-yellow-300 mb-6">
                Очки: <span className="text-white font-bold">{score}</span>
              </p>
              {!showNameEntry ? (
                <button
                  onClick={() => setShowNameEntry(true)}
                  className="px-8 py-4 bg-yellow-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 mb-3"
                >
                  Сохранить результат
                </button>
              ) : (
                <div className="mb-3">
                  <input
                    type="text"
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    placeholder="Ваше имя"
                    className="px-4 py-2 rounded-lg text-black text-center text-lg mb-2 w-48"
                    maxLength={20}
                    autoFocus
                  />
                  <br />
                  <button
                    onClick={() => {
                      if (playerName.trim()) {
                        const records = JSON.parse(localStorage.getItem('memoryGameRecords') || '[]');
                        records.push({ name: playerName.trim(), score, date: new Date().toISOString() });
                        records.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
                        localStorage.setItem('memoryGameRecords', JSON.stringify(records.slice(0, 100)));
                        setShowNameEntry(false);
                        setPlayerName('');
                      }
                    }}
                    className="px-6 py-2 bg-green-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95"
                  >
                    Сохранить
                  </button>
                </div>
              )}
              <br />
              <button
                onClick={handleRestart}
                className="px-8 py-4 bg-white text-red-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}

        {/* Debug log panel */}
        {process.env.NODE_ENV === 'development' && showDebugLog && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 text-green-400 font-mono text-xs max-h-32 overflow-y-auto px-2 py-1 border-t border-green-500/30">
            <div className="text-green-300 font-bold mb-1">🔍 Debug Log (F10 to toggle)</div>
            {debugLogs.map((log, i) => (
              <div key={i} className={log.type === 'trap' ? 'text-red-400' : log.type === 'bonus' ? 'text-yellow-300' : log.type === 'click' ? 'text-green-400' : 'text-blue-300'}>
                {log.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div >
  );
}

export default App;
