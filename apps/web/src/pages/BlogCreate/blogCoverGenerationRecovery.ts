const BLOG_COVER_GENERATION_RECOVERY_PREFIX = 'valley.blog-cover-generation.v1';

type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BlogCoverGenerationRecovery = {
  generationId: string;
  createdAt: number;
};

const getRecoveryKey = (userId: string, articleId: string) =>
  `${BLOG_COVER_GENERATION_RECOVERY_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(articleId)}`;

export function writeBlogCoverGenerationRecovery(
  storage: RecoveryStorage,
  userId: string,
  articleId: string,
  recovery: BlogCoverGenerationRecovery,
) {
  if (!userId || !articleId || !recovery.generationId || !Number.isFinite(recovery.createdAt)) {
    return;
  }
  try {
    storage.setItem(getRecoveryKey(userId, articleId), JSON.stringify(recovery));
  } catch {
    // Generation must continue even when browser storage is disabled or full.
  }
}

export function readBlogCoverGenerationRecovery(
  storage: RecoveryStorage,
  userId: string,
  articleId: string,
  _now = Date.now(),
): BlogCoverGenerationRecovery | null {
  const key = getRecoveryKey(userId, articleId);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const recovery = JSON.parse(raw) as Partial<BlogCoverGenerationRecovery>;
    const isValid =
      typeof recovery.generationId === 'string' &&
      recovery.generationId.length > 0 &&
      typeof recovery.createdAt === 'number' &&
      Number.isFinite(recovery.createdAt) &&
      recovery.createdAt > 0;
    if (isValid) {
      return recovery as BlogCoverGenerationRecovery;
    }
  } catch {
    // Invalid browser state should never block opening the editor.
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore unavailable browser storage.
  }
  return null;
}

export function clearBlogCoverGenerationRecovery(
  storage: RecoveryStorage,
  userId: string,
  articleId: string,
) {
  try {
    storage.removeItem(getRecoveryKey(userId, articleId));
  } catch {
    // Ignore unavailable browser storage.
  }
}
