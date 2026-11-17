import { ArrowDown, ArrowUp, Braces, Copy, FlaskConical, Folder, FolderPlus, Link2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Asset, PublicAiProvider } from '../../shared/types';
import { AiModal, Button, Field, Modal, TagInput, TextArea } from './UI';
import RawDataEditor from './RawDataEditor';
import { ContextMenu, EntryImportPicker } from './EntryContextMenu';
import { flattenPromptOrder, mergePromptOrder } from '../../shared/preset';

interface Prompt {
  identifier: string;
  name?: string;
  role?: string;
  content?: string;
  system_prompt?: boolean;
  marker?: boolean;
  injection_position?: number;
  injection_depth?: number;
  injection_order?: number;
  injection_trigger?: string[];
  [key: string]: unknown;
}

interface Order { identifier: string; enabled?: boolean }

export default function PresetEditor({ asset, assets, providers, onChange, onTest, onLinkRegex, onUnlinkRegex }: { asset: Asset; assets: Asset[]; providers: PublicAiProvider[]; onChange: (asset: Asset) => void; onTest: () => void; onLinkRegex: (regexId: string) => void; onUnlinkRegex: (regexId: string) => void }) {
  const [tab, setTab] = useState<'prompts' | 'parameters' | 'advanced' | 'regex' | 'raw'>('prompts');
  const prompts = (Array.isArray(asset.data.prompts) ? asset.data.prompts : []) as Prompt[];
  const importedOrder = flattenPromptOrder(asset.data.prompt_order);
  const orders = (importedOrder.length ? importedOrder : prompts.map((prompt) => ({ identifier: prompt.identifier, enabled: true }))) as Order[];
  const orderReadOnly = Array.isArray(asset.data.prompt_order) && asset.data.prompt_order.filter((item) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).order)).length > 1;
  const [selected, setSelected] = useState(orders[0]?.identifier ?? '');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSourceId, setImportSourceId] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number; identifier: string } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [dragKind, setDragKind] = useState<'prompt' | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [groupCreateName, setGroupCreateName] = useState('');
  const [groupCreateTarget, setGroupCreateTarget] = useState<string | null>(null);
  useEffect(() => { if (!orders.some((order) => order.identifier === selected)) setSelected(orders[0]?.identifier ?? ''); }, [asset.id, orders, selected]);
  const selectedPrompt = prompts.find((prompt) => prompt.identifier === selected);
  const sourcePresets = assets.filter((item) => item.kind === 'preset' && item.id !== asset.id);
  const sourcePreset = sourcePresets.find((item) => item.id === importSourceId) ?? sourcePresets[0];
  const sourcePrompts = (sourcePreset && Array.isArray(sourcePreset.data.prompts) ? sourcePreset.data.prompts : []) as Prompt[];
  const promptGroups = (Array.isArray(asset.promptGroups) ? asset.promptGroups : []).filter((group) => group && typeof group.id === 'string' && typeof group.name === 'string');
  const groupedIdentifiers = new Set(promptGroups.flatMap((group) => group.identifiers));
  const ungroupedOrders = orders.filter((order) => !groupedIdentifiers.has(order.identifier));
  const editingGroup = promptGroups.find((group) => group.id === editingGroupId) ?? null;
  const toggleCollapse = (id: string) => setCollapsedGroups((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  const createGroup = () => {
    const name = groupNameInput.trim();
    if (!name) return;
    if (promptGroups.some((group) => group.name === name)) { setGroupNameInput(''); return; }
    const id = crypto.randomUUID();
    onChange({ ...asset, promptGroups: [...promptGroups, { id, name, identifiers: [] }] });
    setEditingGroupId(id);
    setGroupNameInput('');
  };
  const moveGroup = (id: string, direction: -1 | 1) => {
    const index = promptGroups.findIndex((group) => group.id === id);
    const target = index + direction;
    if (target < 0 || target >= promptGroups.length) return;
    const next = [...promptGroups];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...asset, promptGroups: next });
  };
  const addIdentifierToGroup = (groupId: string, identifier: string) => {
    const cleaned = promptGroups.map((group) => ({ ...group, identifiers: group.identifiers.filter((item) => item !== identifier) }));
    onChange({ ...asset, promptGroups: cleaned.map((group) => group.id === groupId ? { ...group, identifiers: [...group.identifiers, identifier] } : group) });
  };
  const createGroupWithIdentifier = (name: string, identifier: string) => {
    const trimmed = name.trim();
    if (!trimmed || !identifier) return;
    const id = crypto.randomUUID();
    const cleaned = promptGroups.map((group) => ({ ...group, identifiers: group.identifiers.filter((item) => item !== identifier) }));
    onChange({ ...asset, promptGroups: [...cleaned, { id, name: trimmed, identifiers: [identifier] }] });
  };
  const renameGroup = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange({ ...asset, promptGroups: promptGroups.map((group) => group.id === id ? { ...group, name: trimmed } : group) });
  };
  const removeGroup = (id: string) => {
    onChange({ ...asset, promptGroups: promptGroups.filter((group) => group.id !== id) });
    if (editingGroupId === id) { setEditingGroupId(null); setGroupNameInput(''); }
  };
  const toggleGroupMember = (groupId: string, identifier: string, checked: boolean) => {
    onChange({ ...asset, promptGroups: promptGroups.map((group) => group.id === groupId ? { ...group, identifiers: checked ? [...group.identifiers.filter((item) => item !== identifier), identifier] : group.identifiers.filter((item) => item !== identifier) } : group) });
  };
  const submitGroup = () => {
    if (editingGroupId && promptGroups.some((group) => group.id === editingGroupId)) renameGroup(editingGroupId, groupNameInput);
    else createGroup();
  };
  const updateData = (key: string, value: unknown) => onChange({ ...asset, data: { ...asset.data, [key]: value } });
  const updateOrders = (next: Order[]) => {
    if (orderReadOnly) { alert('多角色 prompt_order 请在“原始数据”中编辑，避免跨 character_id 串组。'); return; }
    updateData('prompt_order', mergePromptOrder(asset.data.prompt_order, next));
  };
  const updatePrompt = (key: string, value: unknown) => updateData('prompts', prompts.map((prompt) => prompt.identifier === selected ? { ...prompt, [key]: value } : prompt));
  const move = (identifier: string, direction: -1 | 1) => {
    const index = orders.findIndex((order) => order.identifier === identifier);
    const target = index + direction;
    if (target < 0 || target >= orders.length) return;
    const next = [...orders]; [next[index], next[target]] = [next[target], next[index]]; updateOrders(next);
  };
  const reorderPrompts = (dragIdentifier: string, dropIdentifier: string) => {
    if (dragIdentifier === dropIdentifier) return;
    const from = orders.findIndex((order) => order.identifier === dragIdentifier);
    const to = orders.findIndex((order) => order.identifier === dropIdentifier);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...orders];
    const [moved] = next.splice(from, 1);
    // 拖放到目标条目上表示“插入到它之前”：from < to 时移除后目标下标已前移一位。
    const insertIndex = from < to ? to - 1 : to;
    next.splice(insertIndex, 0, moved);
    updateOrders(next);
  };
  const addPrompt = () => {
    if (orderReadOnly) { alert('多角色 prompt_order 请在“原始数据”中新增条目。'); return; }
    const identifier = `custom_${crypto.randomUUID().slice(0, 8)}`;
    onChange({ ...asset, data: {
      ...asset.data,
      prompts: [...prompts, { identifier, name: '自定义条目', role: 'system', content: '', system_prompt: true, injection_position: 0, injection_depth: 0, injection_order: 100, injection_trigger: [] }],
      prompt_order: mergePromptOrder(asset.data.prompt_order, [...orders, { identifier, enabled: true }]),
    } });
    setSelected(identifier);
  };
  const importPrompt = (source: Prompt) => {
    if (orderReadOnly) { alert('多角色 prompt_order 请在“原始数据”中新增条目。'); return; }
    const used = new Set(prompts.map((prompt) => prompt.identifier));
    const identifier = used.has(source.identifier) ? `custom_${crypto.randomUUID().slice(0, 8)}` : source.identifier;
    const copy = { ...JSON.parse(JSON.stringify(source)), identifier };
    onChange({ ...asset, data: {
      ...asset.data,
      prompts: [...prompts, copy],
      prompt_order: mergePromptOrder(asset.data.prompt_order, [...orders, { identifier, enabled: true }]),
    } });
    setSelected(identifier);
    setImportOpen(false);
  };
  const insertPromptsAt = (targetId: string, nextPrompts: Prompt[], offset: 0 | 1) => {
    if (orderReadOnly) { alert('多角色 prompt_order 请在“原始数据”中新增条目。'); return; }
    const index = orders.findIndex((order) => order.identifier === targetId);
    const insertIndex = index < 0 ? orders.length : index + offset;
    const nextOrders = [...orders];
    nextOrders.splice(insertIndex, 0, ...nextPrompts.map((prompt) => ({ identifier: prompt.identifier, enabled: true })));
    onChange({ ...asset, data: {
      ...asset.data,
      prompts: [...prompts, ...nextPrompts],
      prompt_order: mergePromptOrder(asset.data.prompt_order, nextOrders),
    } });
    setSelected(nextPrompts[nextPrompts.length - 1].identifier);
  };
  const makePromptIdentifier = (base: string) => {
    const used = new Set(prompts.map((p) => p.identifier));
    return used.has(base) ? 'custom_' + crypto.randomUUID().slice(0, 8) : base;
  };
  const duplicatePromptAt = (targetId: string, offset: 0 | 1) => {
    const source = prompts.find((prompt) => prompt.identifier === targetId);
    if (!source || source.marker === true) return;
    const copy = JSON.parse(JSON.stringify(source)) as Prompt;
    copy.identifier = makePromptIdentifier('custom_' + crypto.randomUUID().slice(0, 8));
    copy.name = (source.name ?? source.identifier) + ' 副本';
    insertPromptsAt(targetId, [copy], offset);
  };
  const duplicatePromptBelow = (targetId: string) => duplicatePromptAt(targetId, 1);
  const duplicatePromptAbove = (targetId: string) => duplicatePromptAt(targetId, 0);
  const addPromptAt = (targetId: string, offset: 0 | 1) => {
    const identifier = makePromptIdentifier('custom_' + crypto.randomUUID().slice(0, 8));
    const next: Prompt = { identifier, name: '自定义条目', role: 'system', content: '', system_prompt: true, injection_position: 0, injection_depth: 0, injection_order: 100, injection_trigger: [] };
    insertPromptsAt(targetId, [next], offset);
  };
  const addPromptBelow = (targetId: string) => addPromptAt(targetId, 1);
  const addPromptAbove = (targetId: string) => addPromptAt(targetId, 0);
  const importPromptBelow = (targetId: string, sources: Record<string, unknown>[]) => {
    if (!sources.length) return;
    const used = new Set(prompts.map((prompt) => prompt.identifier));
    const copies: Prompt[] = [];
    for (const source of sources) {
      const copy = JSON.parse(JSON.stringify(source)) as Prompt;
      const base = String(source.identifier ?? '').trim();
      let identifier = base || 'custom_' + crypto.randomUUID().slice(0, 8);
      if (used.has(identifier)) identifier = 'custom_' + crypto.randomUUID().slice(0, 8);
      copy.identifier = identifier;
      used.add(identifier);
      if (!copy.name && typeof source.comment === 'string') copy.name = source.comment;
      copies.push(copy);
    }
    insertPromptsAt(targetId, copies, 1);
  };
  const removePrompt = () => {
    if (orderReadOnly) { alert('多角色 prompt_order 请在“原始数据”中删除条目。'); return; }
    if (!selectedPrompt || selectedPrompt.marker || ['main', 'nsfw', 'jailbreak'].includes(selected)) return;
    onChange({ ...asset, data: {
      ...asset.data,
      prompts: prompts.filter((prompt) => prompt.identifier !== selected),
      prompt_order: mergePromptOrder(asset.data.prompt_order, orders.filter((order) => order.identifier !== selected)),
    } });
  };
  const numberField = (label: string, key: string, step = 0.05) => <Field label={label}><input type="number" step={step} value={Number(asset.data[key] ?? 0)} onChange={(event) => updateData(key, Number(event.target.value))} /></Field>;
  const textField = (label: string, key: string, rows = 3) => <TextArea label={label} value={String(asset.data[key] ?? '')} onChange={(value) => updateData(key, value)} rows={rows} />;
  const linkedRegex = asset.relations
    .filter((relation) => relation.type === 'preset-regex')
    .flatMap((relation) => { const item = assets.find((asset) => asset.id === relation.targetId); return item && item.kind === 'regex' ? [item] : []; });
  const linkedIds = new Set(linkedRegex.map((item) => item.id));
  const renderOrderItem = (order: Order) => {
    const prompt = prompts.find((item) => item.identifier === order.identifier);
    if (!prompt) return null;
    const globalIndex = orders.findIndex((item) => item.identifier === order.identifier);
    return <div draggable className={`prompt-list-item ${selected === order.identifier ? 'active' : ''} ${dragId === order.identifier ? 'dragging' : ''} ${dragOverId === order.identifier ? 'drag-over' : ''}`} key={order.identifier} onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, identifier: order.identifier }); }} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', order.identifier); setDragId(order.identifier); setDragKind('prompt'); }} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDragOverId(order.identifier); }} onDrop={(event) => { event.stopPropagation(); reorderPrompts(dragId ?? '', order.identifier); setDragId(null); setDragOverId(null); setDragKind(null); setDragOverGroupId(null); }} onDragEnd={() => { setDragId(null); setDragOverId(null); setDragKind(null); setDragOverGroupId(null); }}><button className="prompt-select" onClick={() => setSelected(order.identifier)}><span className={`activation-dot ${order.enabled === false ? 'disabled' : ''}`} /><div><strong>{prompt.name ?? prompt.identifier}</strong><small>{prompt.marker ? '动态内容 Marker' : prompt.injection_position === 1 ? `In-Chat · Depth ${prompt.injection_depth ?? 0}` : prompt.role ?? 'system'}</small></div></button><div className="prompt-order-actions"><button onClick={() => updateOrders(orders.map((item) => item.identifier === order.identifier ? { ...item, enabled: item.enabled === false } : item))}>{order.enabled === false ? '关' : '开'}</button><button disabled={globalIndex === 0} onClick={() => move(order.identifier, -1)}><ArrowUp size={12} /></button><button disabled={globalIndex === orders.length - 1} onClick={() => move(order.identifier, 1)}><ArrowDown size={12} /></button></div></div>;
  };
  const linkableRegex = assets.filter((item) => item.kind === 'regex' && !linkedIds.has(item.id));
  return <div className="editor-body"><div className="editor-tabs"><button className={tab === 'prompts' ? 'active' : ''} onClick={() => setTab('prompts')}>提示词条目</button><button className={tab === 'parameters' ? 'active' : ''} onClick={() => setTab('parameters')}>采样参数</button><button className={tab === 'advanced' ? 'active' : ''} onClick={() => setTab('advanced')}>工具与高级</button><button className={tab === 'regex' ? 'active' : ''} onClick={() => setTab('regex')}>关联正则</button><button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>原始数据</button><span className="tab-spacer" /><Button variant="primary" icon={<FlaskConical size={14} />} onClick={onTest}>测试此预设</Button></div>
    {tab === 'prompts' && <div className="preset-layout"><aside className="prompt-list"><div className="entry-list-tools"><div className="prompt-tools-title"><span className="eyebrow">PROMPT ORDER</span><strong>{orders.length} 个条目</strong></div><Button icon={<Plus size={15} />} onClick={addPrompt}>自定义</Button><Button icon={<Copy size={15} />} onClick={() => setImportOpen(true)}>复用</Button><Button icon={<FolderPlus size={15} />} onClick={() => { setGroupNameInput(''); setEditingGroupId(null); setGroupModal(true); }}>分组</Button></div><div className="entry-list-scroll">{promptGroups.map((group, groupIndex) => { const members = orders.filter((order) => group.identifiers.includes(order.identifier)); const collapsed = collapsedGroups.includes(group.id); return <div className={`prompt-group ${dragOverGroupId === group.id ? 'drag-over' : ''}`} key={group.id} onDragOver={(event) => { if (dragKind === 'prompt') { event.preventDefault(); setDragOverGroupId(group.id); } }} onDragLeave={() => { if (dragOverGroupId === group.id) setDragOverGroupId(null); }} onDrop={() => { if (dragKind === 'prompt' && dragId) addIdentifierToGroup(group.id, dragId); setDragId(null); setDragKind(null); setDragOverGroupId(null); }}><div className="prompt-group-header"><button className="prompt-group-toggle" onClick={() => toggleCollapse(group.id)}><span className="prompt-group-caret">{collapsed ? "▸" : "▾"}</span><Folder size={12} /><strong>{group.name}</strong><span className="prompt-group-count">{members.length}</span></button><div className="prompt-group-actions"><button title="上移分组" disabled={groupIndex === 0} onClick={() => moveGroup(group.id, -1)}><ArrowUp size={11} /></button><button title="下移分组" disabled={groupIndex === promptGroups.length - 1} onClick={() => moveGroup(group.id, 1)}><ArrowDown size={11} /></button><button title="重命名" onClick={() => { setGroupNameInput(group.name); setEditingGroupId(group.id); setGroupModal(true); }}><Pencil size={11} /></button></div></div>{!collapsed && members.map((order) => renderOrderItem(order))}</div>; })}{ungroupedOrders.length > 0 && <div className="prompt-group-label">未分组</div>}{ungroupedOrders.map((order) => renderOrderItem(order))}</div><footer><TagInput tags={asset.tags} onChange={(tags) => onChange({ ...asset, tags })} /></footer></aside><main className="prompt-editor">{selectedPrompt ? <><div className="entry-heading"><Field label="显示名称"><input value={selectedPrompt.name ?? ''} onChange={(event) => updatePrompt('name', event.target.value)} /></Field><div className="prompt-id">{selectedPrompt.identifier}</div></div><div className="numeric-grid three"><Field label="Role"><select disabled={selectedPrompt.marker} value={selectedPrompt.role ?? 'system'} onChange={(event) => updatePrompt('role', event.target.value)}><option value="system">System</option><option value="user">User</option><option value="assistant">AI Assistant</option></select></Field><Field label="Position"><select disabled={selectedPrompt.marker} value={Number(selectedPrompt.injection_position ?? 0)} onChange={(event) => updatePrompt('injection_position', Number(event.target.value))}><option value={0}>Relative</option><option value={1}>In-Chat</option></select></Field><Field label="Injection Order"><input type="number" value={Number(selectedPrompt.injection_order ?? 100)} onChange={(event) => updatePrompt('injection_order', Number(event.target.value))} /></Field></div>{selectedPrompt.injection_position === 1 && <Field label="In-Chat Depth"><input type="number" min={0} value={Number(selectedPrompt.injection_depth ?? 0)} onChange={(event) => updatePrompt('injection_depth', Number(event.target.value))} /></Field>}<div className="field"><span className="field-label">条目内容 {selectedPrompt.marker && <small>Marker 由测试台展开为动态内容</small>}{!selectedPrompt.marker && <button className="field-ai" onClick={() => setAiOpen(true)}><Sparkles size={13} /> AI 辅助</button>}</span><textarea rows={14} disabled={selectedPrompt.marker} value={selectedPrompt.marker ? `此条目是 ${selectedPrompt.identifier} 标记，不包含固定正文。` : selectedPrompt.content ?? ''} onChange={(event) => updatePrompt('content', event.target.value)} placeholder="输入发送给模型的提示词，支持 {{char}} 与 {{user}}" /></div><Field label="生成触发条件"><div className="checkbox-grid">{['normal', 'continue', 'impersonate', 'swipe', 'regenerate', 'quiet'].map((trigger) => <label key={trigger}><input type="checkbox" checked={selectedPrompt.injection_trigger?.includes(trigger) ?? false} onChange={(event) => { const current = selectedPrompt.injection_trigger ?? []; updatePrompt('injection_trigger', event.target.checked ? [...current, trigger] : current.filter((item) => item !== trigger)); }} />{trigger}</label>)}</div></Field><div className="prompt-footer-note">不选择触发条件表示适用于所有生成类型。内置 Marker 不可删除。</div>{!selectedPrompt.marker && !['main', 'nsfw', 'jailbreak'].includes(selected) && <Button variant="danger" icon={<Trash2 size={14} />} onClick={removePrompt}>删除自定义条目</Button>}</> : <div className="small-empty">请选择条目</div>}</main></div>}
    {tab === 'parameters' && <div className="parameter-page"><section><span className="eyebrow">SAMPLING</span><h2>采样与上下文</h2><p>测试时发送通用 OpenAI-compatible 参数；其他原始字段仍保留在导出文件中。</p><div className="numeric-grid">{numberField('Temperature', 'temp_openai')}{numberField('Frequency Penalty', 'freq_pen_openai')}{numberField('Presence Penalty', 'pres_pen_openai')}{numberField('Top P', 'top_p_openai')}{numberField('Top K', 'top_k_openai', 1)}{numberField('Min P', 'min_p_openai')}{numberField('Repetition Penalty', 'repetition_penalty_openai')}{numberField('Seed', 'seed', 1)}</div></section><section><span className="eyebrow">CONTEXT</span><h2>上下文预算</h2><div className="numeric-grid three">{numberField('Max Context', 'openai_max_context', 1)}{numberField('Max Tokens', 'openai_max_tokens', 1)}{numberField('N', 'n', 1)}</div><div className="compatibility-note">Top K、Min P、Repetition Penalty 等字段会保留和导出，但首版通用测试请求只发送各服务普遍支持的参数，避免兼容服务拒绝请求。</div></section></div>}
    {tab === 'advanced' && <div className="advanced-preset"><section><h2>工具提示词</h2><div className="two-columns">{textField('New Chat', 'new_chat_prompt')}{textField('New Example Chat', 'new_example_chat_prompt')}{textField('Continue Nudge', 'continue_nudge_prompt')}{textField('Group Nudge', 'group_nudge_prompt')}{textField('Replace Empty Message', 'send_if_empty')}{textField('Impersonation Prompt', 'impersonation_prompt')}</div></section><section><h2>格式模板</h2><div className="two-columns">{textField('World Info · {0}', 'wi_format', 2)}{textField('Scenario · {{scenario}}', 'scenario_format', 2)}{textField('Personality · {{personality}}', 'personality_format', 2)}{textField('Continue Postfix', 'continue_postfix', 2)}</div></section><div className="compatibility-note">Web Search、Function Calling、媒体、Reasoning 和服务商专有字段可在原始数据中查看与编辑。平台不会执行导入的工具调用。</div></div>}
    {tab === 'regex' && <div className="advanced-preset"><section><div className="section-title"><div><span className="eyebrow">PRESET REGEX</span><h2>关联正则</h2><p>关联的正则会在导出预设时写入 extensions.regex_scripts。</p></div><Button variant="primary" icon={<Link2 size={14} />} onClick={() => setLinkOpen(true)}>关联正则</Button></div>{linkedRegex.length ? linkedRegex.map((item) => <div className="relation-row" key={item.id}><Braces size={17} /><div><strong>{item.name}</strong><span>{String(item.data.scriptName ?? '')}</span></div><button className="relation-remove" title="解除关联" onClick={() => onUnlinkRegex(item.id)}><X size={14} /></button></div>) : <div className="small-empty">还没有关联正则。关联后可在正则编辑器中一键写回，或在导出时自动并入预设。</div>}</section></div>}
    {tab === 'raw' && <RawDataEditor data={asset.data} onChange={(data) => onChange({ ...asset, data })} />}
    {importOpen && <Modal title="复用其它预设的条目" onClose={() => setImportOpen(false)} wide><div className="preset-import"><div className="link-column"><div className="link-column-title"><FlaskConical size={15} />来源预设<span>选择要复用的预设</span></div>{sourcePresets.length ? sourcePresets.map((item) => <div className={`preset-source-row ${sourcePreset?.id === item.id ? 'active' : ''}`} key={item.id}><button onClick={() => setImportSourceId(item.id)}><strong>{item.name}</strong><small>{Array.isArray(item.data.prompts) ? item.data.prompts.length : 0} 个条目</small></button></div>) : <div className="small-empty">没有其它预设可复用</div>}</div><div className="link-column"><div className="link-column-title"><Copy size={15} />条目<span>点击复制到当前预设，同名条目自动重命名</span></div>{sourcePrompts.length ? sourcePrompts.map((item) => <div className="link-row" key={item.identifier}><div><strong>{item.name ?? item.identifier}</strong><small>{item.marker ? '内置 Marker · 不可复用' : `${item.role ?? 'system'} · ${String(item.content ?? '').slice(0, 40) || '（空内容）'}`}</small></div><Button icon={<Copy size={13} />} disabled={item.marker} onClick={() => importPrompt(item)}>复制</Button></div>) : <div className="small-empty">该预设没有可复用的条目</div>}</div></div></Modal>}
    {linkOpen && <Modal title="关联正则到预设" onClose={() => setLinkOpen(false)} wide><div className="link-picker"><div className="link-column"><div className="link-column-title"><Braces size={15} />正则<span>可关联多条，导出时写入 extensions.regex_scripts</span></div>{linkableRegex.map((item) => <div className="link-row" key={item.id}><div><strong>{item.name}</strong><small>{String(item.data.scriptName ?? '')}</small></div><Button icon={<Link2 size={13} />} onClick={() => { onLinkRegex(item.id); setLinkOpen(false); }}>关联</Button></div>)}{!linkableRegex.length && <div className="small-empty">没有可关联的正则</div>}</div></div></Modal>}{aiOpen && selectedPrompt && <AiModal title={`预设条目 · ${selectedPrompt.name ?? selectedPrompt.identifier}`} content={selectedPrompt.content ?? ''} providers={providers} onClose={() => setAiOpen(false)} onApply={(value) => updatePrompt('content', value)} />}
    {groupModal && <Modal title="预设条目分组" onClose={() => setGroupModal(false)} wide><div className="prompt-group-manager"><div className="prompt-group-side"><div className="prompt-group-create"><input placeholder="新分组名称" value={groupNameInput} onChange={(event) => setGroupNameInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitGroup(); }} /><Button variant="primary" icon={<Plus size={14} />} onClick={submitGroup}>{editingGroup ? '重命名' : '新建分组'}</Button></div>{promptGroups.length ? promptGroups.map((group) => <div className={`prompt-group-manager-row ${editingGroupId === group.id ? 'active' : ''}`} key={group.id}><button className="prompt-group-manager-name" onClick={() => { setEditingGroupId(group.id); setGroupNameInput(group.name); }}><Folder size={13} /><span>{group.name}</span><small>{group.identifiers.length} 个条目</small></button><button className="prompt-group-manager-delete" title="删除分组" onClick={() => removeGroup(group.id)}><Trash2 size={13} /></button></div>) : <div className="small-empty">还没有分组，输入名称新建一个。</div>}</div><div className="prompt-group-members"><div className="prompt-group-members-title"><Folder size={15} /><span>{editingGroup ? `成员 · ${editingGroup.name}` : '选择条目加入分组'}</span></div>{editingGroup ? <div className="prompt-group-member-list">{prompts.length ? prompts.map((prompt) => <label key={prompt.identifier} className="prompt-group-member-row"><input type="checkbox" checked={editingGroup.identifiers.includes(prompt.identifier)} onChange={(event) => toggleGroupMember(editingGroup.id, prompt.identifier, event.target.checked)} /><span>{prompt.name ?? prompt.identifier}</span></label>) : <div className="small-empty">该预设没有条目。</div>}</div> : <div className="small-empty">从左侧选择一个分组来编辑成员，勾选条目即可加入该分组。</div>}</div></div><div className="modal-footer"><span>分组仅用于本工作区整理条目，导出预设时不会保存分组信息。</span><Button variant="primary" onClick={() => setGroupModal(false)}>完成</Button></div></Modal>}
    {groupCreateOpen && <Modal title="创建分组" onClose={() => setGroupCreateOpen(false)}><div className="field"><span className="field-label">分组名称</span><input autoFocus value={groupCreateName} onChange={(event) => setGroupCreateName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { createGroupWithIdentifier(groupCreateName, groupCreateTarget ?? ''); setGroupCreateOpen(false); } }} placeholder="输入分组名称" /></div><div className="modal-footer"><span>该条目会移入新分组，分组仅用于本工作区整理。</span><div className="form-actions"><Button onClick={() => setGroupCreateOpen(false)}>取消</Button><Button variant="primary" disabled={!groupCreateName.trim() || !groupCreateTarget} onClick={() => { createGroupWithIdentifier(groupCreateName, groupCreateTarget ?? ''); setGroupCreateOpen(false); }}>创建并移入</Button></div></div></Modal>}
    {menu && (() => { const p = prompts.find((item) => item.identifier === menu.identifier); return <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} actions={[
      { label: '复制到该条目下方', icon: <Copy size={14} />, disabled: !p || p.marker === true, onClick: () => { duplicatePromptBelow(menu.identifier); setMenu(null); } },
      { label: '复制到该条目上方', icon: <Copy size={14} />, disabled: !p || p.marker === true, onClick: () => { duplicatePromptAbove(menu.identifier); setMenu(null); } },
      { label: '在该条目下方新增条目', icon: <Plus size={14} />, onClick: () => { addPromptBelow(menu.identifier); setMenu(null); } },
      { label: '在该条目上方新增条目', icon: <Plus size={14} />, onClick: () => { addPromptAbove(menu.identifier); setMenu(null); } },
      { label: '创建分组并移入此条目', icon: <FolderPlus size={14} />, onClick: () => { setGroupCreateTarget(menu.identifier); setGroupCreateName(''); setGroupCreateOpen(true); setMenu(null); } },
      { label: '添加其它世界书或预设的条目', onClick: () => { setPickerTarget(menu.identifier); setMenu(null); } },
    ]} />; })()}
    {pickerTarget && <EntryImportPicker assets={assets} currentAssetId={asset.id} onClose={() => setPickerTarget(null)} onImport={(entries) => { importPromptBelow(pickerTarget, entries); setPickerTarget(null); }} />}
  </div>;
}
