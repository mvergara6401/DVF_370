import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
  calibrateSABR,
  generateSABRSmile,
  haganImpliedVolatility,
  simulateSABRMonteCarlo
} from '../utils/sabr';
import { black76Price } from '../utils/blackScholes';
import {
  MarketVolPoint,
  MonteCarloSABRResult,
  SABRParameters,
  SABRSmilePoint
} from '../types/quant';
import { MathView } from './MathView';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Cpu,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Play,
  Printer,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Upload,
  Zap
} from 'lucide-react';

interface SABRModuleProps {
  onOpenHelp: () => void;
}

// Preloaded benchmark market smiles
const BENCHMARK_SMILES: Record<string, { F: number; T: number; r: number; points: MarketVolPoint[] }> = {
  SPY: {
    F: 582.40,
    T: 30 / 365,
    r: 0.045,
    points: [
      { strike: 520, impliedVol: 0.252 },
      { strike: 540, impliedVol: 0.218 },
      { strike: 560, impliedVol: 0.186 },
      { strike: 580, impliedVol: 0.161 }, // near ATM
      { strike: 600, impliedVol: 0.142 },
      { strike: 620, impliedVol: 0.138 },
      { strike: 640, impliedVol: 0.141 }
    ]
  },
  AAPL: {
    F: 232.50,
    T: 45 / 365,
    r: 0.045,
    points: [
      { strike: 200, impliedVol: 0.355 },
      { strike: 215, impliedVol: 0.302 },
      { strike: 230, impliedVol: 0.264 },
      { strike: 245, impliedVol: 0.245 },
      { strike: 260, impliedVol: 0.248 }
    ]
  },
  TSLA: {
    F: 218.60,
    T: 30 / 365,
    r: 0.045,
    points: [
      { strike: 180, impliedVol: 0.680 },
      { strike: 200, impliedVol: 0.590 },
      { strike: 220, impliedVol: 0.520 },
      { strike: 240, impliedVol: 0.495 },
      { strike: 260, impliedVol: 0.510 }
    ]
  }
};

