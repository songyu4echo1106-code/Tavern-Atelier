import { BookOpen, Braces, Check, CheckSquare, Clock3, FilePlus2, FileText, Folder, FolderPlus, Hash, Import, LayoutList, MessagesSquare, Pencil, Plus, Search, Trash2, UserRound, Fish } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { kindNames } from '../../shared/defaults';
import { assetTokenCount } from '../../shared/tokens';
import type { Asset, AssetGroup, AssetKind } from '../../shared/types';
import { Button, Modal } from './UI';

const icons = { character: UserRound, lorebook: BookOpen, regex: Braces, preset: MessagesSquare, document: FileText };

function CardVisual({ asset, show }: { asset: Asset; show: boolean }) {
  const Icon = icons[asset.kind];
  const [src, setSrc] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setSrc(''); setLoaded(false);
    if (!show || !asset.avatar) return;
    let cancelled = false;
    const apply = (value: string) => { if (!cancelled) { setSrc(value); setLoaded(Boolean(value)); } };
    if (asset.avatar.kind === 'url') apply(asset.avatar.value);
    else void window.tavern.library.imageData(asset.avatar.value).then((data) => apply(data ?? ''));
    return () => { cancelled = true; };
  }, [asset.id, asset.avatar?.kind, asset.avatar?.value, show]);
  if (show && loaded) return <img className="asset-card-img" src={src} alt={asset.name} />;
  return <div className={`asset-icon ${asset.kind}`}><Icon size={23} /></div>;
}

