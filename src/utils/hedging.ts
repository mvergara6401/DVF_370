import { blackScholesPrice, calculateGreeks } from './blackScholes';
import { DailyHedgeStep, OptionType } from '../types/quant';

export interface HedgingInputs {
  spotPrice: number;
  strike1: number;
  timeToMaturityYears1: number;
  volatility1: number;
  riskFreeRate: number;
  optionType1: OptionType;
  positionQuantity1: number; // e.g. -1000 for short 1,000 calls
  strike2: number;
  timeToMaturityYears2: number;
  volatility2: number;
  optionType2: OptionType;
  simulationMode: 'gbm' | 'manual';
  customSpotPrices?: number[]; // 6 prices: Day 0 to Day 5
  seed?: number;
}

/**
 * Box-Muller standard normal generator with pseudo-random seed
 */
function pseudoRandomNormal(seedState: { val: number }): number {
  seedState.val = (seedState.val * 9301 + 49297) % 233280;
  let u1 = seedState.val / 233280;
  if (u1 <= 1e-7) u1 = 1e-7;

  seedState.val = (seedState.val * 9301 + 49297) % 233280;
  const u2 = seedState.val / 233280;

  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

export function simulateSpotPricesGBM(
  S0: number,
  r: number,
  sigma: number,
  days: number = 5,
  seed: number = 42
): number[] {
  const dt = 1.0 / 252.0; // 1 trading day
  const prices: number[] = [S0];
  const seedState = { val: Math.abs(seed) || 12345 };

  let currentS = S0;
  for (let i = 1; i <= days; i++) {
    const z = pseudoRandomNormal(seedState);
    const drift = (r - 0.5 * sigma * sigma) * dt;
    const diffusion = sigma * Math.sqrt(dt) * z;
    currentS = currentS * Math.exp(drift + diffusion);
    prices.push(Math.round(currentS * 100) / 100);
  }
  return prices;
}

export function calculateHedgingSchedule(inputs: HedgingInputs): {
  steps: DailyHedgeStep[];
  spotPrices: number[];
  initialOption1Value: number;
  initialOption2Value: number;
} {
  const {
    spotPrice: S0,
    strike1: K1,
    timeToMaturityYears1: T1,
    volatility1: sig1,
    riskFreeRate: r,
    optionType1: type1,
    positionQuantity1: N1,
    strike2: K2,
    timeToMaturityYears2: T2,
    volatility2: sig2,
    optionType2: type2,
    simulationMode,
    customSpotPrices,
    seed = 101
  } = inputs;

  const dt = 1.0 / 252.0; // 1 trading day per step
  let spotPrices: number[];

  if (simulationMode === 'manual' && customSpotPrices && customSpotPrices.length >= 6) {
    spotPrices = customSpotPrices.slice(0, 6);
  } else {
    spotPrices = simulateSpotPricesGBM(S0, r, sig1, 5, seed);
  }

  const v1_0 = blackScholesPrice(S0, K1, T1, r, sig1, type1);
  const v2_0 = blackScholesPrice(S0, K2, T2, r, sig2, type2);

  const steps: DailyHedgeStep[] = [];

  // Cash accounts
  let cashDeltaOnly = 0;
  let cashDeltaGamma = 0;

  let prevStockHoldingsDeltaOnly = 0;
  let prevStockHoldingsDeltaGamma = 0;
  let prevOption2HoldingsDeltaGamma = 0;

  for (let day = 0; day <= 5; day++) {
    const S = spotPrices[day];
    const remT1 = Math.max(1e-5, T1 - day * dt);
    const remT2 = Math.max(1e-5, T2 - day * dt);

    const greeks1 = calculateGreeks(S, K1, remT1, r, sig1, type1);
    const greeks2 = calculateGreeks(S, K2, remT2, r, sig2, type2);

    const v1 = blackScholesPrice(S, K1, remT1, r, sig1, type1);
    const v2 = blackScholesPrice(S, K2, remT2, r, sig2, type2);

    // Interest on cash from previous day
    if (day > 0) {
      cashDeltaOnly *= Math.exp(r * dt);
      cashDeltaGamma *= Math.exp(r * dt);
    }

    // 1. Delta-only hedge:
    // Net Delta = N1 * delta1 + N_S * 1 = 0 => N_S = -N1 * delta1
    const targetStockDeltaOnly = Math.round((-N1 * greeks1.delta) * 100) / 100;
    const rebalanceStockDeltaOnly = targetStockDeltaOnly - prevStockHoldingsDeltaOnly;
    // Buying stock costs cash; selling provides cash
    const cashFlowDeltaOnly = -rebalanceStockDeltaOnly * S;
    cashDeltaOnly += cashFlowDeltaOnly;
    prevStockHoldingsDeltaOnly = targetStockDeltaOnly;

    // 2. Delta-Gamma hedge:
    // Gamma neutrality: N1 * gamma1 + N2 * gamma2 = 0 => N2 = -N1 * (gamma1 / gamma2)
    const targetOption2DeltaGamma = greeks2.gamma > 1e-7
      ? Math.round((-N1 * (greeks1.gamma / greeks2.gamma)) * 100) / 100
      : 0;
    const rebalanceOption2DeltaGamma = targetOption2DeltaGamma - prevOption2HoldingsDeltaGamma;

    // Delta neutrality: N1 * delta1 + N2 * delta2 + N_S * 1 = 0 => N_S = -(N1 * delta1 + N2 * delta2)
    const targetStockDeltaGamma = Math.round((-(N1 * greeks1.delta + targetOption2DeltaGamma * greeks2.delta)) * 100) / 100;
    const rebalanceStockDeltaGamma = targetStockDeltaGamma - prevStockHoldingsDeltaGamma;

    const cashFlowDeltaGamma = (-rebalanceStockDeltaGamma * S) - (rebalanceOption2DeltaGamma * v2);
    cashDeltaGamma += cashFlowDeltaGamma;
    prevStockHoldingsDeltaGamma = targetStockDeltaGamma;
    prevOption2HoldingsDeltaGamma = targetOption2DeltaGamma;

    // Calculate P&L:
    // Unhedged P&L: Change in value of Option 1
    const unhedgedPnL = N1 * (v1 - v1_0);

    // Delta Hedged Portfolio Value: N1 * v1 + N_S * S + cash
    // Initial cost: N1 * v1_0 + N_S_0 * S0 + cash_0 = N1 * v1_0 (since stock was funded from cash)
    // Portfolio P&L = (Current Portfolio Value) - (Initial Portfolio Value)
    const deltaHedgedPortfolioValue = (N1 * v1) + (targetStockDeltaOnly * S) + cashDeltaOnly;
    const initialDeltaHedgedValue = N1 * v1_0;
    const deltaHedgedPnL = deltaHedgedPortfolioValue - initialDeltaHedgedValue;

    // Delta-Gamma Hedged Portfolio Value:
    const deltaGammaPortfolioValue = (N1 * v1) + (targetOption2DeltaGamma * v2) + (targetStockDeltaGamma * S) + cashDeltaGamma;
    const initialDeltaGammaValue = N1 * v1_0;
    const deltaGammaHedgedPnL = deltaGammaPortfolioValue - initialDeltaGammaValue;

    steps.push({
      day,
      timeRemainingYears: remT1,
      spotPrice: S,
      delta1: greeks1.delta,
      gamma1: greeks1.gamma,
      delta2: greeks2.delta,
      gamma2: greeks2.gamma,
      stockHoldingsDeltaOnly: targetStockDeltaOnly,
      stockRebalanceDeltaOnly: rebalanceStockDeltaOnly,
      cashFlowDeltaOnly,
      stockHoldingsDeltaGamma: targetStockDeltaGamma,
      stockRebalanceDeltaGamma: rebalanceStockDeltaGamma,
      option2HoldingsDeltaGamma: targetOption2DeltaGamma,
      option2RebalanceDeltaGamma: rebalanceOption2DeltaGamma,
      cashFlowDeltaGamma,
      unhedgedPnL: Math.round(unhedgedPnL * 100) / 100,
      deltaHedgedPnL: Math.round(deltaHedgedPnL * 100) / 100,
      deltaGammaHedgedPnL: Math.round(deltaGammaHedgedPnL * 100) / 100
    });
  }

  return {
    steps,
    spotPrices,
    initialOption1Value: v1_0,
    initialOption2Value: v2_0
  };
}
