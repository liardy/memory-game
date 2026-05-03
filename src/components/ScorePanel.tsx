import React from 'react';

export interface Bonus {
  id: string;
  emoji: string;
  name: string;
  description: string;
  count: number;
  cardEmoji?: string;
}

export interface BonusInfo {
  emoji: string;
  bonusType: Bonus;
}

export interface TrapInfo {
  emoji: string;
  description: string;
  markedCount: number;
  totalCards: number;
}

interface ScorePanelProps {
  level: number;
  maxLevel: number;
  timeLeft: number;
  maxTime: number;
  score: number;
  onRestart: () => void;
  onBackdoor: () => void;
  onFAQ: () => void;
  onLongRightPress?: () => void;
  timerFrozen: boolean;
  boardFrozen: boolean;
}

const ScorePanel: React.FC<ScorePanelProps> = ({
  level,
  maxLevel,
  timeLeft,
  maxTime,
  score,
  onRestart,
  onBackdoor,
  onFAQ,
  onLongRightPress,
  timerFrozen,
  boardFrozen,
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timePercent = (timeLeft / maxTime) * 100;
  const isTimeLow = timeLeft <= 15;

  // Long right-press on Рекорд (3s)
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRecordMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) { // right click
      e.preventDefault();
      longPressTimerRef.current = setTimeout(() => {
        onLongRightPress?.();
      }, 3000);
    }
  };
  const handleRecordMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="bg-indigo-900/80 backdrop-blur-sm rounded-xl shadow-lg px-2 sm:px-4 py-2 border border-indigo-400/30">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Title — hidden on small screens */}
        <h1 className="hidden sm:block text-2xl lg:text-3xl font-bold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent whitespace-nowrap">
          🧠 Вспомнить всё
        </h1>
        {/* Center: Stats */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="text-center min-w-[50px]">
            <div className="text-xs text-indigo-300 uppercase">Уровень</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-300">{level}/{maxLevel}</div>
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-xs text-indigo-300 uppercase">
              {timerFrozen ? '❄️' : boardFrozen ? '🧊' : 'Время'}
            </div>
            <div className={`text-2xl sm:text-4xl font-bold font-mono ${boardFrozen ? 'text-blue-300' : timerFrozen ? 'text-cyan-300' : isTimeLow ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="w-16 sm:w-24 h-2 bg-indigo-700 rounded-full mt-1 mx-auto overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${isTimeLow ? 'bg-red-500' : timerFrozen ? 'bg-cyan-400' : 'bg-indigo-400'}`} style={{ width: `${timePercent}%` }} />
            </div>
          </div>
          <div className="text-center min-w-[40px]">
            <div className="text-xs text-indigo-300 uppercase">Очки</div>
            <div className="text-xl sm:text-2xl font-bold text-green-300">{score}</div>
          </div>
        </div>
        {/* Right: Record + Restart */}
        <div className="flex items-center gap-1 sm:gap-3">
          <div
            data-testid="record-btn"
            className="text-center bg-yellow-500/20 px-2 sm:px-3 py-1 rounded-lg border border-yellow-400/40 cursor-pointer select-none"
            onClick={onBackdoor}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={handleRecordMouseDown}
            onMouseUp={handleRecordMouseUp}
            onMouseLeave={handleRecordMouseUp}
          >
            <div className="text-xs text-yellow-300 uppercase">Рекорд</div>
            <div className="text-lg sm:text-xl font-bold text-yellow-300">{score}</div>
          </div>
          <button
            data-testid="faq-btn"
            onClick={onFAQ}
            className="text-center bg-cyan-500/20 px-2 sm:px-3 py-1 rounded-lg border border-cyan-400/40 cursor-pointer select-none hover:scale-105 transition-all active:scale-95"
          >
            <div className="text-xs text-cyan-300 uppercase">FAQ</div>
            <div className="text-lg sm:text-xl font-bold text-cyan-300">❓</div>
          </button>
          <button
            data-testid="restart-btn"
            onClick={onRestart}
            className="text-center bg-indigo-500/20 px-2 sm:px-3 py-1 rounded-lg border border-indigo-400/40 cursor-pointer select-none hover:scale-105 transition-all active:scale-95"
          >
            <div className="text-xs text-indigo-300 uppercase">Заново</div>
            <div className="text-lg sm:text-xl font-bold text-indigo-300">🔄</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScorePanel;
