const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');
const { autoUpdater } = require('electron-updater');
const { classify } = require('./classify');
const https = require('https');
const fs   = require('fs');

remoteMain.initialize();

let dropTargetWindow = null;
let panelWindow      = null;
let collectedItems   = [];
let itemIdCounter    = 1;
let lists            = [];
let listIdCounter    = 1;
let perplexityApiKey = null;
let storePath        = null;
let shortcutFolder   = null; // null = default folder (Documents\EazyLyst Links)

// ── Data persistence ──────────────────────────────────────────────────────────
function loadStore() {
  try {
    if (!storePath || !fs.existsSync(storePath)) return;
    const raw  = fs.readFileSync(storePath, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.items))        collectedItems   = data.items;
    if (typeof data.itemIdCounter === 'number') itemIdCounter = data.itemIdCounter;
    if (Array.isArray(data.lists))        lists            = data.lists;
    if (typeof data.listIdCounter === 'number') listIdCounter = data.listIdCounter;
    if (typeof data.perplexityApiKey === 'string' && data.perplexityApiKey)
      perplexityApiKey = data.perplexityApiKey;
    if (typeof data.shortcutFolder === 'string' && data.shortcutFolder)
      shortcutFolder = data.shortcutFolder;
  } catch (e) {
    // Corrupt store — start fresh, old file will be overwritten on next save
    console.warn('EazyLyst: could not load store:', e.message);
  }
}

function saveStore() {
  if (!storePath) return;
  try {
    const data = {
      items:           collectedItems,
      itemIdCounter,
      lists,
      listIdCounter,
      perplexityApiKey: perplexityApiKey || '',
      shortcutFolder:   shortcutFolder || ''
    };
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('EazyLyst: could not save store:', e.message);
  }
}

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
  // Keep the drop box above everything (even full-screen apps). There is no
  // hide/show control any more, so it is always available.
  dropTargetWindow.setAlwaysOnTop(true, 'screen-saver');
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



// ── Internet shortcut (.url) saving ───────────────────────────────────────────
// Every dropped item is saved as a double-clickable .url file in this folder.
// The folder is chosen in the app (Settings → Shortcut folder) and remembered.
function defaultShortcutFolder() {
  return path.join(app.getPath('documents'), 'EazyLyst Links');
}

function getShortcutFolder() {
  return shortcutFolder || defaultShortcutFolder();
}

// Links become a shortcut to themselves. Anything else (names, businesses,
// plain text) becomes a shortcut to a Google search for that text.
function toShortcutUrl(text, category) {
  if (category === 'Links') {
    // text/uri-list can hold several lines and # comments: use the first URL
    const first = text.split(/\r?\n/).map(l => l.trim()).find(l => l && !l.startsWith('#')) || text.trim();
    return /^https?:\/\//i.test(first) ? first : 'https://' + first;
  }
  return 'https://www.google.com/search?q=' + encodeURIComponent(text.replace(/\s+/g, ' ').trim());
}

// Builds a Windows-safe file name from the dropped text
function makeShortcutName(text, category) {
  let base = text.replace(/\s+/g, ' ').trim();
  if (category === 'Links') {
    try {
      const u = new URL(toShortcutUrl(text, category));
      base = u.hostname.replace(/^www\./, '') + (u.pathname && u.pathname !== '/' ? u.pathname : '');
    } catch { /* keep raw text */ }
  }
  base = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 80);
  return base || 'link';
}

// Cleans a string so it can be used as a Windows file name
function sanitizeFileName(name) {
  return (name || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 80);
}

// Decodes the common HTML entities that show up in page titles
function decodeHtmlEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

// Titles that mean "the site blocked us / this is not a real title"
const USELESS_TITLE = /^(just a moment|access denied|attention required|forbidden|not found|\d{3}\b|error|sign in|log in|login|redirecting|403|404|untitled)/i;

// Downloads the start of the page and returns its <title> (or og:title).
// Returns null if the page cannot be reached within a few seconds.
async function fetchPageTitle(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !/html/i.test(type) || !res.body) return null;

    // Read only the first ~256 KB; the title is near the top
    const reader  = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let html = '';
    while (html.length < 262144) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});

    let title = null;
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t) title = t[1];
    if (!title || !title.trim()) {
      const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
              || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (og) title = og[1];
    }
    if (!title) return null;

    title = decodeHtmlEntities(title).replace(/\s+/g, ' ').trim();
    if (!title || USELESS_TITLE.test(title)) return null;
    return title;
  } catch {
    return null; // offline, timeout, blocked: caller falls back to a readable URL name
  } finally {
    clearTimeout(timer);
  }
}

// Saves the shortcut. For links the file is named after the page title,
// for example "How to Bake Bread - Example Kitchen.url".
async function saveShortcut(text, category) {
  try {
    let dir = getShortcutFolder();
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // Chosen folder unavailable (drive unplugged, permissions...): use the default
      console.warn('EazyLyst: shortcut folder unavailable, using default:', e.message);
      dir = defaultShortcutFolder();
      fs.mkdirSync(dir, { recursive: true });
    }

    let url = toShortcutUrl(text, category);
    try { url = new URL(url).href; } catch { /* keep as is */ }

    // Meaningful alias: page title for links, the text itself otherwise
    let alias = null;
    if (category === 'Links') alias = await fetchPageTitle(url);
    const base = sanitizeFileName(alias) || makeShortcutName(text, category);

    // Never overwrite: add (2), (3)... if the name already exists
    let file = path.join(dir, `${base}.url`);
    let n = 2;
    while (fs.existsSync(file)) {
      file = path.join(dir, `${base} (${n++}).url`);
    }

    fs.writeFileSync(file, `[InternetShortcut]\r\nURL=${url}\r\n`, 'utf8');
    return file;
  } catch (e) {
    console.warn('EazyLyst: could not save shortcut:', e.message);
    return null;
  }
}

