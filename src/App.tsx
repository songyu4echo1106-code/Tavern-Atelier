import { Archive, BookOpen, Braces, CheckCircle2, ChevronLeft, Download, FlaskConical, History, LibraryBig, MessagesSquare, MoreHorizontal, Save, Settings as SettingsIcon, Trash2, TriangleAlert, Upload, UserRound, Fish, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { kindNames } from '../shared/defaults';
import { cardData, updateCardData } from '../shared/card';
import type { Asset, AssetKind, ImportResult, PublicAiProvider, WorkspaceData } from '../shared/types';
import Library from './components/Library';
import CharacterEditor from './components/CharacterEditor';
import LorebookEditor from './components/LorebookEditor';
import RegexEditor from './components/RegexEditor';
import PresetEditor from './components/PresetEditor';
import TestLab from './components/TestLab';
import Settings from './components/Settings';
import { Button, Modal, VersionPanel } from './components/UI';

type View = { name: 'library'; kind: AssetKind | 'all' } | { name: 'editor' } | { name: 'test' } | { name: 'settings' };

function findRegexIndex(scripts: Record<string, unknown>[], source: Record<string, unknown>): number {
  if (source.id) {
    return scripts.findIndex((script) => script.id === source.id);
  }
  const candidates = scripts.filter((script) => !script.id && script.scriptName === source.scriptName);
  if (!source.id && candidates.length > 1) throw new Error('关联素材中存在多个无 ID 的同名正则，无法安全确定写回目标。请先为它们补充唯一 ID。');
  return scripts.findIndex((script) => !script.id && script.scriptName === source.scriptName);
}

function bundlePreset(preset: Asset, assets: Asset[]): Record<string, unknown> {
  const regexAssets = preset.relations
    .filter((relation) => relation.type === 'preset-regex')
    .flatMap((relation) => {
      const asset = assets.find((item) => item.id === relation.targetId);
      return asset && asset.kind === 'regex' ? [asset] : [];
    });
  if (regexAssets.length === 0) return preset.data;
  const extensions = preset.data.extensions && typeof preset.data.extensions === 'object' && !Array.isArray(preset.data.extensions)
    ? { ...(preset.data.extensions as Record<string, unknown>) }
    : {};
  extensions.regex_scripts = regexAssets.map((asset) => JSON.parse(JSON.stringify(asset.data)));
  return { ...preset.data, extensions };
}

function bundleCharacter(character: Asset, assets: Asset[]): Record<string, unknown> {
  let data = character.data;
  const bookRelation = character.relations.find((relation) => relation.type === 'embedded-book');
  const book = bookRelation ? assets.find((asset) => asset.id === bookRelation.targetId) : undefined;
  if (book && book.kind === 'lorebook') {
    data = updateCardData(data, 'character_book', JSON.parse(JSON.stringify(book.data)));
  }
  const regexAssets = character.relations
    .filter((relation) => relation.type === 'scoped-regex')
    .flatMap((relation) => {
      const asset = assets.find((item) => item.id === relation.targetId);
      return asset && asset.kind === 'regex' ? [asset] : [];
    });
  if (regexAssets.length > 0) {
    const card = cardData(data);
    const extensions = card.extensions && typeof card.extensions === 'object' && !Array.isArray(card.extensions)
      ? { ...(card.extensions as Record<string, unknown>) }
      : {};
    extensions.regex_scripts = regexAssets.map((asset) => JSON.parse(JSON.stringify(asset.data)));
    data = updateCardData(data, 'extensions', extensions);
  }
  return data;
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData>({ assets: [], versions: {}, groups: [] });
  const [providers, setProviders] = useState<PublicAiProvider[]>([]);
  const [view, setView] = useState<View>({ name: 'library', kind: 'all' });
  const [draft, setDraft] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [removeChecked, setRemoveChecked] = useState<string[]>([]);
  const [testPreset, setTestPreset] = useState<string>();
  const [dropActive, setDropActive] = useState(false);
  const [importReport, setImportReport] = useState<ImportResult | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const notify = (message: string, error = false) => setToast({ message, error });
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 4500); return () => window.clearTimeout(timer); }, [toast]);
  const refresh = async () => setWorkspace(await window.tavern.library.list());
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    try {
      const blobs = await Promise.all(files.map(async (file) => ({ name: file.name, data: arrayBufferToBase64(await file.arrayBuffer()) })));
      const report = await window.tavern.library.importBlobs(blobs);
      await refresh();
      setImportReport(report);
      if (report.imported.length > 0) {
        notify(`已导入 ${report.imported.length} 份素材${report.warnings.length ? '，部分文件被跳过' : ''}`, report.warnings.length > 0);
      } else {
        notify('没有可导入的素材', true);
      }
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : String(reason), true);
    }
  };
  useEffect(() => {
    Promise.all([window.tavern.library.list(), window.tavern.providers.list()]).then(([data, services]) => {
      setWorkspace(data); setProviders(services); setLoading(false);
    }).catch((reason) => { notify(reason instanceof Error ? reason.message : String(reason), true); setLoading(false); });
  }, []);
  const open = (asset: Asset) => { setDraft(JSON.parse(JSON.stringify(asset)) as Asset); setView({ name: 'editor' }); };
  const create = async (kind: AssetKind) => {
    try {
      const asset = await window.tavern.library.create(kind); await refresh(); open(asset); notify(`已创建${kindNames[kind]}`);
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const importAssets = async () => {
    const result = await window.tavern.library.import();
    if (!result) return;
    await refresh();
    if (result.imported[0]) open(result.imported[0]);
    notify(`${result.imported.length ? `已导入 ${result.imported.length} 份素材（含自动提取的关联素材）` : '没有新增素材'}${result.warnings.length ? ` · ${result.warnings.join('；')}` : ''}`, result.warnings.length > 0 && !result.imported.length);
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await window.tavern.library.save(draft); setDraft(saved); await refresh(); notify(`已保存为版本 v${saved.currentVersion}`);
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
    finally { setSaving(false); }
  };
  const relatedOf = (asset: Asset) => asset.relations
    .filter((relation) => relation.type === 'embedded-book' || relation.type === 'scoped-regex')
    .flatMap((relation) => { const item = workspace.assets.find((asset) => asset.id === relation.targetId); return item ? [item] : []; });
  const relatedAssets = deleteTarget ? relatedOf(deleteTarget) : [];
  const requestDelete = (asset: Asset) => {
    const related = relatedOf(asset);
    if (asset.kind === 'character' && related.length > 0) {
      setRemoveChecked([]);
      setDeleteTarget(asset);
    } else if (confirm(`确定删除“${asset.name}”？原始导入文件会保留，但素材与版本记录将从库中移除。`)) {
      setRemoveChecked([]);
      void removeAsset(asset, related, []);
    }
  };
  const removeAsset = async (target: Asset, related: Asset[], checkedIds: string[]) => {
    try {
      for (const id of checkedIds) {
        if (related.some((asset) => asset.id === id)) await window.tavern.library.remove(id);
      }
      await window.tavern.library.remove(target.id);
      if (draft?.id === target.id) { setDraft(null); setView({ name: 'library', kind: 'all' }); }
      setDeleteTarget(null); setRemoveChecked([]);
      await refresh(); notify('素材已删除');
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const requestRemove = () => { if (draft) requestDelete(draft); };
  const exportAsset = async (format: 'json' | 'png') => {
    if (!draft || exporting) return;
    setExporting(true);
    try {
      const target = draft.kind === 'character' ? { ...draft, data: bundleCharacter(draft, workspace.assets) } : draft.kind === 'preset' ? { ...draft, data: bundlePreset(draft, workspace.assets) } : draft;
      const persisted = workspace.assets.find((asset) => asset.id === target.id);
      const current = persisted ? JSON.stringify({ data: persisted.data, name: persisted.name, tags: persisted.tags, summary: persisted.summary, relations: persisted.relations, favorite: persisted.favorite }) : '';
      const edited = JSON.stringify({ data: target.data, name: target.name, tags: target.tags, summary: target.summary, relations: target.relations, favorite: target.favorite });
      const saved = current === edited ? target : await window.tavern.library.save(target, '导出前整合关联素材');
      if (saved !== target) { setDraft(saved); await refresh(); }
      const filename = await window.tavern.library.export(saved.id, format); if (filename) notify(`已导出：${filename}`);
    }
    catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
    finally { setExporting(false); }
  };
  const restore = async (version: number) => {
    if (!draft || !confirm(`恢复版本 v${version}？当前内容会先保留为一个新版本。`)) return;
    try {
      const saved = await window.tavern.library.save(draft, `恢复 v${version} 前自动保存`);
      const asset = await window.tavern.library.restore(saved.id, version);
      setDraft(asset); await refresh(); setHistoryOpen(false); notify(`已恢复 v${version}，并生成 v${asset.currentVersion}`);
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const writeBack = async () => {
    if (!draft) return;
    try {
    const source = await window.tavern.library.save(draft, '写回前自动保存');
    setDraft(source);
    let count = 0;
    for (const relation of source.relations) {
      const target = workspace.assets.find((asset) => asset.id === relation.targetId);
      if (!target) continue;
      if (relation.type === 'embedded-book' && target.kind === 'character') {
        await window.tavern.library.save({ ...target, data: updateCardData(target.data, 'character_book', source.data) }, `从世界书“${source.name}”写回`); count += 1;
      }
      if (relation.type === 'scoped-regex' && target.kind === 'character') {
        const card = cardData(target.data); const extensions = { ...(card.extensions as Record<string, unknown>) };
        const scripts = Array.isArray(extensions.regex_scripts) ? [...extensions.regex_scripts] as Record<string, unknown>[] : [];
        const index = findRegexIndex(scripts, source.data);
        if (index >= 0) scripts[index] = source.data; else scripts.push(source.data);
        extensions.regex_scripts = scripts;
        await window.tavern.library.save({ ...target, data: updateCardData(target.data, 'extensions', extensions) }, `从正则“${source.name}”写回`); count += 1;
      }
      if (relation.type === 'preset-regex' && target.kind === 'preset') {
        const extensions = { ...(target.data.extensions as Record<string, unknown>) };
        const scripts = Array.isArray(extensions.regex_scripts) ? [...extensions.regex_scripts] as Record<string, unknown>[] : [];
        const index = findRegexIndex(scripts, source.data);
        if (index >= 0) scripts[index] = source.data; else scripts.push(source.data);
        extensions.regex_scripts = scripts;
        await window.tavern.library.save({ ...target, data: { ...target.data, extensions } }, `从正则“${source.name}”写回`); count += 1;
      }
    }
    await refresh(); notify(count ? `已写回 ${count} 份关联素材，并保留新版本` : '没有找到可写回的关联素材');
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const linkAsset = async (kind: 'lorebook' | 'regex', targetId: string) => {
    if (!draft || draft.kind !== 'character') return;
    const target = workspace.assets.find((asset) => asset.id === targetId);
    if (!target) return;
    const relType = kind === 'lorebook' ? 'embedded-book' : 'scoped-regex';
    try {
      if (!target.relations.some((relation) => relation.targetId === draft.id && relation.type === relType)) {
        await window.tavern.library.save({ ...target, relations: [...target.relations, { targetId: draft.id, type: relType }] }, `关联到角色卡“${draft.name}”`);
      }
      let relations = draft.relations.filter((relation) => relation.targetId !== targetId || relation.type !== relType);
      if (relType === 'embedded-book') relations = relations.filter((relation) => relation.type !== 'embedded-book');
      relations = [...relations, { targetId, type: relType }];
      const saved = await window.tavern.library.save({ ...draft, relations }, `关联${kind === 'lorebook' ? '世界书' : '正则'}“${target.name}”`);
      setDraft(saved); await refresh(); notify(`已关联${target.name}`);
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const unlinkAsset = async (targetId: string) => {
    if (!draft) return;
    const target = workspace.assets.find((asset) => asset.id === targetId);
    try {
      if (target) {
        await window.tavern.library.save({ ...target, relations: target.relations.filter((relation) => relation.targetId !== draft.id) }, `解除与角色卡“${draft.name}”的关联`);
      }
      const saved = await window.tavern.library.save({ ...draft, relations: draft.relations.filter((relation) => relation.targetId !== targetId) }, `解除关联“${target?.name ?? targetId}”`);
      setDraft(saved); await refresh(); notify('已解除关联');
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const linkRegexToPreset = async (regexId: string) => {
    if (!draft || draft.kind !== 'preset') return;
    const regex = workspace.assets.find((asset) => asset.id === regexId);
    if (!regex || regex.kind !== 'regex') return;
    try {
      if (!regex.relations.some((relation) => relation.targetId === draft.id && relation.type === 'preset-regex')) {
        await window.tavern.library.save({ ...regex, relations: [...regex.relations, { targetId: draft.id, type: 'preset-regex' }] }, `关联到预设“${draft.name}”`);
      }
      const relations = draft.relations.filter((relation) => relation.targetId !== regexId);
      const saved = await window.tavern.library.save({ ...draft, relations: [...relations, { targetId: regexId, type: 'preset-regex' }] }, `关联正则“${regex.name}”`);
      setDraft(saved); await refresh(); notify(`已关联 ${regex.name}`);
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const unlinkRegexFromPreset = async (regexId: string) => {
    if (!draft) return;
    const regex = workspace.assets.find((asset) => asset.id === regexId);
    try {
      if (regex) {
        await window.tavern.library.save({ ...regex, relations: regex.relations.filter((relation) => relation.targetId !== draft.id) }, `解除与预设“${draft.name}”的关联`);
      }
      const saved = await window.tavern.library.save({ ...draft, relations: draft.relations.filter((relation) => relation.targetId !== regexId) }, `解除关联“${regex?.name ?? regexId}”`);
      setDraft(saved); await refresh(); notify('已解除关联');
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
    const backup = async () => { const file = await window.tavern.backup.create(); if (file) notify(`备份已创建：${file}`); };
  const restoreBackup = async () => {
    if (!confirm('恢复会替换当前工作区。应用会先保留恢复前副本，是否继续？')) return;
    if (await window.tavern.backup.restore()) { await refresh(); setDraft(null); setView({ name: 'library', kind: 'all' }); notify('备份已恢复'); }
  };
  const createGroup = async (name: string) => {
    try { const groups = await window.tavern.groups.create(name); setWorkspace((prev) => ({ ...prev, groups })); }
    catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const renameGroup = async (id: string, name: string) => {
    try { const groups = await window.tavern.groups.rename(id, name); setWorkspace((prev) => ({ ...prev, groups })); }
    catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const removeGroup = async (id: string) => {
    try {
      const groups = await window.tavern.groups.remove(id);
      setWorkspace((prev) => ({ ...prev, groups }));
      await refresh();
    }
    catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const updateAssetGroups = async (assetId: string, groupIds: string[]) => {
    const asset = workspace.assets.find((item) => item.id === assetId);
    if (!asset) return;
    try { await window.tavern.library.save({ ...asset, groupIds }, '调整分组'); await refresh(); }
    catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const pickAvatar = async () => {
    try {
      const avatar = await window.tavern.library.pickAvatar();
      return avatar;
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : String(reason), true);
      return null;
    }
  };
  const setAvatar = async (avatar: { kind: 'local' | 'url'; value: string } | null) => {
    if (!draft) return;
    try {
      const updated = await window.tavern.library.setAvatar(draft.id, avatar);
      setDraft(updated);
      await refresh();
      notify(avatar ? '头像已更新' : '头像已移除');
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const testCurrentPreset = async () => {
    if (!draft) return;
    try {
      const saved = await window.tavern.library.save(draft, '测试前自动保存');
      setDraft(saved); await refresh(); setTestPreset(saved.id); setView({ name: 'test' });
    } catch (reason) { notify(reason instanceof Error ? reason.message : String(reason), true); }
  };
  const navigate = (next: View) => { setView(next); if (next.name !== 'editor') setHistoryOpen(false); };
  const navItems: { kind: AssetKind; icon: typeof UserRound }[] = [{ kind: 'character', icon: UserRound }, { kind: 'lorebook', icon: BookOpen }, { kind: 'regex', icon: Braces }, { kind: 'preset', icon: MessagesSquare }];
  if (loading) return <div className="app-loading"><Fish className="swim" size={30} /><span>宋鱼正在游入酒馆…</span></div>;
  return <div className={`app-shell ${dropActive ? "drop-active" : ""}`}
    onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); event.stopPropagation(); setDropActive(true); } }}
    onDragLeave={(event) => { event.preventDefault(); event.stopPropagation(); if (event.currentTarget === event.target) setDropActive(false); }}
    onDrop={handleDrop}
  ><aside className="sidebar"><button className="brand" onClick={() => navigate({ name: 'library', kind: 'all' })}><span className="brand-mark"><Fish size={20} /></span><span><strong>宋鱼 · 酒馆工坊</strong><small>SONGYU · TAVERN ATELIER</small></span></button><nav><button className={view.name === 'library' && view.kind === 'all' ? 'active' : ''} onClick={() => navigate({ name: 'library', kind: 'all' })}><LibraryBig size={18} /><span>素材库</span></button><div className="nav-label">创作工作台</div>{navItems.map(({ kind, icon: Icon }) => <button key={kind} className={view.name === 'library' && view.kind === kind || view.name === 'editor' && draft?.kind === kind ? 'active' : ''} onClick={() => navigate({ name: 'library', kind })}><Icon size={18} /><span>{kindNames[kind]}</span><small>{workspace.assets.filter((asset) => asset.kind === kind).length}</small></button>)}<div className="nav-label">调试与设置</div><button className={view.name === 'test' ? 'active' : ''} onClick={() => { setTestPreset(undefined); navigate({ name: 'test' }); }}><FlaskConical size={18} /><span>预设测试台</span></button><button className={view.name === 'settings' ? 'active' : ''} onClick={() => navigate({ name: 'settings' })}><SettingsIcon size={18} /><span>服务与数据</span></button></nav><div className="sidebar-bottom"><div className="local-card"><Archive size={17} /><div><strong>本地优先</strong><span><i className="status-dot" />数据已保存在本机</span></div></div><small>SONGYU ATELIER · v0.2</small></div></aside><main className="main-panel">
    {view.name === 'library' && <Library key={view.kind} assets={view.kind === 'all' ? workspace.assets : workspace.assets.filter((asset) => asset.kind === view.kind)} groups={workspace.groups} initialKind={view.kind} onOpen={open} onNew={create} onImport={importAssets} onCreateGroup={createGroup} onRenameGroup={renameGroup} onRemoveGroup={removeGroup} onUpdateGroups={updateAssetGroups} onDelete={requestDelete} />}
    {view.name === 'editor' && draft && <div className="editor-page"><header className="editor-header"><Button variant="ghost" icon={<ChevronLeft size={18} />} onClick={() => navigate({ name: 'library', kind: draft.kind })}>返回</Button><div className="editor-title"><span>{kindNames[draft.kind]} · v{draft.currentVersion}</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} disabled={draft.kind === 'character' || draft.kind === 'regex'} /></div><div className="editor-actions"><Button icon={<History size={15} />} onClick={() => setHistoryOpen(true)}>版本</Button><Button icon={<Download size={15} />} onClick={() => exportAsset('json')}>导出 JSON</Button>{draft.kind === 'character' && <Button icon={<Download size={15} />} onClick={() => exportAsset('png')}>导出 PNG</Button>}<Button variant="ghost" icon={<Trash2 size={16} />} onClick={requestRemove} /><Button variant="primary" icon={<Save size={15} />} onClick={save} disabled={saving}>{saving ? '保存中…' : '保存新版本'}</Button><MoreHorizontal size={18} /></div></header>{draft.kind === 'character' && <CharacterEditor asset={draft} assets={workspace.assets} providers={providers} onChange={setDraft} onLink={linkAsset} onUnlink={unlinkAsset} onPickAvatar={pickAvatar} onSetAvatar={setAvatar} />}{draft.kind === 'lorebook' && <LorebookEditor asset={draft} assets={workspace.assets} providers={providers} onChange={setDraft} onWriteBack={writeBack} />}{draft.kind === 'regex' && <RegexEditor asset={draft} providers={providers} onChange={setDraft} onWriteBack={writeBack} />}{draft.kind === 'preset' && <PresetEditor asset={draft} assets={workspace.assets} providers={providers} onChange={setDraft} onTest={testCurrentPreset} onLinkRegex={linkRegexToPreset} onUnlinkRegex={unlinkRegexFromPreset} />}</div>}
    {view.name === 'test' && <TestLab assets={workspace.assets} providers={providers} initialPreset={testPreset} onOpenSettings={() => navigate({ name: 'settings' })} />}
    {view.name === 'settings' && <Settings providers={providers} onProviders={setProviders} onBackup={backup} onRestore={restoreBackup} notify={notify} />}
    </main>{dropActive && <div className="drop-overlay"><div className="drop-overlay-inner"><Upload size={38} /><strong>松开以导入素材</strong><span>自动识别角色卡、世界书、正则或 Chat 预设</span></div></div>}{importReport && <Modal title="导入结果" onClose={() => setImportReport(null)} wide><div className="import-report"><div className={`import-report-summary ${importReport.warnings.length ? "warn" : "ok"}`}>{importReport.imported.length > 0 ? <><CheckCircle2 size={18} /><span>成功导入 {importReport.imported.length} 份素材{importReport.warnings.length ? `，另有 ${importReport.warnings.length} 项警告` : ""}</span></> : <><TriangleAlert size={18} /><span>没有可导入的素材</span></>}</div>{importReport.imported.length > 0 && <div className="import-report-section"><span className="eyebrow">IMPORTED</span><ul>{importReport.imported.map((asset, index) => <li key={index}>{kindNames[asset.kind]} · {asset.name}</li>)}</ul></div>}{importReport.warnings.length > 0 && <div className="import-report-section"><span className="eyebrow">WARNINGS</span><ul className="warnings">{importReport.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div className="modal-footer"><Button variant="primary" onClick={() => setImportReport(null)}>知道了</Button></div></div></Modal>}{deleteTarget && <Modal title={`删除 ${kindNames[deleteTarget.kind]} · ${deleteTarget.name}`} onClose={() => setDeleteTarget(null)}><p className="remove-hint">删除时可同时删除它提取出的关联素材。不勾选则仅删除当前素材，关联素材会保留并归入“未分组”。</p><div className="remove-related">{relatedAssets.length ? <><div className="remove-select-all"><label><input type="checkbox" checked={relatedAssets.length > 0 && removeChecked.length === relatedAssets.length} onChange={(event) => setRemoveChecked(event.target.checked ? relatedAssets.map((asset) => asset.id) : [])} /><span>全选</span></label><span>{removeChecked.length} / {relatedAssets.length}</span></div>{relatedAssets.map((asset) => <label key={asset.id} className="remove-related-row"><input type="checkbox" checked={removeChecked.includes(asset.id)} onChange={(event) => setRemoveChecked(event.target.checked ? [...removeChecked, asset.id] : removeChecked.filter((id) => id !== asset.id))} /><span>{kindNames[asset.kind]} · {asset.name}</span></label>)}</> : <div className="small-empty">没有可一并删除的关联素材</div>}</div><div className="modal-footer"><Button onClick={() => setDeleteTarget(null)}>取消</Button><div className="form-actions"><Button onClick={() => { setRemoveChecked([]); void removeAsset(deleteTarget, relatedAssets, []); }}>仅删除当前素材</Button><Button variant="danger" disabled={removeChecked.length === 0} onClick={() => void removeAsset(deleteTarget, relatedAssets, removeChecked)}>删除及勾选素材</Button></div></div></Modal>}{historyOpen && draft && <VersionPanel versions={workspace.versions[draft.id] ?? []} onRestore={restore} onClose={() => setHistoryOpen(false)} />}{toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.error ? <XCircle size={18} /> : <CheckCircle2 size={18} />}<span>{toast.message}</span><button onClick={() => setToast(null)}>×</button></div>}</div>;
}
