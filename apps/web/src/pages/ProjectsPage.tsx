import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

interface Project {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status: "ongoing" | "completed" | "yet_to_start" | "other" | string;
  createdAt: string;
}

const projectStatusOptions = [
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "yet_to_start", label: "Yet to Start" },
  { value: "other", label: "Other" }
];

const statusLabelMap = projectStatusOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const ProjectsPage = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ success: boolean; data: Project[] }>({ queryKey: ["projects"], queryFn: async () => (await api.get("/projects")).data });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form] = Form.useForm();

  const palette = useMemo(() => {
    const cardStyle: CSSProperties = {
      background:
        "linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(59, 130, 246, 0.14) 45%, rgba(30, 64, 175, 0.18) 100%)",
      border: "1px solid rgba(59, 130, 246, 0.35)",
      borderRadius: 24,
      boxShadow: "0 24px 40px rgba(30, 64, 175, 0.25)",
      overflow: "hidden"
    };

    return {
      cardStyle,
      headStyle: {
        background: "rgba(15, 23, 42, 0.7)",
        borderBottom: "1px solid rgba(96, 165, 250, 0.42)",
        color: "#e0f2fe",
        fontSize: 20,
        letterSpacing: 0.5,
        textTransform: "uppercase"
      } satisfies CSSProperties,
      bodyStyle: {
        background: "linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.55) 100%)",
        color: "#e2e8f0"
      } satisfies CSSProperties,
      primaryButton: {
        background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
        border: "none",
        boxShadow: "0 10px 25px rgba(14, 165, 233, 0.35)",
        fontWeight: 600
      } satisfies CSSProperties,
      tableStyle: {
        background: "transparent",
        color: "#e2e8f0"
      } satisfies CSSProperties,
      modalStyle: {
        padding: 0,
        borderRadius: 22,
        overflow: "hidden",
        background: "rgba(15, 23, 42, 0.92)"
      } satisfies CSSProperties,
      modalBody: {
        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.45) 100%)",
        paddingTop: 24
      } satisfies CSSProperties
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        return (await api.put(`/projects/${editing.id}`, values)).data;
      }
      return (await api.post("/projects", values)).data;
    },
    onSuccess: () => {
      message.success("Saved");
      setOpen(false);
      setEditing(null);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => message.error(e.response?.data?.error?.message || "Failed")
  });

  const columns = [
    { title: "Code", dataIndex: "code" },
    { title: "Name", dataIndex: "name" },
    { title: "Description", dataIndex: "description" },
    {
      title: "Status",
      dataIndex: "status",
      render: (value: Project["status"]) => (
        <Tag
          color={value === "completed" ? "success" : value === "yet_to_start" ? "processing" : value === "other" ? "default" : "warning"}
          style={{
            borderRadius: 14,
            padding: "4px 12px",
            fontWeight: 600,
            background: value === "completed" ? "rgba(74, 222, 128, 0.15)" : "rgba(59, 130, 246, 0.18)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            color: "#f8fafc"
          }}
        >
          {statusLabelMap[value] ?? value}
        </Tag>
      )
    },
    {
      title: "Actions",
      render: (_: any, r: Project) => (
        <Space>
          <Button
            size="small"
            type="link"
            style={{
              color: "#60a5fa",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.4
            }}
            onClick={() => {
              setEditing(r);
              form.setFieldsValue({ ...r, status: r.status ?? "ongoing" });
              setOpen(true);
            }}
          >
            Edit
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card
        title="Projects"
        extra={
          <Button
            type="primary"
            style={palette.primaryButton}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              form.setFieldsValue({ status: "ongoing" });
              setOpen(true);
            }}
          >
            New
          </Button>
        }
        style={palette.cardStyle}
        headStyle={palette.headStyle}
        bodyStyle={palette.bodyStyle}
      >
        <Table
          size="small"
          rowKey="id"
          loading={isLoading}
          dataSource={data?.data || []}
          columns={columns as any}
          pagination={false}
          style={palette.tableStyle}
          bordered={false}
        />
      </Card>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        title={editing ? "Edit Project" : "New Project"}
        destroyOnHidden
        style={palette.modalStyle}
        bodyStyle={palette.modalBody}
        okText={editing ? "Save Changes" : "Create Project"}
        okButtonProps={{ style: palette.primaryButton }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => saveMutation.mutate(v)}
          initialValues={{ code: "", name: "", status: "ongoing" }}
          requiredMark={false}
          style={{ color: "#e2e8f0" }}
        >
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input placeholder="Enter code" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Project name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: "Status is required" }]}
          >
            <Select options={projectStatusOptions} placeholder="Select status" allowClear={false} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
