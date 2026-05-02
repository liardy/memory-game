import { useState, useEffect, useCallback, useRef } from 'react';
import Card from './components/Card';
import ScorePanel, { Bonus } from './components/ScorePanel';
import SpaceBackground from './components/SpaceBackground';
import './App.css';

interface GameCard {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
  isWrong?: boolean;
  isHinted?: boolean;
  rotation?: number; // 0, 90, 180, 270 for round condition level 13
  colorIndex?: number; // for level 8 color matching
  contentHidden?: boolean; // hideOpenCards trap: card stays flipped but emoji is hidden
}

// All available emojis (16 for variety across levels)
const ALL_EMOJIS = ['🚀', '🌟', '🪐', '👽', '🌙', '☄️', '🛸', '🌌', '🔮', '🎭', '🦄', '🐉', '🦋', '🌺', '🍄', '⚡', '🎃', '🎯', '🦊'];

// Level definitions — 16 levels, gradual progression
interface LevelConfig {
  pairs: number;
  time: number;
  bonusCount: number;
  trapCount: number;
}

const LEVELS: LevelConfig[] = [
  { pairs: 4, time: 60, bonusCount: 2, trapCount: 1 },   // 1
  { pairs: 5, time: 65, bonusCount: 2, trapCount: 1 },   // 2
  { pairs: 6, time: 70, bonusCount: 2, trapCount: 1 },   // 3
  { pairs: 7, time: 75, bonusCount: 3, trapCount: 1 },   // 4
  { pairs: 8, time: 80, bonusCount: 3, trapCount: 2 },   // 5
  { pairs: 9, time: 85, bonusCount: 3, trapCount: 2 },   // 6
  { pairs: 10, time: 90, bonusCount: 4, trapCount: 2 },  // 7
  { pairs: 11, time: 95, bonusCount: 4, trapCount: 2 },  // 8
  { pairs: 12, time: 100, bonusCount: 4, trapCount: 3 }, // 9
  { pairs: 13, time: 105, bonusCount: 4, trapCount: 3 }, // 10
  { pairs: 14, time: 110, bonusCount: 5, trapCount: 3 }, // 11
  { pairs: 15, time: 115, bonusCount: 5, trapCount: 3 }, // 12
  { pairs: 16, time: 120, bonusCount: 5, trapCount: 3 }, // 13
  { pairs: 17, time: 125, bonusCount: 5, trapCount: 3 }, // 14
  { pairs: 18, time: 130, bonusCount: 5, trapCount: 3 }, // 15 — 6x6 grid for shiftLine
  { pairs: 10, time: 120, bonusCount: 5, trapCount: 3 }, // 16 — 20 cards, 2 min
];

const MAX_LEVEL = LEVELS.length;

