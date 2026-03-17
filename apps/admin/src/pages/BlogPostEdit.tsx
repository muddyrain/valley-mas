import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate, useParams } from 'react-router-dom';
import type { Category, CreatePostData, Tag as TagType } from '@/api/blog';
import { createPost, getAdminPostDetail, getCategories, getTags, updatePost } from '@/api/blog';

const { Title } = Typography;
const { TextArea } = Input;

type EditorFormValues = {
  title: string;
  excerpt?: string;
  cover?: string;
  categoryId: string;
  status: 'draft' | 'published' | 'archived';
  isTop: boolean;
  tagIds?: string[];
};

type Snapshot = {
  title: string;
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
  excerpt: '',
  cover: '',
  categoryId: '',
  status: 'draft',
  isTop: false,
  tagIds: [],
};

function makeSnapshot(values: Partial<EditorFormValues>, content: string): Snapshot {
  return {
    title: values.title || '',
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

  const watchedValues = Form.useWatch([], form);

  useEffect(() => {
    void loadCategoriesAndTags();
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

  const handleSubmit = async (publishNow = false) => {
    try {
      const values = await form.validateFields();
      if (!content.trim()) {
        message.error('请输入 Markdown 内容');
        return;
      }

      setSaving(true);

      const payload: CreatePostData = {
        ...values,
        content,
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
    <div className="p-6" data-color-mode="light">
      <Card loading={loading}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => guardedNavigate('/blog-posts')}>
              返回
            </Button>
            <Title level={4} className="!mb-0">
              {isEdit ? '编辑文章' : '新建文章'}
            </Title>
            {isDirty && <Tag color="processing">未保存</Tag>}
          </Space>

          <Space>
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
              发布文章
            </Button>
          </Space>
        </div>

        <Row gutter={16} className="mb-4">
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic title="字符数" value={charCount} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic title="预计阅读" value={readingMinutes} suffix="分钟" />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic title="已选标签" value={(watchedValues?.tagIds || []).length} />
            </Card>
          </Col>
        </Row>

        <Form form={form} layout="vertical" initialValues={defaultValues}>
          <Row gutter={24}>
            <Col xs={24} lg={16}>
              <Card size="small" className="!mb-4" title="内容编辑">
                <Form.Item
                  label="文章标题"
                  name="title"
                  rules={[{ required: true, message: '请输入标题' }]}
                >
                  <Input placeholder="输入文章标题" maxLength={120} showCount />
                </Form.Item>

                <Form.Item label="Markdown 内容" required>
                  <MDEditor
                    value={content}
                    onChange={(value) => setContent(value || '')}
                    height={680}
                    preview="live"
                    visibleDragbar={false}
                    textareaProps={{
                      placeholder: '在这里编写 Markdown，支持代码块、链接和图片 URL。',
                    }}
                  />
                </Form.Item>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Space direction="vertical" className="w-full" size={16}>
                <Card size="small" title="发布设置">
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

                  <Form.Item
                    label="状态"
                    name="status"
                    rules={[{ required: true, message: '请选择状态' }]}
                  >
                    <Select
                      options={[
                        { label: '草稿', value: 'draft' },
                        { label: '已发布', value: 'published' },
                        { label: '已归档', value: 'archived' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="isTop" valuePropName="checked" className="!mb-0">
                    <Checkbox>置顶文章</Checkbox>
                  </Form.Item>
                </Card>

                <Card size="small" title="标签与摘要">
                  <Form.Item label="标签" name="tagIds">
                    <Select
                      mode="multiple"
                      allowClear
                      maxTagCount="responsive"
                      placeholder="选择标签"
                      options={tags.map((tag) => ({ label: tag.name, value: tag.id }))}
                    />
                  </Form.Item>

                  <Form.Item label="摘要" name="excerpt" className="!mb-0">
                    <TextArea
                      placeholder="列表页展示的简短摘要"
                      rows={4}
                      maxLength={240}
                      showCount
                    />
                  </Form.Item>
                </Card>

                <Card size="small" title="封面图">
                  <Form.Item name="cover" className="!mb-2">
                    <Input placeholder="输入图片 URL" />
                  </Form.Item>
                  <Alert
                    type="info"
                    showIcon
                    message="v1 仅支持图片 URL"
                    description="后续 v2 可升级为编辑器内直传。"
                  />
                </Card>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
}
