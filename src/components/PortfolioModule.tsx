import React, { useState, useMemo } from 'react';
import { OptionPosition, PortfolioSummary } from '../types/quant';
import { blackScholesPrice, calculateGreeks } from '../utils/blackScholes';
import { fetchOnlineAssetQuote, POPULAR_TICKERS } from '../services/marketData';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  HelpCircle,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Sliders,
  Sparkles
} from 'lucide-react';

interface PortfolioModuleProps {
  onOpenHelp: () => void;
}

const INITIAL_POSITIONS: OptionPosition[] = [
  {
    id: 'pos-1',
    ticker: 'SPY',
    optionType: 'call',
    positionType: 'long',
    strike: 580,
    spotPrice: 582.40,
    timeToMaturityYears: 30 / 365,
    riskFreeRate: 0.045,
    volatility: 0.16,
    contracts: 5,
    multiplier: 100,
    entryPrice: 10.20
  },
  {
    id: 'pos-2',
    ticker: 'SPY',
    optionType: 'put',
    positionType: 'long',
    strike: 575,
    spotPrice: 582.40,
    timeToMaturityYears: 30 / 365,
    riskFreeRate: 0.045,
    volatility: 0.17,
    contracts: 5,
    multiplier: 100,
    entryPrice: 5.40
  },
  {
    id: 'pos-3',
    ticker: 'AAPL',
    optionType: 'call',
    positionType: 'short',
    strike: 240,
    spotPrice: 232.50,
    timeToMaturityYears: 45 / 365,
    riskFreeRate: 0.045,
    volatility: 0.25,
    contracts: 10,
    multiplier: 100,
    entryPrice: 4.80
  }
];

