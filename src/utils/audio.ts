class AudioSynth {
  private ctx: AudioContext | null = null;
  private enabled = false;

  constructor() {
    // Only initialize on interaction to respect browser autoplay policies
    document.addEventListener('click', () => {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.enabled = true;
      }
    }, { once: true });
  }

  private playTone(frequency: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    
    // Resume context if suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playClick() {
    this.playTone(800, 'sine', 0.05, 0.05);
  }

  playLightClick() {
    this.playTone(1200, 'triangle', 0.03, 0.02);
  }

  playSuccess() {
    if (!this.enabled || !this.ctx) return;
    // Ascending major chord
    this.playTone(440, 'sine', 0.3, 0.1); // A4
    setTimeout(() => this.playTone(554.37, 'sine', 0.3, 0.1), 100); // C#5
    setTimeout(() => this.playTone(659.25, 'sine', 0.5, 0.15), 200); // E5
  }

  playError() {
    if (!this.enabled || !this.ctx) return;
    // Low dissonant buzz
    this.playTone(150, 'sawtooth', 0.4, 0.1);
    this.playTone(155, 'sawtooth', 0.4, 0.1);
  }

  playPop() {
    this.playTone(300, 'square', 0.1, 0.05);
  }
}

export const sounds = new AudioSynth();
