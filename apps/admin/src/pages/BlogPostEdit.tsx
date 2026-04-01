import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate, useParams } from 'react-router-dom';
import type { Category, CreatePostData, PostType, Tag as TagType, Visibility } from '@/api/blog';
import { createPost, getAdminPostDetail, getCategories, getTags, updatePost } from '@/api/blog';

const { Title, Text } = Typography;
const { TextArea } = Input;

type EditorFormValues = {
  title: string;
  postType: PostType;
  visibility: Visibility;
  templateKey?: string;
  templateData?: string;
  excerpt?: string;
  cover?: string;
  categoryId: string;
  status: 'draft' | 'published' | 'archived';
  isTop: boolean;
  tagIds?: string[];
};

type LocalUserInfo = {
  id?: string | number;
  username?: string;
  nickname?: string;
};

type Snapshot = {
  title: string;
  postType: PostType;
  visibility: Visibility;
  templateKey: string;
  templateData: string;
  excerpt: string;
  cover: string;
  categoryId: string;
  status: 'draft' | 'published' | 'archived';
  isTop: boolean;
  tagIds: string[];
  content: string;
};

const defaultValues: EditorFormValues = {
  title: '',
  postType: 'blog',
  visibility: 'private',
  templateKey: '',
  templateData: '',
  excerpt: '',
  cover: '',
  categoryId: '',
  status: 'draft',
  isTop: false,
  tagIds: [],
};

const IMAGE_TEXT_TEMPLATES = [
  {
    value: 'basic_quote',
    label: '基础文案卡',
    placeholder:
      '{\n  "title": "今日金句",\n  "content": "保持热爱，奔赴山海",\n  "imageUrl": "https://..."\n}',
  },
  {
    value: 'mood_poster',
    label: '情绪海报',
    placeholder:
      '{\n  "title": "周末心情",\n  "subtitle": "慢一点也没关系",\n  "content": "把今天过成想要的样子",\n  "imageUrl": "https://..."\n}',
  },
  {
    value: 'note_style',
    label: '便签风',
    placeholder:
      '{\n  "title": "备忘",\n  "content": "1. 先完成核心功能\\n2. 再优化细节",\n  "imageUrl": "https://..."\n}',
  },
];

function makeSnapshot(values: Partial<EditorFormValues>, content: string): Snapshot {
  return {
    title: values.title || '',
    postType: values.postType || 'blog',
    visibility: values.visibility || 'private',
    templateKey: values.templateKey || '',
    templateData: values.templateData || '',
    excerpt: values.excerpt || '',
    cover: values.cover || '',
    categoryId: values.categoryId || '',
    status: values.status || 'draft',
    isTop: Boolean(values.isTop),
    tagIds: [...(values.tagIds || [])].sort(),
    content: content || '',
  };
}

function countReadableChars(markdown: string) {
  return markdown.replace(/\s/g, '').length;
}

