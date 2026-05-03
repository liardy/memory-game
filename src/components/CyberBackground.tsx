import React, { useState, useMemo } from 'react';

interface CyberBackgroundProps {
  level: number;
}

// 16 cyberpunk themes — one per level
const THEMES: Array<{
  bg: string; // CSS background
  nebula: Array<{ color: string; x: string; y: string; size: string; delay: string }>;
  particles: 'stars' | 'rain' | 'grid' | 'data' | 'sparks';
  accent: string;
}> = [
    // 1 — Neon City Skyline
    {
      bg: 'linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 40%, #0d0d2b 100%)',
      nebula: [
        { color: 'bg-cyan-500/15', x: '20%', y: '30%', size: 'w-80 h-80', delay: '0s' },
        { color: 'bg-purple-600/10', x: '70%', y: '50%', size: 'w-96 h-96', delay: '1.5s' },
      ],
      particles: 'rain',
      accent: 'cyan',
    },
    // 2 — Digital Rain
    {
      bg: 'linear-gradient(180deg, #000a00 0%, #001a0a 50%, #000d0d 100%)',
      nebula: [
        { color: 'bg-green-500/15', x: '30%', y: '20%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-emerald-400/8', x: '60%', y: '60%', size: 'w-80 h-80', delay: '2s' },
      ],
      particles: 'data',
      accent: 'green',
    },
    // 3 — Corporate District
    {
      bg: 'linear-gradient(180deg, #0a0a2a 0%, #1a1a3e 40%, #0d0d2b 100%)',
      nebula: [
        { color: 'bg-blue-500/12', x: '25%', y: '35%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-indigo-400/8', x: '75%', y: '45%', size: 'w-80 h-80', delay: '1s' },
      ],
      particles: 'grid',
      accent: 'blue',
    },
    // 4 — Underground Market
    {
      bg: 'linear-gradient(180deg, #1a0a0a 0%, #2a0a1e 40%, #0d0d1b 100%)',
      nebula: [
        { color: 'bg-red-500/12', x: '40%', y: '25%', size: 'w-80 h-80', delay: '0s' },
        { color: 'bg-pink-500/10', x: '65%', y: '55%', size: 'w-96 h-96', delay: '1.5s' },
      ],
      particles: 'sparks',
      accent: 'red',
    },
    // 5 — Neon Alley
    {
      bg: 'linear-gradient(180deg, #0a0a1a 0%, #1a0a3e 30%, #2a0a2e 60%, #0d0d2b 100%)',
      nebula: [
        { color: 'bg-fuchsia-500/15', x: '15%', y: '40%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-violet-400/10', x: '80%', y: '30%', size: 'w-80 h-80', delay: '1s' },
        { color: 'bg-cyan-400/8', x: '50%', y: '70%', size: 'w-72 h-72', delay: '2s' },
      ],
      particles: 'rain',
      accent: 'fuchsia',
    },
    // 6 — Data Center
    {
      bg: 'linear-gradient(180deg, #000a1a 0%, #001a2e 50%, #000d1b 100%)',
      nebula: [
        { color: 'bg-cyan-400/12', x: '30%', y: '30%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-teal-500/8', x: '70%', y: '60%', size: 'w-80 h-80', delay: '1.5s' },
      ],
      particles: 'data',
      accent: 'teal',
    },
    // 7 — Chrome District
    {
      bg: 'linear-gradient(180deg, #0f0f1f 0%, #1a1a2f 40%, #0a0a1f 100%)',
      nebula: [
        { color: 'bg-slate-300/8', x: '25%', y: '35%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-blue-300/6', x: '65%', y: '50%', size: 'w-80 h-80', delay: '1s' },
      ],
      particles: 'grid',
      accent: 'slate',
    },
    // 8 — Hologram Arena (color match level)
    {
      bg: 'linear-gradient(180deg, #0a0a2a 0%, #0a1a3e 30%, #1a0a2e 60%, #0d0d2b 100%)',
      nebula: [
        { color: 'bg-blue-500/10', x: '20%', y: '30%', size: 'w-80 h-80', delay: '0s' },
        { color: 'bg-purple-500/10', x: '50%', y: '50%', size: 'w-96 h-96', delay: '0.5s' },
        { color: 'bg-pink-500/8', x: '80%', y: '40%', size: 'w-80 h-80', delay: '1s' },
        { color: 'bg-cyan-400/8', x: '35%', y: '70%', size: 'w-72 h-72', delay: '1.5s' },
      ],
      particles: 'sparks',
      accent: 'violet',
    },
    // 9 — Black Market
    {
      bg: 'linear-gradient(180deg, #0d0a00 0%, #1a0a00 40%, #0d0800 100%)',
      nebula: [
        { color: 'bg-amber-500/12', x: '35%', y: '25%', size: 'w-80 h-80', delay: '0s' },
        { color: 'bg-orange-500/8', x: '70%', y: '55%', size: 'w-96 h-96', delay: '1.5s' },
      ],
      particles: 'sparks',
      accent: 'amber',
    },
    // 10 — Trap Shift Zone
    {
      bg: 'linear-gradient(180deg, #1a0000 0%, #2a000a 40%, #0d000d 100%)',
      nebula: [
        { color: 'bg-red-600/15', x: '25%', y: '30%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-rose-500/10', x: '75%', y: '50%', size: 'w-80 h-80', delay: '1s' },
      ],
      particles: 'rain',
      accent: 'rose',
    },
    // 11 — Neural Network
    {
      bg: 'linear-gradient(180deg, #0a001a 0%, #1a003e 40%, #0d002b 100%)',
      nebula: [
        { color: 'bg-purple-500/15', x: '30%', y: '25%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-violet-400/10', x: '60%', y: '60%', size: 'w-80 h-80', delay: '1.5s' },
      ],
      particles: 'data',
      accent: 'purple',
    },
    // 12 — Firewall
    {
      bg: 'linear-gradient(180deg, #1a0a00 0%, #2a1a00 40%, #0d0d00 100%)',
      nebula: [
        { color: 'bg-yellow-500/12', x: '40%', y: '30%', size: 'w-80 h-80', delay: '0s' },
        { color: 'bg-orange-400/8', x: '65%', y: '55%', size: 'w-96 h-96', delay: '1s' },
      ],
      particles: 'grid',
      accent: 'yellow',
    },
    // 13 — Rotated Reality
    {
      bg: 'linear-gradient(180deg, #0a1a1a 0%, #0a2e2e 40%, #0d1b2b 100%)',
      nebula: [
        { color: 'bg-teal-400/12', x: '20%', y: '35%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-cyan-500/10', x: '70%', y: '45%', size: 'w-80 h-80', delay: '1.5s' },
      ],
      particles: 'data',
      accent: 'teal',
    },
    // 14 — Ghost Protocol
    {
      bg: 'linear-gradient(180deg, #0a0a0f 0%, #0f0f1f 40%, #050510 100%)',
      nebula: [
        { color: 'bg-gray-400/8', x: '30%', y: '30%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-slate-300/6', x: '70%', y: '50%', size: 'w-80 h-80', delay: '1s' },
      ],
      particles: 'rain',
      accent: 'gray',
    },
    // 15 — Shift Line
    {
      bg: 'linear-gradient(180deg, #0a0a1a 0%, #1e0a2e 30%, #0a1e2e 60%, #0d0d2b 100%)',
      nebula: [
        { color: 'bg-indigo-500/12', x: '25%', y: '35%', size: 'w-80 h-80', delay: '0s' },
        { color: 'bg-purple-400/10', x: '55%', y: '55%', size: 'w-96 h-96', delay: '1s' },
        { color: 'bg-cyan-400/8', x: '80%', y: '30%', size: 'w-72 h-72', delay: '2s' },
      ],
      particles: 'grid',
      accent: 'indigo',
    },
    // 16 — Final Run (no bonuses!)
    {
      bg: 'linear-gradient(180deg, #0a0000 0%, #1a0000 30%, #2a0000 60%, #0a0000 100%)',
      nebula: [
        { color: 'bg-red-600/20', x: '30%', y: '25%', size: 'w-96 h-96', delay: '0s' },
        { color: 'bg-red-500/15', x: '70%', y: '50%', size: 'w-96 h-96', delay: '1s' },
        { color: 'bg-orange-500/8', x: '50%', y: '70%', size: 'w-80 h-80', delay: '2s' },
      ],
      particles: 'sparks',
      accent: 'red',
    },
  ];

