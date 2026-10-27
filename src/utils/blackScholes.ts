import { Greeks, OptionType } from '../types/quant';

/**
 * Standard Normal Probability Density Function phi(x)
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Cumulative Standard Normal Distribution Function Phi(x)
 * High-accuracy rational approximation (Abramowitz and Stegun 26.2.17)
 * Maximum absolute error < 7.5e-8
 */
export function normalCDF(x: number): number {
  if (x === 0) return 0.5;
  if (x > 37) return 1.0;
  if (x < -37) return 0.0;

  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 1.0 / Math.sqrt(2 * Math.PI);

  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  const cdf = 1.0 - c * Math.exp(-0.5 * absX * absX) * poly;

  return x >= 0 ? cdf : 1.0 - cdf;
}

/**
 * Calculate Black-Scholes d1 and d2
 */
export function calculateD1D2(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): { d1: number; d2: number } {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return { d1: 0, d2: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return { d1, d2 };
}

/**
 * Standard Black-Scholes European Option Price
 */
export function blackScholesPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: OptionType
): number {
  if (T <= 1e-7) {
    return type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
  }
  if (sigma <= 1e-7) {
    const discount = Math.exp(-r * T);
    return type === 'call'
      ? Math.max(0, S - K * discount)
      : Math.max(0, K * discount - S);
  }

  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma);
  const discount = Math.exp(-r * T);

  if (type === 'call') {
    return S * normalCDF(d1) - K * discount * normalCDF(d2);
  } else {
    return K * discount * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

/**
 * Black-76 European Option Price on Forward / Futures F
 */
export function black76Price(
  F: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: OptionType
): number {
  if (T <= 1e-7) {
    return type === 'call' ? Math.max(0, F - K) : Math.max(0, K - F);
  }
  if (sigma <= 1e-7) {
    const discount = Math.exp(-r * T);
    return discount * (type === 'call' ? Math.max(0, F - K) : Math.max(0, K - F));
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const discount = Math.exp(-r * T);

  if (type === 'call') {
    return discount * (F * normalCDF(d1) - K * normalCDF(d2));
  } else {
    return discount * (K * normalCDF(-d2) - F * normalCDF(-d1));
  }
}

/**
 * Calculate Black-Scholes Greeks
 */
export function calculateGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: OptionType
): Greeks {
  if (T <= 1e-6 || sigma <= 1e-6) {
    const delta = type === 'call' ? (S >= K ? 1 : 0) : S <= K ? -1 : 0;
    return { delta, gamma: 0, vega: 0, theta: 0, rho: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma);
  const pdfD1 = normalPDF(d1);
  const discount = Math.exp(-r * T);

  // Delta
  const delta = type === 'call' ? normalCDF(d1) : normalCDF(d1) - 1;

  // Gamma (identical for Call and Put)
  const gamma = pdfD1 / (S * sigma * sqrtT);

  // Vega (per 1% point change in sigma, i.e., 0.01)
  const vega = (S * sqrtT * pdfD1) * 0.01;

  // Theta (decay per day: 1 / 365)
  let thetaAnnual: number;
  if (type === 'call') {
    thetaAnnual = - (S * pdfD1 * sigma) / (2 * sqrtT) - r * K * discount * normalCDF(d2);
  } else {
    thetaAnnual = - (S * pdfD1 * sigma) / (2 * sqrtT) + r * K * discount * normalCDF(-d2);
  }
  const theta = thetaAnnual / 365;

  // Rho (per 1% point change in risk-free rate r, i.e., 0.01)
  let rho: number;
  if (type === 'call') {
    rho = (K * T * discount * normalCDF(d2)) * 0.01;
  } else {
    rho = (-K * T * discount * normalCDF(-d2)) * 0.01;
  }

  return { delta, gamma, vega, theta, rho };
}

/**
 * Solve for Black-Scholes Implied Volatility using Brent-Bisection method
 */
export function impliedVolatility(
  targetPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  type: OptionType
): number {
  if (targetPrice <= 0 || T <= 0 || S <= 0 || K <= 0) return 0;

  // Theoretical bounds
  const intrinsic = type === 'call' ? Math.max(0, S - K * Math.exp(-r * T)) : Math.max(0, K * Math.exp(-r * T) - S);
  if (targetPrice < intrinsic) {
    return 0.001;
  }

  let low = 0.0001;
  let high = 5.0; // 500% volatility upper search bound
  const tol = 1e-5;
  const maxIter = 100;

  for (let i = 0; i < maxIter; i++) {
    const mid = 0.5 * (low + high);
    const priceMid = blackScholesPrice(S, K, T, r, mid, type);
    const diff = priceMid - targetPrice;

    if (Math.abs(diff) < tol || (high - low) < tol) {
      return mid;
    }

    if (diff > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return 0.5 * (low + high);
}

/**
 * Solve for Black-76 Implied Volatility given Forward F
 */
export function impliedVolatilityBlack76(
  targetPrice: number,
  F: number,
  K: number,
  T: number,
  r: number,
  type: OptionType
): number {
  if (targetPrice <= 0 || T <= 0 || F <= 0 || K <= 0) return 0;
  const discount = Math.exp(-r * T);
  const intrinsic = discount * (type === 'call' ? Math.max(0, F - K) : Math.max(0, K - F));
  if (targetPrice <= intrinsic) return 0.001;

  let low = 0.0001;
  let high = 5.0;
  const tol = 1e-5;
  const maxIter = 80;

  for (let i = 0; i < maxIter; i++) {
    const mid = 0.5 * (low + high);
    const price = black76Price(F, K, T, r, mid, type);
    const diff = price - targetPrice;
    if (Math.abs(diff) < tol || (high - low) < tol) {
      return mid;
    }
    if (diff > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return 0.5 * (low + high);
}