export default function BlogPostEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [form] = Form.useForm<EditorFormValues>();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [content, setContent] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState<Snapshot>(makeSnapshot(defaultValues, ''));
  const bypassNavigationGuardRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<LocalUserInfo | null>(null);

  const watchedValues = Form.useWatch([], form);
  const postType = watchedValues?.postType || 'blog';

  useEffect(() => {
    void loadCategoriesAndTags();
  }, []);

  useEffect(() => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) return;
      const parsed = JSON.parse(userInfo) as LocalUserInfo;
      setCurrentUser(parsed);
    } catch (error) {
      console.error('Failed to parse user info:', error);
    }
  }, []);

  useEffect(() => {
    if (!isEdit || !id) {
      form.setFieldsValue(defaultValues);
      setContent('');
      setInitialSnapshot(makeSnapshot(defaultValues, ''));
      return;
    }

    void loadPost(id);
  }, [id, isEdit, form]);

  const currentSnapshot = useMemo(
    () => makeSnapshot(watchedValues || defaultValues, content),
    [watchedValues, content],
  );

  const isDirty = useMemo(
    () => JSON.stringify(currentSnapshot) !== JSON.stringify(initialSnapshot),
    [currentSnapshot, initialSnapshot],
  );

  useBeforeUnload((event) => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  const confirmLeave = () => window.confirm('当前有未保存内容，确认离开吗？');

  const guardedNavigate = (to: string) => {
    if (!bypassNavigationGuardRef.current && isDirty && !confirmLeave()) return;
    bypassNavigationGuardRef.current = true;
    navigate(to);
  };

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty || bypassNavigationGuardRef.current) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      if (anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const toUrl = new URL(anchor.href, window.location.href);
      const fromUrl = new URL(window.location.href);
      const isSamePage =
        toUrl.pathname === fromUrl.pathname &&
        toUrl.search === fromUrl.search &&
        toUrl.hash === fromUrl.hash;

      if (isSamePage) return;

      const ok = confirmLeave();
      if (!ok) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      bypassNavigationGuardRef.current = true;
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [isDirty]);

  const charCount = useMemo(() => countReadableChars(content), [content]);
  const readingMinutes = useMemo(() => Math.max(1, Math.ceil(charCount / 500)), [charCount]);

  const loadCategoriesAndTags = async () => {
    try {
      const [categoriesData, tagsData] = await Promise.all([getCategories(), getTags()]);
      setCategories(categoriesData || []);
      setTags(tagsData || []);
    } catch (error) {
      console.error('Failed to load categories and tags:', error);
      message.error('加载分类和标签失败');
    }
  };

  const loadPost = async (postId: string) => {
    setLoading(true);
    try {
      const post = await getAdminPostDetail(postId);
      const values: EditorFormValues = {
        title: post.title,
        postType: post.postType || 'blog',
        visibility: post.visibility || 'private',
        templateKey: post.templateKey || '',
        templateData: post.templateData || '',
        excerpt: post.excerpt || '',
        cover: post.cover || '',
        categoryId: post.categoryId,
        status: post.status,
        isTop: post.isTop,
        tagIds: post.tags?.map((t) => t.id) || [],
      };

      form.setFieldsValue(values);
      const markdown = post.content || '';
      setContent(markdown);
      setInitialSnapshot(makeSnapshot(values, markdown));
    } catch (error) {
      console.error('Failed to load post:', error);
      message.error('加载文章失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplatePreset = () => {
    const key = form.getFieldValue('templateKey');
    const target = IMAGE_TEXT_TEMPLATES.find((item) => item.value === key);
    if (!target) return;
    form.setFieldValue('templateData', target.placeholder);
  };

  const handleSubmit = async (publishNow = false) => {
    try {
      const values = await form.validateFields();

      if (values.postType === 'blog' && !content.trim()) {
        message.error('请输入 Markdown 内容');
        return;
      }

      if (values.postType === 'image_text' && values.templateData?.trim()) {
        try {
          JSON.parse(values.templateData);
        } catch {
          message.error('图文模板数据必须是合法 JSON');
          return;
        }
      }

      setSaving(true);

      const payload: CreatePostData = {
        ...values,
        content: content || '',
        tagIds: values.tagIds || [],
        status: publishNow ? 'published' : values.status,
        publishNow,
      };

      if (isEdit && id) {
        await updatePost(id, payload);
        message.success('更新成功');
      } else {
        await createPost(payload);
        message.success('创建成功');
      }

      setInitialSnapshot(makeSnapshot(values, content));
      bypassNavigationGuardRef.current = true;
      navigate('/blog-posts');
    } catch (error) {
      console.error('Failed to save post:', error);
      message.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="bg-[radial-gradient(circle_at_top_right,rgba(24,144,255,0.08),transparent_35%),radial-gradient(circle_at_10%_10%,rgba(19,194,194,0.08),transparent_30%)] p-6"
      data-color-mode="light"
    >
      <Card
        loading={loading}
        className="rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[320px]">
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => guardedNavigate('/blog-posts')}>
                返回列表
              </Button>
              {isDirty && <Tag color="processing">未保存</Tag>}
              {watchedValues?.isTop && <Tag color="gold">置顶</Tag>}
              {postType === 'image_text' && <Tag color="magenta">图文</Tag>}
            </Space>

            <Title level={3} className="!mb-1 !mt-3">
              {isEdit ? '编辑内容' : '新建内容'}
            </Title>
            <Text type="secondary">支持博客和图文两种创作方式。</Text>
          </div>

          <Space className="items-start">
            <Button
              icon={<SaveOutlined />}
              onClick={() => handleSubmit(false)}
              loading={saving}
              disabled={saving}
            >
              保存草稿
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSubmit(true)}
              loading={saving}
              disabled={saving}
            >
              直接发布
            </Button>
          </Space>
        </div>

        <div className="mb-6 flex items-center overflow-x-auto rounded-xl border border-slate-200 bg-sky-50 px-4 py-3">
          <div className="flex min-w-[100px] flex-col">
            <Text className="text-xs text-slate-500">字数</Text>
            <Text className="text-lg font-semibold text-slate-900">{charCount}</Text>
          </div>
          <Divider type="vertical" className="mx-3 h-7" />
          <div className="flex min-w-[100px] flex-col">
            <Text className="text-xs text-slate-500">预计阅读</Text>
            <Text className="text-lg font-semibold text-slate-900">{readingMinutes} 分钟</Text>
          </div>
          <Divider type="vertical" className="mx-3 h-7" />
          <div className="flex min-w-[100px] flex-col">
            <Text className="text-xs text-slate-500">标签</Text>
            <Text className="text-lg font-semibold text-slate-900">
              {(watchedValues?.tagIds || []).length}
            </Text>
          </div>
        </div>

        <Alert
          className="mb-6"
          type="info"
          showIcon
          message={`当前作者：${currentUser?.nickname || currentUser?.username || '当前登录用户'}`}
          description="仅创作者/管理员可进行创作，创作者默认只可管理自己的内容。"
        />

        <Form form={form} layout="vertical" initialValues={defaultValues}>
          <Row gutter={24} align="top">
            <Col xs={24} lg={16}>
              <Card className="rounded-xl border border-slate-200" title="正文内容">
                <Form.Item
                  label="标题"
                  name="title"
                  rules={[{ required: true, message: '请输入标题' }]}
                >
                  <Input placeholder="输入标题（建议 10-40 字）" maxLength={120} showCount />
                </Form.Item>

                <Form.Item label="内容类型" name="postType" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { label: '博客（Markdown）', value: 'blog' },
                      { label: '图文（模板）', value: 'image_text' },
                    ]}
                  />
                </Form.Item>

                {postType === 'image_text' && (
                  <>
                    <Form.Item
                      label="图文模板"
                      name="templateKey"
                      rules={[{ required: true, message: '请选择图文模板' }]}
                    >
                      <Select
                        placeholder="选择模板"
                        options={IMAGE_TEXT_TEMPLATES.map((item) => ({
                          label: item.label,
                          value: item.value,
                        }))}
                        onChange={handleTemplatePreset}
                      />
                    </Form.Item>

                    <Form.Item
                      label="模板数据（JSON）"
                      name="templateData"
                      rules={[{ required: true, message: '请输入模板数据 JSON' }]}
                    >
                      <TextArea rows={10} placeholder={IMAGE_TEXT_TEMPLATES[0].placeholder} />
                    </Form.Item>
                  </>
                )}

                <Form.Item
                  label={
                    postType === 'blog'
                      ? 'Markdown 内容'
                      : '图文正文（可选，留空自动由模板数据生成）'
                  }
                  required={postType === 'blog'}
                >
                  <MDEditor
                    value={content}
                    onChange={(value) => setContent(value || '')}
                    height={740}
                    preview="live"
                    visibleDragbar={false}
                    textareaProps={{
                      placeholder:
                        postType === 'blog'
                          ? '在这里编写 Markdown，支持代码块、链接和图片 URL。'
                          : '可选：覆盖模板自动生成的正文。',
                    }}
                  />
                </Form.Item>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <div className="grid gap-4 lg:sticky lg:top-4">
                <Card className="rounded-xl border border-slate-200" title="发布设置">
                  <Form.Item
                    label="分类"
                    name="categoryId"
                    rules={[{ required: true, message: '请选择分类' }]}
                  >
                    <Select
                      placeholder="选择分类"
                      options={categories.map((category) => ({
                        label: category.name,
                        value: category.id,
                      }))}
                    />
                  </Form.Item>

                  <Form.Item name="isTop" valuePropName="checked" className="!mb-2">
                    <Checkbox>置顶内容</Checkbox>
                  </Form.Item>

                  <Form.Item label="可见范围" name="visibility">
                    <Select
                      options={[
                        { label: '私密', value: 'private' },
                        { label: '共享', value: 'shared' },
                        { label: '公开', value: 'public' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="status" hidden>
                    <Input />
                  </Form.Item>

                  <Alert
                    type="info"
                    showIcon
                    message="状态由按钮控制"
                    description="点击“保存草稿”保留草稿，点击“直接发布”立即发布。"
                  />
                </Card>

                <Card className="rounded-xl border border-slate-200" title="可选信息">
                  <Form.Item label="标签" name="tagIds">
                    <Select
                      mode="multiple"
                      allowClear
                      maxTagCount="responsive"
                      placeholder="选择标签（可选）"
                      options={tags.map((tag) => ({ label: tag.name, value: tag.id }))}
                    />
                  </Form.Item>

                  <Form.Item label="摘要" name="excerpt">
                    <TextArea
                      placeholder="列表页展示的简短摘要（可选）"
                      rows={4}
                      maxLength={240}
                      showCount
                    />
                  </Form.Item>

                  <Form.Item
                    label={
                      <Space size={6}>
                        <span>封面图 URL</span>
                        <Tooltip title="支持图片链接，图文模板也可在 templateData 里带 imageUrl。">
                          <Text type="secondary">说明</Text>
                        </Tooltip>
                      </Space>
                    }
                    name="cover"
                    className="!mb-2"
                  >
                    <Input placeholder="https://example.com/cover.jpg" />
                  </Form.Item>

                  <Alert type="info" showIcon message="这些字段不会阻塞发布，可后续补充。" />
                </Card>
              </div>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
}
