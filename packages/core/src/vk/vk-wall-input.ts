/** Normalize user input for VK screen name / URL / numeric id. */
export function normalizeVkWallInput(value: string): string {
  let normalized = value.trim();
  if (!normalized) return '';

  normalized = normalized.replace(/^https?:\/\//i, '');
  normalized = normalized.replace(/^www\./i, '');
  normalized = normalized.replace(/^(m\.)?vk\.(com|ru)\//i, '');
  normalized = normalized.replace(/^@/, '');
  normalized = normalized.replace(/\/+$/, '');

  const queryIndex = normalized.indexOf('?');
  if (queryIndex >= 0) {
    normalized = normalized.slice(0, queryIndex);
  }

  const clubMatch = normalized.match(/^club(\d+)$/i);
  if (clubMatch) return clubMatch[1];

  const publicMatch = normalized.match(/^public(\d+)$/i);
  if (publicMatch) return publicMatch[1];

  return normalized;
}

export function isNumericVkId(value: string): boolean {
  return /^-?\d+$/.test(value);
}
