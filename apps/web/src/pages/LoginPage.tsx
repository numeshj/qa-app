import { Button, Card, Form, Input, Typography, Alert } from "antd";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const LoginPage = () => {
  const { login, error } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    const ok = await login(values.email, values.password);
    setLoading(false);
    if (ok) nav("/app");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", padding: 16 }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4} style={{ textAlign: "center" }}>Login</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish} initialValues={{ email: "admin@example.com", password: "password" }}>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Email required" }]}> 
            <Input type="email" autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: "Password required" }]}> 
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button block type="primary" htmlType="submit" loading={loading}>Sign In</Button>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
