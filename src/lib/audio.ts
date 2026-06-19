/**
 * Web Audio SFX synth — ported from the legacy game.
 * Pure oscillator/ADSR tones (no asset files). Respects a global enabled flag
 * synced from the profile's audio preference. AudioContext is created lazily on
 * first use (after a user gesture, per browser autoplay rules).
 */

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  private ensure(): boolean {
    if (!this.enabled) return false;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch {
        return false;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  private tone(freq: number, durMs: number, opts: ToneOpts = {}) {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + durMs / 1000);
    const peak = opts.gain ?? 0.6;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  }

  private seq(notes: Array<[freq: number, dur: number, delay: number, opts?: ToneOpts]>) {
    for (const [freq, dur, delay, opts] of notes) {
      if (delay === 0) this.tone(freq, dur, opts);
      else setTimeout(() => this.tone(freq, dur, opts), delay);
    }
  }

  /** Subtle UI click. */
  click() {
    this.tone(900, 40, { type: 'square', gain: 0.16 });
  }

  /** Soft hover tick. */
  hover() {
    this.tone(1200, 24, { type: 'sine', gain: 0.06 });
  }

  countdownTick() {
    this.tone(523, 110, { type: 'sine', gain: 0.4 });
  }

  countdownGo() {
    this.tone(880, 220, { type: 'sine', gain: 0.55 });
    setTimeout(() => this.tone(1320, 180, { type: 'sine', gain: 0.4 }), 60);
  }

  /** Element summoned — a short rising zap on lock-in. */
  summon() {
    this.tone(420, 130, { type: 'square', glideTo: 1040, gain: 0.22 });
    setTimeout(() => this.tone(1320, 80, { type: 'sine', gain: 0.12 }), 70);
  }

  /** Orbs collide at reveal — a brief impact. */
  clash() {
    this.tone(180, 120, { type: 'sawtooth', glideTo: 70, gain: 0.3 });
    setTimeout(() => this.tone(520, 60, { type: 'square', gain: 0.12 }), 20);
  }

  roundWon() {
    this.seq([
      [659, 110, 0, { gain: 0.4 }],
      [784, 110, 100, { gain: 0.4 }],
      [1047, 220, 200, { gain: 0.45 }],
    ]);
  }

  roundLost() {
    this.tone(440, 180, { type: 'sine', glideTo: 220, gain: 0.3 });
  }

  matchWon() {
    this.seq([
      [523, 150, 0, { gain: 0.45 }],
      [659, 150, 130, { gain: 0.45 }],
      [784, 150, 260, { gain: 0.45 }],
      [1047, 420, 390, { gain: 0.5 }],
    ]);
  }

  matchLost() {
    this.seq([
      [330, 280, 0, { type: 'sine', gain: 0.35 }],
      [247, 280, 220, { type: 'sine', gain: 0.35 }],
      [196, 480, 440, { type: 'sine', gain: 0.32 }],
    ]);
  }

  levelUp() {
    this.seq([
      [784, 120, 0, { gain: 0.4 }],
      [1047, 120, 110, { gain: 0.42 }],
      [1568, 360, 230, { type: 'sine', gain: 0.45 }],
    ]);
  }

  achievement() {
    this.tone(1568, 360, { type: 'sine', gain: 0.4 });
    setTimeout(() => this.tone(2093, 460, { type: 'sine', gain: 0.3 }), 60);
  }

  fillSplash() {
    this.tone(180, 120, { type: 'sine', glideTo: 90, gain: 0.22 });
    setTimeout(() => this.tone(660, 90, { type: 'sine', glideTo: 880, gain: 0.14 }), 30);
    setTimeout(() => this.tone(440, 60, { type: 'sine', gain: 0.09 }), 90);
  }
}

export const audio = new AudioEngine();
