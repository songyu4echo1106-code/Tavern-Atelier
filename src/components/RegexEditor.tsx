import { Braces, Play, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Asset, PublicAiProvider } from '../../shared/types';
import { AiModal, Button, Field, TagInput, Toggle } from './UI';
import RawDataEditor from './RawDataEditor';

interface TestResult { output?: string; count?: number; error?: string }

export default function RegexEditor({ asset, providers, onChange, onWriteBack }: {
  asset: Asset;
  providers: PublicAiProvider[];
  onChange: (asset: Asset) => void;
  onWriteBack: () => void;
}) {
  const [tab, setTab] = useState<'edit' | 'raw'>('edit');
  const [input, setInput] = useState('{{user}}: 你好，{{char}}！\n{{char}}: 很高兴见到你。');
  const [char, setChar] = useState('Seraphina');
  const [user, setUser] = useState('User');
  const [result, setResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [aiTarget, setAiTarget] = useState<'findRegex' | 'replaceString' | null>(null);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const value = (key: string) => String(asset.data[key] ?? '');
  const update = (key: string, next: unknown) => onChange({
    ...asset,
    name: key === 'scriptName' ? String(next) : asset.name,
    data: { ...asset.data, [key]: next },
  });
  const runTest = () => {
    if (input.length > 200_000) {
      setResult({ error: '测试输入不能超过 200,000 个字符。' });
      return;
    }
    workerRef.current?.terminate();
    setTesting(true);
    setResult(null);
    const worker = new Worker(new URL('../regexWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const timeout = window.setTimeout(() => {
      worker.terminate();
      setTesting(false);
      setResult({ error: '匹配超过 800ms，已终止。请检查是否存在灾难性回溯。' });
    }, 800);
    worker.onmessage = (event: MessageEvent<TestResult>) => {
      window.clearTimeout(timeout);
      setResult(event.data);
      setTesting(false);
      worker.terminate();
    };
    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      setResult({ error: event.message });
      setTesting(false);
      worker.terminate();
    };
    worker.postMessage({
      findRegex: value('findRegex'), replaceString: value('replaceString'),
      trimStrings: Array.isArray(asset.data.trimStrings) ? asset.data.trimStrings : [],
      substituteRegex: Number(asset.data.substituteRegex ?? 0), input, char, user,
    });
  };
  const placements = Array.isArray(asset.data.placement) ? asset.data.placement.map(Number) : [];
  const placementOptions = [[1, '用户输入'], [2, 'AI 响应'], [3, 'Slash Commands'], [4, '世界书'], [5, 'Reasoning']];
  const hasWriteBack = asset.relations.some((relation) => relation.type === 'scoped-regex' || relation.type === 'preset-regex');

  return <div className="editor-body">
    <div className="editor-tabs"><button className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>规则与测试</button><button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>原始数据</button><span className="tab-spacer" />{hasWriteBack && <Button icon={<Braces size={14} />} onClick={onWriteBack}>写回关联素材</Button>}</div>
    {tab === 'raw' ? <RawDataEditor data={asset.data} onChange={(data) => onChange({ ...asset, data })} /> : <div className="regex-layout">
      <div className="regex-form">
        <div className="section-title"><div><span className="eyebrow">REGEX SCRIPT</span><h2>查找与替换</h2></div><TagInput tags={asset.tags} onChange={(tags) => onChange({ ...asset, tags })} /></div>
        <Field label="规则名称"><input value={value('scriptName')} onChange={(event) => update('scriptName', event.target.value)} /></Field>
        <div className="field"><span className="field-label">Find Regex <small>支持 /pattern/flags 形式</small><button className="field-ai" onClick={() => setAiTarget('findRegex')}><Sparkles size={13} /> AI 辅助</button></span><textarea className="regex-code" rows={4} value={value('findRegex')} onChange={(event) => update('findRegex', event.target.value)} placeholder="/你的表达式/gi" /></div>
        <div className="field"><span className="field-label">Replace With <small>{'支持 {{match}}、$1、$2 等捕获组'}</small><button className="field-ai" onClick={() => setAiTarget('replaceString')}><Sparkles size={13} /> AI 辅助</button></span><textarea className="regex-code" rows={4} value={value('replaceString')} onChange={(event) => update('replaceString', event.target.value)} /></div>
        <Field label="Trim Out" hint="每行一个，从匹配文本中移除"><textarea rows={3} value={(Array.isArray(asset.data.trimStrings) ? asset.data.trimStrings : []).join('\n')} onChange={(event) => update('trimStrings', event.target.value.split('\n').filter((item) => item.length))} /></Field>
        <div className="settings-band vertical"><Toggle label="禁用规则" checked={asset.data.disabled === true} onChange={(next) => update('disabled', next)} /><Toggle label="仅改变显示（Markdown Only）" checked={asset.data.markdownOnly === true} onChange={(next) => update('markdownOnly', next)} /><Toggle label="仅改变发送提示词（Prompt Only）" checked={asset.data.promptOnly === true} onChange={(next) => update('promptOnly', next)} /><Toggle label="编辑消息时也运行" checked={asset.data.runOnEdit === true} onChange={(next) => update('runOnEdit', next)} /></div>
        <Field label="作用文本"><div className="checkbox-grid">{placementOptions.map(([id, label]) => <label key={id}><input type="checkbox" checked={placements.includes(Number(id))} onChange={(event) => update('placement', event.target.checked ? [...placements, id] : placements.filter((item) => item !== id))} />{label}</label>)}</div></Field>
        <div className="numeric-grid three">
          <Field label="宏替换模式"><select value={Number(asset.data.substituteRegex ?? 0)} onChange={(event) => update('substituteRegex', Number(event.target.value))}><option value={0}>不替换宏</option><option value={1}>Raw</option><option value={2}>Escaped</option></select></Field>
          <Field label="Min Depth"><input type="number" value={asset.data.minDepth == null ? '' : Number(asset.data.minDepth)} onChange={(event) => update('minDepth', event.target.value === '' ? null : Number(event.target.value))} placeholder="无限" /></Field>
          <Field label="Max Depth"><input type="number" value={asset.data.maxDepth == null ? '' : Number(asset.data.maxDepth)} onChange={(event) => update('maxDepth', event.target.value === '' ? null : Number(event.target.value))} placeholder="无限" /></Field>
        </div>
      </div>
      <div className="regex-tester">
        <div className="section-title"><div><span className="eyebrow">SAFE TEST MODE</span><h2>匹配测试</h2></div><Button variant="primary" icon={<Play size={15} />} onClick={runTest} disabled={testing}>{testing ? '测试中…' : '运行测试'}</Button></div>
        <div className="macro-inputs"><Field label="{{char}}"><input value={char} onChange={(event) => setChar(event.target.value)} /></Field><Field label="{{user}}"><input value={user} onChange={(event) => setUser(event.target.value)} /></Field></div>
        <Field label="测试输入"><textarea rows={9} value={input} onChange={(event) => setInput(event.target.value)} /></Field>
        <div className="test-output"><span className="eyebrow">替换输出 {result?.count !== undefined && `· ${result.count} 处匹配`}</span>{result?.error ? <div className="error-banner">{result.error}</div> : <pre>{result?.output ?? '点击“运行测试”查看结果。测试在独立 Worker 中进行，超时自动终止。'}</pre>}</div>
        <div className="safety-note">仅执行 JavaScript 正则查找替换，不执行 STscript、扩展代码或替换内容中的 HTML。</div>
      </div>
    </div>}
    {aiTarget && <AiModal title={aiTarget === 'findRegex' ? '编写正则表达式' : '编写替换内容'} content={value(aiTarget)} providers={providers} onClose={() => setAiTarget(null)} onApply={(next) => update(aiTarget, next)} />}
  </div>;
}
