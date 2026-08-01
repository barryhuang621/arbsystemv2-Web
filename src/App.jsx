import React, { useState } from 'react';

export default function App() {
  const [isQuoteConnected, setIsQuoteConnected] = useState(false);
  const [restApiCmd, setRestApiCmd] = useState('');
  const [wssCmd, setWssCmd] = useState('');

  const handleConnectQuote = () => {
    setIsQuoteConnected(!isQuoteConnected);
  };

  const handleRestApiConfirm = () => {
    if (!restApiCmd.trim()) return;
    alert(`送出 RESTAPI 指令: ${restApiCmd}`);
  };

  const handleWssConfirm = () => {
    if (!wssCmd.trim()) return;
    alert(`送出 WSS 指令: ${wssCmd}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b0f19',
      color: '#f8fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 頁首標題列 */}
      <header className="glass-panel" style={{
        margin: '16px',
        padding: '14px 24px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #334155',
        borderRadius: '12px'
      }}>
        <div style={{
          fontSize: '1.4rem',
          fontWeight: '700',
          color: '#38bdf8',
          letterSpacing: '0.5px'
        }}>
          ⚡ 富邦新一代 API 網頁自動交易系統
        </div>

        {/* 最右側：連接報價系統按鈕 */}
        <button
          onClick={handleConnectQuote}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.9rem',
            backgroundColor: isQuoteConnected ? '#16a34a' : '#0284c7',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: isQuoteConnected ? '0 0 12px rgba(22, 163, 74, 0.4)' : '0 0 12px rgba(2, 132, 199, 0.4)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isQuoteConnected ? '#86efac' : '#e0f2fe',
            display: 'inline-block'
          }}></span>
          {isQuoteConnected ? '報價系統已連接' : '連接報價系統'}
        </button>
      </header>

      {/* 主要區域：劃分為 左側主內容與右側 15% 測試區塊 */}
      <div style={{
        flex: 1,
        display: 'flex',
        padding: '0 16px 16px 16px',
        gap: '16px'
      }}>
        {/* 左側主區域 (約 85% 寬度) */}
        <main style={{
          flex: '1 1 85%',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '12px',
          border: '1px dashed #334155',
          display: 'flex',
          justify: 'center',
          alignItems: 'center',
          color: '#475569',
          fontSize: '1.1rem'
        }}>
          主交易系統內容區域
        </main>

        {/* 右側測試區塊 (約 15% 寬度) */}
        <aside className="glass-panel" style={{
          flex: '0 0 15%',
          minWidth: '240px',
          padding: '18px',
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #334155',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{
            fontSize: '1rem',
            fontWeight: '700',
            color: '#f8fafc',
            borderBottom: '1px solid #334155',
            paddingBottom: '10px'
          }}>
            🧪 測試控制台
          </div>

          {/* RESTAPI Command 輸入與按鈕 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>
              RESTAPI Command
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={restApiCmd}
                onChange={(e) => setRestApiCmd(e.target.value)}
                placeholder="輸入 RESTAPI 指令"
                style={{
                  flex: 1,
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleRestApiConfirm}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                確認
              </button>
            </div>
          </div>

          {/* WSS Command 輸入與按鈕 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>
              WSS Command
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={wssCmd}
                onChange={(e) => setWssCmd(e.target.value)}
                placeholder="輸入 WSS 指令"
                style={{
                  flex: 1,
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleWssConfirm}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                確認
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
