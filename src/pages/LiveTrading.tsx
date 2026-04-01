// Live Trading page
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Layout } from '@/components/Layout';
import { 
  createChart, 
  ColorType, 
  ISeriesApi, 
  CandlestickSeries, 
  LineSeries, 
  HistogramSeries,
  IChartApi,
  SeriesType
} from 'lightweight-charts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, TrendingDown, Clock, RefreshCw, AlertTriangle, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const PRESET_STOCKS = [
  { symbol: 'TCS', name: 'TCS' },
  { symbol: 'RELIANCE', name: 'RELIANCE' },
  { symbol: 'INFOSYS', name: 'INFOSYS' },
  { symbol: 'HDFCBANK', name: 'HDFC BANK' },
  { symbol: 'TATA_MOTORS', name: 'TATA MOTORS' },
];

const CHART_TYPES = ['Line', 'Candlestick', 'Volume'] as const;
type ChartType = typeof CHART_TYPES[number];

interface StockPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const LiveTrading = () => {
  const { user, spendCoins, addCoins, updateHoldings, incrementTrades, addTradeMistake } = useUser();

  // 1. Guard for uninitialized users
  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6 text-center px-4">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20 animate-pulse">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl text-foreground tracking-tighter">Access Restricted</h2>
            <p className="font-mono text-xs text-muted-foreground max-w-xs">
              Trading profile not found. Please initialize your account on the terminal to start live simulations.
            </p>
          </div>
          <Link to="/">
            <Button size="lg" className="bg-primary text-primary-foreground font-mono text-xs tracking-widest px-8">
              RETURN TO TERMINAL
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // 2. Component Logic (Only starts if user exists)
  const [ticker, setTicker] = useState('TCS');
  const [searchInput, setSearchInput] = useState('');
  const [chartType, setChartType] = useState<ChartType>('Candlestick');
  const [data, setData] = useState<StockPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qty, setQty] = useState(1);
  const [tradeMsg, setTradeMsg] = useState('');

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const fetchData = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8080/api/live-trading/data/${symbol}`);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setData([]);
      } else {
        setData(json.data);
      }
    } catch {
      setError('Failed to connect to backend server. Ensure Port 8080 is running.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(ticker);
  }, [ticker, fetchData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'hsl(220, 10%, 50%)',
      },
      grid: {
        vertLines: { color: 'hsl(230, 15%, 15%)' },
        horzLines: { color: 'hsl(230, 15%, 15%)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { labelBackgroundColor: 'hsl(185, 100%, 50%)' },
        horzLine: { labelBackgroundColor: 'hsl(185, 100%, 50%)' },
      },
      timeScale: {
        borderColor: 'hsl(230, 15%, 15%)',
        timeVisible: true,
        secondsVisible: true,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (mainSeriesRef.current) chartRef.current.removeSeries(mainSeriesRef.current);
    if (volumeSeriesRef.current) chartRef.current.removeSeries(volumeSeriesRef.current);

    if (chartType === 'Volume') {
      const volumeSeries = chartRef.current.addSeries(HistogramSeries, {
        color: 'hsl(185, 100%, 50%)',
        priceFormat: { type: 'volume' },
      });
      volumeSeries.setData(data.map(p => ({
        time: p.time as any,
        value: p.volume,
        color: p.close >= p.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
      })));
      volumeSeriesRef.current = volumeSeries;
      mainSeriesRef.current = null;
    } else {
      if (chartType === 'Candlestick') {
        const candleSeries = chartRef.current.addSeries(CandlestickSeries, {
          upColor: 'hsl(150, 100%, 45%)',
          downColor: 'hsl(0, 80%, 55%)',
          borderVisible: false,
          wickUpColor: 'hsl(150, 100%, 45%)',
          wickDownColor: 'hsl(0, 80%, 55%)',
        });
        candleSeries.setData(data.map(p => ({
          time: p.time as any,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close
        })));
        mainSeriesRef.current = candleSeries;
      } else {
        const lineSeries = chartRef.current.addSeries(LineSeries, {
          color: 'hsl(185, 100%, 50%)',
          lineWidth: 2,
        });
        lineSeries.setData(data.map(p => ({
          time: p.time as any,
          value: p.close
        })));
        mainSeriesRef.current = lineSeries;
      }

      const volumeSeries = chartRef.current.addSeries(HistogramSeries, {
        color: 'rgba(185, 100, 50, 0.3)',
        priceFormat: { type: 'volume' },
        priceScaleId: '', 
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(data.map(p => ({
          time: p.time as any,
          value: p.volume,
          color: p.close >= p.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
      })));
      volumeSeriesRef.current = volumeSeries;
    }

    chartRef.current.timeScale().fitContent();

  }, [data, chartType]);

  const handleSearch = () => {
    const sym = searchInput.trim().toUpperCase();
    if (sym) { setTicker(sym); setSearchInput(''); }
  };

  const currentPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const prevPrice = data.length > 1 ? data[data.length - 2].close : currentPrice;
  const priceChange = currentPrice - prevPrice;
  const priceChangePercent = prevPrice ? ((priceChange / prevPrice) * 100) : 0;
  const isUp = priceChange >= 0;
  const dayHigh = data.length > 0 ? Math.max(...data.map(d => d.high)) : 0;
  const dayLow = data.length > 0 ? Math.min(...data.map(d => d.low)) : 0;

  const stockName = PRESET_STOCKS.find(s => s.symbol === ticker)?.name || ticker;
  const holding = user?.holdings.find(h => h.symbol === ticker);

  const buy = () => {
    if (!user || currentPrice <= 0) return;
    const cost = Math.round(currentPrice * qty);
    if (!spendCoins(cost)) { setTradeMsg('Not enough coins!'); return; }
    const existing = user.holdings.find(h => h.symbol === ticker);
    let newHoldings;
    if (existing) {
      const totalShares = existing.shares + qty;
      const avgPrice = ((existing.avgPrice * existing.shares) + cost) / totalShares;
      newHoldings = user.holdings.map(h => h.symbol === ticker ? { ...h, shares: totalShares, avgPrice } : h);
    } else {
      newHoldings = [...user.holdings, { symbol: ticker, name: stockName, shares: qty, avgPrice: currentPrice }];
    }
    updateHoldings(newHoldings);
    incrementTrades();
    setTradeMsg(`Bought ${qty} ${ticker} @ $${currentPrice.toFixed(2)} for ${cost.toLocaleString()} coins`);
  };

  const sell = () => {
    if (!user || !holding || holding.shares < qty) { setTradeMsg('Not enough shares!'); return; }
    const revenue = Math.round(currentPrice * qty);
    addCoins(revenue);
    if (currentPrice < holding.avgPrice) {
      const loss = (holding.avgPrice - currentPrice) * qty;
      addTradeMistake({ symbol: ticker, buyPrice: holding.avgPrice, sellPrice: currentPrice, shares: qty, loss });
    }
    const remaining = holding.shares - qty;
    const newHoldings = remaining === 0
      ? user.holdings.filter(h => h.symbol !== ticker)
      : user.holdings.map(h => h.symbol === ticker ? { ...h, shares: remaining } : h);
    updateHoldings(newHoldings);
    incrementTrades();
    setTradeMsg(`Sold ${qty} ${ticker} @ $${currentPrice.toFixed(2)} for ${revenue.toLocaleString()} coins`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-4 p-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="font-display text-xl tracking-wider text-primary text-glow-cyan">
            Live Trading
          </h1>
          <div className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ticker symbol..."
              className="w-36 font-mono text-xs bg-muted border-border"
            />
            <Button size="sm" onClick={handleSearch} className="bg-primary text-primary-foreground">
              <Search className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => fetchData(ticker)} className="border-border">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stock Tabs */}
        <div className="flex gap-2 flex-wrap">
          {PRESET_STOCKS.map((s) => (
            <button
              key={s.symbol}
              onClick={() => { setTicker(s.symbol); setTradeMsg(''); }}
              className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider transition-all ${
                ticker === s.symbol
                  ? 'bg-primary text-primary-foreground shadow-[0_0_15px_hsl(185,100%,50%,0.3)]'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card-cyber border-destructive/50 flex items-center gap-3 text-destructive"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-mono text-xs">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Layout: Chart + Trading Panel */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Price Header */}
            {data.length > 0 && (
              <div className="card-cyber flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg tracking-wider text-foreground">{ticker}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-mono text-2xl text-foreground">₹{currentPrice.toLocaleString()}</span>
                    <span className={`font-mono text-sm flex items-center gap-1 ${isUp ? 'text-[hsl(150,100%,45%)]' : 'text-destructive'}`}>
                      {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {isUp ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                  <div>High: <span className="text-[hsl(150,100%,45%)]">₹{dayHigh.toLocaleString()}</span></div>
                  <div>Low: <span className="text-destructive">₹{dayLow.toLocaleString()}</span></div>
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" />1s Synthesized</div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="card-cyber p-0 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex gap-1">
                  {CHART_TYPES.map((ct) => (
                    <button key={ct} onClick={() => setChartType(ct)}
                      className={`px-3 py-1 rounded font-mono text-xs transition-all ${
                        chartType === ct ? 'bg-primary/20 text-primary border border-primary/40' : 'text-muted-foreground hover:text-foreground'
                      }`}>{ct}</button>
                  ))}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest px-2">
                   Interactive (Drag to Pan • Scroll to Zoom • 1s Ticks)
                </div>
              </div>
              <div className="h-[450px] p-3 relative" ref={chartContainerRef}>
                {loading && (
                  <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                  </div>
                )}
                {data.length === 0 && !loading && (
                    <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-xs">
                        No data found. Ensure stocks are downloaded in live_trading/data/
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Training Panel */}
          <div className="space-y-4">
            <div className="card-cyber text-center">
              <p className="font-mono text-xs text-muted-foreground mb-1">Your Balance</p>
              <p className="font-display text-2xl text-primary text-glow-cyan">{user.coins.toLocaleString()}</p>
              <p className="font-mono text-xs text-muted-foreground">coins</p>
            </div>

            <div className="card-cyber">
              <p className="font-display text-sm text-foreground mb-2">{ticker} — {stockName}</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="text-muted-foreground">Current Price</div>
                <div className="text-primary text-right">₹{currentPrice.toLocaleString()}</div>
                <div className="text-muted-foreground">You Hold</div>
                <div className="text-foreground text-right">{holding?.shares ?? 0} shares</div>
                {holding && (
                  <>
                    <div className="text-muted-foreground">Avg Price</div>
                    <div className="text-foreground text-right">₹{holding.avgPrice.toLocaleString()}</div>
                    <div className="text-muted-foreground">P&L</div>
                    <div className={`text-right ${currentPrice >= holding.avgPrice ? 'text-[hsl(150,100%,45%)]' : 'text-destructive'}`}>
                      {currentPrice >= holding.avgPrice ? '+' : ''}{((currentPrice - holding.avgPrice) * holding.shares).toLocaleString()}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card-cyber">
              <label className="font-mono text-xs text-muted-foreground block mb-2">Quantity</label>
              <div className="flex items-center justify-center gap-3 mb-3">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-foreground hover:border-primary transition-colors">
                  <Minus className="h-4 w-4" />
                </button>
                <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, +e.target.value))}
                  className="bg-muted border border-border rounded px-3 py-2 w-20 font-mono text-sm text-foreground text-center focus:outline-none focus:border-primary" />
                <button onClick={() => setQty(q => q + 1)}
                  className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-foreground hover:border-primary transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="font-mono text-xs text-muted-foreground text-center mb-3">
                Total: <span className="text-primary">{Math.round(currentPrice * qty).toLocaleString()}</span> coins
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={buy}
                  className="py-2 rounded font-mono text-xs font-bold tracking-wider bg-[hsl(150,100%,45%)] text-[hsl(230,20%,10%)] hover:opacity-90 transition-opacity disabled:opacity-50"
                  disabled={currentPrice <= 0}>
                  BUY
                </button>
                <button onClick={sell}
                  className="py-2 rounded font-mono text-xs font-bold tracking-wider bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  disabled={holding?.shares === 0 || !holding}>
                  SELL
                </button>
              </div>
              <AnimatePresence>
                {tradeMsg && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="font-mono text-xs text-[hsl(150,100%,45%)] mt-3 text-center">
                    {tradeMsg}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LiveTrading;
