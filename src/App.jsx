import React from 'react';

export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b0f19',
      color: '#f8fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      {/* 頁首標題列 */}
      <header className="glass-panel" style={{
        margin: '16px',
        padding: '16px 24px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #334155',
        borderRadius: '12px'
      }}>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#38bdf8',
          letterSpacing: '0.5px'
        }}>
          ⚡ 富邦新一代 API 網頁自動交易系統
        </div>
      </header>
    </div>
  );
}
