const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile:          ()                 => ipcRenderer.invoke('open-file-dialog'),
  saveFile:          (name)             => ipcRenderer.invoke('save-file-dialog', name),
  readFile:          (filePath)         => ipcRenderer.invoke('read-file', filePath),
  writeFile:         (filePath, data)   => ipcRenderer.invoke('write-file', filePath, data),
  getDocsPath:       ()                 => ipcRenderer.invoke('get-app-path'),
  downloadFile:      (url)              => ipcRenderer.invoke('download-file', url),

  // Secure settings (API keys)
  saveSecureSetting: (key, value)       => ipcRenderer.invoke('save-secure-setting', key, value),
  loadSecureSetting: (key)              => ipcRenderer.invoke('load-secure-setting', key),

  // General settings
  saveSetting:       (key, value)       => ipcRenderer.invoke('save-setting', key, value),
  loadSetting:       (key)              => ipcRenderer.invoke('load-setting', key),
});
