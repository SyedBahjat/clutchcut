'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('clipper', {
  pathFor: (file) => webUtils.getPathForFile(file),
  pick: () => ipcRenderer.invoke('pick'),
  clip: (job) => ipcRenderer.invoke('clip', job),
  recut: (job) => ipcRenderer.invoke('recut', job),
  reveal: (file) => ipcRenderer.invoke('reveal', file),
  save: (file) => ipcRenderer.invoke('save', file),
  remove: (file) => ipcRenderer.invoke('remove', file),
  liveStop: () => ipcRenderer.invoke('live-stop'),
  onLive: (fn) => ipcRenderer.on('live-event', (_event, e) => fn(e)),
  star: () => ipcRenderer.invoke('star'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  onProgress: (fn) => ipcRenderer.on('progress', (_event, msg) => fn(msg)),
  onPrefill: (fn) => ipcRenderer.on('prefill', (_event, link) => fn(link)),
});
