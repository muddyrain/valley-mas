import {
  CrownOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Layout as AntLayout, Avatar, Dropdown, Menu, message, theme } from 'antd';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import http from '../utils/request';

const { Header, Sider, Content } = AntLayout;

// 管理员菜单（完整权限）
const adminMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/creators', icon: <CrownOutlined />, label: '创作者管理' },
  { key: '/resources', icon: <PictureOutlined />, label: '资源管理' },
  { key: '/records', icon: <FileTextOutlined />, label: '记录管理' },
];

// 创作者菜单（受限权限）
const creatorMenuItems = [
  { key: '/creator-dashboard', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/resources', icon: <PictureOutlined />, label: '我的资源' },
  { key: '/creators', icon: <CrownOutlined />, label: '我的空间' },
];

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
    // 从 localStorage 获取用户信息
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      try {
        setUserInfo(JSON.parse(storedUserInfo));
      } catch (error) {
        console.error('解析用户信息失败:', error);
      }
    }
  }, []);

  // 根据角色选择菜单
  const menuItems = userInfo.role === 'admin' ? adminMenuItems : creatorMenuItems;

  const handleLogout = async () => {
    try {
      // 调用后端登出接口，清除服务器端的 Cookie
      await http.post('/logout');

      // 清除本地存储的用户信息
      localStorage.removeItem('userInfo');

      message.success('已退出登录');
      navigate('/login');
    } catch (error) {
      console.error('退出登录失败:', error);
      // 即使接口调用失败，也清除本地数据并跳转
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
          <span className="text-xl font-bold text-blue-600">{collapsed ? 'V' : 'Valley'}</span>
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
