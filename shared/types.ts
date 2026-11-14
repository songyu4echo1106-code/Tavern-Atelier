export type AssetKind = 'character' | 'lorebook' | 'regex' | 'preset';

export interface AssetRelation {
  targetId: string;
  type: 'embedded-book' | 'scoped-regex' | 'preset-regex' | 'related';
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  summary: string;
  tags: string[];
  favorite: boolean;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  sourceName?: string;
  sourceFormat?: 'png' | 'json';
  originalPath?: string;
  fileHash?: string;
  relations: AssetRelation[];
  groupIds: string[];
}

export interface AssetGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface AssetVersion {
  id: string;
  version: number;
  createdAt: string;
  message: string;
  data: Record<string, unknown>;
  name: string;
  tags: string[];
  summary: string;
  relations: AssetRelation[];
  favorite: boolean;
  groupIds: string[];
}

export interface WorkspaceData {
  assets: Asset[];
  versions: Record<string, AssetVersion[]>;
  groups: AssetGroup[];
}

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  encryptedKey?: string;
}

export interface PublicAiProvider extends Omit<AiProvider, 'encryptedKey'> {
  hasKey: boolean;
}

export interface TestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TestRun {
  id: string;
  createdAt: string;
  presetId: string;
  presetVersion: number;
  providerName: string;
  model: string;
  request: Record<string, unknown>;
  messages: TestMessage[];
  response: string;
  rawResponse?: unknown;
  durationMs: number;
  error?: string;
}

export interface ImportResult {
  imported: Asset[];
  warnings: string[];
}

export interface AppApi {
  library: {
    list: () => Promise<WorkspaceData>;
    create: (kind: AssetKind) => Promise<Asset>;
    save: (asset: Asset, message?: string) => Promise<Asset>;
    remove: (id: string) => Promise<void>;
    restore: (id: string, version: number) => Promise<Asset>;
    import: () => Promise<ImportResult | null>;
    export: (id: string, format?: 'json' | 'png') => Promise<string | null>;
  };
  providers: {
    list: () => Promise<PublicAiProvider[]>;
    save: (provider: PublicAiProvider & { apiKey?: string }) => Promise<PublicAiProvider[]>;
    remove: (id: string) => Promise<PublicAiProvider[]>;
  };
  ai: {
    testPreset: (presetId: string, providerId: string, input: string, characterId?: string) => Promise<TestRun>;
    assist: (providerId: string, task: string, content: string, instruction: string) => Promise<string>;
  };
  tests: {
    list: () => Promise<TestRun[]>;
    clear: () => Promise<void>;
  };
  backup: {
    create: () => Promise<string | null>;
    restore: () => Promise<boolean>;
  };
  groups: {
    create: (name: string) => Promise<AssetGroup[]>;
    rename: (id: string, name: string) => Promise<AssetGroup[]>;
    remove: (id: string) => Promise<AssetGroup[]>;
  };
}

declare global {
  interface Window {
    tavern: AppApi;
  }
}
