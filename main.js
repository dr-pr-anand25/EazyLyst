const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const { autoUpdater } = require('electron-updater');
const { classify } = require('./classify');

remoteMain.initialize();

let dropTargetWindow = null;
let panelWindow = null;
let collectedItems = [];
let itemIdCounter = 1;
let lists = [];
let listIdCounter = 1;

function broadcastUpdaterStatus(status) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send('updater-status', status);
  }
}

function initializeAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  const runtimeToken = process.env.EAZYLYST_GH_TOKEN || process.env.GH_TOKEN;
  if (runtimeToken) {
    autoUpdater.requestHeaders = {
      Authorization: `token ${runtimeToken}`
    };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    broadcastUpdaterStatus({ stage: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    broadcastUpdaterStatus({ stage: 'available', version: info?.version || null });
  });

  autoUpdater.on('update-not-available', () => {
    broadcastUpdaterStatus({ stage: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcastUpdaterStatus({
      stage: 'downloading',
      percent: Math.round(progress.percent || 0)
    });
  });

  autoUpdater.on('error', (err) => {
    broadcastUpdaterStatus({ stage: 'error', message: err?.message || 'Update failed' });
  });

  autoUpdater.on('update-downloaded', async () => {
    broadcastUpdaterStatus({ stage: 'downloaded' });
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: 'A new version has been downloaded.',
      detail: 'Restart EazyLyst to apply the update.'
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdatesAndNotify();
}

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

// Lists IPC handlers
ipcMain.on('create-list', (event, name) => {
  const list = {
    id: listIdCounter++,
    name: name.trim(),
    itemIds: [],
    createdAt: new Date().toISOString()
  };
  lists.push(list);
  if (panelWindow) panelWindow.webContents.send('list-created', list);
});

ipcMain.on('rename-list', (event, { id, name }) => {
  const list = lists.find(l => l.id === id);
  if (list) {
    list.name = name.trim();
    if (panelWindow) panelWindow.webContents.send('list-updated', list);
  }
});

ipcMain.on('delete-list', (event, id) => {
  lists = lists.filter(l => l.id !== id);
  if (panelWindow) panelWindow.webContents.send('list-deleted', id);
});

ipcMain.on('add-item-to-list', (event, { listId, itemId }) => {
  const list = lists.find(l => l.id === listId);
  if (list && !list.itemIds.includes(itemId)) {
    list.itemIds.push(itemId);
    if (panelWindow) panelWindow.webContents.send('list-updated', list);
  }
});

ipcMain.on('remove-item-from-list', (event, { listId, itemId }) => {
  const list = lists.find(l => l.id === listId);
  if (list) {
    list.itemIds = list.itemIds.filter(id => id !== itemId);
    if (panelWindow) panelWindow.webContents.send('list-updated', list);
  }
});

ipcMain.on('get-all-lists', (event) => {
  event.reply('all-lists', lists);
});

app.whenReady().then(() => {
  createDropTargetWindow();
  createPanelWindow();
  initializeAutoUpdater();

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
