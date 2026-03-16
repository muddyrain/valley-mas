import { ArrowLeftOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  message,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Category, CreatePostData, Tag as TagType } from '@/api/blog';
import { createPost, getAdminPostDetail, getCategories, getTags, updatePost } from '@/api/blog';

const { Title } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

// 简单的 Markdown 渲染
function renderMarkdown(content: string): string {
  // 基础 Markdown 转换
  const html = content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    .replace(/\n/gim, '<br>');
  return html;
}

export default function BlogPostEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  useEffect(() => {
    loadCategoriesAndTags();
    if (isEdit && id) {
      loadPost(id);
    }
  }, [id]);

  const loadCategoriesAndTags = async () => {
    try {
      const [categoriesRes, tagsRes]: any = await Promise.all([getCategories(), getTags()]);
      setCategories(categoriesRes);
      setTags(tagsRes);
    } catch (error) {
      console.error('Failed to load categories and tags:', error);
      message.error('加载分类和标签失败');
    }
  };

  const loadPost = async (postId: string) => {
    setLoading(true);
    try {
      const res: any = await getAdminPostDetail(postId);
      if (res.code === 0 && res.data) {
        const post = res.data;
        form.setFieldsValue({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          cover: post.cover,
          categoryId: parseInt(post.categoryId as unknown as string),
          status: post.status,
          isTop: post.isTop,
        });
        setContent(post.content);
        setSelectedTags(post.tags?.map((t: TagType) => parseInt(t.id as unknown as string)) || []);
      }
    } catch (error) {
      console.error('Failed to load post:', error);
      message.error('加载文章失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (publish = false) => {
    try {
      const values = await form.validateFields();

      if (!content.trim()) {
        message.error('请输入文章内容');
        return;
      }

      setSaving(true);

      const data: CreatePostData = {
        ...values,
        content,
        tagIds: selectedTags,
        status: publish ? 'published' : values.status,
        publishNow: publish,
      };

      let res: any;
      if (isEdit && id) {
        res = await updatePost(id, data);
      } else {
        res = await createPost(data);
      }

      if (res.code === 0) {
        message.success(isEdit ? '更新成功' : '创建成功');
        navigate('/blog-posts');
      } else {
        message.error(res.message || (isEdit ? '更新失败' : '创建失败'));
      }
    } catch (error) {
      console.error('Failed to save post:', error);
      message.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    const currentSlug = form.getFieldValue('slug');
    if (!currentSlug) {
      form.setFieldValue('slug', generateSlug(title));
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  return (
    <div className="p-6">
      <Card loading={loading}>
        <div className="flex items-center justify-between mb-6">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/blog-posts')}>
              返回
            </Button>
            <Title level={4} className="!mb-0">
              {isEdit ? '编辑文章' : '新建文章'}
            </Title>
          </Space>
          <Space>
            <Button icon={<SaveOutlined />} onClick={() => handleSubmit(false)} loading={saving}>
              保存草稿
            </Button>
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => handleSubmit(true)}
              loading={saving}
            >
              发布文章
            </Button>
          </Space>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 'draft',
            isTop: false,
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧编辑区 */}
            <div className="lg:col-span-2 space-y-4">
              <Form.Item
                label="文章标题"
                name="title"
                rules={[{ required: true, message: '请输入文章标题' }]}
              >
                <Input placeholder="请输入文章标题" onChange={handleTitleChange} />
              </Form.Item>

              <Form.Item
                label="文章别名 (URL)"
                name="slug"
                rules={[{ required: true, message: '请输入文章别名' }]}
              >
                <Input placeholder="article-url-slug" />
              </Form.Item>

              <Form.Item label="文章内容">
                <Tabs defaultActiveKey="edit">
                  <TabPane tab="编辑" key="edit">
                    <TextArea
                      placeholder="使用 Markdown 格式编写文章内容..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={20}
                      className="font-mono"
                    />
                  </TabPane>
                  <TabPane tab="预览" key="preview">
                    <div
                      className="border rounded p-4 min-h-[500px] prose prose-slate max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: content
                          ? renderMarkdown(content)
                          : '<p class="text-gray-400">预览区域</p>',
                      }}
                    />
                  </TabPane>
                </Tabs>
              </Form.Item>
            </div>

            {/* 右侧设置区 */}
            <div className="space-y-4">
              <Card title="发布设置" size="small">
                <Form.Item
                  label="文章分类"
                  name="categoryId"
                  rules={[{ required: true, message: '请选择文章分类' }]}
                >
                  <Select placeholder="选择分类">
                    {categories.map((category) => (
                      <Select.Option
                        key={category.id}
                        value={parseInt(category.id as unknown as string)}
                      >
                        {category.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label="文章状态" name="status">
                  <Select>
                    <Select.Option value="draft">草稿</Select.Option>
                    <Select.Option value="published">已发布</Select.Option>
                    <Select.Option value="archived">已归档</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="isTop" valuePropName="checked">
                  <Checkbox>置顶文章</Checkbox>
                </Form.Item>
              </Card>

              <Card title="文章标签" size="small">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Tag
                      key={tag.id}
                      color={
                        selectedTags.includes(parseInt(tag.id as unknown as string))
                          ? 'blue'
                          : 'default'
                      }
                      className="cursor-pointer"
                      onClick={() => toggleTag(parseInt(tag.id as unknown as string))}
                    >
                      {tag.name}
                    </Tag>
                  ))}
                </div>
              </Card>

              <Card title="封面图" size="small">
                <Form.Item name="cover" className="!mb-0">
                  <Input placeholder="输入封面图 URL" />
                </Form.Item>
              </Card>

              <Card title="文章摘要" size="small">
                <Form.Item name="excerpt" className="!mb-0">
                  <TextArea placeholder="输入文章摘要，用于列表展示..." rows={4} />
                </Form.Item>
              </Card>
            </div>
          </div>
        </Form>
      </Card>
    </div>
  );
}
