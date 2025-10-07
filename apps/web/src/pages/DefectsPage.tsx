import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  message,
  Spin,
  Empty
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
  latestArtifact?: DefectArtifact | null;
}

interface DefectArtifact {
  id: number;
  defectId: number;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  type: string;
  createdAt: string;
}

const statusOptions = ['open', 'in_progress', 'resolved', 'closed', 'on_hold'];
const severityOptions = ['Critical', 'High', 'Medium', 'Low'];
const priorityOptions = ['P0', 'P1', 'P2', 'P3'];

const formatBytes = (size?: number | null) => {
  if (!size || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / Math.pow(1024, index);
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

const DefectsPage = () => {
  const buildArtifactUrl = (filePath: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const cleaned = filePath.replace(/\\/g, '/').replace(/^uploads\//, '').replace(/^\.\//, '');
    return `${base}/files/${cleaned}`;
  };
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
  const [artifactModal, setArtifactModal] = useState<{ open: boolean; defect: Defect | null }>({ open: false, defect: null });
  const [artifactFileList, setArtifactFileList] = useState<UploadFile<any>[]>([]);
  const [artifactList, setArtifactList] = useState<DefectArtifact[] | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactUploading, setArtifactUploading] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<{ open: boolean; url: string | null; type: string | null }>({ open: false, url: null, type: null });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number } | null>(null);
  const zoomContainerRef = useRef<HTMLDivElement | null>(null);
  const previewMime = (artifactPreview.type ?? '').toLowerCase();
  const isPreviewVideo = previewMime.startsWith('video');
  const isPreviewImage = previewMime.startsWith('image');

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPanOrigin(null);
    setPanning(false);
  }, []);

  const applyZoom = useCallback(
    (delta: number, anchor?: { x: number; y: number; container: HTMLDivElement }) => {
      setZoom((current) => {
        const next = Math.min(8, Math.max(0.25, parseFloat((current * delta).toFixed(3))));
        if (!anchor || next === current) return next;
        const rect = anchor.container.getBoundingClientRect();
        const cx = anchor.x - rect.left - rect.width / 2 - pan.x;
        const cy = anchor.y - rect.top - rect.height / 2 - pan.y;
        const ratio = next / current;
        setPan((prev) => ({
          x: prev.x - cx * (ratio - 1),
          y: prev.y - cy * (ratio - 1)
        }));
        return next;
      });
    },
    [pan.x, pan.y]
  );

  const startPan = (event: React.MouseEvent<HTMLDivElement>) => {
    setPanning(true);
    setPanOrigin({ x: event.clientX - pan.x, y: event.clientY - pan.y });
  };

  const duringPan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!panning || !panOrigin) return;
    setPan({ x: event.clientX - panOrigin.x, y: event.clientY - panOrigin.y });
  };

  const endPan = () => {
    setPanning(false);
    setPanOrigin(null);
  };

  const revokePreviewUrls = (files: UploadFile<any>[]) => {
    files.forEach((file) => {
      const preview = (file as UploadFile & { preview?: string }).preview;
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    });
  };

  const openArtifacts = (defect: Defect) => {
    setArtifactFileList([]);
    setArtifactList(null);
    setArtifactPreview({ open: false, url: null, type: null });
    setArtifactModal({ open: true, defect });
  };

  const closeArtifacts = () => {
    setArtifactModal({ open: false, defect: null });
    revokePreviewUrls(artifactFileList);
    setArtifactFileList([]);
    setArtifactList(null);
    setArtifactLoading(false);
    setArtifactUploading(false);
    setArtifactPreview({ open: false, url: null, type: null });
  };

  const fetchArtifacts = async (defectId: number, notifyError = true) => {
    setArtifactLoading(true);
    try {
      const res = await api.get<ApiResponse<DefectArtifact[]>>(`/defects/${defectId}/artifacts`);
      setArtifactList(res.data.data ?? []);
    } catch (err: any) {
      if (notifyError) {
        message.error(err?.response?.data?.error?.message || 'Failed to load artifacts');
      }
      setArtifactList([]);
    } finally {
      setArtifactLoading(false);
    }
  };

  useEffect(() => {
    if (!artifactModal.open || !artifactModal.defect) return;
    setArtifactList(null);
    fetchArtifacts(artifactModal.defect.id, true);
  }, [artifactModal.open, artifactModal.defect?.id]);

  useEffect(() => {
    if (!artifactPreview.open) {
      resetZoom();
    }
  }, [artifactPreview.open, resetZoom]);

  useEffect(() => {
    const container = zoomContainerRef.current;
    if (!container || !artifactPreview.open) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      applyZoom(factor, { x: event.clientX, y: event.clientY, container });
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => {
      container.removeEventListener('wheel', handler);
    };
  }, [artifactPreview.open, applyZoom]);

  const handleArtifactUpload = async () => {
    if (!artifactModal.defect || !artifactFileList.length) return;
    setArtifactUploading(true);
    try {
      for (const file of artifactFileList) {
        if (!file.originFileObj) continue;
        const formData = new FormData();
        formData.append('file', file.originFileObj as File);
        await api.post(`/defects/${artifactModal.defect.id}/artifacts`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      message.success('Artifacts uploaded');
      revokePreviewUrls(artifactFileList);
      setArtifactFileList([]);
      await fetchArtifacts(artifactModal.defect.id, false);
      qc.invalidateQueries({ queryKey: ['defects'] });
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || 'Failed to upload artifacts');
    } finally {
      setArtifactUploading(false);
    }
  };

  const handleArtifactDelete = async (artifactId: number) => {
    if (!artifactModal.defect) return;
    try {
      await api.delete(`/defects/${artifactModal.defect.id}/artifacts/${artifactId}`);
      message.success('Artifact deleted');
      await fetchArtifacts(artifactModal.defect.id, false);
      qc.invalidateQueries({ queryKey: ['defects'] });
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || 'Failed to delete artifact');
    }
  };

  const handleArtifactPreview = (artifact: DefectArtifact) => {
    resetZoom();
    const url = buildArtifactUrl(artifact.filePath);
    setArtifactPreview({ open: true, url, type: artifact.mimeType || artifact.type || null });
  };

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
      title: 'Artifacts',
      key: 'artifacts',
      width: 220,
      render: (_value, record) => {
        const count = record.artifactCount ?? 0;
        const latest = record.latestArtifact;
        return (
          <Space direction="vertical" size={0}>
            <Space size="small">
              <Tag color={count > 0 ? 'geekblue' : undefined} style={{ marginRight: 0 }}>
                {count} {count === 1 ? 'file' : 'files'}
              </Tag>
              {latest ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Latest {dayjs(latest.createdAt).fromNow()}
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  None uploaded
                </Typography.Text>
              )}
            </Space>
            <Button type="link" size="small" onClick={() => openArtifacts(record)}>
              Manage
            </Button>
          </Space>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => setDefectModal({ open: true, editing: record })}>
            Edit
          </Button>
          <Button type="link" onClick={() => openArtifacts(record)}>
            Artifacts
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
          scroll={{ x: 2800 }}
        />
      </Card>

      <Modal
        title={`Artifacts${artifactModal.defect ? ` · ${artifactModal.defect.defectIdCode}` : ''}`}
        open={artifactModal.open}
        onCancel={closeArtifacts}
        onOk={closeArtifacts}
        okText="Close"
        destroyOnClose
        width={780}
      >
        {artifactModal.defect && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Typography.Text type="secondary">
              Upload screenshots or recordings that reproduce the defect.
            </Typography.Text>
            <Space wrap>
              <Upload
                fileList={artifactFileList}
                beforeUpload={() => false}
                multiple
                accept="image/*,video/*"
                onChange={({ fileList }) => setArtifactFileList(fileList as UploadFile<any>[])}
              >
                <Button icon={<UploadOutlined />}>Select Files</Button>
              </Upload>
              <Button
                type="primary"
                disabled={!artifactFileList.length}
                loading={artifactUploading}
                onClick={handleArtifactUpload}
              >
                Upload Selected
              </Button>
              {artifactFileList.length > 0 && (
                <Button
                  onClick={() => {
                    revokePreviewUrls(artifactFileList);
                    setArtifactFileList([]);
                  }}
                  disabled={artifactUploading}
                >
                  Clear
                </Button>
              )}
            </Space>
            {artifactFileList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {artifactFileList.map((file) => {
                  const maybeFile = file.originFileObj as File | undefined;
                  let preview: string | undefined = (file as UploadFile & { preview?: string }).preview;
                  if (!preview && maybeFile) {
                    try {
                      preview = URL.createObjectURL(maybeFile);
                      (file as UploadFile & { preview?: string }).preview = preview;
                    } catch {
                      preview = undefined;
                    }
                  }
                  const mime = maybeFile?.type ?? file.type ?? '';
                  return (
                    <div
                      key={file.uid}
                      style={{
                        width: 150,
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 90,
                          background: '#fafafa',
                          borderRadius: 6,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          overflow: 'hidden'
                        }}
                      >
                        {preview && mime.startsWith('image') && (
                          <img src={preview} alt={maybeFile?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        {preview && mime.startsWith('video') && (
                          <video src={preview} style={{ width: '100%' }} muted />
                        )}
                        {!preview && <Typography.Text type="secondary">No preview</Typography.Text>}
                      </div>
                      <Typography.Text style={{ fontSize: 12 }} ellipsis={{ tooltip: maybeFile?.name }}>
                        {maybeFile?.name || file.name}
                      </Typography.Text>
                      {preview && (
                        <Button
                          size="small"
                          onClick={() => {
                            resetZoom();
                            setArtifactPreview({ open: true, url: preview!, type: mime });
                          }}
                        >
                          Preview
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ minHeight: 160, width: '100%' }}>
              {artifactLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <Spin tip="Loading artifacts..." />
                </div>
              )}
              {!artifactLoading && artifactList && artifactList.length === 0 && (
                <Empty description="No artifacts uploaded" />
              )}
              {!artifactLoading && artifactList && artifactList.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
                  }}
                >
                  {artifactList.map((artifact) => {
                    const url = buildArtifactUrl(artifact.filePath);
                    const isImage = (artifact.mimeType || '').toLowerCase().startsWith('image');
                    const isVideo = (artifact.mimeType || '').toLowerCase().startsWith('video');
                    return (
                      <Card
                        key={artifact.id}
                        size="small"
                        cover={
                          <div
                            style={{
                              width: '100%',
                              height: 140,
                              background: '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden'
                            }}
                          >
                            {isImage && <img src={url} alt={artifact.originalName} style={{ width: '100%', objectFit: 'cover' }} />}
                            {isVideo && <video src={url} style={{ width: '100%' }} controls={false} muted />}
                            {!isImage && !isVideo && <Typography.Text type="secondary">{artifact.type}</Typography.Text>}
                          </div>
                        }
                      >
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Typography.Text ellipsis={{ tooltip: artifact.originalName }}>{artifact.originalName}</Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {formatBytes(artifact.sizeBytes)} · {dayjs(artifact.createdAt).fromNow()}
                          </Typography.Text>
                          <Space size="small">
                            <Button type="link" size="small" onClick={() => handleArtifactPreview(artifact)}>
                              View
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => window.open(url, '_blank', 'noopener')}
                            >
                              Open
                            </Button>
                            <Popconfirm
                              title="Delete artifact"
                              description="Remove this artifact?"
                              onConfirm={() => handleArtifactDelete(artifact.id)}
                            >
                              <Button type="link" danger size="small">
                                Delete
                              </Button>
                            </Popconfirm>
                          </Space>
                        </Space>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title="Artifact Preview"
        open={artifactPreview.open}
        onCancel={() => setArtifactPreview({ open: false, url: null, type: null })}
        footer={null}
        width={isPreviewVideo ? 900 : 820}
        destroyOnClose
      >
        {artifactPreview.url ? (
          <>
            {isPreviewImage && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space size="small" wrap>
                  <Button size="small" onClick={() => applyZoom(1 / 1.2)} disabled={zoom <= 0.25}>
                    Zoom -
                  </Button>
                  <Button size="small" onClick={() => applyZoom(1.2)} disabled={zoom >= 8}>
                    Zoom +
                  </Button>
                  <Button size="small" onClick={resetZoom} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>
                    Reset
                  </Button>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Zoom: {(zoom * 100).toFixed(0)}% · Pan: {Math.round(pan.x)}, {Math.round(pan.y)}
                  </Typography.Text>
                </Space>
                <div
                  ref={zoomContainerRef}
                  onMouseDown={startPan}
                  onMouseMove={duringPan}
                  onMouseUp={endPan}
                  onMouseLeave={endPan}
                  style={{
                    width: '100%',
                    height: 480,
                    border: '1px solid #d9d9d9',
                    borderRadius: 8,
                    background: '#111',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: panning ? 'grabbing' : 'grab'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                      userSelect: 'none',
                      pointerEvents: 'none'
                    }}
                  >
                    <img
                      src={artifactPreview.url}
                      alt="Artifact preview"
                      draggable={false}
                      style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (!target.dataset.errorShown) {
                          target.dataset.errorShown = '1';
                          target.style.display = 'none';
                          message.warning('Image failed to load. Try opening in a new tab.');
                        }
                      }}
                    />
                  </div>
                </div>
              </Space>
            )}
            {isPreviewVideo && (
              <video
                src={artifactPreview.url}
                style={{ width: '100%', background: '#000', borderRadius: 8 }}
                controls
                autoPlay
                onError={() => message.error('Video failed to load.')}
              />
            )}
            {!isPreviewImage && !isPreviewVideo && (
              <Space direction="vertical" size="middle" style={{ width: '100%', alignItems: 'center' }}>
                <Empty description="Preview not available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                <Button type="primary" onClick={() => window.open(artifactPreview.url!, '_blank', 'noopener')}>
                  Open in new tab
                </Button>
              </Space>
            )}
            <Space direction="vertical" size="small" style={{ marginTop: 16, width: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                {artifactPreview.url}
              </Typography.Text>
              <Space size="small">
                <Button size="small" onClick={() => window.open(artifactPreview.url!, '_blank', 'noopener')}>
                  Open in new tab
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    if (!artifactPreview.url) return;
                    const current = artifactPreview.url;
                    setArtifactPreview((prev) => ({ ...prev, url: '' }));
                    setTimeout(() => setArtifactPreview((prev) => ({ ...prev, url: current })), 0);
                  }}
                >
                  Retry
                </Button>
              </Space>
            </Space>
          </>
        ) : (
          <Empty description="No preview available" />
        )}
      </Modal>

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
