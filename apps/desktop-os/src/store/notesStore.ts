import { create } from 'zustand';
import {
  createNoteInboxItem,
  DESKTOP_NOTE_TAG,
  deleteNoteInboxItem,
  type LifeTraceInboxItem,
  listNoteInboxItems,
  type NoteInput,
  updateNoteInboxItem,
} from '../api/inbox';

export interface DesktopNote {
  id: string;
  title: string;
  content: string;
  updatedAt?: string;
  createdAt?: string;
}

interface NotesStore {
  notes: DesktopNote[];
  selectedId: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  loadNotes: (token: string | null) => Promise<void>;
  selectNote: (id: string | null) => void;
  createNote: (token: string, input: NoteInput) => Promise<DesktopNote | null>;
  updateNote: (token: string, id: string, input: NoteInput) => Promise<DesktopNote | null>;
  deleteNote: (token: string, id: string) => Promise<void>;
  clearNotes: () => void;
  clearError: () => void;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  selectedId: null,
  loading: false,
  saving: false,
  error: null,

  loadNotes: async (token) => {
    if (!token) {
      set({ notes: [], selectedId: null, loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const data = await listNoteInboxItems(token);
      const notes = data.list.filter(isDesktopNote).map(inboxToNote);
      const currentId = get().selectedId;
      set({
        notes,
        selectedId: notes.some((note) => note.id === currentId)
          ? currentId
          : (notes[0]?.id ?? null),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '同步失败',
      });
    }
  },

  selectNote: (id) => set({ selectedId: id, error: null }),

  createNote: async (token, input) => {
    set({ saving: true, error: null });
    try {
      const item = await createNoteInboxItem(token, input);
      const note = inboxToNote(item);
      set((state) => ({
        notes: [note, ...state.notes],
        selectedId: note.id,
        saving: false,
      }));
      return note;
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : '保存失败',
      });
      return null;
    }
  },

  updateNote: async (token, id, input) => {
    set({ saving: true, error: null });
    try {
      const item = await updateNoteInboxItem(token, id, input);
      const note = inboxToNote(item);
      set((state) => ({
        notes: state.notes.map((current) => (current.id === id ? note : current)),
        selectedId: note.id,
        saving: false,
      }));
      return note;
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : '保存失败',
      });
      return null;
    }
  },

  deleteNote: async (token, id) => {
    set({ saving: true, error: null });
    try {
      await deleteNoteInboxItem(token, id);
      set((state) => {
        const notes = state.notes.filter((note) => note.id !== id);
        return {
          notes,
          selectedId: state.selectedId === id ? (notes[0]?.id ?? null) : state.selectedId,
          saving: false,
        };
      });
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : '删除失败',
      });
    }
  },

  clearNotes: () =>
    set({ notes: [], selectedId: null, loading: false, saving: false, error: null }),
  clearError: () => set({ error: null }),
}));

function isDesktopNote(item: LifeTraceInboxItem) {
  return (
    item.itemType === 'text' && item.status === 'inbox' && item.tags.includes(DESKTOP_NOTE_TAG)
  );
}

function inboxToNote(item: LifeTraceInboxItem): DesktopNote {
  return {
    id: item.id,
    title: item.title,
    content: item.content ?? '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
