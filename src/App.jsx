import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('quote');
  const [symbol, setSymbol] = useState('2330');
  const [quoteData, setQuoteData] = useState({
    name: '台積電',
    symbol: '2330',
    price: 965.0,
    change: +15.0,
    changePercent: +1.58,
    high: 970.0,
    low: 955.0,
    volume: 38420,
    time: '13:30:00'
  });

  const [orderType, setOrderType] = useState('BUY'); // BUY / SELL
  const [orderCategory, setOrderCategory] = useState('LIMIT'); // LIMIT / MARKET / TPSL
  const [orderPrice, setOrderPrice] = useState(965.0);
  const [orderQty, setOrderQty] = useState(1);
  const [apiConnected, setApiConnected] = useState(true);

  // 五檔委託資料 Mock
  const depthData = {
    asks: [
      { price: 966.0, qty: 142 },
      { price: 967.0, qty: 320 },
      { price: 968.0, qty: 512 },
      { price: 969.0, qty: 810 },
      { price: 970.0, qty: 1250 }
    ].reverse(),
    bids: [
      { price: 965.0, qty: 420 },
      { price: 964.0, qty: 610 },
      { price: 963.0, qty: 890 },
      { price: 962.0, qty: 1100 },
      { price: 961.0, qty: 1450 }
    ]
  };

  // 持股庫存 Mock
  const positions = [
    { symbol: '2330', name: '台積電', qty: 2000, avgPrice: 920.0, currentPrice: 965.0, pnl: +90000, ratio: +4.89 },
    { symbol: '2454', name: '聯發科', qty: 1000, avgPrice: 1250.0, currentPrice: 1280.0, pnl: +30000, ratio: +2.40 },
    { symbol: 'TXF08', name: '台指期 08', qty: 1, avgPrice: 22100, currentPrice: 22250, pnl: +30000, ratio: +0.68 }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 頂部導覽列 */}
      <header className="glass-panel" style={{ margin: '12px 16px 0 16px', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#38bdf8', letterSpacing: '0.5px' }}>
            ⚡ 富邦新一代 API 網頁自動交易系統
          </div>
          <span className={`badge-status ${apiConnected ? 'badge-connected' : 'badge-connecting'}`}>
            <span className="dot-pulse"></span>
            {apiConnected ? '富邦 API 已建立連線' : 'API 連線中...'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.875rem', color: '#94a3b8' }}>
          <div>交易帳號：<span style={{ color: '#f8fafc', fontWeight: '600' }}>8450-982**** (證券)</span></div>
          <div>盤中即時報價</div>
        </div>
      </header>

      {/* 主選單 Tab */}
      <nav style={{ padding: '12px 16px', display: 'flex', gap: '12px' }}>
        {[
          { id: 'quote', label: '📊 即時行情與五檔' },
          { id: 'order', label: '📝 下單與條件單設定' },
          { id: 'inventory', label: '💼 帳務與庫存部位' },
          { id: 'settings', label: '⚙️ Fubon API 金鑰設定' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.9rem',
              backgroundColor: activeTab === tab.id ? '#0284c7' : '#1e293b',
              color: activeTab === tab.id ? '#ffffff' : '#94a3b8',
              boxShadow: activeTab === tab.id ? '0 4px 12px rgba(2, 132, 199, 0.4)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 主要內容區 */}
      <main style={{ flex: 1, padding: '0 16px 16px 16px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
        
        {/* 左側主要面板 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 行情與股票搜尋 */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="輸入代碼 (如 2330)"
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    width: '180px'
                  }}
                />
                <div style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                  {quoteData.name} ({quoteData.symbol})
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className={quoteData.change >= 0 ? 'text-up' : 'text-down'} style={{ fontSize: '1.8rem', fontWeight: '800' }}>
                  NT$ {quoteData.price.toFixed(1)}
                  <span style={{ fontSize: '1rem', marginLeft: '8px' }}>
                    {quoteData.change >= 0 ? '▲' : '▼'} {quoteData.change} ({quoteData.changePercent}%)
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  最高: {quoteData.high} | 最低: {quoteData.low} | 成交量: {quoteData.volume.toLocaleString()} 張
                </div>
              </div>
            </div>

            {/* K 線圖模擬區域 */}
            <div style={{
              height: '240px',
              backgroundColor: '#0b0f19',
              borderRadius: '8px',
              border: '1px dashed #334155',
              display: 'flex',
              justify: 'center',
              alignItems: 'center',
              color: '#64748b',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div>📈 富邦即時 K 線圖 (分 K / 日 K 傳輸中)</div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>已訂閱 WebSocket 頻道：MarketData.Candles / Aggregates</div>
            </div>
          </div>

          {/* 帳務與庫存明細 (Tab=inventory 時著重，預設亦顯示) */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '14px', fontSize: '1.1rem', color: '#38bdf8' }}>💼 現有庫存部位與未實現損益</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>商品代號</th>
                  <th style={{ padding: '8px' }}>庫存數量</th>
                  <th style={{ padding: '8px' }}>成交均價</th>
                  <th style={{ padding: '8px' }}>當前現價</th>
                  <th style={{ padding: '8px' }}>未實現損益</th>
                  <th style={{ padding: '8px' }}>報酬率</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '600' }}>{item.name} ({item.symbol})</td>
                    <td style={{ padding: '10px 8px' }}>{item.qty.toLocaleString()}</td>
                    <td style={{ padding: '10px 8px' }}>{item.avgPrice}</td>
                    <td style={{ padding: '10px 8px' }}>{item.currentPrice}</td>
                    <td className={item.pnl >= 0 ? 'text-up' : 'text-down'} style={{ padding: '10px 8px', fontWeight: '700' }}>
                      {item.pnl >= 0 ? `+${item.pnl.toLocaleString()}` : item.pnl.toLocaleString()}
                    </td>
                    <td className={item.ratio >= 0 ? 'text-up' : 'text-down'} style={{ padding: '10px 8px', fontWeight: '700' }}>
                      {item.ratio >= 0 ? `+${item.ratio}%` : `${item.ratio}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>

        {/* 右側下單與五檔資訊 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 下單控制面板 */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '1.05rem', color: '#f8fafc' }}>⚡ 快速委託下單</h3>
            
            {/* 買賣方向切換 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <button
                onClick={() => setOrderType('BUY')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  backgroundColor: orderType === 'BUY' ? '#ef4444' : '#1e293b',
                  color: '#fff',
                  border: orderType === 'BUY' ? '2px solid #f87171' : '1px solid #334155'
                }}
              >
                買進 (BUY)
              </button>
              <button
                onClick={() => setOrderType('SELL')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  backgroundColor: orderType === 'SELL' ? '#22c55e' : '#1e293b',
                  color: '#fff',
                  border: orderType === 'SELL' ? '2px solid #4ade80' : '1px solid #334155'
                }}
              >
                賣出 (SELL)
              </button>
            </div>

            {/* 委託類型 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>委託種類</label>
              <select
                value={orderCategory}
                onChange={(e) => setOrderCategory(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#fff',
                  padding: '8px',
                  borderRadius: '6px'
                }}
              >
                <option value="LIMIT">限價單 (ROD)</option>
                <option value="MARKET">市價單 (IOC)</option>
                <option value="TPSL">智慧條件單 (停損停利 TPSL)</option>
                <option value="TRAIL">移動鎖利條件單</option>
              </select>
            </div>

            {/* 委託價格 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>委託價格 (NT$)</label>
              <input
                type="number"
                value={orderPrice}
                onChange={(e) => setOrderPrice(Number(e.target.value))}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#fff',
                  padding: '8px',
                  borderRadius: '6px'
                }}
              />
            </div>

            {/* 委託張數 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>委託張數 / 口數</label>
              <input
                type="number"
                value={orderQty}
                onChange={(e) => setOrderQty(Number(e.target.value))}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#fff',
                  padding: '8px',
                  borderRadius: '6px'
                }}
              />
            </div>

            {/* 下單按鈕 */}
            <button
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1rem',
                backgroundColor: orderType === 'BUY' ? '#ef4444' : '#22c55e',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              onClick={() => alert(`已送出富邦 API 委託單：${orderType === 'BUY' ? '買進' : '賣出'} ${symbol} ${orderQty} 張 @ NT$ ${orderPrice}`)}
            >
              送出 {orderType === 'BUY' ? '買進' : '賣出'} 委託
            </button>
          </div>

          {/* 最佳五檔明細 */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '0.95rem', color: '#94a3b8' }}>📊 最佳五檔買賣價量</h4>
            
            {/* 賣檔 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '6px' }}>
              {depthData.asks.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px 8px', fontSize: '0.85rem', backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: '4px' }}>
                  <span className="text-down" style={{ fontWeight: '600' }}>{item.price.toFixed(1)}</span>
                  <span style={{ textAlign: 'right', color: '#cbd5e1' }}>{item.qty}</span>
                </div>
              ))}
            </div>

            <div style={{ height: '1px', backgroundColor: '#334155', margin: '6px 0' }}></div>

            {/* 買檔 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {depthData.bids.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px 8px', fontSize: '0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px' }}>
                  <span className="text-up" style={{ fontWeight: '600' }}>{item.price.toFixed(1)}</span>
                  <span style={{ textAlign: 'right', color: '#cbd5e1' }}>{item.qty}</span>
                </div>
              ))}
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}
