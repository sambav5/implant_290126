export const ROLE_MENTION_OPTIONS = [
  { id: 'assistant', label: 'assistant', type: 'role' },
  { id: 'clinician', label: 'clinician', type: 'role' },
  { id: 'implantologist', label: 'implantologist', type: 'role' },
  { id: 'prosthodontist', label: 'prosthodontist', type: 'role' },
];

export const normalizeMentionLabel = (label = '') => label.replace(/^@+/, '').trim();

export const tokenizeMentions = (text = '', mentions = []) => {
  if (!text) return [];
  const normalizedMentions = mentions
    .map((mention) => ({ ...mention, label: normalizeMentionLabel(mention.label) }))
    .filter((mention) => mention.label);

  if (!normalizedMentions.length) return [{ type: 'text', value: text }];

  const sorted = [...normalizedMentions].sort((a, b) => b.label.length - a.label.length);
  const tokens = [];
  let cursor = 0;

  while (cursor < text.length) {
    let matched = null;

    for (const mention of sorted) {
      const probe = `@${mention.label}`;
      if (text.slice(cursor, cursor + probe.length).toLowerCase() === probe.toLowerCase()) {
        matched = mention;
        break;
      }
    }

    if (!matched) {
      const nextMentionIdx = sorted
        .map((mention) => text.toLowerCase().indexOf(`@${mention.label.toLowerCase()}`, cursor + 1))
        .filter((idx) => idx >= 0)
        .sort((a, b) => a - b)[0];

      const end = nextMentionIdx ?? text.length;
      tokens.push({ type: 'text', value: text.slice(cursor, end) });
      cursor = end;
      continue;
    }

    tokens.push({ type: 'mention', mention: matched, value: `@${matched.label}` });
    cursor += matched.label.length + 1;
  }

  return tokens;
};

export const buildMessagePayload = (text = '', mentionOptions = []) => {
  const loweredText = text.toLowerCase();
  const mentions = mentionOptions
    .filter((option) => loweredText.includes(`@${option.label.toLowerCase()}`))
    .map((option) => ({ id: option.id, label: normalizeMentionLabel(option.label), type: option.type }));

  return {
    text,
    mentions,
  };
};

export const filterMentionOptions = (options = [], query = '') => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter((option) => option.label.toLowerCase().includes(normalized));
};
