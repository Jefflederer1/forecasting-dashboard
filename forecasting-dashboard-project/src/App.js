import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  BarChart2,
  Target,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  DollarSign,
} from 'lucide-react';

const STOCKS = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 188.74,
    change: 1.24,
    sector: 'Technology Hardware',
    volatility: 0.16,
    growth: 0.18,
    sentiment: 'Positive device cycle and strong services momentum.',
    history: [
      { date: 'Jan 2', close: 184 },
      { date: 'Jan 9', close: 186 },
      { date: 'Jan 16', close: 183 },
      { date: 'Jan 23', close: 187 },
      { date: 'Jan 30', close: 189 },
      { date: 'Feb 6', close: 188 },
      { date: 'Feb 13', close: 191 },
      { date: 'Feb 20', close: 193 },
      { date: 'Feb 27', close: 190 },
      { date: 'Mar 5', close: 194 },
      { date: 'Mar 12', close: 197 },
      { date: 'Mar 19', close: 198 },
    ],
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    price: 432.18,
    change: 0.86,
    sector: 'Cloud & AI',
    volatility: 0.14,
    growth: 0.21,
    sentiment: 'AI infrastructure demand continues to beat expectations.',
    history: [
      { date: 'Jan 2', close: 402 },
      { date: 'Jan 9', close: 404 },
      { date: 'Jan 16', close: 407 },
      { date: 'Jan 23', close: 409 },
      { date: 'Jan 30', close: 412 },
      { date: 'Feb 6', close: 416 },
      { date: 'Feb 13', close: 421 },
      { date: 'Feb 20', close: 423 },
      { date: 'Feb 27', close: 422 },
      { date: 'Mar 5', close: 427 },
      { date: 'Mar 12', close: 431 },
      { date: 'Mar 19', close: 432 },
    ],
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    price: 195.41,
    change: -2.68,
    sector: 'Electric Vehicles',
    volatility: 0.34,
    growth: 0.12,
    sentiment: 'Margin pressure persists but energy storage growth is strong.',
    history: [
      { date: 'Jan 2', close: 248 },
      { date: 'Jan 9', close: 242 },
      { date: 'Jan 16', close: 236 },
      { date: 'Jan 23', close: 228 },
      { date: 'Jan 30', close: 224 },
      { date: 'Feb 6', close: 219 },
      { date: 'Feb 13', close: 214 },
      { date: 'Feb 20', close: 209 },
      { date: 'Feb 27', close: 206 },
      { date: 'Mar 5', close: 203 },
      { date: 'Mar 12', close: 199 },
      { date: 'Mar 19', close: 195 },
    ],
  },
  {
    symbol: 'NFLX',
    name: 'Netflix Inc.',
    price: 583.33,
    change: 2.11,
    sector: 'Streaming Media',
    volatility: 0.22,
    growth: 0.19,
    sentiment: 'Paid sharing rollout and ad-tier expansion drive upside.',
    history: [
      { date: 'Jan 2', close: 486 },
      { date: 'Jan 9', close: 491 },
      { date: 'Jan 16', close: 505 },
      { date: 'Jan 23', close: 517 },
      { date: 'Jan 30', close: 528 },
      { date: 'Feb 6', close: 539 },
      { date: 'Feb 13', close: 544 },
      { date: 'Feb 20', close: 551 },
      { date: 'Feb 27', close: 563 },
      { date: 'Mar 5', close: 569 },
      { date: 'Mar 12', close: 577 },
      { date: 'Mar 19', close: 583 },
    ],
  },
];

const MetricCard = ({ title, value, subtitle, icon }) => (
  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur shadow-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-2xl font-semibold text-white mt-2">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
        {icon}
      </div>
    </div>
  </div>
);

const NewsCard = ({ headline, detail }) => (
  <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-1">
    <div className="flex items-center gap-2 text-sm text-indigo-300">
      <Sparkles className="h-4 w-4" />
      <span className="font-semibold">Signal</span>
    </div>
    <p className="text-white font-semibold">{headline}</p>
    <p className="text-gray-400 text-sm leading-relaxed">{detail}</p>
  </div>
);

const generateForecast = (history, growthRate, volatility, optimism) => {
  const lastClose = history[history.length - 1].close;
  const forecast = [];
  let current = lastClose;
  const baseDrift = growthRate * (1 + optimism / 100);
  const adjustedVol = volatility * (1 + Math.abs(optimism) / 120);

  for (let i = 1; i <= 30; i += 1) {
    const seasonal = Math.sin(i / 6) * 0.5;
    const drift = current * (baseDrift / 365);
    const noise = current * adjustedVol * 0.01 * seasonal;
    current = Number((current + drift + noise).toFixed(2));
    forecast.push({ day: i, close: current });
  }

  return forecast.map((point) => ({
    date: `+${point.day}d`,
    close: point.close,
  }));
};

const combineHistoryAndForecast = (history, forecast) => [
  ...history.map((item) => ({ ...item, type: 'History' })),
  ...forecast.map((item) => ({ ...item, type: 'Forecast' })),
];

