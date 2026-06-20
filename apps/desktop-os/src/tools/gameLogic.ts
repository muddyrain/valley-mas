export interface MatchCard {
  id: string;
  pairId: string;
  image: string;
  revealed: boolean;
  matched: boolean;
}

export interface TidyItem {
  id: string;
  label: string;
  category: TidyCategory;
  sorted: boolean;
}

export type TidyCategory = 'focus' | 'tools' | 'fun';

export const MATCH_IMAGES = [
  '/icons/finder.png',
  '/icons/music.png',
  '/icons/notes.png',
  '/icons/safari.png',
  '/icons/calendar.png',
  '/icons/weather.png',
  '/icons/clock.png',
  '/icons/favorites-star.png',
];

export const TIDY_ITEMS: Omit<TidyItem, 'sorted'>[] = [
  { id: 'note', label: '便签', category: 'focus' },
  { id: 'clock', label: '时钟', category: 'focus' },
  { id: 'calc', label: '小算盘', category: 'tools' },
  { id: 'folder', label: '文件夹', category: 'tools' },
  { id: 'music', label: '唱片', category: 'fun' },
  { id: 'card', label: '配对牌', category: 'fun' },
];

export function createMatchDeck() {
  return shuffle(
    MATCH_IMAGES.flatMap((image, index) => [
      createCard(index, image, 1),
      createCard(index, image, 2),
    ]),
  );
}

export function revealMatchCard(cards: MatchCard[], cardId: string) {
  return cards.map((card) =>
    card.id === cardId && !card.matched ? { ...card, revealed: true } : card,
  );
}

export function hideUnmatchedCards(cards: MatchCard[], pairIds: string[]) {
  return cards.map((card) =>
    pairIds.includes(card.pairId) && !card.matched ? { ...card, revealed: false } : card,
  );
}

export function markMatchedCards(cards: MatchCard[], pairId: string) {
  return cards.map((card) => (card.pairId === pairId ? { ...card, matched: true } : card));
}

export function createTidyItems() {
  return shuffle(TIDY_ITEMS.map((item) => ({ ...item, sorted: false })));
}

export function tidyScore(currentScore: number, expected: TidyCategory, actual: TidyCategory) {
  return Math.max(0, currentScore + (expected === actual ? 10 : -3));
}

function createCard(index: number, image: string, copy: number): MatchCard {
  return {
    id: `card-${index}-${copy}`,
    pairId: `pair-${index}`,
    image,
    revealed: false,
    matched: false,
  };
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