type LibraryProps = {
  assets: Asset[];
  groups: AssetGroup[];
  initialKind: AssetKind | 'all';
  onOpen: (asset: Asset) => void;
  onNew: (kind: AssetKind) => void;
  onImport: () => void;
  onCreateGroup: (name: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onRemoveGroup: (id: string) => void;
  onUpdateGroups: (assetId: string, groupIds: string[]) => void;
  onUpdateSummary: (assetId: string, summary: string) => void;
  onDelete: (asset: Asset) => void;
  onDeleteMany: (assetIds: string[]) => void;
};

type NameModal = { mode: 'create' } | { mode: 'rename'; groupId: string; name: string };

export default function Library({ assets, groups, initialKind, onOpen, onNew, onImport, onCreateGroup, onRenameGroup, onRemoveGroup, onUpdateGroups, onUpdateSummary, onDelete, onDeleteMany }: LibraryProps) {
  const [kind, setKind] = useState<AssetKind | 'all'>(initialKind);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | 'all' | 'ungrouped'>('all');
  const [showImages, setShowImages] = useState(false);
  const [groupModal, setGroupModal] = useState<Asset | null>(null);
  const [nameModal, setNameModal] = useState<NameModal | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [summaryModal, setSummaryModal] = useState<Asset | null>(null);
  const [summaryInput, setSummaryInput] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteGroupModal, setDeleteGroupModal] = useState<AssetGroup | null>(null);

  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesKind = kind === 'all' || asset.kind === kind;
    const haystack = `${asset.name} ${asset.summary} ${asset.tags.join(' ')}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesGroup = activeGroup === 'all' ? true : activeGroup === 'ungrouped' ? asset.groupIds.length === 0 : asset.groupIds.includes(activeGroup);
    return matchesKind && matchesQuery && matchesGroup;
  }), [assets, kind, query, activeGroup]);

  const title = initialKind === 'all' ? '素材库' : kindNames[initialKind];
  const newKind = initialKind === 'all' ? 'character' : initialKind;

  const toggleGroupForModal = (groupId: string, checked: boolean) => {
    if (!groupModal) return;
    const next = checked ? [...groupModal.groupIds, groupId] : groupModal.groupIds.filter((id) => id !== groupId);
    onUpdateGroups(groupModal.id, next);
    setGroupModal({ ...groupModal, groupIds: next });
  };

  const openCreateModal = () => { setNameInput(''); setNameModal({ mode: 'create' }); };
  const openRenameModal = (group: AssetGroup) => { setNameInput(group.name); setNameModal({ mode: 'rename', groupId: group.id, name: group.name }); };
  const submitName = () => {
    const value = nameInput.trim();
    if (!value || !nameModal) return;
    if (nameModal.mode === 'create') onCreateGroup(value);
    else onRenameGroup(nameModal.groupId, value);
    setNameModal(null);
  };
  const toggleSelected = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  const selectAll = () => setSelectedIds(filtered.map((asset) => asset.id));
  const selectNone = () => setSelectedIds([]);
  const exitSelection = () => { setSelectionMode(false); setSelectedIds([]); };
  const deleteSelected = () => { onDeleteMany(selectedIds); setSelectedIds([]); };

  return <div className="page library-page">
    <div className="page-heading"><div><span className="eyebrow">LOCAL LIBRARY</span><h1>{title}</h1><p>所有创作都留在这台设备上，按你的节奏慢慢打磨。</p></div><div className="heading-actions"><Button icon={<Import size={16} />} onClick={onImport}>导入素材</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => onNew(newKind)}>新建{initialKind === 'all' ? '角色卡' : kindNames[initialKind]}</Button></div></div>
    {initialKind === 'all' && <div className="stat-strip">{(Object.keys(kindNames) as AssetKind[]).map((item) => { const Icon = icons[item]; return <button key={item} onClick={() => setKind(item)}><Icon size={18} /><span>{kindNames[item]}</span><strong>{assets.filter((asset) => asset.kind === item).length}</strong></button>; })}<div className="local-stat"><span className="status-dot" />本地素材库已就绪</div></div>}
    <div className="library-toolbar"><div className="filter-tabs"><button className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')}>全部</button>{(Object.keys(kindNames) as AssetKind[]).map((item) => <button key={item} className={kind === item ? 'active' : ''} onClick={() => setKind(item)}>{kindNames[item]}</button>)}</div><div className="toolbar-right"><button className={`view-toggle ${selectionMode ? 'active' : ''}`} title="多选删除" onClick={() => { setSelectionMode((value) => !value); setSelectedIds([]); }}><CheckSquare size={15} /><span>多选</span></button><button className={`view-toggle ${showImages ? 'active' : ''}`} title={showImages ? '切换为图标展示' : '切换为图片展示'} onClick={() => setShowImages((value) => !value)}>{showImages ? <LayoutList size={15} /> : <img alt="" className="view-toggle-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E" />}<span>{showImages ? '图标' : '图片'}</span></button><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、标签或简介…" /></label></div></div>
    <div className="group-bar">
      <button className={activeGroup === 'all' ? 'active' : ''} onClick={() => setActiveGroup('all')}>全部</button>
      <button className={activeGroup === 'ungrouped' ? 'active' : ''} onClick={() => setActiveGroup('ungrouped')}>未分组</button>
      {groups.map((group) => <span key={group.id} className={`group-pill ${activeGroup === group.id ? 'active' : ''}`}><button className="group-pill-main" onClick={() => setActiveGroup(group.id)}>{group.name}<span className="group-count">{assets.filter((asset) => asset.groupIds.includes(group.id)).length}</span></button><button className="group-delete" title="删除分组" onClick={() => setDeleteGroupModal(group)}><Trash2 size={12} /></button></span>)}
      <button className="group-add" onClick={openCreateModal}><FolderPlus size={14} />新建分组</button>
    </div>
    {selectionMode && <div className="selection-bar"><div className="selection-actions"><Button variant="ghost" icon={<Check size={14} />} onClick={selectAll}>全选</Button><Button variant="ghost" onClick={selectNone}>全不选</Button></div><span className="selection-count">已选 {selectedIds.filter((id) => filtered.some((asset) => asset.id === id)).length} / {filtered.length} 个</span><div className="selection-actions"><Button variant="danger" icon={<Trash2 size={14} />} disabled={selectedIds.length === 0} onClick={deleteSelected}>删除选中</Button><Button onClick={exitSelection}>退出多选</Button></div></div>}
    {filtered.length ? <div className="asset-grid">{filtered.map((asset) => <article className={`asset-card ${selectionMode ? 'selectable' : ''}`} key={asset.id} onClick={() => selectionMode ? toggleSelected(asset.id) : onOpen(asset)}><CardVisual asset={asset} show={showImages} />{selectionMode && <button className={`asset-select ${selectedIds.includes(asset.id) ? 'checked' : ''}`} onClick={(event) => { event.stopPropagation(); toggleSelected(asset.id); }}>{selectedIds.includes(asset.id) ? <Check size={14} /> : null}</button>}<div className="asset-card-top"><span className="asset-kind">{kindNames[asset.kind]}</span><span className="version-badge">v{asset.currentVersion}</span>{asset.kind !== 'document' && <span className="asset-token" title="内容 token（估算值）"><Hash size={11} />{assetTokenCount(asset).toLocaleString('zh-CN')}</span>}</div><h3>{asset.name}</h3><p title={asset.summary || asset.sourceName || ''}>{asset.summary || asset.sourceName || '还没有添加简介，点击开始创作。'}</p><div className="asset-tags">{asset.groupIds.slice(0, 3).map((groupId) => { const group = groups.find((item) => item.id === groupId); return group ? <span className="tag group-tag" key={groupId}>{group.name}</span> : null; })}{asset.tags.slice(0, Math.max(0, 3 - asset.groupIds.length)).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><footer><span><Clock3 size={13} />{new Date(asset.updatedAt).toLocaleDateString('zh-CN')}</span><span>{asset.sourceFormat?.toUpperCase() ?? 'LOCAL'}</span></footer><button className="asset-delete-btn" title="删除" onClick={(event) => { event.stopPropagation(); onDelete(asset); }}><Trash2 size={14} /></button><button className="asset-group-btn" title="设置分组" onClick={(event) => { event.stopPropagation(); setGroupModal(asset); }}><Folder size={14} /></button><button className="asset-summary-btn" title="编辑简介" onClick={(event) => { event.stopPropagation(); setSummaryInput(asset.summary ?? ''); setSummaryModal(asset); }}><Pencil size={14} /></button></article>)}<button className="new-asset-card" onClick={() => onNew(newKind)}><FilePlus2 size={25} /><span>从空白开始</span><small>创建一个新素材</small></button></div> : <div className="empty-state"><div className="empty-illustration fish-illustration"><Fish size={34} /></div><h2>{query || activeGroup !== 'all' ? '没有找到匹配的素材' : '池塘里还没有鱼'}</h2><p>{query || activeGroup !== 'all' ? '试试其他关键词、分组或素材分类。' : '导入现有作品，或从一张新角色卡开始。'}</p>{!query && activeGroup === 'all' && <Button variant="primary" icon={<Import size={16} />} onClick={onImport}>导入第一份素材</Button>}</div>}
    {groupModal && <Modal title={`分组 · ${groupModal.name}`} onClose={() => setGroupModal(null)}><div className="group-manager"><div className="group-manager-list">{groups.length ? groups.map((group) => <div className="group-manager-row" key={group.id}><label><input type="checkbox" checked={groupModal.groupIds.includes(group.id)} onChange={(event) => toggleGroupForModal(group.id, event.target.checked)} />{group.name}<small>{assets.filter((asset) => asset.groupIds.includes(group.id)).length} 个素材</small></label><div className="group-manager-actions"><button title="重命名" onClick={() => openRenameModal(group)}><Pencil size={13} /></button><button title="删除分组" onClick={() => setDeleteGroupModal(group)}><Trash2 size={13} /></button></div></div>) : <div className="small-empty">还没有分组，在下方新建一个。</div>}</div><div className="group-manager-create"><input placeholder="输入新分组名称" onKeyDown={(event) => { if (event.key === 'Enter') { const name = event.currentTarget.value.trim(); if (name) { onCreateGroup(name); event.currentTarget.value = ''; } } }} /><Button variant="primary" icon={<Plus size={14} />} onClick={(event) => { const input = event.currentTarget.parentElement?.querySelector('input') as HTMLInputElement | null; const name = input?.value.trim() ?? ''; if (name) { onCreateGroup(name); if (input) input.value = ''; } }}>新建</Button></div><div className="modal-footer"><span>分组会跨角色卡、世界书、正则与预设使用，一个素材可归入多个分组。</span></div></div></Modal>}
    {nameModal && <Modal title={nameModal.mode === 'create' ? '新建分组' : '重命名分组'} onClose={() => setNameModal(null)}><div className="field"><span className="field-label">分组名称</span><input autoFocus value={nameInput} onChange={(event) => setNameInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitName(); }} placeholder="输入分组名称" /></div><div className="modal-footer"><span>分组名称不可与现有分组重复。</span><div className="form-actions"><Button onClick={() => setNameModal(null)}>取消</Button><Button variant="primary" disabled={!nameInput.trim()} onClick={submitName}>确定</Button></div></div></Modal>}
    {summaryModal && <Modal title={`简介 · ${summaryModal.name}`} onClose={() => setSummaryModal(null)}><div className="field"><span className="field-label">素材简介 <small>方便回看作者 / 出处 / 备注</small></span><textarea rows={5} autoFocus value={summaryInput} onChange={(event) => setSummaryInput(event.target.value)} placeholder="例如：作者、原作出处、适用场景等" /></div><div className="modal-footer"><span>简介会显示在素材卡片上，也可用于搜索。</span><div className="form-actions"><Button onClick={() => setSummaryModal(null)}>取消</Button><Button variant="primary" onClick={() => { onUpdateSummary(summaryModal.id, summaryInput.trim()); setSummaryModal(null); }}>保存简介</Button></div></div></Modal>}
    {deleteGroupModal && (() => { const group = deleteGroupModal; return <Modal title={`删除分组 · ${group.name}`} onClose={() => setDeleteGroupModal(null)}><p className="remove-hint">确定删除分组“{group.name}”？分组内的素材不会被删除，会自动归入“未分组”。</p><div className="modal-footer"><span>{assets.filter((asset) => asset.groupIds.includes(group.id)).length} 个素材将归入未分组</span><div className="form-actions"><Button onClick={() => setDeleteGroupModal(null)}>取消</Button><Button variant="danger" icon={<Trash2 size={14} />} onClick={() => { onRemoveGroup(group.id); setDeleteGroupModal(null); setActiveGroup('all'); }}>删除分组</Button></div></div></Modal>; })()}
  </div>;
}
