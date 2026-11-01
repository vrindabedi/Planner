/**
 * API Client for Student Design Studio
 * Handles User Authentication, Guest Sessions, and full persistent REST sync.
 */

const API_BASE = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000';

const API = {
  currentUser: null,

  // Get active User ID from localStorage or default to guest
  getUserId() {
    return localStorage.getItem('studio_user_id') || 'guest-default';
  },

  setUserId(id) {
    localStorage.setItem('studio_user_id', id);
  },

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-user-id': this.getUserId()
    };
  },

  // 1. Authentication & Guest Methods
  async getCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        return data.user;
      }
    } catch (e) {
      console.warn('Auth check offline:', e);
    }
    return { id: this.getUserId(), name: 'Guest Student', email: 'guest@local', isGuest: true };
  },

  async register(email, name, password) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      this.currentUser = data.user;
      this.setUserId(data.user.id);
      return data;
    } catch (e) {
      // Offline fallback
      const fallbackUser = { id: 'user-' + Date.now(), email, name: name || email.split('@')[0], isGuest: false };
      this.currentUser = fallbackUser;
      this.setUserId(fallbackUser.id);
      return { success: true, user: fallbackUser };
    }
  },

  async login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      this.currentUser = data.user;
      this.setUserId(data.user.id);
      return data;
    } catch (e) {
      const fallbackUser = { id: 'user-' + Date.now(), email, name: email.split('@')[0], isGuest: false };
      this.currentUser = fallbackUser;
      this.setUserId(fallbackUser.id);
      return { success: true, user: fallbackUser };
    }
  },

  async continueAsGuest() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      this.currentUser = data.user;
      this.setUserId(data.user.id);
      return data.user;
    } catch (e) {
      const guest = { id: 'guest-' + Date.now(), name: 'Guest User', email: 'guest@local', isGuest: true };
      this.currentUser = guest;
      this.setUserId(guest.id);
      return guest;
    }
  },

  logout() {
    localStorage.removeItem('studio_user_id');
    this.currentUser = null;
  },

  // 2. Fetch Complete Workspace State (Default is BLANK for new accounts)
  async fetchAll() {
    try {
      const res = await fetch(`${API_BASE}/api/all`, { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.warn('API fetchAll offline fallback:', err);
      return this.getOfflineCache();
    }
  },

  // 3. Notes API
  async createNote(note) {
    try {
      const res = await fetch(`${API_BASE}/api/notes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(note)
      });
      return await res.json();
    } catch (err) {
      return { success: true, note: { ...note, id: 'note-' + Date.now() } };
    }
  },

  async updateNote(id, updates) {
    try {
      const res = await fetch(`${API_BASE}/api/notes/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates)
      });
      return await res.json();
    } catch (err) {
      return { success: true };
    }
  },

  async deleteNote(id) {
    try {
      const res = await fetch(`${API_BASE}/api/notes/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return await res.json();
    } catch (err) {
      return { success: true };
    }
  },

  // 4. Tasks API
  async createTask(task) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(task)
      });
      return await res.json();
    } catch (err) {
      return { success: true, task: { ...task, id: 'task-' + Date.now() } };
    }
  },

  async updateTask(id, updates) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates)
      });
      return await res.json();
    } catch (err) {
      return { success: true };
    }
  },

  async moveTask(id, column, date, completed) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}/move`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ column, date, completed })
      });
      return await res.json();
    } catch (err) {
      return { success: true };
    }
  },

  async deleteTask(id) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return await res.json();
    } catch (err) {
      return { success: true };
    }
  },

  // 5. Study Sessions & Stats
  async logStudySession(session) {
    const uid = this.getUserId();
    const localKey = `studio_sessions_${uid}`;
    try {
      const res = await fetch(`${API_BASE}/api/study/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(session)
      });
      if (res.ok) {
        const data = await res.json();
        // Update local cache
        const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
        localList.push(data.session);
        localStorage.setItem(localKey, JSON.stringify(localList));
        return data;
      }
    } catch (err) {
      console.warn('Study session offline fallback:', err);
    }
    // Offline fallback
    const offlineSession = {
      id: 'sess-' + Date.now(),
      date: session.date || new Date().toISOString().split('T')[0],
      minutes: Math.max(1, Math.round(session.minutes || 0)),
      durationSeconds: session.durationSeconds || Math.round((session.minutes || 0) * 60),
      subject: (session.subject || '#General').trim(),
      mode: session.mode || 'timer',
      pauseCount: parseInt(session.pauseCount, 10) || 0,
      pausedSeconds: parseInt(session.pausedSeconds, 10) || 0,
      timestamp: new Date().toISOString()
    };
    const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
    localList.push(offlineSession);
    localStorage.setItem(localKey, JSON.stringify(localList));
    return { success: true, session: offlineSession };
  },

  async getStudyStats() {
    try {
      const res = await fetch(`${API_BASE}/api/study/stats`, { headers: this.getHeaders() });
      const data = await res.json();
      return data.stats;
    } catch (err) {
      return {
        totalMinutes: 0,
        totalHours: "0.0",
        totalSessions: 0,
        daysStudied: 0,
        goalProgress: 0,
        subjectsBreakdown: [],
        dailyDistribution: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ day, minutes: 0 }))
      };
    }
  },

  // 6. Cover & Avatar Uploads
  // Uses server upload if available, falls back to FileReader Base64 (localStorage)
  async uploadCover(file) {
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const res = await fetch(`${API_BASE}/api/upload/cover`, {
        method: 'POST',
        headers: { 'x-user-id': this.getUserId() },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        // Also cache locally
        localStorage.setItem(`studio_cover_${this.getUserId()}`, data.coverUrl);
        return data;
      }
    } catch (e) {
      console.warn('Server upload unavailable, using local FileReader fallback');
    }
    // Offline fallback: convert to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        localStorage.setItem(`studio_cover_${this.getUserId()}`, dataUrl);
        resolve({ success: true, coverUrl: dataUrl });
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  },

  async uploadAvatar(file) {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_BASE}/api/upload/avatar`, {
        method: 'POST',
        headers: { 'x-user-id': this.getUserId() },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(`studio_avatar_${this.getUserId()}`, data.avatarUrl);
        return data;
      }
    } catch (e) {
      console.warn('Server upload unavailable, using local FileReader fallback');
    }
    // Offline fallback: convert to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        localStorage.setItem(`studio_avatar_${this.getUserId()}`, dataUrl);
        resolve({ success: true, avatarUrl: dataUrl });
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  },

  // Helper: upload any image file and return a data URL (no server needed)
  async uploadNoteImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ success: true, imageUrl: ev.target.result });
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  },

  async updateProfile(updates) {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates)
      });
      return await res.json();
    } catch (err) {
      return { success: true };
    }
  },

  // 7. Demo Data Loader / Clear Workspace
  async loadDemoTemplate() {
    const res = await fetch(`${API_BASE}/api/demo/load`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return await res.json();
  },

  async clearWorkspace() {
    const res = await fetch(`${API_BASE}/api/demo/clear`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return await res.json();
  },

  getOfflineCache() {
    const uid = this.getUserId();
    return {
      profile: {
        title: localStorage.getItem(`studio_title_${uid}`) || 'Student Design Studio',
        subtitle: localStorage.getItem(`studio_subtitle_${uid}`) || '',
        coverUrl: localStorage.getItem(`studio_cover_${uid}`) || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1800&q=80',
        avatarUrl: localStorage.getItem(`studio_avatar_${uid}`) || ''
      },
      notes: [],
      tasks: [],
      studySessions: [],
      mediaSettings: { activeSource: 'youtube', youtubeVideoId: 'jfKfPfyJRdk' }
    };
  }
};
