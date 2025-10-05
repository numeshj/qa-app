import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Typography
} from "antd";
import { Pie, Column } from "@ant-design/plots";
import { api } from "../api/client";

const { Title, Text } = Typography;

interface SummaryCard {
  key: string;
  title: string;
  value: number;
  unit?: string;
  isPlaceholder?: boolean;
}

interface DistributionItem {
  key: string;
  label: string;
  value: number;
}

interface StatusOption {
  value: string;
  label: string;
  count: number;
}

interface ProjectButtonItem {
  id: number;
  name: string;
  code: string;
  status: string;
}

interface FilePanelItem {
  id: number;
  name: string;
  projectId: number | null;
  projectName: string | null;
  projectStatus: string | null;
  version: string | null;
  environment: string | null;
  release: string | null;
  updatedAt: string;
}

interface SeverityBreakdownItem {
  key: string;
  label: string;
  total: number;
  weight: number;
  resolved: number;
  unresolved: number;
  unresolvedWeighted: number;
}

interface SeverityMatrixRow {
  severityKey: string;
  severityLabel: string;
  open: number;
  closed: number;
  deferred: number;
}

interface DefectOverview {
  statusDistribution: DistributionItem[];
  priorityDistribution: DistributionItem[];
  severityDistribution: DistributionItem[];
  severityIndex: {
    value: number;
    interpretation: string;
    breakdown: SeverityBreakdownItem[];
  };
  matrix: SeverityMatrixRow[];
  totals: {
    open: number;
    resolved: number;
    reopened: number;
    inProgress: number;
    deferred: number;
    rejected: number;
    total: number;
  };
}

interface ProjectInfo {
  name: string;
  code: string;
  pm: string | null;
  ba: string | null;
  qal: string | null;
  preparedBy: string | null;
  dateCreated: string;
  accessLevel: string;
}

interface TestCaseSummary {
  meta: {
    name: string;
    project: string | null;
    author: string | null;
    version: string | null;
    environment: string | null;
    release: string | null;
    refer: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  severityCounts: DistributionItem[];
  statusCounts: DistributionItem[];
  totals: {
    total: number;
    executed: number;
    passed: number;
    failed: number;
    blocked: number;
    onHold: number;
    notExecuted: number;
    notApplicable: number;
    passRate: number;
  };
}

interface DashboardData {
  updatedAt: string;
  filters: {
    status: string | null;
    projectId: number | null;
  };
  statusOptions: StatusOption[];
  projects: ProjectButtonItem[];
  testCaseFiles: FilePanelItem[];
  defectFiles: FilePanelItem[];
  summaryCards: SummaryCard[];
  projectInfo: ProjectInfo | null;
  defectOverview: DefectOverview;
  testCaseSummary: TestCaseSummary;
}

const humanizeDate = (value?: string | null) =>
  value ? dayjs(value).format("DD-MMM-YYYY") : "—";

const ensureCards = (cards?: SummaryCard[]): SummaryCard[] =>
  cards && cards.length
    ? cards
    : Array.from({ length: 10 }, (_, index): SummaryCard => ({
        key: `placeholder-${index}`,
        title: "",
        value: 0,
        isPlaceholder: true
      }));

const summaryPalettes: Array<{
  background: string;
  title: string;
  value: string;
  shadow: string;
}> = [
  {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    title: "#E0E7FF",
    value: "#FFFFFF",
    shadow: "0 18px 35px rgba(99, 102, 241, 0.35)"
  },
  {
    background: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)",
    title: "#CFFAFE",
    value: "#FFFFFF",
    shadow: "0 18px 32px rgba(14, 165, 233, 0.35)"
  },
  {
    background: "linear-gradient(135deg, #10b981 0%, #22c55e 100%)",
    title: "#DCFCE7",
    value: "#FFFFFF",
    shadow: "0 18px 32px rgba(16, 185, 129, 0.3)"
  },
  {
    background: "linear-gradient(135deg, #f97316 0%, #fb7185 100%)",
    title: "#FFE4E6",
    value: "#FFFFFF",
    shadow: "0 18px 32px rgba(251, 113, 133, 0.35)"
  },
  {
    background: "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)",
    title: "#FCE7F3",
    value: "#FFFFFF",
    shadow: "0 18px 32px rgba(168, 85, 247, 0.4)"
  }
];

