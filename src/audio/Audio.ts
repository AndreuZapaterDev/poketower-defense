import { loadMuted, saveMuted } from '../save';

// Sonido chiptune generado con Web Audio: no hace falta ningún fichero de audio.

export type SfxName =
  | 'click'
  | 'error'
  | 'place'
  | 'coin'
  | 'ember'
  | 'bubble'
  | 'leaf'
  | 'punch'
  | 'flame'
  | 'hit'
  | 'super'
  | 'crit'
  | 'faint'
  | 'leak'
  | 'boss'
  | 'wave'
  | 'clear'
  | 'evolve'
  | 'levelup'
  | 'win'
  | 'lose'
  | 'throw'
  | 'pop'
  | 'recall'
  | 'battle';

interface ToneOpts {
  freq: number;
  /** Frecuencia final (deslizamiento exponencial) */
  to?: number;
  type?: OscillatorType;
  dur: number;
  vol?: number;
  /** Retardo en segundos desde ahora (o desde `when`) */
  at?: number;
  /** Instante absoluto del AudioContext */
  when?: number;
  bus?: AudioNode;
}

// Mínimo de milisegundos entre dos reproducciones del mismo efecto
const THROTTLE: Partial<Record<SfxName, number>> = { hit: 70, super: 90, faint: 60, coin: 60, ember: 60, bubble: 60, leaf: 60, punch: 50 };

