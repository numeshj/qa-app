import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Upload, message, Tag, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface Defect { id: number; defectIdCode: string; title: string; severity?: string | null; priority?: string | null; status?: string | null; projectId: number; defectFileId?: number | null; defectFileName?: string | null; }
interface Project { id: number; code: string; name: string; }
interface DefectFile { id: number; name: string; projectId: number; version?: string | null; environment?: string | null; releaseBuild?: string | null; refer?: string | null; _count?: { defects: number }; isDeleted?: boolean; }

const useProjects = () => useQuery<{ success: boolean; data: Project[] }>({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data });
const useLookup = (category: string) => useQuery<{ success: boolean; data: any[] }>({ queryKey: ['lookup', category], queryFn: async () => (await api.get(`/lookups/${category}`)).data });

const DefectsPage = () => {
  const qc = useQueryClient();
  // Active defect file gating
  const [activeFile, setActiveFile] = useState<DefectFile | null>(null);
  const defectsQuery = useQuery<{ success: boolean; data: Defect[] }>({
    queryKey: ['defects', activeFile?.id],
    enabled: !!activeFile,
    queryFn: async () => (await api.get(`/defects?defectFileId=${activeFile!.id}`)).data
  });
  const defectFiles = useQuery<{ success: boolean; data: DefectFile[] }>({ queryKey: ['defect-files'], queryFn: async () => (await api.get('/defect-files')).data });

  const projects = useProjects();
  const severity = useLookup('defect_severity');
  const priority = useLookup('priority');
  const status = useLookup('defect_status');

  // Defect File modal state
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<DefectFile | null>(null);
  const [fileForm] = Form.useForm();

  // Defect modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Defect | null>(null);
  const [form] = Form.useForm();
  const [artifactModal, setArtifactModal] = useState<{open: boolean; defect: Defect | null}>({ open: false, defect: null });
  const [uploadList, setUploadList] = useState<any[]>([]);

  const saveFileMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, projectId: Number(values.projectId) };
      if (editingFile) return (await api.put(`/defect-files/${editingFile.id}`, payload)).data;
      return (await api.post('/defect-files', payload)).data;
    },
    onSuccess: () => { message.success('File saved'); setFileModalOpen(false); setEditingFile(null); fileForm.resetFields(); qc.invalidateQueries({ queryKey: ['defect-files'] }); },
    onError: (e:any) => message.error(e.response?.data?.error?.message || 'File save failed')
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/defect-files/${id}`)).data,
    onSuccess: (_d, id) => { message.success('File deleted'); if (activeFile?.id === id) setActiveFile(null); qc.invalidateQueries({ queryKey: ['defect-files'] }); },
    onError: (e:any) => message.error(e.response?.data?.error?.message || 'Delete failed')
  });

  const saveDefectMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!activeFile) throw new Error('Select a Defect File first');
      const payload = { ...values, projectId: Number(values.projectId), defectFileId: activeFile.id };
      if (editing) return (await api.put(`/defects/${editing.id}`, payload)).data;
      return (await api.post('/defects', payload)).data;
    },
    onSuccess: () => { message.success('Saved'); setOpen(false); setEditing(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['defects', activeFile?.id] }); },
    onError: (e:any) => message.error(e.response?.data?.error?.message || 'Failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => (await api.put(`/defects/${id}`, { status })).data,
    onSuccess: () => { message.success('Status updated'); qc.invalidateQueries({ queryKey: ['defects', activeFile?.id] }); },
    onError: (e: any) => message.error(e.response?.data?.error?.message || 'Failed')
  });

  const defectColumns = [
    { title: 'Code', dataIndex: 'defectIdCode', width: 130 },
    { title: 'Title', dataIndex: 'title', width: 220 },
    { title: 'Severity', dataIndex: 'severity' },
    { title: 'Priority', dataIndex: 'priority' },
    { title: 'Status', dataIndex: 'status', render: (v: string, r: Defect) => <Select size='small' value={v} style={{ width: 120 }} onChange={(val) => statusMutation.mutate({ id: r.id, status: val })} options={(status.data?.data || []).map(s => ({ value: s.code, label: s.code }))} /> },
    { title: 'Project', dataIndex: 'projectId', render: (v: number) => projects.data?.data.find(p => p.id === v)?.code },
    { title: 'Actions', render: (_: any, r: Defect) => <Space>
        <Button size='small' onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>Edit</Button>
        <Button size='small' onClick={() => setArtifactModal({ open: true, defect: r })}>Artifacts</Button>
      </Space>, width: 150 }
  ];

  const fileColumns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Project', dataIndex: 'projectId', render: (v:number) => projects.data?.data.find(p => p.id === v)?.code },
    { title: 'Count', dataIndex: ['_count','defects'], width: 70 },
    { title: 'Actions', width: 120, render: (_:any, r:DefectFile) => <Space>
        <Button size='small' onClick={() => { setEditingFile(r); fileForm.setFieldsValue(r); setFileModalOpen(true); }}>Edit</Button>
        <Button size='small' danger onClick={() => deleteFileMutation.mutate(r.id)}>Del</Button>
      </Space> }
  ];

  return <Card title={`Defect Files${activeFile ? ' / ' + activeFile.name : ''}`} extra={<Space>
    <Button onClick={() => { setEditingFile(null); fileForm.resetFields(); setFileModalOpen(true); }}>New File</Button>
    <Button type='primary' disabled={!activeFile} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>New Defect</Button>
  </Space>}>
    <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
      <div style={{ flex: '0 0 360px', display: 'flex', flexDirection: 'column' }}>
        <Table size='small' rowKey='id' loading={defectFiles.isLoading} dataSource={defectFiles.data?.data || []} columns={fileColumns as any} pagination={false}
          onRow={(r) => ({ onClick: () => setActiveFile(r) })}
          rowClassName={(r) => r.id === activeFile?.id ? 'ant-table-row-selected' : ''}
          style={{ marginBottom: 12 }}
        />
        {!activeFile && <Alert type='info' message='Select a defect file to view its defects.' showIcon />}
      </div>
      <div style={{ flex: 1 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button disabled={!activeFile} onClick={() => activeFile && window.open(`/api/defects/export/xlsx?defectFileId=${activeFile.id}`,'_blank')}>Export</Button>
          <Upload beforeUpload={() => false} showUploadList={false} disabled={!activeFile}
            customRequest={async ({ file, onSuccess, onError }: any) => {
              if (!activeFile) return onError(new Error('No file selected'));
              try {
                const formData = new FormData();
                formData.append('file', file as File);
                await api.post('/defects/import/xlsx', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                message.success('Import queued');
                qc.invalidateQueries({ queryKey: ['defects', activeFile.id] });
                onSuccess('ok');
              } catch (e:any) {
                message.error(e.response?.data?.error?.message || 'Import failed');
                onError(e);
              }
            }}>
            <Button disabled={!activeFile}>Import</Button>
          </Upload>
        </Space>
        <Table size='small' rowKey='id' loading={defectsQuery.isLoading} dataSource={defectsQuery.data?.data || []} columns={defectColumns as any} pagination={false}
          locale={!activeFile ? { emptyText: 'Select a Defect File' } : undefined}
        />
      </div>
    </div>

    {/* Defect File Modal */}
    <Modal open={fileModalOpen} onCancel={() => { setFileModalOpen(false); setEditingFile(null); fileForm.resetFields(); }} onOk={() => fileForm.submit()} title={editingFile ? 'Edit Defect File' : 'New Defect File'} destroyOnHidden>
      <Form form={fileForm} layout='vertical' onFinish={(v) => saveFileMutation.mutate(v)}>
        <Form.Item name='projectId' label='Project' rules={[{ required: true }]}>
          <Select options={(projects.data?.data || []).map(p => ({ value: p.id, label: p.code }))} loading={projects.isLoading} showSearch optionFilterProp='label' />
        </Form.Item>
        <Form.Item name='name' label='Name' rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name='version' label='Version'><Input /></Form.Item>
        <Form.Item name='environment' label='Environment'><Input /></Form.Item>
        <Form.Item name='releaseBuild' label='Release Build'><Input /></Form.Item>
        <Form.Item name='refer' label='Reference'><Input /></Form.Item>
      </Form>
    </Modal>

    {/* Defect Modal */}
    <Modal open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} title={editing ? 'Edit Defect' : 'New Defect'} destroyOnHidden>
      <Form form={form} layout='vertical' onFinish={(v) => saveDefectMutation.mutate(v)} initialValues={{ defectIdCode: '' }}>
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

    {/* Artifact upload modal */}
    <Modal open={artifactModal.open} onCancel={() => { setArtifactModal({ open: false, defect: null }); setUploadList([]); }} onOk={() => { setArtifactModal({ open: false, defect: null }); setUploadList([]); }} title={`Artifacts - ${artifactModal.defect?.defectIdCode || ''}`} destroyOnHidden>
      {artifactModal.defect && <Upload
        fileList={uploadList}
        multiple
        beforeUpload={() => false}
        onChange={({ fileList }) => setUploadList(fileList)}
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
      <p style={{ marginTop: 12, fontSize: 12 }}>Uploads accepted: png, jpg, webp, mp4, webm.</p>
    </Modal>
  </Card>;
};

export default DefectsPage;
