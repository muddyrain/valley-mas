/**
 * TOS（火山引擎对象存储）URL 工具函数
 *
 * 背景：TOS 默认对非图片 MIME 类型的文件返回
 *   Content-Disposition: attachment
 * 导致浏览器直接下载而非在新标签展示。
 *
 * 解决方案：在 URL 上附加 TOS 图片处理参数后，
 * TOS 会将响应头改为 Content-Type: image/webp + Content-Disposition: inline，
 * 浏览器即可直接展示图片。
 */

const TOS_INLINE_PROCESS = 'image/format,webp';

/**
 * 判断 URL 是否来自 TOS（火山引擎对象存储）
 */
function isTosUrl(url: string): boolean {
  return url.includes('volces.com') || url.includes('volccdn.com');
}

/**
 * 将 TOS URL 转为可在浏览器新标签页内联预览的 URL。
 * 附加 `?x-tos-process=image/format,webp` 参数，
 * TOS 会把响应头 Content-Disposition 改为 inline。
 *
 * 非 TOS URL 原样返回。
 * 若 URL 已包含 x-tos-process 参数也原样返回（避免重复叠加）。
 */
export function toInlineUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (!isTosUrl(url)) return url;
  if (url.includes('x-tos-process')) return url;

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}x-tos-process=${TOS_INLINE_PROCESS}`;
}
