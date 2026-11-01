/**
 * Weekly & Monthly Progress Analytics Module
 * Supports:
 * - Dynamic view toggle: Weekly vs Monthly progress
 * - Total Focus time (hours/minutes)
 * - Average daily study time
 * - Number of times paused (pause counter metric)
 * - Streak of active study days
 * - Daily hours chart:
 *     * Weekly: 7 days (Mon-Sun) hours per day
 *     * Monthly: Full month (days 1-31) hours per day
 * - Subject Tag breakdown with percentage distribution
 * - Filtered Session history log
 */

const WeeklyStats = {
  viewMode: 'weekly', // 'weekly' | 'monthly'
  sessions: [],
  activeWeekStartDate: null,
  activeMonthDate: null,

  async init() {
    this.initDefaultDates();
    this.bindEvents();
    await this.refresh();
  },

  initDefaultDates() {
    const today = new Date();
    // Monday of current week
    const day = today.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    this.activeWeekStartDate = monday;

    // 1st of current month
    this.activeMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  },

  async refresh() {
    // 1. Fetch all user data from API or localStorage
    try {
      const all = await API.fetchAll();
      this.sessions = all.studySessions || [];
    } catch (e) {
      const uid = API.getUserId();
      this.sessions = JSON.parse(localStorage.getItem(`studio_sessions_${uid}`) || '[]');
    }

    // Also merge any local session cache
    const uid = API.getUserId();
    const localSessions = JSON.parse(localStorage.getItem(`studio_sessions_${uid}`) || '[]');
    localSessions.forEach(ls => {
      if (!this.sessions.some(s => s.id === ls.id)) {
        this.sessions.push(ls);
      }
    });

    this.render();
  },

  bindEvents() {
    // Toggle View: Weekly vs Monthly
    document.getElementById('statsViewWeeklyBtn')?.addEventListener('click', () => {
      this.viewMode = 'weekly';
      this.render();
    });

    document.getElementById('statsViewMonthlyBtn')?.addEventListener('click', () => {
      this.viewMode = 'monthly';
      this.render();
    });

    // Navigation arrows: Previous / Next period
    document.getElementById('statsPrevPeriodBtn')?.addEventListener('click', () => {
      if (this.viewMode === 'weekly') {
        this.activeWeekStartDate.setDate(this.activeWeekStartDate.getDate() - 7);
      } else {
        this.activeMonthDate.setMonth(this.activeMonthDate.getMonth() - 1);
      }
      this.render();
    });

    document.getElementById('statsNextPeriodBtn')?.addEventListener('click', () => {
      if (this.viewMode === 'weekly') {
        this.activeWeekStartDate.setDate(this.activeWeekStartDate.getDate() + 7);
      } else {
        this.activeMonthDate.setMonth(this.activeMonthDate.getMonth() + 1);
      }
      this.render();
    });

    document.getElementById('statsTodayPeriodBtn')?.addEventListener('click', () => {
      this.initDefaultDates();
      this.render();
    });
  },

  formatIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  render() {
    const weeklyBtn = document.getElementById('statsViewWeeklyBtn');
    const monthlyBtn = document.getElementById('statsViewMonthlyBtn');
    const periodLabelEl = document.getElementById('statsPeriodLabel');

    // 1. Update View Toggle Buttons
    const activeClass = 'bg-stone-900 text-white font-semibold shadow-xs';
    const inactiveClass = 'bg-stone-100 text-stone-600 hover:text-stone-900';

    if (weeklyBtn) weeklyBtn.className = `px-3.5 py-1.5 rounded-lg text-xs transition ${this.viewMode === 'weekly' ? activeClass : inactiveClass}`;
    if (monthlyBtn) monthlyBtn.className = `px-3.5 py-1.5 rounded-lg text-xs transition ${this.viewMode === 'monthly' ? activeClass : inactiveClass}`;

    // 2. Filter sessions and build data based on selected period
    let filteredSessions = [];
    let periodDates = [];
    let periodTitle = '';

    if (this.viewMode === 'weekly') {
      // 7 Days from activeWeekStartDate
      const weekDates = [];
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(this.activeWeekStartDate);
        d.setDate(this.activeWeekStartDate.getDate() + i);
        const iso = this.formatIsoDate(d);
        weekDates.push({ date: iso, dayName: dayNames[i], dayNum: d.getDate() });
      }
      periodDates = weekDates;

      const startIso = weekDates[0].date;
      const endIso = weekDates[6].date;
      periodTitle = `Week of ${new Date(this.activeWeekStartDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(weekDates[6].date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;

      filteredSessions = this.sessions.filter(s => s.date >= startIso && s.date <= endIso);
    } else {
      // Full Month of activeMonthDate
      const year = this.activeMonthDate.getFullYear();
      const month = this.activeMonthDate.getMonth();
      const totalDays = new Date(year, month + 1, 0).getDate();
      const monthName = this.activeMonthDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
      periodTitle = monthName;

      const monthDates = [];
      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(year, month, d);
        const iso = this.formatIsoDate(dateObj);
        monthDates.push({ date: iso, dayName: String(d), dayNum: d });
      }
      periodDates = monthDates;

      const startIso = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

      filteredSessions = this.sessions.filter(s => s.date >= startIso && s.date <= endIso);
    }

    if (periodLabelEl) periodLabelEl.textContent = periodTitle;

    // 3. Compute Metrics
    let totalMinutes = 0;
    let totalPauses = 0;
    const dailyMinutesMap = {};
    const subjectMap = {};
    const daysStudiedSet = new Set();

    periodDates.forEach(pd => {
      dailyMinutesMap[pd.date] = 0;
    });

    filteredSessions.forEach(sess => {
      const mins = Number(sess.minutes) || 0;
      totalMinutes += mins;

      // Pauses count
      totalPauses += parseInt(sess.pauseCount, 10) || 0;

      // Date tracking
      if (sess.date) {
        daysStudiedSet.add(sess.date);
        dailyMinutesMap[sess.date] = (dailyMinutesMap[sess.date] || 0) + mins;
      }

      // Subject tracking
      const subj = (sess.subject || '#General').trim();
      if (!subjectMap[subj]) {
        subjectMap[subj] = { minutes: 0, count: 0, pauses: 0 };
      }
      subjectMap[subj].minutes += mins;
      subjectMap[subj].count += 1;
      subjectMap[subj].pauses += (parseInt(sess.pauseCount, 10) || 0);
    });

    const totalHours = (totalMinutes / 60).toFixed(1);
    const numDaysInPeriod = periodDates.length;
    const avgDailyHours = (totalMinutes / numDaysInPeriod / 60).toFixed(1);

    // Calculate Streak (all-time streak of active study dates)
    const streakDays = this.calculateStreak();

    // 4. Update Summary Cards
    const totalHoursEl = document.getElementById('statsTotalHours');
    const avgDailyEl = document.getElementById('statsAvgDailyStudyTime');
    const totalPausesEl = document.getElementById('statsTotalPausesCount');
    const streakEl = document.getElementById('statsStreakDays');
    const periodMetricSub = document.getElementById('statsPeriodMetricSub');

    if (totalHoursEl) totalHoursEl.textContent = `${totalHours} hrs`;
    if (avgDailyEl) avgDailyEl.textContent = `${avgDailyHours} hrs/day`;
    if (totalPausesEl) totalPausesEl.textContent = `${totalPauses} pause${totalPauses === 1 ? '' : 's'}`;
    if (streakEl) streakEl.textContent = `${streakDays} days`;
    if (periodMetricSub) {
      periodMetricSub.textContent = `${totalMinutes} mins total • ${filteredSessions.length} sessions in ${this.viewMode}`;
    }

    // 5. Render Daily Hours Chart
    this.renderDailyChart(periodDates, dailyMinutesMap);

    // 6. Render Subject Breakdown
    this.renderSubjectBreakdown(subjectMap, totalMinutes);

    // 7. Render Filtered Session History
    this.renderSessionHistory(filteredSessions);

    lucide.createIcons();
  },

  renderDailyChart(periodDates, dailyMinutesMap) {
    const chartEl = document.getElementById('statsDailyHoursChart');
    if (!chartEl) return;

    const maxMinutes = Math.max(60, ...periodDates.map(p => dailyMinutesMap[p.date] || 0));

    if (this.viewMode === 'weekly') {
      // 7-day sleek bar chart
      chartEl.innerHTML = `
        <div class="flex items-end justify-between gap-3 h-44 w-full pt-4">
          ${periodDates.map(p => {
            const mins = dailyMinutesMap[p.date] || 0;
            const hrs = (mins / 60).toFixed(1);
            const heightPct = Math.max(6, Math.round((mins / maxMinutes) * 100));
            const isToday = p.date === this.formatIsoDate(new Date());

            return `
              <div class="flex-1 flex flex-col items-center gap-1.5 h-full group">
                <span class="text-[10px] font-mono font-medium ${mins > 0 ? 'text-stone-700 font-bold' : 'text-stone-300'} group-hover:text-blue-600 transition">
                  ${mins > 0 ? `${hrs}h` : '-'}
                </span>
                <div class="w-full bg-stone-100 rounded-xl flex-1 flex items-end p-1 overflow-hidden border border-stone-200/50">
                  <div
                    class="w-full rounded-lg transition-all duration-500 ${
                      isToday
                        ? 'bg-gradient-to-t from-blue-600 to-indigo-500'
                        : mins > 0
                          ? 'bg-stone-800 group-hover:bg-blue-600'
                          : 'bg-stone-200/50'
                    }"
                    style="height: ${heightPct}%;"
                    title="${p.dayName} (${p.date}): ${mins} mins"
                  ></div>
                </div>
                <div class="text-center">
                  <span class="block text-xs font-bold ${isToday ? 'text-blue-600' : 'text-stone-700'}">${p.dayName}</span>
                  <span class="block text-[10px] text-stone-400 font-mono">${p.dayNum}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      // Monthly 30/31-day visual breakdown
      chartEl.innerHTML = `
        <div class="space-y-2 pt-2">
          <div class="flex items-end gap-1 h-36 w-full overflow-x-auto pb-1">
            ${periodDates.map(p => {
              const mins = dailyMinutesMap[p.date] || 0;
              const hrs = (mins / 60).toFixed(1);
              const heightPct = Math.max(8, Math.round((mins / maxMinutes) * 100));
              const isToday = p.date === this.formatIsoDate(new Date());

              return `
                <div class="flex-1 min-w-[20px] flex flex-col items-center gap-1 h-full group" title="Day ${p.dayNum} (${p.date}): ${mins} mins (${hrs}h)">
                  <span class="text-[9px] font-mono ${mins > 0 ? 'text-stone-700 font-semibold' : 'text-stone-300'} truncate">
                    ${mins > 0 ? `${hrs}h` : ''}
                  </span>
                  <div class="w-full bg-stone-100 rounded-md flex-1 flex items-end p-0.5 border border-stone-200/40">
                    <div
                      class="w-full rounded-sm transition-all duration-300 ${
                        isToday
                          ? 'bg-blue-600'
                          : mins > 0
                            ? 'bg-stone-800 group-hover:bg-blue-500'
                            : 'bg-transparent'
                      }"
                      style="height: ${mins > 0 ? heightPct : 4}%;"
                    ></div>
                  </div>
                  <span class="text-[10px] font-mono ${isToday ? 'text-blue-600 font-bold' : 'text-stone-400'}">${p.dayNum}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div class="flex items-center justify-between text-[11px] text-stone-400 font-mono px-1">
            <span>Day 1</span>
            <span>Monthly Daily Hours & Minutes Distribution</span>
            <span>Day ${periodDates.length}</span>
          </div>
        </div>
      `;
    }
  },

  renderSubjectBreakdown(subjectMap, totalMinutes) {
    const listEl = document.getElementById('statsSubjectBreakdownList');
    if (!listEl) return;

    const subjects = Object.keys(subjectMap).map(tag => {
      const data = subjectMap[tag];
      const percentage = totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0;
      return { tag, ...data, percentage };
    }).sort((a, b) => b.minutes - a.minutes);

    if (subjects.length === 0) {
      listEl.innerHTML = `
        <div class="col-span-full py-6 text-center text-stone-400 text-xs bg-stone-50 rounded-xl border border-dashed border-stone-200">
          No study sessions logged for this period yet.
        </div>
      `;
      return;
    }

    const colors = [
      { bar: 'bg-blue-600', dot: 'bg-blue-600', text: 'text-blue-700' },
      { bar: 'bg-emerald-600', dot: 'bg-emerald-600', text: 'text-emerald-700' },
      { bar: 'bg-purple-600', dot: 'bg-purple-600', text: 'text-purple-700' },
      { bar: 'bg-amber-600', dot: 'bg-amber-600', text: 'text-amber-700' },
      { bar: 'bg-rose-600', dot: 'bg-rose-600', text: 'text-rose-700' },
      { bar: 'bg-indigo-600', dot: 'bg-indigo-600', text: 'text-indigo-700' }
    ];

    listEl.innerHTML = subjects.map((s, idx) => {
      const color = colors[idx % colors.length];
      const hrs = (s.minutes / 60).toFixed(1);
      return `
        <div class="p-3 rounded-xl bg-stone-50 border border-stone-200/70 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-stone-800 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full ${color.dot}"></span>
              <span>${s.tag}</span>
            </span>
            <span class="font-mono text-stone-500 text-[11px]">
              ${hrs} hrs (${s.minutes}m) • <strong class="text-stone-800">${s.percentage}%</strong>
            </span>
          </div>
          <div class="w-full bg-stone-200/80 rounded-full h-2 overflow-hidden">
            <div class="h-full ${color.bar} rounded-full transition-all duration-500" style="width: ${s.percentage}%;"></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-stone-400 font-mono">
            <span>${s.count} session${s.count === 1 ? '' : 's'}</span>
            <span>${s.pauses} pause${s.pauses === 1 ? '' : 's'}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderSessionHistory(filteredSessions) {
    const listEl = document.getElementById('statsHistoryList');
    if (!listEl) return;

    if (filteredSessions.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-stone-400 text-xs">
            No focus sessions logged in this ${this.viewMode}. Start the timer or stopwatch above to record focus!
          </td>
        </tr>
      `;
      return;
    }

    const recent = [...filteredSessions].reverse().slice(0, 15);
    listEl.innerHTML = recent.map(sess => {
      const pauses = parseInt(sess.pauseCount, 10) || 0;
      const pausedSecs = parseInt(sess.pausedSeconds, 10) || 0;
      const pausedMins = Math.round(pausedSecs / 60);
      const isStopwatch = sess.mode === 'stopwatch';

      return `
        <tr class="border-b border-stone-100 hover:bg-stone-50/80 transition text-xs">
          <td class="py-2.5 px-3 font-mono text-stone-600">${sess.date || '-'}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-200 text-stone-800 font-mono">
              ${sess.subject || '#General'}
            </span>
          </td>
          <td class="py-2.5 px-3 font-mono text-stone-500 capitalize">
            <span class="inline-flex items-center gap-1 text-[11px]">
              <i data-lucide="${isStopwatch ? 'timer' : 'hourglass'}" class="w-3 h-3 text-stone-400"></i>
              ${sess.mode || 'timer'}
            </span>
          </td>
          <td class="py-2.5 px-3 font-bold text-stone-900 font-mono">${sess.minutes}m</td>
          <td class="py-2.5 px-3 font-mono text-stone-500">
            <span class="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px] font-medium" title="${pausedSecs}s total paused duration">
              ${pauses} pause${pauses === 1 ? '' : 's'}${pausedMins > 0 ? ` (${pausedMins}m)` : ''}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  calculateStreak() {
    const dates = [...new Set(this.sessions.map(s => s.date).filter(Boolean))].sort().reverse();
    if (dates.length === 0) return 0;

    let streak = 0;
    const today = this.formatIsoDate(new Date());
    const yesterday = this.formatIsoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

    // If neither today nor yesterday is present, streak is broken
    if (!dates.includes(today) && !dates.includes(yesterday)) {
      return 0;
    }

    let checkDate = new Date(dates[0]);
    dates.forEach(d => {
      const iso = this.formatIsoDate(checkDate);
      if (dates.includes(iso)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    });

    return streak;
  }
};
