import { BookOpen, Braces, Clock3, FilePlus2, Folder, FolderPlus, Import, MessagesSquare, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { kindNames } from '../../shared/defaults';
import type { Asset, AssetGroup, AssetKind } from '../../shared/types';
import { Button, Modal } from './UI';

const icons = { character: UserRound, lorebook: BookOpen, regex: Braces, preset: MessagesSquare };

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
};

export default function Library({ assets, groups, initialKind, onOpen, onNew, onImport, onCreateGroup, onRenameGroup, onRemoveGroup, onUpdateGroups }: LibraryProps) {
  const [kind, setKind] = useState<AssetKind | 'all'>(initialKind);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | 'all' | 'ungrouped'>('all');
  const [groupModal, setGroupModal] = useState<Asset | null>(null);

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

  return <div className="page library-page">
    <div className="page-heading"><div><span className="eyebrow">LOCAL LIBRARY</span><h1>{title}</h1><p>所有创作都留在这台设备上，按你的节奏慢慢打磨。</p></div><div className="heading-actions"><Button icon={<Import size={16} />} onClick={onImport}>导入素材</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => onNew(newKind)}>新建{initialKind === 'all' ? '角色卡' : kindNames[initialKind]}</Button></div></div>
    {initialKind === 'all' && <div className="stat-strip">{(Object.keys(kindNames) as AssetKind[]).map((item) => { const Icon = icons[item]; return <button key={item} onClick={() => setKind(item)}><Icon size={18} /><span>{kindNames[item]}</span><strong>{assets.filter((asset) => asset.kind === item).length}</strong></button>; })}<div className="local-stat"><span className="status-dot" />本地素材库已就绪</div></div>}
    <div className="library-toolbar"><div className="filter-tabs"><button className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')}>全部</button>{(Object.keys(kindNames) as AssetKind[]).map((item) => <button key={item} className={kind === item ? 'active' : ''} onClick={() => setKind(item)}>{kindNames[item]}</button>)}</div><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、标签或简介…" /></label></div>
    <div className="group-bar">
      <button className={activeGroup === 'all' ? 'active' : ''} onClick={() => setActiveGroup('all')}>全部</button>
      <button className={activeGroup === 'ungrouped' ? 'active' : ''} onClick={() => setActiveGroup('ungrouped')}>未分组</button>
      {groups.map((group) => <button key={group.id} className={activeGroup === group.id ? 'active' : ''} onClick={() => setActiveGroup(group.id)}>{group.name}<span className="group-count">{assets.filter((asset) => asset.groupIds.includes(group.id)).length}</span></button>)}
      <button className="group-add" onClick={() => { const name = prompt('新分组名称'); if (name) onCreateGroup(name); }}><FolderPlus size={14} />新建分组</button>
    </div>
    {filtered.length ? <div className="asset-grid">{filtered.map((asset) => { const Icon = icons[asset.kind]; return <article className="asset-card" key={asset.id} onClick={() => onOpen(asset)}><div className={`asset-icon ${asset.kind}`}><Icon size={23} /></div><div className="asset-card-top"><span className="asset-kind">{kindNames[asset.kind]}</span><span className="version-badge">v{asset.currentVersion}</span></div><h3>{asset.name}</h3><p>{asset.summary || asset.sourceName || '还没有添加简介，点击开始创作。'}</p><div className="asset-tags">{asset.groupIds.slice(0, 3).map((groupId) => { const group = groups.find((item) => item.id === groupId); return group ? <span className="tag group-tag" key={groupId}>{group.name}</span> : null; })}{asset.tags.slice(0, 3 - asset.groupIds.slice(0, 3).length).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><footer><span><Clock3 size={13} />{new Date(asset.updatedAt).toLocaleDateString('zh-CN')}</span><span>{asset.sourceFormat?.toUpperCase() ?? 'LOCAL'}</span></footer><button className="asset-group-btn" title="设置分组" onClick={(event) => { event.stopPropagation(); setGroupModal(asset); }}><Folder size={14} /></button></article>; })}<button className="new-asset-card" onClick={() => onNew(newKind)}><FilePlus2 size={25} /><span>从空白开始</span><small>创建一个新素材</small></button></div> : <div className="empty-state"><div className="empty-illustration"><FilePlus2 size={34} /></div><h2>{query || activeGroup !== 'all' ? '没有找到匹配的素材' : '这里还留着一张空白卡片'}</h2><p>{query || activeGroup !== 'all' ? '试试其他关键词、分组或素材分类。' : '导入现有作品，或从一张新角色卡开始。'}</p>{!query && activeGroup === 'all' && <Button variant="primary" icon={<Import size={16} />} onClick={onImport}>导入第一份素材</Button>}</div>}
    {groupModal && <Modal title={`分组 · ${groupModal.name}`} onClose={() => setGroupModal(null)}><div className="group-manager"><div className="group-manager-list">{groups.length ? groups.map((group) => <div className="group-manager-row" key={group.id}><label><input type="checkbox" checked={groupModal.groupIds.includes(group.id)} onChange={(event) => toggleGroupForModal(group.id, event.target.checked)} />{group.name}<small>{assets.filter((asset) => asset.groupIds.includes(group.id)).length} 个素材</small></label><div className="group-manager-actions"><button title="重命名" onClick={() => { const name = prompt('分组新名称', group.name); if (name) onRenameGroup(group.id, name); }}><Pencil size={13} /></button><button title="删除分组" onClick={() => { if (confirm(`删除分组“${group.name}”？分组内的素材不会被删除。`)) onRemoveGroup(group.id); }}><Trash2 size={13} /></button></div></div>) : <div className="small-empty">还没有分组，在下方新建一个。</div>}</div><div className="group-manager-create"><input placeholder="输入新分组名称" onKeyDown={(event) => { if (event.key === 'Enter') { const name = event.currentTarget.value.trim(); if (name) { onCreateGroup(name); event.currentTarget.value = ''; } } }} /><Button variant="primary" icon={<Plus size={14} />} onClick={(event) => { const input = event.currentTarget.parentElement?.querySelector('input') as HTMLInputElement | null; const name = input?.value.trim() ?? ''; if (name) { onCreateGroup(name); if (input) input.value = ''; } }}>新建</Button></div><div className="modal-footer"><span>分组会跨角色卡、世界书、正则与预设使用，一个素材可归入多个分组。</span></div></div></Modal>}
  </div>;
}
