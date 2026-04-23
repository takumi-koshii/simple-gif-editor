import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, cleanupOnQuit } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Simple GIF Editor',
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  cleanupOnQuit();
  app.quit();
});
