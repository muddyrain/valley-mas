export type FormatFileSizeOptions = {
  zeroLabel?: string;
  decimals?: number;
};

export function formatFileSize(bytes?: number | null, options: FormatFileSizeOptions = {}): string {
  const { zeroLabel = '0 B', decimals = 1 } = options;
  if (!bytes || bytes <= 0) return zeroLabel;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(decimals)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(decimals)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(decimals)} GB`;
}

export type FormatResourceTypeOptions = {
  wallpaperLabel?: string;
  avatarLabel?: string;
  fallbackLabel?: string;
};

export function formatResourceType(type?: string, options: FormatResourceTypeOptions = {}): string {
  const { wallpaperLabel = '壁纸', avatarLabel = '头像', fallbackLabel = type || '资源' } = options;
  if (type === 'wallpaper') return wallpaperLabel;
  if (type === 'avatar') return avatarLabel;
  return fallbackLabel;
}

export function formatDateTimeZh(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', options);
}
