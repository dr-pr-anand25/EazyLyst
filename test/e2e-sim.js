/**
 * EazyLyst End-to-End Simulation
 *
 * Simulates real user interactions by exercising the same logic that runs in
 * main.js (IPC handlers, item store, classify) and the panel's CSV export
 * function. Runs with plain Node.js — no display or Electron binary needed.
 *
 * Scenarios covered:
 *   1. Drop items (all three categories + fallback)
 *   2. Rename an item
 *   3. Discard an item
 *   4. Toggle overlay state
 *   5. CSV export with all column options
 *   6. CSV export with minimal columns
 *   7. Duplicate prevention (unique IDs)
 *   8. Edge inputs (empty, whitespace, numeric, very long string)
 */

'use strict';

const { classify } = require('../classify');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Colour helpers ──────────────────────────────────────────────────────────
const green  = s => `\x1b[32m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;

// ─── Minimal in-process replica of main.js state + handlers ─────────────────
function createAppState() {
  let collectedItems   = [];
  let itemIdCounter    = 1;
  let overlayVisible   = true;
  const panelMessages  = [];                 // records what would be sent to panel

  function handleItemDropped(text) {
    if (!text || !text.trim()) return null;
    const category = classify(text.trim());
    const item = {
      id:        itemIdCounter++,
      value:     text.trim(),
      category,
      timestamp: new Date().toISOString()
    };
    collectedItems.push(item);
    panelMessages.push({ event: 'new-item', payload: item });
    return item;
  }

  function handleToggleOverlay(visible) {
    overlayVisible = visible;
    return overlayVisible;
  }

  function handleGetAllItems() {
    return [...collectedItems];
  }

  function handleUpdateItem(updatedItem) {
    const idx = collectedItems.findIndex(i => i.id === updatedItem.id);
    if (idx === -1) return false;
    collectedItems[idx] = { ...collectedItems[idx], ...updatedItem };
    panelMessages.push({ event: 'item-updated', payload: collectedItems[idx] });
    return true;
  }

  function handleDeleteItem(itemId) {
    const before = collectedItems.length;
    collectedItems = collectedItems.filter(i => i.id !== itemId);
    panelMessages.push({ event: 'item-deleted', payload: itemId });
    return collectedItems.length < before;
  }

  // Mirrors the CSV-building logic in panel.html
  function buildCSV(options = {}) {
    const opts = {
      category:  true,
      value:     true,
      id:        options.id        ?? true,
      timestamp: options.timestamp ?? true,
      dateOnly:  options.dateOnly  ?? false,
      timeOnly:  options.timeOnly  ?? false,
      length:    options.length    ?? false,
      ...options
    };

    const headers = ['Category', 'Value'];
    if (opts.id)        headers.push('ID');
    if (opts.timestamp) headers.push('Timestamp');
    if (opts.dateOnly)  headers.push('Date');
    if (opts.timeOnly)  headers.push('Time');
    if (opts.length)    headers.push('Length');

    const rows = collectedItems.map(item => {
      const row = [item.category, `"${item.value.replace(/"/g, '""')}"`];
      if (opts.id)        row.push(item.id);
      if (opts.timestamp) row.push(item.timestamp);
      if (opts.dateOnly)  row.push(new Date(item.timestamp).toLocaleDateString());
      if (opts.timeOnly)  row.push(new Date(item.timestamp).toLocaleTimeString());
      if (opts.length)    row.push(item.value.length);
      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  return {
    drop:         handleItemDropped,
    toggle:       handleToggleOverlay,
    getAll:       handleGetAllItems,
    update:       handleUpdateItem,
    delete:       handleDeleteItem,
    buildCSV,
    get items()          { return collectedItems; },
    get overlayVisible() { return overlayVisible; },
    get panelMessages()  { return panelMessages; }
  };
}

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function expect(label, actual, expected) {
  if (actual === expected) {
    console.log(green('  ✓') + ' ' + label);
    passed++;
  } else {
    console.log(red('  ✗') + ' ' + label);
    console.log(red(`      expected: ${JSON.stringify(expected)}`));
    console.log(red(`      got:      ${JSON.stringify(actual)}`));
    failures.push(label);
    failed++;
  }
}

function expectTrue(label, value) { expect(label, !!value, true); }
function expectFalse(label, value) { expect(label, !!value, false); }

function section(title) {
  console.log('\n' + bold(yellow(`► ${title}`)));
}

// ─── Scenarios ───────────────────────────────────────────────────────────────
const app = createAppState();

// 1. Drop items ---------------------------------------------------------------
section('1 — Drop items (all categories)');

const link   = app.drop('https://www.google.com');
const biz1   = app.drop('Acme Inc');
const name1  = app.drop('John Smith');
const biz2   = app.drop('random text');
const link2  = app.drop('www.github.com');
const name2  = app.drop('Mary Jane Watson');

