import {
  AuditOutlined,
  BookOutlined,
  CrownOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FormOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Layout as AntLayout, Avatar, Dropdown, Menu, message, theme } from 'antd';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import http from '../utils/request';

const { Header, Sider, Content } = AntLayout;

const adminMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/creators', icon: <CrownOutlined />, label: '创作者管理' },
  { key: '/creator-applications', icon: <AuditOutlined />, label: '创作者申请审核' },
  { key: '/resources', icon: <PictureOutlined />, label: '资源管理' },
  { key: '/records', icon: <FileTextOutlined />, label: '记录管理' },
  { key: '/blog-posts', icon: <BookOutlined />, label: '博客管理' },
];

const creatorMenuItems = [
  { key: '/creator-dashboard', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/resources', icon: <PictureOutlined />, label: '我的资源' },
  { key: '/creators', icon: <CrownOutlined />, label: '我的空间' },
];

const userMenuItems = [{ key: '/apply-creator', icon: <FormOutlined />, label: '申请成为创作者' }];

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

  const menuItems =
    userInfo.role === 'admin'
      ? adminMenuItems
      : userInfo.role === 'creator'
        ? creatorMenuItems
        : userMenuItems;

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
    <AntLayout className="h-screen">
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
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
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="border-r-0"
        />
      </Sider>
      <AntLayout>
        <Header
          className="px-4 flex items-center justify-between"
          style={{ background: token.colorBgContainer }}
        >
          <div className="cursor-pointer text-lg" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          <Dropdown menu={userMenu} placement="bottomRight">
            <div className="flex items-center cursor-pointer">
              <Avatar src={userInfo.avatar} icon={<UserOutlined />} />
              <span className="ml-2">
                {userInfo.nickname || userInfo.username || '用户'}
                {userInfo.role === 'creator' && (
                  <span className="ml-2 text-xs text-blue-500">[创作者]</span>
                )}
              </span>
            </div>
          </Dropdown>
        </Header>

        <Content
          className="m-4 p-6 overflow-auto"
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
