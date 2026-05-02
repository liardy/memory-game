import React, { useEffect, useState } from 'react';

interface CardProps {
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  disabled: boolean;
  isWrong?: boolean;
  isHinted?: boolean;
  isMarkedTrap?: boolean;
  index: number;
  cardSize?: React.CSSProperties;
  isFloating?: boolean;
  isSilhouette?: boolean;
  isBlurred?: boolean;
  isGhost?: boolean;
  rotation?: number;
  isSectionBlocked?: boolean;
  colorIndex?: number;
  isSlowOpen?: boolean;
  isContentHidden?: boolean;
}

// 5 different idle animation keyframes as inline styles
const IDLE_ANIMATIONS: React.CSSProperties[] = [
  { animationName: 'card-breathe', animationDuration: '4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-glow', animationDuration: '3.5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-sway', animationDuration: '5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-fade', animationDuration: '4.5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-squish', animationDuration: '3.8s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
];

const Card: React.FC<CardProps> = ({ emoji, isFlipped, isMatched, onClick, onContextMenu, disabled, isWrong, isHinted, isMarkedTrap, index, cardSize, isFloating, isSilhouette, isBlurred, isGhost, rotation, isSectionBlocked, colorIndex, isSlowOpen, isContentHidden }) => {
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Color palette for level 8 — cold to warm shades
  const COLOR_PALETTE = [
    'from-blue-200 to-blue-400 border-blue-300',     // cold
    'from-cyan-200 to-cyan-400 border-cyan-300',
    'from-teal-200 to-teal-400 border-teal-300',
    'from-green-200 to-green-400 border-green-300',
    'from-lime-200 to-lime-400 border-lime-300',
    'from-yellow-200 to-yellow-400 border-yellow-300',
    'from-amber-200 to-amber-400 border-amber-300',
    'from-orange-200 to-orange-400 border-orange-300',
    'from-red-200 to-red-400 border-red-300',         // warm
    'from-rose-200 to-rose-400 border-rose-300',
    'from-pink-200 to-pink-400 border-pink-300',
    'from-fuchsia-200 to-fuchsia-400 border-fuchsia-300',
    'from-purple-200 to-purple-400 border-purple-300',
    'from-violet-200 to-violet-400 border-violet-300',
    'from-indigo-200 to-indigo-400 border-indigo-300',
    'from-sky-200 to-sky-400 border-sky-300',
  ];
  const colorBgClass = colorIndex !== undefined ? `bg-gradient-to-br ${COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]}` : '';

  useEffect(() => {
    if (isMatched) {
      const newSparkles = Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 80,
        y: Math.random() * 80,
      }));
      setSparkles(newSparkles);
      const timer = setTimeout(() => setSparkles([]), 600);
      return () => clearTimeout(timer);
    }
  }, [isMatched]);

  const idleAnimStyle = IDLE_ANIMATIONS[index % IDLE_ANIMATIONS.length];
  const animDelay = (index * 0.4) % 2;

  const sizeStyle = cardSize || { width: '80px', height: '80px', fontSize: '32px' };

  return (
    <div
      className={`relative cursor-pointer perspective-1000 transition-all duration-300 ${disabled ? 'pointer-events-none' : ''
        } ${isMatched ? 'opacity-80' : ''} ${isHinted ? 'animate-hint-glow' : ''} ${isFloating ? 'animate-card-float' : ''} ${isSectionBlocked ? 'opacity-40 pointer-events-none' : ''}`}
      style={{
        ...sizeStyle,
        ...(isGhost ? { opacity: 0.7 } : {}),
        ...(isFloating ? { animationDelay: `${(index * 0.5) % 4}s`, animationDuration: `${3.5 + (index % 4) * 0.5}s` } : {}),
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Trap mark indicator */}
      {isMarkedTrap && !isFlipped && !isMatched && (
        <div className="absolute -top-1 -right-1 z-20 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-red-300">
          ⚠
        </div>
      )}
      {isMarkedTrap && !isFlipped && !isMatched && (
        <div className="absolute inset-0 rounded-xl border-3 border-red-500/60 pointer-events-none z-10" />
      )}
      <div
        className={`w-full h-full transition-transform transform-style-3d ${isFlipped || isMatched || isHinted ? 'rotate-y-180' : ''} ${isSlowOpen ? 'duration-1000' : 'duration-500'}`}
        style={{
          ...sizeStyle,
          ...(isGhost ? { opacity: 0.7 } : {}),
          ...(isFloating ? { animationDelay: `${(index * 0.5) % 4}s`, animationDuration: `${3.5 + (index % 4) * 0.5}s` } : {}),
        }}
      >
        {/* Front of card (hidden state) */}
        <div
          className="absolute w-full h-full backface-hidden bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all border-2 border-indigo-400"
          style={{ ...idleAnimStyle, animationDelay: `${animDelay}s` }}
        >
          <span style={{ fontSize: sizeStyle.fontSize }}>?</span>
        </div>

        {/* Back of card (revealed state) */}
        <div
          className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-xl shadow-lg flex items-center justify-center border-2 ${colorBgClass
            ? colorBgClass
            : isHinted
              ? 'bg-gradient-to-br from-cyan-300 to-blue-400 border-cyan-200'
              : isMatched
                ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-300'
                : isWrong
                  ? 'bg-gradient-to-br from-red-400 to-red-500 border-red-300 animate-wrong'
                  : 'bg-gradient-to-br from-yellow-100 to-orange-100 border-yellow-300'
            }`}
          style={{
            fontSize: sizeStyle.fontSize,
            ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
            ...(isSilhouette ? { filter: 'grayscale(1) brightness(0.3) contrast(3)' } : {}),
            ...(isBlurred ? { filter: 'blur(6px)' } : {}),
          }}
        >
          {isContentHidden ? '' : emoji}

          {/* Sparkles effect for matched cards */}
          {isMatched && sparkles.map((sparkle) => (
            <div
              key={sparkle.id}
              className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-sparkle"
              style={{
                left: `${sparkle.x}%`,
                top: `${sparkle.y}%`,
                animationDelay: `${sparkle.id % 3 * 0.1}s`,
              }}
            />
          ))}

          {/* Hint beam effect */}
          {isHinted && (
            <div className="absolute inset-0 rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-cyan-400/30 animate-hint-pulse" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-full bg-gradient-to-b from-cyan-300/50 to-transparent animate-hint-beam" />
            </div>
          )}
        </div>
      </div>
    </div >
  );
};

export default Card;
