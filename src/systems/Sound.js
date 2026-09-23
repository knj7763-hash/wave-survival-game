// 효과음/배경음악. 오디오 파일 없이 Web Audio로 파형을 직접 합성해서 사운드 캐시에 넣는다.
import { STORAGE_KEYS } from '../config.js';

const TAU = Math.PI * 2;
const SFX_VOLUME = 0.6;
const MUSIC_VOLUME = 0.3;

// ─── 합성 도구 ─────────────────────────────────────────

function osc(type, phase) {
  const p = phase - Math.floor(phase);
  switch (type) {
    case 'sine': return Math.sin(TAU * p);
    case 'square': return p < 0.5 ? 0.6 : -0.6;
    case 'saw': return (2 * p - 1) * 0.7;
    default: return 1 - 4 * Math.abs(p - 0.5); // tri
  }
}

// 짧은 어택 후 제곱 곡선으로 감쇠
function env(t, dur, attack) {
  if (t < attack) return t / attack;
  const r = 1 - (t - attack) / Math.max(dur - attack, 1e-4);
  return r > 0 ? r * r : 0;
}

const sweep = (from, to) => (p) => from + (to - from) * p;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// 음 하나를 버퍼에 더한다. freq는 Hz 또는 진행도(0~1) → Hz 함수
function tone(data, sr, { start = 0, dur, freq, type = 'square', vol = 0.3, attack = 0.004 }) {
  const s0 = Math.floor(start * sr);
  const n = Math.floor(dur * sr);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < data.length; i++) {
    const t = i / sr;
    phase += (typeof freq === 'function' ? freq(t / dur) : freq) / sr;
    data[s0 + i] += osc(type, phase) * vol * env(t, dur, attack);
  }
}

// 노이즈. smooth(0~1, 작을수록 저음)로 간단한 로우패스
function noise(data, sr, { start = 0, dur, vol = 0.3, smooth = 1, attack = 0.002 }) {
  const s0 = Math.floor(start * sr);
  const n = Math.floor(dur * sr);
  let y = 0;
  for (let i = 0; i < n && s0 + i < data.length; i++) {
    const t = i / sr;
    const a = typeof smooth === 'function' ? smooth(t / dur) : smooth;
    y += a * ((Math.random() * 2 - 1) - y);
    data[s0 + i] += y * vol * env(t, dur, attack);
  }
}

function arpeggio(data, sr, notes, step, opts) {
  notes.forEach((n, i) => tone(data, sr, { start: i * step, dur: step * 1.6, freq: midi(n), ...opts }));
}

// ─── 효과음 정의 ───────────────────────────────────────

