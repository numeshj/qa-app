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
    queryFn: async () => (await api.get("/dashboard")).data.data
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
