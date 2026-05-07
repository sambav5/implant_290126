export function normalizeMentionLabel(label = '') {
  return String(label).replace(/^@+/, '').trim();
}

export function buildMentionables(caseData) {
  const roleSet = new Set(['everyone', 'clinician', 'implantologist', 'prosthodontist', 'assistant']);
  const people = [];

  const teamEntries = [
    { id: 'clinician', name: caseData?.clinician?.name, role: 'clinician' },
    { id: 'implantologist', name: caseData?.implantologist?.name, role: 'implantologist' },
    { id: 'prosthodontist', name: caseData?.prosthodontist?.name, role: 'prosthodontist' },
    { id: 'assistant', name: caseData?.assistant?.name, role: 'assistant' },
    ...(caseData?.teamList || []),
  ];

  for (const user of teamEntries) {
    if (!user?.name) continue;
    people.push({ id: user.id || normalizeMentionLabel(user.name).toLowerCase(), label: user.name, type: 'user', role: user.role || null });
    if (user.role) roleSet.add(normalizeMentionLabel(user.role).toLowerCase());
  }

  const dedupedPeople = Array.from(new Map(people.map((p) => [p.label.toLowerCase(), p])).values());
  const roles = Array.from(roleSet).map((role) => ({ id: role, label: role, type: 'role' }));
  return { people: dedupedPeople, roles };
}

export function extractMentionsFromText(text = '', mentionables = { people: [], roles: [] }) {
  const all = [...(mentionables.people || []), ...(mentionables.roles || [])];
  const byLabel = new Map(all.map((m) => [normalizeMentionLabel(m.label).toLowerCase(), m]));
  const regex = /@([^\n@]+)/g;
  const mentions = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const token = normalizeMentionLabel(match[1]).split(/\s{2,}|[,.!?;:]/)[0].trim();
    const found = byLabel.get(token.toLowerCase());
    if (found) mentions.push({ id: found.id, label: normalizeMentionLabel(found.label), type: found.type });
  }
  return Array.from(new Map(mentions.map((m) => [`${m.type}:${m.id}`, m])).values());
}

export function toLegacyMentionArray(mentions = []) {
  return mentions.map((m) => normalizeMentionLabel(m.label || m.id));
}
