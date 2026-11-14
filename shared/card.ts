export type CardData = Record<string, unknown>;

export function cardData(raw: CardData): CardData {
  return raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? raw.data as CardData
    : raw;
}

export function updateCardData(raw: CardData, key: string, value: unknown): CardData {
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
    return { ...raw, data: { ...cardData(raw), [key]: value } };
  }
  return { ...raw, [key]: value };
}

export function characterName(raw: CardData): string {
  return String(cardData(raw).name ?? '未命名角色');
}

export function toV2Card(raw: CardData): CardData {
  const data = { ...cardData(raw) };
  const output: CardData = { ...raw, spec: 'chara_card_v2', spec_version: '2.0', data };
  const legacyKeys = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'];
  for (const key of legacyKeys) delete output[key];
  return output;
}
