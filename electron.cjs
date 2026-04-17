const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const SETTINGS_PATH = path.join(app.getPath('userData'), 'voicedoc-settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'VoiceDoc AI',
    backgroundColor: '#0D1B2A',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load from Vite dev server or built files
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC Handlers ───────────────────────────────────────────────────────────

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Word Document',
    filters: [{ name: 'Word Documents', extensions: ['docx'] }],
    properties: ['openFile'],
    defaultPath: 'C:\\',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-file-dialog', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Document',
    defaultPath: path.join(app.getPath('documents'), defaultName || 'document.docx'),
    filters: [{ name: 'Word Documents', extensions: ['docx'] }],
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  } catch (e) {
    throw new Error(`Failed to read file: ${e.message}`);
  }
});

ipcMain.handle('write-file', async (event, filePath, base64data) => {
  try {
    const buffer = Buffer.from(base64data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (e) {
    throw new Error(`Failed to write file: ${e.message}`);
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('documents');
});

// ─── Secure Settings Storage ────────────────────────────────────────────────

ipcMain.handle('save-secure-setting', async (event, key, value) => {
  try {
    const settings = loadSettings();
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      settings[key] = { encrypted: true, data: encrypted.toString('base64') };
    } else {
      settings[key] = { encrypted: false, data: value };
    }
    saveSettings(settings);
    return true;
  } catch (e) {
    throw new Error(`Failed to save setting: ${e.message}`);
  }
});

ipcMain.handle('load-secure-setting', async (event, key) => {
  try {
    const settings = loadSettings();
    const setting = settings[key];
    if (!setting) return null;
    if (setting.encrypted && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(setting.data, 'base64');
      return safeStorage.decryptString(buffer);
    }
    return setting.data || null;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('save-setting', async (event, key, value) => {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
  return true;
});

ipcMain.handle('load-setting', async (event, key) => {
  const settings = loadSettings();
  return settings[key] ?? null;
});

// ─── File download from URL ────────────────────────────────────────────────

ipcMain.handle('download-file', async (event, url) => {
  try {
    const { net } = require('electron');
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      const chunks = [];
      request.on('response', (response) => {
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const tempPath = path.join(app.getPath('temp'), `voicedoc_${Date.now()}.docx`);
          fs.writeFileSync(tempPath, buffer);
          resolve(tempPath);
        });
      });
      request.on('error', (e) => reject(new Error(`Download failed: ${e.message}`)));
      request.end();
    });
  } catch (e) {
    throw new Error(`Download failed: ${e.message}`);
  }
});
