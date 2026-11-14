import { createHash } from 'node:crypto';
import { toV2Card } from '../shared/card';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface Chunk {
  type: string;
  data: Buffer;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunks(image: Buffer): Chunk[] {
  if (!image.subarray(0, 8).equals(signature)) throw new Error('不是有效的 PNG 文件');
  const result: Chunk[] = [];
  let offset = 8;
  while (offset + 12 <= image.length) {
    const length = image.readUInt32BE(offset);
    const type = image.subarray(offset + 4, offset + 8).toString('ascii');
    const end = offset + 12 + length;
    if (end > image.length) throw new Error('PNG 数据块不完整');
    result.push({ type, data: image.subarray(offset + 8, offset + 8 + length) });
    offset = end;
    if (type === 'IEND') break;
  }
  return result;
}

function encodeChunk(chunk: Chunk): Buffer {
  const type = Buffer.from(chunk.type, 'ascii');
  const output = Buffer.alloc(12 + chunk.data.length);
  output.writeUInt32BE(chunk.data.length, 0);
  type.copy(output, 4);
  chunk.data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([type, chunk.data])), 8 + chunk.data.length);
  return output;
}

function textChunk(keyword: string, value: unknown): Chunk {
  const encoded = Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
  return { type: 'tEXt', data: Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(encoded, 'latin1')]) };
}

function readText(chunk: Chunk): { keyword: string; text: string } {
  const separator = chunk.data.indexOf(0);
  if (separator < 0) throw new Error('PNG 文本块格式无效');
  return {
    keyword: chunk.data.subarray(0, separator).toString('latin1'),
    text: chunk.data.subarray(separator + 1).toString('latin1'),
  };
}

export function fileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function readCharacterPng(image: Buffer): { data: Record<string, unknown>; warnings: string[] } {
  const texts = chunks(image).filter((chunk) => chunk.type === 'tEXt').map(readText);
  const v3 = texts.find((item) => item.keyword.toLowerCase() === 'ccv3');
  const v2 = texts.find((item) => item.keyword.toLowerCase() === 'chara');
  const warnings: string[] = [];
  if (!v3 && !v2) throw new Error('PNG 中没有 ccv3 或 chara 角色卡数据');
  let data: Record<string, unknown>;
  try {
    const selected = v3 ?? v2!;
    data = JSON.parse(Buffer.from(selected.text, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch (error) {
    if (!v3 || !v2) throw error;
    data = JSON.parse(Buffer.from(v2.text, 'base64').toString('utf8')) as Record<string, unknown>;
    warnings.push('ccv3 数据损坏，已回退到有效的 chara V2 数据。');
  }
  if (v2 && v3) {
    try {
      const v2Data = JSON.parse(Buffer.from(v2.text, 'base64').toString('utf8')) as Record<string, unknown>;
      const comparableV3 = { ...data, spec: v2Data.spec, spec_version: v2Data.spec_version };
      if (JSON.stringify(comparableV3) !== JSON.stringify(v2Data)) warnings.push('PNG 内 V2 与 V3 数据存在差异，当前按 V3 编辑；导出时将同步二者。');
    } catch {
      warnings.push('PNG 内 V2 数据无法解析，当前使用 V3 数据。');
    }
  }
  return { data, warnings };
}

export function writeCharacterPng(image: Buffer, raw: Record<string, unknown>): Buffer {
  const source = chunks(image);
  const kept = source.filter((chunk) => {
    if (chunk.type !== 'tEXt') return true;
    const keyword = readText(chunk).keyword.toLowerCase();
    return keyword !== 'chara' && keyword !== 'ccv3';
  });
  const endIndex = kept.findIndex((chunk) => chunk.type === 'IEND');
  const v2 = toV2Card(raw);
  const v3 = { ...v2, spec: 'chara_card_v3', spec_version: '3.0' };
  kept.splice(endIndex < 0 ? kept.length : endIndex, 0, textChunk('chara', v2), textChunk('ccv3', v3));
  return Buffer.concat([signature, ...kept.map(encodeChunk)]);
}
