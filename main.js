const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');

remoteMain.initialize();

let dropTargetWindow = null;
let panelWindow = null;
let collectedItems = [];

function createDropTargetWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  dropTargetWindow = new BrowserWindow({
    width: 150,
    height: 150,
    x: Math.floor(width / 2 - 75),
    y: Math.floor(height / 2 - 75),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
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

// Auto-categorization logic
function categorizeItem(text) {
  const trimmed = text.trim();
  
  // Check for Links (http/https/www)
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    return 'Links';
  }
  
  // Business keywords
  const businessKeywords = [
    'Solutions', 'Group', 'Systems', 'Holdings', 'Partners', 
    'Ventures', 'Bank', 'Financial', 'Services', 'Industries', 
    'Enterprises', 'Inc', 'LLC', 'Ltd', 'Corp', 'Corporation',
    'Company', 'Firm', 'Agency', 'Capital', 'Investment', 
    'Management', 'Consulting'
  ];
  
  const hasBusinessKeyword = businessKeywords.some(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(trimmed)
  );
  
  if (hasBusinessKeyword) {
    return 'Business';
  }
  
  // Check for Name (2-3 capitalized words)
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words.length <= 3) {
    const allCapitalized = words.every(word => /^[A-Z][a-z]*/.test(word));
    if (allCapitalized) {
      return 'Name';
    }
  }
  
  // Default to Business
  return 'Business';
}

// IPC handlers
ipcMain.on('item-dropped', (event, text) => {
  const category = categorizeItem(text);
  const item = {
    id: Date.now(),
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
