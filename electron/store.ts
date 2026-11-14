import { app, dialog, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createEmptyAsset, kindNames } from '../shared/defaults';
import { cardData, characterName, toV2Card } from '../shared/card';
import { fileHash, readCharacterPng, writeCharacterPng } from './png';
import type { AiProvider, Asset, AssetGroup, AssetKind, AssetVersion, ImportResult, PublicAiProvider, TestRun, WorkspaceData } from '../shared/types';

interface PersistedData {
  workspace: WorkspaceData;
  providers: AiProvider[];
  tests: TestRun[];
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class Store {
  private data: PersistedData = { workspace: { assets: [], versions: {}, groups: [] }, providers: [], tests: [] };
  private file = '';
  private originals = '';

  init(): void {
    const root = path.join(app.getPath('userData'), 'atelier-data');
    this.originals = path.join(root, 'originals');
    fs.mkdirSync(this.originals, { recursive: true });
    this.file = path.join(root, 'workspace.json');
    if (fs.existsSync(this.file)) this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')) as PersistedData;
    if (!Array.isArray(this.data.workspace.groups)) this.data.workspace.groups = [];
    for (const asset of this.data.workspace.assets) {
      const versions = this.data.workspace.versions[asset.id] ?? [];
      if (!Number.isFinite(asset.currentVersion)) asset.currentVersion = Math.max(1, ...versions.map((version) => version.version || 0));
      asset.tags = Array.isArray(asset.tags) ? asset.tags : [];
      asset.relations = Array.isArray(asset.relations) ? asset.relations : [];
      asset.summary = typeof asset.summary === 'string' ? asset.summary : '';
      asset.favorite = asset.favorite === true;
      asset.groupIds = Array.isArray(asset.groupIds) ? asset.groupIds : [];
    }
  }

  private persist(): void {
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(temporary, this.file);
  }

  workspace(): WorkspaceData {
    return clone(this.data.workspace);
  }

  private addAsset(input: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'groupIds'> & { groupIds?: string[] }): Asset {
    const now = new Date().toISOString();
    const asset: Asset = { ...input, groupIds: clone(input.groupIds ?? []), id: randomUUID(), createdAt: now, updatedAt: now, currentVersion: 1 };
    this.data.workspace.assets.unshift(asset);
    this.data.workspace.versions[asset.id] = [{
      id: randomUUID(), version: 1, createdAt: now, message: '初始版本',
      data: clone(asset.data), name: asset.name, tags: clone(asset.tags),
      summary: asset.summary, relations: clone(asset.relations), favorite: asset.favorite, groupIds: clone(asset.groupIds),
    }];
    return asset;
  }

  create(kind: AssetKind): Asset {
    const asset = this.addAsset(createEmptyAsset(kind));
    this.persist();
    return clone(asset);
  }

  save(input: Asset, message = '手动保存'): Asset {
    const index = this.data.workspace.assets.findIndex((item) => item.id === input.id);
    if (index < 0) throw new Error('素材不存在');
    const previous = this.data.workspace.assets[index];
    if (input.currentVersion !== previous.currentVersion) {
      throw new Error(`保存冲突：库中已是 v${previous.currentVersion}，当前草稿基于 v${input.currentVersion}。请重新打开最新版本后再保存。`);
    }
    const previousVersion = Number.isFinite(previous.currentVersion) ? previous.currentVersion : Math.max(0, ...(this.data.workspace.versions[previous.id] ?? []).map((version) => version.version || 0));
    const draftVersion = Number.isFinite(input.currentVersion) ? input.currentVersion : previousVersion;
    if (draftVersion !== previousVersion) throw new Error('保存冲突：当前草稿版本无效，请重新打开素材。');
    const version = previousVersion + 1;
    const asset: Asset = { ...clone(input), currentVersion: version, createdAt: previous.createdAt, updatedAt: new Date().toISOString() };
    this.data.workspace.assets[index] = asset;
    const record: AssetVersion = {
      id: randomUUID(), version, createdAt: asset.updatedAt, message,
      data: clone(asset.data), name: asset.name, tags: clone(asset.tags),
      summary: asset.summary, relations: clone(asset.relations), favorite: asset.favorite, groupIds: clone(asset.groupIds),
    };
    this.data.workspace.versions[asset.id] = [...(this.data.workspace.versions[asset.id] ?? []), record];
    this.persist();
    return clone(asset);
  }

  remove(id: string): void {
    this.data.workspace.assets = this.data.workspace.assets.filter((asset) => asset.id !== id);
    delete this.data.workspace.versions[id];
    for (const asset of this.data.workspace.assets) asset.relations = asset.relations.filter((relation) => relation.targetId !== id);
    this.persist();
  }

  restore(id: string, version: number): Asset {
    const asset = this.data.workspace.assets.find((item) => item.id === id);
    const record = this.data.workspace.versions[id]?.find((item) => item.version === version);
    if (!asset || !record) throw new Error('目标版本不存在');
    return this.save({
      ...asset, data: clone(record.data), name: record.name ?? asset.name, tags: clone(record.tags ?? asset.tags),
      summary: record.summary ?? asset.summary, relations: clone(record.relations ?? asset.relations), favorite: record.favorite ?? asset.favorite, groupIds: clone(record.groupIds ?? asset.groupIds),
    }, `恢复自版本 ${version}`);
  }

  private detectKind(data: Record<string, unknown>): AssetKind {
    if (Array.isArray(data.prompts) || Array.isArray(data.prompt_order)) return 'preset';
    if (data.entries && typeof data.entries === 'object') return 'lorebook';
    if (typeof data.findRegex === 'string' || typeof data.scriptName === 'string') return 'regex';
    if (typeof data.spec === 'string' && data.spec.startsWith('chara_card')) return 'character';
    const candidate = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data as Record<string, unknown> : data;
    if (typeof candidate.name === 'string' && (candidate === data || ['description', 'personality', 'scenario', 'first_mes', 'mes_example'].some((key) => key in candidate))) return 'character';
    throw new Error('无法识别素材类型，请使用角色卡、世界书、正则或 Chat 预设 JSON');
  }

  private nameFor(kind: AssetKind, data: Record<string, unknown>, filename: string): string {
    if (kind === 'character') return characterName(data);
    if (kind === 'regex') return String(data.scriptName ?? path.parse(filename).name);
    return String(data.name ?? data.comment ?? path.parse(filename).name);
  }

  private extractRelated(character: Asset): Asset[] {
    const related: Asset[] = [];
    const data = cardData(character.data);
    if (data.character_book && typeof data.character_book === 'object') {
      const book = this.addAsset({
        kind: 'lorebook', name: `${character.name} · 内嵌世界书`, summary: `提取自 ${character.sourceName ?? character.name}`,
        tags: ['角色内嵌'], favorite: false, data: clone(data.character_book as Record<string, unknown>),
        relations: [{ targetId: character.id, type: 'embedded-book' }],
      });
      character.relations.push({ targetId: book.id, type: 'embedded-book' });
      related.push(book);
    }
    const extensions = data.extensions as Record<string, unknown> | undefined;
    if (Array.isArray(extensions?.regex_scripts)) {
      for (const value of extensions.regex_scripts) {
        if (!value || typeof value !== 'object') continue;
        const regex = this.addAsset({
          kind: 'regex', name: this.nameFor('regex', value as Record<string, unknown>, character.name), summary: `提取自 ${character.name}`,
          tags: ['角色级'], favorite: false, data: clone(value as Record<string, unknown>),
          relations: [{ targetId: character.id, type: 'scoped-regex' }],
        });
        character.relations.push({ targetId: regex.id, type: 'scoped-regex' });
        related.push(regex);
      }
    }
    return related;
  }

  private extractPresetRelated(preset: Asset): Asset[] {
    const related: Asset[] = [];
    const extensions = preset.data.extensions as Record<string, unknown> | undefined;
    if (!Array.isArray(extensions?.regex_scripts)) return related;
    for (const value of extensions.regex_scripts) {
      if (!value || typeof value !== 'object') continue;
      const regex = this.addAsset({
        kind: 'regex', name: this.nameFor('regex', value as Record<string, unknown>, preset.name), summary: `提取自预设 ${preset.name}`,
        tags: ['预设级'], favorite: false, data: clone(value as Record<string, unknown>),
        relations: [{ targetId: preset.id, type: 'preset-regex' }],
      });
      preset.relations.push({ targetId: regex.id, type: 'preset-regex' });
      related.push(regex);
    }
    this.data.workspace.versions[preset.id][0].relations = clone(preset.relations);
    return related;
  }

  async importFiles(): Promise<ImportResult | null> {
    const selected = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '酒馆素材', extensions: ['json', 'png'] }],
    });
    if (selected.canceled) return null;
    const imported: Asset[] = [];
    const warnings: string[] = [];
    for (const filename of selected.filePaths) {
      const buffer = fs.readFileSync(filename);
      const hash = fileHash(buffer);
      if (this.data.workspace.assets.some((asset) => asset.fileHash === hash)) {
        warnings.push(`${path.basename(filename)}：文件内容已存在，已跳过。`);
        continue;
      }
      try {
        const isPng = path.extname(filename).toLowerCase() === '.png';
        const parsed = isPng ? readCharacterPng(buffer) : { data: JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>, warnings: [] };
        if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) throw new Error('JSON 顶层必须是对象');
        const kind = isPng ? 'character' : this.detectKind(parsed.data);
        const originalPath = path.join(this.originals, `${hash}${isPng ? '.png' : '.json'}`);
        fs.writeFileSync(originalPath, buffer);
        const asset = this.addAsset({
          kind, name: this.nameFor(kind, parsed.data, filename), summary: '', tags: [], favorite: false,
          data: parsed.data, sourceName: path.basename(filename), sourceFormat: isPng ? 'png' : 'json',
          originalPath, fileHash: hash, relations: [],
        });
        imported.push(asset);
        if (kind === 'character') {
          imported.push(...this.extractRelated(asset));
          this.data.workspace.versions[asset.id][0].relations = clone(asset.relations);
        }
        if (kind === 'preset') imported.push(...this.extractPresetRelated(asset));
        warnings.push(...parsed.warnings);
      } catch (error) {
        warnings.push(`${path.basename(filename)}：${error instanceof Error ? error.message : '导入失败'}`);
      }
    }
    if (imported.length) this.persist();
    return { imported: clone(imported), warnings };
  }

  async exportAsset(id: string, requested?: 'json' | 'png'): Promise<string | null> {
    const asset = this.data.workspace.assets.find((item) => item.id === id);
    if (!asset) throw new Error('素材不存在');
    const format = requested ?? 'json';
    if (format === 'png' && asset.kind !== 'character') throw new Error('只有角色卡可以导出 PNG');
    const selected = await dialog.showSaveDialog({
      defaultPath: `${asset.name.replace(/[<>:"/\\|?*]/g, '_')}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (selected.canceled || !selected.filePath) return null;
    if (format === 'png') {
      if (!asset.originalPath || asset.sourceFormat !== 'png' || !fs.existsSync(asset.originalPath)) {
        throw new Error('该角色没有原始 PNG。请先导入 PNG 角色卡，或使用 JSON 导出。');
      }
      fs.writeFileSync(selected.filePath, writeCharacterPng(fs.readFileSync(asset.originalPath), asset.data));
    } else {
      const data = asset.kind === 'character' ? toV2Card(asset.data) : asset.data;
      fs.writeFileSync(selected.filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    return selected.filePath;
  }

  private publicProviders(): PublicAiProvider[] {
    return this.data.providers.map(({ encryptedKey: _encryptedKey, ...provider }) => ({ ...provider, hasKey: Boolean(_encryptedKey) }));
  }

  providers(): PublicAiProvider[] {
    return this.publicProviders();
  }

  saveProvider(input: PublicAiProvider & { apiKey?: string }): PublicAiProvider[] {
    const existing = this.data.providers.find((provider) => provider.id === input.id);
    const endpointChanged = existing ? existing.baseUrl !== input.baseUrl : false;
    let encryptedKey = endpointChanged ? undefined : existing?.encryptedKey;
    if (input.apiKey) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用，未保存 API 密钥');
      encryptedKey = safeStorage.encryptString(input.apiKey).toString('base64');
    }
    const provider: AiProvider = { id: input.id || randomUUID(), name: input.name, baseUrl: input.baseUrl, model: input.model, encryptedKey };
    if (existing) Object.assign(existing, provider);
    else this.data.providers.push(provider);
    this.persist();
    return this.publicProviders();
  }

  removeProvider(id: string): PublicAiProvider[] {
    this.data.providers = this.data.providers.filter((provider) => provider.id !== id);
    this.persist();
    return this.publicProviders();
  }

  provider(id: string): AiProvider & { apiKey: string } {
    const provider = this.data.providers.find((item) => item.id === id);
    if (!provider) throw new Error('AI 服务不存在');
    let apiKey = '';
    if (provider.encryptedKey) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('当前无法解密 API 密钥');
      apiKey = safeStorage.decryptString(Buffer.from(provider.encryptedKey, 'base64'));
    }
    return { ...provider, apiKey };
  }

  addTest(test: TestRun): void {
    this.data.tests.unshift(test);
    this.data.tests = this.data.tests.slice(0, 50);
    this.persist();
  }

  tests(): TestRun[] { return clone(this.data.tests); }

  clearTests(): void { this.data.tests = []; this.persist(); }

  async backup(): Promise<string | null> {
    const selected = await dialog.showSaveDialog({ defaultPath: `tavern-atelier-backup-${new Date().toISOString().slice(0, 10)}.json` });
    if (selected.canceled || !selected.filePath) return null;
    const originalFiles: Record<string, { name: string; data: string }> = {};
    for (const asset of this.data.workspace.assets) {
      if (asset.originalPath && fs.existsSync(asset.originalPath)) {
        originalFiles[asset.id] = { name: path.basename(asset.originalPath), data: fs.readFileSync(asset.originalPath).toString('base64') };
      }
    }
    const backup = {
      format: 'tavern-atelier-backup', version: 1, createdAt: new Date().toISOString(),
      workspace: this.data.workspace, tests: this.data.tests,
      providers: this.data.providers.map(({ encryptedKey: _encryptedKey, ...provider }) => provider), originalFiles,
    };
    fs.writeFileSync(selected.filePath, JSON.stringify(backup), 'utf8');
    return selected.filePath;
  }

  async restoreBackup(): Promise<boolean> {
    const selected = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '工坊备份', extensions: ['json'] }] });
    if (selected.canceled) return false;
    const backup = JSON.parse(fs.readFileSync(selected.filePaths[0], 'utf8')) as {
      format?: string; workspace?: WorkspaceData; providers?: AiProvider[]; tests?: TestRun[];
      originalFiles?: Record<string, { name: string; data: string }>;
    };
    if (backup.format !== 'tavern-atelier-backup' || !backup.workspace?.assets) throw new Error('不是有效的工坊备份');
    if (!Array.isArray(backup.workspace.groups)) backup.workspace.groups = [];
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.before-restore-${Date.now()}`);
    for (const asset of backup.workspace.assets) {
      const original = backup.originalFiles?.[asset.id];
      if (original) {
        const destination = path.join(this.originals, original.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
        fs.writeFileSync(destination, Buffer.from(original.data, 'base64'));
        asset.originalPath = destination;
      }
    }
    const providers = (backup.providers ?? []).map((provider) => ({
      ...provider,
      encryptedKey: this.data.providers.find((current) => current.id === provider.id && current.baseUrl === provider.baseUrl)?.encryptedKey,
    }));
    this.data = { workspace: backup.workspace, providers, tests: backup.tests ?? [] };
    this.persist();
    return true;
  }

  asset(id: string): Asset {
    const asset = this.data.workspace.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`${kindNames[id as AssetKind] ?? '素材'}不存在`);
    return asset;
  }

  groups(): AssetGroup[] {
    return clone(this.data.workspace.groups);
  }

  createGroup(name: string): AssetGroup[] {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('分组名称不能为空');
    if (this.data.workspace.groups.some((group) => group.name === trimmed)) throw new Error(`分组“${trimmed}”已存在`);
    this.data.workspace.groups.push({ id: randomUUID(), name: trimmed, createdAt: new Date().toISOString() });
    this.persist();
    return clone(this.data.workspace.groups);
  }

  renameGroup(id: string, name: string): AssetGroup[] {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('分组名称不能为空');
    const group = this.data.workspace.groups.find((item) => item.id === id);
    if (!group) throw new Error('分组不存在');
    if (this.data.workspace.groups.some((item) => item.id !== id && item.name === trimmed)) throw new Error(`分组“${trimmed}”已存在`);
    group.name = trimmed;
    this.persist();
    return clone(this.data.workspace.groups);
  }

  removeGroup(id: string): AssetGroup[] {
    this.data.workspace.groups = this.data.workspace.groups.filter((group) => group.id !== id);
    for (const asset of this.data.workspace.assets) asset.groupIds = asset.groupIds.filter((groupId) => groupId !== id);
    this.persist();
    return clone(this.data.workspace.groups);
  }
}
