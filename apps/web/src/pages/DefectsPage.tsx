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
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

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
  defectFileId?: number | null;
  defectFileName?: string | null;
  projectName?: string | null;
  assignedToName?: string | null;
  reportedByName?: string | null;
  artifactCount?: number;
  description?: string | null;
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

  useEffect(() => {
    if (defectModal.open) {
      if (defectModal.editing) {
        const record = defectModal.editing as any;
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
          deliveryDate: record.deliveryDate ? dayjs(record.deliveryDate) : undefined,
          reportedDate: record.reportedDate ? dayjs(record.reportedDate) : undefined,
          closedDate: record.closedDate ? dayjs(record.closedDate) : undefined
        });
      } else {
        defectForm.resetFields();
        defectForm.setFieldsValue({
          projectId: activeFile?.projectId,
          defectFileId: activeFile?.id
        });
      }
    }
  }, [defectModal, defectForm, activeFile]);

  useEffect(() => {
    if (fileModal.open) {
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
        fileForm.resetFields();
        if (projectFilter) fileForm.setFieldsValue({ projectId: projectFilter });
      }
    }
  }, [fileModal, fileForm, projectFilter]);

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

  const columns: ColumnsType<Defect> = [
    { title: 'Defect ID', dataIndex: 'defectIdCode', key: 'defectIdCode', width: 140 },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
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
      width: 160,
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
        const payload = {
          ...values,
          projectId: Number(values.projectId ?? activeFile?.projectId),
          defectFileId: Number(values.defectFileId ?? activeFile?.id),
          deliveryDate: values.deliveryDate ? values.deliveryDate.toISOString() : undefined,
          reportedDate: values.reportedDate ? values.reportedDate.toISOString() : undefined,
          closedDate: values.closedDate ? values.closedDate.toISOString() : undefined
        };
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
        <Table
          rowKey="id"
          loading={busy}
          dataSource={defects}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={defectModal.editing ? 'Edit Defect' : 'New Defect'}
        open={defectModal.open}
        onCancel={() => setDefectModal({ open: false, editing: null })}
        onOk={handleDefectSubmit}
        confirmLoading={saveDefect.isPending}
  destroyOnHidden
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
  destroyOnHidden
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
