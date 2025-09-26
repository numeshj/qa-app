import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Upload, message, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface Defect { id: number; defectIdCode: string; title: string; severity?: string | null; priority?: string | null; status?: string | null; projectId: number; }
interface Project { id: number; code: string; name: string; }

const useProjects = () => useQuery<{ success: boolean; data: Project[] }>({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data });
const useLookup = (category: string) => useQuery<{ success: boolean; data: any[] }>({ queryKey: ['lookup', category], queryFn: async () => (await api.get(`/lookups/${category}`)).data });

const DefectsPage = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ success: boolean; data: Defect[] }>({ queryKey: ['defects'], queryFn: async () => (await api.get('/defects')).data });
  const projects = useProjects();
  const severity = useLookup('defect_severity');
  const priority = useLookup('priority');
  const status = useLookup('defect_status');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Defect | null>(null);
  const [form] = Form.useForm();
  const [artifactModal, setArtifactModal] = useState<{open: boolean; defect: Defect | null}>({ open: false, defect: null });
  const [fileList, setFileList] = useState<any[]>([]);

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, projectId: Number(values.projectId) };
      if (editing) return (await api.put(`/defects/${editing.id}`, payload)).data;
      return (await api.post('/defects', payload)).data;
    },
    onSuccess: () => { message.success('Saved'); setOpen(false); setEditing(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['defects'] }); },
    onError: (e: any) => message.error(e.response?.data?.error?.message || 'Failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => (await api.put(`/defects/${id}`, { status })).data,
    onSuccess: () => { message.success('Status updated'); qc.invalidateQueries({ queryKey: ['defects'] }); },
    onError: (e: any) => message.error(e.response?.data?.error?.message || 'Failed')
  });

  const columns = [
    { title: 'Code', dataIndex: 'defectIdCode' },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Severity', dataIndex: 'severity' },
    { title: 'Priority', dataIndex: 'priority' },
    { title: 'Status', dataIndex: 'status', render: (v: string, r: Defect) => <Select size='small' value={v} style={{ width: 120 }} onChange={(val) => statusMutation.mutate({ id: r.id, status: val })} options={(status.data?.data || []).map(s => ({ value: s.code, label: s.code }))} /> },
    { title: 'Project', dataIndex: 'projectId', render: (v: number) => projects.data?.data.find(p => p.id === v)?.code },
    { title: 'Actions', render: (_: any, r: Defect) => <Space>
        <Button size='small' onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>Edit</Button>
        <Button size='small' onClick={() => setArtifactModal({ open: true, defect: r })}>Artifacts</Button>
      </Space> }
  ];

  return <Card title='Defects' extra={<Button type='primary' onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>New</Button>}>
    <Table size='small' rowKey='id' loading={isLoading} dataSource={data?.data || []} columns={columns as any} pagination={false} />
    <Modal open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} title={editing ? 'Edit Defect' : 'New Defect'} destroyOnClose>
      <Form form={form} layout='vertical' onFinish={(v) => saveMutation.mutate(v)} initialValues={{ defectIdCode: '' }}>
        <Form.Item name='projectId' label='Project' rules={[{ required: true }]}>
          <Select options={(projects.data?.data || []).map(p => ({ value: p.id, label: p.code }))} loading={projects.isLoading} showSearch optionFilterProp='label' />
        </Form.Item>
        <Form.Item name='defectIdCode' label='Code' rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name='title' label='Title' rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name='severity' label='Severity'>
          <Select options={(severity.data?.data || []).map(l => ({ value: l.code, label: l.code }))} loading={severity.isLoading} allowClear />
        </Form.Item>
        <Form.Item name='priority' label='Priority'>
          <Select options={(priority.data?.data || []).map(l => ({ value: l.code, label: l.code }))} loading={priority.isLoading} allowClear />
        </Form.Item>
        <Form.Item name='status' label='Status'>
          <Select options={(status.data?.data || []).map(l => ({ value: l.code, label: l.code }))} loading={status.isLoading} allowClear />
        </Form.Item>
      </Form>
    </Modal>
    <Modal open={artifactModal.open} onCancel={() => { setArtifactModal({ open: false, defect: null }); setFileList([]); }} onOk={() => { /* trigger upload done automatically */ setArtifactModal({ open: false, defect: null }); setFileList([]); }} title={`Artifacts - ${artifactModal.defect?.defectIdCode}`} destroyOnClose>
      {artifactModal.defect && <Upload
        fileList={fileList}
        multiple
        beforeUpload={() => false}
        onChange={({ fileList }) => setFileList(fileList)}
        customRequest={async ({ file, onSuccess, onError }: any) => {
          try {
            const formData = new FormData();
            formData.append('file', file as File);
            await api.post(`/defects/${artifactModal.defect!.id}/artifacts`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            onSuccess('ok');
            message.success('Uploaded');
          } catch (e: any) {
            onError(e);
            message.error(e.response?.data?.error?.message || 'Upload failed');
          }
        }}
      >
        <Button icon={<UploadOutlined />}>Upload</Button>
      </Upload>}
      <p style={{ marginTop: 12, fontSize: 12 }}>Uploads accepted: png, jpg, webp, mp4, webm. (Simple list view can be added later.)</p>
    </Modal>
  </Card>;
};

export default DefectsPage;
