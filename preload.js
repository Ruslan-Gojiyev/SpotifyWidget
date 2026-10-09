
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spotify', {
    connect: () => ipcRenderer.invoke('spotify:connect'),
    getCurrentTrack: () => ipcRenderer.invoke('spotify:current-track'),
    control: (action) => ipcRenderer.invoke('spotify:control', action)
});
