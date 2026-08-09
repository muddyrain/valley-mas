import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Space } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminListParams, AdminListResponse } from '@/types/api';

interface UseAdminListOptions {
  defaultPageSize?: number;
  searchPlaceholder?: string;
}

export function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

export function parsePositiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function useAdminList<T>(
  loader: (params: AdminListParams) => Promise<AdminListResponse<T>>,
  options: UseAdminListOptions = {},
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(searchParams.get('keyword') ?? '');
  const requestSequenceRef = useRef(0);

  const page = parsePositiveNumber(searchParams.get('page'), 1);
  const defaultPageSize = options.defaultPageSize ?? 20;
  const pageSize = parsePositiveNumber(searchParams.get('pageSize'), defaultPageSize);
  const keyword = searchParams.get('keyword') ?? '';
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const userId = searchParams.get('userId') ?? '';
  const resourceId = searchParams.get('resourceId') ?? '';
  const risk = searchParams.get('risk') ?? '';
  const platform = searchParams.get('platform') ?? '';
  const role = searchParams.get('role') ?? '';

  const updateQuery = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const fetchData = useCallback(async () => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoading(true);
    try {
      const result = await loader({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
        type: type || undefined,
        userId: userId || undefined,
        resourceId: resourceId || undefined,
        risk: risk || undefined,
        platform: platform || undefined,
        role: role || undefined,
      });
      if (requestSequence !== requestSequenceRef.current) return;
      const lastPage = Math.max(1, Math.ceil((result.total || 0) / pageSize));
      const resolvedPage = Math.min(result.page || page, lastPage);
      if (resolvedPage !== page) {
        updateQuery({ page: resolvedPage });
        return;
      }
      setData(result.list || []);
      setTotal(result.total || 0);
    } catch {
      // 请求层已经提供统一错误提示；保留当前数据，避免短暂失败清空列表。
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, [
    keyword,
    loader,
    page,
    pageSize,
    platform,
    resourceId,
    risk,
    role,
    status,
    type,
    updateQuery,
    userId,
  ]);

  useEffect(() => {
    setKeywordDraft(keyword);
  }, [keyword]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    updateQuery({
      page: pagination.current || 1,
      pageSize: pagination.pageSize || defaultPageSize,
    });
  };

  const searchTools = (
    <Space wrap>
      <Input
        className="w-72"
        allowClear
        prefix={<SearchOutlined />}
        placeholder={options.searchPlaceholder ?? '搜索关键词'}
        value={keywordDraft}
        onChange={(event) => setKeywordDraft(event.target.value)}
        onPressEnter={() => updateQuery({ keyword: keywordDraft.trim() || undefined, page: 1 })}
      />
      <Button
        type="primary"
        icon={<SearchOutlined />}
        onClick={() => updateQuery({ keyword: keywordDraft.trim() || undefined, page: 1 })}
      >
        搜索
      </Button>
      <Button icon={<ReloadOutlined />} onClick={() => void fetchData()}>
        刷新
      </Button>
    </Space>
  );

  return {
    data,
    setData,
    total,
    loading,
    page,
    pageSize,
    status,
    type,
    userId,
    resourceId,
    risk,
    platform,
    role,
    updateQuery,
    fetchData,
    handleTableChange,
    searchTools,
  };
}
