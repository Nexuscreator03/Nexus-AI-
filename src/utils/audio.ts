// Futuristic Cyber Audio Synthesizer via Web Audio API (zero external assets needed)

class CyberAudio {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('nexus_sound_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    } catch {}
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('nexus_sound_enabled', String(enabled));
    } catch {}
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.04,
    delay = 0
  ) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, start);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + duration);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.01, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.01);
    } catch {}
  }

  // Standard crisp cyber tap
  public playClick() {
    this.playTone(760, 1180, 0.045, 'sine', 0.035);
  }

  // Distinct ON / OFF toggle chirp
  public playToggle(isOn: boolean) {
    if (isOn) {
      this.playTone(540, 810, 0.055, 'triangle', 0.04, 0);
      this.playTone(810, 1140, 0.065, 'sine', 0.04, 0.045);
    } else {
      this.playTone(780, 520, 0.06, 'sine', 0.035, 0);
      this.playTone(520, 360, 0.065, 'triangle', 0.03, 0.045);
    }
  }

  // Bright double-sparkle ping for copying words, snippets, code or links
  public playCopy() {
    this.playTone(1046.5, 1318.5, 0.05, 'sine', 0.035, 0);
    this.playTone(1567.98, 1760, 0.09, 'sine', 0.04, 0.045);
  }

  // Smooth UI drawer / modal / menu pop
  public playTab() {
    this.playTone(420, 680, 0.07, 'sine', 0.03, 0);
    this.playTone(680, 920, 0.05, 'triangle', 0.025, 0.035);
  }

  // Crystalline shimmer for theme changes
  public playTheme() {
    this.playTone(587.33, 587.33, 0.1, 'sine', 0.032, 0);
    this.playTone(880, 880, 0.12, 'sine', 0.032, 0.04);
    this.playTone(1174.66, 1318.51, 0.16, 'triangle', 0.03, 0.08);
  }

  // Cheerful ascending harmonic for positive feedback / favorites
  public playLike() {
    this.playTone(523.25, 659.25, 0.07, 'sine', 0.038, 0);
    this.playTone(659.25, 783.99, 0.08, 'sine', 0.038, 0.05);
    this.playTone(783.99, 1046.5, 0.14, 'triangle', 0.038, 0.1);
  }

  // Low muted double-tap for negative feedback
  public playDislike() {
    this.playTone(340, 260, 0.07, 'triangle', 0.035, 0);
    this.playTone(250, 180, 0.09, 'sine', 0.035, 0.06);
  }

  // Quick downward sweep for deleting / clearing
  public playDelete() {
    this.playTone(620, 220, 0.09, 'sawtooth', 0.022, 0);
    this.playTone(300, 140, 0.08, 'sine', 0.03, 0.04);
  }

  // Warm soft bell tone for voice/audio actions
  public playVoice() {
    this.playTone(698.46, 880, 0.09, 'sine', 0.04, 0);
    this.playTone(1046.5, 1046.5, 0.14, 'sine', 0.025, 0.05);
  }

  // Soft alert tone on errors
  public playError() {
    this.playTone(240, 190, 0.1, 'sawtooth', 0.025, 0);
    this.playTone(210, 160, 0.12, 'triangle', 0.025, 0.11);
  }

  // Message send chirp
  public playSend() {
    this.playTone(440, 920, 0.11, 'triangle', 0.055, 0);
  }

  // High-tech dual harmonic chime on response completion
  public playReceive() {
    this.playTone(659.25, 659.25, 0.22, 'sine', 0.038, 0);
    this.playTone(987.77, 987.77, 0.22, 'sine', 0.038, 0.05);
    this.playTone(1318.51, 1318.51, 0.25, 'sine', 0.038, 0.1);
  }

  // Subtle neural pulse while AI begins thinking
  public playNeuralPulse() {
    this.playTone(170, 320, 0.12, 'sawtooth', 0.018, 0);
  }
}

export const cyberAudio = new CyberAudio();