const statusThemes: Record<string, { gradient: string; color: string; shadow: string }> = {
  all: {
    gradient: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    color: "#38bdf8",
    shadow: "0 12px 26px rgba(56, 189, 248, 0.25)"
  },
  ongoing: {
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
    color: "#0ea5e9",
    shadow: "0 12px 26px rgba(14, 165, 233, 0.28)"
  },
  completed: {
    gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    color: "#22c55e",
    shadow: "0 12px 24px rgba(34, 197, 94, 0.28)"
  },
  yet_to_start: {
    gradient: "linear-gradient(135deg, #f97316 0%, #facc15 100%)",
    color: "#f97316",
    shadow: "0 12px 24px rgba(249, 115, 22, 0.25)"
  },
  other: {
    gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)",
    color: "#94a3b8",
    shadow: "0 12px 24px rgba(148, 163, 184, 0.22)"
  }
};

const pillPrimaryStyles = (
  active: boolean,
  gradient: string,
  color: string,
  shadow: string
): CSSProperties =>
  active
    ? {
        background: gradient,
        color: "#ffffff",
        border: "none",
        boxShadow: shadow
      }
    : {
        background: "transparent",
        color,
        borderColor: color,
        boxShadow: "none"
      };

const getStatusButtonStyles = (key: string, active: boolean): CSSProperties => {
  const theme = statusThemes[key] ?? statusThemes.other;
  return pillPrimaryStyles(active, theme.gradient, theme.color, theme.shadow);
};

const getProjectButtonStyles = (active: boolean): CSSProperties =>
  pillPrimaryStyles(
    active,
    "linear-gradient(135deg, #fb7185 0%, #f97316 100%)",
    "#fb7185",
    "0 12px 24px rgba(249, 115, 22, 0.25)"
  );

const getFileButtonStyles = (active: boolean): CSSProperties =>
  pillPrimaryStyles(
    active,
    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    "#6366f1",
    "0 10px 20px rgba(99, 102, 241, 0.25)"
  );

const filterCardStyle: CSSProperties = {
  borderRadius: 28,
  background: "linear-gradient(140deg, rgba(15, 23, 42, 0.96) 0%, rgba(15, 23, 42, 0.82) 100%)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 35px 65px rgba(15, 23, 42, 0.45)",
  color: "#E2E8F0"
};

const filterCardBodyStyle: CSSProperties = {
  padding: 28
};

const filterHeadingStyle: CSSProperties = {
  marginBottom: 12,
  color: "#F8FAFC",
  letterSpacing: 0.4
};

const pillSpaceStyle: CSSProperties = {
  gap: 12
};

const sectionTitleStyle: CSSProperties = {
  marginBottom: 16,
  color: "#0f172a",
  fontWeight: 700,
  letterSpacing: 0.3
};

const sectionCardStyle: CSSProperties = {
  borderRadius: 24,
  border: "none",
  boxShadow: "0 24px 55px rgba(15, 23, 42, 0.12)"
};

const glassCardStyle: CSSProperties = {
  borderRadius: 24,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(241, 245, 249, 0.9) 100%)",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.12)"
};

const cardHeadStyle: CSSProperties = {
  color: "#0f172a",
  fontWeight: 600,
  letterSpacing: 0.2
};

const inverseCardHeadStyle: CSSProperties = {
  color: "#f8fafc",
  fontWeight: 600,
  letterSpacing: 0.2
};

type GradientCardTheme = {
  background: string;
  bodyBackground: string;
  text: string;
  head: string;
  accent: string;
  shadow: string;
};

