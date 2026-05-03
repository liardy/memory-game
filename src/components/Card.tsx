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
  isColorMode?: boolean;
  isTriggeredTrap?: boolean;
  isSwapping?: boolean;
  isAnchored?: boolean;
}

// 5 different idle animation keyframes as inline styles
const IDLE_ANIMATIONS: React.CSSProperties[] = [
  { animationName: 'card-breathe', animationDuration: '4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-glow', animationDuration: '3.5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-sway', animationDuration: '5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-fade', animationDuration: '4.5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  { animationName: 'card-squish', animationDuration: '3.8s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
];

const Card: React.FC<CardProps> = ({ emoji, isFlipped, isMatched, onClick, onContextMenu, disabled, isWrong, isHinted, isMarkedTrap, index, cardSize, isFloating, isSilhouette, isBlurred, isGhost, rotation, isSectionBlocked, colorIndex, isSlowOpen, isContentHidden, isColorMode, isTriggeredTrap, isSwapping, isAnchored }) => {
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Color palette for level 8 — strong contrasting colors
  const COLOR_PALETTE = [
    'from-red-500 to-red-700 border-red-400',           // red
    'from-blue-500 to-blue-700 border-blue-400',         // blue
    'from-green-500 to-green-700 border-green-400',       // green
    'from-yellow-400 to-yellow-600 border-yellow-300',    // yellow
    'from-purple-500 to-purple-700 border-purple-400',    // purple
    'from-orange-500 to-orange-700 border-orange-400',    // orange
    'from-cyan-400 to-cyan-600 border-cyan-300',          // cyan
    'from-pink-400 to-pink-600 border-pink-300',          // pink
    'from-teal-500 to-teal-700 border-teal-400',          // teal
    'from-amber-400 to-amber-600 border-amber-300',        // amber
    'from-indigo-500 to-indigo-700 border-indigo-400',    // indigo
    'from-lime-400 to-lime-600 border-lime-300',          // lime
    'from-fuchsia-500 to-fuchsia-700 border-fuchsia-400', // fuchsia
    'from-rose-400 to-rose-600 border-rose-300',          // rose
    'from-emerald-500 to-emerald-700 border-emerald-400', // emerald
    'from-sky-400 to-sky-600 border-sky-300',             // sky
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

  const idleAnimStyle = !isMatched && !isFlipped ? IDLE_ANIMATIONS[index % IDLE_ANIMATIONS.length] : {};
  const animDelay = (index * 0.4) % 2;

  const sizeStyle = cardSize || { width: '80px', height: '80px', fontSize: '32px' };

  return (
    <div
      data-testid={`card-${index}`}
      className={`relative cursor-pointer select-none perspective-1000 transition-all duration-300 ${disabled ? 'pointer-events-none' : ''
        } ${isMatched ? 'opacity-80' : ''} ${isHinted ? 'animate-hint-glow' : ''} ${isFloating ? 'animate-card-float' : ''} ${isSectionBlocked ? 'opacity-40 pointer-events-none' : ''} ${isSwapping ? 'scale-0' : ''} `}
      style={{
        ...sizeStyle,
        ...(isGhost ? { opacity: 0.7 } : {}),
        ...(isFloating ? { animationDelay: `${(index * 0.5) % 4}s`, animationDuration: `${3.5 + (index % 4) * 0.5}s` } : {}),
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Anchor indicator */}
      {isAnchored && !isFlipped && !isMatched && (
        <div className="absolute -top-1 -left-1 z-20 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs shadow-lg border-2 border-blue-300">
          ⚓
        </div>
      )}
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
          className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-xl shadow-lg flex items-center justify-center border-2 ${isSilhouette && isContentHidden
            ? 'bg-black/80 border-gray-700'
            : colorBgClass
              ? colorBgClass
              : isHinted
                ? 'bg-gradient-to-br from-cyan-300 to-blue-400 border-cyan-200'
                : isMatched
                  ? isTriggeredTrap
                    ? 'bg-gradient-to-br from-red-400 to-red-500 border-red-300'
                    : 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-300'
                  : isWrong
                    ? 'bg-gradient-to-br from-red-400 to-red-500 border-red-300 animate-wrong'
                    : 'bg-gradient-to-br from-yellow-100 to-orange-100 border-yellow-300'
            }`}
          style={{
            fontSize: sizeStyle.fontSize,
            ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
            ...(isBlurred ? { filter: 'blur(6px)' } : {}),
          }}
        >
          {isColorMode ? null : (
            <span style={{
              ...(isContentHidden && !isSilhouette ? { opacity: 0 } : {}),
              ...(isSilhouette ? { filter: 'grayscale(1) brightness(0.3) contrast(3)' } : {}),
            }}>{emoji}</span>
          )}

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
