const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let overlayWin = null;
let panelWin = null;

function createOverlay() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const size = 120;

  overlayWin = new BrowserWindow({
    width: size,
    height: size,
    x: Math.round((screenW - size) / 2),
    y: Math.round((screenH - size) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWin.setIgnoreMouseEvents(false);
  overlayWin.loadFile('overlay.html');
}

function createPanel() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const panelW = 380;

  panelWin = new BrowserWindow({
    width: panelW,
    height: screenH,
    x: screenW - panelW,
    y: 0,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWin.loadFile('panel.html');
}

app.whenReady().then(() => {
  createOverlay();
  createPanel();
});

app.on('window-all-closed', () => app.quit());

// ── IPC handlers ──

ipcMain.on('item-dropped', (_event, text) => {
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.webContents.send('add-item', text);
  }
});

ipcMain.on('toggle-circle', () => {
  if (!overlayWin || overlayWin.isDestroyed()) {
    createOverlay();
  } else if (overlayWin.isVisible()) {
    overlayWin.hide();
  } else {
    overlayWin.show();
  }
});

ipcMain.handle('save-csv', async (_event, csvContent) => {
  const { canceled, filePath } = await dialog.showSaveDialog(panelWin, {
    title: 'Save CSV',
    defaultPath: 'eazylyst-export.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, csvContent, 'utf-8');
  return true;
});
