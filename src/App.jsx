import React, { useState, useRef, useEffect } from 'react';

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
  const [targetsList, setTargetsList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [contractMonthType, setContractMonthType] = useState('current'); // 'current' (當月) | 'next' (次月)
  const [showNasLog, setShowNasLog] = useState(false); // 控制中繼伺服器 Console 是否顯示報價明細
  const [recordNasLog, setRecordNasLog] = useState(false); // 控制中繼伺服器 是否寫入 JSONL 報價紀錄檔 (預設 false)
  const [onlyPositiveProfit, setOnlyPositiveProfit] = useState(false); // 只顯示正利潤標的 (預設 false)
  const [activeTab, setActiveTab] = useState('short'); // 'short' (期賣套利: 買現貨+賣期貨) | 'long' (期買套利: 賣現貨+買期貨)

  // 計算期貨 5 碼合約代碼後綴 (第4碼月份字母 A~L + 第5碼年份個位數，支援跨年度)
  const getContractSuffix = (type = contractMonthType) => {
    const monthLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1; // 1 ~ 12

    if (type === 'next') {
      if (month === 12) {
        month = 1;
        year += 1; // 跨年度自動加 1 (例如：12月次月為隔年1月)
      } else {
        month += 1;
      }
    }

    const letter = monthLetters[month - 1];
    const yearDigit = String(year).slice(-1);
    return `${letter}${yearDigit}`;
  };

  const wsRef = useRef(null);

  // 取得完整的 API Base URL
  const getApiBaseUrl = () => {
    const cleanHost = nasHost.trim();
    if (!cleanHost) return 'http://192.168.0.113:8000';
    return cleanHost.startsWith('http://') || cleanHost.startsWith('https://')
      ? cleanHost
      : `http://${cleanHost}`;
  };

  // 斷開 Web UI 與 NAS 中繼站的 WebSocket (WSS) 通道
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      console.log('🔌 關閉 Web UI 與 NAS 中繼站的 WebSocket 連線通道');
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // 建立 Web UI 與 NAS 中繼站的即時 WebSocket (WSS) 通道 (按下【連線】按鈕時呼叫)
  const connectWebSocket = () => {
    disconnectWebSocket();
    const cleanHost = nasHost.trim();
    if (!cleanHost) return;

    const hostOnly = cleanHost.replace(/^https?:\/\//, '');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${hostOnly}/ws/fubon`;

    console.log(`[Web UI] 按下連線，正在建立與 NAS 中繼站的即時 WebSocket 通道: ${wsUrl}`);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('%c🟢 已成功建立 NAS 即時 WebSocket 事件通道！', 'color: #4ade80; font-weight: bold;');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'status') {
            console.log('⚡ 收到 NAS 即時 WebSocket 狀態更新:', data);
            const connectedState = !!data.is_connected;
            setIsQuoteConnected(connectedState);
            if (!connectedState) {
              disconnectWebSocket();
            }
          } else if (data.type === 'quote_update') {
            // 2.1 高頻局部更新：收到報價與雙向套利試算時，透過 React State 進行 O(1) 尋找與覆寫
            setTargetsList(prevList => {
              const newList = [...prevList];
              const idx = newList.findIndex(item => item.StockCode === data.StockCode);
              if (idx !== -1) {
                newList[idx] = {
                  ...newList[idx],
                  stockAskPrice: data.stockAskPrice !== undefined ? data.stockAskPrice : newList[idx].stockAskPrice,
                  stockAskVol: data.stockAskVol !== undefined ? data.stockAskVol : newList[idx].stockAskVol,
                  stockBidPrice: data.stockBidPrice !== undefined ? data.stockBidPrice : newList[idx].stockBidPrice,
                  stockBidVol: data.stockBidVol !== undefined ? data.stockBidVol : newList[idx].stockBidVol,

                  futBidPrice: data.futBidPrice !== undefined ? data.futBidPrice : newList[idx].futBidPrice,
                  futBidVol: data.futBidVol !== undefined ? data.futBidVol : newList[idx].futBidVol,
                  futAskPrice: data.futAskPrice !== undefined ? data.futAskPrice : newList[idx].futAskPrice,
                  futAskVol: data.futAskVol !== undefined ? data.futAskVol : newList[idx].futAskVol,

                  // 期賣套利數據 (Short)
                  short_spread: data.short_spread !== undefined ? data.short_spread : (data.spreadValue !== undefined ? data.spreadValue : newList[idx].short_spread),
                  short_profit: data.short_profit !== undefined ? data.short_profit : (data.profitAmount !== undefined ? data.profitAmount : newList[idx].short_profit),
                  short_total_investment: data.short_total_investment !== undefined ? data.short_total_investment : (data.totalInvestment !== undefined ? data.totalInvestment : newList[idx].short_total_investment),
                  short_margin: data.short_margin !== undefined ? data.short_margin : (data.profitMargin !== undefined ? data.profitMargin : newList[idx].short_margin),

                  // 期買套利數據 (Long)
                  long_spread: data.long_spread !== undefined ? data.long_spread : newList[idx].long_spread,
                  long_profit: data.long_profit !== undefined ? data.long_profit : newList[idx].long_profit,
                  long_total_investment: data.long_total_investment !== undefined ? data.long_total_investment : newList[idx].long_total_investment,
                  long_margin: data.long_margin !== undefined ? data.long_margin : newList[idx].long_margin,
                };
              }
              return newList;
            });
          } else if (data.type === 'system_event') {
            // 2.2 將中繼站回傳的訂閱/取消成功等訊息直接印至 Chrome Console
            console.log(`[NAS 訂閱系統回報] ${data.event === 'subscribed' ? '✅ 訂閱成功' : (data.event === 'unsubscribed' ? '☑️ 取消訂閱成功' : 'ℹ️ 系統事件')}:`, data);
          }
        } catch (err) {
          console.error('解析 WebSocket 訊息失敗:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('⚠️ NAS WebSocket 連線發生錯誤:', err);
        setIsQuoteConnected(false);
        disconnectWebSocket();
      };

      ws.onclose = () => {
        console.log('🔌 NAS WebSocket 通道已關閉');
        setIsQuoteConnected(false);
      };
    } catch (err) {
      console.error('建立 WebSocket 通道失敗:', err);
      setIsQuoteConnected(false);
    }
  };

  // 組件卸載與瀏覽器分頁關閉時安全關閉 WebSocket
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnectWebSocket();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnectWebSocket();
    };
  }, []);

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

    if (isQuoteConnected) {
      // 點擊【斷線】：同時中斷 NAS -> 富邦，與 Web UI -> NAS WSS
      try {
        const res = await fetch(`${baseUrl}/api/v1/fubon/disconnect`, { method: 'POST' });
        const data = await res.json();
        setApiResponse(data);
        disconnectWebSocket();
        setIsQuoteConnected(false);
        alert(`中斷連線成功！(目標: ${baseUrl})\n${data.message || ''}`);
      } catch (err) {
        console.error('與 NAS 中斷連線通訊失敗:', err);
        disconnectWebSocket();
        setIsQuoteConnected(false);
      }
    } else {
      // 點擊【連線】：同時觸發 NAS -> 登入富邦，與 Web UI -> NAS 建立 WSS
      try {
        // 清空表格中的舊資料
        setTargetsList([]);
        // 1. 將 UI 介面上的交易參數打包，送交 NAS 保存以便後續計算真實淨利潤
        const costParams = {
          stockFeeRate: parseFloat(stockFeeRate),
          brokerDiscount: parseFloat(brokerDiscount),
          stockTaxRate: parseFloat(stockTaxRate),
          futuresFee: parseFloat(futuresFee),
          futuresTaxRate: 0.00002 // 預設期交稅率
        };

        const res = await fetch(`${baseUrl}/api/v1/fubon/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cost_params: costParams })
        });
        const data = await res.json();
        setApiResponse(data);

        if (data.status === 'success' || data.is_connected) {
          setIsQuoteConnected(true);
          connectWebSocket(); // 建立 Web UI 與中繼站間的 WSS
          alert(`連線成功！(目標: ${baseUrl})\n${data.message || ''}`);
        } else {
          alert(`連線失敗: ${data.detail || JSON.stringify(data)}`);
        }
      } catch (err) {
        console.error('與 NAS 通訊失敗:', err);
        alert(`與 NAS 通訊失敗 (${baseUrl})，請確認 NAS 服務與 IP:Port 是否正確`);
      }
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

  // 5. 取得股票期貨標的 (透過 SSFLists ✕ 股票行情快照 進行交叉比對與價格區間過濾)
  const handleGetStockFuturesTargets = async () => {
    const minP = parseFloat(minStockPrice) || 0;
    const maxP = parseFloat(maxStockPrice) || 999999;
    const baseUrl = getApiBaseUrl();
    console.log(`[Web UI] 向 NAS 中繼站發送【取得股票期貨標的】指令，價格區間: ${minP} <= 股價 <= ${maxP}`);
    setIsLoadingTargets(true);

    try {
      const res = await fetch(`${baseUrl}/api/v1/fubon/stock-futures-targets?min_price=${minP}&max_price=${maxP}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error ${res.status}`);
      }
      const data = await res.json();
      setApiResponse(data);

      const list = data.data || [];
      setTargetsList(list);

      console.log('%c==================================================', 'color: #38bdf8; font-weight: bold;');
      console.log(`%c🎯 股票期貨標的篩選成功！(價格區間: ${minP} ~ ${maxP} 元)`, 'color: #4ade80; font-size: 1.1rem; font-weight: bold;');
      console.log(`📊 符合條件標的總筆數: ${list.length} 筆`);
      console.log(`🌐 NAS 中繼站: ${baseUrl}`);
      console.log('📦 詳細標的清單內容如下:');
      console.dir(data.data || data);
      console.log('%c==================================================', 'color: #38bdf8; font-weight: bold;');

      alert(`已成功取得股票期貨標的 (共 ${data.count || 0} 筆符合價位區間 ${minP}~${maxP} 元)！\n\n完整標的列表已詳細列印在 Chrome Console 視窗中 (請按 F12 查看)`);
    } catch (err) {
      console.error('❌ 取得股票期貨標的失敗:', err);
      alert(`取得股票期貨標的失敗: ${err.message}`);
    }
  };

  // 切換中繼伺服器 Log 紀錄開關 (寫入 JSONL 檔)
  const handleToggleRecordNasLog = async (newValue) => {
    setRecordNasLog(newValue);
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/fubon/set-log-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue })
      });
      const data = await res.json();
      console.log(`💾 中繼 Log 紀錄已${newValue ? '開啟' : '關閉'}:`, data);
    } catch (err) {
      console.error('❗ 切換中繼 Log 紀錄失敗:', err);
    }
  };

  // 切換中繼伺服器 Log 顯示開關 (Console 印出)
  const handleToggleNasLog = async (newValue) => {
    setShowNasLog(newValue);
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/fubon/set-log-display`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue })
      });
      const data = await res.json();
      console.log(`🖥️ 中繼 Log 顯示已${newValue ? '開啟' : '關閉'}:`, data);
    } catch (err) {
      console.error('❗ 切換中繼 Log 顯示失敗:', err);
    }
  };
  // 篩選搜尋關鍵字與正利潤過濾 (移至最前以供訂閱功能使用)
  const filteredTargets = (targetsList || []).filter((item) => {
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const code = (item.StockCode || '').toLowerCase();
      const name = (item.StockName || '').toLowerCase();
      const contract = (item.Contract || '').toLowerCase();
      const match = code.includes(term) || name.includes(term) || contract.includes(term);
      if (!match) return false;
    }

    if (onlyPositiveProfit) {
      const profit = activeTab === 'short'
        ? (item.short_profit !== undefined ? item.short_profit : item.profitVal)
        : (item.long_profit !== undefined ? item.long_profit : item.profitVal);
      if (profit == null || profit <= 0) return false;
    }

    return true;
  });
  // 1.2 發送訂閱股票 REST API 指令
  const handleSubscribeStocks = async () => {
    if (!filteredTargets || filteredTargets.length === 0) return;
    const stockCodes = [...new Set(filteredTargets.map(item => item.StockCode))].filter(Boolean);
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/fubon/subscribe-stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: stockCodes })
      });
      const data = await res.json();
      console.log('📈 訂閱股票指令已發送:', data);
    } catch (err) {
      console.error('📈 訂閱股票失敗:', err);
      alert(`訂閱股票失敗: ${err.message}`);
    }
  };

  // 1.2 發送訂閱期貨 REST API 指令
  const handleSubscribeFutures = async () => {
    if (!filteredTargets || filteredTargets.length === 0) return;

    // 建立配對表供中繼站計算套利使用
    const pairs = filteredTargets.map(item => {
      const rootContract = (item.Contract || '').trim();
      const futSymbol5 = rootContract ? `${rootContract}${getContractSuffix(contractMonthType)}` : '';
      return { stock: item.StockCode, fut: futSymbol5 };
    }).filter(p => p.fut !== '');

    const futSymbols = [...new Set(pairs.map(p => p.fut))];
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/fubon/subscribe-futures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: futSymbols, pairs: pairs })
      });
      const data = await res.json();
      console.log('📊 訂閱期貨指令已發送:', data);
    } catch (err) {
      console.error('📊 訂閱期貨失敗:', err);
      alert(`訂閱期貨失敗: ${err.message}`);
    }
  };


  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      backgroundColor: '#0b0f19',
      color: '#f8fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 頁首標題列 (固定頂部不捲動) */}
      <header className="glass-panel" style={{
        flexShrink: 0,
        margin: '12px 16px 8px 16px',
        padding: '8px 20px',
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

        {/* 最右側：中繼Log紀錄/顯示開關 + NAS 位址、連線狀態獨立顯示區域、動態動作按鈕 (連線 / 斷線) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 1. 中繼伺服器 Log 紀錄 Checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            backgroundColor: recordNasLog ? 'rgba(234, 179, 8, 0.15)' : 'rgba(15, 23, 42, 0.6)',
            border: `1px solid ${recordNasLog ? '#eab308' : '#334155'}`,
            borderRadius: '8px',
            padding: '6px 12px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}>
            <input
              type="checkbox"
              checked={recordNasLog}
              onChange={(e) => handleToggleRecordNasLog(e.target.checked)}
              style={{ accentColor: '#eab308', cursor: 'pointer', width: '14px', height: '14px' }}
            />
            <span style={{
              fontSize: '0.8rem',
              fontWeight: '600',
              color: recordNasLog ? '#fde047' : '#94a3b8'
            }}>
              💾 紀錄中繼log
            </span>
          </label>

          {/* 2. 中繼伺服器 Log 顯示 Checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            backgroundColor: showNasLog ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.6)',
            border: `1px solid ${showNasLog ? '#22c55e' : '#334155'}`,
            borderRadius: '8px',
            padding: '6px 12px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}>
            <input
              type="checkbox"
              checked={showNasLog}
              onChange={(e) => handleToggleNasLog(e.target.checked)}
              style={{ accentColor: '#22c55e', cursor: 'pointer', width: '14px', height: '14px' }}
            />
            <span style={{
              fontSize: '0.8rem',
              fontWeight: '600',
              color: showNasLog ? '#4ade80' : '#94a3b8'
            }}>
              🖥️ 顯示中繼log
            </span>
          </label>

          {/* NAS 位址輸入框 */}
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
              placeholder="192.168.0.113:8000"
              style={{
                width: '160px',
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

          {/* 連線狀態獨立顯示區域 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isQuoteConnected ? 'rgba(22, 163, 74, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isQuoteConnected ? '#16a34a' : '#ef4444'}`,
            borderRadius: '8px',
            padding: '6px 12px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isQuoteConnected ? '#4ade80' : '#f87171',
              boxShadow: isQuoteConnected ? '0 0 8px #4ade80' : '0 0 8px #f87171',
              display: 'inline-block'
            }}></span>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: '700',
              color: isQuoteConnected ? '#4ade80' : '#f87171',
              whiteSpace: 'nowrap'
            }}>
              {isQuoteConnected ? '已連線' : '未連線'}
            </span>
          </div>

          {/* 動作按鈕：現在是未連線就顯示「連線」，已連線就顯示「斷線」 */}
          <button
            onClick={handleConnectQuote}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              backgroundColor: isQuoteConnected ? '#e11d48' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: isQuoteConnected ? '0 0 12px rgba(225, 29, 72, 0.4)' : '0 0 12px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            {isQuoteConnected ? '❌ 斷線' : '🔌 連線'}
          </button>
        </div>
      </header>

      {/* 主要區域：劃分為 左側主內容與右側 15% 測試區塊 */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        padding: '0 16px 16px 16px',
        gap: '16px',
        overflow: 'hidden'
      }}>
        {/* 左側主區域 (約 85% 寬度)：股票期貨套利監控看板 */}
        <main style={{
          flex: '1 1 85%',
          minHeight: 0,
          height: '100%',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* 表格控制頂列 (完全鎖定凍結，不隨表格滾動) */}
          <div style={{
            flexShrink: 0,
            padding: '6px 14px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: '700', color: '#38bdf8' }}>
                📊 股票期貨套利監控看板
              </span>
              <span style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                padding: '1px 8px',
                fontWeight: '600'
              }}>
                共 {filteredTargets.length} / {targetsList.length} 檔標的
              </span>
            </div>

            {/* 右側操作區塊 (搜尋、更新、訂閱按鈕) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              {/* 第一排：搜尋、更新、月份選擇 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔍 搜尋股票名稱或代號..."
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    outline: 'none',
                    width: '160px'
                  }}
                />
                {/* 🔥 只顯示正利潤 Checkbox */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '4px',
                  paddingLeft: '8px',
                  borderLeft: '1px solid #334155'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    color: onlyPositiveProfit ? '#ef4444' : '#94a3b8',
                    backgroundColor: onlyPositiveProfit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${onlyPositiveProfit ? '#ef4444' : '#334155'}`,
                    borderRadius: '4px',
                    padding: '2px 8px',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="checkbox"
                      checked={onlyPositiveProfit}
                      onChange={(e) => setOnlyPositiveProfit(e.target.checked)}
                      style={{ accentColor: '#ef4444', cursor: 'pointer' }}
                    />
                    🔥 只顯示正利潤
                  </label>
                </div>

                {/* 🎯 策略 Tab 切換紐 (期賣套利 / 期買套利) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '4px',
                  paddingLeft: '8px',
                  borderLeft: '1px solid #334155',
                  gap: '4px'
                }}>
                  <button
                    onClick={() => setActiveTab('short')}
                    style={{
                      padding: '2px 10px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      border: `1px solid ${activeTab === 'short' ? '#0284c7' : '#334155'}`,
                      cursor: 'pointer',
                      backgroundColor: activeTab === 'short' ? '#0284c7' : 'rgba(15, 23, 42, 0.6)',
                      color: activeTab === 'short' ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📉 期賣套利 (買現貨+賣期貨)
                  </button>
                  <button
                    onClick={() => setActiveTab('long')}
                    style={{
                      padding: '2px 10px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      border: `1px solid ${activeTab === 'long' ? '#6366f1' : '#334155'}`,
                      cursor: 'pointer',
                      backgroundColor: activeTab === 'long' ? '#6366f1' : 'rgba(15, 23, 42, 0.6)',
                      color: activeTab === 'long' ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📈 期買套利 (賣現貨+買期貨)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 表格區域 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {targetsList.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#64748b',
                padding: '40px 20px',
                gap: '10px'
              }}>
                <div style={{ fontSize: '2.5rem' }}>🎯</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#94a3b8' }}>
                  尚無比對資料，請點擊右側【🎯 取得股票期貨標的】
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  系統將自動對齊期交所股票期貨與富邦即時行情，依據價位區間 ({minStockPrice} ~ {maxStockPrice} 元) 產生套利監控表
                </div>
              </div>
            ) : (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.82rem',
                color: '#e2e8f0',
                textAlign: 'left',
                lineHeight: '1.2'
              }}>
                <thead style={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#0f172a',
                  borderBottom: '2px solid #334155',
                  zIndex: 10
                }}>
                  <tr style={{ backgroundColor: activeTab === 'short' ? 'rgba(2, 132, 199, 0.08)' : 'rgba(99, 102, 241, 0.08)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#94a3b8', fontWeight: '700' }}>1. 股票標的</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', color: '#94a3b8', fontWeight: '700' }}>2. 現貨代號</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#94a3b8', fontWeight: '700' }}>3. 期貨標的/規格</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', color: '#94a3b8', fontWeight: '700' }}>4. 期貨代號</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#94a3b8', fontWeight: '700' }}>
                      {activeTab === 'short' ? '5. 期貨買量 (BidVol)' : '5. 股票買量 (BidVol)'}
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#38bdf8', fontWeight: '700' }}>
                      {activeTab === 'short' ? '6. 期貨買價 (Bid1)' : '6. 股票買價 (Bid1)'}
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#38bdf8', fontWeight: '700' }}>
                      {activeTab === 'short' ? '7. 股票賣價 (Ask1)' : '7. 期貨賣價 (Ask1)'}
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#94a3b8', fontWeight: '700' }}>
                      {activeTab === 'short' ? '8. 股票賣量 (AskVol)' : '8. 期貨賣量 (AskVol)'}
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#f59e0b', fontWeight: '700' }}>9. 套利價差 (元)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#ef4444', fontWeight: '700' }}>10. 預估利潤 (金額)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#38bdf8', fontWeight: '700' }}>11. 總投入成本 (本金+費用)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#ef4444', fontWeight: '700' }}>12. 套利空間 (%)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', color: '#94a3b8', fontWeight: '700' }}>13. 快速操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTargets.map((row, idx) => {
                    // 根據 activeTab 動態取用期賣 (short) 或 期買 (long) 欄位數值
                    const col5Vol = activeTab === 'short' ? row.futBidVol : row.stockBidVol;
                    const col6Price = activeTab === 'short' ? row.futBidPrice : row.stockBidPrice;
                    const col7Price = activeTab === 'short' ? row.stockAskPrice : row.futAskPrice;
                    const col8Vol = activeTab === 'short' ? row.stockAskVol : row.futAskVol;

                    // 判斷現貨量是否不足 2 張 (期賣需股票賣單 >= 2, 期買需股票買單 >= 2)
                    const isLowVolume = activeTab === 'short'
                      ? (row.stockAskVol == null || Number(row.stockAskVol) < 2)
                      : (row.stockBidVol == null || Number(row.stockBidVol) < 2);

                    // 計算股票期貨完整代號
                    const rootContract = (row.Contract || '').trim();
                    const futSymbol5 = rootContract ? `${rootContract}${getContractSuffix(contractMonthType)}` : '';

                    // 價差與利潤數值取用
                    const spreadVal = activeTab === 'short'
                      ? (row.short_spread !== undefined ? row.short_spread : row.spreadVal)
                      : (row.long_spread !== undefined ? row.long_spread : (col6Price != null && col7Price != null ? (col6Price - col7Price) : null));

                    const profitVal = activeTab === 'short'
                      ? (row.short_profit !== undefined ? row.short_profit : row.profitVal)
                      : (row.long_profit !== undefined ? row.long_profit : null);

                    const totalInvestmentVal = activeTab === 'short'
                      ? (row.short_total_investment !== undefined ? row.short_total_investment : row.totalInvestmentVal)
                      : (row.long_total_investment !== undefined ? row.long_total_investment : (col7Price != null ? Math.round(col7Price * 2000) : null));

                    const marginVal = activeTab === 'short'
                      ? (row.short_margin !== undefined ? row.short_margin : row.marginVal)
                      : (row.long_margin !== undefined ? row.long_margin : null);

                    // 價差與利潤顏色：正數紅、負數綠 (台灣台股慣用)；當賣單/買單 < 2 張時以灰階顯示
                    const spreadColor = isLowVolume ? '#64748b' : (spreadVal != null ? (spreadVal >= 0 ? '#ef4444' : '#10b981') : '#64748b');
                    const profitColor = isLowVolume ? '#64748b' : (profitVal != null ? (profitVal >= 0 ? '#ef4444' : '#10b981') : '#64748b');

                    // 套利空間 (%) 徽章顏色
                    let marginBg = 'rgba(100, 116, 139, 0.15)';
                    let marginBorder = '#475569';
                    let marginColor = '#94a3b8';
                    if (!isLowVolume && marginVal != null) {
                      if (marginVal >= 0) {
                        marginBg = 'rgba(239, 68, 68, 0.15)';
                        marginBorder = '#ef4444';
                        marginColor = '#f87171';
                      } else {
                        marginBg = 'rgba(16, 185, 129, 0.15)';
                        marginBorder = '#10b981';
                        marginColor = '#34d399';
                      }
                    }

                    return (
                      <tr
                        key={`${row.StockCode}-${idx}`}
                        style={{
                          borderBottom: '1px solid #1e293b',
                          backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.35)' : 'transparent',
                          opacity: isLowVolume ? 0.75 : 1,
                          transition: 'background-color 0.1s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.45)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'rgba(15, 23, 42, 0.35)' : 'transparent'}
                      >
                        {/* 1. 股票標的 (左對齊) */}
                        <td style={{ padding: '4px 8px', fontWeight: '600', color: '#f8fafc', whiteSpace: 'nowrap' }}>
                          {row.StockName || row.UnderlyingStock || '-'}
                        </td>

                        {/* 2. 現貨代號 (置中) */}
                        <td style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            color: '#38bdf8',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '0.78rem'
                          }}>
                            {row.StockCode}
                          </span>
                        </td>

                        {/* 3. 期貨標的/規格 (左對齊) */}
                        <td style={{ padding: '4px 8px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                          {row.StockName ? `${row.StockName}期 (${contractMonthType === 'current' ? '當月' : '次月'})` : futSymbol5}
                        </td>

                        {/* 4. 期貨代號 (置中 5 碼顯示) */}
                        <td style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#818cf8',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '0.78rem'
                          }}>
                            {futSymbol5}
                          </span>
                        </td>

                        {/* 5. Col 5 買量 (右對齊) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: col5Vol != null ? '#cbd5e1' : '#64748b', whiteSpace: 'nowrap' }}>
                          {col5Vol != null ? col5Vol.toLocaleString() : '-'}
                        </td>

                        {/* 6. Col 6 買價 (右對齊) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: col6Price != null ? '#38bdf8' : '#64748b', whiteSpace: 'nowrap' }}>
                          {col6Price != null ? Number(col6Price).toFixed(2) : '-'}
                        </td>

                        {/* 7. Col 7 賣價 (右對齊) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: col7Price != null ? '#38bdf8' : '#64748b', whiteSpace: 'nowrap' }}>
                          {col7Price != null ? Number(col7Price).toFixed(2) : '-'}
                        </td>

                        {/* 8. Col 8 賣量 (右對齊，數量<2張呈灰階) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: isLowVolume ? '#64748b' : '#cbd5e1', fontWeight: isLowVolume ? '400' : '600', whiteSpace: 'nowrap' }}>
                          {col8Vol != null ? (col8Vol === 0 ? (activeTab === 'short' ? '0 (無賣單)' : '0 (無期貨單)') : Number(col8Vol).toLocaleString()) : '-'}
                        </td>

                        {/* 9. 套利價差 (元) (右對齊 - 正數紅/負數綠，量<2灰階) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '800', color: spreadColor, whiteSpace: 'nowrap' }}>
                          {spreadVal != null ? (spreadVal >= 0 ? `+${spreadVal.toFixed(2)}` : spreadVal.toFixed(2)) : '-'}
                        </td>

                        {/* 10. 預估利潤 (金額) (右對齊 - 正數紅/負數綠，量<2灰階) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: profitColor, whiteSpace: 'nowrap' }}>
                          {profitVal != null ? profitVal.toLocaleString() : '-'}
                        </td>

                        {/* 11. 總投入成本 (本金+費用) (右對齊) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: isLowVolume ? '#64748b' : (totalInvestmentVal != null ? '#cbd5e1' : '#64748b'), whiteSpace: 'nowrap' }}>
                          {totalInvestmentVal != null ? totalInvestmentVal.toLocaleString() : '-'}
                        </td>

                        {/* 12. 套利空間 (%) (右對齊 - 正數紅/負數綠，量<2灰階) */}
                        <td style={{ padding: '4px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {marginVal != null ? (
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: '700',
                              backgroundColor: marginBg,
                              border: `1px solid ${marginBorder}`,
                              color: marginColor,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.78rem'
                            }}>
                              {marginVal >= 0 ? `+${marginVal.toFixed(2)}%` : `${marginVal.toFixed(2)}%`}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontFamily: 'monospace' }}>-</span>
                          )}
                        </td>

                        {/* 13. 快速操作 (置中) */}
                        <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <button
                            onClick={() => {
                              if (isLowVolume) {
                                alert(`⚠️ 標的 ${row.StockCode} (${row.StockName}) ${activeTab === "short" ? "現貨賣單" : "現貨買單"}不足 2 張！無法滿足 1 口期貨對沖數量。`);
                              } else {
                                alert(`發動標的 ${row.StockCode} (${row.StockName}) ${activeTab === "short" ? "期賣套利單 (買現貨+賣期貨)" : "期買套利單 (賣現貨+買期貨)"}`);
                              }
                            }}
                            style={{
                              backgroundColor: isLowVolume ? "rgba(100, 116, 139, 0.2)" : (activeTab === "short" ? "rgba(2, 132, 199, 0.2)" : "rgba(99, 102, 241, 0.2)"),
                              border: `1px solid ${isLowVolume ? "#475569" : (activeTab === "short" ? "#0284c7" : "#6366f1")}`,
                              color: isLowVolume ? "#94a3b8" : (activeTab === "short" ? "#38bdf8" : "#818cf8"),
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.78rem",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            ⚡ 下單
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
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

          {/* 取得股票期貨標的按鈕 (依頁面頂部股價區間篩選) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>
              期貨標的篩選
            </label>
            <button
              onClick={handleGetStockFuturesTargets}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(2, 132, 199, 0.3)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              🎯 取得股票期貨標的
            </button>

            {/* 1.1 新增：訂閱股票 / 訂閱期貨按鈕並排 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={handleSubscribeStocks}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)'
                }}
              >
                📈 訂閱股票
              </button>
              <button
                onClick={handleSubscribeFutures}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  backgroundColor: '#8b5cf6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 0 10px rgba(139, 92, 246, 0.2)'
                }}
              >
                📊 訂閱期貨
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
