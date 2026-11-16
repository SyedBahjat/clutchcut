'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipper', {
  pick: () => ipcRenderer.invoke('pick'),
  clip: (job) => ipcRenderer.invoke('clip', job),
  recut: (job) => ipcRenderer.invoke('recut', job),
  reveal: (file) => ipcRenderer.invoke('reveal', file),
  save: (file) => ipcRenderer.invoke('save', file),
  remove: (file) => ipcRenderer.invoke('remove', file),
  onProgress: (fn) => ipcRenderer.on('progress', (_event, msg) => fn(msg)),
});
