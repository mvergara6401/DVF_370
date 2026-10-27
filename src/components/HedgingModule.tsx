import React, { useState, useMemo } from 'react';
import { calculateHedgingSchedule, HedgingInputs } from '../utils/hedging';
import { fetchOnlineAssetQuote } from '../services/marketData';
import { MathView } from './MathView';
import {
  Download,
  HelpCircle,
  Play,
  Printer,
  RefreshCw,
  Shield,
  Sliders,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';

interface HedgingModuleProps {
  onOpenHelp: () => void;
}

export const HedgingModule: React.FC<HedgingModuleProps> = ({ onOpenHelp }) => {
  const [ticker, setTicker] = useState('AAPL');
  const [spotPrice, setSpotPrice] = useState(232.50);
  const [isFetching, setIsFetching] = useState(false);

  // Primary Option to Hedge (e.g. short 1,000 ATM Calls sold to client)
  const [strike1, setStrike1] = useState(230.0);
  const [days1, setDays1] = useState(30);
  const [vol1Pct, setVol1Pct] = useState(26.0);
  const [optionType1, setOptionType1] = useState<'call' | 'put'>('call');
  const [positionQty1, setPositionQty1] = useState(-1000); // short 1000 contracts/shares

  // Secondary Option for Gamma Neutrality
  const [strike2, setStrike2] = useState(240.0);
  const [days2, setDays2] = useState(45);
  const [vol2Pct, setVol2Pct] = useState(28.0);
  const [optionType2, setOptionType2] = useState<'call' | 'put'>('call');

  // Market Rate
  const [riskFreeRatePct, setRiskFreeRatePct] = useState(4.5);

  // Simulation mode & Seed
  const [simMode, setSimMode] = useState<'gbm' | 'manual'>('gbm');
  const [randomSeed, setRandomSeed] = useState(101);
  const [manualSpots, setManualSpots] = useState<number[]>([232.50, 235.00, 231.20, 228.40, 233.10, 236.80]);

  // Online Quote Fetch
  const handleFetchSpot = async () => {
    setIsFetching(true);
    try {
      const quote = await fetchOnlineAssetQuote(ticker);
      setSpotPrice(quote.price);
      setStrike1(Math.round(quote.price));
      setStrike2(Math.round(quote.price * 1.05));
      setManualSpots([
        quote.price,
        Math.round(quote.price * 1.01 * 100) / 100,
        Math.round(quote.price * 0.99 * 100) / 100,
        Math.round(quote.price * 0.98 * 100) / 100,
        Math.round(quote.price * 1.005 * 100) / 100,
        Math.round(quote.price * 1.02 * 100) / 100
      ]);
    } finally {
      setIsFetching(false);
    }
  };

  // Run Hedging Calculation
  const hedgeResult = useMemo(() => {
    const inputs: HedgingInputs = {
      spotPrice,
      strike1,
      timeToMaturityYears1: days1 / 365,
      volatility1: vol1Pct / 100,
      riskFreeRate: riskFreeRatePct / 100,
      optionType1,
      positionQuantity1: positionQty1,
      strike2,
      timeToMaturityYears2: days2 / 365,
      volatility2: vol2Pct / 100,
      optionType2,
      simulationMode: simMode,
      customSpotPrices: manualSpots,
      seed: randomSeed
    };
    return calculateHedgingSchedule(inputs);
  }, [
    spotPrice,
    strike1,
    days1,
    vol1Pct,
    riskFreeRatePct,
    optionType1,
    positionQty1,
    strike2,
    days2,
    vol2Pct,
    optionType2,
    simMode,
    manualSpots,
    randomSeed
  ]);

  const { steps, spotPrices } = hedgeResult;
  const finalStep = steps[steps.length - 1];

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Re-roll stochastic simulation
  const handleReroll = () => {
    setRandomSeed(Math.floor(Math.random() * 100000) + 1);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Module 3
            </span>
            <h2 className="text-xl font-bold text-white">Delta &amp; Delta-Gamma Hedging Suite</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic rebalancing calculator with 5-day spot simulator, Gamma neutralization, and comparative P&amp;L attribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            Hedging Theory
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-600/20"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Inputs Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Primary Option Position */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              1. Primary Option (Target)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Value: ${(hedgeResult.initialOption1Value).toFixed(2)}/sh
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Underlying / Spot</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono uppercase text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  value={spotPrice}
                  onChange={(e) => setSpotPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                />
                <button
                  onClick={handleFetchSpot}
                  disabled={isFetching}
                  className="p-1 bg-slate-800 rounded text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Position Quantity</label>
              <input
                type="number"
                value={positionQty1}
                onChange={(e) => setPositionQty1(parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                title="Negative for short option (e.g. sold to client), positive for long"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Strike 1 ($K₁)</label>
              <input
                type="number"
                step="0.5"
                value={strike1}
                onChange={(e) => setStrike1(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Option 1 Type</label>
              <select
                value={optionType1}
                onChange={(e) => setOptionType1(e.target.value as 'call' | 'put')}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
              >
                <option value="call">Call Option</option>
                <option value="put">Put Option</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Days to Expiry (T₁)</label>
              <input
                type="number"
                value={days1}
                onChange={(e) => setDays1(parseInt(e.target.value) || 1)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Volatility 1 (%)</label>
              <input
                type="number"
                step="0.5"
                value={vol1Pct}
                onChange={(e) => setVol1Pct(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Secondary Option for Gamma Hedging */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              2. Secondary Option (Gamma Hedge)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Value: ${(hedgeResult.initialOption2Value).toFixed(2)}/sh
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Strike 2 ($K₂)</label>
              <input
                type="number"
                step="0.5"
                value={strike2}
                onChange={(e) => setStrike2(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Option 2 Type</label>
              <select
                value={optionType2}
                onChange={(e) => setOptionType2(e.target.value as 'call' | 'put')}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
              >
                <option value="call">Call Option</option>
                <option value="put">Put Option</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Days to Expiry (T₂)</label>
              <input
                type="number"
                value={days2}
                onChange={(e) => setDays2(parseInt(e.target.value) || 1)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Volatility 2 (%)</label>
              <input
                type="number"
                step="0.5"
                value={vol2Pct}
                onChange={(e) => setVol2Pct(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>

            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">Risk-Free Rate (r %)</label>
              <input
                type="number"
                step="0.1"
                value={riskFreeRatePct}
                onChange={(e) => setRiskFreeRatePct(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* 5-Day Spot Simulator Controls */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              3. Spot Price Simulator (5 Days)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSimMode('gbm')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  simMode === 'gbm' ? 'bg-emerald-600 text-white' : 'text-slate-400 bg-slate-800'
                }`}
              >
                GBM
              </button>
              <button
                onClick={() => setSimMode('manual')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  simMode === 'manual' ? 'bg-emerald-600 text-white' : 'text-slate-400 bg-slate-800'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {simMode === 'gbm' ? (
            <div className="space-y-2 text-xs">
              <p className="text-slate-400 text-[11px]">
                Simulates daily spot path using Geometric Brownian Motion with drift <MathView math="r - \frac{1}{2}\sigma^2" />:
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReroll}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  Re-simulate Path (Seed: {randomSeed})
                </button>
              </div>

              <div className="grid grid-cols-6 gap-1 pt-1 font-mono text-center">
                {spotPrices.map((sp, idx) => (
                  <div key={idx} className="bg-slate-950 p-1 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">D{idx}</span>
                    <span className="text-[11px] text-slate-200 font-bold">${sp.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <span className="text-slate-400 text-[11px] block">Enter custom daily spot prices:</span>
              <div className="grid grid-cols-3 gap-1.5 font-mono">
                {manualSpots.map((sp, idx) => (
                  <div key={idx}>
                    <label className="text-[10px] text-slate-500 block">Day {idx}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={sp}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const copy = [...manualSpots];
                        copy[idx] = val;
                        setManualSpots(copy);
                      }}
                      className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparative Performance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Unhedged Option Cumulative P&amp;L</span>
          <p className={`text-xl font-bold font-mono mt-1 ${finalStep.unhedgedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {finalStep.unhedgedPnL >= 0 ? '+' : ''}${finalStep.unhedgedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">High directional market risk</span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Delta-Hedged Portfolio P&amp;L</span>
          <p className={`text-xl font-bold font-mono mt-1 ${finalStep.deltaHedgedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {finalStep.deltaHedgedPnL >= 0 ? '+' : ''}${finalStep.deltaHedgedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">First-order delta neutral</span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Delta-Gamma-Hedged Portfolio P&amp;L</span>
          <p className={`text-xl font-bold font-mono mt-1 ${finalStep.deltaGammaHedgedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {finalStep.deltaGammaHedgedPnL >= 0 ? '+' : ''}${finalStep.deltaGammaHedgedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-emerald-400 block mt-1">Second-order curvature neutral</span>
        </div>
      </div>

      {/* Multi-Line P&L Trajectory Chart */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            5-Day Cumulative P&amp;L Trajectory Comparison
          </h3>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Unhedged
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              Delta-Hedged
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Delta-Gamma-Hedged
            </span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="h-56 w-full bg-slate-950/80 rounded-xl border border-slate-800 p-4 relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
            {/* Zero line */}
            <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" strokeWidth="1" />

            {/* Compute SVG coordinates */}
            {(() => {
              const allValues = steps.flatMap((s) => [s.unhedgedPnL, s.deltaHedgedPnL, s.deltaGammaHedgedPnL]);
              const maxVal = Math.max(...allValues, 100);
              const minVal = Math.min(...allValues, -100);
              const range = Math.max(maxVal - minVal, 200);

              const getY = (val: number) => {
                const normalized = (val - minVal) / range;
                return 170 - normalized * 150;
              };

              const getX = (idx: number) => (idx / 5) * 500;

              const unhedgedPoints = steps.map((s, i) => `${getX(i)},${getY(s.unhedgedPnL)}`).join(' ');
              const deltaPoints = steps.map((s, i) => `${getX(i)},${getY(s.deltaHedgedPnL)}`).join(' ');
              const deltaGammaPoints = steps.map((s, i) => `${getX(i)},${getY(s.deltaGammaHedgedPnL)}`).join(' ');

              return (
                <>
                  {/* Unhedged Line */}
                  <polyline fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" points={unhedgedPoints} />
                  {/* Delta Line */}
                  <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" points={deltaPoints} />
                  {/* Delta Gamma Line */}
                  <polyline fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" points={deltaGammaPoints} />

                  {/* Points on lines */}
                  {steps.map((s, i) => (
                    <g key={i}>
                      <circle cx={getX(i)} cy={getY(s.unhedgedPnL)} r="4" fill="#f43f5e" />
                      <circle cx={getX(i)} cy={getY(s.deltaHedgedPnL)} r="4" fill="#3b82f6" />
                      <circle cx={getX(i)} cy={getY(s.deltaGammaHedgedPnL)} r="4.5" fill="#10b981" />
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>

          {/* X-axis labels */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
            {steps.map((s) => (
              <span key={s.day}>Day {s.day} (${s.spotPrice.toFixed(1)})</span>
            ))}
          </div>
        </div>
      </div>

      {/* Printable Daily Adjustment Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Daily Hedge Adjustment &amp; Rebalancing Report</h3>
          <span className="text-xs font-mono text-slate-400">Position: {positionQty1}x {ticker} {optionType1.toUpperCase()}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Day</th>
                <th className="px-3 py-2.5">Spot (S)</th>
                <th className="px-3 py-2.5">Δ₁ / Γ₁</th>
                <th className="px-3 py-2.5 text-blue-400">Delta Stock (N_S)</th>
                <th className="px-3 py-2.5 text-blue-400">Δ Rebalance</th>
                <th className="px-3 py-2.5 text-emerald-400">Option 2 (N₂)</th>
                <th className="px-3 py-2.5 text-emerald-400">ΔΓ Stock (N_S)</th>
                <th className="px-3 py-2.5">Unhedged P&amp;L</th>
                <th className="px-3 py-2.5 text-blue-400">Delta P&amp;L</th>
                <th className="px-3 py-2.5 text-emerald-400">Delta-Gamma P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {steps.map((st) => (
                <tr key={st.day} className="hover:bg-slate-800/30 transition">
                  <td className="px-3 py-2.5 font-bold text-slate-300">Day {st.day}</td>
                  <td className="px-3 py-2.5 font-bold text-white">${st.spotPrice.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-400">
                    {st.delta1.toFixed(3)} / {st.gamma1.toFixed(4)}
                  </td>
                  <td className="px-3 py-2.5 text-blue-300 font-bold">{st.stockHoldingsDeltaOnly.toFixed(0)} shs</td>
                  <td className="px-3 py-2.5 text-slate-300">
                    {st.stockRebalanceDeltaOnly >= 0 ? '+' : ''}{st.stockRebalanceDeltaOnly.toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5 text-purple-300">{st.option2HoldingsDeltaGamma.toFixed(0)}</td>
                  <td className="px-3 py-2.5 text-emerald-300 font-bold">{st.stockHoldingsDeltaGamma.toFixed(0)} shs</td>
                  <td className="px-3 py-2.5 font-bold">
                    <span className={st.unhedgedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {st.unhedgedPnL >= 0 ? '+' : ''}${st.unhedgedPnL.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-bold">
                    <span className={st.deltaHedgedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {st.deltaHedgedPnL >= 0 ? '+' : ''}${st.deltaHedgedPnL.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-bold">
                    <span className={st.deltaGammaHedgedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {st.deltaGammaHedgedPnL >= 0 ? '+' : ''}${st.deltaGammaHedgedPnL.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