// Rain drops (cyberpunk neon rain)
function RainDrops() {
  const [drops] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 0.8 + Math.random() * 1.2,
      height: 15 + Math.random() * 25,
      opacity: 0.15 + Math.random() * 0.25,
    }))
  );
  return (
    <>
      {drops.map(d => (
        <div
          key={d.id}
          className="absolute w-px animate-cyber-rain"
          style={{
            left: `${d.x}%`,
            top: '-5%',
            height: `${d.height}px`,
            opacity: d.opacity,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
            background: 'linear-gradient(to bottom, transparent, #0ff, transparent)',
          }}
        />
      ))}
    </>
  );
}

// Data stream (matrix-like falling characters)
function DataStream() {
  const [streams] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      chars: Array.from({ length: 8 + Math.floor(Math.random() * 8) }, () =>
        String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))
      ),
    }))
  );
  return (
    <>
      {streams.map(s => (
        <div
          key={s.id}
          className="absolute text-green-400/30 font-mono text-xs animate-data-fall"
          style={{
            left: `${s.x}%`,
            top: '-10%',
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            letterSpacing: '4px',
          }}
        >
          {s.chars.join('')}
        </div>
      ))}
    </>
  );
}

// Grid lines (cyberpunk perspective grid)
function GridLines() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-20">
      {/* Horizontal lines */}
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={`h${i}`}
          className="absolute left-0 right-0 h-px bg-cyan-400/30"
          style={{ top: `${i * 5}%` }}
        />
      ))}
      {/* Vertical lines converging to center */}
      {Array.from({ length: 15 }, (_, i) => (
        <div
          key={`v${i}`}
          className="absolute top-0 bottom-0 w-px bg-cyan-400/20"
          style={{ left: `${i * 7}%` }}
        />
      ))}
      {/* Perspective floor grid */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(0,255,255,0.05) 30px, rgba(0,255,255,0.05) 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(0,255,255,0.05) 30px, rgba(0,255,255,0.05) 31px)',
          transform: 'perspective(400px) rotateX(60deg)',
          transformOrigin: 'bottom center',
        }}
      />
    </div>
  );
}

