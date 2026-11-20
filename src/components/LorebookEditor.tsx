import { Braces, Copy, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Asset, PublicAiProvider } from '../../shared/types';
import { AiModal, Button, Field, TagInput, TextArea, Toggle } from './UI';
import RawDataEditor from './RawDataEditor';
import { ContextMenu, EntryImportPicker } from './EntryContextMenu';
import { assetTokenCount, tokenCountOf } from '../../shared/tokens';

type Entry = Record<string, unknown>;

function pairs(data: Record<string, unknown>): [string, Entry][] {
  const entries = data.entries;
  if (Array.isArray(entries)) return entries.map((entry, index) => [String(index), entry as Entry]);
  if (entries && typeof entries === 'object') return Object.entries(entries as Record<string, Entry>);
  return [];
}

export default function LorebookEditor({ asset, assets, providers, onChange, onWriteBack }: { asset: Asset; assets: Asset[]; providers: PublicAiProvider[]; onChange: (asset: Asset) => void; onWriteBack: () => void }) {
  const entries = useMemo(() => pairs(asset.data).slice().sort((a, b) => {
    const ao = Number((a[1] as Entry).order ?? (a[1] as Entry).insertion_order ?? 100);
    const bo = Number((b[1] as Entry).order ?? (b[1] as Entry).insertion_order ?? 100);
    return ao - bo;
  }), [asset.data]);
  const [selected, setSelected] = useState(entries[0]?.[0] ?? '');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'entries' | 'raw'>('entries');
  const [testInput, setTestInput] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  useEffect(() => { if (!entries.some(([key]) => key === selected)) setSelected(entries[0]?.[0] ?? ''); }, [asset.id, asset.data, entries, selected]);
  const entry = entries.find(([key]) => key === selected)?.[1];
  const enabledEntriesTokens = entries.reduce((sum, [, item]) => item.disable === true ? sum : sum + tokenCountOf(item), 0);
  const updateEntries = (nextPairs: [string, Entry][]) => {
    const next = Array.isArray(asset.data.entries) ? nextPairs.map(([, item]) => item) : Object.fromEntries(nextPairs);
    onChange({ ...asset, data: { ...asset.data, entries: next } });
  };
  const update = (key: string, value: unknown) => {
    if (!entry) return;
    updateEntries(entries.map(([id, item]) => id === selected ? [id, { ...item, [key]: value }] : [id, item]));
  };
  const add = () => {
    const numericKeys = entries.map(([key]) => Number(key)).filter(Number.isFinite);
    const key = String(Math.max(-1, ...numericKeys) + 1);
    const next: Entry = { uid: Number(key), key: [], keysecondary: [], content: '', comment: '新条目', constant: false, selective: false, order: 100, position: 0, disable: false, extensions: { depth: 4, role: 0 } };
    updateEntries([...entries, [key, next]]); setSelected(key);
  };
  const duplicate = () => {
    if (!entry) return;
    const key = String(Math.max(-1, ...entries.map(([id]) => Number(id)).filter(Number.isFinite)) + 1);
    const copy = JSON.parse(JSON.stringify(entry)) as Entry;
    copy.comment = `${String(entry.comment ?? '条目')} 副本`; copy.uid = Number(key);
    updateEntries([...entries, [key, copy]]); setSelected(key);
  };
  const newEntryKey = () => String(Math.max(-1, ...entries.map(([id]) => Number(id)).filter(Number.isFinite)) + 1);
  const insertEntryAt = (targetKey: string, key: string, item: Entry, offset: 0 | 1) => {
    const next = [...entries];
    const targetIndex = next.findIndex(([id]) => id === targetKey);
    const insertIndex = targetIndex < 0 ? next.length : targetIndex + offset;
    next.splice(insertIndex, 0, [key, item]);
    updateEntries(next);
    // 数组形式的 entries 写回后以数组下标作为 key，需选中插入位置的下标；对象形式保留新 key。
    setSelected(Array.isArray(asset.data.entries) ? String(insertIndex) : key);
  };
  const duplicateEntryAt = (targetKey: string, offset: 0 | 1) => {
    const source = entries.find(([id]) => id === targetKey)?.[1];
    if (!source) return;
    const key = newEntryKey();
    const copy = JSON.parse(JSON.stringify(source)) as Entry;
    copy.comment = `${String(source.comment ?? '条目')} 副本`; copy.uid = Number(key);
    copy.order = source.order ?? source.insertion_order ?? 100;
    copy.insertion_order = source.insertion_order ?? source.order ?? 100;
    insertEntryAt(targetKey, key, copy, offset);
  };
  const duplicateBelow = (targetKey: string) => duplicateEntryAt(targetKey, 1);
  const duplicateAbove = (targetKey: string) => duplicateEntryAt(targetKey, 0);
  const addEntryAt = (targetKey: string, offset: 0 | 1) => {
    const target = entries.find(([id]) => id === targetKey)?.[1];
    if (!target) return;
    const key = newEntryKey();
    const next: Entry = { uid: Number(key), key: [], keysecondary: [], content: '', comment: '新条目', constant: false, selective: false, order: target.order ?? target.insertion_order ?? 100, insertion_order: target.insertion_order ?? target.order ?? 100, position: 0, disable: false, extensions: { depth: 4, role: 0 } };
    insertEntryAt(targetKey, key, next, offset);
  };
  const addBelow = (targetKey: string) => addEntryAt(targetKey, 1);
  const addAbove = (targetKey: string) => addEntryAt(targetKey, 0);
  const importBelow = (targetKey: string, sources: Record<string, unknown>[]) => {
    const target = entries.find(([id]) => id === targetKey)?.[1];
    if (!target || !sources.length) return;
    const next = [...entries];
    const targetIndex = next.findIndex(([id]) => id === targetKey);
    let insertIndex = targetIndex < 0 ? next.length : targetIndex + 1;
    let keyNum = Math.max(-1, ...next.map(([id]) => Number(id)).filter(Number.isFinite));
    let lastKey = '';
    for (const source of sources) {
      keyNum += 1;
      const key = String(keyNum);
      const copy = JSON.parse(JSON.stringify(source)) as Entry;
      if (typeof source.uid === 'number') copy.uid = Number(keyNum);
      copy.order = target.order ?? target.insertion_order ?? 100;
      copy.insertion_order = target.insertion_order ?? target.order ?? 100;
      next.splice(insertIndex, 0, [key, copy]);
      insertIndex += 1;
      lastKey = key;
    }
    updateEntries(next);
    setSelected(Array.isArray(asset.data.entries) ? String(insertIndex - 1) : lastKey);
  };
  const reorderEntries = (dragId: string, dropId: string) => {
    if (dragId === dropId) return;
    const from = entries.findIndex(([key]) => key === dragId);
    const to = entries.findIndex(([key]) => key === dropId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    // 拖放到目标条目上表示“插入到它之前”：from < to 时移除后目标下标已前移一位。
    const insertIndex = from < to ? to - 1 : to;
    next.splice(insertIndex, 0, moved);
    const withOrder = next.map(([key, item], index) => [key, { ...item, order: 100 + index, insertion_order: 100 + index }] as [string, Entry]);
    updateEntries(withOrder);
    // 数组形式的 entries 写回后以数组下标作为 key，需选中移动后的位置；对象形式 key 稳定。
    setSelected(Array.isArray(asset.data.entries) ? String(insertIndex) : dragId);
  };
  const filtered = entries.filter(([, item]) => `${item.comment} ${(item.key as string[] | undefined)?.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const testResults = useMemo(() => {
    const input = testInput.toLowerCase();
    return entries.map(([key, item]) => {
      const keys = Array.isArray(item.key) ? item.key.map(String) : [];
      const matched = keys.filter((word) => word && input.includes(word.toLowerCase()));
      return { key, item, active: item.disable !== true && (item.constant === true || matched.length > 0), matched };
    }).filter((result) => result.active);
  }, [entries, testInput]);
  const stringArray = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
  return <div className="editor-body"><div className="editor-tabs"><button className={tab === 'entries' ? 'active' : ''} onClick={() => setTab('entries')}>条目编辑</button><button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>原始数据</button><span className="tab-spacer" />{asset.relations.some((relation) => relation.type === 'embedded-book') && <Button icon={<Braces size={14} />} onClick={onWriteBack}>写回关联角色卡</Button>}</div>
    {tab === 'raw' ? <RawDataEditor data={asset.data} onChange={(data) => onChange({ ...asset, data })} /> : <div className="lore-layout"><aside className="entry-list"><div className="entry-list-tools"><label className="search-box"><Search size={14} /><input placeholder="搜索条目…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><Button variant="primary" icon={<Plus size={15} />} onClick={add}>条目</Button></div><div className="entry-list-scroll">{filtered.map(([key, item]) => <button draggable className={`entry-list-item ${selected === key ? 'active' : ''} ${dragKey === key ? 'dragging' : ''} ${dragOverKey === key ? 'drag-over' : ''}`} key={key} onClick={() => setSelected(key)} onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, key }); }} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); setDragKey(key); }} onDragOver={(event) => { event.preventDefault(); setDragOverKey(key); }} onDrop={() => { reorderEntries(dragKey ?? '', key); setDragKey(null); setDragOverKey(null); }} onDragEnd={() => { setDragKey(null); setDragOverKey(null); }}><span className={`activation-dot ${item.disable ? 'disabled' : item.constant ? 'constant' : ''}`} /><div><strong>{String(item.comment || item.title || `条目 ${key}`)}</strong><small>{stringArray(item.key).slice(0, 3).join(' · ') || '无关键词'}</small></div><span className="order-number">{String(item.order ?? item.insertion_order ?? 100)}</span></button>)}</div><footer><span>{entries.length} 个条目</span><TagInput tags={asset.tags} onChange={(tags) => onChange({ ...asset, tags })} /></footer></aside><main className="entry-editor">{entry ? <><div className="entry-heading"><Field label="条目标题 / Memo"><input value={String(entry.comment ?? '')} onChange={(event) => update('comment', event.target.value)} /></Field><div className="inline-actions"><Button icon={<Copy size={14} />} onClick={duplicate}>复制</Button><Button variant="danger" icon={<Trash2 size={14} />} onClick={() => updateEntries(entries.filter(([key]) => key !== selected))}>删除</Button></div></div><div className="entry-token-stats"><span>整体 <strong>{assetTokenCount(asset).toLocaleString('zh-CN')}</strong> token</span><span>当前开启 <strong>{enabledEntriesTokens.toLocaleString('zh-CN')}</strong> token</span><span>当前条目 <strong>{tokenCountOf(entry).toLocaleString('zh-CN')}</strong> token</span></div><div className="two-columns"><Field label="主关键词" hint="使用英文逗号分隔"><input value={stringArray(entry.key ?? entry.keys).join(', ')} onChange={(event) => update('key', event.target.value.split(',').map((word) => word.trim()).filter(Boolean))} placeholder="角色名, 地点, 物品" /></Field><Field label="次要关键词"><input value={stringArray(entry.keysecondary ?? entry.secondary_keys).join(', ')} onChange={(event) => update('keysecondary', event.target.value.split(',').map((word) => word.trim()).filter(Boolean))} /></Field></div><TextArea label="条目内容" hint="标题和关键词不会自动注入，正文应是完整设定" value={String(entry.content ?? '')} onChange={(value) => update('content', value)} rows={9} onAi={() => setAiOpen(true)} /><div className="settings-band"><Toggle label="常驻条目" checked={entry.constant === true} onChange={(value) => update('constant', value)} /><Toggle label="启用次要关键词" checked={entry.selective === true} onChange={(value) => update('selective', value)} /><Toggle label="禁用此条目" checked={entry.disable === true} onChange={(value) => update('disable', value)} /></div><div className="numeric-grid"><Field label="Insertion Order"><input type="number" value={Number(entry.order ?? entry.insertion_order ?? 100)} onChange={(event) => update('order', Number(event.target.value))} /></Field><Field label="Position"><select value={Number(entry.position ?? 0)} onChange={(event) => update('position', Number(event.target.value))}><option value={0}>角色定义之前</option><option value={1}>角色定义之后</option><option value={2}>示例消息之前</option><option value={3}>示例消息之后</option><option value={4}>指定 Depth</option></select></Field><Field label="Depth"><input type="number" value={Number((entry.extensions as Entry)?.depth ?? 4)} onChange={(event) => update('extensions', { ...(entry.extensions as Entry), depth: Number(event.target.value) })} /></Field><Field label="触发概率 %"><input type="number" min={0} max={100} value={Number((entry.extensions as Entry)?.probability ?? 100)} onChange={(event) => update('extensions', { ...(entry.extensions as Entry), probability: Number(event.target.value), useProbability: true })} /></Field></div><div className="trigger-tester"><div><span className="eyebrow">TRIGGER PREVIEW</span><h3>关键词触发预览</h3></div><textarea rows={3} value={testInput} onChange={(event) => setTestInput(event.target.value)} placeholder="输入一段模拟聊天，查看哪些条目会被关键词或常驻设置激活…" />{testInput && <div className="test-result"><strong>激活 {testResults.length} 个条目</strong>{testResults.map(({ key, item, matched }) => <div key={key}><span>{String(item.comment || `条目 ${key}`)}</span><small>{item.constant ? '常驻' : `命中：${matched.join('、')}`}</small></div>)}</div>}<p>这是关键词级快速预览，不等同于完整的酒馆递归、预算与多源排序模拟。</p></div></> : <div className="empty-state"><h2>从第一个世界书条目开始</h2><p>用关键词把需要的世界设定带入对话。</p><Button variant="primary" icon={<Plus size={15} />} onClick={add}>新建条目</Button></div>}</main></div>}
    {aiOpen && entry && <AiModal title="世界书条目" content={String(entry.content ?? '')} providers={providers} onClose={() => setAiOpen(false)} onApply={(value) => update('content', value)} />}
    {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} actions={[
      { label: '复制到该条目下方', icon: <Copy size={14} />, onClick: () => { duplicateBelow(menu.key); setMenu(null); } },
      { label: '复制到该条目上方', icon: <Copy size={14} />, onClick: () => { duplicateAbove(menu.key); setMenu(null); } },
      { label: '在该条目下方新增条目', icon: <Plus size={14} />, onClick: () => { addBelow(menu.key); setMenu(null); } },
      { label: '在该条目上方新增条目', icon: <Plus size={14} />, onClick: () => { addAbove(menu.key); setMenu(null); } },
      { label: '添加其它世界书或预设的条目', onClick: () => { setPickerTarget(menu.key); setMenu(null); } },
    ]} />}
    {pickerTarget && <EntryImportPicker assets={assets} currentAssetId={asset.id} onClose={() => setPickerTarget(null)} onImport={(entries) => { importBelow(pickerTarget, entries); setPickerTarget(null); }} />}
  </div>;
}
