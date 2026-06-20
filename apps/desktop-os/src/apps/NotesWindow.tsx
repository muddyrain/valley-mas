import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotesStore } from '../store/notesStore';
import { useWindowStore } from '../store/windowStore';
import EmptyState from '../ui/EmptyState';
import { getDefaultWindowOptions } from './desktopApps';
import './NotesWindow.css';

const EMPTY_DRAFT = {
  title: '',
  content: '',
};

export default function NotesWindow() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const notes = useNotesStore((s) => s.notes);
  const selectedId = useNotesStore((s) => s.selectedId);
  const loading = useNotesStore((s) => s.loading);
  const saving = useNotesStore((s) => s.saving);
  const error = useNotesStore((s) => s.error);
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const selectNote = useNotesStore((s) => s.selectNote);
  const createNote = useNotesStore((s) => s.createNote);
  const updateNote = useNotesStore((s) => s.updateNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const clearNotes = useNotesStore((s) => s.clearNotes);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const isNewDraft = selectedId === null;

  useEffect(() => {
    if (!isAuthenticated || !token) {
      clearNotes();
      return;
    }
    void loadNotes(token);
  }, [clearNotes, isAuthenticated, loadNotes, token]);

  useEffect(() => {
    if (!selectedNote) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    setDraft({
      title: selectedNote.title,
      content: selectedNote.content,
    });
  }, [selectedNote]);

  function openAccount() {
    restoreOrFocus('account', getDefaultWindowOptions('account'));
  }

  function newNote() {
    selectNote(null);
    setDraft(EMPTY_DRAFT);
  }

  async function saveNote() {
    if (!token) {
      openAccount();
      return;
    }
    const input = {
      title: draft.title,
      content: draft.content,
    };
    if (selectedNote) {
      await updateNote(token, selectedNote.id, input);
      return;
    }
    await createNote(token, input);
  }

  async function removeNote() {
    if (!token || !selectedNote) return;
    await deleteNote(token, selectedNote.id);
  }

  if (!isAuthenticated) {
    return (
      <div className="notes-window notes-window--center">
        <EmptyState icon="✎" title="登录后使用便签" description="便签会同步到你的账号。" />
        <button type="button" className="notes-window__primary" onClick={openAccount}>
          登录账户
        </button>
      </div>
    );
  }

  return (
    <div className="notes-window">
      <aside className="notes-window__sidebar" aria-label="便签列表">
        <div className="notes-window__sidebar-head">
          <strong>便签</strong>
          <button type="button" onClick={newNote} disabled={saving}>
            新建
          </button>
        </div>
        <div className="notes-window__list">
          {loading ? (
            <div className="notes-window__loading">同步中</div>
          ) : notes.length === 0 && !isNewDraft ? (
            <EmptyState
              className="notes-window__empty"
              icon="✎"
              title="暂无便签"
              description="新建一条便签开始记录。"
            />
          ) : (
            notes.map((note) => (
              <button
                type="button"
                className={`notes-window__note ${note.id === selectedId ? 'is-active' : ''}`}
                key={note.id}
                onClick={() => selectNote(note.id)}
              >
                <span>{note.title}</span>
                <small>{note.content || '空白便签'}</small>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="notes-window__editor">
        <div className="notes-window__toolbar">
          <span>{selectedNote ? '编辑便签' : '新建便签'}</span>
          <div className="notes-window__actions">
            {selectedNote ? (
              <button type="button" onClick={removeNote} disabled={saving}>
                删除
              </button>
            ) : null}
            <button
              type="button"
              className="notes-window__primary"
              onClick={saveNote}
              disabled={saving}
            >
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        </div>
        {error ? <div className="notes-window__error">{error}</div> : null}
        <input
          className="notes-window__title"
          value={draft.title}
          onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
          placeholder="标题"
        />
        <textarea
          className="notes-window__content"
          value={draft.content}
          onChange={(e) => setDraft((current) => ({ ...current, content: e.target.value }))}
          placeholder="写点什么"
        />
      </main>
    </div>
  );
}