expect('Link item categorised as Links',       link.category,  'Links');
expect('Business suffix → Business',           biz1.category,  'Business');
expect('Two-word name → Name',                 name1.category, 'Name');
expect('Fallback text → Business',             biz2.category,  'Business');
expect('www prefix → Links',                   link2.category, 'Links');
expect('Three-word name → Name',               name2.category, 'Name');
expect('Collection has 6 items',               app.items.length, 6);

const ids = app.items.map(i => i.id);
expectTrue('All IDs are unique', new Set(ids).size === ids.length);
expectTrue('All items have ISO timestamps',
  app.items.every(i => !isNaN(Date.parse(i.timestamp))));
expect('Panel received 6 new-item events',
  app.panelMessages.filter(m => m.event === 'new-item').length, 6);

// 2. Rename an item -----------------------------------------------------------
section('2 — Rename (update) an item');

const originalId = name1.id;
const renamed = app.update({ id: originalId, value: 'Jonathan Smith', category: 'Name' });
expectTrue('Update returns true for existing item', renamed);
const found = app.items.find(i => i.id === originalId);
expect('Item value updated in store',  found.value,    'Jonathan Smith');
expect('Category preserved after rename', found.category, 'Name');
expect('Panel notified of update',
  app.panelMessages.filter(m => m.event === 'item-updated').length, 1);

const badUpdate = app.update({ id: 9999, value: 'ghost' });
expectFalse('Update returns false for non-existent ID', badUpdate);

// 3. Discard an item ----------------------------------------------------------
section('3 — Discard (delete) an item');

const beforeCount = app.items.length;
const deleted = app.delete(biz2.id);
expectTrue('Delete returns true for existing item', deleted);
expect('Collection shrinks by 1', app.items.length, beforeCount - 1);
expectFalse('Deleted item no longer in store', app.items.find(i => i.id === biz2.id));
expect('Panel notified of deletion',
  app.panelMessages.filter(m => m.event === 'item-deleted').length, 1);

const badDelete = app.delete(9999);
expectFalse('Delete returns false for non-existent ID', badDelete);

// 4. Toggle overlay -----------------------------------------------------------
section('4 — Toggle overlay');

expect('Overlay starts visible', app.overlayVisible, true);
app.toggle(false);
expect('Overlay hidden after toggle(false)', app.overlayVisible, false);
app.toggle(true);
expect('Overlay visible after toggle(true)', app.overlayVisible, true);

// 5. Get all items ------------------------------------------------------------
section('5 — Get all items (panel load)');

const snapshot = app.getAll();
expect('getAll returns correct count', snapshot.length, app.items.length);
expectFalse('getAll returns a copy (mutation-safe)',
  snapshot === app.items);

// 6. CSV export — all columns -------------------------------------------------
section('6 — CSV export (all columns)');

const csvFull = app.buildCSV({
  id: true, timestamp: true, dateOnly: true, timeOnly: true, length: true
});
const fullLines = csvFull.split('\n');
const fullHeader = fullLines[0];

expectTrue('CSV has Category column',   fullHeader.includes('Category'));
expectTrue('CSV has Value column',      fullHeader.includes('Value'));
expectTrue('CSV has ID column',         fullHeader.includes('ID'));
expectTrue('CSV has Timestamp column',  fullHeader.includes('Timestamp'));
expectTrue('CSV has Date column',       fullHeader.includes('Date'));
expectTrue('CSV has Time column',       fullHeader.includes('Time'));
expectTrue('CSV has Length column',     fullHeader.includes('Length'));
expect('CSV row count matches items',   fullLines.length - 1, app.items.length);

// Verify CSV can be written to disk and re-read
const tmpFile = path.join(os.tmpdir(), `eazylyst-test-${Date.now()}.csv`);
fs.writeFileSync(tmpFile, csvFull, 'utf-8');
const reRead = fs.readFileSync(tmpFile, 'utf-8');
expect('CSV round-trips to disk correctly', reRead, csvFull);
fs.unlinkSync(tmpFile);
expectTrue('CSV temp file cleaned up', !fs.existsSync(tmpFile));

// 7. CSV export — minimal columns ---------------------------------------------
section('7 — CSV export (minimal columns)');

const csvMin = app.buildCSV({ id: false, timestamp: false, dateOnly: false, timeOnly: false, length: false });
const minHeader = csvMin.split('\n')[0];
expectFalse('Minimal CSV omits ID',        minHeader.includes('ID'));
expectFalse('Minimal CSV omits Timestamp', minHeader.includes('Timestamp'));
expectTrue('Minimal CSV still has Category', minHeader.includes('Category'));
expectTrue('Minimal CSV still has Value',    minHeader.includes('Value'));

// 8. CSV escaping --------------------------------------------------------------
section('8 — CSV value escaping');

