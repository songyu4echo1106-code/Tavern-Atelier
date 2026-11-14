export interface PromptOrderState {
  identifier: string;
  enabled?: boolean;
}

export function flattenPromptOrder(value: unknown): PromptOrderState[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (Array.isArray(record.order)) return flattenPromptOrder(record.order);
    return typeof record.identifier === 'string' ? [{ identifier: record.identifier, enabled: record.enabled !== false }] : [];
  });
}

export function mergePromptOrder(original: unknown, next: PromptOrderState[]): PromptOrderState[] | Record<string, unknown>[] {
  if (!Array.isArray(original) || !original.some((item) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).order))) return next;
  const nextById = new Map(next.map((item) => [item.identifier, item]));
  const originalIds = new Set(flattenPromptOrder(original).map((item) => item.identifier));
  const additions = next.filter((item) => !originalIds.has(item.identifier));
  const rebuild = (value: unknown[]): Record<string, unknown>[] => {
    const leaves = value.filter((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).identifier === 'string');
    const positions = new Map(next.map((item, index) => [item.identifier, index]));
    leaves.sort((a, b) => {
      const aId = String((a as Record<string, unknown>).identifier);
      const bId = String((b as Record<string, unknown>).identifier);
      return (positions.get(aId) ?? 0) - (positions.get(bId) ?? 0);
    });
    let leafIndex = 0;
    const result: Record<string, unknown>[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      if (Array.isArray(record.order)) {
        const order = rebuild(record.order);
        if (order.length) result.push({ ...record, order });
        continue;
      }
      leafIndex += 1;
      const leaf = leaves[leafIndex - 1] as Record<string, unknown> | undefined;
      if (!leaf) continue;
      const id = String(leaf.identifier);
      const state = nextById.get(id);
      if (state) result.push({ ...leaf, ...state });
    }
    return result;
  };
  const result = rebuild(original);
  if (additions.length) {
    const firstGroup = result.find((item) => Array.isArray(item.order));
    if (firstGroup) firstGroup.order = [...firstGroup.order as unknown[], ...additions];
    else result.push(...additions.map((item) => ({ ...item })));
  }
  return result;
}
