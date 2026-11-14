import { ArchiveRestore, Check, DatabaseBackup, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { PublicAiProvider } from '../../shared/types';
import { Button, Field } from './UI';

const blank = { id: '', name: '', baseUrl: 'https://api.openai.com/v1', model: '', hasKey: false };

export default function Settings({ providers, onProviders, onBackup, onRestore, notify }: { providers: PublicAiProvider[]; onProviders: (providers: PublicAiProvider[]) => void; onBackup: () => void; onRestore: () => void; notify: (message: string) => void }) {
  const [draft, setDraft] = useState<PublicAiProvider & { apiKey?: string }>(blank);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!draft.name || !draft.baseUrl || !draft.model) { notify('请填写服务名称、Base URL 和模型 ID'); return; }
    setBusy(true);
    try { onProviders(await window.tavern.providers.save(draft)); setDraft(blank); notify('AI 服务已保存'); }
    catch (reason) { notify(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const test = async (provider: PublicAiProvider) => {
    setBusy(true);
    try { await window.tavern.ai.assist(provider.id, '连接测试', '请只回复 OK', ''); notify(`${provider.name} 连接成功`); }
    catch (reason) { notify(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <div className="page settings-page"><div className="page-heading"><div><span className="eyebrow">LOCAL & PRIVATE</span><h1>服务与数据</h1><p>密钥交给系统安全存储，创作数据留在本地。</p></div></div><div className="settings-grid"><main><section className="settings-section"><div className="section-title"><div><span className="eyebrow">AI PROVIDERS</span><h2>OpenAI 兼容服务</h2></div><span className="privacy-pill"><ShieldCheck size={14} />仅主动请求时联网</span></div>{providers.length ? <div className="provider-list">{providers.map((provider) => <article key={provider.id}><div className="provider-logo">{provider.name.slice(0, 1).toUpperCase()}</div><div><strong>{provider.name}</strong><span>{provider.model}</span><small>{provider.baseUrl}</small></div><span className={`key-status ${provider.hasKey ? 'ready' : ''}`}><KeyRound size={13} />{provider.hasKey ? '密钥已加密' : '无密钥'}</span><Button onClick={() => test(provider)} disabled={busy}>连接测试</Button><Button variant="ghost" onClick={() => setDraft({ ...provider, apiKey: '' })}>编辑</Button><Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => { if (confirm(`删除服务 ${provider.name}？`)) void window.tavern.providers.remove(provider.id).then(onProviders); }} /></article>)}</div> : <div className="small-empty">尚未配置服务，添加后可用于创作辅助和预设测试。</div>}<div className="provider-form"><h3>{draft.id ? '编辑服务' : '添加服务'}</h3><div className="two-columns"><Field label="服务名称"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：我的 OpenAI 兼容服务" /></Field><Field label="模型 ID"><input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="例如：gpt-4o-mini" /></Field></div><Field label="Base URL" hint="填写到 /v1 即可，无需添加 /chat/completions"><input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} /></Field><Field label="API Key" hint={draft.hasKey ? '留空则保留现有密钥' : '使用操作系统安全存储加密'}><input type="password" value={draft.apiKey ?? ''} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} autoComplete="off" placeholder="sk-…" /></Field><div className="form-actions"><Button variant="primary" icon={busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} onClick={save} disabled={busy}>保存服务</Button>{draft.id && <Button onClick={() => setDraft(blank)}>取消编辑</Button>}</div></div></section></main><aside><section className="settings-section"><DatabaseBackup size={24} /><h2>备份与恢复</h2><p>备份包含素材、版本、原始文件和非敏感设置。API 密钥不会被写入备份。</p><Button icon={<Plus size={15} />} onClick={onBackup}>创建本地备份</Button><Button icon={<ArchiveRestore size={15} />} onClick={onRestore}>从备份恢复</Button></section><section className="settings-section security-card"><ShieldCheck size={24} /><h2>安全边界</h2><ul><li>渲染进程没有 Node.js 文件权限</li><li>不执行导入的脚本或扩展代码</li><li>测试日志不记录认证请求头</li><li>恢复前自动保留当前工作区副本</li></ul></section></aside></div></div>;
}
