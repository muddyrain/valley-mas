import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Space } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminListParams, AdminListResponse } from '@/types/api';

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
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(searchParams.get('keyword') ?? '');

  const page = parsePositiveNumber(searchParams.get('page'), 1);
  const pageSize = parsePositiveNumber(searchParams.get('pageSize'), 20);
  const keyword = searchParams.get('keyword') ?? '';
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const userId = searchParams.get('userId') ?? '';
  const creatorId = searchParams.get('creatorId') ?? '';
  const resourceId = searchParams.get('resourceId') ?? '';
  const risk = searchParams.get('risk') ?? '';

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
    setLoading(true);
    try {
      const result = await loader({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
        type: type || undefined,
        userId: userId || undefined,
        creatorId: creatorId || undefined,
        resourceId: resourceId || undefined,
        risk: risk || undefined,
      });
      setData(result.list || []);
      setTotal(result.total || 0);
    } finally {
      setLoading(false);
    }
  }, [creatorId, keyword, loader, page, pageSize, resourceId, risk, status, type, userId]);

  useEffect(() => {
    setKeywordDraft(keyword);
  }, [keyword]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    updateQuery({
      page: pagination.current || 1,
      pageSize: pagination.pageSize || 20,
    });
  };

  const searchTools = (
    <Space wrap>
      <Input
        className="w-72"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索关键词"
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
    creatorId,
    resourceId,
    risk,
    updateQuery,
    fetchData,
    handleTableChange,
    searchTools,
  };
}
