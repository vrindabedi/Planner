/**
 * Audio Alarm Engine
 * Synthesizes audible alarm rings via Web Audio API + HTML5 Audio fallback,
 * handles alarm modals, snoozing, dismissals, and recurring reminders.
 */

// Generate a clean, loud, standalone 8-bit PCM WAV beep data URI as an emergency/autoplay-safe fallback
function generateAlarmWavUri() {
  try {
    const sampleRate = 8000;
    const duration = 1.0;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Uint8Array(44 + numSamples);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
    };
    const writeUint32 = (offset, val) => {
      buffer[offset] = val & 0xff;
      buffer[offset + 1] = (val >> 8) & 0xff;
      buffer[offset + 2] = (val >> 16) & 0xff;
      buffer[offset + 3] = (val >> 24) & 0xff;
    };
    const writeUint16 = (offset, val) => {
      buffer[offset] = val & 0xff;
      buffer[offset + 1] = (val >> 8) & 0xff;
    };

    writeString(0, 'RIFF');
    writeUint32(4, 36 + numSamples);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    writeUint32(16, 16);
    writeUint16(20, 1);
    writeUint16(22, 1);
    writeUint32(24, sampleRate);
    writeUint32(28, sampleRate);
    writeUint16(32, 1);
    writeUint16(34, 8);
    writeString(36, 'data');
    writeUint32(40, numSamples);

    // Two distinct loud beeps
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 128;
      if ((t >= 0.0 && t < 0.16) || (t >= 0.24 && t < 0.40)) {
        const val = Math.sin(2 * Math.PI * 880 * t) > 0 ? 80 : -80;
        sample = 128 + val;
      }
      buffer[44 + i] = sample;
    }

    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  } catch (err) {
    console.warn('WAV generation fallback failed:', err);
    return null;
  }
}

const AudioAlarm = {
  ctx: null,
  intervalId: null,
  isRinging: false,
  activeItem: null,
  fallbackAudio: null,

  computeNextRecurrence(baseDateIso, frequency) {
    if (!frequency || frequency === 'none') return null;
    const current = baseDateIso ? new Date(baseDateIso) : new Date();
    let next = new Date(Math.max(Date.now(), current.getTime()));
    switch (frequency) {
      case 'every15m':
        next.setMinutes(next.getMinutes() + 15);
        break;
      case 'hourly':
        next.setHours(next.getHours() + 1);
        break;
      case 'every4h':
        next.setHours(next.getHours() + 4);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'every2days':
        next.setDate(next.getDate() + 2);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        return null;
    }
    return next.toISOString();
  },

  formatRepeatLabel(freq) {
    const map = {
      'none': 'Once',
      'every15m': 'Every 15m',
      'hourly': 'Hourly',
      'every4h': 'Every 4h',
      'daily': 'Daily',
      'every2days': 'Every 2 days',
      'weekly': 'Weekly',
      'monthly': 'Monthly'
    };
    return map[freq] || freq;
  },

  initAudio() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('AudioContext initialization note:', e);
    }

    if (!this.fallbackAudio) {
      const uri = generateAlarmWavUri();
      if (uri) {
        this.fallbackAudio = new Audio(uri);
        this.fallbackAudio.preload = 'auto';
      }
    }
  },

  playBeep(freq, duration, delay = 0) {
    try {
      this.initAudio();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const startTime = now + delay;
      const stopTime = startTime + duration;

      // Dual oscillator for rich, crisp alarm sound
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, startTime);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq * 1.5, startTime);

      gain.gain.setValueAtTime(0.7, startTime);
      gain.gain.setValueAtTime(0.7, stopTime - 0.02);
      gain.gain.linearRampToValueAtTime(0.001, stopTime);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(stopTime);
      osc2.stop(stopTime);
    } catch (e) {
      console.warn('Web Audio synthesis note:', e);
    }
  },

  startRinging(item) {
    this.activeItem = item || { title: 'Studio Alarm Reminder' };
    this.isRinging = true;
    this.initAudio();

    // Show Alarm Modal
    const modal = document.getElementById('alarmModal');
    const titleEl = document.getElementById('alarmModalTitle');
    const timeEl = document.getElementById('alarmModalTime');

    if (titleEl) titleEl.textContent = this.activeItem.title || 'Studio Alarm Reminder';
    const repeatNote = (this.activeItem.alarmRepeat && this.activeItem.alarmRepeat !== 'none') ? ` • Repeats ${this.formatRepeatLabel(this.activeItem.alarmRepeat)}` : '';
    if (timeEl) timeEl.textContent = `Triggered: ${this.activeItem.alarmTime ? new Date(this.activeItem.alarmTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}${repeatNote}`;
    if (modal) modal.classList.remove('hidden');

    // Ring alarm pattern repeatedly: 4 crisp beeps per pulse
    const ringPattern = () => {
      let webAudioSucceeded = false;
      if (this.ctx && this.ctx.state === 'running') {
        this.playBeep(880, 0.12, 0);
        this.playBeep(880, 0.12, 0.18);
        this.playBeep(1174.66, 0.14, 0.36);
        this.playBeep(1174.66, 0.16, 0.54);
        webAudioSucceeded = true;
      }

      // If Web Audio was blocked or suspended by autoplay, use HTML5 Audio element
      if (!webAudioSucceeded && this.fallbackAudio) {
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.play().catch(err => {
          console.warn('Autoplay waiting for user gesture:', err);
        });
      }
    };

    ringPattern();
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(ringPattern, 1200);
  },

  stopRinging() {
    this.isRinging = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
      } catch (e) {}
    }
    const modal = document.getElementById('alarmModal');
    if (modal) modal.classList.add('hidden');
  },

  testSound() {
    this.initAudio();
    this.startRinging({
      id: 'test-alarm',
      title: 'Reminder Alarm Test',
      alarmTime: new Date().toISOString(),
      alarmRepeat: 'none'
    });
  },

  initListeners(onStateChange) {
    const dismissBtn = document.getElementById('alarmDismissBtn');
    const snoozeBtn = document.getElementById('alarmSnoozeBtn');

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (this.activeItem) {
          const nextIso = this.computeNextRecurrence(this.activeItem.alarmTime, this.activeItem.alarmRepeat);
          if (nextIso) {
            this.activeItem.alarmTime = nextIso;
            this.activeItem.alarmDismissed = false;
          } else {
            this.activeItem.alarmDismissed = true;
          }
          if (onStateChange) onStateChange(this.activeItem, 'dismiss');
        }
        this.stopRinging();
      });
    }

    if (snoozeBtn) {
      snoozeBtn.addEventListener('click', () => {
        if (this.activeItem) {
          const snoozedTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          this.activeItem.alarmTime = snoozedTime;
          this.activeItem.alarmDismissed = false;
          if (onStateChange) onStateChange(this.activeItem, 'snooze');
        }
        this.stopRinging();
      });
    }

    // Auto unlock audio on any first user gesture anywhere on the window
    const unlock = () => this.initAudio();
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
      window.addEventListener(evt, unlock, { once: false, passive: true });
    });
  }
};

if (typeof window !== 'undefined') {
  window.AudioAlarm = AudioAlarm;
}