const SEMITONES: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
const freq = (note: string) => {
  const [, name, octave] = /^([A-G]#?)(\d)$/.exec(note)!;
  return 440 * 2 ** ((SEMITONES[name] + (Number(octave) - 4) * 12) / 12);
};

// Melodía original en corcheas ('-' alarga la nota anterior). Acordes: C G Am F C G F G
const MELODY = [
  'E5', '-', 'G5', '-', 'C6', '-', 'B5', 'A5',
  'G5', '-', 'D5', '-', 'G5', '-', 'A5', 'B5',
  'C6', '-', 'B5', 'A5', 'E5', '-', 'A5', '-',
  'F5', '-', 'A5', '-', 'C6', '-', 'A5', 'G5',
  'E5', '-', 'G5', '-', 'C6', '-', 'D6', 'E6',
  'D6', '-', 'B5', '-', 'G5', '-', 'A5', 'B5',
  'C6', '-', 'A5', '-', 'F5', '-', 'A5', 'C6',
  'B5', '-', '-', '-', 'G5', '-', '-', '-',
];
const BASS = ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'];
const CALM_TEMPO = 116;
const BATTLE_TEMPO = 148;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private muted = loadMuted();
  private lastPlayed = new Map<SfxName, number>();
  private musicTimer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private tempo = CALM_TEMPO;

  get isMuted(): boolean {
    return this.muted;
  }

  /** Debe llamarse tras un gesto del usuario (clic o tecla) para que el navegador permita el sonido */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.35;
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(this.master);

      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    saveMuted(this.muted);
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // ------------------------------------------------------------ efectos

  play(name: SfxName): void {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    const gap = THROTTLE[name];
    if (gap && now - (this.lastPlayed.get(name) ?? 0) < gap) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'click':
        this.tone({ freq: 1200, dur: 0.03, vol: 0.15 });
        break;
      case 'error':
        this.tone({ freq: 160, dur: 0.08, vol: 0.25 });
        this.tone({ freq: 130, dur: 0.1, vol: 0.25, at: 0.09 });
        break;
      case 'place':
        this.arpeggio(['C5', 'E5', 'G5'], 0.05, 'triangle', 0.35);
        break;
      case 'coin':
        this.tone({ freq: 988, dur: 0.05, vol: 0.18 });
        this.tone({ freq: 1319, dur: 0.18, vol: 0.18, at: 0.05 });
        break;
      case 'ember':
        this.noise(0.12, 0.25, 'bandpass', 1400);
        this.tone({ freq: 500, to: 200, dur: 0.1, vol: 0.08, type: 'sawtooth' });
        break;
      case 'bubble':
        this.tone({ freq: 380, to: 900, dur: 0.09, vol: 0.25, type: 'sine' });
        break;
      case 'leaf':
        this.tone({ freq: 900, to: 600, dur: 0.07, vol: 0.12, type: 'triangle' });
        this.noise(0.05, 0.08, 'highpass', 4000);
        break;
      case 'punch':
        this.noise(0.06, 0.3, 'lowpass', 700);
        this.tone({ freq: 160, to: 60, dur: 0.08, vol: 0.25 });
        break;
      case 'flame':
        this.noise(0.35, 0.3, 'bandpass', 800);
        break;
      case 'hit':
        this.tone({ freq: 220, to: 110, dur: 0.05, vol: 0.08 });
        break;
      case 'super':
        this.tone({ freq: 880, dur: 0.05, vol: 0.15 });
        this.tone({ freq: 1320, dur: 0.08, vol: 0.15, at: 0.05 });
        break;
      case 'crit':
        this.tone({ freq: 1568, to: 784, dur: 0.15, vol: 0.18 });
        break;
      case 'faint':
        this.tone({ freq: 700, to: 90, dur: 0.28, vol: 0.18 });
        break;
      case 'leak':
        this.tone({ freq: 220, to: 70, dur: 0.35, vol: 0.3, type: 'sawtooth' });
        break;
      case 'boss':
        for (let i = 0; i < 4; i++) this.tone({ freq: i % 2 ? 98 : 110, dur: 0.16, vol: 0.35, type: 'sawtooth', at: i * 0.17 });
        break;
      case 'wave':
        this.arpeggio(['G4', 'C5', 'E5', 'G5'], 0.08, 'square', 0.22);
        break;
      case 'clear':
        this.arpeggio(['E5', 'G5', 'C6', 'E6'], 0.09, 'square', 0.22, 0.25);
        break;
      case 'evolve':
        this.arpeggio(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.08, 'square', 0.2, 0.3);
        break;
      case 'levelup':
        this.arpeggio(['G5', 'B5', 'D6'], 0.07, 'square', 0.2, 0.2);
        break;
      case 'win':
        this.arpeggio(['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.12, 'square', 0.25, 0.5);
        break;
      case 'lose':
        this.arpeggio(['G4', 'F4', 'D#4', 'C4'], 0.22, 'triangle', 0.4, 0.5);
        break;
      case 'throw':
        this.noise(0.35, 0.18, 'bandpass', 2500);
        this.tone({ freq: 300, to: 900, dur: 0.3, vol: 0.06, type: 'triangle' });
        break;
      case 'pop':
        this.tone({ freq: 500, to: 1400, dur: 0.12, vol: 0.2 });
        this.noise(0.15, 0.2, 'highpass', 3000);
        this.arpeggio(['C6', 'G6'], 0.06, 'square', 0.12);
        break;
      case 'recall':
        this.tone({ freq: 1400, to: 300, dur: 0.3, vol: 0.18 });
        break;
      case 'battle':
        // Arranque de combate salvaje: notas rápidas descendentes y subida
        this.arpeggio(['A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'A4', 'C5', 'E5', 'A5'], 0.045, 'square', 0.18, 0.25);
        break;
    }
  }

  // ------------------------------------------------------------ música

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic(): void {
    if (this.musicTimer === null) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  /** Durante las oleadas la música va más rápida */
  setBattle(battle: boolean): void {
    this.tempo = battle ? BATTLE_TEMPO : CALM_TEMPO;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx!;
    const stepDur = 60 / this.tempo / 2;
    // Si la pestaña estuvo en segundo plano, saltar en vez de tocar todo de golpe
    if (this.nextNoteTime < ctx.currentTime - 0.2) this.nextNoteTime = ctx.currentTime + 0.05;
    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % MELODY.length;
    }
  }

  private playStep(i: number, when: number, stepDur: number): void {
    const bus = this.musicBus;
    const note = MELODY[i];
    if (note !== '-') {
      let holds = 1;
      while (MELODY[(i + holds) % MELODY.length] === '-') holds++;
      this.tone({ freq: freq(note), dur: holds * stepDur * 0.9, vol: 0.12, when, bus });
    }
    const inBar = i % 8;
    if (inBar === 0 || inBar === 4) {
      const root = freq(BASS[Math.floor(i / 8)]);
      this.tone({ freq: inBar === 4 ? root * 2 : root, dur: stepDur * 3.6, vol: 0.35, type: 'triangle', when, bus });
    }
    if (inBar === 0) this.tone({ freq: 130, to: 50, dur: 0.1, vol: 0.35, type: 'sine', when, bus });
    if (i % 2 === 1) this.noise(0.03, 0.06, 'highpass', 7000, when, bus);
  }

  // ------------------------------------------------------------ síntesis

  private tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const t = (o.when ?? ctx.currentTime) + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.vol ?? 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(gain).connect(o.bus ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  private noise(dur: number, vol: number, filterType: BiquadFilterType, filterFreq: number, when?: number, bus?: AudioNode): void {
    const ctx = this.ctx!;
    const t = when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private arpeggio(notes: string[], gap: number, type: OscillatorType, vol: number, lastDur = gap * 1.5): void {
    notes.forEach((n, i) =>
      this.tone({ freq: freq(n), dur: i === notes.length - 1 ? lastDur : gap * 1.5, vol, type, at: i * gap }),
    );
  }
}

export const audio = new AudioEngine();
