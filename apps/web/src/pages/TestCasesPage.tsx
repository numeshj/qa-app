import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Upload, message } from 'antd';
import { useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';

interface TestCase { id: number; testCaseIdCode: string; description?: string | null; severity?: string | null; complexity?: string | null; projectId: number; }
interface Project { id: number; code: string; name: string; }

const useProjects = () => useQuery<{ success: boolean; data: Project[] }>({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data });
const useLookup = (category: string) => useQuery<{ success: boolean; data: any[] }>({ queryKey: ['lookup', category], queryFn: async () => (await api.get(`/lookups/${category}`)).data });

const TestCasesPage = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ success: boolean; data: TestCase[] }>({ queryKey: ['test-cases'], queryFn: async () => (await api.get('/test-cases')).data });
  const projects = useProjects();
  const severity = useLookup('testcase_severity');
  const complexity = useLookup('testcase_complexity');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | null>(null);
  const [form] = Form.useForm();

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, projectId: Number(values.projectId) };
      if (editing) return (await api.put(`/test-cases/${editing.id}`, payload)).data;
      return (await api.post('/test-cases', payload)).data;
    },
    onSuccess: () => { message.success('Saved'); setOpen(false); setEditing(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['test-cases'] }); },
    onError: (e: any) => message.error(e.response?.data?.error?.message || 'Failed')
  });

  const columns = [
    { title: 'Code', dataIndex: 'testCaseIdCode' },
    { title: 'Severity', dataIndex: 'severity' },
    { title: 'Complexity', dataIndex: 'complexity' },
    { title: 'Project', dataIndex: 'projectId', render: (v: number) => projects.data?.data.find(p => p.id === v)?.code },
    { title: 'Actions', render: (_: any, r: TestCase) => <Space><Button size='small' onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>Edit</Button></Space> }
  ];

  // File upload (artifacts) minimal: open upload modal per row in future (placeholder)
  // For simplicity left out artifact UI for now.

  return <Card title='Test Cases' extra={<Button type='primary' onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>New</Button>}>
    <Table size='small' rowKey='id' loading={isLoading} dataSource={data?.data || []} columns={columns as any} pagination={false} />
    <Modal open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} title={editing ? 'Edit Test Case' : 'New Test Case'} destroyOnClose>
      <Form form={form} layout='vertical' onFinish={(v) => saveMutation.mutate(v)} initialValues={{ testCaseIdCode: '' }}>
        <Form.Item name='projectId' label='Project' rules={[{ required: true }]}>
          <Select options={(projects.data?.data || []).map(p => ({ value: p.id, label: p.code }))} loading={projects.isLoading} showSearch optionFilterProp='label' />
        </Form.Item>
        <Form.Item name='testCaseIdCode' label='Code' rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name='description' label='Description'><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name='severity' label='Severity'>
          <Select options={(severity.data?.data || []).map(l => ({ value: l.code, label: l.code }))} loading={severity.isLoading} allowClear />
        </Form.Item>
        <Form.Item name='complexity' label='Complexity'>
          <Select options={(complexity.data?.data || []).map(l => ({ value: l.code, label: l.code }))} loading={complexity.isLoading} allowClear />
        </Form.Item>
      </Form>
    </Modal>
  </Card>;
};

export default TestCasesPage;
