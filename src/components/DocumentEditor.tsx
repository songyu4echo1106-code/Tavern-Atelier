import { BookOpen, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { Asset } from '../../shared/types';
import { Button } from './UI';
import RawDataEditor from './RawDataEditor';

export default function DocumentEditor({ asset, onChange, onConvert }: { asset: Asset; onChange: (asset: Asset) => void; onConvert: () => Promise<void> }) {
  const [tab, setTab] = useState<'preview' | 'raw'>('preview');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const format = String(asset.data.format ?? 'txt').toUpperCase();
  const text = String(asset.data.text ?? '');
  const updateText = (value: string) => onChange({ ...asset, data: { ...asset.data, text: value } });
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); setCopied(true); } catch { /* 忽略 */ }
      document.body.removeChild(area);
    }
    window.setTimeout(() => setCopied(false), 1600);
  };
  const convert = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConvert(); } finally { setBusy(false); }
  };
  const chars = text.length;
  return <div className="editor-body"><div className="editor-tabs"><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>文档预览</button><button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>原始数据</button><span className="tab-spacer" /></div>
    {tab === 'raw' ? <RawDataEditor data={asset.data} onChange={(data) => onChange({ ...asset, data })} /> : <div className="document-editor"><div className="document-toolbar"><span className="document-format-badge">{format}</span><span className="document-meta">{chars} 个字符 · 可直接编辑，保存后生效</span><div className="document-actions"><Button icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={() => void copyText()}>{copied ? '已复制' : '复制全文'}</Button><Button variant="primary" icon={<BookOpen size={15} />} onClick={() => void convert()} disabled={busy || !text.trim()}>{busy ? '转换中…' : '转为世界书'}</Button></div></div><textarea className="document-text" spellCheck={false} value={text} onChange={(event) => updateText(event.target.value)} placeholder="把文档内容粘贴或编辑在这里…" /><p className="document-note">转为世界书会把整份文档作为单个世界书条目（无关键词），原文档保持不变；之后可在世界书编辑器中补充关键词与调整。</p></div>}
  </div>;
}
