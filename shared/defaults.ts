import type { Asset, AssetKind } from './types';

export const kindNames: Record<AssetKind, string> = {
  character: '角色卡',
  lorebook: '世界书',
  regex: '正则',
  preset: 'Chat 预设',
  document: '其它',
};

export function createDefaultData(kind: AssetKind): Record<string, unknown> {
  if (kind === 'character') {
    return {
      spec: 'chara_card_v2', spec_version: '2.0',
      data: {
        name: '未命名角色', description: '', personality: '', scenario: '',
        first_mes: '', mes_example: '', creator_notes: '', system_prompt: '',
        post_history_instructions: '', alternate_greetings: [], tags: [],
        creator: '', character_version: '1.0', extensions: {},
      },
    };
  }
  if (kind === 'lorebook') return { entries: {} };
  if (kind === 'document') return { format: 'txt', text: '' };
  if (kind === 'regex') {
    return {
      id: crypto.randomUUID(), scriptName: '新建正则', findRegex: '', replaceString: '',
      trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: false,
      promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null,
    };
  }
  return {
    temp_openai: 1, freq_pen_openai: 0, pres_pen_openai: 0, top_p_openai: 1,
    openai_max_context: 8192, openai_max_tokens: 800, stream_openai: false,
    prompts: [
      { identifier: 'main', name: 'Main Prompt', role: 'system', system_prompt: true, content: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}." },
      { identifier: 'nsfw', name: 'Auxiliary Prompt', role: 'system', system_prompt: true, content: '' },
      { identifier: 'worldInfoBefore', name: 'World Info (before)', marker: true, system_prompt: true },
      { identifier: 'personaDescription', name: 'Persona Description', marker: true, system_prompt: true },
      { identifier: 'charDescription', name: 'Char Description', marker: true, system_prompt: true },
      { identifier: 'charPersonality', name: 'Char Personality', marker: true, system_prompt: true },
      { identifier: 'scenario', name: 'Scenario', marker: true, system_prompt: true },
      { identifier: 'enhanceDefinitions', name: 'Enhance Definitions', role: 'system', system_prompt: true, content: 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet definitions absolute.' },
      { identifier: 'worldInfoAfter', name: 'World Info (after)', marker: true, system_prompt: true },
      { identifier: 'dialogueExamples', name: 'Chat Examples', marker: true, system_prompt: true },
      { identifier: 'chatHistory', name: 'Chat History', marker: true, system_prompt: true },
      { identifier: 'jailbreak', name: 'Post-History Instructions', role: 'system', system_prompt: true, content: '' },
    ],
    prompt_order: [
      { identifier: 'main', enabled: true }, { identifier: 'worldInfoBefore', enabled: true },
      { identifier: 'personaDescription', enabled: true }, { identifier: 'charDescription', enabled: true }, { identifier: 'charPersonality', enabled: true },
      { identifier: 'scenario', enabled: true }, { identifier: 'dialogueExamples', enabled: true },
      { identifier: 'enhanceDefinitions', enabled: false }, { identifier: 'worldInfoAfter', enabled: true },
      { identifier: 'chatHistory', enabled: true }, { identifier: 'jailbreak', enabled: true },
    ],
    new_chat_prompt: '[Start a new chat]', new_example_chat_prompt: '[Start a new example chat]',
    continue_nudge_prompt: 'Continue your last message.', wi_format: '{0}',
    scenario_format: '{{scenario}}', personality_format: '{{personality}}', extensions: {},
  };
}

export function createEmptyAsset(kind: AssetKind): Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion'> {
  return {
    kind, name: kind === 'character' ? '未命名角色' : kind === 'document' ? '新建文档' : `新建${kindNames[kind]}`,
    summary: '', tags: [], favorite: false, data: createDefaultData(kind), relations: [], groupIds: [],
  };
}