const SFX = {
  shoot: [0.07, (d, sr) => tone(d, sr, { dur: 0.07, freq: sweep(900, 300), vol: 0.18 })],
  blast: [0.18, (d, sr) => { noise(d, sr, { dur: 0.18, vol: 0.35, smooth: 0.35 }); tone(d, sr, { dur: 0.1, freq: sweep(300, 90), vol: 0.2 }); }],
  swish: [0.12, (d, sr) => noise(d, sr, { dur: 0.12, vol: 0.22, smooth: sweep(0.15, 0.6), attack: 0.03 })],
  zap: [0.3, (d, sr) => tone(d, sr, { dur: 0.3, freq: (p) => 900 - 400 * p + 60 * Math.sin(p * 60), type: 'saw', vol: 0.18 })],
  hit: [0.05, (d, sr) => noise(d, sr, { dur: 0.05, vol: 0.18, smooth: 0.5 })],
  kill: [0.12, (d, sr) => { tone(d, sr, { dur: 0.12, freq: sweep(520, 140), vol: 0.2 }); noise(d, sr, { dur: 0.06, vol: 0.12 }); }],
  hurt: [0.25, (d, sr) => { tone(d, sr, { dur: 0.25, freq: sweep(220, 55), vol: 0.35 }); noise(d, sr, { dur: 0.12, vol: 0.2, smooth: 0.3 }); }],
  pickup: [0.07, (d, sr) => tone(d, sr, { dur: 0.07, freq: sweep(1200, 1900), type: 'sine', vol: 0.15 })],
  levelup: [0.55, (d, sr) => arpeggio(d, sr, [72, 76, 79, 84], 0.09, { type: 'tri', vol: 0.3 })],
  waveStart: [0.45, (d, sr) => arpeggio(d, sr, [67, 72], 0.15, { vol: 0.2 })],
  waveClear: [0.6, (d, sr) => arpeggio(d, sr, [72, 76, 79, 84, 88], 0.08, { type: 'tri', vol: 0.28 })],
  alarm: [0.7, (d, sr) => [0, 0.18, 0.36].forEach((s) => tone(d, sr, { start: s, dur: 0.16, freq: sweep(720, 480), vol: 0.22 }))],
  dashWarn: [0.4, (d, sr) => tone(d, sr, { dur: 0.4, freq: sweep(180, 620), type: 'saw', vol: 0.2, attack: 0.3 })],
  explosion: [0.6, (d, sr) => { noise(d, sr, { dur: 0.6, vol: 0.55, smooth: sweep(0.5, 0.03) }); tone(d, sr, { dur: 0.35, freq: sweep(120, 35), type: 'sine', vol: 0.5 }); }],
  missile: [0.12, (d, sr) => tone(d, sr, { dur: 0.12, freq: sweep(420, 180), vol: 0.14 })],
  thunder: [0.45, (d, sr) => { noise(d, sr, { dur: 0.08, vol: 0.5, smooth: 1 }); noise(d, sr, { start: 0.03, dur: 0.42, vol: 0.45, smooth: 0.06 }); }],
  fire: [0.7, (d, sr) => noise(d, sr, { dur: 0.7, vol: 0.35, smooth: (p) => 0.08 + 0.05 * Math.sin(p * 40), attack: 0.05 })],
  shield: [0.5, (d, sr) => tone(d, sr, { dur: 0.5, freq: (p) => 300 + 300 * p + 20 * Math.sin(p * 50), type: 'sine', vol: 0.3, attack: 0.05 })],
  ready: [0.2, (d, sr) => arpeggio(d, sr, [79, 84], 0.07, { type: 'sine', vol: 0.2 })],
  denied: [0.12, (d, sr) => tone(d, sr, { dur: 0.12, freq: 140, vol: 0.2 })],
  click: [0.04, (d, sr) => tone(d, sr, { dur: 0.04, freq: 900, vol: 0.12 })],
  coin: [0.25, (d, sr) => arpeggio(d, sr, [88, 95], 0.06, { type: 'sine', vol: 0.22 })],
  success: [0.6, (d, sr) => arpeggio(d, sr, [72, 76, 79, 84], 0.1, { type: 'tri', vol: 0.3 })],
  fail: [0.5, (d, sr) => arpeggio(d, sr, [64, 60, 55], 0.13, { vol: 0.2 })],
  gameOver: [1.2, (d, sr) => arpeggio(d, sr, [67, 63, 60, 55], 0.22, { type: 'tri', vol: 0.3 })],
  bossDeath: [1.2, (d, sr) => { noise(d, sr, { dur: 1.2, vol: 0.6, smooth: sweep(0.6, 0.02) }); tone(d, sr, { dur: 0.9, freq: sweep(160, 30), type: 'sine', vol: 0.5 }); }],
};

// ─── 배경음악 (4마디 반복) ──────────────────────────────

const SONGS = {
  // Am - F - C - G, 차분한 진행
  bgm: { bpm: 112, bass: 'tri', lead: 'square', chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]] },
  // Am - Am - F - E, 빠르고 긴장감 있게
  bgmBoss: { bpm: 150, bass: 'saw', lead: 'square', chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [52, 56, 59]] },
};

