const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const dbFilePath = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middlewares
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files (JPG, PNG, GIF, WEBP, SVG) are allowed!'));
  }
});

// Database State
let db = {
  users: [],
  userData: {}
};

function createBlankUserData(userName = 'Student') {
  return {
    profile: {
      title: 'Student Design Studio',
      subtitle: '',
      coverUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1800&q=80',
      avatar: userName.charAt(0).toUpperCase() || 'S',
      avatarUrl: '',
      sprint: 'Sprint 01 — Getting Started',
      semester: 'Fall Semester 2026'
    },
    notes: [],
    tasks: [],
    studySessions: [],
    mediaSettings: {
      activeSource: 'youtube',
      youtubeVideoId: 'jfKfPfyJRdk',
      youtubeTitle: 'Lofi Girl — Beats to relax/study to'
    }
  };
}

function loadDatabase() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = fs.readFileSync(dbFilePath, 'utf8');
      db = JSON.parse(raw);
      if (!db.users) db.users = [];
      if (!db.userData) db.userData = {};
      console.log('✅ Local JSON database loaded successfully.');
    } else {
      console.log('⚠️ db.json missing, initializing blank database...');
      db.users = [{ id: 'guest-default', email: 'guest@student.edu', name: 'Guest Student', isGuest: true, createdAt: new Date().toISOString() }];
      db.userData['guest-default'] = createBlankUserData('Guest Student');
      saveDatabase();
    }
  } catch (err) {
    console.error('❌ Error reading database file:', err);
  }
}

let saveTimeout = null;
function saveDatabase() {
  try {
    const tempPath = dbFilePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempPath, dbFilePath);
  } catch (err) {
    console.error('❌ Error saving database file:', err);
  }
}

function queueSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveDatabase, 150);
}

loadDatabase();

// Helper to get user's data bucket
function getUserData(req) {
  const userId = req.headers['x-user-id'] || req.query.userId || 'guest-default';
  if (!db.userData[userId]) {
    db.userData[userId] = createBlankUserData();
    queueSave();
  }
  return { userId, data: db.userData[userId] };
}

// ============================================================
// 1. AUTHENTICATION & GUEST ACCESS
// ============================================================

// Register with Email
app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists' });
  }

  const userId = 'user-' + Date.now();
  const newUser = {
    id: userId,
    email: email.trim(),
    name: name ? name.trim() : email.split('@')[0],
    isGuest: false,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  // Default is completely BLANK as requested!
  db.userData[userId] = createBlankUserData(newUser.name);
  queueSave();

  res.status(201).json({ success: true, user: newUser });
});

// Sign In with Email
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    // If not found, create one automatically to be user-friendly
    const userId = 'user-' + Date.now();
    const newUser = {
      id: userId,
      email: email.trim(),
      name: email.split('@')[0],
      isGuest: false,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    db.userData[userId] = createBlankUserData(newUser.name);
    queueSave();
    return res.json({ success: true, user: newUser, created: true });
  }

  res.json({ success: true, user });
});

// Continue as Guest
app.post('/api/auth/guest', (req, res) => {
  const guestId = 'guest-' + Date.now();
  const guestUser = {
    id: guestId,
    email: `guest-${guestId.slice(-4)}@guest.local`,
    name: 'Guest User',
    isGuest: true,
    createdAt: new Date().toISOString()
  };

  db.users.push(guestUser);
  db.userData[guestId] = createBlankUserData('Guest User');
  queueSave();

  res.json({ success: true, user: guestUser });
});

// Get Current User Info
app.get('/api/auth/me', (req, res) => {
  const { userId } = getUserData(req);
  const user = db.users.find(u => u.id === userId) || { id: userId, name: 'Guest Student', isGuest: true };
  res.json({ success: true, user });
});

// ============================================================
// 2. RETRIEVE ALL USER DATA
// ============================================================
app.get('/api/all', (req, res) => {
  const { data } = getUserData(req);
  res.json({ success: true, data });
});

// ============================================================
// 3. PROFILE & BANNER UPLOADS
// ============================================================
app.get('/api/profile', (req, res) => {
  const { data } = getUserData(req);
  res.json({ success: true, profile: data.profile || {} });
});

app.put('/api/profile', (req, res) => {
  const { data } = getUserData(req);
  data.profile = { ...(data.profile || {}), ...req.body };
  queueSave();
  res.json({ success: true, profile: data.profile });
});

