import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
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
  const [artifactModal, setArtifactModal] = useState<{open: boolean; testCase: TestCase | null}>({ open: false, testCase: null });
  const [fileList, setFileList] = useState<any[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

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
    { title: 'Code', dataIndex: 'testCaseIdCode', width: 140 },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Feature', dataIndex: 'featureName' },
    { title: 'Severity', dataIndex: 'severity' },
    { title: 'Complexity', dataIndex: 'complexity' },
    { title: 'Status', dataIndex: 'status' },
    { title: 'Defect Ref', dataIndex: 'defectIdRef' },
    { title: 'Project', dataIndex: 'projectId', render: (v: number) => projects.data?.data.find(p => p.id === v)?.code },
    { title: 'Actions', fixed: 'right', render: (_: any, r: any) => <Space>
        <Button size='small' onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>Edit</Button>
        <Button size='small' onClick={() => setArtifactModal({ open: true, testCase: r })}>Artifacts</Button>
      </Space>, width: 150 }
  ];

  // File upload (artifacts) minimal: open upload modal per row in future (placeholder)
  // For simplicity left out artifact UI for now.

  return <Card title='Test Cases' extra={<Button type='primary' onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>New</Button>}>
    <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button onClick={() => setImportOpen(true)}>Import</Button>
      <Button onClick={async () => {
        try {
          const res = await api.get('/test-cases/export/xlsx', { responseType: 'blob' });
          const url = URL.createObjectURL(res.data);
          const a = document.createElement('a'); a.href = url; a.download = 'test-cases.xlsx'; a.click(); URL.revokeObjectURL(url);
        } catch(e:any){ message.error('Export failed'); }
      }}>Export</Button>
      <Button onClick={async () => {
        try {
          const res = await api.get('/test-cases/template/xlsx', { responseType: 'blob' });
          const url = URL.createObjectURL(res.data);
          const a = document.createElement('a'); a.href = url; a.download = 'test-cases-template.xlsx'; a.click(); URL.revokeObjectURL(url);
        } catch(e:any){ message.error('Template download failed'); }
      }}>Template</Button>
    </div>
    <Table size='small' rowKey='id' loading={isLoading} dataSource={data?.data || []} columns={columns as any} pagination={false} />
    <Modal open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} title={editing ? 'Edit Test Case' : 'New Test Case'} destroyOnClose>
      <Form form={form} layout='vertical' onFinish={(v) => saveMutation.mutate(v)} initialValues={{ testCaseIdCode: '' }} style={{ maxHeight: '60vh', overflow: 'auto', paddingRight: 4 }}>
        <Form.Item name='projectId' label='Project' rules={[{ required: true }]}>
          <Select options={(projects.data?.data || []).map(p => ({ value: p.id, label: p.code }))} loading={projects.isLoading} showSearch optionFilterProp='label' />
        </Form.Item>
        <Form.Item name='testCaseIdCode' label='Test Case ID' rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name='category' label='Category'><Input /></Form.Item>
        <Form.Item name='featureName' label='Feature'><Input /></Form.Item>
        <Form.Item name='description' label='Description'><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name='subFunctionality' label='Sub Functionality'><Input /></Form.Item>
        <Form.Item name='preRequisite' label='Pre-requisite'><Input /></Form.Item>
        <Form.Item name='inputData' label='Input Data (JSON)'><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name='expectedResult' label='Expected Result'><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name='severity' label='Severity'>
          <Select options={(severity.data?.data || []).map(l => ({ value: l.code, label: l.code }))} loading={severity.isLoading} allowClear />
        </Form.Item>
        <Form.Item name='complexity' label='Complexity'>
          <Select options={(complexity.data?.data || []).map(l => ({ value: l.code, label: l.code }))} loading={complexity.isLoading} allowClear />
        </Form.Item>
        <Form.Item name='actualResult' label='Actual Result'><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name='status' label='Status'>
          <Select options={['Pass','Fail','On_Hold','Not_Applicable','Cannot_be_Executed','Blocked'].map(v => ({ value: v, label: v }))} allowClear />
        </Form.Item>
        <Form.Item name='defectIdRef' label='Defect ID / Description'><Input /></Form.Item>
        <Form.Item name='comments' label='Comments'><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name='labels' label='Labels (CSV)'><Input /></Form.Item>
      </Form>
    </Modal>
    <Modal open={importOpen} title='Import Test Cases' onCancel={() => { setImportOpen(false); setImportResult(null); }} onOk={() => { /* trigger close */ setImportOpen(false); setImportResult(null); }} okText='Close'>
      <Upload beforeUpload={() => false} maxCount={1} onChange={({ fileList }) => setFileList(fileList)} fileList={fileList} accept='.xlsx,.csv'>
        <Button icon={<UploadOutlined />}>Select File</Button>
      </Upload>
      <Button disabled={!fileList.length} loading={importing} style={{ marginTop: 12 }} onClick={async () => {
        if (!fileList.length) return; setImporting(true);
        try {
          const fd = new FormData();
            fd.append('file', fileList[0].originFileObj);
            const res = await api.post('/test-cases/import/xlsx', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setImportResult(res.data.data);
            message.success('Import complete');
            qc.invalidateQueries({ queryKey: ['test-cases'] });
        } catch (e: any) {
          message.error(e.response?.data?.error?.message || 'Import failed');
        } finally {
          setImporting(false);
        }
      }}>Upload & Process</Button>
      {importResult && <div style={{ marginTop: 16 }}>
        <strong>Summary:</strong><br />
        Created/Updated: {importResult.summary.created} | Failed: {importResult.summary.failed}
        {importResult.failed.length > 0 && <div style={{ maxHeight: 120, overflow: 'auto', marginTop: 8 }}>
          {importResult.failed.slice(0,25).map((f: any, i: number) => <div key={i}>Row {f.row}: {f.errors.join(', ')}</div>)}
          {importResult.failed.length > 25 && <div>... {importResult.failed.length - 25} more</div>}
        </div>}
      </div>}
    </Modal>
    <Modal open={artifactModal.open} onCancel={() => { setArtifactModal({ open: false, testCase: null }); setFileList([]); }} onOk={() => { setArtifactModal({ open: false, testCase: null }); setFileList([]); }} title={`Artifacts - ${artifactModal.testCase?.testCaseIdCode}`} destroyOnClose>
      {artifactModal.testCase && <Upload
        fileList={fileList}
        multiple
        beforeUpload={() => false}
        onChange={({ fileList }) => setFileList(fileList)}
        customRequest={async ({ file, onSuccess, onError }: any) => {
          try {
            const formData = new FormData();
            formData.append('file', file as File);
            await api.post(`/test-cases/${artifactModal.testCase!.id}/artifacts`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
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

export default TestCasesPage;
