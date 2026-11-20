import type { Asset } from './types';

// 粗略的 token 估算：CJK 字符按 1 token/字，其余按 4 字符/token。
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const rest = text.length - cjk;
  return cjk + Math.ceil(rest / 4);
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') { out.push(value); return; }
  if (Array.isArray(value)) { for (const item of value) collectStrings(item, out); return; }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) collectStrings((value as Record<string, unknown>)[key], out);
  }
}

// 统计任意数据中的字符串内容 token（估算值）。
export function tokenCountOf(value: unknown): number {
  const strings: string[] = [];
  collectStrings(value, strings);
  return strings.reduce((sum, text) => sum + estimateTokenCount(text), 0);
}

// 统计一份素材的内容 token（估算值），只累计 data 中的字符串内容。
export function assetTokenCount(asset: Asset): number {
  return tokenCountOf(asset.data);
}