function renderSong(ctx, { bpm, bass, lead, chords }) {
  const sr = ctx.sampleRate;
  const step = 60 / bpm / 4; // 16분음표
  const buffer = ctx.createBuffer(1, Math.floor(chords.length * 16 * step * sr), sr);
  const d = buffer.getChannelData(0);
  const arp = [0, 1, 2, 1];

  chords.forEach((chord, bar) => {
    for (let s = 0; s < 16; s++) {
      const t = (bar * 16 + s) * step;
      if (s % 2 === 0) tone(d, sr, { start: t, dur: step * 1.9, freq: midi(chord[0] - 12), type: bass, vol: 0.28 });
      tone(d, sr, { start: t, dur: step * 0.9, freq: midi(chord[arp[s % 4]] + 12), type: lead, vol: 0.06 });
      if (s % 4 === 0) tone(d, sr, { start: t, dur: 0.14, freq: sweep(150, 45), type: 'sine', vol: 0.55 }); // 킥
      if (s % 4 === 2) noise(d, sr, { start: t, dur: 0.035, vol: 0.08 }); // 하이햇
    }
  });
  clamp(d);
  return buffer;
}

function clamp(d) {
  for (let i = 0; i < d.length; i++) d[i] = Math.max(-1, Math.min(1, d[i]));
}

// ─── 공개 API ──────────────────────────────────────────

let generated = false;
let muted = false;
let currentMusic = null;
let pendingMusicKey = null;
const lastPlayedAt = {};

// BootScene에서 한 번 호출. Web Audio를 쓸 수 없는 환경이면 소리 없이 진행한다.
export function generateSounds(scene) {
  const ctx = scene.sound.context;
  if (!ctx || generated) return;
  generated = true;

  for (const [key, [dur, render]] of Object.entries(SFX)) {
    const buffer = ctx.createBuffer(1, Math.floor(dur * ctx.sampleRate), ctx.sampleRate);
    const d = buffer.getChannelData(0);
    render(d, ctx.sampleRate);
    clamp(d);
    scene.cache.audio.add(key, buffer);
  }
  for (const [key, song] of Object.entries(SONGS)) scene.cache.audio.add(key, renderSong(ctx, song));

  muted = loadMuted();
  scene.sound.mute = muted;
  // 브라우저는 첫 입력 전까지 소리를 막는다. 풀리면 대기 중인 음악을 재생.
  scene.sound.once('unlocked', () => {
    if (pendingMusicKey) playMusic(scene, pendingMusicKey);
  });
}

// throttleMs: 같은 효과음이 너무 자주 겹치지 않게 최소 간격
export function playSfx(scene, key, { volume = 1, throttleMs = 0 } = {}) {
  const sound = scene.sound;
  if (!generated || sound.locked || !scene.cache.audio.exists(key)) return; // 잠긴 동안 쌓였다 한꺼번에 나는 것 방지
  const now = performance.now();
  if (throttleMs && now - (lastPlayedAt[key] ?? -Infinity) < throttleMs) return;
  lastPlayedAt[key] = now;
  sound.play(key, { volume: volume * SFX_VOLUME });
}

export function playMusic(scene, key) {
  pendingMusicKey = key;
  if (!generated || !scene.cache.audio.exists(key)) return;
  if (currentMusic?.key === key && currentMusic.isPlaying) return;
  stopMusic();
  if (scene.sound.locked) return; // unlocked 이벤트에서 재생
  currentMusic = scene.sound.add(key, { loop: true, volume: MUSIC_VOLUME });
  currentMusic.play();
}

export function stopMusic() {
  if (!currentMusic) return;
  currentMusic.stop();
  currentMusic.destroy();
  currentMusic = null;
}

// Phaser의 sound.mute는 오디오 스레드에 반영된 뒤에야 읽히므로, 상태는 여기서 따로 관리한다.
export function toggleMute(scene) {
  muted = !muted;
  scene.sound.mute = muted;
  try {
    localStorage.setItem(STORAGE_KEYS.muted, muted ? '1' : '0');
  } catch { /* 저장 불가 환경 */ }
  return muted;
}

export function isMuted() {
  return muted;
}

function loadMuted() {
  try {
    return localStorage.getItem(STORAGE_KEYS.muted) === '1';
  } catch {
    return false;
  }
}