// IPC handlers
ipcMain.on('item-dropped', (event, text) => {
  const category = classify(text);
  saveShortcut(text, category);
  const item = {
    id: itemIdCounter++,
    value: text,
    category: category,
    timestamp: new Date().toISOString()
  };
  collectedItems.push(item);
  saveStore();
  if (panelWindow) panelWindow.webContents.send('new-item', item);
  lookupProfiles(item);
});

// ── Shortcut folder settings (used by the Settings tab) ───────────────────────
ipcMain.on('get-shortcut-folder', (event) => {
  event.reply('shortcut-folder', { folder: getShortcutFolder() });
});

ipcMain.on('choose-shortcut-folder', async (event) => {
  try {
    const parent = panelWindow && !panelWindow.isDestroyed() ? panelWindow : undefined;
    const result = await dialog.showOpenDialog(parent, {
      title: 'Choose where to save shortcuts',
      defaultPath: getShortcutFolder(),
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths.length) {
      event.reply('shortcut-folder', { folder: getShortcutFolder() });
      return;
    }
    const chosen = result.filePaths[0];
    fs.mkdirSync(chosen, { recursive: true });
    fs.accessSync(chosen, fs.constants.W_OK); // make sure we can write there
    shortcutFolder = chosen;
    saveStore();
    event.reply('shortcut-folder', { folder: chosen, message: '✓ Saved. New shortcuts will go here.' });
  } catch (e) {
    event.reply('shortcut-folder', { folder: getShortcutFolder(), error: 'Cannot use that folder: ' + e.message });
  }
});

ipcMain.on('reset-shortcut-folder', (event) => {
  shortcutFolder = null;
  saveStore();
  event.reply('shortcut-folder', { folder: getShortcutFolder(), message: '✓ Back to the default folder.' });
});

ipcMain.on('open-shortcut-folder', async (event) => {
  const dir = getShortcutFolder();
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* shell.openPath reports the problem */ }
  const err = await shell.openPath(dir);
  if (err) event.reply('shortcut-folder', { folder: dir, error: 'Could not open folder: ' + err });
});

ipcMain.on('set-api-key', (event, key) => {
  perplexityApiKey = key && key.trim() ? key.trim() : null;
  saveStore();
});

// Move the drop target window while the user drags the circle.
// Sent from drop-target.html (manual dragging keeps HTML5 drop events working).
ipcMain.on('drop-target-move', (event, { dx, dy }) => {
  if (!dropTargetWindow || dropTargetWindow.isDestroyed()) return;
  const b = dropTargetWindow.getBounds();
  // Fixed width/height avoids Windows DPI resize glitches while moving
  dropTargetWindow.setBounds({ x: b.x + dx, y: b.y + dy, width: 75, height: 75 });
});

ipcMain.on('get-all-items', (event) => {
  event.reply('all-items', collectedItems);
  // Restore the API key into the renderer so the Settings input is pre-filled
  if (perplexityApiKey) event.reply('stored-api-key', perplexityApiKey);
});

ipcMain.on('update-item', (event, updatedItem) => {
  const index = collectedItems.findIndex(item => item.id === updatedItem.id);
  if (index !== -1) {
    collectedItems[index] = updatedItem;
    saveStore();
    if (panelWindow) panelWindow.webContents.send('item-updated', updatedItem);
  }
});

ipcMain.on('delete-item', (event, itemId) => {
  collectedItems = collectedItems.filter(item => item.id !== itemId);
  saveStore();
  if (panelWindow) panelWindow.webContents.send('item-deleted', itemId);
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
  saveStore();
  if (panelWindow) panelWindow.webContents.send('list-created', list);
});

ipcMain.on('rename-list', (event, { id, name }) => {
  const list = lists.find(l => l.id === id);
  if (list) {
    list.name = name.trim();
    saveStore();
    if (panelWindow) panelWindow.webContents.send('list-updated', list);
  }
});

ipcMain.on('delete-list', (event, id) => {
  lists = lists.filter(l => l.id !== id);
  saveStore();
  if (panelWindow) panelWindow.webContents.send('list-deleted', id);
});

ipcMain.on('add-item-to-list', (event, { listId, itemId }) => {
  const list = lists.find(l => l.id === listId);
  if (list && !list.itemIds.includes(itemId)) {
    list.itemIds.push(itemId);
    saveStore();
    if (panelWindow) panelWindow.webContents.send('list-updated', list);
  }
});

ipcMain.on('remove-item-from-list', (event, { listId, itemId }) => {
  const list = lists.find(l => l.id === listId);
  if (list) {
    list.itemIds = list.itemIds.filter(id => id !== itemId);
    saveStore();
    if (panelWindow) panelWindow.webContents.send('list-updated', list);
  }
});

ipcMain.on('get-all-lists', (event) => {
  event.reply('all-lists', lists);
});

app.whenReady().then(() => {
  storePath = path.join(app.getPath('userData'), 'eazylyst-data.json');
  loadStore();

  createDropTargetWindow();
  createPanelWindow();
// initializeAutoUpdater();

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
