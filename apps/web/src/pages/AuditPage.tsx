import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card,
  Table,
  Tag,
  Select,
  Space,
  DatePicker,
  Input,
  Button,
  Tooltip,
  Typography,
  Tabs,
  message
} from "antd";
import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;
const { Text } = Typography;

type DateRange = [Dayjs | null, Dayjs | null] | null;

interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  beforeJson?: any;
  afterJson?: any;
  createdAt: string;
  userId?: number | null;
  user?: { id: number; email: string; firstName: string; lastName: string } | null;
}

interface AuditResponse {
  success: boolean;
  data: AuditLog[];
  pagination: { total: number; page: number; take: number };
  filters: { entities: string[]; actions: string[] };
}

const ACTION_COLORS: Record<string, string> = {
  create: "success",
  created: "success",
  update: "processing",
  updated: "processing",
  delete: "error",
  deleted: "error"
};

const prettify = (payload: any) => JSON.stringify(payload, null, 2);

const getActionColor = (value: string) => ACTION_COLORS[value.toLowerCase()] ?? "default";

const useDebouncedValue = <T,>(value: T, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

const AuditPage = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [entityFilter, setEntityFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const debouncedSearch = useDebouncedValue(searchDraft, 420);

  const fromDate = dateRange?.[0] ?? null;
  const toDate = dateRange?.[1] ?? null;

  useEffect(() => {
    setPage(1);
  }, [entityFilter, actionFilter, debouncedSearch, fromDate?.valueOf(), toDate?.valueOf()]);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, take: pageSize };
    if (entityFilter) params.entity = entityFilter;
    if (actionFilter) params.action = actionFilter;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (fromDate) params.from = fromDate.startOf("day").toISOString();
    if (toDate) params.to = toDate.endOf("day").toISOString();
    return params;
  }, [page, pageSize, entityFilter, actionFilter, debouncedSearch, fromDate, toDate]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["audit", queryParams],
    queryFn: async (): Promise<AuditResponse> => {
      const response = await api.get<AuditResponse>("/audit", { params: queryParams });
      return response.data;
    },
    placeholderData: (previousData) => previousData
  });

  const palette = useMemo(() => ({
    shell: {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      gap: 24,
      minHeight: 0,
      background:
        "linear-gradient(135deg, rgba(94, 234, 212, 0.18) 0%, rgba(56, 189, 248, 0.18) 45%, rgba(59, 130, 246, 0.22) 100%)",
      padding: 24,
      borderRadius: 28,
      border: "1px solid rgba(148, 163, 184, 0.22)",
      boxShadow: "0 32px 64px rgba(15, 23, 42, 0.45)",
      backdropFilter: "blur(10px)",
      color: "#e2e8f0"
    } satisfies CSSProperties,
    card: {
      background: "rgba(15, 23, 42, 0.88)",
      border: "1px solid rgba(56, 189, 248, 0.32)",
      borderRadius: 24,
      boxShadow: "0 24px 45px rgba(13, 148, 136, 0.3)"
    } satisfies CSSProperties,
    head: {
      background: "linear-gradient(135deg, rgba(20, 184, 166, 0.55) 0%, rgba(8, 145, 178, 0.55) 100%)",
      color: "#ecfeff",
      fontSize: 20,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      borderBottom: "1px solid rgba(148, 163, 184, 0.35)"
    } satisfies CSSProperties,
    body: {
      background: "linear-gradient(180deg, rgba(15, 23, 42, 0.86) 0%, rgba(15, 23, 42, 0.66) 100%)",
      color: "#f1f5f9"
    } satisfies CSSProperties,
    table: {
      background: "transparent",
      color: "#f8fafc"
    } satisfies CSSProperties
  }), []);

  const filters = data?.filters ?? { entities: [] as string[], actions: [] as string[] };

  const handleCopy = useCallback(async (payload: any, label: string) => {
    if (!payload) {
      message.info(`${label} payload is empty`);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      message.warning("Clipboard not available in this environment");
      return;
    }
    try {
      await navigator.clipboard.writeText(prettify(payload));
      message.success(`${label} copied to clipboard`);
    } catch (err) {
      console.error(err);
      message.error("Unable to copy to clipboard");
    }
  }, []);

  const renderJsonPanel = useCallback(
    (title: string, payload: any) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Space align="center" style={{ justifyContent: "space-between" }}>
          <Text strong style={{ color: "#f1f5f9" }}>{title}</Text>
          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleCopy(payload, title)}>
            Copy
          </Button>
        </Space>
        {payload ? (
          <pre
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: 12,
              padding: 16,
              maxHeight: 280,
              overflow: "auto",
              color: "#cbd5f5"
            }}
          >
            {prettify(payload)}
          </pre>
        ) : (
          <Text type="secondary">Empty</Text>
        )}
      </div>
    ),
    [handleCopy]
  );

  const columns: ColumnsType<AuditLog> = useMemo(() => {
    return [
      {
        title: "Time",
        dataIndex: "createdAt",
        width: 190,
        render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss")
      },
      {
        title: "Entity",
        dataIndex: "entityType",
        width: 160,
        render: (value: string) => <Text style={{ color: "#f1f5f9" }}>{value}</Text>
      },
      {
        title: "Entity ID",
        dataIndex: "entityId",
        width: 110
      },
      {
        title: "Action",
        dataIndex: "action",
        width: 120,
        render: (value: string) => (
          <Tag color={getActionColor(value)} style={{ borderRadius: 14, paddingInline: 12, fontWeight: 600 }}>
            {value}
          </Tag>
        )
      },
      {
        title: "User",
        dataIndex: "user",
        width: 220,
        render: (_: unknown, record: AuditLog) => {
          if (!record.user) return <Text type="secondary">System</Text>;
          const { firstName, lastName, email } = record.user;
          const label = `${firstName} ${lastName}`.trim();
          return (
            <Tooltip title={email}>
              <Text style={{ color: "#bae6fd" }}>{label || email}</Text>
            </Tooltip>
          );
        }
      },
      {
        title: "Summary",
        dataIndex: "afterJson",
        render: (_: unknown, record: AuditLog) => {
          const beforeKeys = record.beforeJson ? Object.keys(record.beforeJson) : [];
          const afterKeys = record.afterJson ? Object.keys(record.afterJson) : [];
          const fieldCount = new Set([...beforeKeys, ...afterKeys]).size;
          return (
            <Text type="secondary" style={{ color: "#cbd5f5" }}>
              {fieldCount ? `${fieldCount} field(s)` : "No payload"}
            </Text>
          );
        }
      }
    ];
  }, []);

  const expandedRowRender = useCallback(
    (record: AuditLog) => (
      <Tabs
        defaultActiveKey={record.afterJson ? "after" : "before"}
        items={[
          {
            key: "before",
            label: "Before",
            children: renderJsonPanel("Before State", record.beforeJson)
          },
          {
            key: "after",
            label: "After",
            children: renderJsonPanel("After State", record.afterJson)
          }
        ]}
      />
    ),
    [renderJsonPanel]
  );

  const handleTableChange = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current);
    if (pagination.pageSize && pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize);
      setPage(1);
    }
  };

  const resetFilters = () => {
    setEntityFilter(undefined);
    setActionFilter(undefined);
    setDateRange(null);
    setSearchDraft("");
  };

  return (
    <div style={palette.shell}>
      <Card title="Audit Log" style={palette.card} headStyle={palette.head} bodyStyle={palette.body}>
        <Space size="middle" wrap style={{ marginBottom: 16, gap: 12 }}>
          <Select
            allowClear
            placeholder="Entity"
            style={{ minWidth: 160 }}
            value={entityFilter}
            options={filters.entities.map((e: string) => ({ label: e, value: e }))}
            onChange={(value) => setEntityFilter(value || undefined)}
          />
          <Select
            allowClear
            placeholder="Action"
            style={{ minWidth: 140 }}
            value={actionFilter}
            options={filters.actions.map((a: string) => ({ label: a, value: a }))}
            onChange={(value) => setActionFilter(value || undefined)}
          />
          <RangePicker
            value={dateRange}
            onChange={(range) => setDateRange(range)}
            allowEmpty={[true, true]}
            style={{ minWidth: 260 }}
            format="YYYY-MM-DD"
          />
          <Input.Search
            placeholder="Search entity, action, email or ID"
            allowClear
            style={{ minWidth: 260 }}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
          <Button type="text" onClick={resetFilters} disabled={!entityFilter && !actionFilter && !dateRange && !searchDraft}>
            Reset Filters
          </Button>
        </Space>

        <div style={{ marginBottom: 12, color: "#cbd5f5" }}>
          <Text type="secondary" style={{ color: "#cbd5f5" }}>
            Showing {(data?.data?.length ?? 0)} of {data?.pagination?.total ?? 0} records
          </Text>
        </div>

        <Table
          size="small"
          rowKey="id"
          loading={isFetching}
          dataSource={data?.data || []}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total: data?.pagination?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
          }}
          onChange={handleTableChange}
          expandable={{ expandedRowRender, expandRowByClick: true }}
          style={palette.table}
          scroll={{ x: 960 }}
        />
      </Card>
    </div>
  );
};

export default AuditPage;