// Bonus types — 16 unique bonuses
const BONUS_TYPES: Bonus[] = [
  { id: 'timer10', emoji: '⏳', name: 'Песочные часы', description: '+10 секунд к таймеру', count: 0 },
  { id: 'sticky5', emoji: '📌', name: 'Прилипала', description: '5 сек карточки не закрываются', count: 0 },
  { id: 'xray', emoji: '�️', name: 'Рентген', description: 'На 0.5 сек показывает все карточки', count: 0 },
  { id: 'autoshield', emoji: '🛡️', name: 'Автозащита', description: 'При таймере 0:00 добавит 10 сек', count: 0 },
  { id: 'anchor', emoji: '⚓', name: 'Якорь', description: 'Следующая карта не перемещается', count: 0 },
  { id: 'autopair', emoji: '🪐', name: 'Планета', description: 'Открывает случайную пару', count: 0 },
  { id: 'freeze', emoji: '❄️', name: 'Заморозка', description: '10 сек: таймер и всё заморожено', count: 0 },
  { id: 'superpos', emoji: '🔮', name: 'Суперпозиция', description: 'Следующая карта остаётся открытой', count: 0 },
  { id: 'microblast', emoji: '💥', name: 'Микровзрыв', description: 'Открывает карту + 4 соседних', count: 0 },
  { id: 'canceltrap', emoji: '🚫', name: 'Анти-ловушка', description: 'Отменяет текущую/следующую ловушку', count: 0 },
  { id: 'trapglow', emoji: '🔦', name: 'Детектор', description: 'На 0.5 сек подсвечивает ловушки', count: 0 },
  { id: 'silhouettes', emoji: '🎭', name: 'Силуэты', description: 'На 3 сек показывает силуэты всех карт', count: 0 },
  { id: 'sort', emoji: '📊', name: 'Сортировка', description: 'Собранные пары перемещаются вверх', count: 0 },
  { id: 'show3pairs', emoji: '💡', name: 'Подсказка', description: 'На 1 сек показывает 3 случайные пары', count: 0 },
  { id: 'pause', emoji: '⏸️', name: 'Пауза', description: 'Останавливает игру, чтобы подумать', count: 0 },
  { id: 'doublepoints', emoji: '✨', name: 'Двойные очки', description: '10 сек: удваивает очки за пары', count: 0 },
];

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
        // Find unique matched emojis (each pair)
        const matchedEmojis = [...new Set(prev.filter(c => c.isMatched).map(c => c.emoji))];
        const toCloseEmojis = shuffleArray(matchedEmojis).slice(0, Math.min(2, matchedEmojis.length));
        return prev.map(c => toCloseEmojis.includes(c.emoji) && c.isMatched
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
  { id: 'colorMatch', name: 'ЦветовоеMatching', emoji: '🎨', description: 'Все карточки одинаковые (цифра 8), но разного цвета. Собирайте пары по цвету: от холодного к тёплому оттенку!', level: 8 },
  { id: 'jumpPair', name: 'Прыгающие пары', emoji: '🦘', description: 'Собранные пары перепрыгивают на одну ячейку в случайную сторону!', level: 9 },
  { id: 'changePast', name: 'Изменение прошлого', emoji: '🔮', description: 'При каждом открытии карточки, прошлые открытые карточки меняют картинку на случайную!', level: 10 },
  { id: 'floating', name: 'Свободное плавание', emoji: '🌀', description: 'Все карточки не привязаны к сетке, а бесконечно плавают и перемешиваются!', level: 11 },
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
function setupLevel(level: number): {
  cards: GameCard[];
  bonusMap: Record<string, Bonus>;
  bonusOrder: string[]; // ordered emoji list for "top bonus lost" mechanic
  trapEmojis: string[];
  trapDefs: TrapDef[];
} {
  const config = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const pairCount = config.pairs;

  // Level 8: color matching — all cards show "8" but have different colors
  const isColorMatch = level === 8;

  const selectedEmojis = isColorMatch
    ? Array(pairCount).fill('8️⃣')
    : shuffleArray(ALL_EMOJIS).slice(0, pairCount);

  // Assign a bonus to every pair — shuffle bonus types and assign in order
  const shuffledBonusTypes = shuffleArray([...BONUS_TYPES]);
  const bonusMap: Record<string, Bonus> = {};
  const bonusOrder: string[] = [];
  selectedEmojis.forEach((emoji, i) => {
    const bonusType = shuffledBonusTypes[i % shuffledBonusTypes.length];
    bonusMap[emoji] = { ...bonusType, count: 0 };
    bonusOrder.push(emoji);
  });

  // Pick trap emojis (can overlap with bonuses now — traps are separate mechanic)
  const trapEmojis = shuffleArray([...selectedEmojis]).slice(0, config.trapCount);

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

  const trapDefs = trapEmojis.map((_, i) => {
    const blockIdx = blockSources[i % blockSources.length] - 1;
    const block = TRAP_BLOCKS[blockIdx];
    return block[Math.floor(Math.random() * block.length)];
  });

  const cards = selectedEmojis.flatMap((emoji, index) => [
    { id: index * 2, emoji, isFlipped: false, isMatched: false, isWrong: false, isHinted: false, contentHidden: false, colorIndex: isColorMatch ? index : undefined },
    { id: index * 2 + 1, emoji, isFlipped: false, isMatched: false, isWrong: false, isHinted: false, contentHidden: false, colorIndex: isColorMatch ? index : undefined },
  ]);

  return { cards: shuffleArray(cards), bonusMap, bonusOrder, trapEmojis, trapDefs };
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
  const [boardFrozen, setBoardFrozen] = useState(false);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [bonusMap, setBonusMap] = useState<Record<string, Bonus>>({});
  const [bonusOrder, setBonusOrder] = useState<string[]>([]); // ordered emojis for "top bonus lost"
  void bonusOrder;
  const [availableBonuses, setAvailableBonuses] = useState<string[]>([]); // emojis still available to collect
  const [trapsTriggered, setTrapsTriggered] = useState(0); // count of traps triggered this round
  const [bonusesCollected, setBonusesCollected] = useState(0); // count of bonuses collected this round
  const [score, setScore] = useState(0); // total score across rounds
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [trapEmojis, setTrapEmojis] = useState<string[]>([]);
  const [trapDefs, setTrapDefs] = useState<TrapDef[]>([]);
  const [markedTraps, setMarkedTraps] = useState<Set<number>>(new Set());
  const [roundModifiers, setRoundModifiers] = useState<RoundModifiers>({ ...DEFAULT_MODIFIERS });
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
  const backdoorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bonusMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trapMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideContentTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Initialize level
  const initLevel = useCallback((lvl: number) => {
    const setup = setupLevel(lvl);
    const config = LEVELS[Math.min(lvl - 1, LEVELS.length - 1)];
    setCards(setup.cards);
    setBonusMap(setup.bonusMap);
    setBonusOrder(setup.bonusOrder);
    setAvailableBonuses([...setup.bonusOrder]);
    setTrapEmojis(setup.trapEmojis);
    setTrapDefs(setup.trapDefs);
    setTrapsTriggered(0);
    setBonusesCollected(0);
    setMarkedTraps(new Set());
    setRoundModifiers({ ...DEFAULT_MODIFIERS });
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
    initLevel(1);
    setBonuses([]);
  }, []);

  // Countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && !gameWon && !gameOver) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (roundModifiers.autoshieldActive) {
              setRoundModifiers(rm => ({ ...rm, autoshieldActive: false }));
              showBonusMsg('🛡️ Автозащита! +10 секунд!');
              return prev + 10;
            }
            setGameOver(true);
            setIsActive(false);
            return 0;
          }
          return timerFrozen ? prev : prev - roundModifiers.timerSpeed;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, gameWon, gameOver, timerFrozen, roundModifiers.timerSpeed]);

  // Check win condition (level complete) — when all non-trap pairs are matched
  useEffect(() => {
    if (cards.length === 0 || levelCompleting) return;
    // All non-trap cards must be matched; trap cards are never opened
    const allNonTrapMatched = cards.every((card) =>
      card.isMatched || trapEmojis.includes(card.emoji)
    );
    if (allNonTrapMatched && !gameWon && !gameOver) {
      setLevelCompleting(true);
      setIsActive(false);

      // Auto-mark trap cards as matched (they stay face-down but count as done)
      setCards(prev => prev.map(card =>
        trapEmojis.includes(card.emoji) ? { ...card, isMatched: true } : card
      ));

      // Just show info about unmarked traps (they already fired during gameplay)
      const unmarkedTraps = trapEmojis.filter((trapEmoji) => {
        const trapCardIndices = cards
          .map((card, i) => ({ card, i }))
          .filter(c => c.card.emoji === trapEmoji)
          .map(c => c.i);
        return !trapCardIndices.every(idx => markedTraps.has(idx));
      });

      if (unmarkedTraps.length > 0) {
        showTrapMsg(`⚠️ ${unmarkedTraps.length} непомеченн${unmarkedTraps.length === 1 ? 'ая' : unmarkedTraps.length < 5 ? 'ые' : 'ых'} ловушк${unmarkedTraps.length === 1 ? 'а' : unmarkedTraps.length < 5 ? 'и' : 'ок'} сработали!`);
      } else if (trapEmojis.length > 0) {
        showBonusMsg('🛡️ Все ловушки нейтрализованы пометками!');
      }

      completeLevel();
    }
  }, [cards, gameWon, gameOver, trapEmojis, trapDefs, markedTraps, levelCompleting]);

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

  const grantBonus = useCallback((emoji: string) => {
    const bonusDef = bonusMap[emoji];
    if (!bonusDef) return;

    setBonuses(prev => {
      const existing = prev.find(b => b.id === bonusDef.id);
      if (existing) {
        return prev.map(b => b.id === bonusDef.id ? { ...b, count: b.count + 1 } : b);
      }
      return [...prev, { ...bonusDef, count: 1 }];
    });
    showBonusMsg(`${bonusDef.emoji} Бонус получен: ${bonusDef.name}!`);
  }, [bonusMap]);

  // Right-click to mark/unmark a card as trap
  const handleRightClick = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (gameOver || gameWon || boardFrozen) return;
    if (cards[index].isFlipped || cards[index].isMatched) return;

    setMarkedTraps(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, [cards, gameOver, gameWon, boardFrozen]);

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
          showBonusMsg('❄️ Заморозка! Всё заморожено на 10 сек!');
          if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
          freezeTimerRef.current = setTimeout(() => {
            setTimerFrozen(false);
            setBoardFrozen(false);
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
            trapEmojis.includes(c.emoji) && !c.isMatched ? { ...c, isHinted: true } : c
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
          showBonusMsg('⏸️ Пауза! Нажмите любую карту чтобы продолжить');
          // Will be unpaused on next card click
          setRoundModifiers(prev => ({ ...prev, paused: true }));
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
  }, [trapEmojis, cards, showBonusMsg]);

  const handleCardClick = useCallback(
    (index: number) => {
      // Pause: unpause on any click
      if (roundModifiers.paused) {
        setRoundModifiers(prev => ({ ...prev, paused: false }));
        setTimerFrozen(false);
        setBoardFrozen(false);
        return;
      }
      if (gameOver || gameWon || boardFrozen) return;
      if (roundModifiers.singleCardMode && flippedCards.length >= 1) return;
      if (!isActive) setIsActive(true);
      if (flippedCards.length === 2) return;
      if (cards[index].isFlipped || cards[index].isMatched || cards[index].isHinted) return;

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

      // Level 10: change past — when opening a card, previously flipped unmatched cards get random images
      if (roundCondition?.id === 'changePast' && newFlipped.length === 1) {
        setCards(prev => {
          const otherFlipped = prev.map((c, i) => ({ c, i }))
            .filter(x => x.i !== index && x.c.isFlipped && !x.c.isMatched);
          if (otherFlipped.length === 0) return prev;
          // Change one random past opened card's emoji
          const target = otherFlipped[Math.floor(Math.random() * otherFlipped.length)];
          const randomEmoji = ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)];
          return prev.map((c, i) => i === target.i ? { ...c, emoji: randomEmoji } : c);
        });
      }

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

        // Level 8: match by colorIndex, not emoji
        const isMatch = roundCondition?.id === 'colorMatch'
          ? cards[first].colorIndex === cards[second].colorIndex
          : cards[first].emoji === cards[second].emoji;

        if (isMatch) {
          const matchedEmoji = cards[first].emoji;
          const matchDelay = roundModifiers.slowOpen ? 1200 : roundModifiers.fastOpen ? 300 : 600;
          setTimeout(() => {
            setCards((prev) => {
              let updated = prev.map((card, i) =>
                i === first || i === second ? { ...card, isMatched: true } : card
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
                [first, second].forEach(idx => {
                  const row = Math.floor(idx / cols);
                  const col = idx % cols;
                  const dir = directions[Math.floor(Math.random() * directions.length)];
                  const newRow = Math.max(0, Math.min(Math.ceil(updated.length / cols) - 1, row + dir.dr));
                  const newCol = Math.max(0, Math.min(cols - 1, col + dir.dc));
                  const targetIdx = newRow * cols + newCol;
                  if (targetIdx !== idx && targetIdx < updated.length) {
                    // Swap with target position
                    const temp = { ...updated[targetIdx] };
                    updated[targetIdx] = { ...updated[idx] };
                    updated[idx] = temp;
                  }
                });
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
            if (trapEmojis.includes(matchedEmoji)) {
              const trapIdx = trapEmojis.indexOf(matchedEmoji);
              const trapCardIndices = cards
                .map((c, i) => ({ c, i }))
                .filter(x => x.c.emoji === matchedEmoji)
                .map(x => x.i);
              const bothMarked = trapCardIndices.every(idx => markedTraps.has(idx));
              if (bothMarked) {
                showBonusMsg(`🛡️ Ловушка ${matchedEmoji} нейтрализована пометкой!`);
              } else if (roundModifiers.cancelTrapNext) {
                setRoundModifiers(prev => ({ ...prev, cancelTrapNext: false }));
                showBonusMsg(`🚫 Анти-ловушка отменила ловушку ${matchedEmoji}!`);
              } else {
                const trapDef = trapDefs[trapIdx];
                if (trapDef) {
                  setTrapsTriggered(prev => prev + 1);
                  showTrapMsg(`⚠️ Ловушка ${matchedEmoji}! ${trapDef.emoji} ${trapDef.name}: ${trapDef.description}`);
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
            }

            // Bonus mechanic: every pair has a bonus
            if (availableBonuses.includes(matchedEmoji)) {
              // This pair's bonus is still available — collect it!
              grantBonus(matchedEmoji);
              setAvailableBonuses(prev => prev.filter(e => e !== matchedEmoji));
              setBonusesCollected(prev => prev + 1);
            } else if (availableBonuses.length > 0) {
              // This pair's bonus was already collected/lost — lose the top available bonus
              const lostEmoji = availableBonuses[0];
              const lostBonus = bonusMap[lostEmoji];
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

          // Superposition: first card stays open
          const superposActive = roundModifiers.superposNext;
          if (superposActive) {
            setRoundModifiers(prev => ({ ...prev, superposNext: false }));
            showBonusMsg('🔮 Суперпозиция! Карточка остаётся открытой!');
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
              let updated = prev;

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
    [cards, flippedCards, isActive, gameWon, gameOver, boardFrozen, trapEmojis, bonusMap, grantBonus, roundModifiers, markedTraps, trapDefs, roundCondition, sectionPhase, cardsOpenedInPhase, failCounter]
  );

  const handleRestart = () => {
    setLevel(1);
    initLevel(1);
    setBonuses([]);
    setShowIntro(false);
    if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
  };

  // Backdoor: 6 clicks on Рекорд reveals all non-trap cards
  const handleBackdoor = useCallback(() => {
    if (backdoorTimerRef.current) clearTimeout(backdoorTimerRef.current);
    setBackdoorClicks(prev => {
      const next = prev + 1;
      if (next >= 6) {
        setCards(prevCards => prevCards.map(card =>
          !trapEmojis.includes(card.emoji) ? { ...card, isFlipped: true, isMatched: true, contentHidden: false } : card
        ));
        showBonusMsg('🔓 Бэкдор! Все карточки открыты!');
        return 0;
      }
      backdoorTimerRef.current = setTimeout(() => setBackdoorClicks(0), 2000);
      return next;
    });
  }, [trapEmojis]);

  const config = LEVELS[Math.min(level - 1, LEVELS.length - 1)];

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
        {bonusMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
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
          timerFrozen={timerFrozen}
          boardFrozen={boardFrozen}
        />

        {/* Main game area: Bonuses | Board | Traps */}
        <div className="flex-1 flex gap-2 min-h-0 mt-2">
          {/* Left panel: Bonuses */}
          <div className="flex-1 flex flex-col items-end gap-1.5 overflow-y-auto py-1">
            <div className="text-sm text-green-300 uppercase font-bold w-full text-right">🎁 Бонусы</div>
            {(() => {
              // Available bonuses: not yet collected, shown as pending
              const availableEntries = availableBonuses.map(emoji => ({ emoji, bonusType: bonusMap[emoji] })).filter(e => e.bonusType);
              // Collected bonuses: have count > 0
              const collectedBonuses = bonuses.filter(b => b.count > 0);
              return <>
                {availableEntries.map((info) => (
                  <div key={info.emoji}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-400/15 bg-green-500/5 text-lg opacity-60"
                  >
                    <span className="text-2xl">{info.bonusType.emoji}</span>
                    <span className="text-xs text-green-400/50">{info.bonusType.name}</span>
                    <span className="text-xs text-green-400/30">?</span>
                  </div>
                ))}
                {collectedBonuses.map((bonus) => (
                  <div key={bonus.id}
                    onClick={!gameWon && !gameOver && !boardFrozen ? () => handleUseBonus(bonus.id) : undefined}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-400/30 bg-green-500/10 text-lg cursor-pointer hover:bg-green-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <span className="text-3xl">{bonus.emoji}</span>
                    <span className="text-sm text-green-400/70">{bonus.description}</span>
                    <span className="px-2 py-1 font-bold rounded text-sm bg-green-400 text-green-900">×{bonus.count}</span>
                  </div>
                ))}
                {availableEntries.length === 0 && collectedBonuses.length === 0 && (
                  <div className="text-sm text-green-400/40 italic">Нет бонусов</div>
                )}
              </>;
            })()}
          </div>

          {/* Center: Game Board — same width as header */}
          <div className={`shrink-0 max-w-[896px] w-full flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 transition-all ${boardFrozen ? 'board-frozen' : ''}`}>
            <div className="flex flex-wrap justify-center gap-3" style={{ maxWidth: getGridMaxWidth() }}>
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
                  isBlurred={roundModifiers.blurCount > 0 && card.isFlipped && !card.isMatched}
                  isGhost={roundModifiers.ghostMode}
                  rotation={card.rotation}
                  colorIndex={card.colorIndex}
                  isSlowOpen={roundModifiers.slowOpen}
                  isContentHidden={card.contentHidden}
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
          </div>

          {/* Right panel: Traps */}
          <div className="flex-1 flex flex-col items-start gap-1.5 overflow-y-auto py-1">
            <div className="text-sm text-red-300 uppercase font-bold">⚠️ Ловушки</div>
            {trapEmojis.map((emoji, i) => {
              const def = trapDefs[i];
              const trapCardIndices = cards.map((c, idx) => ({ c, idx })).filter(x => x.c.emoji === emoji).map(x => x.idx);
              const mc = trapCardIndices.filter(idx => markedTraps.has(idx)).length;
              const isNeutralized = mc >= 2;
              return (
                <div key={emoji} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-lg ${isNeutralized ? 'border-green-400/30 bg-green-500/10' : 'border-red-400/30 bg-red-500/10'}`}>
                  <span className="text-3xl" style={{ filter: 'grayscale(1) brightness(0.15) contrast(3)' }}>{emoji}</span>
                  <span className={`px-2 py-1 font-bold rounded text-sm ${isNeutralized ? 'bg-green-400 text-green-900' : 'bg-red-500/60 text-red-200'}`}>
                    ×{mc}/2
                  </span>
                  <span className="text-sm text-red-400/70">{def?.description || 'Штраф!'}</span>
                  {isNeutralized && <span className="text-base">🛡️</span>}
                </div>
              );
            })}
            {trapEmojis.length === 0 && (
              <div className="text-sm text-red-400/40 italic">Нет ловушек</div>
            )}
            <div className="text-sm text-red-400/50 mt-1">
              ПКМ = пометить
            </div>
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

        {/* FAQ overlay */}
        {showFAQ && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-cyan-700 to-indigo-800 rounded-3xl p-8 text-center shadow-2xl border border-cyan-300/30 max-w-lg mx-4 animate-bounceIn">
              <h2 className="text-2xl font-bold text-white mb-4">❓ Как играть</h2>
              <p>🖱️ <strong className="text-white">ЛКМ</strong> — открыть карточку</p>
              <p>🖱️ <strong className="text-white">ПКМ</strong> — пометить ловушку (если обе карточки пары помечены — ловушка нейтрализуется)</p>
              <p>⏱️ Соберите все пары за отведённое время</p>
              <p>🎁 <strong className="text-green-300">Бонусы</strong> — каждая пара даёт бонус! Если открытая пара не совпадает с доступным бонусом, верхний бонус теряется</p>
              <p>⚠️ <strong className="text-red-300">Ловушки</strong> — помечайте ПКМ, чтобы избежать штрафа</p>
              <p>🏆 <strong className="text-yellow-300">Очки</strong> = оставшиеся секунды × (бонусы − ловушки)</p>
              {roundCondition && (
                <div className="border-t border-cyan-400/30 pt-3 mb-3">
                  <h3 className="text-lg font-bold text-cyan-200 mb-2">{roundCondition.emoji} Особенность раунда {level}</h3>
                  <p className="text-cyan-100 text-sm">{roundCondition.description}</p>
                </div>
              )}
              <button
                onClick={() => setShowFAQ(false)}
                className="px-8 py-3 bg-white text-cyan-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 text-lg"
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

      </div>
    </div >
  );
}

export default App;
