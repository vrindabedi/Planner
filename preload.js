/**
 * preload.js
 * Exposes safe Electron bridge indicators and handles webview script injection.
 */
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getInjectScript: () => {
    try {
      return fs.readFileSync(path.join(__dirname, 'inject-ytmusic.js'), 'utf8');
    } catch (e) {
      console.warn('Could not read inject-ytmusic.js:', e);
      return '';
    }
  }
});

