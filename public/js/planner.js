/**
 * Desktop Planner & Calendar Module
 * Exactly replicates the minimalist design of Image 3, scaled for Desktop:
 * - Minimalist "Planner" header with action icons (play, scan, sync, timer)
 * - Centered "October 2026"
 * - Clean horizontal weekdays strip (Mo 19 ... Su 25 circled with thin blue ring)
 * - Gray pill handle divider
 * - Bold "From previous days" title and "11h ✓21" metrics
 * - Clean task items with rounded-square checkboxes, subtle subtext, and right-side durations (1h, -)
 * - 3 Columns on desktop: Academic, Extracurriculars, Miscellaneous
 * - Zero emojis!
 */

const DesktopPlanner = {
  tasks: [],
  selectedDate: new Date().toISOString().slice(0, 10),
  currentMonthDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  activeWeekStartDate: (() => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun, 1=Mon...
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  })(),
  calendarViewMode: 'weekly',
  draggedTaskId: null,

  init(tasks) {
    this.tasks = tasks || [];
    this.renderHeaderAndCalendar();
    this.renderTaskColumns();
    this.bindEvents();
  },

  renderHeaderAndCalendar() {
    const monthYearEl = document.getElementById('plannerMonthYear');
    const daysStripEl = document.getElementById('plannerWeekStrip');
    const monthGridEl = document.getElementById('plannerMonthGrid');

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = monthNames[this.currentMonthDate.getMonth()];
    const currentYear = this.currentMonthDate.getFullYear();

    if (monthYearEl) {
      monthYearEl.textContent = `${currentMonth} ${currentYear}`;
    }

    // Toggle between Weekly strip and Monthly calendar
    if (this.calendarViewMode === 'weekly') {
      if (daysStripEl) {
        daysStripEl.classList.remove('hidden');
        daysStripEl.innerHTML = '';
        const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

        for (let i = 0; i < 7; i++) {
          const d = new Date(this.activeWeekStartDate);
          d.setDate(this.activeWeekStartDate.getDate() + i);

          const isoDate = this.formatIsoDate(d);
          const dayNumber = d.getDate();
          const dayLabel = dayLabels[i];
          const isSelected = isoDate === this.selectedDate;

          const dayTile = document.createElement('div');
          dayTile.className = 'flex flex-col items-center justify-center cursor-pointer select-none py-1 group';
          dayTile.innerHTML = `
            <span class="text-xs font-normal ${isSelected ? 'text-blue-600 font-semibold' : 'text-stone-400'}">${dayLabel}</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm mt-1 transition ${
              isSelected
                ? 'border-2 border-blue-600 text-blue-600 font-bold'
                : 'text-stone-800 font-medium group-hover:text-blue-600'
            }">
              ${dayNumber}
            </div>
          `;

          dayTile.addEventListener('click', () => {
            this.selectedDate = isoDate;
            this.renderHeaderAndCalendar();
            this.renderTaskColumns();
          });

          daysStripEl.appendChild(dayTile);
        }
      }

      if (monthGridEl) monthGridEl.classList.add('hidden');
    } else {
      // Monthly Grid
      if (daysStripEl) daysStripEl.classList.add('hidden');
      if (monthGridEl) {
        monthGridEl.classList.remove('hidden');
        this.renderMonthlyGrid();
      }
    }

    // Update Section Title & Stats matching Image 3: "From previous days" and "11h ✓21"
    const headingEl = document.getElementById('plannerSectionHeading');
    const statsEl = document.getElementById('plannerMetricsSubheader');

    if (headingEl) {
      const today = new Date().toISOString().slice(0, 10);
      headingEl.textContent = this.selectedDate === today ? 'From previous days' : `Tasks for ${this.selectedDate}`;
    }

    if (statsEl) {
      const completedCount = this.tasks.filter(t => t.completed).length;
      statsEl.innerHTML = `<span>11h</span> <span class="flex items-center gap-0.5"><i data-lucide="check" class="w-3.5 h-3.5 text-stone-700"></i> ${completedCount}</span>`;
    }

    lucide.createIcons();
  },

  renderMonthlyGrid() {
    const gridEl = document.getElementById('plannerMonthDatesGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let b = 0; b < firstDayIndex; b++) {
      const blank = document.createElement('div');
      blank.className = 'h-12';
      gridEl.appendChild(blank);
    }

    for (let d = 1; d <= totalDays; d++) {
      const cellDate = new Date(year, month, d);
      const isoDate = this.formatIsoDate(cellDate);
      const isSelected = isoDate === this.selectedDate;
      const count = this.tasks.filter(t => t.date === isoDate).length;

      const cell = document.createElement('div');
      cell.className = `h-12 p-1 rounded-xl border text-center flex flex-col items-center justify-center cursor-pointer transition ${
        isSelected ? 'border-2 border-blue-600 bg-blue-50/50 text-blue-600 font-bold' : 'border-stone-100 hover:bg-stone-50 text-stone-700'
      }`;
      cell.innerHTML = `
        <span class="text-xs">${d}</span>
        ${count > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>` : ''}
      `;
      cell.addEventListener('click', () => {
        this.selectedDate = isoDate;
        this.renderHeaderAndCalendar();
        this.renderTaskColumns();
      });
      gridEl.appendChild(cell);
    }
  },

  // Render 3 Columns on desktop: Academic, Extracurriculars, Miscellaneous
  renderTaskColumns() {
    const colAcademic = document.getElementById('tasksColAcademic');
    const colExtra = document.getElementById('tasksColExtra');
    const colMisc = document.getElementById('tasksColMisc');

    // Filter tasks for selected date (or show all if toggle active)
    let visibleTasks = this.tasks;
    if (this.selectedDate) {
      visibleTasks = this.tasks.filter(t => !t.date || t.date === this.selectedDate);
    }

    const academicTasks = visibleTasks.filter(t => t.column === 'academic');
    const extraTasks = visibleTasks.filter(t => t.column === 'extracurriculars');
    const miscTasks = visibleTasks.filter(t => t.column === 'miscellaneous');

    this.renderColumnList(colAcademic, academicTasks, 'academic');
    this.renderColumnList(colExtra, extraTasks, 'extracurriculars');
    this.renderColumnList(colMisc, miscTasks, 'miscellaneous');

    lucide.createIcons();
    this.bindTaskInteractions();
  },

  renderColumnList(containerEl, tasksList, columnKey) {
    if (!containerEl) return;

    if (tasksList.length === 0) {
      containerEl.innerHTML = `
        <div class="py-6 text-stone-400 text-xs">
          No tasks scheduled.
        </div>
      `;
      return;
    }

    // Matches Image 3 list item format:
    // [☐] Title  [weight%]  [deadline]  [repeat]  🔔
    //     Subtext (tags / deadline / repeat)
    containerEl.innerHTML = tasksList.map(t => {
      const isDone = Boolean(t.completed);
      const isAcademic = t.column === 'academic';

      // Subtext line: tags + deadline + repeat
      let subtextParts = [];
      if (t.tags && t.tags.length > 0) subtextParts.push(t.tags.join(' '));
      if (t.deadline) subtextParts.push(`Deadline ${new Date(t.deadline).toLocaleDateString()}`);
      if (t.repeat && t.repeat !== 'none') subtextParts.push(`Repeats ${t.repeat}`);
      const subtext = subtextParts.length ? subtextParts.join(' • ') : (isAcademic ? 'Assignment' : '');

      // Badges
      const weightBadge = isAcademic && t.weight ? `<span class="task-badge px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">${t.weight}%</span>` : '';
      const deadlineBadge = t.deadline ? `<span class="task-badge px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><i data-lucide="calendar" class="w-3 h-3 mr-1 inline"></i>${new Date(t.deadline).toLocaleDateString()}</span>` : '';
      const repeatBadge = t.repeat && t.repeat !== 'none' ? `<span class="task-badge px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200"><i data-lucide="refresh-ccw" class="w-3 h-3 mr-1 inline"></i>${t.repeat}</span>` : '';

      // Alarm & Reminder Badge with Exact Time and Frequency Control
      let alarmBadge = '';
      if (t.alarmTime) {
        const timeStr = new Date(t.alarmTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const freqLabel = (t.alarmRepeat && t.alarmRepeat !== 'none') ? ` • ${t.alarmRepeat}` : '';
        alarmBadge = `
          <span 
            class="task-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer hover:bg-rose-100 transition" 
            title="Reminder alarm set for ${timeStr}. Click to adjust or change frequency."
            onclick="event.stopPropagation(); DesktopPlanner.openAlarmPicker('${t.id}')"
          >
            <i data-lucide="bell" class="w-3 h-3 fill-rose-600 text-rose-600"></i>
            <span>${timeStr}${freqLabel}</span>
          </span>
        `;
      }

      return `
        <div 
          class="task-row flex items-start gap-3 py-2.5 px-2 hover:bg-stone-50 rounded-xl transition group select-none border-b border-stone-100/60"
          draggable="true"
          data-task-id="${t.id}"
        >
          <!-- Rounded Square Checkbox -->
          <div 
            class="task-check-box mt-0.5 w-5 h-5 rounded-md border ${isDone ? 'bg-blue-600 border-blue-600' : 'border-stone-300 hover:border-stone-500'} flex items-center justify-center cursor-pointer transition shrink-0"
            onclick="DesktopPlanner.toggleComplete('${t.id}')"
          >
            ${isDone ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>' : ''}
          </div>

          <!-- Title, Badges & Subtext -->
          <div class="flex-1 min-w-0 pr-2 flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <h4 class="text-sm font-medium leading-snug ${isDone ? 'line-through text-stone-400' : 'text-stone-900'} flex-1 min-w-0">
                ${this.escapeHtml(t.title)}
              </h4>
              <button class="p-1 hover:text-stone-700 rounded shrink-0" title="Edit details" onclick="DesktopPlanner.openTaskDetail('${t.id}')">
                <i data-lucide="square-pen" class="w-3 h-3"></i>
              </button>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              ${weightBadge}
              ${deadlineBadge}
              ${repeatBadge}
              ${alarmBadge}
            </div>
            ${subtext ? `<p class="text-xs text-stone-400 whitespace-pre-wrap">${this.escapeHtml(subtext)}</p>` : ''}
          </div>

          <!-- Right side: actions (always visible) -->
          <div class="flex items-center gap-1 shrink-0">
            <button class="p-1.5 hover:text-blue-600 rounded transition" title="Set Alarm / Reminder" onclick="DesktopPlanner.openAlarmPicker('${t.id}')">
              <i data-lucide="bell" class="w-3.5 h-3.5 ${t.alarmTime ? 'text-rose-500 fill-rose-500' : ''}"></i>
            </button>
            <button class="p-1.5 hover:text-stone-700 rounded transition" title="Reschedule date/time" onclick="DesktopPlanner.openReschedule('${t.id}')">
              <i data-lucide="clock" class="w-3.5 h-3.5"></i>
            </button>
            <button class="p-1.5 hover:text-rose-600 rounded transition" title="Delete task" onclick="DesktopPlanner.deleteTask('${t.id}')">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    // WEEK navigation arrows (flanking the date strip)
    document.getElementById('calPrevWeekBtn')?.addEventListener('click', () => {
      this.activeWeekStartDate = new Date(this.activeWeekStartDate);
      this.activeWeekStartDate.setDate(this.activeWeekStartDate.getDate() - 7);
      this.currentMonthDate = new Date(this.activeWeekStartDate.getFullYear(), this.activeWeekStartDate.getMonth(), 1);
      this.renderHeaderAndCalendar();
      this.renderTaskColumns();
    });

    document.getElementById('calNextWeekBtn')?.addEventListener('click', () => {
      this.activeWeekStartDate = new Date(this.activeWeekStartDate);
      this.activeWeekStartDate.setDate(this.activeWeekStartDate.getDate() + 7);
      this.currentMonthDate = new Date(this.activeWeekStartDate.getFullYear(), this.activeWeekStartDate.getMonth(), 1);
      this.renderHeaderAndCalendar();
      this.renderTaskColumns();
    });

    // MONTH navigation arrows (inside month grid panel)
    document.getElementById('calPrevMonthBtn')?.addEventListener('click', () => {
      this.currentMonthDate = new Date(this.currentMonthDate);
      this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() - 1);
      this.renderHeaderAndCalendar();
      this.renderTaskColumns();
    });

    document.getElementById('calNextMonthBtn')?.addEventListener('click', () => {
      this.currentMonthDate = new Date(this.currentMonthDate);
      this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() + 1);
      this.renderHeaderAndCalendar();
      this.renderTaskColumns();
    });

    // Toggle Weekly / Monthly View
    document.getElementById('toggleMonthViewBtn')?.addEventListener('click', () => {
      this.calendarViewMode = this.calendarViewMode === 'weekly' ? 'monthly' : 'weekly';
      const btn = document.getElementById('toggleMonthViewBtn');
      if (btn) btn.textContent = this.calendarViewMode === 'weekly' ? 'Month View' : 'Week View';
      // Show/hide week arrows based on mode
      const prevWeek = document.getElementById('calPrevWeekBtn');
      const nextWeek = document.getElementById('calNextWeekBtn');
      if (prevWeek) prevWeek.style.visibility = this.calendarViewMode === 'weekly' ? '' : 'hidden';
      if (nextWeek) nextWeek.style.visibility = this.calendarViewMode === 'weekly' ? '' : 'hidden';
      this.renderHeaderAndCalendar();
    });

    // Inline Task Creator toggles
    document.querySelectorAll('.btn-add-task-col').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.col;
        const form = document.getElementById(`inlineTaskInputRow_${col}`);
        if (form) {
          form.classList.toggle('hidden');
          const input = form.querySelector('.input-task-title');
          if (input) input.focus();
        }
      });
    });

    // Cancel inline task buttons
    document.querySelectorAll('.btn-cancel-inline-task').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.col;
        const form = document.getElementById(`inlineTaskInputRow_${col}`);
        if (form) form.classList.add('hidden');
      });
    });

    // Quick Alarm Preset Buttons (+15m, +1h, tomorrow 9am) inside inline creator
    document.querySelectorAll('.btn-quick-alarm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const form = e.target.closest('[id^="inlineTaskInputRow_"]');
        if (!form) return;
        const timeInput = form.querySelector('.input-task-alarm-time');
        if (!timeInput) return;

        const now = new Date();
        let targetDate = new Date();

        if (btn.dataset.mins) {
          targetDate = new Date(now.getTime() + parseInt(btn.dataset.mins, 10) * 60 * 1000);
        } else if (btn.dataset.preset === 'tomorrow9am') {
          targetDate.setDate(now.getDate() + 1);
          targetDate.setHours(9, 0, 0, 0);
        }

        const pad = n => String(n).padStart(2, '0');
        timeInput.value = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;
      });
    });

    // Helper to submit an inline task from a given form row
    const submitInlineTask = async (form) => {
      if (!form) return;
      const titleInput = form.querySelector('.input-task-title');
      if (!titleInput) return;
      const val = titleInput.value.trim();
      if (!val) return;

      const col = titleInput.dataset.col;
      const weightInput = form.querySelector('.input-task-weight');
      const timeInput = form.querySelector('.input-task-alarm-time');
      const repeatSelect = form.querySelector('.input-task-alarm-repeat');

      let alarmIso = null;
      if (timeInput && timeInput.value) {
        alarmIso = new Date(timeInput.value).toISOString();
      }

      const alarmRepeat = repeatSelect ? repeatSelect.value : 'none';

      const newTask = {
        title: val,
        column: col,
        date: this.selectedDate || new Date().toISOString().slice(0, 10),
        completed: false,
        time: '-',
        weight: (col === 'academic' && weightInput && weightInput.value) ? parseInt(weightInput.value, 10) : 0,
        alarmTime: alarmIso,
        alarmRepeat: alarmRepeat,
        alarmDismissed: false
      };

      const res = await API.createTask(newTask);
      if (res.success && res.task) {
        this.tasks.push(res.task);
        this.renderTaskColumns();
      }

      // Reset form
      titleInput.value = '';
      if (weightInput) weightInput.value = '';
      if (timeInput) timeInput.value = '';
      if (repeatSelect) repeatSelect.value = 'none';
      form.classList.add('hidden');
    };

    // Submit button clicks
    document.querySelectorAll('.btn-submit-inline-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const form = e.target.closest('[id^="inlineTaskInputRow_"]');
        submitInlineTask(form);
      });
    });

    // Pressing Enter in task title input submits
    document.querySelectorAll('.input-task-title').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const form = input.closest('[id^="inlineTaskInputRow_"]');
          submitInlineTask(form);
        }
      });
    });
  },

  bindTaskInteractions() {
    // Draggable task rows
    document.querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        this.draggedTaskId = row.dataset.taskId;
        row.classList.add('opacity-40');
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('opacity-40');
        this.draggedTaskId = null;
      });
    });

    // Drop containers
    ['tasksColAcademic', 'tasksColExtra', 'tasksColMisc'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        // Column moving disabled: tasks stay in their block; use Reschedule to change date/time instead
        this.draggedTaskId = null;
        this.renderTaskColumns();
      });
    });
  },

  async toggleComplete(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    await API.updateTask(id, { completed: task.completed });
    this.renderHeaderAndCalendar();
    this.renderTaskColumns();
  },

  async cycleColumn(id, currentCol) {
    const cols = ['academic', 'extracurriculars', 'miscellaneous'];
    const nextCol = cols[(cols.indexOf(currentCol) + 1) % cols.length];
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.column = nextCol;
    await API.moveTask(id, nextCol);
    this.renderTaskColumns();
  },

  async deleteTask(id) {
    await API.deleteTask(id);
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.renderHeaderAndCalendar();
    this.renderTaskColumns();
  },

  openAlarmPicker(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    if (window.AudioAlarmModal) {
      window.AudioAlarmModal.open('task', id, task.title, task.alarmTime);
    }
  },

  openReschedule(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    if (window.AudioAlarmModal) {
      window.AudioAlarmModal.open('task', id, task.title, task.deadline || task.alarmTime || null, 'reschedule');
    }
  },

  openTaskDetail(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    const modal = document.getElementById('taskDetailModal');
    const titleInput = document.getElementById('tdTitle');
    const weightInput = document.getElementById('tdWeight');
    const deadlineInput = document.getElementById('tdDeadline');
    const repeatSelect = document.getElementById('tdRepeat');
    const alarmInput = document.getElementById('tdAlarm');
    const tagsInput = document.getElementById('tdTags');

    if (titleInput) titleInput.value = task.title || '';
    if (weightInput) weightInput.value = task.weight || '';
    if (deadlineInput) deadlineInput.value = task.deadline ? task.deadline : '';
    if (repeatSelect) repeatSelect.value = task.repeat || 'none';
    if (alarmInput) alarmInput.value = task.alarmTime ? task.alarmTime.slice(0, 16) : '';
    if (tagsInput) tagsInput.value = (task.tags && task.tags.length ? task.tags.join(', ') : '');

    document.getElementById('tdTaskId').value = id;
    if (modal) modal.classList.remove('hidden');
  },

  async saveTaskDetail() {
    const id = document.getElementById('tdTaskId').value;
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    const alarmVal = document.getElementById('tdAlarm').value;
    const updates = {
      title: document.getElementById('tdTitle').value.trim(),
      weight: document.getElementById('tdWeight').value ? parseInt(document.getElementById('tdWeight').value, 10) : 0,
      deadline: document.getElementById('tdDeadline').value || null,
      repeat: document.getElementById('tdRepeat').value || 'none',
      alarmTime: alarmVal ? new Date(alarmVal).toISOString() : null,
      alarmDismissed: false,
      tags: document.getElementById('tdTags').value.split(',').map(s => s.trim()).filter(Boolean)
    };

    if (window.AudioAlarm && window.AudioAlarm.initAudio) {
      window.AudioAlarm.initAudio();
    }

    await API.updateTask(id, updates);
    Object.assign(task, updates);
    this.renderTaskColumns();
    document.getElementById('taskDetailModal').classList.add('hidden');
  },

  formatIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
