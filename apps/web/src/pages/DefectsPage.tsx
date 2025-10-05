import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

dayjs.extend(relativeTime);

type ApiResponse<T> = { success: boolean; data: T };

interface Project {
  id: number;
  code: string;
  name: string;
}

interface DefectFile {
  id: number;
  name: string;
  projectId: number;
  version?: string | null;
  environment?: string | null;
  releaseBuild?: string | null;
  refer?: string | null;
  isDeleted?: boolean;
  _count?: { defects: number };
}

interface Defect {
  id: number;
  defectIdCode: string;
  title: string;
  module?: string | null;
  status?: string | null;
  severity?: string | null;
  priority?: string | null;
  projectId: number;
  projectCode?: string | null;
  defectFileId?: number | null;
  defectFileName?: string | null;
  projectName?: string | null;
  assignedToName?: string | null;
  reportedByName?: string | null;
  artifactCount?: number;
  description?: string | null;
  testData?: any;
  actualResults?: string | null;
  expectedResults?: string | null;
  release?: string | null;
  environment?: string | null;
  rcaStatus?: string | null;
  comments?: string | null;
  triageComments?: string | null;
  labels?: string | null;
  assignedToId?: number | null;
  reportedById?: number | null;
  deliveryDate?: string | null;
  reportedDate?: string | null;
  closedDate?: string | null;
  updatedAt: string;
  createdAt: string;
}

const statusOptions = ['open', 'in_progress', 'resolved', 'closed', 'on_hold'];
const severityOptions = ['Critical', 'High', 'Medium', 'Low'];
const priorityOptions = ['P0', 'P1', 'P2', 'P3'];

