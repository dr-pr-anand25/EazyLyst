const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const { classify } = require('./classify');

remoteMain.initialize();

let dropTargetWindow = null;
let panelWindow = null;
let collectedItems = [];
let itemIdCounter = 1;

function createDropTargetWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  dropTargetWindow = new BrowserWindow({
    width: 75,
    height: 75,
    x: Math.floor(width / 2 - 37),
    y: Math.floor(height / 2 - 37),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  dropTargetWindow.setIgnoreMouseEvents(false);
  dropTargetWindow.loadFile('drop-target.html');
  
  dropTargetWindow.on('closed', () => {
    dropTargetWindow = null;
  });
}

function createPanelWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  panelWindow = new BrowserWindow({
    width: 350,
    height: height,
    x: width - 350,
    y: 0,
    frame: true,
    alwaysOnTop: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  panelWindow.loadFile('panel.html');
  remoteMain.enable(panelWindow.webContents);
  
  panelWindow.on('closed', () => {
    panelWindow = null;
  });
}



// IPC handlers
ipcMain.on('item-dropped', (event, text) => {
  const category = classify(text);
  const item = {
    id: itemIdCounter++,
    value: text,
    category: category,
    timestamp: new Date().toISOString()
  };
  
  collectedItems.push(item);
  
  // Send to panel window if it exists
  if (panelWindow) {
    panelWindow.webContents.send('new-item', item);
  }
});

ipcMain.on('toggle-overlay', (event, visible) => {
  if (dropTargetWindow) {
    if (visible) {
      dropTargetWindow.show();
    } else {
      dropTargetWindow.hide();
    }
  }
});

ipcMain.on('get-all-items', (event) => {
  event.reply('all-items', collectedItems);
});

ipcMain.on('update-item', (event, updatedItem) => {
  const index = collectedItems.findIndex(item => item.id === updatedItem.id);
  if (index !== -1) {
    collectedItems[index] = updatedItem;
    if (panelWindow) {
      panelWindow.webContents.send('item-updated', updatedItem);
    }
  }
});

ipcMain.on('delete-item', (event, itemId) => {
  collectedItems = collectedItems.filter(item => item.id !== itemId);
  if (panelWindow) {
    panelWindow.webContents.send('item-deleted', itemId);
  }
});

ipcMain.on('get-csv-data', (event, options) => {
  event.reply('csv-data', { items: collectedItems, options });
});

app.whenReady().then(() => {
  createDropTargetWindow();
  createPanelWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDropTargetWindow();
      createPanelWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
