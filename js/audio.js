/**
 * Kozminski Escape: Polowanie na ECTS
 * js/audio.js - Moduł syntezatora dźwięków oparty na Web Audio API
 * Działa bez zewnętrznych plików audio, natychmiastowo i bez opóźnień.
 */

class KozminskiAudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterGain = null;
    this.isBgmPlaying = false;
    this.bgmTimer = null;
    this.bgmNoteIndex = 0;
  }

  // Inicjalizacja AudioContext po pierwszej interakcji użytkownika (wymóg przeglądarek)
  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API nie jest wspierane w tej przeglądarce", e);
    }
  }

  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // Dźwięk podniesienia punktu ECTS (melodyjny dzwonek)
  playCollectECTS(points = 1) {
    if (this.isMuted) return;
    this.init();
    this.resumeContext();
    if (!this.ctx) return;

    const baseFreq = points > 1 ? 587.33 : 523.25; // D5 lub C5
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Dźwięk wypicia kawy w Kawiarni ALK (energetyczny akord w górę)
  playCoffeeBoost() {
    if (this.isMuted) return;
    this.init();
    this.resumeContext();
    if (!this.ctx) return;

    const notes = [329.63, 415.30, 493.88, 659.25]; // E-dur arpeggio
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + i * 0.05;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  // Dźwięk zdobycia Złotej Legitymacji (błyszcząca ochrona)
  playShield() {
    if (this.isMuted) return;
    this.init();
    this.resumeContext();
    if (!this.ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  // Dźwięk alertu: Egzaminator zauważył studenta! (napięcie)
  playAlert() {
    if (this.isMuted) return;
    this.init();
    this.resumeContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.15);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Dźwięk porażki (Kampania Wrześniowa - opadający minor)
  playGameOver() {
    if (this.isMuted) return;
    this.init();
    this.resumeContext();
    if (!this.ctx) return;

    const notes = [392.00, 369.99, 329.63, 293.66, 261.63];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.15;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.45);
    });
  }

  // Fanfara zwycięstwa (Zaliczony Semestr!)
  playVictory() {
    if (this.isMuted) return;
    this.init();
    this.resumeContext();
    if (!this.ctx) return;

    // Triumfalne nuty: C - E - G - C5 - E5
    const fanfare = [
      { f: 261.63, d: 0.15 },
      { f: 329.63, d: 0.15 },
      { f: 392.00, d: 0.15 },
      { f: 523.25, d: 0.3 },
      { f: 659.25, d: 0.6 }
    ];

    let timeAcc = this.ctx.currentTime;
    fanfare.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, timeAcc);

      gain.gain.setValueAtTime(0.18, timeAcc);
      gain.gain.exponentialRampToValueAtTime(0.001, timeAcc + note.d);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(timeAcc);
      osc.stop(timeAcc + note.d);

      timeAcc += note.d * 0.9;
    });
  }

  // Dźwięk uderzenia Artylerii ECTS / odesłania do kąta (gwizd pocisku + eksplozja + komiczny dzwonek)
  playArtilleryStrike() {
    if (this.isMuted) return;
    this.init();
    this.resumeContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Opadający gwizd artylerii
    const whistleOsc = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();
    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(1400, now);
    whistleOsc.frequency.exponentialRampToValueAtTime(160, now + 0.35);

    whistleGain.gain.setValueAtTime(0.25, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    whistleOsc.connect(whistleGain);
    whistleGain.connect(this.masterGain);
    whistleOsc.start(now);
    whistleOsc.stop(now + 0.35);

    // 2. Eksplozja basowa (uderzenie w cel)
    const boomOsc = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boomOsc.type = 'sawtooth';
    boomOsc.frequency.setValueAtTime(120, now + 0.32);
    boomOsc.frequency.exponentialRampToValueAtTime(30, now + 0.7);

    boomGain.gain.setValueAtTime(0.4, now + 0.32);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    boomOsc.connect(boomGain);
    boomGain.connect(this.masterGain);
    boomOsc.start(now + 0.32);
    boomOsc.stop(now + 0.7);

    // 3. Komiczne gwiazdki / dzwonki ogłuszenia ("stoję w kącie")
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const bellOsc = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      const bellTime = now + 0.6 + idx * 0.1;

      bellOsc.type = 'triangle';
      bellOsc.frequency.setValueAtTime(freq, bellTime);

      bellGain.gain.setValueAtTime(0.2, bellTime);
      bellGain.gain.exponentialRampToValueAtTime(0.001, bellTime + 0.25);

      bellOsc.connect(bellGain);
      bellGain.connect(this.masterGain);
      bellOsc.start(bellTime);
      bellOsc.stop(bellTime + 0.25);
    });
  }
}

// Globalna instancja audio
window.KozminskiAudio = new KozminskiAudioManager();
