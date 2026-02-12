const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eazy', {
  sendDrop: (text) => ipcRenderer.send('item-dropped', text),
  onAddItem: (cb) => ipcRenderer.on('add-item', (_e, text) => cb(text)),
  toggleCircle: () => ipcRenderer.send('toggle-circle'),
  saveCSV: (csv) => ipcRenderer.invoke('save-csv', csv)
});
