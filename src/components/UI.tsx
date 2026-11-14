import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronDown, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { AssetVersion, PublicAiProvider } from '../../shared/types';

export function Button({ children, variant = 'secondary', icon, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: ReactNode }) {
  return <button className={`button ${variant}`} {...props}>{icon}{children}</button>;
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span className="field-label">{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}

export function TextArea({ label, value, onChange, rows = 5, hint, onAi }: { label: string; value: string; onChange: (value: string) => void; rows?: number; hint?: string; onAi?: () => void }) {
  return <div className="field"><span className="field-label">{label}{hint && <small>{hint}</small>}{onAi && <button className="field-ai" onClick={onAi}><Sparkles size={13} /> AI 辅助</button>}</span><textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="toggle-row"><button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span /></button><span>{label}</span></label>;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${wide ? 'wide' : ''}`}><header><h2>{title}</h2><Button variant="ghost" icon={<X size={18} />} onClick={onClose} aria-label="关闭" /></header>{children}</section></div>;
}

export function VersionPanel({ versions, onRestore, onClose }: { versions: AssetVersion[]; onRestore: (version: number) => void; onClose: () => void }) {
  return <Modal title="版本记录" onClose={onClose}><div className="version-list">{[...versions].reverse().map((version) => <div className="version-row" key={version.id}><div className="version-marker">v{version.version}</div><div><strong>{version.message}</strong><p>{new Date(version.createdAt).toLocaleString('zh-CN')} · {version.name}</p></div><Button onClick={() => onRestore(version.version)}>恢复此版本</Button></div>)}</div></Modal>;
}

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState('');
  const add = () => {
    const tag = value.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setValue('');
  };
  return <div className="tag-input">{tags.map((tag) => <span className="tag removable" key={tag}>{tag}<button onClick={() => onChange(tags.filter((item) => item !== tag))}><X size={12} /></button></span>)}<input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} onBlur={add} placeholder="添加标签后回车" /></div>;
}

export function AiModal({ title, content, providers, onApply, onClose }: { title: string; content: string; providers: PublicAiProvider[]; onApply: (value: string) => void; onClose: () => void }) {
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [instruction, setInstruction] = useState('润色内容，增强表现力，保持原有设定。');
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generate = async () => {
    if (!providerId) { setError('请先在设置中添加 AI 服务'); return; }
    setBusy(true); setError('');
    try { setSuggestion(await window.tavern.ai.assist(providerId, title, content, instruction)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <Modal title={`AI 辅助 · ${title}`} onClose={onClose} wide><div className="ai-controls"><select value={providerId} onChange={(event) => setProviderId(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select><input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="补充修改要求" /><Button variant="primary" icon={busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} onClick={generate} disabled={busy}>生成建议</Button></div>{error && <div className="error-banner">{error}</div>}<div className="ai-diff"><div><span className="eyebrow">当前内容</span><pre>{content || '（空）'}</pre></div><div className="suggestion"><span className="eyebrow">AI 建议 · 尚未应用</span>{busy ? <div className="loading-block"><LoaderCircle className="spin" /> 正在生成，原内容不会自动修改</div> : <textarea value={suggestion} onChange={(event) => setSuggestion(event.target.value)} placeholder="建议会显示在这里，可继续手动调整" />}</div></div><footer className="modal-footer"><span>应用前会自动保留当前版本</span><Button variant="primary" icon={<Check size={16} />} disabled={!suggestion} onClick={() => { onApply(suggestion); onClose(); }}>应用建议</Button></footer></Modal>;
}

export function SelectChevron() { return <ChevronDown className="select-chevron" size={15} />; }
