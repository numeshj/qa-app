import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, Table, Tag } from 'antd';

interface AuditLog { id: number; entityType: string; entityId: number; action: string; beforeJson?: any; afterJson?: any; createdAt: string; userId?: number | null; }

const AuditPage = () => {
  const { data, isLoading } = useQuery<{ success: boolean; data: AuditLog[] }>({ queryKey: ['audit'], queryFn: async () => (await api.get('/audit')).data });
  const cols = [
    { title: 'Time', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: 'Entity', dataIndex: 'entityType' },
    { title: 'Entity ID', dataIndex: 'entityId' },
    { title: 'Action', dataIndex: 'action', render: (v: string) => <Tag color='blue'>{v}</Tag> },
    { title: 'Before', dataIndex: 'beforeJson', render: (v: any) => v ? <pre style={{ margin: 0 }}>{JSON.stringify(v)}</pre> : '' },
    { title: 'After', dataIndex: 'afterJson', render: (v: any) => v ? <pre style={{ margin: 0 }}>{JSON.stringify(v)}</pre> : '' }
  ];
  return <Card title='Audit Log'>
    <Table size='small' rowKey='id' loading={isLoading} dataSource={data?.data || []} columns={cols as any} pagination={false} />
  </Card>;
};

export default AuditPage;
