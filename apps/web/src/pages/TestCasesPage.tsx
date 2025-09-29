import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Upload, message, Tag, Spin, Popconfirm, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRef } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect } from 'react';

interface TestCase { id: number; testCaseIdCode: string; description?: string | null; severity?: string | null; complexity?: string | null; projectId: number; testCaseFileId?: number | null; testCaseFileName?: string | null; }
interface Project { id: number; code: string; name: string; }
interface TestCaseFile {
  id: number;
  name: string;
  projectId: number;
  version?: string | null;
  environment?: string | null;
  releaseBuild?: string | null;
  refer?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { testCases: number };
  author?: { name?: string | null };
  isDeleted?: boolean;
}

const useProjects = () => useQuery<{ success: boolean; data: Project[] }>({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data });
const useLookup = (category: string) => useQuery<{ success: boolean; data: any[] }>({ queryKey: ['lookup', category], queryFn: async () => (await api.get(`/lookups/${category}`)).data });

const TestCasesPage = () => {
  const buildArtifactUrl = (filePath: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const cleaned = filePath.replace(/\\/g,'/').replace(/^uploads\//,'').replace(/^\.\//,'');
    return `${base}/files/${cleaned}`;
  };
  const qc = useQueryClient();
  // Selected file gating test cases
  const [activeFile, setActiveFile] = useState<TestCaseFile | null>(null);
  const { data, isLoading } = useQuery<{ success: boolean; data: TestCase[] }>({
    queryKey: ['test-cases', activeFile?.id],
    enabled: !!activeFile,
    queryFn: async () => (await api.get(`/test-cases?fileId=${activeFile!.id}`)).data
  });
  const testCaseFiles = useQuery<{ success: boolean; data: TestCaseFile[] }>({ queryKey: ['test-case-files'], queryFn: async () => (await api.get('/test-case-files')).data });
  // For fallback: fetch unassigned test cases for active file's project (only if we opened a file with zero test cases)
  const [showAttachPrompt, setShowAttachPrompt] = useState(false);
  const unassignedQuery = useQuery<{ success: boolean; data: TestCase[] }>({
    queryKey: ['unassigned-test-cases', activeFile?.projectId],
    enabled: !!activeFile && showAttachPrompt,
    queryFn: async () => (await api.get(`/test-cases?projectId=${activeFile!.projectId}`)).data
  });
  const bulkAssignMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // bulk assign sequentially (could be optimized server-side later)
      for (const id of ids) {
        await api.put(`/test-cases/${id}`, { testCaseFileId: activeFile!.id });
      }
      return { updated: ids.length };
    },
    onSuccess: (r) => { message.success(`Attached ${r.updated} test cases`); qc.invalidateQueries({ queryKey: ['test-cases', activeFile?.id] }); qc.invalidateQueries({ queryKey: ['test-case-files'] }); setShowAttachPrompt(false); },
    onError: (e:any) => message.error(e.response?.data?.error?.message || 'Bulk attach failed')
  });
  const projects = useProjects();
  const severity = useLookup('testcase_severity');
  const complexity = useLookup('testcase_complexity');

  const [open, setOpen] = useState(false); // retained for creating new only
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<TestCaseFile | null>(null);
  const [fileForm] = Form.useForm();
  const [editing, setEditing] = useState<TestCase | null>(null); // for create modal only
  const [form] = Form.useForm();
  const [rowEdits, setRowEdits] = useState<Record<number, any>>({});
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [artifactModal, setArtifactModal] = useState<{open: boolean; testCase: TestCase | null}>({ open: false, testCase: null });
  const [artifactPreview, setArtifactPreview] = useState<{ open: boolean; url: string | null; type: string | null }>({ open: false, url: null, type: null });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number } | null>(null);
  const zoomContainerRef = useRef<HTMLDivElement | null>(null);

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const applyZoom = (delta: number, anchor?: { x: number; y: number; container: HTMLDivElement }) => {
    setZoom(z => {
      const next = Math.min(8, Math.max(0.25, parseFloat((z * delta).toFixed(3))));
      if (!anchor || next === z) return next;
      // adjust pan so zoom is centered around cursor
      const rect = anchor.container.getBoundingClientRect();
      const cx = anchor.x - rect.left - rect.width / 2 - pan.x;
      const cy = anchor.y - rect.top - rect.height / 2 - pan.y;
      const ratio = next / z;
      setPan(p => ({ x: p.x - cx * (ratio - 1), y: p.y - cy * (ratio - 1) }));
      return next;
    });
  };
  const startPan = (e: React.MouseEvent) => {
    setPanning(true);
    setPanOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const duringPan = (e: React.MouseEvent) => {
    if (!panning || !panOrigin) return;
    setPan({ x: e.clientX - panOrigin.x, y: e.clientY - panOrigin.y });
  };
  const endPan = () => { setPanning(false); setPanOrigin(null); };

  useEffect(() => {
    if (!artifactPreview.open) { resetZoom(); }
  }, [artifactPreview.open]);
  // Attach non-passive wheel listener to avoid browser passive warning and allow preventDefault
  useEffect(() => {
    const el = zoomContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      // Only zoom (no need for ctrlKey requirement; we fully consume wheel inside container)
      const factor = e.deltaY < 0 ? 1.08 : 1/1.08;
      applyZoom(factor, { x: e.clientX, y: e.clientY, container: el });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => { el.removeEventListener('wheel', handler as any); };
  }, [zoomContainerRef, applyZoom]);
  const [fileList, setFileList] = useState<any[]>([]);
  const [artifactList, setArtifactList] = useState<any[] | null>(null);
  const [uploadingArtifacts, setUploadingArtifacts] = useState(false);
  // artifact summary now included in list API (artifactCount, latestArtifact)
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!activeFile) throw new Error('Select a Test Case File first');
      const payload = { ...values, projectId: Number(values.projectId), testCaseFileId: activeFile.id };
      if (editing) return (await api.put(`/test-cases/${editing.id}`, payload)).data;
      return (await api.post('/test-cases', payload)).data;
    },
    onSuccess: () => { message.success('Saved'); setOpen(false); setEditing(null); form.resetFields(); qc.invalidateQueries({ queryKey: ['test-cases', activeFile?.id] }); },
    onError: (e: any) => message.error(e.response?.data?.error?.message || 'Failed')
  });

  const saveFileMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, projectId: Number(values.projectId) };
      if (editingFile) return (await api.put(`/test-case-files/${editingFile.id}`, payload)).data;
      return (await api.post('/test-case-files', payload)).data;
    },
    onSuccess: () => { message.success('File saved'); setFileModalOpen(false); setEditingFile(null); fileForm.resetFields(); qc.invalidateQueries({ queryKey: ['test-case-files'] }); },
    onError: (e:any) => message.error(e.response?.data?.error?.message || 'File save failed')
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/test-case-files/${id}`)).data,
    onSuccess: (_d, id) => {
      message.success('File deleted');
      if (activeFile?.id === id) setActiveFile(null);
      qc.invalidateQueries({ queryKey: ['test-case-files'] });
    },
    onError: (e:any) => message.error(e.response?.data?.error?.message || 'Delete failed')
  });

  const isRowEditing = (id: number) => editingRowId === id;
  const setField = (id: number, key: string, value: any) => setRowEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  const startEdit = (r: any) => { setEditingRowId(r.id); setRowEdits(prev => ({ ...prev, [r.id]: { ...r, inputData: r.inputData ? JSON.stringify(r.inputData) : r.inputData } })); };
  const cancelEdit = (id: number) => { const copy = { ...rowEdits }; delete copy[id]; setRowEdits(copy); setEditingRowId(null); };
  const saveRow = async (id: number) => {
    const values = rowEdits[id];
    try {
      const payload = { ...values } as any;
      if (typeof payload.inputData === 'string' && payload.inputData.trim() !== '') {
        try { payload.inputData = JSON.parse(payload.inputData); } catch { /* ignore parse error, keep string */ }
      }
      await api.put(`/test-cases/${id}`, payload);
      message.success('Updated');
      cancelEdit(id);
      qc.invalidateQueries({ queryKey: ['test-cases', activeFile?.id] });
    } catch (e: any) {
      message.error(e.response?.data?.error?.message || 'Update failed');
    }
  };

  const editableText = (dataIndex: string, width?: number) => ({
    title: dataIndex,
    dataIndex,
    width,
    render: (_: any, r: any) => isRowEditing(r.id) ? <Input size='small' value={rowEdits[r.id][dataIndex] ?? ''} onChange={e => setField(r.id, dataIndex, e.target.value)} /> : (r as any)[dataIndex] ?? ''
  });
  const editableSelect = (dataIndex: string, options: string[]) => ({
    title: dataIndex,
    dataIndex,
    render: (_: any, r: any) => isRowEditing(r.id) ? <Select
      size='small'
      style={{ width: 110 }}
      value={rowEdits[r.id][dataIndex] ?? undefined}
      onChange={v => setField(r.id, dataIndex, v)}
      options={options.map(o => ({ value: o, label: o }))}
      allowClear
    /> : (r as any)[dataIndex] ?? ''
  });

  const severityColor = (val?: string) => {
    switch (val) {
      case 'High': return 'red';
      case 'Medium': return 'orange';
      case 'Low': return 'green';
      default: return 'default';
    }
  };
  const complexityColor = severityColor; // same scheme

  const statusColor = (val?: string) => {
    switch (val) {
      case 'Pass': return 'green';
      case 'Fail': return 'red';
      case 'Blocked': return 'volcano';
      case 'On_Hold': return 'gold';
      case 'Cannot_be_Executed': return 'magenta';
      case 'Not_Applicable': return 'blue';
      default: return 'default';
    }
  };

  const columns = [
  { title: 'Proj', dataIndex: 'projectId', width: 70, render: (v: number) => projects.data?.data.find(p => p.id === v)?.code },
  { title: 'File Id', dataIndex: 'testCaseFileId', width: 80 },
  { title: 'File Name', dataIndex: 'testCaseFileName', width: 160 },
    editableText('testCaseIdCode', 120),
    editableText('category'),
    editableText('featureName'),
    editableText('subFunctionality'),
    editableText('preRequisite'),
    { title: 'Input Data', dataIndex: 'inputData', render: (_:any, r:any) => isRowEditing(r.id) ? <Input.TextArea rows={1} autoSize value={rowEdits[r.id].inputData ?? ''} onChange={e => setField(r.id, 'inputData', e.target.value)} /> : (r.inputData ? JSON.stringify(r.inputData) : '') },
    editableText('expectedResult'),
    { title: 'severity', dataIndex: 'severity', render: (_:any, r:any) => isRowEditing(r.id) ? <Select
      size='small'
      style={{ width: 110 }}
      value={rowEdits[r.id].severity ?? undefined}
      onChange={v => setField(r.id, 'severity', v)}
      options={(severity.data?.data || []).map((l:any)=>({ value:l.code, label:l.code }))}
      allowClear
    /> : (r.severity ? <Tag color={severityColor(r.severity)}>{r.severity}</Tag> : '') },
    { title: 'complexity', dataIndex: 'complexity', render: (_:any, r:any) => isRowEditing(r.id) ? <Select
      size='small'
      style={{ width: 110 }}
      value={rowEdits[r.id].complexity ?? undefined}
      onChange={v => setField(r.id, 'complexity', v)}
      options={(complexity.data?.data || []).map((l:any)=>({ value:l.code, label:l.code }))}
      allowClear
    /> : (r.complexity ? <Tag color={complexityColor(r.complexity)}>{r.complexity}</Tag> : '') },
    editableText('actualResult'),
    { title: 'status', dataIndex: 'status', render: (_:any, r:any) => isRowEditing(r.id) ? <Select
        size='small'
        style={{ width: 140 }}
        value={rowEdits[r.id].status ?? undefined}
        onChange={v => setField(r.id, 'status', v)}
        options={['Pass','Fail','On_Hold','Not_Applicable','Cannot_be_Executed','Blocked'].map(v => ({ value: v, label: v }))}
        allowClear
      /> : (r.status ? <Tag color={statusColor(r.status)}>{r.status}</Tag> : '') },
    editableText('defectIdRef'),
    { title: 'Comments', dataIndex: 'comments', render: (_:any, r:any) => isRowEditing(r.id) ? <Input.TextArea rows={1} autoSize value={rowEdits[r.id].comments ?? ''} onChange={e => setField(r.id, 'comments', e.target.value)} /> : r.comments },
    editableText('labels'),
    { title: 'Actions', fixed: 'right', render: (_: any, r: any) => {
      const editing = isRowEditing(r.id);
      return <Space>
        {!editing && <Button size='small' onClick={() => startEdit(r)}>Edit</Button>}
        {editing && <>
          <Button size='small' type='primary' onClick={() => saveRow(r.id)}>Save</Button>
          <Button size='small' onClick={() => cancelEdit(r.id)}>Cancel</Button>
        </>}
        <Button size='small' onClick={() => setArtifactModal({ open: true, testCase: r })}>Artifacts</Button>
        {r.artifactCount > 0 && r.latestArtifact && <Button size='small' onClick={() => {
          const latest = r.latestArtifact;
          const url = buildArtifactUrl(latest.filePath);
          setArtifactPreview({ open: true, url, type: latest.mimeType });
        }}>View</Button>}
        <Popconfirm title='Delete test case?' okText='Yes' cancelText='No' onConfirm={async () => {
          try {
            await api.delete(`/test-cases/${r.id}`);
            message.success('Deleted');
            qc.invalidateQueries({ queryKey: ['test-cases', activeFile?.id] });
          } catch (e:any) {
            message.error(e.response?.data?.error?.message || 'Delete failed');
          }
        }}>
          <Button size='small' danger>Delete</Button>
        </Popconfirm>
      </Space>;
    }, width: 180 }
  ];

  // File upload (artifacts) minimal: open upload modal per row in future (placeholder)
  // For simplicity left out artifact UI for now.
  // When activeFile changes and loads, if the test-cases list is empty, check for unassigned
  useEffect(() => {
    if (activeFile && data && data.data.length === 0) {
      setShowAttachPrompt(true);
    } else if (!activeFile) {
      setShowAttachPrompt(false);
    }
  }, [activeFile, data]);

  // If no file selected, show file list first (early return AFTER all hooks declared above)
  if (!activeFile) {
    const fileColumns = [
      { title: 'Project', dataIndex: 'projectId', render: (v:number) => projects.data?.data.find(p=>p.id===v)?.code },
      { title: 'File Name', dataIndex: 'name' },
      { title: 'Version', dataIndex: 'version' },
      { title: 'Environment', dataIndex: 'environment' },
      { title: 'Release/Build', dataIndex: 'releaseBuild' },
      { title: 'Refer', dataIndex: 'refer', width: 120 },
      { title: 'Test Cases', dataIndex: ['_count','testCases'], render: (_:any,r:TestCaseFile)=> r._count?.testCases ?? 0 },
      { title: 'Author', dataIndex: ['author','name'], render: (_:any,r:TestCaseFile)=> r.author?.name || '' },
      { title: 'Created', dataIndex: 'createdAt', render: (v:string)=> new Date(v).toLocaleString(), width: 150 },
      { title: 'Updated', dataIndex: 'updatedAt', render: (v:string)=> new Date(v).toLocaleString(), width: 150 },
      { title: 'Actions', fixed: 'right', render: (_:any, r:TestCaseFile) => <Space>
          <Button size='small' type='link' onClick={() => {
            setActiveFile(r);
            // Delay check until query resolves; after mount we'll inspect results in effect
          }}>Open</Button>
          <Button size='small' onClick={() => { setEditingFile(r); fileForm.setFieldsValue(r); setFileModalOpen(true); }}>Edit</Button>
          <Popconfirm title='Delete file?' okText='Yes' cancelText='No' onConfirm={() => deleteFileMutation.mutate(r.id)}>
            <Button danger size='small' loading={deleteFileMutation.isPending && deleteFileMutation.variables === r.id}>Delete</Button>
          </Popconfirm>
        </Space>, width: 160 }
    ];
    return <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Card
        title='Test Case Files'
        extra={<Button type='primary' onClick={() => { setEditingFile(null); fileForm.resetFields(); setFileModalOpen(true); }}>New File</Button>}
        styles={{ body: { padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 } }}
        style={{ flex: 1, minHeight: 0 }}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table
            rowKey='id'
            size='small'
            loading={testCaseFiles.isLoading}
            dataSource={testCaseFiles.data?.data || []}
            columns={fileColumns as any}
            pagination={false}
            onRow={(r) => ({ onDoubleClick: () => setActiveFile(r) })}
            scroll={{ x: 1200 }}
          />
        </div>
      </Card>
      <Modal open={fileModalOpen} onCancel={() => setFileModalOpen(false)} onOk={() => fileForm.submit()} title={editingFile ? 'Edit Test Case File' : 'New Test Case File'} destroyOnHidden>
        <Form form={fileForm} layout='vertical' onFinish={(v)=> saveFileMutation.mutate(v)} initialValues={{ version: '1.0' }}>
          <Form.Item name='projectId' label='Project' rules={[{ required: true }]}>
            <Select options={(projects.data?.data || []).map(p => ({ value: p.id, label: `${p.code}` }))} loading={projects.isLoading} showSearch optionFilterProp='label' />
          </Form.Item>
          <Form.Item name='name' label='File Name' rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name='version' label='Version'><Input /></Form.Item>
            <Form.Item name='environment' label='Environment'><Input /></Form.Item>
            <Form.Item name='releaseBuild' label='Release / Build'><Input /></Form.Item>
            <Form.Item name='refer' label='Refer'><Input /></Form.Item>
        </Form>
      </Modal>
    </div>;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
  <Card
    styles={{ body: { padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 } }}
    title={`Test Cases - ${activeFile?.name || ''}`}
    extra={<Space>
      <Button onClick={() => setActiveFile(null)}>Back to Files</Button>
      <Button type='primary' onClick={() => { if (!activeFile) { message.warning('Select a file first'); return; } setEditing(null); form.resetFields(); if (activeFile) form.setFieldsValue({ projectId: activeFile.projectId }); setOpen(true); }}>New</Button>
    </Space>}
    style={{ flex: 1, minHeight: 0 }}
  >
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
    {activeFile && showAttachPrompt && !isLoading && data && data.data.length === 0 && (
      <Alert
        type='info'
        showIcon
        message='No test cases in this file yet'
        description={<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            {unassignedQuery.isLoading && 'Checking for existing project test cases...'}
            {unassignedQuery.data && unassignedQuery.data.data.filter(tc => !(tc as any).testCaseFileId).length > 0 && (
              <>
                Found {unassignedQuery.data.data.filter(tc => !(tc as any).testCaseFileId).length} test case(s) in the same project not yet attached.<br />
                <Space>
                  <Button size='small' loading={bulkAssignMutation.isPending} onClick={() => bulkAssignMutation.mutate(unassignedQuery.data!.data.filter(tc => !(tc as any).testCaseFileId).map(tc => tc.id))}>Attach All</Button>
                  <Button size='small' onClick={() => setShowAttachPrompt(false)}>Dismiss</Button>
                </Space>
              </>
            )}
            {unassignedQuery.data && unassignedQuery.data.data.filter(tc => !(tc as any).testCaseFileId).length === 0 && !unassignedQuery.isLoading && 'No unattached test cases in this project.'}
          </div>
        </div>}
        style={{ marginBottom: 12 }}
      />
    )}
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <Table
        size='small'
        sticky
        rowKey='id'
        loading={isLoading}
        dataSource={data?.data || []}
        columns={columns as any}
        pagination={false}
        scroll={{ x: 1600 }}
      />
    </div>
  <Modal open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} title={editing ? 'Edit Test Case' : 'New Test Case'} destroyOnHidden>
      <Form form={form} layout='vertical' onFinish={(v) => saveMutation.mutate(v)} initialValues={{ testCaseIdCode: '', projectId: activeFile?.projectId, testCaseFileId: activeFile?.id }} style={{ maxHeight: '60vh', overflow: 'auto', paddingRight: 4 }}>
        <Form.Item name='projectId' label='Project' rules={[{ required: true }]}>
          <Select disabled={!!activeFile} options={(projects.data?.data || []).map(p => ({ value: p.id, label: p.code }))} loading={projects.isLoading} showSearch optionFilterProp='label' />
        </Form.Item>
        <Form.Item name='testCaseFileId' label='Test Case File Id'>
          <Input disabled value={activeFile?.id} />
        </Form.Item>
        <Form.Item label='Test Case File Name'>
          <Input disabled value={activeFile?.name} />
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
  <Modal open={importOpen} title='Import Test Cases' onCancel={() => { setImportOpen(false); setImportResult(null); }} onOk={() => { /* trigger close */ setImportOpen(false); setImportResult(null); }} okText='Close' destroyOnHidden>
      <Upload beforeUpload={() => false} maxCount={1} onChange={({ fileList }) => setFileList(fileList)} fileList={fileList} accept='.xlsx,.csv'>
        <Button icon={<UploadOutlined />}>Select File</Button>
      </Upload>
      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4, color: '#555' }}>
        Template columns now include: <code>projectId</code>, <code>testCaseIdCode</code>, <code>testCaseFileId</code>, <code>testCaseFileName</code>, plus existing fields. You may supply either testCaseFileId or testCaseFileName (scoped by project). If this modal was opened while a file is selected, leaving both blank will still attach via the active file.
      </div>
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
  <Modal open={artifactModal.open} onCancel={() => { setArtifactModal({ open: false, testCase: null }); setFileList([]); setArtifactList(null); setUploadingArtifacts(false); }} onOk={() => { setArtifactModal({ open: false, testCase: null }); setFileList([]); setArtifactList(null); setUploadingArtifacts(false); }} title={`Artifacts - ${artifactModal.testCase?.testCaseIdCode}`} destroyOnHidden width={760}>
      {artifactModal.testCase && <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Upload
          fileList={fileList}
          multiple
          beforeUpload={() => false}
          onChange={({ fileList }) => setFileList(fileList)}
          accept='image/*,video/*'
        >
          <Button icon={<UploadOutlined />}>Select Files</Button>
        </Upload>
        <Button type='primary' disabled={!fileList.length || uploadingArtifacts} loading={uploadingArtifacts} onClick={async () => {
          if (!fileList.length) return;
          setUploadingArtifacts(true);
          try {
            for (const f of fileList) {
              if (!f.originFileObj) continue;
              const formData = new FormData();
              formData.append('file', f.originFileObj as File);
              await api.post(`/test-cases/${artifactModal.testCase!.id}/artifacts`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            message.success('Uploaded');
            setFileList([]);
            try {
              const list = await api.get(`/test-cases/${artifactModal.testCase!.id}/artifacts`);
              setArtifactList(list.data.data);
              qc.invalidateQueries({ queryKey: ['test-cases'] });
            } catch { /* ignore */ }
          } catch (e: any) {
            message.error(e.response?.data?.error?.message || 'Upload failed');
          } finally {
            setUploadingArtifacts(false);
          }
        }}>Upload Selected</Button>
        {fileList.length > 0 && <Button disabled={uploadingArtifacts} onClick={() => setFileList([])}>Clear</Button>}
      </div>
      <p style={{ marginTop: 8, fontSize: 12, color: '#555' }}>Preview below before saving. Accepted: images (png,jpg,webp) & video (mp4,webm).</p>
      {fileList.length > 0 && <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {fileList.map(f => {
          const file: File | undefined = f.originFileObj;
          let url: string | undefined;
          if (file) {
            try { url = (f.previewUrl ||= URL.createObjectURL(file)); } catch { /* ignore */ }
          }
          const mime = file?.type || '';
          return <div key={f.uid} style={{ width: 130, border: '1px solid #eee', padding: 6, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ width: '100%', height: 80, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 4 }}>
              {url && mime.startsWith('image') && <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              {url && mime.startsWith('video') && <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
              {!url && <span style={{ fontSize: 11 }}>No preview</span>}
            </div>
            <div style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file?.name}</div>
            {url && <Button size='small' onClick={() => {
              // Open a quick view modal using existing artifactPreview logic without server save
              setArtifactPreview({ open: true, url, type: mime });
            }}>View</Button>}
          </div>;
        })}
      </div>}
      <ArtifactList testCaseId={artifactModal.testCase.id} list={artifactList} setList={setArtifactList} />
      </>}
    </Modal>
  <Modal open={artifactPreview.open} onCancel={() => setArtifactPreview({ open: false, url: null, type: null })} footer={null} title='Artifact Preview' width={900} destroyOnHidden>
      {(() => {
        const isImage = !!artifactPreview.url && (
          artifactPreview.type?.toLowerCase().startsWith('image') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(artifactPreview.url.split('?')[0] || '')
        );
        if (!isImage) return null;
        return (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size='small' onClick={() => applyZoom(1/1.2)} disabled={zoom <= 0.25}>-</Button>
              <Button size='small' onClick={() => applyZoom(1.2)} disabled={zoom >= 8}>+</Button>
              <Button size='small' onClick={resetZoom} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>Reset</Button>
              <div style={{ fontSize: 11, color: '#555', lineHeight: '24px' }}>Zoom: {(zoom*100).toFixed(0)}%</div>
              <div style={{ fontSize: 11, color: '#555', lineHeight: '24px' }}>Pan: {pan.x},{pan.y}</div>
              <div style={{ fontSize: 11, color: '#888', lineHeight: '24px' }}>Drag to pan · Ctrl+Wheel / +/- to zoom</div>
            </div>
            <div
              ref={zoomContainerRef}
              onMouseDown={startPan}
              onMouseMove={duringPan}
              onMouseUp={endPan}
              onMouseLeave={endPan}
              style={{
                width: '100%',
                height: 500,
                border: '1px solid #ddd',
                background: '#111',
                borderRadius: 6,
                overflow: 'hidden',
                cursor: panning ? 'grabbing' : 'grab',
                position: 'relative'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: panning ? 'none' : 'transform 0.05s linear'
              }}>
                <img
                  draggable={false}
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', userSelect: 'none', pointerEvents: 'none' }}
                  src={artifactPreview.url!}
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (el.getAttribute('data-error-shown')) return;
                    el.setAttribute('data-error-shown','1');
                    el.style.display = 'none';
                    message.warning('Image failed to load – check network or open in new tab.');
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}
      {artifactPreview.url && artifactPreview.type?.startsWith('video') && <video
        style={{ maxWidth: '100%', background: '#000' }}
        src={artifactPreview.url}
        controls
        onError={() => message.error('Video failed to load. Try opening in a new tab.')}
      />}
      {!artifactPreview.url && <div style={{ fontSize: 12, color: '#666' }}>No artifact selected.</div>}
      {artifactPreview.url && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, wordBreak: 'break-all', color: '#555' }}>{artifactPreview.url}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size='small' onClick={() => window.open(artifactPreview.url!, '_blank')}>Open in new tab</Button>
          <Button size='small' onClick={() => {
            if (!artifactPreview.url) return;
            // force a reload by toggling url
            const url = artifactPreview.url;
            setArtifactPreview(prev => ({ ...prev, url: '' }));
            setTimeout(() => setArtifactPreview(prev => ({ ...prev, url })), 0);
          }}>Retry</Button>
        </div>
      </div>}
    </Modal>
  </Card></div>;
};

export default TestCasesPage;

// --- Helper component for listing artifacts inside modal ---
interface ArtifactListProps {
  testCaseId: number;
  list: any[] | null;
  setList: (l: any[] | null) => void;
}

const ArtifactList: React.FC<ArtifactListProps> = ({ testCaseId, list, setList }) => {
  const [loading, setLoading] = useState(false);
  const buildArtifactUrl = (filePath: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const cleaned = filePath.replace(/\\/g,'/').replace(/^uploads\//,'').replace(/^\.\//,'');
    return `${base}/files/${cleaned}`;
  };
  useEffect(() => {
    if (list === null) {
      (async () => {
        setLoading(true);
        try {
          const r = await api.get(`/test-cases/${testCaseId}/artifacts`);
          setList(r.data.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
      })();
    }
  }, [list, testCaseId, setList]);

  if (loading && !list) return <div style={{ padding: 8 }}><Spin size='small' /> Loading artifacts...</div>;
  if (!list || list.length === 0) return <div style={{ padding: 8, fontSize: 12, color: '#666' }}>No artifacts yet.</div>;
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, maxHeight: 260, overflow: 'auto' }}>
    {list.map(a => {
      const url = buildArtifactUrl(a.filePath);
      return <div key={a.id} style={{ width: 120, border: '1px solid #eee', padding: 4, borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {a.mimeType.startsWith('image') && <img src={url} style={{ width: '100%', height: 70, objectFit: 'cover' }} />}
        {a.mimeType.startsWith('video') && <div style={{ width: '100%', height: 70, background: '#000', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Video</div>}
        <div style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.originalName}</div>
        <Button size='small' onClick={() => window.open(url, '_blank')}>Open</Button>
      </div>;
    })}
  </div>;
};
