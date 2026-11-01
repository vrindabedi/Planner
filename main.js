/**
 * main.js - Electron Main Process
 * Runs the personal planner desktop app with persistent user storage for YouTube Music.
 * Permanent Google Account cookies and local storage are saved in partition 'persist:youtube_music_session'.
 */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure local express server is running alongside electron
require('./server.js');

let mainWindow;

function createWindow() {
  // 1. Configure Persistent Partition for YouTube Music
  // This saves Google OAuth tokens, cookies, library, and playlists across app restarts
  const ytSession = session.fromPartition('persist:youtube_music_session', {
    cache: true
  });

  // Set modern desktop Chrome User-Agent to permit full Google account sign-ins
  const modernUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  ytSession.setUserAgent(modernUserAgent);

  // 2. Automatically inject clean UI script into any YouTube / YouTube Music webview
  ytSession.webRequest.onHeadersReceived((details, callback) => {
    // Relax frame embedding headers for embedded webview
    const responseHeaders = Object.assign({}, details.responseHeaders);
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['content-security-policy'];
    callback({ cancel: false, responseHeaders });
  });

  // 3. Create Main Application Window
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    title: 'Student Design Studio',
    backgroundColor: '#FBFBFA',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Enables <webview> for YouTube Music embedding
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the local Express Dashboard
  const startUrl = 'http://localhost:3000';
  mainWindow.loadURL(startUrl).catch(() => {
    setTimeout(() => mainWindow.loadURL(startUrl), 1500);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

