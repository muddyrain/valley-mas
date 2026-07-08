import {
  BookOutlined,
  CrownOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HeartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  NotificationOutlined,
  PictureOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Layout as AntLayout, Avatar, Dropdown, Menu, message, theme } from 'antd';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import http from '../utils/request';

const { Header, Sider, Content } = AntLayout;

const adminMenuItems = [
  {
    key: 'overview',
    type: 'group' as const,
    label: '系统概览',
    children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '数据概览' },
      { key: '/users', icon: <UserOutlined />, label: '用户管理' },
    ],
  },
  {
    key: 'life-trace',
    type: 'group' as const,
    label: 'Life Trace',
    children: [
      { key: '/life-trace', icon: <DatabaseOutlined />, label: 'Life Trace 管理' },
      { key: '/life-trace/households', icon: <DatabaseOutlined />, label: '家庭空间' },
      { key: '/life-trace/push-subscriptions', icon: <NotificationOutlined />, label: '推送订阅' },
      { key: '/life-trace/push-deliveries', icon: <NotificationOutlined />, label: '推送投递' },
      { key: '/life-trace/ai-conversations', icon: <MessageOutlined />, label: 'AI 对话' },
      { key: '/life-trace/holiday-calendars', icon: <DatabaseOutlined />, label: '节假日缓存' },
      { key: '/feedbacks', icon: <MessageOutlined />, label: '问题反馈' },
    ],
  },
  {
    key: 'content',
    type: 'group' as const,
    label: '内容管理',
    children: [
      { key: '/resources', icon: <PictureOutlined />, label: '资源管理' },
      { key: '/resource-tags', icon: <TagsOutlined />, label: '资源标签统计' },
    ],
  },
  {
    key: 'content-ops',
    type: 'group' as const,
    label: '内容运营',
    children: [
      { key: '/blog-posts', icon: <BookOutlined />, label: '博客管理' },
      { key: '/blog-groups', icon: <BookOutlined />, label: '博客分组' },
      { key: '/blog-categories', icon: <TagsOutlined />, label: '博客分类' },
      { key: '/blog-tags', icon: <TagsOutlined />, label: '博客标签' },
      { key: '/blog-comments', icon: <MessageOutlined />, label: '评论管理' },
      { key: '/guestbook', icon: <MessageOutlined />, label: '访客留言' },
    ],
  },
  {
    key: 'user-ops',
    type: 'group' as const,
    label: '用户互动',
    children: [
      { key: '/notifications', icon: <NotificationOutlined />, label: '通知管理' },
      { key: '/relations/favorites', icon: <HeartOutlined />, label: '收藏关系' },
      { key: '/relations/follows', icon: <CrownOutlined />, label: '关注关系' },
    ],
  },
  {
    key: 'ai-experiments',
    type: 'group' as const,
    label: 'AI 与实验',
    children: [
      { key: '/ai/usage-logs', icon: <ExperimentOutlined />, label: 'AI 调用审计' },
      { key: '/mind-arena/debates', icon: <ExperimentOutlined />, label: 'Mind Arena 辩论' },
    ],
  },
  {
    key: 'audit',
    type: 'group' as const,
    label: '记录与审计',
    children: [
      { key: '/records', icon: <FileTextOutlined />, label: '下载记录' },
      { key: '/audit/operation-logs', icon: <FileTextOutlined />, label: '操作日志' },
      { key: '/audit/code-access-logs', icon: <FileTextOutlined />, label: '口令访问日志' },
      { key: '/audit/storage-assets', icon: <DatabaseOutlined />, label: '存储资产' },
    ],
  },
];

const resolveSelectedMenuKey = (pathname: string) => {
  if (pathname.startsWith('/blog-posts')) return '/blog-posts';
  if (pathname.startsWith('/relations/favorites')) return '/relations/favorites';
  if (pathname.startsWith('/relations/follows')) return '/relations/follows';
  if (pathname.startsWith('/audit/operation-logs')) return '/audit/operation-logs';
  if (pathname.startsWith('/audit/code-access-logs')) return '/audit/code-access-logs';
  if (pathname.startsWith('/audit/storage-assets')) return '/audit/storage-assets';
  if (pathname.startsWith('/life-trace/households')) return '/life-trace/households';
  if (pathname.startsWith('/life-trace/push-subscriptions'))
    return '/life-trace/push-subscriptions';
  if (pathname.startsWith('/life-trace/push-deliveries')) return '/life-trace/push-deliveries';
  if (pathname.startsWith('/life-trace/ai-conversations')) return '/life-trace/ai-conversations';
  if (pathname.startsWith('/life-trace/holiday-calendars')) return '/life-trace/holiday-calendars';
  if (pathname.startsWith('/ai/usage-logs')) return '/ai/usage-logs';
  if (pathname.startsWith('/mind-arena/debates')) return '/mind-arena/debates';
  if (pathname.startsWith('/life-trace')) return '/life-trace';
  return pathname;
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    nickname?: string;
    username?: string;
    avatar?: string;
    role?: string;
  }>({});

  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      try {
        setUserInfo(JSON.parse(storedUserInfo));
      } catch (error) {
        console.error('解析用户信息失败:', error);
      }
    }
  }, []);

  const menuItems = adminMenuItems;

  const handleLogout = async () => {
    try {
      await http.post('/logout');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('userInfo');
      message.success('已退出登录');
      navigate('/login');
    } catch (error) {
      console.error('退出登录失败:', error);
      localStorage.removeItem('admin_token');
      localStorage.removeItem('userInfo');
      navigate('/login');
    }
  };

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  return (
    <AntLayout className="admin-shell h-screen overflow-hidden">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        className="admin-sider h-screen overflow-hidden"
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-100">
          <BrandLogo
            showWordmark={!collapsed}
            className="justify-center"
            iconClassName={collapsed ? 'h-8' : 'h-9'}
            wordmarkClassName="text-[1.02rem]"
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[resolveSelectedMenuKey(location.pathname)]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden border-r-0"
        />
      </Sider>
      <AntLayout className="admin-main flex h-screen min-h-0 flex-col overflow-hidden">
        <Header
          className="shrink-0 px-4 flex items-center justify-between"
          style={{ background: token.colorBgContainer }}
        >
          <div className="cursor-pointer text-lg" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          <Dropdown menu={userMenu} placement="bottomRight">
            <div className="flex items-center cursor-pointer">
              <Avatar src={userInfo.avatar} icon={<UserOutlined />} />
              <span className="ml-2">{userInfo.nickname || userInfo.username || '用户'}</span>
            </div>
          </Dropdown>
        </Header>

        <Content
          className="m-4 min-h-0 flex-1 overflow-auto p-6"
          style={{
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
