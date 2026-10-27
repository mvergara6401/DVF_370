import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Activity,
  ArrowDownToLine,
  BarChart2,
  BookOpen,
  Cpu,
  Layers,
  Scale,
  Shield,
  Smartphone,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react';

export type ActiveModule = 'portfolio' | 'arbitrage' | 'hedging' | 'sabr';

interface NavigationProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  onOpenHelp: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeModule,
  onSelectModule,
  onOpenHelp
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-mono font-bold text-base text-white">𝚺</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">QuantCalc</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Mobile &amp; Web Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Financial Engineering &amp; Quantitative Derivatives
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => onSelectModule('portfolio')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'portfolio'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              1. Portfolio
            </button>

            <button
              onClick={() => onSelectModule('arbitrage')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'arbitrage'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              2. Arbitrage
            </button>

            <button
              onClick={() => onSelectModule('hedging')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'hedging'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              3. Δ &amp; Δ-Γ Hedge
            </button>

            <button
              onClick={() => onSelectModule('sabr')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'sabr'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-4 h-4" />
              4. SABR &amp; SDE
            </button>
          </nav>

          {/* Actions & PWA Install */}
          <div className="flex items-center gap-2">
            {/* Help Button */}
            <button
              onClick={onOpenHelp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition"
              title="Mathematical formulas and operational assumptions"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Formulas &amp; Help</span>
            </button>

            {/* In-App PWA Install Button */}
            {!isInstalled && isInstallable && (
              <button
                onClick={install}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}

            {!isInstalled && isIOS && (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700 transition"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span>iOS App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* iOS Installation Instruction Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
                <p className="text-xs text-slate-400">Add QuantCalc to your Home Screen</p>
              </div>
            </div>

            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <li>
                Tap the <strong>Share</strong> button (box with upward arrow) in the Safari toolbar.
              </li>
              <li>
                Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> in the top-right corner to install QuantCalc.
              </li>
            </ol>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Android & iPhone Touch Bar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => onSelectModule('portfolio')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition ${
            activeModule === 'portfolio' ? 'text-indigo-400 font-bold' : 'text-slate-400'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px]">Portfolio</span>
        </button>

        <button
          onClick={() => onSelectModule('arbitrage')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition ${
            activeModule === 'arbitrage' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Scale className="w-5 h-5" />
          <span className="text-[10px]">Arbitrage</span>
        </button>

        <button
          onClick={() => onSelectModule('hedging')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition ${
            activeModule === 'hedging' ? 'text-blue-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span className="text-[10px]">Hedging</span>
        </button>

        <button
          onClick={() => onSelectModule('sabr')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition ${
            activeModule === 'sabr' ? 'text-purple-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Cpu className="w-5 h-5" />
          <span className="text-[10px]">SABR &amp; SDE</span>
        </button>
      </nav>
    </>
  );
};
