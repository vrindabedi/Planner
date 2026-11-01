/**
 * Student Design Studio — Main Coordinator
 * Manages Auth / Guest Sessions, Smooth Scrolling Notion Page, and Alarm Watcher.
 */

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  // Auto tooltip: every button shows what it does on hover
  document.querySelectorAll('button').forEach(btn => {
    if (!btn.title && !btn.getAttribute('aria-label')) {
      const text = btn.textContent.trim();
      if (text) btn.title = text;
    }
  });

  // 1. Check or initialize active user / guest session
  const user = await API.getCurrentUser();
  updateUserInterface(user);

  // 2. Fetch workspace state for this user (BLANK by default for clean canvas!)
  const state = await API.fetchAll();

  // 3. Initialize components
  NotionHeader.init(state.profile);
  DesktopPlanner.init(state.tasks);
  EmbeddedMediaBox.init(state.mediaSettings);
  KeepNotes.init(state.notes);
  FocusTimer.init();
  WeeklyStats.init();

  // 4. Initialize Modals and Listeners
  initAuthModal();
  initAlarmModalHandlers();
  initTaskDetailModal();
  initTemplateActions();
  initSmoothScrollNav();
  startAlarmWatcher();

  // Test Alarm Button in Header
  const testAlarmBtn = document.getElementById('testAlarmHeaderBtn');
  if (testAlarmBtn) {
    testAlarmBtn.addEventListener('click', () => {
      AudioAlarm.testSound();
    });
  }

  console.log('✨ Notion Workspace ready for:', user.name || 'Student');
});

// Update User display pill in top bar
function updateUserInterface(user) {
  const pill = document.getElementById('userProfilePill');
  const nameLabel = document.getElementById('userPillName');
  if (nameLabel) {
    nameLabel.textContent = user.isGuest ? 'Guest User' : (user.name || user.email);
  }
}

// 1. Authentication & Guest Modal Logic
function initAuthModal() {
  const authModal = document.getElementById('authModal');
  const openAuthBtn = document.getElementById('userProfilePill');
  const closeAuthBtn = document.getElementById('closeAuthModalBtn');
  const submitAuthBtn = document.getElementById('submitAuthBtn');
  const guestBtn = document.getElementById('continueGuestBtn');

  const emailInput = document.getElementById('authEmailInput');
  const nameInput = document.getElementById('authNameInput');

  if (openAuthBtn && authModal) {
    openAuthBtn.addEventListener('click', () => authModal.classList.remove('hidden'));
  }

  if (closeAuthBtn && authModal) {
    closeAuthBtn.addEventListener('click', () => authModal.classList.add('hidden'));
  }

  if (guestBtn) {
    guestBtn.addEventListener('click', async () => {
      const guest = await API.continueAsGuest();
      updateUserInterface(guest);
      if (authModal) authModal.classList.add('hidden');
      window.location.reload();
    });
  }

  if (submitAuthBtn) {
    submitAuthBtn.addEventListener('click', async () => {
      const email = emailInput?.value.trim();
      const name = nameInput?.value.trim();
      if (!email) {
        alert('Please enter your email.');
        return;
      }

      const res = await API.login(email);
      if (res.success) {
        updateUserInterface(res.user);
        if (authModal) authModal.classList.add('hidden');
        window.location.reload();
      }
    });
  }
}

