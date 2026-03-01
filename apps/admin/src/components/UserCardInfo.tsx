import { UserOutlined } from '@ant-design/icons';
import { Avatar, Tag } from 'antd';
import type { FC } from 'react';
import type { ResourceUser } from '@/api/resource';

export const UserCardInfo: FC<{
  user: ResourceUser;
}> = ({ user }) => {
  return (
    <div className="flex items-center gap-2">
      {user.avatar ? (
        <Avatar src={user.avatar} icon={<UserOutlined />} />
      ) : (
        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
          {user.nickname?.[0] || user.username?.[0] || '?'}
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-sm">{user.nickname || user.username}</span>
        <Tag className="text-xs" color={user.role === 'admin' ? 'red' : 'blue'}>
          {user.role === 'admin' ? '管理员' : user.role === 'creator' ? '创作者' : '用户'}
        </Tag>
      </div>
    </div>
  );
};
