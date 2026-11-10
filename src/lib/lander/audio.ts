/**
 * Web Audio engine for LanderGame.
 * Uses persistent filtered noise nodes with gain ramping for continuous thrusters (no oscillators per frame).
 * Discrete oscillators for landing chime and crash sound.
 * Remembers user choice in localStorage safely wrapped in try/catch.
 */

export class AudioManager {
  private soundEnabled = false;
  private audioCtx: AudioContext | null = null;
  private mainThrustGain: GainNode | null = null;
  private rcsGain: GainNode | null = null;
  private mainThrustSource: AudioBufferSourceNode | null = null;
  private rcsSource: AudioBufferSourceNode | null = null;

  constructor() {
    this.soundEnabled = this.loadPreference();
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public toggle(): boolean {
    this.soundEnabled = !this.soundEnabled;
    this.savePreference(this.soundEnabled);
    if (this.soundEnabled) {
      this.ensureAudioContext();
    } else {
      this.silenceContinuous();
    }
    return this.soundEnabled;
  }

  public setThrustActive(active: boolean): void {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioCtx || !this.mainThrustGain) return;

    const target = active ? 0.08 : 0.0001;
    this.mainThrustGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.03);
  }

  public setRcsActive(active: boolean): void {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioCtx || !this.rcsGain) return;

    const target = active ? 0.035 : 0.0001;
    this.rcsGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.02);
  }

  public playTouchdown(): void {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      // High chime tone 1
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // High chime tone 2
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174, now + 0.12);
      gain2.gain.setValueAtTime(0.07, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);
    } catch {
      // Audio fail-safe
    }
  }

  public playCrash(): void {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.45);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Audio fail-safe
    }
  }

  public silenceContinuous(): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (this.mainThrustGain) {
      this.mainThrustGain.gain.setValueAtTime(0.0001, now);
    }
    if (this.rcsGain) {
      this.rcsGain.gain.setValueAtTime(0.0001, now);
    }
  }

  public destroy(): void {
    this.silenceContinuous();
    try {
      this.mainThrustSource?.stop();
      this.rcsSource?.stop();
      this.mainThrustSource?.disconnect();
      this.rcsSource?.disconnect();
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
      }
    } catch {
      // Safe cleanup
    }
    this.audioCtx = null;
    this.mainThrustGain = null;
    this.rcsGain = null;
    this.mainThrustSource = null;
    this.rcsSource = null;
  }

  private ensureAudioContext(): void {
    if (!this.audioCtx) {
      try {
        const AudioClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioClass) return;
        this.audioCtx = new AudioClass();
        this.setupPersistentNoiseNodes();
      } catch {
        return;
      }
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private setupPersistentNoiseNodes(): void {
    if (!this.audioCtx) return;

    try {
      // 2-second noise buffer
      const bufferSize = this.audioCtx.sampleRate * 2;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Main thruster persistent stream: low-pass filtered rumble
      this.mainThrustSource = this.audioCtx.createBufferSource();
      this.mainThrustSource.buffer = noiseBuffer;
      this.mainThrustSource.loop = true;

      const mainFilter = this.audioCtx.createBiquadFilter();
      mainFilter.type = 'lowpass';
      mainFilter.frequency.setValueAtTime(240, this.audioCtx.currentTime);

      this.mainThrustGain = this.audioCtx.createGain();
      this.mainThrustGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);

      this.mainThrustSource.connect(mainFilter);
      mainFilter.connect(this.mainThrustGain);
      this.mainThrustGain.connect(this.audioCtx.destination);
      this.mainThrustSource.start();

      // RCS thruster persistent stream: band-pass filtered hiss
      this.rcsSource = this.audioCtx.createBufferSource();
      this.rcsSource.buffer = noiseBuffer;
      this.rcsSource.loop = true;

      const rcsFilter = this.audioCtx.createBiquadFilter();
      rcsFilter.type = 'bandpass';
      rcsFilter.frequency.setValueAtTime(1100, this.audioCtx.currentTime);
      rcsFilter.Q.setValueAtTime(2.0, this.audioCtx.currentTime);

      this.rcsGain = this.audioCtx.createGain();
      this.rcsGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);

      this.rcsSource.connect(rcsFilter);
      rcsFilter.connect(this.rcsGain);
      this.rcsGain.connect(this.audioCtx.destination);
      this.rcsSource.start();
    } catch {
      // Fail-safe
    }
  }

  private loadPreference(): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('lander_sound') === 'true';
      }
    } catch {
      // Storage unavailable or blocked
    }
    return false;
  }

  private savePreference(enabled: boolean): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('lander_sound', String(enabled));
      }
    } catch {
      // Storage unavailable or blocked
    }
  }
}
