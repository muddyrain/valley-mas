export interface DataSourceConfig {
  api: string;
  labelField: string;
  valueField: string;
}

export const DATA_SOURCES: Record<string, DataSourceConfig & { label: string }> = {
  'blog/categories': {
    label: '博客分类',
    api: '/public/blog/categories',
    labelField: 'name',
    valueField: 'id',
  },
  'blog/tags': {
    label: '博客标签',
    api: '/public/blog/tags',
    labelField: 'name',
    valueField: 'id',
  },
  'blog/groups': {
    label: '博客分组',
    api: '/public/blog/groups',
    labelField: 'name',
    valueField: 'id',
  },
};