const getGradientCardVisuals = (theme: GradientCardTheme) => ({
  style: {
    background: theme.background,
    border: "none",
    borderRadius: 28,
    boxShadow: theme.shadow
  } satisfies CSSProperties,
  bodyStyle: {
    padding: 24,
    borderRadius: 24,
    background: theme.bodyBackground,
    color: theme.text
  } satisfies CSSProperties,
  headStyle: {
    color: theme.head,
    fontWeight: 600,
    letterSpacing: 0.25,
    background: "transparent"
  } satisfies CSSProperties
});

const projectInfoTheme: GradientCardTheme = {
  background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
  bodyBackground: "linear-gradient(135deg, rgba(224, 242, 254, 0.95) 0%, rgba(238, 242, 255, 0.95) 100%)",
  text: "#0f172a",
  head: "#1d4ed8",
  accent: "#1d4ed8",
  shadow: "0 32px 60px rgba(99, 102, 241, 0.35)"
};

const defectCardThemes: GradientCardTheme[] = [
  {
    background: "linear-gradient(135deg, #fb7185 0%, #f97316 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(255, 247, 237, 0.94) 0%, rgba(255, 228, 230, 0.94) 100%)",
    text: "#7c2d12",
    head: "#be123c",
    accent: "#be123c",
    shadow: "0 30px 58px rgba(249, 115, 22, 0.38)"
  },
  {
    background: "linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(224, 242, 254, 0.94) 0%, rgba(207, 250, 254, 0.94) 100%)",
    text: "#0f172a",
    head: "#0f6ba8",
    accent: "#0284c7",
    shadow: "0 30px 58px rgba(14, 165, 233, 0.35)"
  },
  {
    background: "linear-gradient(135deg, #22c55e 0%, #84cc16 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(220, 252, 231, 0.94) 0%, rgba(236, 253, 245, 0.94) 100%)",
    text: "#064e3b",
    head: "#047857",
    accent: "#047857",
    shadow: "0 30px 58px rgba(34, 197, 94, 0.32)"
  },
  {
    background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(253, 242, 248, 0.94) 0%, rgba(237, 233, 254, 0.94) 100%)",
    text: "#4c1d95",
    head: "#a21caf",
    accent: "#a21caf",
    shadow: "0 30px 58px rgba(168, 85, 247, 0.35)"
  },
  {
    background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(219, 234, 254, 0.94) 0%, rgba(224, 231, 255, 0.94) 100%)",
    text: "#0f172a",
    head: "#2563eb",
    accent: "#2563eb",
    shadow: "0 30px 58px rgba(99, 102, 241, 0.32)"
  }
];

const defectTotalsTheme: GradientCardTheme = {
  background: "linear-gradient(135deg, #f472b6 0%, #60a5fa 100%)",
  bodyBackground: "linear-gradient(135deg, rgba(254, 226, 226, 0.94) 0%, rgba(219, 234, 254, 0.94) 100%)",
  text: "#1f2937",
  head: "#1d4ed8",
  accent: "#2563eb",
  shadow: "0 30px 58px rgba(96, 165, 250, 0.32)"
};

const testCardThemes: GradientCardTheme[] = [
  {
    background: "linear-gradient(135deg, #facc15 0%, #f97316 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(255, 251, 235, 0.94) 0%, rgba(255, 237, 213, 0.94) 100%)",
    text: "#78350f",
    head: "#b45309",
    accent: "#b45309",
    shadow: "0 30px 58px rgba(249, 115, 22, 0.32)"
  },
  {
    background: "linear-gradient(135deg, #34d399 0%, #22d3ee 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(236, 253, 245, 0.94) 0%, rgba(209, 250, 229, 0.94) 100%)",
    text: "#0f766e",
    head: "#047857",
    accent: "#0f766e",
    shadow: "0 30px 58px rgba(16, 185, 129, 0.32)"
  },
  {
    background: "linear-gradient(135deg, #818cf8 0%, #c084fc 100%)",
    bodyBackground: "linear-gradient(135deg, rgba(237, 233, 254, 0.94) 0%, rgba(244, 219, 255, 0.94) 100%)",
    text: "#312e81",
    head: "#6d28d9",
    accent: "#6d28d9",
    shadow: "0 30px 58px rgba(129, 140, 248, 0.34)"
  }
];

