import { Button, Card, Form, Input, Typography, Alert } from "antd";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const LoginPage = () => {
  const { login, error } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const devCreds = [
    { label: 'Admin', email: 'admin@example.com', password: 'password' }
  ];

  const onFinish = async (values: any) => {
    setLoading(true);
    const ok = await login(values.email, values.password);
    setLoading(false);
    if (ok) nav("/app");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", padding: 16 }}>
      <Card style={{ width: 420 }}>
        <Typography.Title level={4} style={{ textAlign: "center" }}>Login</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ email: "admin@example.com", password: "password" }}>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: "Email required" }]}> 
                <Input type="email" autoComplete="email" />
              </Form.Item>
              <Form.Item name="password" label="Password" rules={[{ required: true, message: "Password required" }]}> 
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Button block type="primary" htmlType="submit" loading={loading}>Sign In</Button>
            </Form>
          </div>
          <div style={{ width: 140, borderLeft: '1px solid #eee', paddingLeft: 12 }}>
            <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Dev Accounts</Typography.Text>
            {devCreds.map(c => <Button key={c.email} size="small" style={{ display: 'block', width: '100%', marginBottom: 6 }} onClick={() => { form.setFieldsValue({ email: c.email, password: c.password }); }}>
              {c.label}
            </Button>)}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
