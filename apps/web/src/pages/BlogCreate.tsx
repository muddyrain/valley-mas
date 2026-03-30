import { ArrowLeft, Eye, PenSquare, Plus, Save, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createGroup, createPost, type Group, getAdminGroups } from '@/api/blog';
import { MarkdownPreview } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/useAuthStore';

export default function BlogCreate() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [cover, setCover] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [previewMode, setPreviewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const loadGroups = async () => {
    try {
      const list = await getAdminGroups();
      setGroups(list || []);
      if (!groupId && list?.[0]?.id) {
        setGroupId(list[0].id);
      }
    } catch {
      toast.error('加载分组失败');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator' && user?.role !== 'admin') {
      toast.error('当前账号不是创作者，无法发布博客');
      navigate('/');
      return;
    }

    void loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate, user?.role]);

  const handleSubmit = async (status: 'draft' | 'published') => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle) {
      toast.error('请输入标题');
      return;
    }
    if (!trimmedContent) {
      toast.error('请输入正文内容');
      return;
    }

    try {
      setSubmitting(true);
      await createPost({
        title: trimmedTitle,
        postType: 'blog',
        content: trimmedContent,
        excerpt: excerpt.trim() || trimmedContent.slice(0, 120),
        cover: cover.trim() || undefined,
        groupId: groupId || undefined,
        status,
        publishNow: status === 'published',
      });
      toast.success(status === 'published' ? '博客发布成功' : '草稿保存成功');
      navigate('/blog');
    } catch {
      toast.error(status === 'published' ? '发布失败，请稍后重试' : '保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    try {
      setCreatingGroup(true);
      const created = await createGroup({
        name,
        description: newGroupDesc.trim() || undefined,
      });
      toast.success('分组创建成功');
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      await loadGroups();
      setGroupId(created.id);
    } catch {
      toast.error('分组创建失败，请稍后重试');
    } finally {
      setCreatingGroup(false);
    }
  };

  const wordCount = useMemo(() => content.replace(/\s+/g, '').length, [content]);
  const previewMarkdown = useMemo(() => {
    return `# ${title.trim() || '未命名标题'}\n\n${content.trim() || '开始输入正文内容吧。'}`;
  }, [title, content]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(145deg,#f7f6ff_0%,#f2f7ff_45%,#f9fafb_100%)] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
            <h1 className="text-xl font-semibold text-slate-900">博客创作</h1>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs text-violet-700">
              现代编辑模式
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-lg border border-slate-200 bg-white p-1 md:inline-flex">
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  previewMode === 'editor'
                    ? 'bg-violet-50 text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setPreviewMode('editor')}
              >
                <PenSquare className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  previewMode === 'split'
                    ? 'bg-violet-50 text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setPreviewMode('split')}
              >
                分屏
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  previewMode === 'preview'
                    ? 'bg-violet-50 text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setPreviewMode('preview')}
              >
                <Eye className="h-3.5 w-3.5" />
                预览
              </button>
            </div>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => void handleSubmit('draft')}
              className="rounded-xl"
            >
              <Save className="mr-2 h-4 w-4" />
              保存草稿
            </Button>
            <Button
              disabled={submitting}
              onClick={() => void handleSubmit('published')}
              className="rounded-xl"
            >
              <Send className="mr-2 h-4 w-4" />
              发布博客
            </Button>
          </div>
        </div>

        <div
          className={
            previewMode === 'split' ? 'grid gap-5 lg:grid-cols-[1.2fr_0.8fr]' : 'grid gap-5'
          }
        >
          {previewMode !== 'preview' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-slate-500">写作区</div>
                <div className="text-xs text-slate-400">字数：{wordCount}</div>
              </div>

              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入标题，抓住重点"
                maxLength={200}
                className="mb-3 h-12 rounded-xl border-slate-300 text-base"
              />

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在这里直接写 Markdown 原文（不做工具栏干预）。"
                className="min-h-[620px] w-full rounded-xl border border-slate-300 bg-[#fcfcff] p-4 font-mono text-[15px] leading-8 outline-none focus:ring-2 focus:ring-violet-200"
              />
            </section>
          )}

          {(previewMode === 'split' || previewMode === 'preview') && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  发布设置
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs text-slate-500">摘要（可选）</div>
                    <Input
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      placeholder="留空则自动截取正文"
                      maxLength={500}
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-slate-500">封面 URL（可选）</div>
                    <Input
                      value={cover}
                      onChange={(e) => setCover(e.target.value)}
                      placeholder="https://..."
                      maxLength={500}
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>文章分组</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                          onClick={() => navigate('/my-space/blog-groups')}
                        >
                          管理分组
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700"
                          onClick={() => setShowCreateGroup((v) => !v)}
                        >
                          <Plus className="h-3 w-3" />
                          新建分组
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                      <button
                        type="button"
                        onClick={() => setGroupId('')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          !groupId
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        未分组
                      </button>
                      {groups.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setGroupId(item.id)}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            groupId === item.id
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>

                    {showCreateGroup && (
                      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                        <Input
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="分组名称，例如：前端思考"
                          className="mb-2 rounded-lg bg-white"
                        />
                        <Input
                          value={newGroupDesc}
                          onChange={(e) => setNewGroupDesc(e.target.value)}
                          placeholder="分组描述（可选）"
                          className="mb-2 rounded-lg bg-white"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => setShowCreateGroup(false)}
                            disabled={creatingGroup}
                          >
                            取消
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-lg"
                            onClick={() => void handleCreateGroup()}
                            disabled={creatingGroup}
                          >
                            创建
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="mb-2 text-sm font-medium text-slate-800">实时预览</div>
                <div
                  className={`overflow-auto rounded-xl border border-slate-200 bg-[#fdfdff] p-4 ${
                    previewMode === 'preview' ? 'max-h-[760px]' : 'max-h-[520px]'
                  }`}
                >
                  <MarkdownPreview markdown={previewMarkdown} />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
