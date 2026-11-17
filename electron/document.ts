import path from 'node:path';
import { Open } from 'unzipper';

export type DocumentFormat = 'txt' | 'md' | 'docx';

export function documentFormat(filename: string): DocumentFormat | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.txt' || ext === '.text') return 'txt';
  if (ext === '.md' || ext === '.markdown') return 'md';
  if (ext === '.docx') return 'docx';
  return null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_all, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_all, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function docxXmlToText(xml: string): string {
  const paragraphs = xml.split(/<w:p(?:\s[^>]*)?>/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const runs: string[] = [];
    const token = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>/g;
    let match: RegExpExecArray | null;
    while ((match = token.exec(paragraph)) !== null) {
      if (match[1] !== undefined) runs.push(decodeXmlEntities(match[1]));
      else if (match[0].startsWith('<w:tab')) runs.push('\t');
      else if (match[0].startsWith('<w:br')) runs.push('\n');
    }
    const line = runs.join('');
    if (line.trim()) lines.push(line);
  }
  return lines.join('\n\n').trim();
}

export async function readDocumentText(filename: string, buffer: Buffer): Promise<{ format: DocumentFormat; text: string }> {
  const format = documentFormat(filename);
  if (!format) throw new Error('不支持的文档类型，仅支持 TXT、Markdown 或 DOCX');
  if (format === 'docx') {
    const directory = await Open.buffer(buffer);
    const entry = directory.files.find((file) => file.path === 'word/document.xml');
    if (!entry) throw new Error('DOCX 中缺少 word/document.xml');
    const xml = (await entry.buffer()).toString('utf8');
    return { format, text: docxXmlToText(xml) };
  }
  return { format, text: buffer.toString('utf8').replace(/^\uFEFF/, '') };
}

export function textToLorebookEntries(text: string): Record<string, unknown> {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const chunks = blocks.length > 1 ? blocks : text.split('\n').map((line) => line.trim()).filter(Boolean);
  const entries: Record<string, Record<string, unknown>> = {};
  chunks.forEach((chunk, index) => {
    const firstLine = chunk.split('\n').find((line) => line.trim()) ?? '';
    entries[String(index)] = {
      uid: index,
      key: [],
      keysecondary: [],
      content: chunk,
      comment: firstLine.slice(0, 40) || `段落 ${index + 1}`,
      constant: false,
      selective: false,
      order: 100 + index,
      position: 0,
      disable: false,
      extensions: { depth: 4, role: 0 },
    };
  });
  return { entries };
}
