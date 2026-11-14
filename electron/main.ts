import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import { Store } from './store';
import { assist, testPreset } from './ai';
import type { Asset, AssetKind, PublicAiProvider } from '../shared/types';

const store = new Store();

function registerIpc(): void {
  ipcMain.handle('library:list', () => store.workspace());
  ipcMain.handle('library:create', (_event, kind: AssetKind) => store.create(kind));
  ipcMain.handle('library:save', (_event, asset: Asset, message?: string) => store.save(asset, message));
  ipcMain.handle('library:remove', (_event, id: string) => store.remove(id));
  ipcMain.handle('library:restore', (_event, id: string, version: number) => store.restore(id, version));
  ipcMain.handle('library:import', () => store.importFiles());
  ipcMain.handle('library:import-blobs', (_event, files: { name: string; data: string }[]) => store.importBlobs(files));
  ipcMain.handle('library:export', (_event, id: string, format?: 'json' | 'png') => store.exportAsset(id, format));
  ipcMain.handle('library:pick-avatar', () => store.pickAvatar());
  ipcMain.handle('library:set-avatar', (_event, id: string, avatar: { kind: 'local' | 'url'; value: string } | null) => store.setAvatar(id, avatar));
  ipcMain.handle('library:image-data', (_event, filePath: string) => store.imageData(filePath));
  ipcMain.handle('providers:list', () => store.providers());
  ipcMain.handle('providers:save', (_event, provider: PublicAiProvider & { apiKey?: string }) => store.saveProvider(provider));
  ipcMain.handle('providers:remove', (_event, id: string) => store.removeProvider(id));
  ipcMain.handle('ai:test-preset', (_event, presetId: string, providerId: string, input: string, characterId?: string) => testPreset(store, presetId, providerId, input, characterId));
  ipcMain.handle('ai:assist', (_event, providerId: string, task: string, content: string, instruction: string) => assist(store, providerId, task, content, instruction));
  ipcMain.handle('tests:list', () => store.tests());
  ipcMain.handle('tests:clear', () => store.clearTests());
  ipcMain.handle('backup:create', () => store.backup());
  ipcMain.handle('backup:restore', () => store.restoreBackup());
  ipcMain.handle('groups:list', () => store.groups());
  ipcMain.handle('groups:create', (_event, name: string) => store.createGroup(name));
  ipcMain.handle('groups:rename', (_event, id: string, name: string) => store.renameGroup(id, name));
  ipcMain.handle('groups:remove', (_event, id: string) => store.removeGroup(id));
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1100, minHeight: 720,
    show: false, backgroundColor: '#f4f1eb', title: '酒馆工坊',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (!devUrl || !url.startsWith(devUrl)) event.preventDefault();
  });
  if (process.env.VITE_DEV_SERVER_URL) await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await window.loadFile(path.join(__dirname, '../../dist/index.html'));
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  store.init();
  registerIpc();
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
