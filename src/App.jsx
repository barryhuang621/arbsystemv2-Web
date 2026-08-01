import React, { useState } from 'react';

export default function App() {
  const [nasHost, setNasHost] = useState('192.168.0.113:8000');
  const [isQuoteConnected, setIsQuoteConnected] = useState(false);
  const [restApiCmd, setRestApiCmd] = useState('');
  const [wssCmd, setWssCmd] = useState('');
  const [openApiUrl, setOpenApiUrl] = useState('https://openapi.taifex.com.tw/v1/SSFLists');
  const [apiResponse, setApiResponse] = useState(null);

  // 交易與套利計算參數 (可自由調整)
  const [stockFeeRate, setStockFeeRate] = useState('0.001425'); // 股票券商手續費 (0.1425%)
  const [brokerDiscount, setBrokerDiscount] = useState('0.7');    // 券商退傭乘數 (7折)
  const [stockTaxRate, setStockTaxRate] = useState('0.003');     // 證交稅 (0.3%)
  const [futuresFee, setFuturesFee] = useState('18');           // 期貨交易手續費 (元)
  const [minStockPrice, setMinStockPrice] = useState('90');     // 最小股價
  const [maxStockPrice, setMaxStockPrice] = useState('150');    // 最大股價
  const [quoteMarket, setQuoteMarket] = useState('TSE');        // 市場別快照: TSE 上市; OTC 上櫃; ESB 興櫃; TIB 創新板; PSB 戰略板

  // 取得完整的 API Base URL
  const getApiBaseUrl = () => {
    const cleanHost = nasHost.trim();
    if (!cleanHost) return 'http://192.168.0.113:8000';
    return cleanHost.startsWith('http://') || cleanHost.startsWith('https://')
      ? cleanHost
      : `http://${cleanHost}`;
  };

  // 1. 確認連線狀態 (GET /api/v1/fubon/verify)
  const handleVerifyConnection = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/fubon/verify`);
      const data = await res.json();
      setApiResponse(data);
      setIsQuoteConnected(data.is_connected || false);
    } catch (err) {
      console.error('無法取得連線狀態:', err);
      setIsQuoteConnected(false);
    }
  };

  // 2. 連線 / 中斷報價系統 (connect / disconnect)
  const handleConnectQuote = async () => {
    const baseUrl = getApiBaseUrl();
    const endpoint = isQuoteConnected ? '/api/v1/fubon/disconnect' : '/api/v1/fubon/connect';

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST'
      });
      const data = await res.json();
      setApiResponse(data);

      if (isQuoteConnected) {
        // 中斷連線
        setIsQuoteConnected(false);
        alert(`中斷連線成功！(目標: ${baseUrl})\n${data.message || ''}`);
      } else {
        // 建立連線
        if (data.status === 'success' || data.is_connected) {
          setIsQuoteConnected(true);
          alert(`連線成功！(目標: ${baseUrl})\n${data.message || ''}`);
        } else {
          alert(`連線失敗: ${data.detail || JSON.stringify(data)}`);
        }
      }
    } catch (err) {
      console.error('與 NAS 通訊失敗:', err);
      alert(`與 NAS 通訊失敗 (${baseUrl})，請確認 NAS 服務與 IP:Port 是否正確`);
    }
  };

  // 3. 測試控制台發送自訂 REST API 指令
  const handleRestApiConfirm = async () => {
    if (!restApiCmd.trim()) return;
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: restApiCmd.trim() })
      });
      const data = await res.json();
      setApiResponse(data);
      alert(`指令 [${restApiCmd}] 回傳結果:\n` + JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('發送指令失敗:', err);
      alert(`發送指令 [${restApiCmd}] 失敗: ` + err.message);
    }
  };

  const handleWssConfirm = () => {
    if (!wssCmd.trim()) return;
    alert(`送出 WSS 指令: ${wssCmd}`);
  };

  // 4. OpenAPI 指令 (由 NAS 中繼站向外網存取並回傳給 Web UI)
  const handleOpenApiConfirm = async () => {
    if (!openApiUrl.trim()) return;
    const targetUrl = openApiUrl.trim();
    const baseUrl = getApiBaseUrl();
    console.log(`[Web UI] 向 NAS 中繼站發送 OpenAPI 請求指令: ${targetUrl}`);

    try {
      // 指令直接送給 NAS 中繼站 (/api/v1/fubon/openapi)
      const res = await fetch(`${baseUrl}/api/v1/fubon/openapi?url=${encodeURIComponent(targetUrl)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error ${res.status}`);
      }
      const data = await res.json();
      setApiResponse(data);

      console.log('%c==================================================', 'color: #38bdf8; font-weight: bold;');
      console.log(`%c🎉 NAS 中繼站成功抓取 OpenAPI 回傳資料！`, 'color: #4ade80; font-size: 1.1rem; font-weight: bold;');
      console.log(`📌 目標網址: ${targetUrl}`);
      console.log(`🌐 中繼站: ${baseUrl}`);
      console.log(`📊 回傳資料筆數/結構:`, Array.isArray(data) ? `${data.length} 筆` : typeof data);
      console.log('📦 完整 JSON 內容如下:');
      console.dir(data);
      console.log('%c==================================================', 'color: #38bdf8; font-weight: bold;');

      const countInfo = Array.isArray(data) ? `(共 ${data.length} 筆資料)` : '';
      alert(`NAS 中繼站已成功抓取資料 ${countInfo}！\n目標網址: ${targetUrl}\n\n詳細內容已完整列印在 Chrome Console 視窗中 (請按 F12 查看)`);
    } catch (err) {
      console.error('❌ NAS 中繼站抓取 OpenAPI 失敗:', err);
      alert(`NAS 中繼站抓取 OpenAPI 失敗: ${err.message}`);
    }
  };

  // 5. 富邦 API 股票行情快照 (snapshot/quotes/{market}) 查詢
  const handleSnapshotQuotesConfirm = async () => {
    const market = quoteMarket.trim().toUpperCase() || 'TSE';
    const baseUrl = getApiBaseUrl();
    console.log(`[Web UI] 向 NAS 中繼站發送股票市場行情快照 (snapshot/quotes/${market}) 指令`);

    try {
      const res = await fetch(`${baseUrl}/api/v1/fubon/snapshot/quotes/${encodeURIComponent(market)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error ${res.status}`);
      }
      const data = await res.json();
      setApiResponse(data);

      console.log('%c==================================================', 'color: #38bdf8; font-weight: bold;');
      console.log(`%c⚡ 富邦股票市場行情快照 (Snapshot Quotes) 成功取得！`, 'color: #4ade80; font-size: 1.1rem; font-weight: bold;');
      console.log(`📌 市場別 (market): ${market}`);
      console.log(`🌐 NAS 中繼站: ${baseUrl}`);
      console.log('📦 完整行情快照 JSON 資料如下:');
      console.dir(data);
      console.log('%c==================================================', 'color: #38bdf8; font-weight: bold;');

      alert(`已成功取得 [${market}] 市場行情快照資料！\n\n詳細內容已完整列印在 Chrome Console 視窗中 (請按 F12 查看)`);
    } catch (err) {
      console.error('❌ 取得市場行情快照失敗:', err);
      alert(`取得市場行情快照失敗: ${err.message}`);
    }
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
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #334155',
        borderRadius: '12px'
      }}>
        {/* 左側：系統標題 */}
        <div style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#38bdf8',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap'
        }}>
          ⚡ 富邦新一代 API 網頁自動交易系統
        </div>

        {/* 中間：4 個交易與套利參數 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '6px 14px'
        }}>
          {/* 1. 股票券商手續費 (比例) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap' }}>
              手續費:
            </span>
            <input
              type="number"
              step="0.000001"
              value={stockFeeRate}
              onChange={(e) => setStockFeeRate(e.target.value)}
              title="股票券商手續費(比例)"
              style={{
                width: '85px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                color: '#38bdf8',
                fontSize: '0.85rem',
                fontWeight: '600',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          {/* 2. 券商退傭乘數 (比例) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap' }}>
              退傭:
            </span>
            <input
              type="number"
              step="0.01"
              value={brokerDiscount}
              onChange={(e) => setBrokerDiscount(e.target.value)}
              title="券商退傭乘數(比例)"
              style={{
                width: '60px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                color: '#38bdf8',
                fontSize: '0.85rem',
                fontWeight: '600',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          {/* 3. 證交稅 (比例) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap' }}>
              證交稅:
            </span>
            <input
              type="number"
              step="0.0001"
              value={stockTaxRate}
              onChange={(e) => setStockTaxRate(e.target.value)}
              title="證交稅(比例)"
              style={{
                width: '70px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                color: '#38bdf8',
                fontSize: '0.85rem',
                fontWeight: '600',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          {/* 4. 期貨交易手續費 (元) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap' }}>
              期費:
            </span>
            <input
              type="number"
              step="1"
              value={futuresFee}
              onChange={(e) => setFuturesFee(e.target.value)}
              title="期貨交易手續費(元)"
              style={{
                width: '55px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                color: '#38bdf8',
                fontSize: '0.85rem',
                fontWeight: '600',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          {/* 5. 股價區間: [ minStockPrice ] <= 股價 <= [ maxStockPrice ] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', borderLeft: '1px solid #334155', paddingLeft: '10px' }}>
            <input
              type="number"
              step="1"
              value={minStockPrice}
              onChange={(e) => setMinStockPrice(e.target.value)}
              title="最小股價"
              style={{
                width: '55px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 6px',
                color: '#38bdf8',
                fontSize: '0.85rem',
                fontWeight: '600',
                fontFamily: 'monospace',
                textAlign: 'center',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap' }}>
              &lt;= 股價 &lt;=
            </span>
            <input
              type="number"
              step="1"
              value={maxStockPrice}
              onChange={(e) => setMaxStockPrice(e.target.value)}
              title="最大股價"
              style={{
                width: '55px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 6px',
                color: '#38bdf8',
                fontSize: '0.85rem',
                fontWeight: '600',
                fontFamily: 'monospace',
                textAlign: 'center',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 最右側：NAS IP:Port 輸入框與連線報價系統按鈕 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '6px 12px'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap' }}>
              🌐 NAS 位址:
            </span>
            <input
              type="text"
              value={nasHost}
              onChange={(e) => setNasHost(e.target.value)}
              placeholder="localhost:8000"
              style={{
                width: '180px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.9rem',
                fontWeight: '600',
                outline: 'none',
                fontFamily: 'monospace'
              }}
            />
          </div>

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
              gap: '8px',
              whiteSpace: 'nowrap'
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
        </div>
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

          {/* 通用 OpenAPI REST API 輸入與按鈕 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>
              OpenAPI Command
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={openApiUrl}
                onChange={(e) => setOpenApiUrl(e.target.value)}
                placeholder="輸入任何 OpenAPI REST API URL"
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
                onClick={handleOpenApiConfirm}
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

          {/* 富邦 API 股票行情快照 (snapshot/quotes/{market}) 輸入與按鈕 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>
              股票行情快照 (市場別)
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={quoteMarket}
                onChange={(e) => setQuoteMarket(e.target.value)}
                placeholder="市場別 (TSE, OTC, ESB, TIB, PSB)"
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
                onClick={handleSnapshotQuotesConfirm}
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
                行情快照
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
