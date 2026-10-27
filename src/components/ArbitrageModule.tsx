import React, { useState, useMemo } from 'react';
import { detectArbitrage } from '../utils/arbitrage';
import { fetchOnlineAssetQuote, POPULAR_TICKERS } from '../services/marketData';
import { blackScholesPrice } from '../utils/blackScholes';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  HelpCircle,
  RefreshCw,
  Scale,
  Sparkles,
  Zap
} from 'lucide-react';

interface ArbitrageModuleProps {
  onOpenHelp: () => void;
}

export const ArbitrageModule: React.FC<ArbitrageModuleProps> = ({ onOpenHelp }) => {
  const [ticker, setTicker] = useState('SPY');
  const [spotPrice, setSpotPrice] = useState(582.40);
  const [strike, setStrike] = useState(580.0);
  const [daysToMaturity, setDaysToMaturity] = useState(30);
  const [riskFreeRatePct, setRiskFreeRatePct] = useState(4.5);
  const [volatilityPct, setVolatilityPct] = useState(16.0);
  const [isFetching, setIsFetching] = useState(false);

  // Theoretical Black-Scholes benchmark prices
  const bsBenchmark = useMemo(() => {
    const T = daysToMaturity / 365;
    const r = riskFreeRatePct / 100;
    const sigma = volatilityPct / 100;
    const call = blackScholesPrice(spotPrice, strike, T, r, sigma, 'call');
    const put = blackScholesPrice(spotPrice, strike, T, r, sigma, 'put');
    return {
      call: Math.round(call * 100) / 100,
      put: Math.round(put * 100) / 100
    };
  }, [spotPrice, strike, daysToMaturity, riskFreeRatePct, volatilityPct]);

  // Market prices (user editable to create arbitrage situations)
  // Default to a small intentional mispricing to demonstrate arbitrage immediately
  const [marketCallPrice, setMarketCallPrice] = useState(14.80); // higher than fair value to demo conversion
  const [marketPutPrice, setMarketPutPrice] = useState(8.20);

  // Online spot fetch
  const handleFetchSpot = async () => {
    setIsFetching(true);
    try {
      const quote = await fetchOnlineAssetQuote(ticker);
      setSpotPrice(quote.price);
      setStrike(Math.round(quote.price));
      const T = daysToMaturity / 365;
      const r = riskFreeRatePct / 100;
      const sigma = volatilityPct / 100;
      const fairCall = blackScholesPrice(quote.price, Math.round(quote.price), T, r, sigma, 'call');
      const fairPut = blackScholesPrice(quote.price, Math.round(quote.price), T, r, sigma, 'put');
      setMarketCallPrice(Math.round((fairCall + 2.50) * 100) / 100);
      setMarketPutPrice(Math.round(fairPut * 100) / 100);
    } finally {
      setIsFetching(false);
    }
  };

  // Run Arbitrage Detector
  const result = useMemo(() => {
    return detectArbitrage({
      spotPrice,
      strike,
      timeToMaturityYears: daysToMaturity / 365,
      riskFreeRate: riskFreeRatePct / 100,
      marketCallPrice,
      marketPutPrice,
      contractMultiplier: 100
    });
  }, [spotPrice, strike, daysToMaturity, riskFreeRatePct, marketCallPrice, marketPutPrice]);

  // Scenarios to inject
  const handleInjectScenario = (scenario: 'overpriced_call' | 'overpriced_put' | 'sub_bound' | 'fair_parity') => {
    const T = daysToMaturity / 365;
    const r = riskFreeRatePct / 100;
    const sigma = volatilityPct / 100;
    const fairCall = blackScholesPrice(spotPrice, strike, T, r, sigma, 'call');
    const fairPut = blackScholesPrice(spotPrice, strike, T, r, sigma, 'put');

    if (scenario === 'overpriced_call') {
      setMarketCallPrice(Math.round((fairCall + 4.20) * 100) / 100);
      setMarketPutPrice(Math.round(fairPut * 100) / 100);
    } else if (scenario === 'overpriced_put') {
      setMarketCallPrice(Math.round(fairCall * 100) / 100);
      setMarketPutPrice(Math.round((fairPut + 5.50) * 100) / 100);
    } else if (scenario === 'sub_bound') {
      const lowerBoundCall = Math.max(0, spotPrice - strike * Math.exp(-r * T));
      setMarketCallPrice(Math.max(0.50, Math.round((lowerBoundCall - 2.00) * 100) / 100));
      setMarketPutPrice(Math.round(fairPut * 100) / 100);
    } else {
      // Fair Parity
      const bondPV = strike * Math.exp(-r * T);
      setMarketCallPrice(Math.round(fairCall * 100) / 100);
      setMarketPutPrice(Math.round((fairCall - spotPrice + bondPV) * 100) / 100);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Module 2
            </span>
            <h2 className="text-xl font-bold text-white">Synthetic Arbitrage Calculator</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Detects Put-Call Parity violations, constructs synthetic options via stock &amp; debt, and generates exact execution steps.
          </p>
        </div>

        <button
          onClick={onOpenHelp}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700 self-start sm:self-auto"
        >
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          Parity Proofs &amp; Help
        </button>
      </div>

      {/* Input Parameters Card */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-400" />
            Market Quotes &amp; Asset Parameters
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Quick Scenarios:</span>
            <button
              onClick={() => handleInjectScenario('overpriced_call')}
              className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-emerald-400 hover:bg-slate-700"
            >
              Overpriced Call (+4.20)
            </button>
            <button
              onClick={() => handleInjectScenario('overpriced_put')}
              className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-purple-400 hover:bg-slate-700"
            >
              Overpriced Put (+5.50)
            </button>
            <button
              onClick={() => handleInjectScenario('fair_parity')}
              className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700"
            >
              Reset Fair Parity
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Underlying Ticker</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono uppercase"
              />
              <button
                onClick={handleFetchSpot}
                disabled={isFetching}
                title="Fetch online market quote"
                className="p-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Spot Price (S)</label>
            <input
              type="number"
              step="0.01"
              value={spotPrice}
              onChange={(e) => setSpotPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Strike Price (K)</label>
            <input
              type="number"
              step="0.5"
              value={strike}
              onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Days to Maturity</label>
            <input
              type="number"
              value={daysToMaturity}
              onChange={(e) => setDaysToMaturity(parseInt(e.target.value) || 1)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Risk-Free Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={riskFreeRatePct}
              onChange={(e) => setRiskFreeRatePct(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 flex items-center justify-between">
              <span>Market Call ($C)</span>
              <span className="text-[10px] text-slate-500 font-mono">BS: {bsBenchmark.call}</span>
            </label>
            <input
              type="number"
              step="0.05"
              value={marketCallPrice}
              onChange={(e) => setMarketCallPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 flex items-center justify-between">
              <span>Market Put ($P)</span>
              <span className="text-[10px] text-slate-500 font-mono">BS: {bsBenchmark.put}</span>
            </label>
            <input
              type="number"
              step="0.05"
              value={marketPutPrice}
              onChange={(e) => setMarketPutPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-purple-400 font-mono font-bold"
            />
          </div>
        </div>
      </div>

      {/* Parity & Synthetic Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Market vs. Synthetic Call</span>
          <div className="flex items-baseline justify-between mt-2">
            <div>
              <span className="text-xs text-slate-500 block">Market Call:</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                ${result.marketCallPrice.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Synthetic Call:</span>
              <span className="text-lg font-bold font-mono text-white">
                ${result.syntheticCallPrice.toFixed(2)}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Diff: ${(result.marketCallPrice - result.syntheticCallPrice).toFixed(2)} / share
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Market vs. Synthetic Put</span>
          <div className="flex items-baseline justify-between mt-2">
            <div>
              <span className="text-xs text-slate-500 block">Market Put:</span>
              <span className="text-lg font-bold font-mono text-purple-400">
                ${result.marketPutPrice.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Synthetic Put:</span>
              <span className="text-lg font-bold font-mono text-white">
                ${result.syntheticPutPrice.toFixed(2)}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Diff: ${(result.marketPutPrice - result.syntheticPutPrice).toFixed(2)} / share
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Zero-Coupon Bond Present Value</span>
          <p className="text-lg font-bold font-mono text-white mt-2">
            ${(strike * Math.exp(-(riskFreeRatePct / 100) * (daysToMaturity / 365))).toFixed(2)}
          </p>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Face Value: ${strike.toFixed(2)} at maturity
          </span>
        </div>
      </div>

      {/* Arbitrage Opportunity Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          result.hasArbitrage
            ? 'bg-emerald-950/30 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
            : 'bg-slate-900/80 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              result.hasArbitrage
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {result.hasArbitrage ? <Zap className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {result.name}
              {result.hasArbitrage && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-slate-950">
                  Risk-Free Profit
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">{result.summaryNote}</p>
          </div>
        </div>

        {result.hasArbitrage && (
          <div className="bg-slate-900/90 px-4 py-2.5 rounded-xl border border-emerald-500/30 font-mono text-right shrink-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Upfront Arbitrage Profit</span>
            <span className="text-lg font-bold text-emerald-400">
              +${result.profitPerContract.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 block">per 1 contract (100 shares)</span>
          </div>
        )}
      </div>

      {/* Step-by-Step Strategy Table */}
      {result.hasArbitrage && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Step-by-Step Execution Strategy
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Net Upfront Cashflow: +${result.profitPerContract.toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Step</th>
                  <th className="px-3 py-2.5">Action</th>
                  <th className="px-3 py-2.5">Financial Instrument</th>
                  <th className="px-3 py-2.5">Quantity</th>
                  <th className="px-3 py-2.5">Unit Price</th>
                  <th className="px-3 py-2.5">Initial Cash Flow</th>
                  <th className="px-3 py-2.5">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {result.steps.map((st) => (
                  <tr key={st.stepNumber} className="hover:bg-slate-800/30 transition">
                    <td className="px-3 py-2.5 text-slate-400 font-bold">{st.stepNumber}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.action === 'BUY'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : st.action === 'SELL'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : st.action === 'BORROW'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {st.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-sans font-medium text-white">{st.asset}</td>
                    <td className="px-3 py-2.5 text-slate-300">{st.quantity}</td>
                    <td className="px-3 py-2.5 text-slate-300">${st.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-bold">
                      <span className={st.cashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {st.cashFlow >= 0 ? '+' : ''}${st.cashFlow.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-sans text-slate-400 text-[11px]">{st.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Terminal Payoff Verification Matrix */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Terminal Payoff Matrix at Expiration (Zero Risk Verification)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-800/40 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Stock Price Scenario at Expiry</th>
                    <th className="px-3 py-2">Call Payoff</th>
                    <th className="px-3 py-2">Put Payoff</th>
                    <th className="px-3 py-2">Stock Payoff</th>
                    <th className="px-3 py-2">Bond Payoff</th>
                    <th className="px-3 py-2">Terminal Cash</th>
                    <th className="px-3 py-2 font-bold text-emerald-400">Net Riskless Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {result.payoffScenarios.map((sc, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition">
                      <td className="px-3 py-2 font-sans font-medium text-white">
                        {sc.terminalPriceLabel}
                      </td>
                      <td className="px-3 py-2 text-slate-400">${sc.callPayoff.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400">${sc.putPayoff.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400">${sc.stockPayoff.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400">${sc.bondPayoff.toFixed(2)}</td>
                      <td className="px-3 py-2 font-bold text-slate-200">${sc.totalTerminalPayoff.toFixed(2)}</td>
                      <td className="px-3 py-2 font-bold text-emerald-400">
                        +${sc.netRisklessProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 italic mt-1">
              Notice: The terminal cash flow is identically $0 (or positive) under every scenario. The upfront net cash collected is 100% risk-free pure arbitrage profit!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
