import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { useState } from 'react';

interface Project {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status: 'ongoing' | 'completed' | 'yet_to_start' | 'other' | string;
  createdAt: string;
}

const projectStatusOptions = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'yet_to_start', label: 'Yet to Start' },
  { value: 'other', label: 'Other' }
];

const statusLabelMap = projectStatusOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const ProjectsPage = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ success: boolean; data: Project[] }>({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form] = Form.useForm();

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        return (await api.put(`/projects/${editing.id}`, values)).data;
      }
      return (await api.post('/projects', values)).data;
    },
  onSuccess: () => { message.success('Saved'); setOpen(false); setEditing(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['projects'] }); },
    onError: (e: any) => message.error(e.response?.data?.error?.message || 'Failed')
  });

  const columns = [
    { title: 'Code', dataIndex: 'code' },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Description', dataIndex: 'description' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: Project['status']) => (
        <Tag color={value === 'completed' ? 'green' : value === 'yet_to_start' ? 'blue' : value === 'other' ? 'default' : 'gold'}>
          {statusLabelMap[value] ?? value}
        </Tag>
      )
    },
  { title: 'Actions', render: (_: any, r: Project) => <Space><Button size="small" onClick={() => { setEditing(r); form.setFieldsValue({ ...r, status: r.status ?? 'ongoing' }); setOpen(true); }}>Edit</Button></Space> }
  ];

  return <Card title="Projects" extra={<Button type="primary" onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'ongoing' }); setOpen(true); }}>New</Button>}>
    <Table size="small" rowKey="id" loading={isLoading} dataSource={data?.data || []} columns={columns as any} pagination={false} />
  <Modal open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} title={editing ? 'Edit Project' : 'New Project'} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} initialValues={{ code: '', name: '', status: 'ongoing' }}>
        <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Status is required' }]}>
          <Select options={projectStatusOptions} placeholder="Select status" allowClear={false} />
        </Form.Item>
      </Form>
    </Modal>
  </Card>;
};

export default ProjectsPage;
