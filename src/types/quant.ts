export type OptionType = 'call' | 'put';
export type PositionType = 'long' | 'short';

export interface OptionPosition {
  id: string;
  ticker: string;
  optionType: OptionType;
  positionType: PositionType;
  strike: number;
  spotPrice: number;
  timeToMaturityYears: number; // T
  riskFreeRate: number; // r, e.g. 0.05 for 5%
  volatility: number; // sigma, e.g. 0.25 for 25%
  contracts: number; // e.g. 10
  multiplier: number; // default 100 shares per contract
  entryPrice: number; // premium paid / received per share
  // Computed values
  bsPrice?: number;
  intrinsicValue?: number;
  timeValue?: number;
  marketValue?: number;
  costBasis?: number;
  unrealizedPnL?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
  rho?: number;
}

export interface Greeks {
  delta: number;
  gamma: number;
  vega: number; // per 1% vol change ($/0.01 vol)
  theta: number; // per day ($/365)
  rho: number; // per 1% interest rate change
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostBasis: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalIntrinsicValue: number;
  totalTimeValue: number;
  netDelta: number;
  netGamma: number;
  netVega: number;
  netTheta: number;
  netRho: number;
}

export interface ArbitrageOpportunity {
  hasArbitrage: boolean;
  type: 'none' | 'call_overpriced' | 'put_overpriced' | 'call_below_lower_bound' | 'put_below_lower_bound';
  name: string;
  discrepancy: number; // Absolute profit per share
  profitPerContract: number; // Discrepancy * multiplier
  syntheticCallPrice: number;
  syntheticPutPrice: number;
  marketCallPrice: number;
  marketPutPrice: number;
  theoreticalLowerBoundCall: number;
  theoreticalLowerBoundPut: number;
  steps: ArbitrageStep[];
  payoffScenarios: PayoffScenario[];
  summaryNote: string;
}

export interface ArbitrageStep {
  stepNumber: number;
  action: 'BUY' | 'SELL' | 'BORROW' | 'LEND';
  asset: string;
  quantity: string;
  unitPrice: number;
  cashFlow: number; // Positive = cash inflow, Negative = cash outflow
  explanation: string;
}

export interface PayoffScenario {
  terminalPriceLabel: string;
  spotAtMaturity: number;
  callPayoff: number;
  putPayoff: number;
  stockPayoff: number;
  bondPayoff: number;
  totalTerminalPayoff: number;
  netRisklessProfit: number;
}

export interface DailyHedgeStep {
  day: number;
  timeRemainingYears: number;
  spotPrice: number;
  delta1: number;
  gamma1: number;
  delta2: number;
  gamma2: number;
  stockHoldingsDeltaOnly: number;
  stockRebalanceDeltaOnly: number;
  cashFlowDeltaOnly: number;
  stockHoldingsDeltaGamma: number;
  stockRebalanceDeltaGamma: number;
  option2HoldingsDeltaGamma: number;
  option2RebalanceDeltaGamma: number;
  cashFlowDeltaGamma: number;
  // P&L values
  unhedgedPnL: number;
  deltaHedgedPnL: number;
  deltaGammaHedgedPnL: number;
}

export interface SABRParameters {
  alpha: number; // initial vol
  beta: number; // CEV elasticity (1.0 for equities)
  rho: number; // correlation asset / vol (-1 to 1)
  nu: number; // vol-of-vol
}

export interface MarketVolPoint {
  strike: number;
  impliedVol: number;
  marketPrice?: number;
  maturity?: number;
}

export interface SABRSmilePoint {
  strike: number;
  haganIV: number;
  blackScholesCallPrice: number;
  blackScholesPutPrice: number;
  forwardPrice: number;
  density?: number; // d^2 C / dK^2 for arbitrage check
  arbitrageWarning?: string;
}

export interface MonteCarloSABRResult {
  simulationCount: number;
  stepsCount: number;
  algorithm: 'euler_maruyama' | 'full_truncation_log';
  executionTimeMs: number;
  finalForwardMean: number;
  finalForwardStd: number;
  finalForwardMin: number;
  finalForwardMax: number;
  percentile5: number;
  percentile50: number;
  percentile95: number;
  // Option pricing
  strike: number;
  callPayoffAverage: number;
  putPayoffAverage: number;
  callPresentValue: number;
  putPresentValue: number;
  standardError: number;
  confidenceInterval95: [number, number];
  haganAnalyticalCallPV: number;
  haganAnalyticalPutPV: number;
  haganAnalyticalIV: number;
  mcImpliedVol: number;
  samplePaths: Array<{
    timeSteps: number[];
    forwardPath: number[];
    volPath: number[];
  }>;
  histogram: Array<{
    bucketStart: number;
    bucketEnd: number;
    count: number;
    frequency: number;
  }>;
}
