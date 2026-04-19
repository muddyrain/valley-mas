import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Checkbox, Form, Input, InputNumber, message, Select, Space, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  type AdminCreateBookReq,
  type AdminUpdateBookReq,
  adminCreateBook,
  adminGetClassicsList,
  adminUpdateBook,
  type ClassicsBook,
} from '@/api/classics';

const CATEGORY_OPTIONS = ['诗词', '小说', '散文', '史书', '哲学', '戏曲', '文集', '其他'];

export default function ClassicsBooksEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [book, setBook] = useState<ClassicsBook | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    adminGetClassicsList({ keyword: '' })
      .then((res) => {
        const found = res.list?.find((b) => b.id === Number(id));
        if (found) {
          setBook(found);
          form.setFieldsValue({
            title: found.title,
            category: found.category,
            dynasty: found.dynasty,
            brief: found.brief,
            coverUrl: found.coverUrl,
            wordCount: found.wordCount,
            isPublished: found.isPublished,
            authorNames: found.authorNames?.join('、'),
            editionLabel: found.editions?.[0]?.label ?? '',
            translator: found.editions?.[0]?.translator ?? '',
            publishYear: found.editions?.[0]?.publishYear ?? undefined,
          });
        }
      })
      .catch(() => message.error('加载书目信息失败'))
      .finally(() => setLoading(false));
  }, [id, isEdit, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const authorNames = values.authorNames
        ? String(values.authorNames)
            .split(/[,，、]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (isEdit) {
        const payload: AdminUpdateBookReq = {
          title: values.title as string,
          category: values.category as string,
          dynasty: values.dynasty as string | undefined,
          brief: values.brief as string | undefined,
          coverUrl: values.coverUrl as string | undefined,
          wordCount: values.wordCount as number | undefined,
          isPublished: values.isPublished as boolean | undefined,
        };
        await adminUpdateBook(Number(id), payload);
        message.success('保存成功');
        navigate('/classics-books');
      } else {
        const payload: AdminCreateBookReq = {
          title: values.title as string,
          category: values.category as string,
          dynasty: values.dynasty as string | undefined,
          brief: values.brief as string | undefined,
          coverUrl: values.coverUrl as string | undefined,
          wordCount: values.wordCount as number | undefined,
          isPublished: values.isPublished as boolean | undefined,
          authorNames,
          editionLabel: values.editionLabel as string,
          translator: values.translator as string | undefined,
          publishYear: values.publishYear as number | undefined,
        };
        await adminCreateBook(payload);
        message.success('创建成功');
        navigate('/classics-books');
      }
    } catch {
      message.error(isEdit ? '保存失败' : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/classics-books')}>
          返回
        </Button>
        <h1 className="text-xl font-semibold">
          {isEdit ? `编辑书目 — ${book?.title ?? ''}` : '新建书目'}
        </h1>
      </div>

      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ isPublished: false }}
          style={{ maxWidth: 640 }}
        >
          <Form.Item name="title" label="书名" rules={[{ required: true, message: '请输入书名' }]}>
            <Input placeholder="如：红楼梦" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              {CATEGORY_OPTIONS.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="dynasty" label="朝代 / 时代">
            <Input placeholder="如：清代" />
          </Form.Item>

          <Form.Item name="authorNames" label="作者（多位用逗号或顿号分隔）">
            <Input placeholder="如：曹雪芹、高鹗" />
          </Form.Item>

          <Form.Item name="brief" label="简介">
            <Input.TextArea rows={4} placeholder="一段简短介绍" />
          </Form.Item>

          <Form.Item name="coverUrl" label="封面图 URL">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item name="wordCount" label="总字数（约）">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="如：800000" />
          </Form.Item>

          {!isEdit && (
            <>
              <Form.Item
                name="editionLabel"
                label="版本标签"
                rules={[{ required: true, message: '请输入版本标签' }]}
              >
                <Input placeholder="如：人民文学出版社 1982 年版" />
              </Form.Item>

              <Form.Item name="translator" label="译者（古文留空）">
                <Input placeholder="如：杨宪益" />
              </Form.Item>

              <Form.Item name="publishYear" label="出版年份">
                <InputNumber
                  min={1000}
                  max={2100}
                  style={{ width: '100%' }}
                  placeholder="如：1982"
                />
              </Form.Item>
            </>
          )}

          <Form.Item name="isPublished" valuePropName="checked">
            <Checkbox>立即发布（取消则保存为草稿）</Checkbox>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {isEdit ? '保存' : '创建'}
              </Button>
              <Button onClick={() => navigate('/classics-books')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Spin>
    </div>
  );
}