// Sparks / embers
function Sparks() {
  const [sparks] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 1.5 + Math.random() * 2,
      size: 1 + Math.random() * 3,
    }))
  );
  return (
    <>
      {sparks.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full animate-spark-float"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            background: `radial-gradient(circle, #ff6600, #ff3300, transparent)`,
            boxShadow: '0 0 4px #ff4400, 0 0 8px #ff220044',
          }}
        />
      ))}
    </>
  );
}

const CyberBackground: React.FC<CyberBackgroundProps> = ({ level }) => {
  const theme = THEMES[Math.min(level - 1, THEMES.length - 1)];

  const particles = useMemo(() => {
    switch (theme.particles) {
      case 'rain': return <RainDrops />;
      case 'data': return <DataStream />;
      case 'grid': return <GridLines />;
      case 'sparks': return <Sparks />;
      default: return null;
    }
  }, [theme.particles]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 transition-all duration-1000" style={{ background: theme.bg }}>
      {/* Nebula blobs */}
      {theme.nebula.map((n, i) => (
        <div
          key={i}
          className={`absolute ${n.color} ${n.size} rounded-full blur-3xl animate-float`}
          style={{ left: n.x, top: n.y, animationDelay: n.delay }}
        />
      ))}

      {/* Particle effect */}
      {particles}
    </div>
  );
};

export default CyberBackground;
