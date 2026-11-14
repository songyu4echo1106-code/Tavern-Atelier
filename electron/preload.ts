import { contextBridge, ipcRenderer } from 'electron';
import type { AppApi } from '../shared/types';

const api: AppApi = {
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    create: (kind) => ipcRenderer.invoke('library:create', kind),
    save: (asset, message) => ipcRenderer.invoke('library:save', asset, message),
    remove: (id) => ipcRenderer.invoke('library:remove', id),
    restore: (id, version) => ipcRenderer.invoke('library:restore', id, version),
    import: () => ipcRenderer.invoke('library:import'),
    export: (id, format) => ipcRenderer.invoke('library:export', id, format),
  },
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    save: (provider) => ipcRenderer.invoke('providers:save', provider),
    remove: (id) => ipcRenderer.invoke('providers:remove', id),
  },
  ai: {
    testPreset: (presetId, providerId, input, characterId) => ipcRenderer.invoke('ai:test-preset', presetId, providerId, input, characterId),
    assist: (providerId, task, content, instruction) => ipcRenderer.invoke('ai:assist', providerId, task, content, instruction),
  },
  tests: { list: () => ipcRenderer.invoke('tests:list'), clear: () => ipcRenderer.invoke('tests:clear') },
  backup: { create: () => ipcRenderer.invoke('backup:create'), restore: () => ipcRenderer.invoke('backup:restore') },
  groups: {
    create: (name) => ipcRenderer.invoke('groups:create', name),
    rename: (id, name) => ipcRenderer.invoke('groups:rename', id, name),
    remove: (id) => ipcRenderer.invoke('groups:remove', id),
  },
};

contextBridge.exposeInMainWorld('tavern', api);