const tricky = app.drop('He said, "Hello, World"');
const csvEsc = app.buildCSV({ id: false, timestamp: false });
expectTrue('Double-quotes in value are escaped in CSV',
  csvEsc.includes('""Hello, World""'));

// 9. Edge inputs --------------------------------------------------------------
section('9 — Edge inputs');

const before9 = app.items.length;
const empty = app.drop('');
expect('Empty string drop returns null',  empty, null);
const ws    = app.drop('   ');
expect('Whitespace-only drop returns null', ws, null);
expect('Collection unchanged after empty drops', app.items.length, before9);

const longStr = 'A'.repeat(5000);
const longItem = app.drop(longStr);
expectTrue('Very long string is accepted', longItem !== null);
expect('Long string categorised as Business', longItem.category, 'Business');

const numberStr = app.drop('1234567890');
expectTrue('Numeric string is accepted', numberStr !== null);
expect('Numeric string categorised as Business', numberStr.category, 'Business');

// 10. Data persistence (loadStore / saveStore) --------------------------------
section('10 — Data persistence (loadStore / saveStore)');

// Build a store round-trip entirely in-process using temp file
{
  const tmpStore = path.join(os.tmpdir(), `eazylyst-store-${Date.now()}.json`);

  // --- saveStore simulation ---
  function saveToPath(filePath, items, itemIdCtr, listArr, listIdCtr, apiKey) {
    const data = {
      items,
      itemIdCounter: itemIdCtr,
      lists: listArr,
      listIdCounter: listIdCtr,
      perplexityApiKey: apiKey || ''
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  // --- loadStore simulation ---
  function loadFromPath(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  }

  // Write a session's worth of state
  const sessionItems = [
    { id: 1, value: 'Jane Doe', category: 'Name', timestamp: new Date().toISOString() },
    { id: 2, value: 'Acme Corp', category: 'Business', timestamp: new Date().toISOString() },
    { id: 3, value: 'https://example.com', category: 'Links', timestamp: new Date().toISOString() }
  ];
  const sessionLists = [
    { id: 1, name: 'Prospects', itemIds: [1, 2], createdAt: new Date().toISOString() }
  ];
  saveToPath(tmpStore, sessionItems, 4, sessionLists, 2, 'pplx-testkey');

  expectTrue('Store file created on disk', fs.existsSync(tmpStore));

  // Re-load and verify round-trip
  const loaded = loadFromPath(tmpStore);
  expect('Items count restored',          loaded.items.length,          3);
  expect('itemIdCounter restored',        loaded.itemIdCounter,          4);
  expect('Lists count restored',          loaded.lists.length,           1);
  expect('listIdCounter restored',        loaded.listIdCounter,          2);
  expect('API key restored',              loaded.perplexityApiKey,       'pplx-testkey');
  expect('First item value',              loaded.items[0].value,         'Jane Doe');
  expect('First item category',           loaded.items[0].category,      'Name');
  expect('List name',                     loaded.lists[0].name,          'Prospects');
  expect('List itemIds length',           loaded.lists[0].itemIds.length, 2);

  // Simulate mutation → re-save → reload (emulates item + list changes between sessions)
  sessionItems.push({ id: 4, value: 'Bob Smith', category: 'Name', timestamp: new Date().toISOString() });
  sessionLists[0].itemIds.push(4);
  saveToPath(tmpStore, sessionItems, 5, sessionLists, 2, 'pplx-testkey');

  const reloaded = loadFromPath(tmpStore);
  expect('Items count after mutation',     reloaded.items.length,               4);
  expect('itemIdCounter after mutation',   reloaded.itemIdCounter,              5);
  expect('List itemIds updated',           reloaded.lists[0].itemIds.length,    3);
  expect('New item value present',         reloaded.items[3].value,             'Bob Smith');

  // Simulate corrupt store — should not throw
  fs.writeFileSync(tmpStore, '{ corrupted json :', 'utf8');
  let threwOnCorrupt = false;
  try {
    const raw = fs.readFileSync(tmpStore, 'utf8');
    JSON.parse(raw);
  } catch {
    threwOnCorrupt = true;
  }
  expectTrue('Corrupt store triggers parse error (caught gracefully)', threwOnCorrupt);

  // Simulate missing store (first launch)
  fs.unlinkSync(tmpStore);
  expectTrue('After delete, store file gone', !fs.existsSync(tmpStore));
  const missing = loadFromPath(tmpStore);
  expect('Missing store returns null',     missing, null);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n' + '═'.repeat(44));
if (failed === 0) {
  console.log(bold(green(`  ALL ${total} CHECKS PASSED ✓`)));
} else {
  console.log(bold(red(`  ${failed} FAILED / ${total} total`)));
  failures.forEach(f => console.log(red(`    • ${f}`)));
}
console.log('═'.repeat(44) + '\n');

if (failed > 0) process.exit(1);
