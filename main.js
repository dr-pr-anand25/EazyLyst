const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const { autoUpdater } = require('electron-updater');
const { classify } = require('./classify');
const https = require('https');

remoteMain.initialize();

let dropTargetWindow = null;
let panelWindow = null;
let collectedItems = [];
let itemIdCounter = 1;
let lists = [];
let listIdCounter = 1;
let perplexityApiKey = null;

// ── Perplexity API helpers ────────────────────────────────────────────────────
function callPerplexityAPI(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant. Find social media and profile links for people and companies. Always respond with valid JSON only — no prose, no markdown fences, no explanation.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.1
    });

    const options = {
      hostname: 'api.perplexity.ai',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'Perplexity API error'));
          resolve(parsed.choices?.[0]?.message?.content || '');
        } catch (e) {
          reject(new Error('Failed to parse Perplexity response'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseProfileJSON(content) {
  // Strip markdown code fences if model wraps them anyway
  const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const obj = JSON.parse(clean);
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'string' && val.startsWith('http')) {
        result[key.toLowerCase()] = val;
      }
    }
    return result;
  } catch {
    return null;
  }
}

async function lookupProfiles(item) {
  if (!perplexityApiKey) return;
  if (item.category === 'Links') return; // Already a URL
  if (!panelWindow || panelWindow.isDestroyed()) return;

  panelWindow.webContents.send('item-profiles-loading', { itemId: item.id });

  try {
    let prompt;
    if (item.category === 'Name') {
      prompt = `Find official social media and professional profile links for the person named "${item.value}". ` +
        `Return ONLY a JSON object with these exact keys: linkedin, twitter, instagram, facebook, github, website. ` +
        `Use null for any you cannot find with high confidence. Raw JSON only.`;
    } else {
      prompt = `Find official social media and web presence links for the company or organisation named "${item.value}". ` +
        `Return ONLY a JSON object with these exact keys: website, linkedin, twitter, instagram, facebook, youtube. ` +
        `Use null for any you cannot find with high confidence. Raw JSON only.`;
    }

    const content = await callPerplexityAPI(prompt);
    const profiles = parseProfileJSON(content);
    if (!panelWindow || panelWindow.isDestroyed()) return;
    panelWindow.webContents.send('item-profiles', { itemId: item.id, profiles: profiles || {} });
  } catch (err) {
    if (!panelWindow || panelWindow.isDestroyed()) return;
    panelWindow.webContents.send('item-profiles-error', { itemId: item.id, error: err.message });
  }
}

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

  // Kick off profile lookup asynchronously (Name + Business categories only)
  lookupProfiles(item);
});

ipcMain.on('set-api-key', (event, key) => {
  perplexityApiKey = key && key.trim() ? key.trim() : null;
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