export const SABRModule: React.FC<SABRModuleProps> = ({ onOpenHelp }) => {
  // Underlying inputs
  const [spotPrice, setSpotPrice] = useState(582.40);
  const [riskFreeRatePct, setRiskFreeRatePct] = useState(4.5);
  const [dividendYieldPct, setDividendYieldPct] = useState(0.0);
  const [daysToMaturity, setDaysToMaturity] = useState(30);

  // Computed Forward Price F = S * exp((r - q) * T)
  const T = daysToMaturity / 365;
  const r = riskFreeRatePct / 100;
  const q = dividendYieldPct / 100;
  const forwardPrice = Math.round(spotPrice * Math.exp((r - q) * T) * 100) / 100;

  // SABR Model Parameters
  const [alpha, setAlpha] = useState(0.18);
  const [beta, setBeta] = useState(1.0); // beta = 1.0 fixed default for equities
  const [rho, setRho] = useState(-0.35);
  const [nu, setNu] = useState(0.48);

  // Current parameters object
  const sabrParams: SABRParameters = useMemo(() => {
    return { alpha, beta, rho, nu };
  }, [alpha, beta, rho, nu]);

  // Market Data Points for Calibration
  const [marketPoints, setMarketPoints] = useState<MarketVolPoint[]>(BENCHMARK_SMILES.SPY.points);
  const [calibrationStats, setCalibrationStats] = useState<{
    rmse: number;
    maxError: number;
    iterations: number;
  } | null>(null);

  // Target Option for Evaluation & Arbitrage check
  const [targetStrike, setTargetStrike] = useState(580);
  const [targetMarketPrice, setTargetMarketPrice] = useState(12.50);

  // Monte Carlo Differential Equation Simulator State
  const [mcSimulations, setMcSimulations] = useState(10000);
  const [mcSteps, setMcSteps] = useState(50);
  const [mcAlgorithm, setMcAlgorithm] = useState<'full_truncation_log' | 'euler_maruyama'>('full_truncation_log');
  const [isSimulating, setIsSimulating] = useState(false);
  const [mcResult, setMcResult] = useState<MonteCarloSABRResult | null>(null);

  // Generate Volatility Smile Points across strikes
  const smilePoints = useMemo(() => {
    return generateSABRSmile(forwardPrice, T, r, sabrParams, 0.75, 1.25, 21);
  }, [forwardPrice, T, r, sabrParams]);

  // Calculate target option theoretical values under SABR
  const targetOptionMetrics = useMemo(() => {
    const iv = haganImpliedVolatility(forwardPrice, targetStrike, T, sabrParams);
    const haganCall = black76Price(forwardPrice, targetStrike, T, r, iv, 'call');
    const haganPut = black76Price(forwardPrice, targetStrike, T, r, iv, 'put');
    const priceDiff = targetMarketPrice - haganCall;
    const isMispriced = Math.abs(priceDiff) > 0.30;

    return {
      iv,
      haganCall,
      haganPut,
      priceDiff,
      isMispriced,
      arbitrageStrategy: priceDiff > 0.30
        ? `Option is OVERPRICED by $${priceDiff.toFixed(2)}. Strategy: Sell Market Call at $${targetMarketPrice.toFixed(2)}, Buy SABR-replicated synthetic portfolio / hedge delta to capture $${(priceDiff * 100).toFixed(0)} risk-free profit per contract.`
        : priceDiff < -0.30
        ? `Option is UNDERPRICED by $${Math.abs(priceDiff).toFixed(2)}. Strategy: Buy Market Call at $${targetMarketPrice.toFixed(2)}, Short SABR-replicated synthetic portfolio to lock in $${(Math.abs(priceDiff) * 100).toFixed(0)} risk-free profit per contract.`
        : 'Option price is aligned with SABR model within normal market bid-ask spread.'
    };
  }, [forwardPrice, targetStrike, T, r, sabrParams, targetMarketPrice]);

  // Calibration Handler
  const handleCalibrate = () => {
    const calib = calibrateSABR(marketPoints, forwardPrice, T, beta);
    setAlpha(calib.params.alpha);
    setRho(calib.params.rho);
    setNu(calib.params.nu);
    setCalibrationStats({
      rmse: calib.rmse,
      maxError: calib.maxError,
      iterations: calib.iterations
    });
  };

  // CSV / Excel File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const rows = results.data as any[];
        const parsedPoints: MarketVolPoint[] = [];

        for (const row of rows) {
          // Detect strike column
          const strikeVal = row.strike ?? row.Strike ?? row.k ?? row.K ?? row['STRIKE'];
          // Detect vol column
          const volVal = row.impliedVol ?? row.vol ?? row.volatility ?? row.sigma ?? row['IV'] ?? row['ImpliedVol'];

          if (typeof strikeVal === 'number' && typeof volVal === 'number') {
            const iv = volVal > 1.5 ? volVal / 100 : volVal; // Handle % vs decimal
            parsedPoints.push({ strike: strikeVal, impliedVol: iv });
          }
        }

        if (parsedPoints.length >= 3) {
          parsedPoints.sort((a, b) => a.strike - b.strike);
          setMarketPoints(parsedPoints);
          // Auto-trigger calibration
          const calib = calibrateSABR(parsedPoints, forwardPrice, T, beta);
          setAlpha(calib.params.alpha);
          setRho(calib.params.rho);
          setNu(calib.params.nu);
          setCalibrationStats({
            rmse: calib.rmse,
            maxError: calib.maxError,
            iterations: calib.iterations
          });
        }
      }
    });
  };

  // Run Monte Carlo Simulation
  const handleRunMonteCarlo = () => {
    setIsSimulating(true);
    setTimeout(() => {
      try {
        const res = simulateSABRMonteCarlo(
          forwardPrice,
          targetStrike,
          T,
          r,
          sabrParams,
          mcSimulations,
          mcSteps,
          mcAlgorithm
        );
        setMcResult(res);
      } finally {
        setIsSimulating(false);
      }
    }, 40);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Module 4
            </span>
            <h2 className="text-xl font-bold text-white">SABR Calculator &amp; SDE Simulator</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Hagan (2002) asymptotic implied volatility smile, Nelder-Mead parameter calibration (β=1 for equities), and Euler-Maruyama / Log-Truncation SDE Monte Carlo simulation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
            SABR &amp; SDE Theory
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-purple-600 text-white hover:bg-purple-500 transition shadow-lg shadow-purple-600/20"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Grid: SABR Parameters & Calibration Input */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SABR Parameters Card */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              1. SABR Parameters
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              F = ${forwardPrice.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Spot Price ($S)</label>
              <input
                type="number"
                step="0.5"
                value={spotPrice}
                onChange={(e) => setSpotPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Maturity (Days)</label>
              <input
                type="number"
                value={daysToMaturity}
                onChange={(e) => setDaysToMaturity(parseInt(e.target.value) || 1)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Alpha (<MathView math="\alpha" />) - Init Vol
              </label>
              <input
                type="number"
                step="0.01"
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-purple-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 flex items-center justify-between">
                <span>Beta (<MathView math="\beta" />)</span>
                <span className="text-[9px] text-emerald-400">Equity=1.0</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={beta}
                onChange={(e) => setBeta(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Rho (<MathView math="\rho" />) - Correlation
              </label>
              <input
                type="number"
                step="0.05"
                min="-0.99"
                max="0.99"
                value={rho}
                onChange={(e) => setRho(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-purple-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Nu (<MathView math="\nu" />) - Vol of Vol
              </label>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={nu}
                onChange={(e) => setNu(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-purple-300 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Calibration via CSV / Excel & Benchmark Datasets */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              2. Parameter Calibration (Fit to Market)
            </span>
            <span className="text-[10px] text-slate-400">
              {marketPoints.length} points
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Benchmark Smiles:</span>
              {(['SPY', 'AAPL', 'TSLA'] as const).map((sym) => (
                <button
                  key={sym}
                  onClick={() => {
                    const bm = BENCHMARK_SMILES[sym];
                    setSpotPrice(bm.F);
                    setMarketPoints(bm.points);
                    const calib = calibrateSABR(bm.points, bm.F, bm.T, 1.0);
                    setAlpha(calib.params.alpha);
                    setRho(calib.params.rho);
                    setNu(calib.params.nu);
                    setCalibrationStats({
                      rmse: calib.rmse,
                      maxError: calib.maxError,
                      iterations: calib.iterations
                    });
                  }}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                >
                  {sym}
                </button>
              ))}
            </div>

            {/* File Upload Box */}
            <div className="relative border border-dashed border-slate-700 rounded-xl p-3 text-center bg-slate-950/40 hover:bg-slate-950 transition">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
              <p className="text-[11px] text-slate-300">Upload CSV file (columns: Strike, ImpliedVol)</p>
              <p className="text-[10px] text-slate-500">Auto-calibrates (α, ρ, ν) with β=1 for equities</p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleCalibrate}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition shadow-sm"
              >
                Calibrate to Current Points
              </button>
            </div>

            {calibrationStats && (
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-0.5">
                <div className="flex justify-between text-slate-400">
                  <span>RMSE Error:</span>
                  <span className="text-emerald-400 font-bold">{(calibrationStats.rmse * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Max Error:</span>
                  <span className="text-slate-300">{(calibrationStats.maxError * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Optimization:</span>
                  <span className="text-slate-300">Nelder-Mead ({calibrationStats.iterations} iters)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Option Pricing & Mispricing Arbitrage Scanner */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              3. Option Valuation &amp; Arbitrage
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              SABR IV: {(targetOptionMetrics.iv * 100).toFixed(2)}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Target Strike ($K)</label>
              <input
                type="number"
                step="1"
                value={targetStrike}
                onChange={(e) => setTargetStrike(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Market Price ($)</label>
              <input
                type="number"
                step="0.1"
                value={targetMarketPrice}
                onChange={(e) => setTargetMarketPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Hagan Call Value:</span>
              <span className="text-white font-bold">${targetOptionMetrics.haganCall.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hagan Put Value:</span>
              <span className="text-white font-bold">${targetOptionMetrics.haganPut.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price Deviation:</span>
              <span className={targetOptionMetrics.priceDiff >= 0 ? 'text-amber-400' : 'text-blue-400'}>
                {targetOptionMetrics.priceDiff >= 0 ? '+' : ''}${targetOptionMetrics.priceDiff.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Arbitrage alert */}
          <div
            className={`p-2 rounded-lg border text-[11px] ${
              targetOptionMetrics.isMispriced
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            {targetOptionMetrics.arbitrageStrategy}
          </div>
        </div>
      </div>

      {/* Volatility Smile Graphical Chart */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              Implied Volatility Smile (Hagan Formula vs Market Quotes)
            </h3>
            <p className="text-xs text-slate-400">
              Analytical Hagan curve fitted to market option quotes; validates skew and curvature across strikes.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
              Hagan SABR IV
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />
              Market Quotes
            </span>
          </div>
        </div>

        {/* SVG Volatility Smile Chart */}
        <div className="h-60 w-full bg-slate-950/80 rounded-xl border border-slate-800 p-4 relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200" preserveAspectRatio="none">
            {(() => {
              const allVols = [
                ...smilePoints.map((p) => p.haganIV),
                ...marketPoints.map((p) => p.impliedVol)
              ];
              const minVol = Math.max(0.05, Math.min(...allVols) * 0.85);
              const maxVol = Math.max(...allVols) * 1.15;
              const minK = smilePoints[0].strike;
              const maxK = smilePoints[smilePoints.length - 1].strike;

              const getX = (k: number) => ((k - minK) / (maxK - minK)) * 600;
              const getY = (v: number) => 180 - ((v - minVol) / (maxVol - minVol)) * 160;

              const smilePath = smilePoints
                .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(pt.strike)} ${getY(pt.haganIV)}`)
                .join(' ');

              // ATM Forward marker X
              const forwardX = getX(forwardPrice);

              return (
                <>
                  {/* Grid Lines */}
                  <line x1="0" y1="180" x2="600" y2="180" stroke="rgba(255,255,255,0.08)" />
                  <line x1="0" y1="100" x2="600" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="0" y1="20" x2="600" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

                  {/* ATM Forward vertical dashed line */}
                  {forwardX >= 0 && forwardX <= 600 && (
                    <line
                      x1={forwardX}
                      y1="10"
                      x2={forwardX}
                      y2="180"
                      stroke="#818cf8"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Hagan Continuous Curve */}
                  <path
                    d={smilePath}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Smile Points */}
                  {smilePoints.map((pt, i) => (
                    <circle
                      key={i}
                      cx={getX(pt.strike)}
                      cy={getY(pt.haganIV)}
                      r="3"
                      fill="#c084fc"
                    />
                  ))}

                  {/* Market Data Points (Diamonds / Squares) */}
                  {marketPoints.map((m, idx) => {
                    const mx = getX(m.strike);
                    const my = getY(m.impliedVol);
                    if (mx < 0 || mx > 600) return null;
                    return (
                      <g key={idx}>
                        <rect
                          x={mx - 4}
                          y={my - 4}
                          width="8"
                          height="8"
                          transform={`rotate(45 ${mx} ${my})`}
                          fill="#fbbf24"
                          stroke="#78350f"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>

          {/* X Axis Strike Labels */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
            <span>K = ${smilePoints[0].strike.toFixed(0)}</span>
            <span className="text-indigo-400 font-bold">ATM Forward = ${forwardPrice.toFixed(0)}</span>
            <span>K = ${smilePoints[smilePoints.length - 1].strike.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* SDE Monte Carlo Differential Equation Simulator Section */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SDE Engine
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                Monte Carlo Differential Equation Simulation
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulates coupled SDEs <MathView math="dF_t = \alpha_t F_t^\beta dW_1" /> and <MathView math="d\alpha_t = \nu \alpha_t dW_2" /> to compute terminal asset distribution &amp; option payoff PV.
            </p>
          </div>

          <button
            onClick={handleRunMonteCarlo}
            disabled={isSimulating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs transition shadow-lg shadow-amber-600/20 shrink-0 self-start sm:self-auto"
          >
            {isSimulating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            {isSimulating ? 'Simulating Differential Paths...' : 'Run SDE Simulation'}
          </button>
        </div>

        {/* Simulator Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Numerical Algorithm</label>
            <select
              value={mcAlgorithm}
              onChange={(e) => setMcAlgorithm(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-medium"
            >
              <option value="full_truncation_log">Log-Transform / Full Truncation (Production Standard)</option>
              <option value="euler_maruyama">Standard Euler - Maruyama</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Number of Simulations (N)</label>
            <input
              type="number"
              step="1000"
              min="500"
              max="50000"
              value={mcSimulations}
              onChange={(e) => setMcSimulations(parseInt(e.target.value) || 1000)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Time Steps (M per path)</label>
            <input
              type="number"
              min="10"
              max="200"
              value={mcSteps}
              onChange={(e) => setMcSteps(parseInt(e.target.value) || 25)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Evaluation Strike ($K)</label>
            <input
              type="number"
              value={targetStrike}
              onChange={(e) => setTargetStrike(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
            />
          </div>
        </div>

        {/* Monte Carlo Results Display */}
        {mcResult && (
          <div className="space-y-4 pt-2">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Final Underlying Price (F_T)</span>
                <p className="text-lg font-bold font-mono text-white mt-1">
                  ${mcResult.finalForwardMean.toFixed(2)}
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  Std Dev: ±${mcResult.finalForwardStd.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Call Option Present Value</span>
                <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  ${mcResult.callPresentValue.toFixed(2)}
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  Hagan Analytical: ${mcResult.haganAnalyticalCallPV.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Monte Carlo Implied Vol</span>
                <p className="text-lg font-bold font-mono text-amber-400 mt-1">
                  {(mcResult.mcImpliedVol * 100).toFixed(2)}%
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  Hagan IV: {(mcResult.haganAnalyticalIV * 100).toFixed(2)}%
                </span>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Monte Carlo Precision</span>
                <p className="text-sm font-bold font-mono text-slate-200 mt-1">
                  SE: ±${mcResult.standardError.toFixed(3)}
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  95% CI: [${mcResult.confidenceInterval95[0]}, ${mcResult.confidenceInterval95[1]}]
                </span>
              </div>
            </div>

            {/* Visualizer: Sample Differential Equation Trajectories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Asset Path Simulation */}
              <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Underlying Forward Trajectories (dF_t)</span>
                  <span className="text-slate-400 font-mono">20 Sample Paths</span>
                </div>
                <div className="h-44 w-full relative">
                  <svg className="w-full h-full overflow-hidden" viewBox="0 0 400 150" preserveAspectRatio="none">
                    {(() => {
                      const allPoints = mcResult.samplePaths.flatMap((p) => p.forwardPath);
                      const minVal = Math.min(...allPoints) * 0.95;
                      const maxVal = Math.max(...allPoints) * 1.05;
                      const steps = mcResult.stepsCount;

                      const getX = (idx: number) => (idx / steps) * 400;
                      const getY = (val: number) => 140 - ((val - minVal) / (maxVal - minVal)) * 130;

                      return (
                        <>
                          {mcResult.samplePaths.map((p, pathIdx) => {
                            const pts = p.forwardPath.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
                            return (
                              <polyline
                                key={pathIdx}
                                points={pts}
                                fill="none"
                                stroke={pathIdx === 0 ? '#38bdf8' : 'rgba(56, 189, 248, 0.25)'}
                                strokeWidth={pathIdx === 0 ? '2' : '1'}
                              />
                            );
                          })}
                          {/* Strike line */}
                          <line
                            x1="0"
                            y1={getY(targetStrike)}
                            x2="400"
                            y2={getY(targetStrike)}
                            stroke="#f43f5e"
                            strokeDasharray="4 4"
                            strokeWidth="1.5"
                          />
                        </>
                      );
                    })()}
                  </svg>
                  <span className="absolute bottom-1 right-2 text-[10px] font-mono text-rose-400">
                    Strike $K = {targetStrike}
                  </span>
                </div>
              </div>

              {/* Stochastic Volatility Trajectory */}
              <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Stochastic Volatility Trajectories (dα_t)</span>
                  <span className="text-slate-400 font-mono">ν = {nu}</span>
                </div>
                <div className="h-44 w-full relative">
                  <svg className="w-full h-full overflow-hidden" viewBox="0 0 400 150" preserveAspectRatio="none">
                    {(() => {
                      const allVols = mcResult.samplePaths.flatMap((p) => p.volPath);
                      const minV = Math.max(0.001, Math.min(...allVols) * 0.85);
                      const maxV = Math.max(...allVols) * 1.15;
                      const steps = mcResult.stepsCount;

                      const getX = (idx: number) => (idx / steps) * 400;
                      const getY = (v: number) => 140 - ((v - minV) / (maxV - minV)) * 130;

                      return (
                        <>
                          {mcResult.samplePaths.map((p, pathIdx) => {
                            const pts = p.volPath.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
                            return (
                              <polyline
                                key={pathIdx}
                                points={pts}
                                fill="none"
                                stroke={pathIdx === 0 ? '#c084fc' : 'rgba(192, 132, 252, 0.25)'}
                                strokeWidth={pathIdx === 0 ? '2' : '1'}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                  <span className="absolute bottom-1 right-2 text-[10px] font-mono text-purple-400">
                    α₀ = {alpha}
                  </span>
                </div>
              </div>
            </div>

            {/* Terminal Price Distribution Histogram */}
            <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Terminal Price Distribution (Histogram of F_T)</span>
                <span className="text-slate-400 font-mono">
                  P5: ${mcResult.percentile5} | Median: ${mcResult.percentile50} | P95: ${mcResult.percentile95}
                </span>
              </div>
              <div className="flex items-end justify-between gap-1.5 h-24 pt-2">
                {mcResult.histogram.map((h, i) => {
                  const maxFreq = Math.max(...mcResult.histogram.map((x) => x.frequency), 1);
                  const barH = (h.frequency / maxFreq) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div
                        style={{ height: `${Math.max(4, barH)}%` }}
                        className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm hover:from-indigo-500 hover:to-indigo-300 transition"
                        title={`$${h.bucketStart} - $${h.bucketEnd}: ${h.frequency}%`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Min: ${mcResult.finalForwardMin}</span>
                <span>Strike $K: ${targetStrike}</span>
                <span>Max: ${mcResult.finalForwardMax}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printable Comprehensive Summary Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">SABR Implied Volatility &amp; Pricing Valuation Table</h3>
          <span className="text-xs font-mono text-slate-400">
            Forward F = ${forwardPrice.toFixed(2)} | r = {(r * 100).toFixed(1)}% | T = {daysToMaturity}d
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Strike (K)</th>
                <th className="px-3 py-2.5">Hagan IV</th>
                <th className="px-3 py-2.5">BS-76 Call</th>
                <th className="px-3 py-2.5">BS-76 Put</th>
                <th className="px-3 py-2.5">Density p(K)</th>
                <th className="px-3 py-2.5">Arbitrage / Convexity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {smilePoints.map((pt, i) => (
                <tr key={i} className={`hover:bg-slate-800/30 transition ${Math.abs(pt.strike - targetStrike) < 2 ? 'bg-indigo-950/20' : ''}`}>
                  <td className="px-3 py-2.5 font-bold text-white">
                    ${pt.strike.toFixed(2)}
                    {Math.abs(pt.strike - forwardPrice) < 5 && (
                      <span className="ml-1 text-[10px] text-indigo-400">(ATM)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-purple-400">
                    {(pt.haganIV * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2.5 text-slate-200">
                    ${pt.blackScholesCallPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-200">
                    ${pt.blackScholesPutPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">
                    {pt.density !== undefined ? pt.density.toFixed(5) : '-'}
                  </td>
                  <td className="px-3 py-2.5">
                    {pt.arbitrageWarning ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {pt.arbitrageWarning}
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1 font-sans">
                        <CheckCircle className="w-3.5 h-3.5" />
                        No Arbitrage (Convex)
                      </span>
                    )}
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
