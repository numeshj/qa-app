import { Alert } from 'antd';
import { useSystem } from '../store/system';
import React from 'react';

export const OfflineBanner: React.FC = () => {
  const { backendOnline, lastCheck } = useSystem();
  if (backendOnline) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 4000 }}>
      <Alert
        type='error'
        banner
        message={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 16 }}>
            <span>Backend API unreachable (connection refused). Retrying in background...</span>
            {lastCheck && <span style={{ fontSize: 11, opacity: 0.8 }}>Last check: {new Date(lastCheck).toLocaleTimeString()}</span>}
          </div>
        }
        style={{ borderRadius: 0 }}
      />
    </div>
  );
};
