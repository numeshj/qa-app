import { Card, Col, Row, Statistic } from "antd";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface DashboardData {
  projects: number;
  testCases: number;
  defects: number;
  openDefects: number;
}

const DashboardPage = () => {
  const { data } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [projects, testCases, defects] = await Promise.all([
        api.get("/projects"),
        api.get("/test-cases"),
        api.get("/defects")
      ]);
      return {
        projects: projects.data.pagination?.total ?? projects.data.data.length,
        testCases: testCases.data.pagination?.total ?? testCases.data.data.length,
        defects: defects.data.pagination?.total ?? defects.data.data.length,
        openDefects: (defects.data.data || []).filter((d: any) => d.status === 'open').length
      };
    }
  });

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}><Card><Statistic title="Projects" value={data?.projects ?? 0} /></Card></Col>
      <Col xs={24} sm={12} md={6}><Card><Statistic title="Test Cases" value={data?.testCases ?? 0} /></Card></Col>
      <Col xs={24} sm={12} md={6}><Card><Statistic title="Defects" value={data?.defects ?? 0} /></Card></Col>
      <Col xs={24} sm={12} md={6}><Card><Statistic title="Open Defects" value={data?.openDefects ?? 0} /></Card></Col>
    </Row>
  );
};

export default DashboardPage;
