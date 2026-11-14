import { randomUUID } from 'node:crypto';
import { cardData } from '../shared/card';
import type { AiProvider, Asset, TestMessage, TestRun } from '../shared/types';
import type { Store } from './store';
import { flattenPromptOrder } from '../shared/preset';

interface PromptEntry {
  identifier: string;
  name?: string;
  role?: 'system' | 'user' | 'assistant';
  content?: string;
  marker?: boolean;
  injection_position?: number;
  injection_depth?: number;
  injection_order?: number;
}

function macros(value: string, character?: Asset): string {
  return value.replaceAll('{{char}}', character?.name ?? 'Character').replaceAll('{{user}}', 'User');
}

function bookEntries(book: Asset): Record<string, unknown>[] {
  const entries = book.data.entries;
  if (Array.isArray(entries)) return entries.filter((entry) => entry && typeof entry === 'object');
  if (entries && typeof entries === 'object') return Object.values(entries).filter((entry) => entry && typeof entry === 'object') as Record<string, unknown>[];
  return [];
}

function activeLore(books: Asset[], input: string, format: string): string {
  const lower = input.toLowerCase();
  const activated = books.flatMap((book) => bookEntries(book)).filter((entry) => {
    if (entry.disable === true || entry.enabled === false) return false;
    if (entry.constant === true) return true;
    const keys = Array.isArray(entry.key) ? entry.key : Array.isArray(entry.keys) ? entry.keys : [];
    return keys.some((key) => typeof key === 'string' && key && lower.includes(key.toLowerCase()));
  }).sort((a, b) => Number(a.order ?? a.insertion_order ?? 0) - Number(b.order ?? b.insertion_order ?? 0));
  return activated.map((entry) => String(entry.content ?? '')).filter(Boolean).map((content) => format.replaceAll('{0}', content)).join('\n');
}

function compileMessages(preset: Asset, character: Asset | undefined, input: string, books: Asset[]): TestMessage[] {
  const prompts = (Array.isArray(preset.data.prompts) ? preset.data.prompts : []) as PromptEntry[];
  const configuredOrder = flattenPromptOrder(preset.data.prompt_order);
  const order = configuredOrder.length ? configuredOrder : prompts.map((prompt) => ({ identifier: prompt.identifier, enabled: true }));
  const card = character ? cardData(character.data) : {};
  const format = String(preset.data.wi_format ?? '{0}');
  const lore = activeLore(books, input, format);
  const messages: TestMessage[] = [];
  const injections: { depth: number; order: number; message: TestMessage }[] = [];
  const markerContent = (identifier: string): string => {
    if (identifier === 'worldInfoBefore' || identifier === 'worldInfoAfter') return lore;
    if (identifier === 'charDescription') return String(card.description ?? '');
    if (identifier === 'charPersonality') return String(card.personality ?? '');
    if (identifier === 'scenario') return String(card.scenario ?? '');
    if (identifier === 'personaDescription') return '';
    if (identifier === 'dialogueExamples') return String(card.mes_example ?? '').replaceAll('<START>', String(preset.data.new_example_chat_prompt ?? ''));
    return '';
  };
  for (const state of order) {
    if (state.enabled === false) continue;
    const prompt = prompts.find((item) => item.identifier === state.identifier);
    if (!prompt) continue;
    if (prompt.identifier === 'chatHistory') {
      const separator = String(preset.data.new_chat_prompt ?? '');
      if (separator) messages.push({ role: 'system', content: separator });
      messages.push({ role: 'user', content: input });
      continue;
    }
    const content = macros(String(prompt.marker ? markerContent(prompt.identifier) : prompt.content ?? ''), character);
    if (!content) continue;
    const message = { role: prompt.role ?? 'system', content };
    if (prompt.injection_position === 1) {
      injections.push({ depth: Number(prompt.injection_depth ?? 0), order: Number(prompt.injection_order ?? 100), message });
    } else messages.push(message);
  }
  if (!messages.some((message) => message.role === 'user' && message.content === input)) messages.push({ role: 'user', content: input });
  injections.sort((a, b) => b.depth - a.depth || a.order - b.order).forEach((injection) => {
    const index = Math.max(0, messages.length - injection.depth - 1);
    messages.splice(index, 0, injection.message);
  });
  return messages;
}

function endpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('请填写 API Base URL');
  const parsed = new URL(base);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('AI Base URL 仅支持 HTTP 或 HTTPS');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

async function request(provider: AiProvider & { apiKey: string }, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(endpoint(provider.baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 1000)}`);
  try { return JSON.parse(text); } catch { throw new Error('AI 服务返回的不是有效 JSON'); }
}

function responseText(raw: unknown): string {
  const data = raw as { choices?: { message?: { content?: unknown } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => {
    if (part && typeof part === 'object' && 'text' in part) return String(part.text);
    return '';
  }).join('');
  return '';
}

export async function testPreset(store: Store, presetId: string, providerId: string, input: string, characterId?: string): Promise<TestRun> {
  const preset = store.asset(presetId);
  const provider = store.provider(providerId);
  const character = characterId ? store.asset(characterId) : undefined;
  const books = character ? store.workspace().assets.filter((asset) => asset.kind === 'lorebook' && asset.relations.some((relation) => relation.targetId === character.id)) : [];
  const messages = compileMessages(preset, character, input, books);
  const body: Record<string, unknown> = { model: provider.model, messages, stream: false };
  const parameterMap: Record<string, string> = {
    temp_openai: 'temperature', freq_pen_openai: 'frequency_penalty', pres_pen_openai: 'presence_penalty',
    top_p_openai: 'top_p', openai_max_tokens: 'max_tokens', n: 'n',
  };
  for (const [source, target] of Object.entries(parameterMap)) {
    if (typeof preset.data[source] === 'number') body[target] = preset.data[source];
  }
  if (typeof preset.data.seed === 'number' && preset.data.seed >= 0) body.seed = preset.data.seed;
  const started = Date.now();
  const run: TestRun = {
    id: randomUUID(), createdAt: new Date().toISOString(), presetId, presetVersion: preset.currentVersion,
    providerName: provider.name, model: provider.model, request: body, messages,
    response: '', durationMs: 0,
  };
  try {
    const raw = await request(provider, body);
    run.rawResponse = raw;
    run.response = responseText(raw);
  } catch (error) {
    run.error = error instanceof Error ? error.message : '请求失败';
  }
  run.durationMs = Date.now() - started;
  store.addTest(run);
  return run;
}

export async function assist(store: Store, providerId: string, task: string, content: string, instruction: string): Promise<string> {
  const provider = store.provider(providerId);
  const raw = await request(provider, {
    model: provider.model, stream: false,
    messages: [
      { role: 'system', content: '你是 SillyTavern 创作助手。只返回建议后的正文，不要添加解释、Markdown 代码围栏或额外标题。保留用户原意与酒馆宏。' },
      { role: 'user', content: `任务：${task}\n补充要求：${instruction || '无'}\n\n原始内容：\n${content}` },
    ],
  });
  return responseText(raw);
}