app.post('/api/upload/cover', upload.single('cover'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });
    const coverUrl = `/uploads/${req.file.filename}`;
    const { data } = getUserData(req);
    data.profile.coverUrl = coverUrl;
    queueSave();
    res.json({ success: true, coverUrl, message: 'Cover banner uploaded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/upload/avatar', upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });
    const avatarUrl = `/uploads/${req.file.filename}`;
    const { data } = getUserData(req);
    data.profile.avatarUrl = avatarUrl;
    queueSave();
    res.json({ success: true, avatarUrl, message: 'Avatar image uploaded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 4. GOOGLE KEEP NOTES CRUD
// ============================================================
app.get('/api/notes', (req, res) => {
  const { data } = getUserData(req);
  res.json({ success: true, notes: data.notes || [] });
});

app.post('/api/notes', (req, res) => {
  const { data } = getUserData(req);
  const newNote = {
    id: req.body.id || 'note-' + Date.now(),
    title: req.body.title || '',
    body: req.body.body || '',
    color: req.body.color || '#FFFFFF',
    pinned: Boolean(req.body.pinned),
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    checklist: Array.isArray(req.body.checklist) ? req.body.checklist : [],
    code: req.body.code || '',
    codeLang: req.body.codeLang || 'plaintext',
    playerLink: req.body.playerLink || '',
    imageUrl: req.body.imageUrl || '',
    alarmTime: req.body.alarmTime || null,
    alarmRepeat: req.body.alarmRepeat || req.body.repeat || 'none',
    alarmDismissed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!data.notes) data.notes = [];
  data.notes.unshift(newNote);
  queueSave();
  res.status(201).json({ success: true, note: newNote });
});

app.put('/api/notes/:id', (req, res) => {
  const { data } = getUserData(req);
  const { id } = req.params;
  const idx = (data.notes || []).findIndex(n => n.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Note not found' });

  data.notes[idx] = {
    ...data.notes[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  queueSave();
  res.json({ success: true, note: data.notes[idx] });
});

app.delete('/api/notes/:id', (req, res) => {
  const { data } = getUserData(req);
  const { id } = req.params;
  const beforeLen = (data.notes || []).length;
  data.notes = (data.notes || []).filter(n => n.id !== id);
  queueSave();
  res.json({ success: true, deleted: beforeLen !== data.notes.length });
});

// ============================================================
// 5. 3-COLUMN PLANNER TASKS (Academic, Extracurriculars, Misc)
// ============================================================
app.get('/api/tasks', (req, res) => {
  const { data } = getUserData(req);
  res.json({ success: true, tasks: data.tasks || [] });
});

app.post('/api/tasks', (req, res) => {
  const { data } = getUserData(req);
  const validCols = ['academic', 'extracurriculars', 'miscellaneous'];
  const column = validCols.includes(req.body.column) ? req.body.column : 'academic';

  const newTask = {
    id: req.body.id || 'task-' + Date.now(),
    title: req.body.title || 'Untitled Task',
    column,
    priority: ['High', 'Medium', 'Low'].includes(req.body.priority) ? req.body.priority : 'Medium',
    tags: Array.isArray(req.body.tags) ? req.body.tags : (req.body.tag ? [req.body.tag] : ['#General']),
    weight: typeof req.body.weight === 'number' ? req.body.weight : (parseInt(req.body.weight, 10) || 0),
    date: req.body.date || new Date().toISOString().split('T')[0],
    time: req.body.time || '12:00 PM',
    completed: Boolean(req.body.completed),
    alarmTime: req.body.alarmTime || null,
    alarmRepeat: req.body.alarmRepeat || req.body.repeat || 'none',
    alarmDismissed: false,
    subtasks: Array.isArray(req.body.subtasks) ? req.body.subtasks : []
  };

  if (!data.tasks) data.tasks = [];
  data.tasks.push(newTask);
  queueSave();
  res.status(201).json({ success: true, task: newTask });
});

app.put('/api/tasks/:id', (req, res) => {
  const { data } = getUserData(req);
  const { id } = req.params;
  const idx = (data.tasks || []).findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Task not found' });

  data.tasks[idx] = { ...data.tasks[idx], ...req.body };
  queueSave();
  res.json({ success: true, task: data.tasks[idx] });
});

app.post('/api/tasks/:id/move', (req, res) => {
  const { data } = getUserData(req);
  const { id } = req.params;
  const { column, date, completed } = req.body;
  const task = (data.tasks || []).find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  if (column && ['academic', 'extracurriculars', 'miscellaneous'].includes(column)) {
    task.column = column;
  }
  if (date) task.date = date;
  if (typeof completed === 'boolean') task.completed = completed;

  queueSave();
  res.json({ success: true, task });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { data } = getUserData(req);
  const { id } = req.params;
  const beforeLen = (data.tasks || []).length;
  data.tasks = (data.tasks || []).filter(t => t.id !== id);
  queueSave();
  res.json({ success: true, deleted: beforeLen !== data.tasks.length });
});

// ============================================================
// 6. STUDY SESSIONS & PROGRESS METRICS
// ============================================================
app.get('/api/study/sessions', (req, res) => {
  const { data } = getUserData(req);
  res.json({ success: true, sessions: data.studySessions || [] });
});

app.post('/api/study/sessions', (req, res) => {
  const { data } = getUserData(req);
  const minutes = parseFloat(req.body.minutes) || 0;
  const newSession = {
    id: req.body.id || 'sess-' + Date.now(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    minutes: Math.max(1, Math.round(minutes)),
    durationSeconds: parseInt(req.body.durationSeconds, 10) || Math.round(minutes * 60),
    subject: (req.body.subject || '#General').trim(),
    mode: req.body.mode || 'timer',
    pauseCount: parseInt(req.body.pauseCount, 10) || 0,
    pausedSeconds: parseInt(req.body.pausedSeconds, 10) || 0,
    notes: req.body.notes || '',
    timestamp: req.body.timestamp || new Date().toISOString()
  };

  if (!data.studySessions) data.studySessions = [];
  data.studySessions.push(newSession);
  queueSave();
  res.status(201).json({ success: true, session: newSession });
});

app.get('/api/study/stats', (req, res) => {
  const { data } = getUserData(req);
  const sessions = data.studySessions || [];

  let totalMinutes = 0;
  const subjectMap = {};
  const dailyMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const datesSeen = new Set();

  sessions.forEach(sess => {
    const mins = Number(sess.minutes) || 0;
    totalMinutes += mins;

    const subj = sess.subject || 'General Study';
    if (!subjectMap[subj]) subjectMap[subj] = { minutes: 0, sessionsCount: 0 };
    subjectMap[subj].minutes += mins;
    subjectMap[subj].sessionsCount += 1;

    if (sess.date) {
      datesSeen.add(sess.date);
      const [y, m, d] = sess.date.split('-').map(Number);
      const sessDate = new Date(y, m - 1, d);
      const dayName = dayNames[sessDate.getDay()];
      if (dailyMap[dayName] !== undefined) dailyMap[dayName] += mins;
    }
  });

  const subjectsBreakdown = Object.keys(subjectMap).map(name => {
    const mins = subjectMap[name].minutes;
    const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
    return { subject: name, minutes: mins, sessionsCount: subjectMap[name].sessionsCount, percentage: pct };
  }).sort((a, b) => b.minutes - a.minutes);

  const dailyDistribution = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
    day,
    minutes: dailyMap[day] || 0
  }));

  res.json({
    success: true,
    stats: {
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(1),
      totalSessions: sessions.length,
      daysStudied: datesSeen.size,
      goalProgress: Math.min(100, Math.round((totalMinutes / 900) * 100)),
      subjectsBreakdown,
      dailyDistribution
    }
  });
});

// ============================================================
// 7. DEMO SAMPLE DATA TOGGLE (OPTIONAL TEMPLATE LOADER)
// ============================================================
app.post('/api/demo/load', (req, res) => {
  const { data } = getUserData(req);
  data.tasks = [
    {
      id: 'task-1',
      title: 'DS Lecture & Graph Algorithms',
      column: 'academic',
      priority: 'High',
      tags: ['#CS101'],
      weight: 25,
      date: '2026-10-25',
      time: '10:15 AM',
      completed: false,
      subtasks: [
        { id: 'st-1', text: 'Review Dijkstra traversal', done: true },
        { id: 'st-2', text: 'Code Python adjacency list', done: false }
      ]
    },
    {
      id: 'task-2',
      title: 'Do CT take home assignment',
      column: 'academic',
      priority: 'High',
      tags: ['#CT'],
      weight: 35,
      date: '2026-10-26',
      time: '05:00 PM',
      completed: false,
      subtasks: [{ id: 'st-3', text: 'Complete state space proof', done: false }]
    },
    {
      id: 'task-3',
      title: 'Geek room all-hands meeting',
      column: 'extracurriculars',
      priority: 'Medium',
      tags: ['#GeekRoom'],
      weight: 0,
      date: '2026-10-25',
      time: '10:15 PM',
      completed: false,
      subtasks: [{ id: 'st-4', text: 'Prepare slide retro', done: true }]
    },
    {
      id: 'task-4',
      title: 'Send Pan Card info to registrar',
      column: 'miscellaneous',
      priority: 'Medium',
      tags: ['#Admin'],
      weight: 0,
      date: '2026-10-25',
      time: '02:00 PM',
      completed: true,
      subtasks: [{ id: 'st-5', text: 'Upload ID scan', done: true }]
    }
  ];

  data.notes = [
    {
      id: 'note-1',
      title: 'UI UX',
      body: 'Essential design tools:\n• Penpot\n• Visily\n• Stitch',
      color: '#FFFFFF',
      pinned: true,
      tags: ['Design']
    },
    {
      id: 'note-2',
      title: 'Google ai',
      body: 'AI generative tools:\n• Pomelli - brand assets\n• Mixboard - img\n• Kollegio ai',
      color: '#FFFFFF',
      pinned: true,
      tags: ['AI']
    }
  ];

  queueSave();
  res.json({ success: true, message: 'Sample template loaded', data });
});

// Clear everything back to pristine blank slate
app.post('/api/demo/clear', (req, res) => {
  const { data } = getUserData(req);
  data.tasks = [];
  data.notes = [];
  data.studySessions = [];
  queueSave();
  res.json({ success: true, message: 'Workspace cleared to blank canvas', data });
});

// Fallback to index.html for client-side routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Student Design Studio Server running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
