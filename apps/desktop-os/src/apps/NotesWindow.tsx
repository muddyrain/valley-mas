export default function NotesWindow() {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--plush-text)' }}>
      <p style={{ marginBottom: 8 }}>欢迎使用毛毡便签 ✦</p>
      <p style={{ color: 'var(--plush-text-soft)' }}>
        这里是 MVP 占位内容。后续会接入 IndexedDB 持久化、撕便签动画和多便签管理。
      </p>
    </div>
  );
}