// 2. Smooth Scroll Navigation (No artificial hidden tabs)
function initSmoothScrollNav() {
  document.querySelectorAll('.scroll-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// 3. Demo Template Loader & Clear Canvas
function initTemplateActions() {
  const loadDemoBtn = document.getElementById('loadDemoTemplateBtn');
  const clearCanvasBtn = document.getElementById('clearWorkspaceBtn');

  if (loadDemoBtn) {
    loadDemoBtn.addEventListener('click', async () => {
      if (confirm('Load sample tasks and notes for inspiration?')) {
        await API.loadDemoTemplate();
        window.location.reload();
      }
    });
  }

  if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener('click', async () => {
      if (confirm('Clear all tasks and notes to start completely blank?')) {
        await API.clearWorkspace();
        window.location.reload();
      }
    });
  }
}

// 4. Background Alarm Watcher Loop (Runs every 1 second)
function startAlarmWatcher() {
  setInterval(() => {
    if (AudioAlarm.isRinging) return;
    const now = Date.now();

    DesktopPlanner.tasks.forEach(t => {
      if (t.alarmTime && !t.completed && !t.alarmDismissed) {
        const ms = new Date(t.alarmTime).getTime();
        if (now >= ms) AudioAlarm.startRinging(t);
      }
    });

    KeepNotes.notes.forEach(n => {
      if (n.alarmTime && !n.alarmDismissed) {
        const ms = new Date(n.alarmTime).getTime();
        if (now >= ms) AudioAlarm.startRinging(n);
      }
    });
  }, 1000);

  AudioAlarm.initListeners((item) => {
    if (item.id.startsWith('task-')) {
      API.updateTask(item.id, { alarmTime: item.alarmTime, alarmRepeat: item.alarmRepeat, alarmDismissed: item.alarmDismissed });
      DesktopPlanner.renderTaskColumns();
    } else if (item.id.startsWith('note-')) {
      API.updateNote(item.id, { alarmTime: item.alarmTime, alarmRepeat: item.alarmRepeat, alarmDismissed: item.alarmDismissed });
      KeepNotes.render();
    }
  });
}

// Modal for picking alarm times
window.AudioAlarmModal = {
  currentTarget: null,

  open(type, id, title, existingIsoTime, mode = 'alarm') {
    this.currentTarget = { type, id, mode };
    const modal = document.getElementById('alarmPickerModal');
    const label = document.getElementById('alarmTargetItemLabel');
    const input = document.getElementById('customAlarmDateTimeInput');
    const repeatSelect = document.getElementById('customAlarmRepeatSelect');
    const header = modal.querySelector('h4');

    const isReschedule = mode === 'reschedule';
    if (header) header.textContent = isReschedule ? 'Reschedule Task' : 'Schedule Reminder Alarm';
    if (label) label.textContent = `Target: "${title || 'Item'}"`;
    if (input) {
      input.type = isReschedule ? 'date' : 'datetime-local';
      const defaultDate = existingIsoTime ? new Date(existingIsoTime) : new Date(Date.now() + 15 * 60 * 1000);
      input.value = this.formatDateTimeLocal(defaultDate);
    }

    if (repeatSelect) {
      let existingRepeat = 'none';
      if (type === 'task') {
        const task = DesktopPlanner.tasks.find(t => t.id === id);
        if (task) existingRepeat = task.alarmRepeat || 'none';
      } else if (type === 'note') {
        const note = KeepNotes.notes.find(n => n.id === id);
        if (note) existingRepeat = note.alarmRepeat || 'none';
      }
      repeatSelect.value = existingRepeat;
    }

    if (modal) modal.classList.remove('hidden');
  },

  formatDateTimeLocal(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
};

// Bind task detail modal
function initTaskDetailModal() {
  const modal = document.getElementById('taskDetailModal');
  const closeBtn = document.getElementById('closeTaskDetailBtn');
  const saveBtn = document.getElementById('saveTaskDetailBtn');
  const deleteBtn = document.getElementById('deleteTaskFromDetailBtn');

  if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  if (saveBtn) saveBtn.addEventListener('click', () => DesktopPlanner.saveTaskDetail());
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const id = document.getElementById('tdTaskId').value;
      if (id && confirm('Delete this task?')) {
        DesktopPlanner.deleteTask(id);
        modal.classList.add('hidden');
      }
    });
  }
  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

function initAlarmModalHandlers() {
  const modal = document.getElementById('alarmPickerModal');
  const closeBtn = document.getElementById('closeAlarmPickerBtn');
  const saveBtn = document.getElementById('saveAlarmSettingBtn');
  const clearBtn = document.getElementById('clearCurrentAlarmBtn');
  const input = document.getElementById('customAlarmDateTimeInput');

  if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

  document.querySelectorAll('.quick-alarm-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.minutes, 10);
      const targetDate = new Date(Date.now() + mins * 60 * 1000);
      if (input) input.value = window.AudioAlarmModal.formatDateTimeLocal(targetDate);
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const target = window.AudioAlarmModal.currentTarget;
      if (!target || !input || !input.value) return;
      const isoTime = new Date(input.value).toISOString();
      const repeatSelect = document.getElementById('customAlarmRepeatSelect');
      const alarmRepeat = repeatSelect ? repeatSelect.value : 'none';

      if (target.type === 'task') {
        const task = DesktopPlanner.tasks.find(t => t.id === target.id);
        if (task) {
          if (target.mode === 'reschedule') {
            task.deadline = isoTime;
            task.alarmDismissed = false;
            await API.updateTask(target.id, { deadline: isoTime });
          } else {
            task.alarmTime = isoTime;
            task.alarmRepeat = alarmRepeat;
            task.alarmDismissed = false;
            await API.updateTask(target.id, { alarmTime: isoTime, alarmRepeat: alarmRepeat, alarmDismissed: false });
          }
          DesktopPlanner.renderTaskColumns();
        }
      } else if (target.type === 'note') {
        const note = KeepNotes.notes.find(n => n.id === target.id);
        if (note) {
          note.alarmTime = isoTime;
          note.alarmRepeat = alarmRepeat;
          note.alarmDismissed = false;
          await API.updateNote(target.id, { alarmTime: isoTime, alarmRepeat: alarmRepeat, alarmDismissed: false });
          KeepNotes.render();
        }
      }
      if (modal) modal.classList.add('hidden');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const target = window.AudioAlarmModal.currentTarget;
      if (!target) return;
      if (target.type === 'task') {
        const task = DesktopPlanner.tasks.find(t => t.id === target.id);
        if (task) {
          if (target.mode === 'reschedule') {
            task.deadline = null;
            await API.updateTask(target.id, { deadline: null });
          } else {
            task.alarmTime = null;
            await API.updateTask(target.id, { alarmTime: null });
          }
          DesktopPlanner.renderTaskColumns();
        }
      } else if (target.type === 'note') {
        const note = KeepNotes.notes.find(n => n.id === target.id);
        if (note) {
          note.alarmTime = null;
          await API.updateNote(target.id, { alarmTime: null });
          KeepNotes.render();
        }
      }
      if (modal) modal.classList.add('hidden');
    });
  }
}
