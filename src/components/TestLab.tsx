import { ChevronRight, FlaskConical, LoaderCircle, Play, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Asset, PublicAiProvider, TestRun } from '../../shared/types';
import { Button, Field } from './UI';

export default function TestLab({ assets, providers, initialPreset, onOpenSettings }: {
  assets: Asset[];
  providers: PublicAiProvider[];
  initialPreset?: string;
  onOpenSettings: () => void;
}) {
  const presets = assets.filter((asset) => asset.kind === 'preset');
  const characters = assets.filter((asset) => asset.kind === 'character');
  const [presetId, setPresetId] = useState(initialPreset ?? presets[0]?.id ?? '');
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [characterId, setCharacterId] = useState('');
  const [input, setInput] = useState('夜色落在窗前，你抬眼看见了我。');
  const [run, setRun] = useState<TestRun | null>(null);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRequest, setShowRequest] = useState(true);

  useEffect(() => { if (initialPreset) setPresetId(initialPreset); }, [initialPreset]);
  useEffect(() => { if (!providerId && providers[0]) setProviderId(providers[0].id); }, [providers, providerId]);
  useEffect(() => { void window.tavern.tests.list().then(setHistory); }, []);

  const execute = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await window.tavern.ai.testPreset(presetId, providerId, input, characterId || undefined);
      setRun(result);
      setHistory(await window.tavern.tests.list());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return <div className="page test-page">
    <div className="page-heading">
      <div><span className="eyebrow">PROMPT LABORATORY</span><h1>预设测试台</h1><p>看见每一条消息如何展开，以及实际发送给模型的请求。</p></div>
      <div className="lab-badge"><FlaskConical size={17} />请求正文不含 API 密钥</div>
    </div>
    <div className="test-layout">
      <main>
        <section className="test-config">
          <div className="numeric-grid three">
            <Field label="Chat 预设"><select value={presetId} onChange={(event) => setPresetId(event.target.value)}>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name} · v{preset.currentVersion}</option>)}</select></Field>
            <Field label="AI 服务与模型"><select value={providerId} onChange={(event) => setProviderId(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select></Field>
            <Field label="关联角色（可选）"><select value={characterId} onChange={(event) => setCharacterId(event.target.value)}><option value="">不使用角色卡</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></Field>
          </div>
          <Field label="模拟用户输入"><textarea rows={5} value={input} onChange={(event) => setInput(event.target.value)} /></Field>
          <div className="test-actions">
            <span>关联角色的世界书会按关键词和常驻设置做基础展开。</span>
            <Button variant="primary" icon={busy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />} onClick={execute} disabled={busy || !presetId || !providerId || !input}>{busy ? '正在请求…' : '生成并检查'}</Button>
          </div>
          {error && <div className="error-banner">{error}</div>}
          {(!providers.length || !presets.length) && <div className="compatibility-note">{!providers.length ? <button onClick={onOpenSettings}>先添加 AI 服务 <ChevronRight size={13} /></button> : '请先新建或导入 Chat 预设。'}</div>}
        </section>
        {run && <section className="run-result">
          <div className="run-meta"><div><span className={`status-dot ${run.error ? 'error' : ''}`} /><strong>{run.error ? '请求失败' : '请求完成'}</strong></div><span>{run.providerName} · {run.model} · {run.durationMs}ms · 预设 v{run.presetVersion}</span></div>
          {run.error && <div className="error-banner">{run.error}</div>}
          <div className="result-tabs"><button className={showRequest ? 'active' : ''} onClick={() => setShowRequest(true)}>最终请求 <span>{run.messages.length}</span></button><button className={!showRequest ? 'active' : ''} onClick={() => setShowRequest(false)}>模型返回</button></div>
          {showRequest ? <>
            <div className="message-list">{run.messages.map((message, index) => <article className={`message-item ${message.role}`} key={index}><header><span>{message.role}</span><small>#{index + 1}</small></header><pre>{message.content}</pre></article>)}</div>
            <details className="json-details"><summary>查看实际 HTTP 请求体</summary><pre>{JSON.stringify(run.request, null, 2)}</pre></details>
          </> : <div className="model-response"><pre>{run.response || '没有文本内容'}</pre>{run.rawResponse !== undefined && <details className="json-details"><summary>原始响应</summary><pre>{JSON.stringify(run.rawResponse, null, 2)}</pre></details>}</div>}
        </section>}
      </main>
      <aside className="run-history">
        <div className="section-title"><div><span className="eyebrow">LOCAL HISTORY</span><h3>最近测试</h3></div>{history.length > 0 && <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => { void window.tavern.tests.clear().then(() => setHistory([])); }} />}</div>
        {history.length ? history.map((item) => <button key={item.id} className={run?.id === item.id ? 'active' : ''} onClick={() => setRun(item)}><span className={`status-dot ${item.error ? 'error' : ''}`} /><div><strong>{presets.find((preset) => preset.id === item.presetId)?.name ?? '已删除预设'}</strong><small>{item.model} · v{item.presetVersion}</small><small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small></div></button>) : <div className="small-empty">测试记录仅保存在本机，最多保留 50 次。</div>}
      </aside>
    </div>
  </div>;
}
