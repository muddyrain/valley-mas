import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { type Group, getAdminPostSortItems, type PostSortItem, sortAdminPosts } from '@/api/blog';
import PostGroupDropdown from '@/components/blog/PostGroupDropdown';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface BlogSortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  onSorted?: () => void | Promise<void>;
}

type SortableRowProps = {
  index: number;
  item: PostSortItem;
};

function SortableRow({ index, item }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-sort-item-id={item.id}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
        'border-slate-200 bg-white text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
        'touch-none select-none hover:border-theme-shell-border hover:bg-theme-soft/35',
        isDragging &&
          'z-10 border-theme-primary bg-theme-soft shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.18)]',
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-soft text-xs font-semibold text-theme-primary">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
      <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function DragRowPreview({
  index,
  title,
  width,
}: {
  index: number;
  title: string;
  width?: number | null;
}) {
  return (
    <div
      className="inline-flex max-w-[min(56rem,calc(100vw-3rem))] items-center gap-3 rounded-2xl border border-theme-primary bg-white px-4 py-3 text-left text-slate-800 shadow-[0_24px_56px_rgba(var(--theme-primary-rgb),0.24)]"
      style={width ? { width } : undefined}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-soft text-xs font-semibold text-theme-primary">
        {index}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
      <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
    </div>
  );
}

export function BlogSortDialog({ open, onOpenChange, groups, onSorted }: BlogSortDialogProps) {
  const [groupId, setGroupId] = useState('');
  const [items, setItems] = useState<PostSortItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((item) => item.id === groupId) ?? null,
    [groupId, groups],
  );
  const activeItem = useMemo(
    () => (activeId ? (items.find((item) => item.id === activeId) ?? null) : null),
    [activeId, items],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 160,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadItems = useCallback(async () => {
    if (!open || !groupId) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminPostSortItems({
        postType: 'blog',
        scope: 'group',
        groupId,
      });
      setItems(data || []);
    } catch {
      toast.error('加载分组排序列表失败');
    } finally {
      setLoading(false);
    }
  }, [groupId, open]);

  useEffect(() => {
    if (!open) {
      setActiveId(null);
      setActiveWidth(null);
      return;
    }
    if (!groupId && groups.length > 0) {
      setGroupId(groups[0].id);
    }
  }, [groupId, groups, open]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [loadItems, open]);

  const handleSave = async () => {
    if (!groupId) {
      toast.error('请先选择一个分组');
      return;
    }
    if (items.length === 0) {
      toast.error('这个分组下还没有可排序的博客');
      return;
    }

    try {
      setSaving(true);
      await sortAdminPosts({
        postType: 'blog',
        scope: 'group',
        groupId,
        orderedIds: items.map((item) => item.id),
      });
      toast.success('分组排序已保存');
      await onSorted?.();
      onOpenChange(false);
    } catch {
      toast.error('保存排序失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveWidth(null);

    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && saving) return;
    if (!nextOpen) {
      setActiveId(null);
      setActiveWidth(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(var(--theme-primary-rgb),0.12),rgba(var(--theme-primary-rgb),0.04))] px-6 py-5">
          <DialogTitle className="text-left text-lg font-bold text-slate-900">
            设置博客排序
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-slate-500">
            不分组内容默认按创建时间倒序展示，这里只调整指定分组内的顺序。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-theme-soft-strong bg-theme-soft/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">选择要排序的博客分组</p>
                <p className="mt-1 text-sm text-slate-500">
                  已切到标准拖拽排序，直接按住标题拖动即可连续调整位置。
                </p>
              </div>
              <PostGroupDropdown
                groups={groups}
                value={groupId}
                onChange={setGroupId}
                placeholder="选择博客分组"
                disabled={groups.length === 0 || loading || saving}
                triggerClassName="h-11 max-w-[min(20rem,100%)] px-4"
                contentClassName="w-[min(22rem,calc(100vw-2rem))]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-theme-panel-border bg-white/86 p-3">
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载分组排序列表...
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
                {selectedGroup ? '这个分组下还没有博客。' : '先选择一个分组。'}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={(event) => {
                  const nextActiveId = String(event.active.id);
                  setActiveId(nextActiveId);
                  const rowEl = document.querySelector<HTMLElement>(
                    `[data-sort-item-id="${nextActiveId}"]`,
                  );
                  setActiveWidth(rowEl?.getBoundingClientRect().width ?? null);
                }}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                  setActiveId(null);
                  setActiveWidth(null);
                }}
              >
                <SortableContext
                  items={items.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                    {items.map((item, index) => (
                      <SortableRow key={item.id} item={item} index={index} />
                    ))}
                  </div>
                </SortableContext>

                {typeof document !== 'undefined'
                  ? createPortal(
                      <DragOverlay>
                        {activeItem ? (
                          <DragRowPreview
                            index={items.findIndex((item) => item.id === activeItem.id) + 1}
                            title={activeItem.title}
                            width={activeWidth}
                          />
                        ) : null}
                      </DragOverlay>,
                      document.body,
                    )
                  : null}
              </DndContext>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || loading || items.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存排序
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BlogSortDialog;
