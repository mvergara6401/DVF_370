/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ActiveModule, Navigation } from './components/Navigation';
import { PortfolioModule } from './components/PortfolioModule';
import { ArbitrageModule } from './components/ArbitrageModule';
import { HedgingModule } from './components/HedgingModule';
import { SABRModule } from './components/SABRModule';
import { HelpModal, HelpTopic } from './components/HelpModal';
import { fetchOnlineAssetQuote, POPULAR_TICKERS } from './services/marketData';
import { Activity, ShieldCheck, Terminal, Award } from 'lucide-react';

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('portfolio');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopic>('portfolio');

  // Live mini ticker ribbon data
  const [tickerQuotes, setTickerQuotes] = useState<
    Array<{ symbol: string; price: number; changePercent: number }>
  >([
    { symbol: 'SPY', price: 582.40, changePercent: 0.35 },
    { symbol: 'QQQ', price: 494.80, changePercent: 0.42 },
    { symbol: 'AAPL', price: 232.50, changePercent: -0.18 },
    { symbol: 'NVDA', price: 141.20, changePercent: 1.25 },
    { symbol: 'TSLA', price: 218.60, changePercent: -0.84 }
  ]);

  // Sync help topic whenever active module changes
  const handleOpenHelpForCurrent = () => {
    setHelpTopic(activeModule);
    setIsHelpOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 md:pb-10">
      {/* Top Navigation */}
      <Navigation
        activeModule={activeModule}
        onSelectModule={(mod) => {
          setActiveModule(mod);
          setHelpTopic(mod);
        }}
        onOpenHelp={handleOpenHelpForCurrent}
      />

      {/* Market Ticker Ribbon */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 py-1.5 px-4 overflow-x-auto text-[11px] font-mono scrollbar-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 whitespace-nowrap">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-300">Market Feeds:</span>
          </div>

          <div className="flex items-center gap-5">
            {tickerQuotes.map((t) => (
              <div key={t.symbol} className="flex items-center gap-1.5">
                <span className="font-bold text-slate-300">{t.symbol}</span>
                <span className="text-white">${t.price.toFixed(2)}</span>
                <span
                  className={
                    t.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {t.changePercent >= 0 ? '+' : ''}
                  {t.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-indigo-400">
            <Award className="w-3.5 h-3.5" />
            <span>Financial Engineering Quantitative Exam &amp; Desk Suite</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeModule === 'portfolio' && (
          <PortfolioModule onOpenHelp={handleOpenHelpForCurrent} />
        )}
        {activeModule === 'arbitrage' && (
          <ArbitrageModule onOpenHelp={handleOpenHelpForCurrent} />
        )}
        {activeModule === 'hedging' && (
          <HedgingModule onOpenHelp={handleOpenHelpForCurrent} />
        )}
        {activeModule === 'sabr' && (
          <SABRModule onOpenHelp={handleOpenHelpForCurrent} />
        )}
      </main>

      {/* Help Modal */}
      <HelpModal
        topic={helpTopic}
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Desktop Footer */}
      <footer className="hidden md:block border-t border-slate-800/80 mt-12 py-6 text-center text-xs text-slate-500 font-mono">
        <p>
          QuantCalc Financial Engineering Suite • European Options Portfolio Valuation • Synthetic Arbitrage • Dynamic Delta-Gamma Hedging • Hagan SABR Calibration &amp; Euler-Maruyama / Full-Truncation SDE Monte Carlo Simulation
        </p>
      </footer>
    </div>
  );
}
