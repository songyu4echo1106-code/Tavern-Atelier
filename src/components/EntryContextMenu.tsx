import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, FileText, X } from 'lucide-react';
import type { Asset } from '../../shared/types';
import { Modal, Button } from './UI';

export interface MenuAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

// 固定定位的右键菜单。挂载后监听全局点击/Escape/滚动关闭（在 onClose 前先 stopPropagation 内部点击）。
export function ContextMenu(props: {
  x: number;
  y: number;
  actions: MenuAction[];
  onClose: () => void;
}): ReactNode {
  const estimatedWidth = 210;
  const estimatedHeight = props.actions.length * 30 + 10;
  const alignRight = props.x + estimatedWidth > window.innerWidth;
  const alignBottom = props.y + estimatedHeight > window.innerHeight;
  const style = {
    left: alignRight ? undefined : props.x,
    right: alignRight ? Math.max(8, window.innerWidth - props.x) : undefined,
    top: alignBottom ? undefined : props.y,
    bottom: alignBottom ? Math.max(8, window.innerHeight - props.y) : undefined,
  };

  useEffect(() => {
    const close = () => props.onClose();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      props.onClose();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', close, true);
    };
  }, [props.onClose]);

  return (
    <div className="context-menu" style={style} role="menu">
      {props.actions.map((action, index) => (
        <button
          className={`context-menu-item ${action.danger ? 'danger' : ''}`}
          disabled={action.disabled}
          key={`${action.label}-${index}`}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
            props.onClose();
          }}
          role="menuitem"
          type="button"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

export interface ImportableEntry {
  key: string;
  title: string;
  meta: string;
  preview: string;
  disabled?: boolean;
  data: Record<string, unknown>;
}

// 世界书条目：data.entries 为数组或对象
function lorebookEntries(asset: Asset): ImportableEntry[] {
  const entries = asset.data.entries;
  const pairs: [string, Record<string, unknown>][] = [];
  if (Array.isArray(entries)) entries.forEach((e, i) => pairs.push([String(i), e as Record<string, unknown>]));
  else if (entries && typeof entries === 'object') pairs.push(...Object.entries(entries as Record<string, Record<string, unknown>>));
  return pairs.map(([key, item]) => ({
    key,
    title: String(item.comment ?? item.title ?? `条目 ${key}`),
    meta: (Array.isArray(item.key) ? item.key.map(String).slice(0, 4).join(' · ') : '') || '无关键词',
    preview: String(item.content ?? ''),
    data: JSON.parse(JSON.stringify(item)) as Record<string, unknown>,
  }));
}

// 预设条目：data.prompts 数组
function presetEntries(asset: Asset): ImportableEntry[] {
  const prompts = Array.isArray(asset.data.prompts) ? asset.data.prompts : [];
  return prompts.map((p, i) => {
    const item = p as Record<string, unknown>;
    const identifier = String(item.identifier ?? i);
    const marker = item.marker === true;
    return {
      key: identifier,
      title: String(item.name ?? identifier),
      meta: marker ? '内置 Marker · 不可复用' : `${String(item.role ?? 'system')} · ${String(item.content ?? '').slice(0, 30) || '（空内容）'}`,
      preview: marker ? `此条目是 ${identifier} 标记，不包含固定正文。` : String(item.content ?? ''),
      disabled: marker,
      data: JSON.parse(JSON.stringify(item)) as Record<string, unknown>,
    };
  });
}

function entryCount(asset: Asset): number {
  if (asset.kind === 'preset') return Array.isArray(asset.data.prompts) ? asset.data.prompts.length : 0;
  const entries = asset.data.entries;
  if (Array.isArray(entries)) return entries.length;
  if (entries && typeof entries === 'object') return Object.keys(entries).length;
  return 0;
}

function entriesForAsset(asset: Asset): ImportableEntry[] {
  if (asset.kind === 'lorebook') return lorebookEntries(asset);
  if (asset.kind === 'preset') return presetEntries(asset);
  return [];
}

// 三步选择器弹窗：选择来源种类(世界书/预设) -> 选择具体素材 -> 选择条目并预览正文
export function EntryImportPicker(props: {
  assets: Asset[];
  currentAssetId: string;
  onClose: () => void;
  onImport: (entry: Record<string, unknown>) => void;
}): ReactNode {
  const [step, setStep] = useState<'kind' | 'asset' | 'entry'>('kind');
  const [kind, setKind] = useState<'lorebook' | 'preset' | null>(null);
  const [assetId, setAssetId] = useState('');
  const [entryKey, setEntryKey] = useState('');

  const lorebooks = props.assets.filter((asset) => asset.kind === 'lorebook' && asset.id !== props.currentAssetId);
  const presets = props.assets.filter((asset) => asset.kind === 'preset' && asset.id !== props.currentAssetId);
  const sourceAssets = kind === 'lorebook' ? lorebooks : kind === 'preset' ? presets : [];
  const selectedAsset = sourceAssets.find((asset) => asset.id === assetId);
  const entries = selectedAsset ? entriesForAsset(selectedAsset) : [];
  const selectedEntry = entries.find((entry) => entry.key === entryKey);
  const kindLabel = kind === 'lorebook' ? '世界书' : kind === 'preset' ? '预设' : '素材';
  const stepIndex = step === 'kind' ? 1 : step === 'asset' ? 2 : 3;
  const stepTitle = step === 'kind' ? '选择来源' : step === 'asset' ? `选择${kindLabel}` : '选择并预览条目';

  const goBack = () => {
    if (step === 'kind') {
      props.onClose();
      return;
    }
    if (step === 'entry') {
      setStep('asset');
      setEntryKey('');
      return;
    }
    setStep('kind');
    setKind(null);
    setAssetId('');
    setEntryKey('');
  };

  const chooseKind = (nextKind: 'lorebook' | 'preset') => {
    setKind(nextKind);
    setAssetId('');
    setEntryKey('');
    setStep('asset');
  };

  const chooseAsset = (asset: Asset) => {
    setAssetId(asset.id);
    setEntryKey('');
    setStep('entry');
  };

  const confirmImport = () => {
    if (!selectedEntry || selectedEntry.disabled) return;
    props.onImport(selectedEntry.data);
    props.onClose();
  };

  return (
    <Modal title="导入条目" onClose={props.onClose} wide>
      <div className="entry-picker-stepbar">
        <Button
          variant="ghost"
          icon={step === 'kind' ? <X size={14} /> : <ArrowLeft size={14} />}
          onClick={goBack}
        >
          {step === 'kind' ? '取消' : '上一步'}
        </Button>
        <span>步骤 {stepIndex} / 3</span>
        <strong>{stepTitle}</strong>
      </div>

      {step === 'kind' && (
        <>
          <div className="entry-picker-kinds">
            <button className="entry-picker-kind" type="button" onClick={() => chooseKind('lorebook')}>
              <BookOpen size={24} />
              <strong>世界书</strong>
              <small>{lorebooks.length} 个素材</small>
            </button>
            <button className="entry-picker-kind" type="button" onClick={() => chooseKind('preset')}>
              <FileText size={24} />
              <strong>预设</strong>
              <small>{presets.length} 个素材</small>
            </button>
          </div>
          {!lorebooks.length && !presets.length && <div className="small-empty">没有可导入的其它世界书或预设素材。</div>}
        </>
      )}

      {step === 'asset' && (
        <div className="link-column">
          <div className="link-column-title">
            {kind === 'lorebook' ? <BookOpen size={15} /> : <FileText size={15} />}
            {kindLabel}素材
            <span>选择一个素材查看其中的条目</span>
          </div>
          {sourceAssets.length ? sourceAssets.map((asset) => (
            <div
              className="link-row entry-picker-asset-row"
              key={asset.id}
              role="button"
              tabIndex={0}
              onClick={() => chooseAsset(asset)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                chooseAsset(asset);
              }}
            >
              <div>
                <strong>{asset.name}</strong>
                <small>{entryCount(asset)} 个条目</small>
              </div>
              <ChevronRight size={16} />
            </div>
          )) : <div className="small-empty">该类素材下没有可导入的来源。</div>}
        </div>
      )}

      {step === 'entry' && (
        <>
          <div className="entry-picker-list">
            <div className="link-column">
              <div className="link-column-title">
                <FileText size={15} />
                条目列表
                <span>{entries.length} 个条目</span>
              </div>
              {entries.length ? entries.map((entry) => (
                <div
                  className={`link-row ${entryKey === entry.key ? 'active' : ''} ${entry.disabled ? 'disabled' : ''}`}
                  key={entry.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={entryKey === entry.key}
                  onClick={() => setEntryKey(entry.key)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setEntryKey(entry.key);
                  }}
                >
                  <div>
                    <strong>{entry.title}</strong>
                    <small>{entry.meta}</small>
                  </div>
                </div>
              )) : <div className="small-empty">该素材没有可导入的条目。</div>}
            </div>
            <div className="entry-picker-preview">
              <span className="eyebrow">ENTRY PREVIEW</span>
              {selectedEntry ? (
                <>
                  <strong>{selectedEntry.title}</strong>
                  <small>{selectedEntry.meta}</small>
                  {selectedEntry.disabled && <span className="entry-picker-disabled-label">此条目不可复用</span>}
                  <pre>{selectedEntry.preview || '（空内容）'}</pre>
                </>
              ) : <div className="small-empty">从左侧选择一个条目查看正文预览。</div>}
            </div>
          </div>
          <footer className="modal-footer">
            <span>{selectedEntry ? selectedEntry.meta : '请选择一个条目'}</span>
            <div className="entry-picker-actions">
              <Button icon={<ArrowLeft size={14} />} onClick={goBack}>上一步</Button>
              <Button
                variant="primary"
                icon={<Check size={15} />}
                disabled={!selectedEntry || selectedEntry.disabled}
                onClick={confirmImport}
              >
                添加到当前条目下
              </Button>
            </div>
          </footer>
        </>
      )}
    </Modal>
  );
}