const buildPieConfig = (data: DistributionItem[]) => ({
  data,
  angleField: "value",
  colorField: "label",
  radius: 1,
  innerRadius: 0.6,
  label: {
    type: "inner",
    offset: "-50%",
    content: ({ percent }: { percent: number }) =>
      `${Math.round(percent * 100)}%`
  },
  legend: { position: "bottom" },
  statistic: { title: { content: "" } },
  tooltip: {
    formatter: (item: DistributionItem & { percent: number }) => ({
      name: item.label,
      value: item.value
    })
  }
});

const buildColumnConfig = (data: DistributionItem[]) => ({
  data,
  xField: "label",
  yField: "value",
  columnStyle: { radius: [4, 4, 0, 0] },
  xAxis: {
    label: {
      autoRotate: true
    }
  },
  label: {
    position: "middle",
    style: { fill: "#fff" }
  },
  tooltip: {
    formatter: (item: DistributionItem) => ({
      name: item.label,
      value: item.value
    })
  }
});

const DashboardPage = () => {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<
    DashboardData,
    Error,
    DashboardData,
    [string, string | null, number | null]
  >({
    queryKey: ["dashboard", selectedStatus, selectedProjectId],
    queryFn: async () =>
      (
        await api.get("/dashboard", {
          params: {
            status: selectedStatus ?? undefined,
            projectId: selectedProjectId ?? undefined
          }
        })
      ).data.data
  });

  const loading = isLoading && !data;
  const summaryCards = ensureCards(data?.summaryCards);
  const projectInfo = data?.projectInfo ?? null;
  const statusOptions = data?.statusOptions ?? [];
  const projects = data?.projects ?? [];
  const testCaseFiles = data?.testCaseFiles ?? [];
  const defectFiles = data?.defectFiles ?? [];
  const defectOverview = data?.defectOverview;
  const testCaseSummary = data?.testCaseSummary;

  const statusChartConfig = useMemo(
    () => buildPieConfig(data?.defectOverview.statusDistribution ?? []),
    [data?.defectOverview.statusDistribution]
  );

  const priorityChartConfig = useMemo(
    () => buildColumnConfig(data?.defectOverview.priorityDistribution ?? []),
    [data?.defectOverview.priorityDistribution]
  );

  const severityChartConfig = useMemo(
    () => buildColumnConfig(data?.defectOverview.severityDistribution ?? []),
    [data?.defectOverview.severityDistribution]
  );

  const testCaseStatusConfig = useMemo(
    () => buildColumnConfig(data?.testCaseSummary.statusCounts ?? []),
    [data?.testCaseSummary.statusCounts]
  );

  const testCaseSeverityConfig = useMemo(
    () => buildPieConfig(data?.testCaseSummary.severityCounts ?? []),
    [data?.testCaseSummary.severityCounts]
  );

  const projectInfoCardVisuals = useMemo(() => getGradientCardVisuals(projectInfoTheme), []);
  const defectCardVisuals = useMemo(
    () => defectCardThemes.map((theme) => getGradientCardVisuals(theme)),
    []
  );
  const defectTotalsVisuals = useMemo(() => getGradientCardVisuals(defectTotalsTheme), []);
  const testCardVisuals = useMemo(
    () => testCardThemes.map((theme) => getGradientCardVisuals(theme)),
    []
  );

  const severityIndexColumns = [
    { title: "Severity", dataIndex: "label", key: "label" },
    { title: "Total", dataIndex: "total", key: "total" },
    { title: "Resolved", dataIndex: "resolved", key: "resolved" },
    { title: "Not Resolved", dataIndex: "unresolved", key: "unresolved" },
    { title: "Weight", dataIndex: "weight", key: "weight" },
    {
      title: "Weighted (Open)",
      dataIndex: "unresolvedWeighted",
      key: "unresolvedWeighted"
    }
  ];

  const severityMatrixColumns = [
    { title: "Severity", dataIndex: "severityLabel", key: "severity" },
    { title: "Open", dataIndex: "open", key: "open" },
    { title: "Closed", dataIndex: "closed", key: "closed" },
    { title: "Deferred", dataIndex: "deferred", key: "deferred" }
  ];

  const projectItems = projectInfo
    ? [
        { label: "Project Name", value: projectInfo.name },
        { label: "Project Code", value: projectInfo.code },
        { label: "PM", value: projectInfo.pm ?? "—" },
        { label: "BA", value: projectInfo.ba ?? "—" },
        { label: "QAL", value: projectInfo.qal ?? "—" },
        { label: "Prepared By", value: projectInfo.preparedBy ?? "—" },
        { label: "Date Created", value: humanizeDate(projectInfo.dateCreated) },
        { label: "Access Level", value: projectInfo.accessLevel }
      ]
    : [];

  const projectInfoLoading = loading && !projectInfo;

  useEffect(() => {
    if (
      selectedProjectId !== null &&
      !projects.some((project: ProjectButtonItem) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (
      selectedStatus !== null &&
      !statusOptions.some((option: StatusOption) => option.value === selectedStatus)
    ) {
      setSelectedStatus(null);
    }
  }, [statusOptions, selectedStatus]);

  const handleStatusSelect = (value: string | null) => {
    setSelectedStatus(value);
    setSelectedProjectId(null);
  };

  const handleProjectSelect = (projectId: number | null) => {
    setSelectedProjectId(projectId);
  };

  const handleFileSelect = (file: FilePanelItem) => {
    if (file.projectId) {
      setSelectedProjectId(file.projectId);
    }
    if (file.projectStatus) {
      setSelectedStatus(file.projectStatus);
    }
  };

  const totalStatusProjects = statusOptions.reduce(
    (acc: number, option: StatusOption) => acc + option.count,
    0
  );

  const defectTotals = defectOverview?.totals;

  const severityIndexData: SeverityBreakdownItem[] =
    defectOverview?.severityIndex.breakdown ?? [];
  const severityMatrixData: SeverityMatrixRow[] = defectOverview?.matrix ?? [];

  const statusSummaryRows: Array<{ key: string; label: string; value: number }> = testCaseSummary
    ? [
        { key: "passed", label: "Pass", value: testCaseSummary.totals.passed },
        { key: "failed", label: "Fail", value: testCaseSummary.totals.failed },
        { key: "on_hold", label: "On Hold", value: testCaseSummary.totals.onHold },
        { key: "blocked", label: "Blocked", value: testCaseSummary.totals.blocked },
        { key: "not_executed", label: "Not Executed", value: testCaseSummary.totals.notExecuted },
        { key: "not_applicable", label: "Not Applicable", value: testCaseSummary.totals.notApplicable },
        { key: "total", label: "Total Test Cases", value: testCaseSummary.totals.total }
      ]
    : [];

  const statusCardTheme = defectCardThemes[0];
  const statusCardVisuals = defectCardVisuals[0];
  const priorityCardTheme = defectCardThemes[1];
  const priorityCardVisuals = defectCardVisuals[1];
  const severityCardTheme = defectCardThemes[2];
  const severityCardVisuals = defectCardVisuals[2];
  const dsiCardTheme = defectCardThemes[3];
  const dsiCardVisuals = defectCardVisuals[3];
  const defectStatusCardTheme = defectCardThemes[4];
  const defectStatusCardVisuals = defectCardVisuals[4];

  const testSummaryTheme = testCardThemes[0];
  const testSummaryVisuals = testCardVisuals[0];
  const testStatusTheme = testCardThemes[1];
  const testStatusVisuals = testCardVisuals[1];
  const testSeverityTheme = testCardThemes[2];
  const testSeverityVisuals = testCardVisuals[2];

  const getStatisticPrecision = (card: SummaryCard) => {
    if (card.unit === "%") return 1;
    if (card.key === "defect_resolution_time") return 1;
    return 0;
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section>
        <Card bordered={false} style={filterCardStyle} bodyStyle={filterCardBodyStyle}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Title level={4} style={filterHeadingStyle}>
                Status (Project)
              </Title>
              <Space wrap style={pillSpaceStyle} size={[12, 12]}>
                <Button
                  type="default"
                  shape="round"
                  size="large"
                  style={getStatusButtonStyles("all", selectedStatus === null)}
                  onClick={() => handleStatusSelect(null)}
                >
                  All Statuses ({totalStatusProjects})
                </Button>
                {statusOptions.map((option) => {
                  const isActive = selectedStatus === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="default"
                      shape="round"
                      size="large"
                      style={getStatusButtonStyles(option.value, isActive)}
                      onClick={() => handleStatusSelect(option.value)}
                    >
                      {option.label} ({option.count})
                    </Button>
                  );
                })}
              </Space>
            </div>

            <div>
              <Title level={4} style={filterHeadingStyle}>
                Projects Available
              </Title>
              {projects.length ? (
                <Space wrap style={pillSpaceStyle} size={[12, 12]}>
                  <Button
                    type="default"
                    shape="round"
                    size="large"
                    style={getProjectButtonStyles(selectedProjectId === null)}
                    onClick={() => handleProjectSelect(null)}
                  >
                    All Projects ({projects.length})
                  </Button>
                  {projects.map((project) => (
                    <Button
                      key={project.id}
                      type="default"
                      shape="round"
                      size="large"
                      style={getProjectButtonStyles(selectedProjectId === project.id)}
                      onClick={() => handleProjectSelect(project.id)}
                    >
                      {project.name}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No projects" />
              )}
            </div>

            <div>
              <Title level={4} style={filterHeadingStyle}>
                Test Case Files
              </Title>
              {testCaseFiles.length ? (
                <Space wrap style={pillSpaceStyle} size={[10, 10]}>
                  {testCaseFiles.map((file) => (
                    <Button
                      key={`testCaseFile-${file.id}`}
                      type="default"
                      shape="round"
                      size="middle"
                      style={getFileButtonStyles(false)}
                      onClick={() => handleFileSelect(file)}
                    >
                      {file.name}
                      {file.projectName ? ` · ${file.projectName}` : ""}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No test case files" />
              )}
            </div>

            <div>
              <Title level={4} style={filterHeadingStyle}>
                Defect Files
              </Title>
              {defectFiles.length ? (
                <Space wrap style={pillSpaceStyle} size={[10, 10]}>
                  {defectFiles.map((file) => (
                    <Button
                      key={`defectFile-${file.id}`}
                      type="default"
                      shape="round"
                      size="middle"
                      style={getFileButtonStyles(false)}
                      onClick={() => handleFileSelect(file)}
                    >
                      {file.name}
                      {file.projectName ? ` · ${file.projectName}` : ""}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No defect files" />
              )}
            </div>
          </Space>
        </Card>
      </section>

      <section>
        <Title level={3} style={sectionTitleStyle}>
          Delivery Snapshot
        </Title>
        <Row gutter={[16, 16]}>
          {summaryCards.map((card, index) => {
            const palette = summaryPalettes[index % summaryPalettes.length];
            const cardStyle: CSSProperties = card.isPlaceholder
              ? glassCardStyle
              : {
                  ...glassCardStyle,
                  background: palette.background,
                  boxShadow: palette.shadow,
                  color: palette.value
                };

            return (
              <Col key={card.key} xs={24} sm={12} md={8} lg={6} xl={4} xxl={4}>
                <Card
                  hoverable
                  bordered={false}
                  style={cardStyle}
                  bodyStyle={{ padding: 24 }}
                  loading={loading && card.isPlaceholder}
                >
                  {!card.isPlaceholder && (
                    <Statistic
                      title={<span style={{ color: palette.title }}>{card.title}</span>}
                      value={card.value}
                      precision={getStatisticPrecision(card)}
                      suffix={card.unit}
                      valueStyle={{ color: palette.value }}
                    />
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </section>

      <section>
        <Title level={3} style={sectionTitleStyle}>
          Project Information
        </Title>
        <Card
          bordered={false}
          loading={projectInfoLoading}
          style={projectInfoCardVisuals.style}
          bodyStyle={projectInfoCardVisuals.bodyStyle}
        >
          {projectItems.length ? (
            <Descriptions bordered column={{ xs: 1, sm: 2, lg: 4 }} size="small">
              {projectItems.map((item) => (
                <Descriptions.Item
                  key={item.label}
                  label={item.label}
                  span={1}
                >
                  {item.value ?? "—"}
                </Descriptions.Item>
              ))}
            </Descriptions>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No project data" />
          )}
        </Card>
      </section>

      <section>
        <Title level={3} style={sectionTitleStyle}>
          Defect Metrics
        </Title>
        <Text type="secondary">
          Update as of {humanizeDate(data?.updatedAt)}
        </Text>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={8}>
            <Card
              title="Defect count by status"
              bordered={false}
              loading={loading}
              style={statusCardVisuals.style}
              headStyle={statusCardVisuals.headStyle}
              bodyStyle={statusCardVisuals.bodyStyle}
            >
              {defectOverview && defectOverview.statusDistribution.length ? (
                <Pie {...statusChartConfig} height={260} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card
              title="Defect count by priority"
              bordered={false}
              loading={loading}
              style={priorityCardVisuals.style}
              headStyle={priorityCardVisuals.headStyle}
              bodyStyle={priorityCardVisuals.bodyStyle}
            >
              {defectOverview && defectOverview.priorityDistribution.length ? (
                <Column {...priorityChartConfig} height={260} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card
              title="Defect count by severity"
              bordered={false}
              loading={loading}
              style={severityCardVisuals.style}
              headStyle={severityCardVisuals.headStyle}
              bodyStyle={severityCardVisuals.bodyStyle}
            >
              {defectOverview && defectOverview.severityDistribution.length ? (
                <Column {...severityChartConfig} height={260} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={12}>
            <Card
              bordered={false}
              title="Derived Severity Index (DSI)"
              loading={loading}
              style={dsiCardVisuals.style}
              headStyle={dsiCardVisuals.headStyle}
              bodyStyle={dsiCardVisuals.bodyStyle}
            >
              {defectOverview ? (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Statistic
                    title={<span style={{ color: dsiCardTheme.head }}>Severity Index</span>}
                    value={defectOverview.severityIndex.value}
                    precision={3}
                    valueStyle={{ color: dsiCardTheme.accent }}
                  />
                  <Text style={{ color: dsiCardTheme.text, opacity: 0.78 }}>
                    {defectOverview.severityIndex.interpretation}
                  </Text>
                  <Table
                    size="small"
                    pagination={false}
                    columns={severityIndexColumns}
                    dataSource={severityIndexData.map((item: SeverityBreakdownItem) => ({
                      ...item
                    }))}
                    style={{ background: "transparent", color: dsiCardTheme.text }}
                  />
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card
              bordered={false}
              title="Defects by status"
              loading={loading}
              style={defectStatusCardVisuals.style}
              headStyle={defectStatusCardVisuals.headStyle}
              bodyStyle={defectStatusCardVisuals.bodyStyle}
            >
              {defectOverview ? (
                <Table
                  size="small"
                  pagination={false}
                  columns={severityMatrixColumns}
                  dataSource={severityMatrixData.map((row) => ({
                    key: row.severityKey,
                    ...row
                  }))}
                  style={{ background: "transparent", color: defectStatusCardTheme.text }}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>

        {defectTotals && (
          <Card
            bordered={false}
            style={{ ...defectTotalsVisuals.style, marginTop: 16 }}
            bodyStyle={defectTotalsVisuals.bodyStyle}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Statistic
                  title={<span style={{ color: defectTotalsTheme.head }}>Total</span>}
                  value={defectTotals.total}
                  valueStyle={{ color: defectTotalsTheme.accent }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={<span style={{ color: defectTotalsTheme.head }}>Open</span>}
                  value={defectTotals.open}
                  valueStyle={{ color: defectTotalsTheme.accent }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={<span style={{ color: defectTotalsTheme.head }}>Resolved</span>}
                  value={defectTotals.resolved}
                  valueStyle={{ color: defectTotalsTheme.accent }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={<span style={{ color: defectTotalsTheme.head }}>Reopened</span>}
                  value={defectTotals.reopened}
                  valueStyle={{ color: defectTotalsTheme.accent }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={<span style={{ color: defectTotalsTheme.head }}>In Progress</span>}
                  value={defectTotals.inProgress}
                  valueStyle={{ color: defectTotalsTheme.accent }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={<span style={{ color: defectTotalsTheme.head }}>Deferred</span>}
                  value={defectTotals.deferred}
                  valueStyle={{ color: defectTotalsTheme.accent }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title={<span style={{ color: defectTotalsTheme.head }}>Rejected</span>}
                  value={defectTotals.rejected}
                  valueStyle={{ color: defectTotalsTheme.accent }}
                />
              </Col>
            </Row>
          </Card>
        )}
      </section>

      <section>
        <Title level={3} style={sectionTitleStyle}>
          Test Cases
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title="Test Cases Summary"
              bordered={false}
              loading={loading}
              style={testSummaryVisuals.style}
              headStyle={testSummaryVisuals.headStyle}
              bodyStyle={testSummaryVisuals.bodyStyle}
            >
              {testCaseSummary ? (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Author">
                      {testCaseSummary.meta?.author ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Date Created">
                      {humanizeDate(testCaseSummary.meta?.createdAt)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Updated">
                      {humanizeDate(testCaseSummary.meta?.updatedAt)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Version">
                      {testCaseSummary.meta?.version ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Environment">
                      {testCaseSummary.meta?.environment ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Release/Build">
                      {testCaseSummary.meta?.release ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Refer">
                      {testCaseSummary.meta?.refer ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Project">
                      {testCaseSummary.meta?.project ?? "—"}
                    </Descriptions.Item>
                  </Descriptions>
                  <Divider plain>Execution Summary</Divider>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title={<span style={{ color: testSummaryTheme.head }}>Pass Rate</span>}
                        value={testCaseSummary.totals.passRate}
                        precision={1}
                        suffix="%"
                        valueStyle={{ color: testSummaryTheme.accent }}
                      />
                    </Col>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title={<span style={{ color: testSummaryTheme.head }}>Executed</span>}
                        value={testCaseSummary.totals.executed}
                        valueStyle={{ color: testSummaryTheme.accent }}
                      />
                    </Col>
                  </Row>
                  <Table
                    size="small"
                    pagination={false}
                    columns={[
                      { title: "Status", dataIndex: "label", key: "label" },
                      { title: "Count", dataIndex: "value", key: "value" }
                    ]}
                    dataSource={statusSummaryRows}
                    style={{ background: "transparent", color: testSummaryTheme.text }}
                  />
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <Card
                title="Test Cases by status"
                bordered={false}
                loading={loading}
                style={testStatusVisuals.style}
                headStyle={testStatusVisuals.headStyle}
                bodyStyle={testStatusVisuals.bodyStyle}
              >
                {testCaseSummary && testCaseSummary.statusCounts.length ? (
                  <Column {...testCaseStatusConfig} height={260} />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
              <Card
                title="Test Cases by severity"
                bordered={false}
                loading={loading}
                style={testSeverityVisuals.style}
                headStyle={testSeverityVisuals.headStyle}
                bodyStyle={testSeverityVisuals.bodyStyle}
              >
                {testCaseSummary && testCaseSummary.severityCounts.length ? (
                  <Pie {...testCaseSeverityConfig} height={260} />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Space>
          </Col>
        </Row>
      </section>
    </Space>
  );
};

export default DashboardPage;
