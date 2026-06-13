const pantryTagSeparators = /[,\s，、]+/;
const maxPantryTags = 8;
const maxPantryTagLength = 16;

export function normalizePantryTags(tags: Iterable<string> = []) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = tag.trim().slice(0, maxPantryTagLength);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
    if (normalized.length >= maxPantryTags) {
      break;
    }
  }

  return normalized;
}

export function parsePantryTagText(text: string) {
  return normalizePantryTags(text.split(pantryTagSeparators));
}

export function formatPantryTagText(tags: Iterable<string> = []) {
  return normalizePantryTags(tags).join('、');
}
