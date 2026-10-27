import React from 'react';
import { MathView } from './MathView';
import { BookOpen, CheckCircle, HelpCircle, Info, X } from 'lucide-react';

export type HelpTopic = 'portfolio' | 'arbitrage' | 'hedging' | 'sabr';

interface HelpModalProps {
  topic: HelpTopic;
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ topic, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {topic === 'portfolio' && 'Portfolio Evaluation: Theory & Mathematics'}
                {topic === 'arbitrage' && 'Synthetic Arbitrage: Parity & Mechanics'}
                {topic === 'hedging' && 'Dynamic Delta & Delta-Gamma Hedging'}
                {topic === 'sabr' && 'SABR Model: Hagan Formula & SDE Simulation'}
              </h3>
              <p className="text-xs text-slate-400">
                Mathematical derivations, operational assumptions, and financial formulas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {topic === 'portfolio' && (
            <>
              {/* Section 1 */}
              <div>
                <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-400" />
                  Black-Scholes-Merton Partial Differential Equation
                </h4>
                <p className="leading-relaxed text-slate-300 mb-2">
                  Under the risk-neutral measure <MathView math="\mathbb{Q}" />, any European derivative <MathView math="V(S, t)" /> satisfies the celebrated Black-Scholes PDE:
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <MathView
                    block
                    math="\frac{\partial V}{\partial t} + \frac{1}{2}\sigma^2 S^2 \frac{\partial^2 V}{\partial S^2} + r S \frac{\partial V}{\partial S} - r V = 0"
                  />
                </div>
              </div>

              {/* Section 2 */}
              <div>
                <h4 className="text-base font-semibold text-white mb-2">European Call & Put Pricing Solutions</h4>
                <p className="leading-relaxed mb-2">
                  For non-dividend paying stocks, the closed-form solutions are:
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <MathView block math="d_1 = \frac{\ln(S/K) + \left(r + \frac{\sigma^2}{2}\right)T}{\sigma \sqrt{T}}, \quad d_2 = d_1 - \sigma \sqrt{T}" />
                  <MathView block math="C(S, t) = S \Phi(d_1) - K e^{-rT} \Phi(d_2)" />
                  <MathView block math="P(S, t) = K e^{-rT} \Phi(-d_2) - S \Phi(-d_1)" />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Where <MathView math="\Phi(x)" /> is the cumulative distribution function of the standard normal distribution <MathView math="\mathcal{N}(0, 1)" />.
                </p>
              </div>

              {/* Section 3 */}
              <div>
                <h4 className="text-base font-semibold text-white mb-2">Intrinsic Value vs. Time (Extrinsic) Value</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                    <p className="font-semibold text-slate-200 mb-1">Intrinsic Value</p>
                    <MathView block math="\text{Call Intrinsic} = \max(0, S - K)" />
                    <MathView block math="\text{Put Intrinsic} = \max(0, K - S)" />
                    <p className="text-xs text-slate-400 mt-2">The immediate payoff if exercised now.</p>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                    <p className="font-semibold text-slate-200 mb-1">Time (Extrinsic) Value</p>
                    <MathView block math="\text{Time Value} = V_{\text{market}} - \text{Intrinsic Value}" />
                    <p className="text-xs text-slate-400 mt-2">Reflects probability of further favorable movements before maturity.</p>
                  </div>
                </div>
              </div>

              {/* Section 4 */}
              <div>
                <h4 className="text-base font-semibold text-white mb-2">Operational Assumptions</h4>
                <ul className="space-y-1.5 list-disc list-inside text-slate-300">
                  <li><strong>Geometric Brownian Motion:</strong> Asset price follows <MathView math="dS_t = \mu S_t dt + \sigma S_t dW_t" /> with constant volatility <MathView math="\sigma" />.</li>
                  <li><strong>Constant Risk-Free Rate:</strong> Borrowing and lending occur at known flat interest rate <MathView math="r" />.</li>
                  <li><strong>Frictionless Markets:</strong> Zero transaction costs, no taxes, no bid-ask spread, and unlimited short-selling.</li>
                  <li><strong>No Arbitrage:</strong> Prices adjust immediately so no risk-free arbitrage survives.</li>
                </ul>
              </div>

              {/* Section 5 */}
              <div>
                <h4 className="text-base font-semibold text-white mb-2">Option Greeks (Sensitivities)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2">Greek</th>
                        <th className="py-2">Definition</th>
                        <th className="py-2">Call Formula</th>
                        <th className="py-2">Put Formula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      <tr>
                        <td className="py-2 text-indigo-400 font-bold">Delta (Δ)</td>
                        <td className="py-2 font-sans">∂V / ∂S</td>
                        <td className="py-2">Φ(d₁)</td>
                        <td className="py-2">Φ(d₁) - 1</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-400 font-bold">Gamma (Γ)</td>
                        <td className="py-2 font-sans">∂²V / ∂S²</td>
                        <td className="py-2" colSpan={2}>ϕ(d₁) / (S · σ · √T)</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-400 font-bold">Vega (𝒱)</td>
                        <td className="py-2 font-sans">∂V / ∂σ</td>
                        <td className="py-2" colSpan={2}>S · √T · ϕ(d₁)</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-400 font-bold">Theta (Θ)</td>
                        <td className="py-2 font-sans">∂V / ∂t</td>
                        <td className="py-2">-Sϕσ/(2√T) - rKe⁻ʳᵀΦ(d₂)</td>
                        <td className="py-2">-Sϕσ/(2√T) + rKe⁻ʳᵀΦ(-d₂)</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-400 font-bold">Rho (ρ)</td>
                        <td className="py-2 font-sans">∂V / ∂r</td>
                        <td className="py-2">K·T·e⁻ʳᵀ·Φ(d₂)</td>
                        <td className="py-2">-K·T·e⁻ʳᵀ·Φ(-d₂)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {topic === 'arbitrage' && (
            <>
              <div>
                <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-400" />
                  Put-Call Parity Theorem
                </h4>
                <p className="leading-relaxed mb-2">
                  For European options with identical strike <MathView math="K" /> and maturity <MathView math="T" />, no-arbitrage guarantees the exact balance:
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                  <MathView block math="C - P = S - K e^{-rT}" />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Where <MathView math="K e^{-rT}" /> is the present value of a zero-coupon bond paying face value <MathView math="K" /> at maturity.
                </p>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Synthetic Option Replication</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                    <p className="font-semibold text-emerald-400 mb-1">Synthetic Call</p>
                    <MathView block math="C_{\text{synth}} = S + P - K e^{-rT}" />
                    <p className="text-xs text-slate-400 mt-1">Replicated via: Long 1 Stock + Long 1 Put + Borrow <MathView math="K e^{-rT}" />.</p>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                    <p className="font-semibold text-emerald-400 mb-1">Synthetic Put</p>
                    <MathView block math="P_{\text{synth}} = K e^{-rT} + C - S" />
                    <p className="text-xs text-slate-400 mt-1">Replicated via: Lend <MathView math="K e^{-rT}" /> + Long 1 Call + Short 1 Stock.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Arbitrage Exploitation Strategies</h4>
                <div className="space-y-3">
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <p className="font-bold text-amber-400">Case A: Conversion (Call Overpriced: <MathView math="C > C_{\text{synth}}" />)</p>
                    <p className="text-xs text-slate-300 mt-1">
                      1. Sell the expensive Call (+C).<br />
                      2. Buy the cheap Put (-P).<br />
                      3. Buy 1 share of Stock (-S).<br />
                      4. Borrow <MathView math="K e^{-rT}" /> (+Cash).<br />
                      <strong>Result:</strong> Immediate positive net cash inflow <MathView math="C - P - S + Ke^{-rT} > 0" /> with identically $0 terminal liability at maturity.
                    </p>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <p className="font-bold text-amber-400">Case B: Reverse Conversion (Put Overpriced: <MathView math="P > P_{\text{synth}}" />)</p>
                    <p className="text-xs text-slate-300 mt-1">
                      1. Buy the cheap Call (-C).<br />
                      2. Sell the expensive Put (+P).<br />
                      3. Short sell 1 share of Stock (+S).<br />
                      4. Lend / invest <MathView math="K e^{-rT}" /> in risk-free bonds (-Cash).<br />
                      <strong>Result:</strong> Immediate risk-free cash inflow <MathView math="S + P - C - Ke^{-rT} > 0" />.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Terminal Payoff Proof Matrix</h4>
                <p className="text-xs text-slate-400 mb-2">
                  At maturity <MathView math="T" />, regardless of whether the final stock price <MathView math="S_T < K" /> or <MathView math="S_T \ge K" />, the terminal position cash flows sum exactly to zero:
                </p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-1">Instrument</th>
                        <th className="py-1">Scenario S_T &lt; K</th>
                        <th className="py-1">Scenario S_T ≥ K</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      <tr>
                        <td className="py-1 font-bold text-slate-200">Short Call</td>
                        <td className="py-1">0</td>
                        <td className="py-1">-(S_T - K)</td>
                      </tr>
                      <tr>
                        <td className="py-1 font-bold text-slate-200">Long Put</td>
                        <td className="py-1">K - S_T</td>
                        <td className="py-1">0</td>
                      </tr>
                      <tr>
                        <td className="py-1 font-bold text-slate-200">Long Stock</td>
                        <td className="py-1">+S_T</td>
                        <td className="py-1">+S_T</td>
                      </tr>
                      <tr>
                        <td className="py-1 font-bold text-slate-200">Loan Repayment</td>
                        <td className="py-1">-K</td>
                        <td className="py-1">-K</td>
                      </tr>
                      <tr className="text-emerald-400 font-bold bg-emerald-950/20">
                        <td className="py-1">Net Payoff</td>
                        <td className="py-1">$0.00</td>
                        <td className="py-1">$0.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {topic === 'hedging' && (
            <>
              <div>
                <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  Taylor Series Portfolio Dynamics
                </h4>
                <p className="leading-relaxed mb-2">
                  Using Ito's lemma and Taylor expansion, the infinitesimal change in an option portfolio value <MathView math="\Pi" /> is:
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <MathView block math="d\Pi = \Theta_{\Pi} dt + \Delta_{\Pi} dS + \frac{1}{2} \Gamma_{\Pi} (dS)^2 + \mathcal{O}(dt^{3/2})" />
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">1. Delta Hedging (First-Order Neutrality)</h4>
                <p className="leading-relaxed mb-1">
                  To eliminate first-order directional sensitivity to the underlying stock (<MathView math="\Delta_{\Pi} = 0" />):
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <MathView block math="\Delta_{\Pi} = N_1 \Delta_1 + N_S = 0 \implies N_S = -N_1 \Delta_1" />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  <strong>Limitation:</strong> As spot moves, Delta changes by <MathView math="\Gamma" />. The hedge drifts quickly, requiring continuous rebalancing.
                </p>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">2. Delta-Gamma Hedging (Second-Order Neutrality)</h4>
                <p className="leading-relaxed mb-1">
                  Because underlying stock has zero Gamma (<MathView math="\Gamma_S = 0" />), neutralizing Gamma requires introducing a secondary traded option <MathView math="V_2" />:
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <MathView block math="\Gamma_{\Pi} = N_1 \Gamma_1 + N_2 \Gamma_2 = 0 \implies N_2 = -N_1 \frac{\Gamma_1}{\Gamma_2}" />
                  <MathView block math="\Delta_{\Pi} = N_1 \Delta_1 + N_2 \Delta_2 + N_S = 0 \implies N_S = -(N_1 \Delta_1 + N_2 \Delta_2)" />
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Daily Rebalancing & Cash Accounting</h4>
                <p className="text-slate-300 mb-2">
                  In discrete daily trading (<MathView math="\Delta t = 1/252" />), the cash account earns overnight risk-free interest:
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-xs">
                  <p>Cash(t) = Cash(t-1) · exp(r · Δt) - (ΔN_S · S) - (ΔN₂ · V₂)</p>
                  <p className="mt-1 text-slate-400">Total Portfolio Value = N₁·V₁(t) + N₂·V₂(t) + N_S·S(t) + Cash(t)</p>
                </div>
              </div>
            </>
          )}

          {topic === 'sabr' && (
            <>
              <div>
                <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-400" />
                  SABR Stochastic Differential Equations
                </h4>
                <p className="leading-relaxed mb-2">
                  Formulated by Hagan, Kumar, Lesniewski, and Woodward (2002), the forward asset price <MathView math="F_t" /> and instantaneous volatility <MathView math="\alpha_t" /> evolve according to:
                </p>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <MathView block math="dF_t = \alpha_t F_t^\beta dW_{1,t}" />
                  <MathView block math="d\alpha_t = \nu \alpha_t dW_{2,t}" />
                  <MathView block math="d\langle W_1, W_2 \rangle_t = \rho dt" />
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Parameters & Economics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-purple-400">α (Alpha):</span> Initial volatility level. Controls the overall vertical level of the smile.
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-purple-400">β (Beta):</span> Elasticity / CEV exponent. Typically <strong>β = 1.0</strong> for equities (lognormal), 0.5 for rates, 0.0 for normal.
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-purple-400">ρ (Rho):</span> Correlation between forward and vol (<MathView math="\rho \in (-1, 1)" />). Negative ρ produces equity skew (leverage effect).
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-purple-400">ν (Nu):</span> Volatility of volatility (&quot;vol-vol&quot;). Governs the convexity and curvature (smile wing height).
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Hagan Implied Volatility Formula</h4>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <MathView block math="z = \frac{\nu}{\alpha}(FK)^{\frac{1-\beta}{2}} \ln\left(\frac{F}{K}\right)" />
                  <MathView block math="\chi(z) = \ln\left( \frac{\sqrt{1 - 2\rho z + z^2} + z - \rho}{1 - \rho} \right)" />
                  <MathView block math="\sigma_{\text{SABR}}(K, F) \approx \frac{\alpha}{(FK)^{\frac{1-\beta}{2}} \left[ 1 + \frac{(1-\beta)^2}{24}\ln^2\frac{F}{K} + \dots \right]} \cdot \frac{z}{\chi(z)} \cdot \left[ 1 + \left( \frac{(1-\beta)^2\alpha^2}{24(FK)^{1-\beta}} + \frac{\rho\beta\nu\alpha}{4(FK)^{\frac{1-\beta}{2}}} + \frac{2-3\rho^2}{24}\nu^2 \right)T \right]" />
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Differential Equation Numerical Simulation Methods</h4>
                <div className="space-y-3">
                  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                    <p className="font-bold text-amber-400">1. Standard Euler-Maruyama</p>
                    <p className="text-xs text-slate-300 mt-1 mb-2">
                      Direct discretization of the continuous SDE with correlated increments:
                    </p>
                    <MathView block math="F_{t+\Delta t} = F_t + \alpha_t |F_t|^\beta \sqrt{\Delta t} Z_1" />
                    <MathView block math="\alpha_{t+\Delta t} = \alpha_t + \nu \alpha_t \sqrt{\Delta t} \left(\rho Z_1 + \sqrt{1 - \rho^2} Z_2\right)" />
                    <p className="text-xs text-slate-400 mt-1">Requires truncation/absorption to prevent negative volatilities.</p>
                  </div>

                  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                    <p className="font-bold text-emerald-400">2. Log-Transform / Full Truncation (Production Standard)</p>
                    <p className="text-xs text-slate-300 mt-1 mb-2">
                      Because <MathView math="\alpha_t" /> is a geometric Brownian motion, its log-transform is exact without discretization error:
                    </p>
                    <MathView block math="\alpha_{t+\Delta t} = \alpha_t \exp\left( -\frac{1}{2}\nu^2 \Delta t + \nu \Delta W_{2, t} \right)" />
                    <p className="text-xs text-slate-300 my-1">
                      For equity <MathView math="\beta = 1" />, the forward also follows exact drift-adjusted exponential:
                    </p>
                    <MathView block math="F_{t+\Delta t} = F_t \exp\left( -\frac{1}{2}\alpha_t^2 \Delta t + \alpha_t \Delta W_{1, t} \right)" />
                    <p className="text-xs text-slate-400 mt-1">
                      Lord, Koekkoek &amp; Van Dijk (2010) proved this preserves martingale properties and avoids negative forward biases.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">Option Pricing via Monte Carlo Average Payoff</h4>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <MathView block math="\text{PV}(\text{Call}) = e^{-rT} \cdot \frac{1}{N} \sum_{i=1}^N \max(F_{T, i} - K, 0)" />
                  <MathView block math="\text{PV}(\text{Put}) = e^{-rT} \cdot \frac{1}{N} \sum_{i=1}^N \max(K - F_{T, i}, 0)" />
                  <MathView block math="\text{Standard Error} = e^{-rT} \frac{\text{Std}(\text{Payoff})}{\sqrt{N}}, \quad 95\% \text{ CI} = \text{PV} \pm 1.96 \cdot \text{SE}" />
                </div>
              </div>
            </>
          )}

          {/* Footer note */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              Verified quantitative formulation
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