const DefectsPage = () => {
  const qc = useQueryClient();
  const [projectFilter, setProjectFilter] = useState<number | undefined>();
  const [selectedFileId, setSelectedFileId] = useState<number | undefined>();

  const { data: projectQuery, isLoading: projectsLoading } = useQuery<ApiResponse<Project[]>>({
    queryKey: ['projects'],
    queryFn: async () => (await api.get('/projects')).data
  });
  const projects = projectQuery?.data ?? [];
  const projectMap = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const {
    data: fileQuery,
    isLoading: filesLoading
  } = useQuery<ApiResponse<DefectFile[]>>({
    queryKey: ['defect-files'],
    queryFn: async () => (await api.get('/defect-files')).data
  });
  const files = useMemo(() => {
    const raw = fileQuery?.data ?? [];
    return raw.filter((f) => !f.isDeleted);
  }, [fileQuery]);

  const filteredFiles = useMemo(() => {
    if (!projectFilter) return files;
    return files.filter((f) => f.projectId === projectFilter);
  }, [files, projectFilter]);

  useEffect(() => {
    if (!selectedFileId && filteredFiles.length) {
      setSelectedFileId(filteredFiles[0].id);
    }
    if (selectedFileId && !filteredFiles.some((f) => f.id === selectedFileId)) {
      setSelectedFileId(filteredFiles[0]?.id);
    }
  }, [filteredFiles, selectedFileId]);

  const activeFile = files.find((f) => f.id === selectedFileId) ?? null;

  const { data: defectsQuery, isLoading: defectsLoading } = useQuery<ApiResponse<Defect[]>>({
    queryKey: ['defects', selectedFileId, projectFilter],
    enabled: !!selectedFileId || !!projectFilter,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFileId) params.append('fileId', String(selectedFileId));
      if (projectFilter) params.append('projectId', String(projectFilter));
      const res = await api.get(`/defects?${params.toString()}`);
      return res.data;
    }
  });
  const defects = defectsQuery?.data ?? [];

  const [defectModal, setDefectModal] = useState<{ open: boolean; editing: Defect | null }>({ open: false, editing: null });
  const [defectForm] = Form.useForm();
  const projectIdValue = Form.useWatch('projectId', defectForm);

  const [fileModal, setFileModal] = useState<{ open: boolean; editing: DefectFile | null }>({ open: false, editing: null });
  const [fileForm] = Form.useForm();

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importFiles, setImportFiles] = useState<UploadFile<any>[]>([]);

  const populateDefectForm = () => {
    defectForm.resetFields();
    if (defectModal.editing) {
      const record = defectModal.editing as any;
      const testDataValue =
        record.testData === null || typeof record.testData === 'undefined'
          ? undefined
          : typeof record.testData === 'object'
            ? JSON.stringify(record.testData, null, 2)
            : String(record.testData);
      defectForm.setFieldsValue({
        projectId: record.projectId,
        defectFileId: record.defectFileId ?? activeFile?.id,
        defectIdCode: record.defectIdCode,
        title: record.title,
        module: record.module ?? undefined,
        status: record.status ?? undefined,
        severity: record.severity ?? undefined,
        priority: record.priority ?? undefined,
        description: record.description ?? undefined,
        testData: testDataValue,
        actualResults: record.actualResults ?? undefined,
        expectedResults: record.expectedResults ?? undefined,
        release: record.release ?? undefined,
        environment: record.environment ?? undefined,
        rcaStatus: record.rcaStatus ?? undefined,
        labels: record.labels ?? undefined,
        comments: record.comments ?? undefined,
        triageComments: record.triageComments ?? undefined,
        assignedToId: record.assignedToId ?? undefined,
        reportedById: record.reportedById ?? undefined,
        deliveryDate: record.deliveryDate ? dayjs(record.deliveryDate) : undefined,
        reportedDate: record.reportedDate ? dayjs(record.reportedDate) : undefined,
        closedDate: record.closedDate ? dayjs(record.closedDate) : undefined
      });
    } else {
      const defaultProjectId = activeFile?.projectId ?? projectFilter ?? undefined;
      const defaultDefectFileId = activeFile?.id ?? selectedFileId ?? undefined;
      defectForm.setFieldsValue({
        projectId: defaultProjectId,
        defectFileId: defaultDefectFileId
      });
    }
  };

  const populateFileForm = () => {
    fileForm.resetFields();
    if (fileModal.editing) {
      fileForm.setFieldsValue({
        projectId: fileModal.editing.projectId,
        name: fileModal.editing.name,
        version: fileModal.editing.version ?? undefined,
        environment: fileModal.editing.environment ?? undefined,
        releaseBuild: fileModal.editing.releaseBuild ?? undefined,
        refer: fileModal.editing.refer ?? undefined
      });
    } else {
      if (projectFilter) fileForm.setFieldsValue({ projectId: projectFilter });
    }
  };

  const saveFile = useMutation({
    mutationFn: async (payload: any) => {
      if (fileModal.editing) {
        return (await api.put(`/defect-files/${fileModal.editing.id}`, payload)).data;
      }
      return (await api.post('/defect-files', payload)).data;
    },
    onSuccess: (result) => {
      const saved = (result as ApiResponse<DefectFile>).data;
      message.success('Defect file saved');
      qc.invalidateQueries({ queryKey: ['defect-files'] });
      if (saved?.id) {
        setProjectFilter(saved.projectId);
        setSelectedFileId(saved.id);
      }
      setFileModal({ open: false, editing: null });
      fileForm.resetFields();
    },
    onError: (err: any) => message.error(err?.response?.data?.error?.message || 'Failed to save defect file')
  });

  const deleteFile = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/defect-files/${id}`)).data,
    onSuccess: (_res, id) => {
      message.success('Defect file deleted');
      if (selectedFileId === id) setSelectedFileId(undefined);
      qc.invalidateQueries({ queryKey: ['defect-files'] });
    },
    onError: (err: any) => message.error(err?.response?.data?.error?.message || 'Failed to delete defect file')
  });

  const saveDefect = useMutation({
    mutationFn: async (payload: any) => {
      if (defectModal.editing) {
        return (await api.put(`/defects/${defectModal.editing.id}`, payload)).data;
      }
      return (await api.post('/defects', payload)).data;
    },
    onSuccess: () => {
      message.success('Defect saved');
      qc.invalidateQueries({ queryKey: ['defects'] });
      setDefectModal({ open: false, editing: null });
      defectForm.resetFields();
    },
    onError: (err: any) => message.error(err?.response?.data?.error?.message || 'Failed to save defect')
  });

  const deleteDefect = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/defects/${id}`)).data,
    onSuccess: () => {
      message.success('Defect deleted');
      qc.invalidateQueries({ queryKey: ['defects'] });
    },
    onError: (err: any) => message.error(err?.response?.data?.error?.message || 'Failed to delete defect')
  });

  const renderTextCell = (value?: string | null) => (value ? <span title={value}>{value}</span> : '-');
  const renderJsonCell = (value: any) => {
    if (value === null || typeof value === 'undefined') return '-';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? <span title={trimmed}>{trimmed}</span> : '-';
    }
    try {
      const stringified = JSON.stringify(value);
      return <span title={stringified}>{stringified}</span>;
    } catch {
      const fallback = String(value);
      return fallback ? <span title={fallback}>{fallback}</span> : '-';
    }
  };
  const renderDateCell = (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD') : '-');

  const columns: ColumnsType<Defect> = [
    { title: 'Project ID', dataIndex: 'projectId', key: 'projectId', width: 110, render: (value) => (value ? <span>{value}</span> : '-') },
    {
      title: 'Project Code',
      dataIndex: 'projectCode',
      key: 'projectCode',
      width: 150,
      render: (_value, record) => {
        const code = projectMap.get(record.projectId)?.code ?? record.projectCode ?? null;
        return renderTextCell(code);
      }
    },
    {
      title: 'Project Name',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 200,
      render: (_value, record) => {
        const name = record.projectName ?? projectMap.get(record.projectId)?.name ?? null;
        return renderTextCell(name);
      }
    },
    { title: 'Defect File ID', dataIndex: 'defectFileId', key: 'defectFileId', width: 130, render: (value) => (value ? <span>{value}</span> : '-') },
  { title: 'Defect File Name', dataIndex: 'defectFileName', key: 'defectFileName', width: 200, render: (value) => renderTextCell(value) },
    { title: 'Defect ID', dataIndex: 'defectIdCode', key: 'defectIdCode', width: 140, render: (value) => renderTextCell(value) },
    { title: 'Title', dataIndex: 'title', key: 'title', width: 200, render: (value) => renderTextCell(value) },
    { title: 'Module', dataIndex: 'module', key: 'module', width: 160, render: (value) => renderTextCell(value) },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (value) => (value ? <Tag color={value === 'Critical' || value === 'High' ? 'red' : 'blue'}>{value}</Tag> : '-')
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (value) => (value ? <Tag>{value}</Tag> : '-')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value) => (value ? <Tag color={value === 'closed' ? 'green' : value === 'resolved' ? 'blue' : 'gold'}>{value}</Tag> : '-')
    },
    { title: 'Release', dataIndex: 'release', key: 'release', width: 140, render: (value) => renderTextCell(value) },
    { title: 'Environment', dataIndex: 'environment', key: 'environment', width: 140, render: (value) => renderTextCell(value) },
    { title: 'RCA Status', dataIndex: 'rcaStatus', key: 'rcaStatus', width: 150, render: (value) => renderTextCell(value) },
    { title: 'Labels', dataIndex: 'labels', key: 'labels', width: 160, render: (value) => renderTextCell(value) },
    { title: 'Assigned To', dataIndex: 'assignedToName', key: 'assignedToName', width: 180, render: (value) => renderTextCell(value) },
    { title: 'Reported By', dataIndex: 'reportedByName', key: 'reportedByName', width: 180, render: (value) => renderTextCell(value) },
    { title: 'Delivery Date', dataIndex: 'deliveryDate', key: 'deliveryDate', width: 140, render: (value) => renderDateCell(value) },
    { title: 'Reported Date', dataIndex: 'reportedDate', key: 'reportedDate', width: 140, render: (value) => renderDateCell(value) },
    { title: 'Closed Date', dataIndex: 'closedDate', key: 'closedDate', width: 140, render: (value) => renderDateCell(value) },
    { title: 'Actual Results', dataIndex: 'actualResults', key: 'actualResults', width: 220, render: (value) => renderTextCell(value) },
    { title: 'Expected Results', dataIndex: 'expectedResults', key: 'expectedResults', width: 220, render: (value) => renderTextCell(value) },
    { title: 'Test Data', dataIndex: 'testData', key: 'testData', width: 220, render: (_, record) => renderJsonCell(record.testData) },
    { title: 'Comments', dataIndex: 'comments', key: 'comments', width: 220, render: (value) => renderTextCell(value) },
    { title: 'Triage Comments', dataIndex: 'triageComments', key: 'triageComments', width: 220, render: (value) => renderTextCell(value) },
    { title: 'Description', dataIndex: 'description', key: 'description', width: 240, render: (value) => renderTextCell(value) },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (value) => (value ? dayjs(value).fromNow() : '-')
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => setDefectModal({ open: true, editing: record })}>
            Edit
          </Button>
          <Popconfirm
            title="Delete defect"
            description="Are you sure you want to delete this defect?"
            onConfirm={() => deleteDefect.mutate(record.id)}
          >
            <Button type="link" danger loading={deleteDefect.isPending}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const handleDefectSubmit = () => {
    defectForm
      .validateFields()
      .then((values) => {
        const projectIdRaw = values.projectId ?? activeFile?.projectId;
        const defectFileIdRaw = values.defectFileId ?? activeFile?.id;
        const assignedToIdRaw = values.assignedToId;
        const reportedByIdRaw = values.reportedById;
        const payload = {
          ...values,
          projectId: projectIdRaw ? Number(projectIdRaw) : undefined,
          defectFileId: defectFileIdRaw ? Number(defectFileIdRaw) : undefined,
          assignedToId:
            assignedToIdRaw === null || typeof assignedToIdRaw === 'undefined' ? undefined : Number(assignedToIdRaw),
          reportedById:
            reportedByIdRaw === null || typeof reportedByIdRaw === 'undefined' ? undefined : Number(reportedByIdRaw),
          deliveryDate: values.deliveryDate ? values.deliveryDate.toISOString() : undefined,
          reportedDate: values.reportedDate ? values.reportedDate.toISOString() : undefined,
          closedDate: values.closedDate ? values.closedDate.toISOString() : undefined
        };
        if (typeof payload.testData === 'string') {
          const trimmed = payload.testData.trim();
          if (!trimmed) {
            payload.testData = undefined;
          } else {
            try {
              payload.testData = JSON.parse(trimmed);
            } catch {
              payload.testData = trimmed;
            }
          }
        }
        if (!payload.projectId) {
          message.error('Project is required');
          return;
        }
        if (!payload.defectFileId) {
          message.error('Defect file is required');
          return;
        }
        saveDefect.mutate(payload);
      })
      .catch(() => undefined);
  };

  const handleFileSubmit = () => {
    fileForm
      .validateFields()
      .then((values) => {
        const payload = {
          ...values,
          projectId: Number(values.projectId)
        };
        saveFile.mutate(payload);
      })
      .catch(() => undefined);
  };

  const busy = defectsLoading || filesLoading;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space wrap size="middle">
          <div>
            <Typography.Text type="secondary">Project</Typography.Text>
            <Select
              style={{ width: 220 }}
              placeholder="Select project"
              allowClear
              value={projectFilter}
              loading={projectsLoading}
              onChange={(val) => setProjectFilter(val)}
              options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
              optionFilterProp="label"
              showSearch
            />
          </div>
          <div>
            <Typography.Text type="secondary">Defect File</Typography.Text>
            <Select
              style={{ width: 240 }}
              placeholder="Select defect file"
              value={selectedFileId}
              onChange={(val) => setSelectedFileId(val)}
              options={filteredFiles.map((f) => ({ value: f.id, label: `${f.name}${f.version ? ` v${f.version}` : ''}` }))}
              optionFilterProp="label"
              showSearch
            />
          </div>
          <Space>
            <Button type="primary" onClick={() => setDefectModal({ open: true, editing: null })} disabled={!activeFile}>
              New Defect
            </Button>
            <Button onClick={() => setFileModal({ open: true, editing: null })}>New Defect File</Button>
            <Button onClick={() => activeFile && setFileModal({ open: true, editing: activeFile })} disabled={!activeFile}>
              Edit Selected File
            </Button>
            {activeFile && (
              <Popconfirm
                title="Delete defect file"
                description="Deleting this file will hide associated defects. Continue?"
                onConfirm={() => deleteFile.mutate(activeFile.id)}
              >
                <Button danger loading={deleteFile.isPending}>Delete File</Button>
              </Popconfirm>
            )}
          </Space>
        </Space>
      </Card>

      {!activeFile && !projectFilter && (
        <Alert type="info" message="Select a project or defect file to view defects." showIcon />
      )}

      <Card title={activeFile ? `Defects · ${activeFile.name}` : 'Defects'}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button
            type="primary"
            onClick={() => setDefectModal({ open: true, editing: null })}
            disabled={!activeFile}
          >
            New Defect
          </Button>
          <Button onClick={() => setImportOpen(true)} icon={<UploadOutlined />}>Import</Button>
          <Button
            onClick={async () => {
              try {
                const params = new URLSearchParams();
                if (selectedFileId) params.append('fileId', String(selectedFileId));
                if (projectFilter) params.append('projectId', String(projectFilter));
                const query = params.toString();
                const res = await api.get(`/defects/export/xlsx${query ? `?${query}` : ''}`, { responseType: 'blob' });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'defects.xlsx';
                a.click();
                URL.revokeObjectURL(url);
              } catch (err: any) {
                message.error(err?.response?.data?.error?.message || 'Export failed');
              }
            }}
          >
            Export
          </Button>
          <Button
            onClick={async () => {
              try {
                const res = await api.get('/defects/template/xlsx', { responseType: 'blob' });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'defects-template.xlsx';
                a.click();
                URL.revokeObjectURL(url);
              } catch (err: any) {
                message.error(err?.response?.data?.error?.message || 'Template download failed');
              }
            }}
          >
            Template
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={busy}
          dataSource={defects}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 2600 }}
        />
      </Card>

      <Modal
        title="Import Defects"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setImportResult(null);
          setImportFiles([]);
        }}
        onOk={() => {
          setImportOpen(false);
          setImportResult(null);
          setImportFiles([]);
        }}
        okText="Close"
        destroyOnHidden
      >
        <Upload
          beforeUpload={() => false}
          maxCount={1}
          accept=".xlsx,.csv"
          fileList={importFiles}
          onChange={({ fileList }) => setImportFiles(fileList as UploadFile<any>[])}
        >
          <Button icon={<UploadOutlined />}>Select File</Button>
        </Upload>
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, color: '#555' }}>
          Include columns such as <code>projectId</code>, <code>defectIdCode</code>, <code>title</code>, optional{' '}
          <code>defectFileId</code>/<code>defectFileName</code> and{' '}
          <code>assignedToId</code>/<code>assignedToEmail</code>,{' '}
          <code>reportedById</code>/<code>reportedByEmail</code>, plus any other defect fields you wish to update.
          Dates accept ISO strings or Excel serial numbers.
        </div>
        <Button
          disabled={!importFiles.length}
          loading={importing}
          style={{ marginTop: 12 }}
          onClick={async () => {
            if (!importFiles.length) return;
            const first = importFiles[0];
            if (!first?.originFileObj) {
              message.error('Select a file to import');
              return;
            }
            setImporting(true);
            try {
              const fd = new FormData();
              fd.append('file', first.originFileObj as File);
              const res = await api.post('/defects/import/xlsx', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
              setImportResult(res.data.data);
              message.success('Import complete');
              qc.invalidateQueries({ queryKey: ['defects'] });
            } catch (err: any) {
              message.error(err?.response?.data?.error?.message || 'Import failed');
            } finally {
              setImporting(false);
            }
          }}
        >
          Upload &amp; Process
        </Button>
        {importResult && (
          <div style={{ marginTop: 16 }}>
            <strong>Summary:</strong>
            <br />
            {(() => {
              const summary = importResult.summary || { created: 0, failed: 0 };
              return (
                <span>
                  Created/Updated: {summary.created} | Failed: {summary.failed}
                </span>
              );
            })()}
            {Array.isArray(importResult.parseErrors) && importResult.parseErrors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong>Parser warnings:</strong>
                <div style={{ maxHeight: 120, overflow: 'auto', marginTop: 4 }}>
                  {importResult.parseErrors.map((err: string, idx: number) => (
                    <div key={idx}>{err}</div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(importResult.failed) && importResult.failed.length > 0 && (
              <div style={{ maxHeight: 120, overflow: 'auto', marginTop: 8 }}>
                {importResult.failed.slice(0, 25).map((failure: any, idx: number) => (
                  <div key={idx}>
                    Row {failure.row}: {Array.isArray(failure.errors) ? failure.errors.join(', ') : failure.errors}
                  </div>
                ))}
                {importResult.failed.length > 25 && (
                  <div>... {importResult.failed.length - 25} more</div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={defectModal.editing ? 'Edit Defect' : 'New Defect'}
        open={defectModal.open}
        onCancel={() => setDefectModal({ open: false, editing: null })}
        onOk={handleDefectSubmit}
        confirmLoading={saveDefect.isPending}
        destroyOnClose
        afterOpenChange={(nextOpen) => {
          if (nextOpen) {
            populateDefectForm();
          } else {
            defectForm.resetFields();
          }
        }}
        width={640}
      >
        <Form layout="vertical" form={defectForm} preserve={false}>
          <Form.Item name="projectId" label="Project" rules={[{ required: true, message: 'Project is required' }]}>
            <Select
              placeholder="Choose project"
              options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
              loading={projectsLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="defectFileId" label="Defect File" rules={[{ required: true, message: 'Defect file is required' }]}>
            <Select
              placeholder="Choose defect file"
              options={files
                .filter((f) => !projectIdValue || f.projectId === projectIdValue)
                .map((f) => ({ value: f.id, label: `${f.name}${f.version ? ` v${f.version}` : ''}` }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="defectIdCode" label="Defect ID" rules={[{ required: true, message: 'Defect ID is required' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="module" label="Module">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="testData" label="Test Data (JSON)">
            <Input.TextArea rows={3} placeholder='{"steps":[]}' />
          </Form.Item>
          <Form.Item name="actualResults" label="Actual Results">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="expectedResults" label="Expected Results">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="severity" label="Severity" style={{ minWidth: 180 }}>
              <Select allowClear placeholder="Select" options={severityOptions.map((val) => ({ value: val, label: val }))} />
            </Form.Item>
            <Form.Item name="priority" label="Priority" style={{ minWidth: 160 }}>
              <Select allowClear placeholder="Select" options={priorityOptions.map((val) => ({ value: val, label: val }))} />
            </Form.Item>
            <Form.Item name="status" label="Status" style={{ minWidth: 160 }}>
              <Select allowClear placeholder="Select" options={statusOptions.map((val) => ({ value: val, label: val }))} />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="release" label="Release" style={{ minWidth: 180 }}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="environment" label="Environment" style={{ minWidth: 180 }}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="labels" label="Labels (CSV)" style={{ minWidth: 200 }}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="rcaStatus" label="RCA Status" style={{ minWidth: 200 }}>
              <Input autoComplete="off" />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="assignedToId" label="Assigned To (User ID)" style={{ minWidth: 200 }}>
              <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter ID" />
            </Form.Item>
            <Form.Item name="reportedById" label="Reported By (User ID)" style={{ minWidth: 200 }}>
              <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter ID" />
            </Form.Item>
          </Space>
          <Form.Item name="comments" label="Comments">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="triageComments" label="Triage Comments">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="deliveryDate" label="Delivery Date">
              <DatePicker style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="reportedDate" label="Reported Date">
              <DatePicker style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="closedDate" label="Closed Date">
              <DatePicker style={{ width: 180 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={fileModal.editing ? 'Edit Defect File' : 'New Defect File'}
        open={fileModal.open}
        onCancel={() => setFileModal({ open: false, editing: null })}
        onOk={handleFileSubmit}
        confirmLoading={saveFile.isPending}
        destroyOnClose
        afterOpenChange={(nextOpen) => {
          if (nextOpen) {
            populateFileForm();
          } else {
            fileForm.resetFields();
          }
        }}
      >
        <Form layout="vertical" form={fileForm} preserve={false}>
          <Form.Item name="projectId" label="Project" rules={[{ required: true, message: 'Project is required' }]}>
            <Select
              placeholder="Choose project"
              options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
              loading={projectsLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="version" label="Version">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="environment" label="Environment">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="releaseBuild" label="Release Build">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="refer" label="Reference">
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default DefectsPage;
