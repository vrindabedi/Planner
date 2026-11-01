/**
 * Focus Timer & Stopwatch Module
 * Features:
 * 1. Two modes: Stopwatch & Timer (customizable duration)
 * 2. Dynamic Subject Tags with Tag Deletion and selection
 * 3. Smart Pause tracking:
 *    - Displays exact duration of each pause
 *    - Pauses under 1 minute (< 60s) are not counted towards pause count
 * 4. Automatic & manual session logging synced to Weekly & Monthly Progress
 */

const FocusTimer = {
  mode: 'timer', // 'timer' | 'stopwatch'
  timerDurationMins: 25,
  remainingSeconds: 25 * 60,
  stopwatchElapsedSeconds: 0,
  isRunning: false,
  intervalId: null,

  // Pause duration & threshold tracking
  pauseCount: 0,
  totalPausedSeconds: 0,
  pauseStartTime: null,
  pauseTickerId: null,
  currentPauseElapsedSeconds: 0,

  activeSubject: '#Academic',
  availableTags: ['#Academic', '#Design', '#DataStructures', '#Math', '#Extracurricular'],

  init() {
    this.loadPersistedState();
    this.render();
    this.bindEvents();
  },

  loadPersistedState() {
    const savedTags = localStorage.getItem('studio_subject_tags');
    if (savedTags) {
      try {
        const parsed = JSON.parse(savedTags);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.availableTags = parsed;
        }
      } catch (e) {}
    }
    const savedActive = localStorage.getItem('studio_active_subject_tag');
    if (savedActive && this.availableTags.includes(savedActive)) {
      this.activeSubject = savedActive;
    } else if (this.availableTags.length > 0) {
      this.activeSubject = this.availableTags[0];
    }

    const savedDuration = parseInt(localStorage.getItem('studio_timer_custom_mins'), 10);
    if (savedDuration && savedDuration > 0) {
      this.timerDurationMins = savedDuration;
      this.remainingSeconds = savedDuration * 60;
    }
  },

  savePersistedState() {
    localStorage.setItem('studio_subject_tags', JSON.stringify(this.availableTags));
    localStorage.setItem('studio_active_subject_tag', this.activeSubject);
    localStorage.setItem('studio_timer_custom_mins', this.timerDurationMins);
  },

  finalizeCurrentPause() {
    if (this.pauseStartTime) {
      const elapsedPauseSec = Math.floor((Date.now() - this.pauseStartTime) / 1000);
      if (this.pauseTickerId) {
        clearInterval(this.pauseTickerId);
        this.pauseTickerId = null;
      }
      this.pauseStartTime = null;
      this.currentPauseElapsedSeconds = 0;

      // Rule: if pause was less than 1 minute (< 60s), do not count that pause at all
      if (elapsedPauseSec >= 60) {
        this.pauseCount++;
        this.totalPausedSeconds += elapsedPauseSec;
      }
    }
  },

  render() {
    const displayEl = document.getElementById('focusDisplayTime');
    const modeTimerBtn = document.getElementById('modeBtnTimer');
    const modeStopwatchBtn = document.getElementById('modeBtnStopwatch');
    const timerControls = document.getElementById('timerSpecificControls');
    const toggleText = document.getElementById('focusToggleBtnText');
    const toggleIcon = document.getElementById('focusToggleBtnIcon');
    const statusLabel = document.getElementById('focusStatusLabel');
    const customMinsInput = document.getElementById('customTimerMinsInput');

    // 1. Mode Buttons
    const activeTabClass = 'bg-white text-stone-900 font-bold shadow-sm';
    const inactiveTabClass = 'text-stone-300 hover:text-white';

    if (modeTimerBtn) modeTimerBtn.className = `px-4 py-1.5 rounded-full text-xs transition ${this.mode === 'timer' ? activeTabClass : inactiveTabClass}`;
    if (modeStopwatchBtn) modeStopwatchBtn.className = `px-4 py-1.5 rounded-full text-xs transition ${this.mode === 'stopwatch' ? activeTabClass : inactiveTabClass}`;

    // 2. Timer-specific controls visibility
    if (timerControls) {
      timerControls.classList.toggle('hidden', this.mode !== 'timer');
    }
    if (customMinsInput && document.activeElement !== customMinsInput) {
      customMinsInput.value = this.timerDurationMins;
    }

    // 3. Time Display
    if (displayEl) {
      if (this.mode === 'timer') {
        const mins = Math.floor(this.remainingSeconds / 60);
        const secs = this.remainingSeconds % 60;
        displayEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      } else {
        const hrs = Math.floor(this.stopwatchElapsedSeconds / 3600);
        const mins = Math.floor((this.stopwatchElapsedSeconds % 3600) / 60);
        const secs = this.stopwatchElapsedSeconds % 60;
        if (hrs > 0) {
          displayEl.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
          displayEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      }
    }

    // 4. Button & Status
    if (toggleText) toggleText.textContent = this.isRunning ? 'Pause' : 'Start Focus';
    if (toggleIcon) toggleIcon.setAttribute('data-lucide', this.isRunning ? 'pause' : 'play');
    if (statusLabel) {
      if (this.isRunning) {
        statusLabel.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>In Focus`;
      } else if (this.pauseStartTime) {
        const pm = Math.floor(this.currentPauseElapsedSeconds / 60);
        const ps = this.currentPauseElapsedSeconds % 60;
        statusLabel.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse mr-1.5"></span>Paused (${pm}m ${ps}s)`;
      } else if (this.pauseCount > 0) {
        statusLabel.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5"></span>Paused (${this.pauseCount})`;
      } else {
        statusLabel.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-stone-400 mr-1.5"></span>Ready`;
      }
    }

    // 5. Update Pause Badge with live duration & threshold indicator
    this.updatePauseBadge();

    // 6. Render Subject Tags list
    this.renderSubjectTags();
    lucide.createIcons();
  },

  updatePauseBadge() {
    const pauseBadge = document.getElementById('focusPauseCountBadge');
    if (!pauseBadge) return;

    if (this.pauseStartTime) {
      const pm = Math.floor(this.currentPauseElapsedSeconds / 60);
      const ps = this.currentPauseElapsedSeconds % 60;
      const formatted = `${pm}m ${String(ps).padStart(2, '0')}s`;

      if (this.currentPauseElapsedSeconds < 60) {
        pauseBadge.innerHTML = `<span class="text-amber-300 font-medium">Paused: ${formatted}</span> <span class="text-[10px] text-stone-400">(<1m not counted)</span>`;
        pauseBadge.title = `Current pause is ${this.currentPauseElapsedSeconds}s. Pauses under 1 minute are not counted.`;
      } else {
        pauseBadge.innerHTML = `<span class="text-amber-400 font-bold">Paused: ${formatted}</span> <span class="text-[10px] text-emerald-400">(counted)</span>`;
        pauseBadge.title = `Current pause duration ${formatted} meets the 1 minute threshold and will be counted.`;
      }
    } else {
      if (this.pauseCount > 0) {
        const totalMins = Math.round(this.totalPausedSeconds / 60);
        pauseBadge.textContent = `${this.pauseCount} pause${this.pauseCount === 1 ? '' : 's'}${totalMins > 0 ? ` (${totalMins}m)` : ''}`;
        pauseBadge.title = `${this.pauseCount} qualified pause(s) of 1m or longer (total: ${totalMins}m paused).`;
      } else {
        pauseBadge.textContent = `0 pauses`;
        pauseBadge.title = `No qualified pauses (>1m) in current session.`;
      }
    }
  },

  renderSubjectTags() {
    const listEl = document.getElementById('subjectTagsContainer');
    if (!listEl) return;

    listEl.innerHTML = this.availableTags.map(tag => {
      const isSelected = tag === this.activeSubject;
      return `
        <div class="inline-flex items-center rounded-full text-xs font-medium transition select-none group/tag ${
          isSelected
            ? 'bg-white text-stone-900 font-bold ring-2 ring-white/60 shadow-xs'
            : 'bg-white/10 hover:bg-white/20 text-stone-200 border border-white/15'
        }">
          <button
            type="button"
            class="focus-subject-tag-pill px-2.5 py-1 cursor-pointer"
            data-tag="${tag}"
          >
            ${tag}
          </button>
          <button
            type="button"
            class="delete-subject-tag-btn pr-2 pl-0.5 py-1 text-stone-400 hover:text-rose-400 cursor-pointer transition opacity-60 group-hover/tag:opacity-100"
            data-tag="${tag}"
            title="Delete tag ${tag}"
          >
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </div>
      `;
    }).join('');

    // Active subject preview label
    const activeLabelEl = document.getElementById('activeSubjectDisplayLabel');
    if (activeLabelEl) {
      activeLabelEl.textContent = this.activeSubject;
    }

    // Bind pill selection clicks
    listEl.querySelectorAll('.focus-subject-tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeSubject = btn.dataset.tag;
        this.savePersistedState();
        this.render();
      });
    });

    // Bind tag deletion clicks
    listEl.querySelectorAll('.delete-subject-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagToDelete = btn.dataset.tag;
        this.deleteSubjectTag(tagToDelete);
      });
    });
  },

  deleteSubjectTag(tag) {
    if (this.availableTags.length <= 1) {
      // Keep at least one tag
      this.availableTags = ['#General'];
      this.activeSubject = '#General';
    } else {
      this.availableTags = this.availableTags.filter(t => t !== tag);
      if (this.activeSubject === tag) {
        this.activeSubject = this.availableTags[0];
      }
    }
    this.savePersistedState();
    this.render();
  },

  bindEvents() {
    // Mode Switcher: Timer vs Stopwatch
    document.getElementById('modeBtnTimer')?.addEventListener('click', () => this.switchMode('timer'));
    document.getElementById('modeBtnStopwatch')?.addEventListener('click', () => this.switchMode('stopwatch'));

    // Start / Pause
    document.getElementById('focusToggleBtn')?.addEventListener('click', () => {
      if (this.isRunning) this.pause();
      else this.start();
    });

    // Reset
    document.getElementById('focusResetBtn')?.addEventListener('click', () => this.reset());

    // Save Session Button
    document.getElementById('focusSaveSessionBtn')?.addEventListener('click', () => this.saveCurrentSession());

    // Preset Duration Buttons (15m, 25m, 45m, 60m, 90m)
    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.mins, 10);
        if (mins && mins > 0) {
          this.setTimerDuration(mins);
        }
      });
    });

    // Custom Duration Input / Apply
    const customInput = document.getElementById('customTimerMinsInput');
    const applyBtn = document.getElementById('applyCustomTimerBtn');

    const handleCustomTimeApply = () => {
      if (!customInput) return;
      const mins = parseInt(customInput.value, 10);
      if (mins && mins > 0) {
        this.setTimerDuration(mins);
      }
    };

    if (applyBtn) applyBtn.addEventListener('click', handleCustomTimeApply);
    if (customInput) {
      customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCustomTimeApply();
      });
    }

    // Add New Subject Tag
    const newTagInput = document.getElementById('newSubjectTagInput');
    const addTagBtn = document.getElementById('addNewSubjectTagBtn');

    const handleAddNewTag = () => {
      if (!newTagInput) return;
      let val = newTagInput.value.trim();
      if (!val) return;
      if (!val.startsWith('#')) val = '#' + val;
      if (!this.availableTags.includes(val)) {
        this.availableTags.push(val);
      }
      this.activeSubject = val;
      this.savePersistedState();
      newTagInput.value = '';
      this.render();
    };

    if (addTagBtn) addTagBtn.addEventListener('click', handleAddNewTag);
    if (newTagInput) {
      newTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddNewTag();
        }
      });
    }
  },

  switchMode(mode) {
    if (this.mode === mode) return;
    this.finalizeCurrentPause();
    this.pause();
    this.mode = mode;
    this.pauseCount = 0;
    this.totalPausedSeconds = 0;
    if (mode === 'timer') {
      this.remainingSeconds = this.timerDurationMins * 60;
    } else {
      this.stopwatchElapsedSeconds = 0;
    }
    this.render();
  },

  setTimerDuration(mins) {
    this.finalizeCurrentPause();
    this.pause();
    this.timerDurationMins = mins;
    this.remainingSeconds = mins * 60;
    this.pauseCount = 0;
    this.totalPausedSeconds = 0;
    this.savePersistedState();
    this.render();
  },

  start() {
    if (this.isRunning) return;

    // Resuming from pause: check pause duration
    this.finalizeCurrentPause();

    this.isRunning = true;
    this.render();

    this.intervalId = setInterval(() => {
      if (this.mode === 'timer') {
        if (this.remainingSeconds > 0) {
          this.remainingSeconds--;
          this.render();
        } else {
          this.completeSession();
        }
      } else {
        this.stopwatchElapsedSeconds++;
        this.render();
      }
    }, 1000);
  },

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Start tracking pause duration live
    this.pauseStartTime = Date.now();
    this.currentPauseElapsedSeconds = 0;

    if (this.pauseTickerId) clearInterval(this.pauseTickerId);
    this.pauseTickerId = setInterval(() => {
      if (this.pauseStartTime) {
        this.currentPauseElapsedSeconds = Math.floor((Date.now() - this.pauseStartTime) / 1000);
        this.updatePauseBadge();
      }
    }, 1000);

    this.render();
  },

  reset() {
    this.finalizeCurrentPause();
    this.pause();
    this.pauseCount = 0;
    this.totalPausedSeconds = 0;
    if (this.mode === 'timer') {
      this.remainingSeconds = this.timerDurationMins * 60;
    } else {
      this.stopwatchElapsedSeconds = 0;
    }
    this.render();
  },

  async completeSession() {
    this.finalizeCurrentPause();
    this.pause();

    // Play completion chime
    if (window.AudioAlarm && AudioAlarm.playBeep) {
      AudioAlarm.playBeep(880, 0.2, 0);
      AudioAlarm.playBeep(1046.5, 0.35, 0.25);
    }

    const minutesStudied = Math.max(1, Math.round(this.timerDurationMins));
    await this.recordSession(minutesStudied);

    this.remainingSeconds = this.timerDurationMins * 60;
    this.pauseCount = 0;
    this.totalPausedSeconds = 0;
    this.render();
  },

  async saveCurrentSession() {
    this.finalizeCurrentPause();

    let secondsStudied = 0;
    if (this.mode === 'timer') {
      secondsStudied = (this.timerDurationMins * 60) - this.remainingSeconds;
    } else {
      secondsStudied = this.stopwatchElapsedSeconds;
    }

    if (secondsStudied < 15) {
      alert('Session duration is less than 15 seconds. Keep studying a bit more to log focus time!');
      return;
    }

    const minutesStudied = Math.max(1, Math.round(secondsStudied / 60));
    this.pause();
    await this.recordSession(minutesStudied, secondsStudied);

    this.reset();
  },

  async recordSession(minutes, seconds = null) {
    const sessionData = {
      date: new Date().toISOString().split('T')[0],
      minutes: minutes,
      durationSeconds: seconds || (minutes * 60),
      subject: this.activeSubject || '#Academic',
      mode: this.mode,
      pauseCount: this.pauseCount,
      pausedSeconds: this.totalPausedSeconds,
      timestamp: new Date().toISOString()
    };

    await API.logStudySession(sessionData);

    const toast = document.getElementById('globalToast');
    if (toast) {
      const pauseInfo = this.pauseCount > 0 ? ` (${this.pauseCount} pauses, ${Math.round(this.totalPausedSeconds / 60)}m paused)` : '';
      toast.textContent = `Logged ${minutes}m of ${sessionData.subject}${pauseInfo} to progress!`;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3500);
    }

    if (window.WeeklyStats && WeeklyStats.refresh) {
      WeeklyStats.refresh();
    }
  }
};
