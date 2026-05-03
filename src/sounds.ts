// Procedural sound generation via Web Audio API
// No external files needed — all sounds synthesized at runtime

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, start = 0) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration);
}

function playNoise(duration: number, volume = 0.1, start = 0, highpass = 2000) {
  const c = getCtx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(c.currentTime + start);
  src.stop(c.currentTime + start + duration);
}

// Card flip — short click/whoosh
export function playFlip() {
  playNoise(0.06, 0.12, 0, 3000);
  playTone(800, 0.04, 'sine', 0.06);
}

// Pair matched — pleasant chime
export function playMatch() {
  playTone(523, 0.25, 'sine', 0.15);  // C5
  playTone(659, 0.3, 'sine', 0.12, 0.08);  // E5
  playTone(784, 0.35, 'sine', 0.10, 0.15);  // G5
}

// Pair mismatch — dull low tone
export function playMismatch() {
  playTone(180, 0.3, 'triangle', 0.12);
  playTone(160, 0.35, 'triangle', 0.08, 0.05);
}

// Bonus collected — joyful chord
export function playBonusCollect() {
  playTone(523, 0.3, 'sine', 0.12);     // C5
  playTone(659, 0.35, 'sine', 0.10, 0.05);  // E5
  playTone(784, 0.4, 'sine', 0.10, 0.1);    // G5
  playTone(1047, 0.5, 'sine', 0.08, 0.15);  // C6
}

// Bonus used — activation swoosh
export function playBonusUse() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.15);
  gain.gain.setValueAtTime(0.08, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.2);
}

// Bonus lost — sad descending tone
export function playBonusLost() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.4);
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.5);
}

// Trap triggered — ominous dissonance
export function playTrap() {
  playTone(233, 0.5, 'sawtooth', 0.10);   // Bb3
  playTone(175, 0.6, 'sawtooth', 0.08, 0.05);  // tritone dissonance
  playNoise(0.3, 0.06, 0.1, 800);
}

// Level complete — victory jingle
export function playLevelComplete() {
  const notes = [523, 587, 659, 784, 880, 1047]; // C D E G A C6
  notes.forEach((freq, i) => {
    playTone(freq, 0.25, 'sine', 0.12, i * 0.08);
  });
}

// Game over — defeat
export function playGameOver() {
  const notes = [440, 415, 392, 370, 349, 330, 311, 294]; // A Ab G F# F E Eb D
  notes.forEach((freq, i) => {
    playTone(freq, 0.35, 'triangle', 0.10, i * 0.12);
  });
}

// Game won — fanfare
export function playGameWon() {
  const fanfare = [523, 659, 784, 1047, 784, 1047, 1319]; // C E G C6 G C6 E6
  fanfare.forEach((freq, i) => {
    playTone(freq, 0.35, 'sine', 0.12, i * 0.1);
  });
  // Final chord
  playTone(523, 1.0, 'sine', 0.08, 0.7);
  playTone(659, 1.0, 'sine', 0.06, 0.7);
  playTone(784, 1.0, 'sine', 0.06, 0.7);
  playTone(1047, 1.0, 'sine', 0.05, 0.7);
}

// Timer alarm — tick/beep when time is low
export function playTimerTick() {
  playTone(1200, 0.05, 'square', 0.06);
}

// UI button click — soft tap
export function playUIClick() {
  playTone(600, 0.04, 'sine', 0.05);
}

// Background music — random track per round, loops until stopped
const MUSIC_TRACKS = [
  '/music/bertsz-cyberpunk-alleyway-ambient-188519.mp3',
  '/music/leberch-cyberpunk-437545.mp3',
  '/music/leberch-cyberpunk-drone-375259.mp3',
  '/music/mondamusic-cyberpunk-512862.mp3',
  '/music/sound4stock-dark-cyberpunk-future-electronic-473179.mp3',
  '/music/soundgallerybydmitrytaras-cyberpunk-sci-fi-179625.mp3',
  '/music/the_mountain-suspense-cyberpunk-375986.mp3',
  '/music/tunetank-cyberpunk-futuristic-background-349787.mp3',
];

const MUSIC_VOLUME = 0.15; // 50% of previous 0.3
const FADE_DURATION = 1.0; // 1 second fade

let currentAudio: HTMLAudioElement | null = null;
let musicGainNode: GainNode | null = null;
let musicSource: MediaElementAudioSourceNode | null = null;

function getMusicGain(): GainNode {
  const c = getCtx();
  if (!musicGainNode) {
    // Compressor to normalize loudness across tracks
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 10;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    musicGainNode = c.createGain();
    musicGainNode.gain.value = MUSIC_VOLUME;

    musicGainNode.connect(compressor);
    compressor.connect(c.destination);
  }
  return musicGainNode;
}

function connectAudioToGain(audio: HTMLAudioElement) {
  const c = getCtx();
  // Disconnect previous source if any
  if (musicSource) {
    try { musicSource.disconnect(); } catch { /* already disconnected */ }
  }
  try {
    musicSource = c.createMediaElementSource(audio);
    musicSource.connect(getMusicGain());
  } catch {
    // MediaElementSource can only be created once per audio element
    // If reused, just use volume fallback
    audio.volume = MUSIC_VOLUME;
  }
}

export function startRoundMusic() {
  const track = MUSIC_TRACKS[Math.floor(Math.random() * MUSIC_TRACKS.length)];
  const audio = new Audio(track);
  audio.loop = true;
  audio.crossOrigin = 'anonymous';
  connectAudioToGain(audio);

  // Fade in
  const gain = getMusicGain();
  const c = getCtx();
  gain.gain.setValueAtTime(0.001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(MUSIC_VOLUME, c.currentTime + FADE_DURATION);

  audio.play().catch(() => {
    // Autoplay blocked — will play after first user interaction
  });
  currentAudio = audio;
}

export function stopRoundMusic() {
  if (!currentAudio) return;
  const audio = currentAudio;
  currentAudio = null;

  // Fade out
  const gain = musicGainNode;
  const c = ctx;
  if (gain && c) {
    gain.gain.setValueAtTime(gain.gain.value, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + FADE_DURATION);
    setTimeout(() => {
      audio.pause();
      audio.src = '';
      if (musicSource) {
        try { musicSource.disconnect(); } catch { /* ok */ }
        musicSource = null;
      }
    }, FADE_DURATION * 1000 + 100);
  } else {
    audio.pause();
    audio.src = '';
  }
}