const ForecastTable = ({ forecast }) => (
  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
    <div className="flex items-center gap-2 mb-3 text-white font-semibold">
      <BarChart2 className="h-5 w-5 text-indigo-400" />
      <span>Key Levels</span>
    </div>
    <div className="grid grid-cols-3 gap-3 text-sm text-gray-300">
      {[
        { label: '+7d', value: forecast[6] },
        { label: '+30d', value: forecast[29] },
        { label: '+90d (modeled)', value: forecast[29] && { ...forecast[29], close: Number((forecast[29].close * 1.04).toFixed(2)) } },
      ].map((row) => (
        <div key={row.label} className="bg-gray-800/60 rounded-xl p-3 border border-gray-800">
          <p className="text-gray-400 text-xs">{row.label}</p>
          <p className="text-white text-xl font-semibold">${row.value?.close ?? '—'}</p>
          <p className="text-gray-500 text-xs">Projected close</p>
        </div>
      ))}
    </div>
  </div>
);

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [optimism, setOptimism] = useState(10);

  const selectedStock = useMemo(
    () => STOCKS.find((s) => s.symbol === selectedSymbol) ?? STOCKS[0],
    [selectedSymbol],
  );

  const forecast = useMemo(
    () => generateForecast(selectedStock.history, selectedStock.growth, selectedStock.volatility, optimism),
    [selectedStock, optimism],
  );

  const blendedSeries = useMemo(
    () => combineHistoryAndForecast(selectedStock.history, forecast),
    [selectedStock, forecast],
  );

  const expected30d = forecast[forecast.length - 1]?.close ?? selectedStock.price;
  const expectedReturn = ((expected30d - selectedStock.price) / selectedStock.price) * 100;
  const downsideRisk = selectedStock.volatility * (1 + optimism / 120);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-indigo-300 text-sm font-semibold uppercase">Forecast Studio</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-indigo-400" /> Predict tomorrow&apos;s winners
            </h1>
            <p className="text-gray-400 max-w-xl">
              Compare historical performance with forward-looking scenarios. Adjust your optimism slider to see how
              momentum and volatility shift the projected curve.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-gray-900/60 border border-gray-800 px-4 py-3 rounded-2xl">
            <Info className="h-5 w-5 text-indigo-400" />
            <p className="text-sm text-gray-300 leading-snug">No live brokerage connected. Numbers shown are illustrative forecasts.</p>
          </div>
        </header>

        <div className="grid md:grid-cols-4 gap-4">
          <MetricCard
            title="Current price"
            value={`$${selectedStock.price.toFixed(2)}`}
            subtitle={selectedStock.name}
            icon={<DollarSign className="h-6 w-6" />}
          />
          <MetricCard
            title="30d forecast"
            value={`$${expected30d.toFixed(2)}`}
            subtitle={`Vs. today: ${expectedReturn >= 0 ? '+' : ''}${expectedReturn.toFixed(1)}%`}
            icon={<Target className="h-6 w-6" />}
          />
          <MetricCard
            title="Annualized growth bias"
            value={`${Math.round(selectedStock.growth * 100)}%`}
            subtitle="Embedded in projection"
            icon={<ArrowUpRight className="h-6 w-6" />}
          />
          <MetricCard
            title="Volatility lens"
            value={`${Math.round(downsideRisk * 100)} bp`}
            subtitle="Scaled by optimism setting"
            icon={<ShieldCheck className="h-6 w-6" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">Price action</p>
                  <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                    {selectedStock.name} <ArrowRight className="h-5 w-5 text-gray-500" /> {selectedStock.symbol}
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <label className="text-gray-400">Optimism</label>
                  <input
                    type="range"
                    min={-20}
                    max={30}
                    step={1}
                    value={optimism}
                    onChange={(e) => setOptimism(Number(e.target.value))}
                    className="w-40 accent-indigo-500"
                  />
                  <span className="w-16 text-right text-white font-semibold">{optimism}%</span>
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={blendedSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="forecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#0b1224', border: '1px solid #1f2937', borderRadius: 10 }}
                      labelStyle={{ color: '#e5e7eb' }}
                    />
                    <Legend wrapperStyle={{ color: '#e5e7eb' }} />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#forecast)"
                      strokeWidth={2.5}
                      strokeDasharray="3 0"
                      name="Forecast band"
                      isAnimationActive={false}
                      data={blendedSeries.filter((p) => p.type === 'Forecast')}
                    />
                    <Line type="monotone" dataKey="close" data={blendedSeries.filter((p) => p.type === 'History')} stroke="#22d3ee" dot={false} strokeWidth={2} name="History" />
                    <Line type="monotone" dataKey="close" data={blendedSeries.filter((p) => p.type === 'Forecast')} stroke="#6366f1" dot={false} strokeWidth={2} name="Forecast" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <ForecastTable forecast={forecast} />
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Select a ticker</p>
                  <p className="text-lg font-semibold text-white">Focus your view</p>
                </div>
                <TrendingUp className="h-6 w-6 text-indigo-400" />
              </div>
              <div className="space-y-3">
                {STOCKS.map((stock) => {
                  const positive = stock.change >= 0;
                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => setSelectedSymbol(stock.symbol)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                        selectedSymbol === stock.symbol
                          ? 'border-indigo-500/70 bg-indigo-500/10'
                          : 'border-gray-800 hover:border-gray-700 bg-gray-900/30'
                      }`}
                    >
                      <div>
                        <p className="text-white font-semibold">{stock.symbol}</p>
                        <p className="text-gray-400 text-xs">{stock.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">${stock.price.toFixed(2)}</p>
                        <p className={`text-xs ${positive ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-1 justify-end`}>
                          {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {positive ? '+' : ''}{stock.change.toFixed(2)}%
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-800 text-sm text-gray-300">
                <p className="font-semibold text-white mb-1">Sector driver</p>
                <p className="text-gray-400 leading-relaxed">{selectedStock.sentiment}</p>
              </div>
            </div>

            <div className="space-y-3">
              <NewsCard
                headline="AI demand lifts hyperscalers"
                detail="NVIDIA, Microsoft, and Alphabet signal sustained capex in 2024, boosting cloud-exposed equities."
              />
              <NewsCard
                headline="Consumer hardware refresh cycle"
                detail="Upcoming device launches suggest upside for suppliers tied to premium phones and wearables."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