export const PortfolioModule: React.FC<PortfolioModuleProps> = ({ onOpenHelp }) => {
  const [positions, setPositions] = useState<OptionPosition[]>(INITIAL_POSITIONS);
  const [isFetching, setIsFetching] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'positions' | 'risk_profile'>('positions');

  // New Position Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTicker, setNewTicker] = useState('NVDA');
  const [newOptionType, setNewOptionType] = useState<'call' | 'put'>('call');
  const [newPositionType, setNewPositionType] = useState<'long' | 'short'>('long');
  const [newStrike, setNewStrike] = useState(140);
  const [newSpotPrice, setNewSpotPrice] = useState(141.20);
  const [newDaysToMaturity, setNewDaysToMaturity] = useState(30);
  const [newRate, setNewRate] = useState(4.5); // %
  const [newVol, setNewVol] = useState(42.0); // %
  const [newContracts, setNewContracts] = useState(5);
  const [newMultiplier, setNewMultiplier] = useState(100);
  const [newEntryPrice, setNewEntryPrice] = useState(6.50);

  // Compute calculated metrics for each position
  const calculatedPositions = useMemo(() => {
    return positions.map((pos) => {
      const bsPrice = blackScholesPrice(
        pos.spotPrice,
        pos.strike,
        pos.timeToMaturityYears,
        pos.riskFreeRate,
        pos.volatility,
        pos.optionType
      );

      const intrinsicValue =
        pos.optionType === 'call'
          ? Math.max(0, pos.spotPrice - pos.strike)
          : Math.max(0, pos.strike - pos.spotPrice);

      const timeValue = Math.max(0, bsPrice - intrinsicValue);
      const sign = pos.positionType === 'long' ? 1 : -1;
      const totalUnits = pos.contracts * pos.multiplier;
      const marketValue = sign * totalUnits * bsPrice;
      const costBasis = sign * totalUnits * pos.entryPrice;
      const unrealizedPnL = pos.positionType === 'long'
        ? totalUnits * (bsPrice - pos.entryPrice)
        : totalUnits * (pos.entryPrice - bsPrice);

      const greeks = calculateGreeks(
        pos.spotPrice,
        pos.strike,
        pos.timeToMaturityYears,
        pos.riskFreeRate,
        pos.volatility,
        pos.optionType
      );

      return {
        ...pos,
        bsPrice,
        intrinsicValue,
        timeValue,
        marketValue,
        costBasis,
        unrealizedPnL,
        delta: greeks.delta,
        gamma: greeks.gamma,
        vega: greeks.vega,
        theta: greeks.theta,
        rho: greeks.rho
      };
    });
  }, [positions]);

  // Portfolio level aggregated summary
  const summary: PortfolioSummary = useMemo(() => {
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let totalPnL = 0;
    let totalIntrinsicValue = 0;
    let totalTimeValue = 0;
    let netDelta = 0;
    let netGamma = 0;
    let netVega = 0;
    let netTheta = 0;
    let netRho = 0;

    for (const p of calculatedPositions) {
      totalMarketValue += p.marketValue || 0;
      totalCostBasis += Math.abs(p.costBasis || 0);
      totalPnL += p.unrealizedPnL || 0;

      const sign = p.positionType === 'long' ? 1 : -1;
      const units = p.contracts * p.multiplier;

      totalIntrinsicValue += sign * (p.intrinsicValue || 0) * units;
      totalTimeValue += sign * (p.timeValue || 0) * units;

      netDelta += sign * (p.delta || 0) * units;
      netGamma += sign * (p.gamma || 0) * units;
      netVega += sign * (p.vega || 0) * units;
      netTheta += sign * (p.theta || 0) * units;
      netRho += sign * (p.rho || 0) * units;
    }

    const totalPnLPercent = totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0;

    return {
      totalMarketValue,
      totalCostBasis,
      totalPnL,
      totalPnLPercent,
      totalIntrinsicValue,
      totalTimeValue,
      netDelta,
      netGamma,
      netVega,
      netTheta,
      netRho
    };
  }, [calculatedPositions]);

  // Fetch online asset price for a specific position
  const handleFetchPrice = async (posId: string, ticker: string) => {
    setIsFetching((prev) => ({ ...prev, [posId]: true }));
    try {
      const quote = await fetchOnlineAssetQuote(ticker);
      setPositions((prev) =>
        prev.map((p) => (p.id === posId ? { ...p, spotPrice: quote.price } : p))
      );
    } finally {
      setIsFetching((prev) => ({ ...prev, [posId]: false }));
    }
  };

  // Add position handler
  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    const newPos: OptionPosition = {
      id: `pos-${Date.now()}`,
      ticker: newTicker.toUpperCase(),
      optionType: newOptionType,
      positionType: newPositionType,
      strike: Number(newStrike),
      spotPrice: Number(newSpotPrice),
      timeToMaturityYears: Number(newDaysToMaturity) / 365,
      riskFreeRate: Number(newRate) / 100,
      volatility: Number(newVol) / 100,
      contracts: Number(newContracts),
      multiplier: Number(newMultiplier),
      entryPrice: Number(newEntryPrice)
    };
    setPositions((prev) => [...prev, newPos]);
    setShowAddForm(false);
  };

  // Delete position
  const handleDeletePosition = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  // Quick Strategy Templates
  const handleLoadTemplate = (type: 'straddle' | 'bull_call' | 'protective_put') => {
    if (type === 'straddle') {
      setPositions([
        {
          id: `pos-${Date.now()}-1`,
          ticker: 'NVDA',
          optionType: 'call',
          positionType: 'long',
          strike: 140,
          spotPrice: 141.20,
          timeToMaturityYears: 30 / 365,
          riskFreeRate: 0.045,
          volatility: 0.42,
          contracts: 10,
          multiplier: 100,
          entryPrice: 7.20
        },
        {
          id: `pos-${Date.now()}-2`,
          ticker: 'NVDA',
          optionType: 'put',
          positionType: 'long',
          strike: 140,
          spotPrice: 141.20,
          timeToMaturityYears: 30 / 365,
          riskFreeRate: 0.045,
          volatility: 0.44,
          contracts: 10,
          multiplier: 100,
          entryPrice: 6.10
        }
      ]);
    } else if (type === 'bull_call') {
      setPositions([
        {
          id: `pos-${Date.now()}-1`,
          ticker: 'SPY',
          optionType: 'call',
          positionType: 'long',
          strike: 580,
          spotPrice: 582.40,
          timeToMaturityYears: 45 / 365,
          riskFreeRate: 0.045,
          volatility: 0.16,
          contracts: 10,
          multiplier: 100,
          entryPrice: 11.50
        },
        {
          id: `pos-${Date.now()}-2`,
          ticker: 'SPY',
          optionType: 'call',
          positionType: 'short',
          strike: 600,
          spotPrice: 582.40,
          timeToMaturityYears: 45 / 365,
          riskFreeRate: 0.045,
          volatility: 0.15,
          contracts: 10,
          multiplier: 100,
          entryPrice: 3.20
        }
      ]);
    } else {
      setPositions([
        {
          id: `pos-${Date.now()}-1`,
          ticker: 'AAPL',
          optionType: 'put',
          positionType: 'long',
          strike: 230,
          spotPrice: 232.50,
          timeToMaturityYears: 60 / 365,
          riskFreeRate: 0.045,
          volatility: 0.25,
          contracts: 5,
          multiplier: 100,
          entryPrice: 5.80
        }
      ]);
    }
  };

  // Scenario stress test P&L curve (-20% to +20% spot shift)
  const stressCurve = useMemo(() => {
    const shifts = [-0.20, -0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15, 0.20];
    return shifts.map((pct) => {
      let totalShiftValue = 0;
      for (const p of calculatedPositions) {
        const shiftedSpot = p.spotPrice * (1 + pct);
        const priceAtShift = blackScholesPrice(
          shiftedSpot,
          p.strike,
          p.timeToMaturityYears,
          p.riskFreeRate,
          p.volatility,
          p.optionType
        );
        const sign = p.positionType === 'long' ? 1 : -1;
        totalShiftValue += sign * p.contracts * p.multiplier * priceAtShift;
      }
      const shiftPnL = totalShiftValue - summary.totalCostBasis;
      return {
        percentLabel: `${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}%`,
        shiftPnL: Math.round(shiftPnL)
      };
    });
  }, [calculatedPositions, summary.totalCostBasis]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Module Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Module 1
            </span>
            <h2 className="text-xl font-bold text-white">Portfolio Evaluation</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calculates market values, intrinsic/time values, Greeks, and P&amp;L of European option portfolios with real-time quote feeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            Theory &amp; Help
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Position
          </button>
        </div>
      </div>

      {/* Portfolio Aggregate Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Total Market Value</span>
          <p className="text-xl font-bold font-mono text-white mt-1">
            ${summary.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500">
            Cost Basis: ${summary.totalCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Unrealized P&amp;L</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-xl font-bold font-mono ${summary.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {summary.totalPnL >= 0 ? '+' : ''}${summary.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className={`text-[11px] font-mono font-medium ${summary.totalPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ({summary.totalPnLPercent >= 0 ? '+' : ''}{summary.totalPnLPercent.toFixed(2)}%)
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Intrinsic vs Time Value</span>
          <p className="text-sm font-bold font-mono text-indigo-300 mt-1">
            Int: ${summary.totalIntrinsicValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs font-mono text-slate-400">
            Time: ${summary.totalTimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Portfolio Greeks</span>
          <div className="grid grid-cols-2 gap-1 text-[11px] font-mono mt-1">
            <span className="text-indigo-400">Δ: {summary.netDelta.toFixed(1)} shs</span>
            <span className="text-indigo-400">Γ: {summary.netGamma.toFixed(2)}</span>
            <span className="text-indigo-400">𝒱: ${summary.netVega.toFixed(1)}/1%</span>
            <span className="text-indigo-400">Θ: ${summary.netTheta.toFixed(1)}/day</span>
          </div>
        </div>
      </div>

      {/* Preset Strategies Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">Preset Quant Portfolios:</span>
          <button
            onClick={() => handleLoadTemplate('straddle')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            Earnings Straddle (NVDA)
          </button>
          <button
            onClick={() => handleLoadTemplate('bull_call')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            Bull Call Spread (SPY)
          </button>
          <button
            onClick={() => handleLoadTemplate('protective_put')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            Protective Put (AAPL)
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              activeTab === 'positions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab('risk_profile')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              activeTab === 'risk_profile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            P&amp;L Stress Test
          </button>
        </div>
      </div>

      {/* Main View: Positions Table or Stress Curve */}
      {activeTab === 'positions' ? (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Underlying</th>
                  <th className="px-3 py-3">Type / Pos</th>
                  <th className="px-3 py-3">Strike (K)</th>
                  <th className="px-3 py-3">Spot (S)</th>
                  <th className="px-3 py-3">Days / Vol</th>
                  <th className="px-3 py-3">BS Price</th>
                  <th className="px-3 py-3">Intrinsic / Extrinsic</th>
                  <th className="px-3 py-3">Market Value</th>
                  <th className="px-3 py-3">P&amp;L</th>
                  <th className="px-3 py-3">Greeks (Δ / Γ / 𝒱)</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {calculatedPositions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-slate-500">
                      No options positions in portfolio. Click &quot;Add Position&quot; or choose a preset.
                    </td>
                  </tr>
                ) : (
                  calculatedPositions.map((p) => {
                    const days = Math.round(p.timeToMaturityYears * 365);
                    const isPositivePnL = (p.unrealizedPnL || 0) >= 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-medium text-white flex items-center gap-1.5">
                          <span className="font-bold text-indigo-400">{p.ticker}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {p.contracts}x{p.multiplier}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.positionType === 'long'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {p.positionType.toUpperCase()}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.optionType === 'call'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              }`}
                            >
                              {p.optionType.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono font-medium text-slate-200">
                          ${p.strike.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={p.spotPrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setPositions((prev) =>
                                  prev.map((item) => (item.id === p.id ? { ...item, spotPrice: val } : item))
                                );
                              }}
                              className="w-20 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs focus:border-indigo-500 outline-none"
                            />
                            <button
                              onClick={() => handleFetchPrice(p.id, p.ticker)}
                              disabled={isFetching[p.id]}
                              title="Fetch real-time online price"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${isFetching[p.id] ? 'animate-spin text-indigo-400' : ''}`}
                              />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-400 text-[11px]">
                          {days}d / {(p.volatility * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 font-mono font-semibold text-white">
                          ${p.bsPrice?.toFixed(2)}
                          <span className="block text-[10px] text-slate-500">
                            Entry: ${p.entryPrice.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px]">
                          <span className="text-indigo-300 font-medium">
                            Int: ${p.intrinsicValue?.toFixed(2)}
                          </span>
                          <span className="block text-slate-400">
                            Time: ${p.timeValue?.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono font-semibold text-white">
                          ${p.marketValue?.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 font-mono font-semibold">
                          <span className={isPositivePnL ? 'text-emerald-400' : 'text-rose-400'}>
                            {isPositivePnL ? '+' : ''}${p.unrealizedPnL?.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-slate-300">
                          Δ {p.delta?.toFixed(2)} | Γ {p.gamma?.toFixed(3)}
                          <span className="block text-slate-500">
                            𝒱 ${p.vega?.toFixed(2)} | Θ ${p.theta?.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => handleDeletePosition(p.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Remove position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Stress Profile View */
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Portfolio P&amp;L Stress Test</h3>
              <p className="text-xs text-slate-400">
                Projected total portfolio P&amp;L under underlying asset price shocks from -20% to +20%.
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-400">Black-Scholes Repricing</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 pt-2">
            {stressCurve.map((pt, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-xl border text-center transition ${
                  pt.percentLabel === '0%'
                    ? 'bg-indigo-950/40 border-indigo-500/40 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <span className="text-[11px] font-mono font-bold text-slate-400 block">
                  {pt.percentLabel}
                </span>
                <span
                  className={`text-xs font-mono font-bold mt-1 block ${
                    pt.shiftPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {pt.shiftPnL >= 0 ? '+' : ''}${pt.shiftPnL.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* SVG Bar Chart Visualization */}
          <div className="h-44 w-full bg-slate-950/90 rounded-xl border border-slate-800/80 p-4 flex flex-col justify-end">
            <div className="flex items-end justify-between gap-2 h-32 w-full">
              {stressCurve.map((pt, i) => {
                const maxAbs = Math.max(...stressCurve.map((x) => Math.abs(x.shiftPnL)), 100);
                const barHeightPct = Math.min(100, (Math.abs(pt.shiftPnL) / maxAbs) * 80);
                const isPos = pt.shiftPnL >= 0;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      style={{ height: `${Math.max(6, barHeightPct)}%` }}
                      className={`w-full max-w-[36px] rounded-t-sm transition-all ${
                        isPos
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm shadow-emerald-500/20'
                          : 'bg-gradient-to-t from-rose-600 to-rose-400 shadow-sm shadow-rose-500/20'
                      }`}
                    />
                    <span className="text-[10px] font-mono text-slate-400 mt-2">{pt.percentLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Position Modal Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add European Option Position</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPosition} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Underlying Ticker</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono uppercase"
                      required
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const quote = await fetchOnlineAssetQuote(newTicker);
                        setNewSpotPrice(quote.price);
                        setNewStrike(Math.round(quote.price));
                      }}
                      className="px-2 py-1 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
                      title="Fetch live market price"
                    >
                      Fetch
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Current Spot Price ($S)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSpotPrice}
                    onChange={(e) => setNewSpotPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Option Type</label>
                  <select
                    value={newOptionType}
                    onChange={(e) => setNewOptionType(e.target.value as 'call' | 'put')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="call">Call</option>
                    <option value="put">Put</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Position Type</label>
                  <select
                    value={newPositionType}
                    onChange={(e) => setNewPositionType(e.target.value as 'long' | 'short')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="long">Long (Buy)</option>
                    <option value="short">Short (Sell)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Strike ($K)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newStrike}
                    onChange={(e) => setNewStrike(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Days to Maturity</label>
                  <input
                    type="number"
                    value={newDaysToMaturity}
                    onChange={(e) => setNewDaysToMaturity(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Volatility (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newVol}
                    onChange={(e) => setNewVol(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Contracts Qty</label>
                  <input
                    type="number"
                    value={newContracts}
                    onChange={(e) => setNewContracts(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Multiplier (shares)</label>
                  <input
                    type="number"
                    value={newMultiplier}
                    onChange={(e) => setNewMultiplier(parseInt(e.target.value) || 100)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Entry Price ($/sh)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={newEntryPrice}
                    onChange={(e) => setNewEntryPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
                >
                  Confirm &amp; Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
