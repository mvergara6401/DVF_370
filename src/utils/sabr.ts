import { black76Price, impliedVolatilityBlack76 } from './blackScholes';
import { MarketVolPoint, MonteCarloSABRResult, SABRParameters, SABRSmilePoint } from '../types/quant';

/**
 * Hagan et al. (2002) asymptotic implied volatility formula
 * "Managing Smile Risk", Wilmott Magazine
 */
export function haganImpliedVolatility(
  F: number,
  K: number,
  T: number,
  params: SABRParameters
): number {
  const { alpha, beta, rho, nu } = params;

  if (F <= 0 || K <= 0 || alpha <= 0 || T <= 0) {
    return 0;
  }

  // Handle ATM case (K very close to F)
  const eps = 1e-5;
  if (Math.abs(F - K) < eps * F) {
    const fMid = F;
    const fBeta = Math.pow(fMid, 1 - beta);
    const term1 = ((1 - beta) * (1 - beta) / 24) * (alpha * alpha) / Math.pow(fMid, 2 - 2 * beta);
    const term2 = 0.25 * (rho * beta * nu * alpha) / fBeta;
    const term3 = ((2 - 3 * rho * rho) / 24) * (nu * nu);
    const sigmaATM = (alpha / fBeta) * (1 + (term1 + term2 + term3) * T);
    return sigmaATM;
  }

  const logFK = Math.log(F / K);
  const fkMean = Math.sqrt(F * K);
  const fkBeta = Math.pow(fkMean, 1 - beta);

  // z = (nu / alpha) * (F * K)^((1 - beta) / 2) * ln(F / K)
  const z = (nu / alpha) * fkBeta * logFK;

  // chi(z) = ln( (sqrt(1 - 2*rho*z + z^2) + z - rho) / (1 - rho) )
  let chiZ: number;
  if (Math.abs(z) < 1e-7) {
    chiZ = z; // lim z->0 z / chi(z) = 1
  } else {
    const radicand = 1.0 - 2.0 * rho * z + z * z;
    const sqrtRadicand = Math.sqrt(Math.max(0, radicand));
    const numerator = sqrtRadicand + z - rho;
    const denominator = 1.0 - rho;
    chiZ = Math.log(numerator / denominator);
  }

  const zOverChi = Math.abs(chiZ) < 1e-7 ? 1.0 : z / chiZ;

  // Denominator: (F*K)^((1-beta)/2) * [ 1 + (1-beta)^2/24 * ln^2(F/K) + (1-beta)^4/1920 * ln^4(F/K) ]
  const oneMinusBeta = 1.0 - beta;
  const logSq = logFK * logFK;
  const denom = fkBeta * (1.0 + (oneMinusBeta * oneMinusBeta / 24.0) * logSq + (Math.pow(oneMinusBeta, 4) / 1920.0) * logSq * logSq);

  // Numerator correction factor: [ 1 + ( (1-beta)^2/24 * alpha^2 / (F*K)^(1-beta) + 1/4 * rho*beta*nu*alpha / (F*K)^((1-beta)/2) + (2 - 3*rho^2)/24 * nu^2 ) * T ]
  const c1 = (oneMinusBeta * oneMinusBeta / 24.0) * (alpha * alpha) / Math.pow(fkMean, 2 * oneMinusBeta);
  const c2 = 0.25 * (rho * beta * nu * alpha) / fkBeta;
  const c3 = ((2.0 - 3.0 * rho * rho) / 24.0) * (nu * nu);
  const numerator = alpha * (1.0 + (c1 + c2 + c3) * T);

  const sigma = (numerator / denom) * zOverChi;
  return Math.max(0.001, sigma);
}

/**
 * Generate SABR Volatility Smile & Breeden-Litzenberger arbitrage density check
 */
export function generateSABRSmile(
  F: number,
  T: number,
  r: number,
  params: SABRParameters,
  minStrikePct: number = 0.6,
  maxStrikePct: number = 1.4,
  pointsCount: number = 25
): SABRSmilePoint[] {
  const points: SABRSmilePoint[] = [];
  const minK = F * minStrikePct;
  const maxK = F * maxStrikePct;
  const stepK = (maxK - minK) / (pointsCount - 1);

  for (let i = 0; i < pointsCount; i++) {
    const K = minK + i * stepK;
    const iv = haganImpliedVolatility(F, K, T, params);
    const callPrice = black76Price(F, K, T, r, iv, 'call');
    const putPrice = black76Price(F, K, T, r, iv, 'put');

    points.push({
      strike: Math.round(K * 100) / 100,
      haganIV: iv,
      blackScholesCallPrice: Math.round(callPrice * 100) / 100,
      blackScholesPutPrice: Math.round(putPrice * 100) / 100,
      forwardPrice: F
    });
  }

  // Calculate numerical second derivative d^2 C / dK^2 for butterfly arbitrage / risk-neutral density
  const dK = stepK;
  for (let i = 1; i < points.length - 1; i++) {
    const cPrev = points[i - 1].blackScholesCallPrice;
    const cCurr = points[i].blackScholesCallPrice;
    const cNext = points[i + 1].blackScholesCallPrice;

    // d^2 C / dK^2 approx
    const d2CdK2 = (cPrev - 2 * cCurr + cNext) / (dK * dK);
    const density = Math.exp(r * T) * d2CdK2;
    points[i].density = density;

    if (density < -1e-4) {
      points[i].arbitrageWarning = 'Negative risk-neutral density (butterfly arbitrage opportunity in wing)';
    } else if (cCurr > cPrev) {
      points[i].arbitrageWarning = 'Call spread arbitrage violation (C increases with strike)';
    }
  }

  return points;
}

/**
 * Multi-dimensional Nelder-Mead Simplex optimization for SABR Calibration
 * Fits (alpha, rho, nu) with fixed beta (default = 1.0 for equities)
 */
export function calibrateSABR(
  marketPoints: MarketVolPoint[],
  F: number,
  T: number,
  beta: number = 1.0
): {
  params: SABRParameters;
  rmse: number;
  maxError: number;
  iterations: number;
} {
  if (marketPoints.length === 0) {
    return {
      params: { alpha: 0.25, beta, rho: -0.2, nu: 0.4 },
      rmse: 0,
      maxError: 0,
      iterations: 0
    };
  }

  // Objective function: Sum of Squared Errors
  function objective(p: [number, number, number]): number {
    const [alpha, rho, nu] = p;

    // Penalty for out of bound parameters
    if (alpha <= 0.001 || alpha > 2.0) return 1e6 + Math.abs(alpha) * 1000;
    if (rho <= -0.999 || rho >= 0.999) return 1e6 + Math.abs(rho) * 1000;
    if (nu <= 0.001 || nu > 3.0) return 1e6 + Math.abs(nu) * 1000;

    const currentParams: SABRParameters = { alpha, beta, rho, nu };
    let sse = 0;
    for (const pt of marketPoints) {
      const modelIV = haganImpliedVolatility(F, pt.strike, T, currentParams);
      const diff = modelIV - pt.impliedVol;
      sse += diff * diff;
    }
    return sse;
  }

  // Initial estimate: ATM vol for alpha, negative rho for equities, 0.4 for nu
  const atmPoint = marketPoints.reduce((prev, curr) =>
    Math.abs(curr.strike - F) < Math.abs(prev.strike - F) ? curr : prev
  );
  const initialAlpha = Math.max(0.05, atmPoint.impliedVol);
  const initialRho = -0.3;
  const initialNu = 0.5;

  // Initialize simplex with 4 vertices in 3D
  type Point3D = [number, number, number];
  let simplex: { point: Point3D; score: number }[] = [
    { point: [initialAlpha, initialRho, initialNu], score: 0 },
    { point: [initialAlpha * 1.2, initialRho, initialNu], score: 0 },
    { point: [initialAlpha, initialRho * 0.5, initialNu], score: 0 },
    { point: [initialAlpha, initialRho, initialNu * 1.3], score: 0 }
  ];

  for (const s of simplex) {
    s.score = objective(s.point);
  }

  const alphaCoeff = 1.0;
  const gammaCoeff = 2.0;
  const rhoCoeff = 0.5;
  const sigmaCoeff = 0.5;
  const maxIterations = 200;

  let iter = 0;
  for (iter = 0; iter < maxIterations; iter++) {
    // Sort simplex by objective score (ascending)
    simplex.sort((a, b) => a.score - b.score);

    if (Math.abs(simplex[3].score - simplex[0].score) < 1e-8) {
      break;
    }

    // Centroid of the best 3 points
    const centroid: Point3D = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      centroid[0] += simplex[i].point[0] / 3;
      centroid[1] += simplex[i].point[1] / 3;
      centroid[2] += simplex[i].point[2] / 3;
    }

    // Reflection
    const xr: Point3D = [
      centroid[0] + alphaCoeff * (centroid[0] - simplex[3].point[0]),
      centroid[1] + alphaCoeff * (centroid[1] - simplex[3].point[1]),
      centroid[2] + alphaCoeff * (centroid[2] - simplex[3].point[2])
    ];
    const scoreR = objective(xr);

    if (scoreR >= simplex[0].score && scoreR < simplex[2].score) {
      simplex[3] = { point: xr, score: scoreR };
      continue;
    }

    // Expansion
    if (scoreR < simplex[0].score) {
      const xe: Point3D = [
        centroid[0] + gammaCoeff * (xr[0] - centroid[0]),
        centroid[1] + gammaCoeff * (xr[1] - centroid[1]),
        centroid[2] + gammaCoeff * (xr[2] - centroid[2])
      ];
      const scoreE = objective(xe);
      simplex[3] = scoreE < scoreR ? { point: xe, score: scoreE } : { point: xr, score: scoreR };
      continue;
    }

    // Contraction
    const xc: Point3D = [
      centroid[0] + rhoCoeff * (simplex[3].point[0] - centroid[0]),
      centroid[1] + rhoCoeff * (simplex[3].point[1] - centroid[1]),
      centroid[2] + rhoCoeff * (simplex[3].point[2] - centroid[2])
    ];
    const scoreC = objective(xc);
    if (scoreC < simplex[3].score) {
      simplex[3] = { point: xc, score: scoreC };
      continue;
    }

    // Shrink
    for (let i = 1; i < 4; i++) {
      simplex[i].point = [
        simplex[0].point[0] + sigmaCoeff * (simplex[i].point[0] - simplex[0].point[0]),
        simplex[0].point[1] + sigmaCoeff * (simplex[i].point[1] - simplex[0].point[1]),
        simplex[0].point[2] + sigmaCoeff * (simplex[i].point[2] - simplex[0].point[2])
      ];
      simplex[i].score = objective(simplex[i].point);
    }
  }

  simplex.sort((a, b) => a.score - b.score);
  const best = simplex[0].point;
  const bestParams: SABRParameters = {
    alpha: Math.round(best[0] * 10000) / 10000,
    beta,
    rho: Math.round(best[1] * 10000) / 10000,
    nu: Math.round(best[2] * 10000) / 10000
  };

  // Compute RMSE & Max Error
  let sse = 0;
  let maxError = 0;
  for (const pt of marketPoints) {
    const modelIV = haganImpliedVolatility(F, pt.strike, T, bestParams);
    const err = Math.abs(modelIV - pt.impliedVol);
    sse += err * err;
    if (err > maxError) maxError = err;
  }
  const rmse = Math.sqrt(sse / marketPoints.length);

  return {
    params: bestParams,
    rmse: Math.round(rmse * 10000) / 10000,
    maxError: Math.round(maxError * 10000) / 10000,
    iterations: iter
  };
}

/**
 * Vectorized Box-Muller random normal generator
 */
function randomNormalPair(): [number, number] {
  let u1 = Math.random();
  while (u1 <= 1e-12) u1 = Math.random();
  const u2 = Math.random();
  const radius = Math.sqrt(-2.0 * Math.log(u1));
  const theta = 2.0 * Math.PI * u2;
  return [radius * Math.cos(theta), radius * Math.sin(theta)];
}

/**
 * Monte Carlo Simulation for Differential Equations of the SABR Model
 * Supports:
 * 1. Standard Euler-Maruyama
 * 2. Log-Transform / Full Truncation (Lord et al. production standard)
 * Calculates:
 * - Final price of underlying asset F_T
 * - Present value of the average payoff of the option
 * - Implied Volatility back-solved from Monte Carlo price
 * - Confidence intervals and trajectory paths
 */
export function simulateSABRMonteCarlo(
  F0: number,
  K: number,
  T: number,
  r: number,
  params: SABRParameters,
  numSimulations: number = 10000,
  numSteps: number = 50,
  algorithm: 'euler_maruyama' | 'full_truncation_log' = 'full_truncation_log'
): MonteCarloSABRResult {
  const startTime = performance.now();
  const { alpha: alpha0, beta, rho, nu } = params;

  const dt = T / numSteps;
  const sqrtDt = Math.sqrt(dt);
  const sqrtOneMinusRhoSq = Math.sqrt(Math.max(0, 1.0 - rho * rho));
  const discountFactor = Math.exp(-r * T);

  // Arrays to collect terminal values
  const terminalForwards = new Float64Array(numSimulations);
  let callPayoffSum = 0;
  let callPayoffSqSum = 0;
  let putPayoffSum = 0;

  // Sample paths to store (e.g. 20 trajectories for visualization)
  const samplePathsCount = Math.min(20, numSimulations);
  const samplePaths: Array<{ timeSteps: number[]; forwardPath: number[]; volPath: number[] }> = [];
  const timeAxis: number[] = [];
  for (let s = 0; s <= numSteps; s++) {
    timeAxis.push(Math.round(s * dt * 1000) / 1000);
  }

  for (let p = 0; p < samplePathsCount; p++) {
    samplePaths.push({
      timeSteps: timeAxis,
      forwardPath: new Array(numSteps + 1),
      volPath: new Array(numSteps + 1)
    });
  }

  // Simulation Loop
  for (let sim = 0; sim < numSimulations; sim++) {
    let F = F0;
    let alpha = alpha0;

    const isRecordingPath = sim < samplePathsCount;
    if (isRecordingPath) {
      samplePaths[sim].forwardPath[0] = F;
      samplePaths[sim].volPath[0] = alpha;
    }

    for (let step = 0; step < numSteps; step++) {
      const [z1, z2] = randomNormalPair();
      // Correlated standard Brownian increments
      const dW1 = sqrtDt * z1;
      const dW2 = sqrtDt * (rho * z1 + sqrtOneMinusRhoSq * z2);

      if (algorithm === 'full_truncation_log') {
        // Log-Transform / Full Truncation (Production Standard)
        // Volatility is lognormally distributed: exact drift-corrected exponential
        alpha = alpha * Math.exp(-0.5 * nu * nu * dt + nu * dW2);

        if (Math.abs(beta - 1.0) < 1e-4) {
          // Exact log-Euler for equity beta = 1
          F = F * Math.exp(-0.5 * alpha * alpha * dt + alpha * dW1);
        } else {
          // Full truncation for general beta (Lord et al.)
          const fEffective = Math.max(0, F);
          const alphaEffective = Math.max(0, alpha);
          F = F + alphaEffective * Math.pow(fEffective, beta) * dW1;
          F = Math.max(0, F);
        }
      } else {
        // Standard Euler-Maruyama
        const fEffective = Math.max(1e-6, F);
        const alphaEffective = Math.max(1e-6, alpha);

        const dF = alphaEffective * Math.pow(fEffective, beta) * dW1;
        const dAlpha = nu * alphaEffective * dW2;

        F = Math.max(1e-6, F + dF);
        alpha = Math.max(1e-6, alpha + dAlpha);
      }

      if (isRecordingPath) {
        samplePaths[sim].forwardPath[step + 1] = Math.round(F * 100) / 100;
        samplePaths[sim].volPath[step + 1] = Math.round(alpha * 1000) / 1000;
      }
    }

    terminalForwards[sim] = F;

    const callPayoff = Math.max(0, F - K);
    const putPayoff = Math.max(0, K - F);

    callPayoffSum += callPayoff;
    callPayoffSqSum += callPayoff * callPayoff;
    putPayoffSum += putPayoff;
  }

  // Statistical properties of terminal asset price
  let fSum = 0;
  let minF = Infinity;
  let maxF = -Infinity;
  for (let i = 0; i < numSimulations; i++) {
    const val = terminalForwards[i];
    fSum += val;
    if (val < minF) minF = val;
    if (val > maxF) maxF = val;
  }
  const meanF = fSum / numSimulations;

  let fVarSum = 0;
  for (let i = 0; i < numSimulations; i++) {
    const diff = terminalForwards[i] - meanF;
    fVarSum += diff * diff;
  }
  const stdF = Math.sqrt(fVarSum / numSimulations);

  // Percentiles (sort sample copy or quick-select)
  const sortedForwards = Array.from(terminalForwards).sort((a, b) => a - b);
  const p5 = sortedForwards[Math.floor(0.05 * numSimulations)];
  const p50 = sortedForwards[Math.floor(0.50 * numSimulations)];
  const p95 = sortedForwards[Math.floor(0.95 * numSimulations)];

  // Option Payoffs & Present Value
  const avgCallPayoff = callPayoffSum / numSimulations;
  const avgPutPayoff = putPayoffSum / numSimulations;
  const callPV = discountFactor * avgCallPayoff;
  const putPV = discountFactor * avgPutPayoff;

  // Monte Carlo Standard Error
  const variancePayoff = (callPayoffSqSum / numSimulations) - (avgCallPayoff * avgCallPayoff);
  const standardError = discountFactor * Math.sqrt(Math.max(0, variancePayoff) / numSimulations);
  const ci95: [number, number] = [
    Math.max(0, callPV - 1.96 * standardError),
    callPV + 1.96 * standardError
  ];

  // Hagan analytical benchmark
  const haganIV = haganImpliedVolatility(F0, K, T, params);
  const haganCall = black76Price(F0, K, T, r, haganIV, 'call');
  const haganPut = black76Price(F0, K, T, r, haganIV, 'put');

  // Inverted Black-76 IV from Monte Carlo call price
  const mcIV = impliedVolatilityBlack76(callPV, F0, K, T, r, 'call');

  // Histogram calculation
  const bucketsCount = 15;
  const bucketWidth = (maxF - minF) / bucketsCount;
  const histogram: Array<{ bucketStart: number; bucketEnd: number; count: number; frequency: number }> = [];

  for (let b = 0; b < bucketsCount; b++) {
    const bStart = minF + b * bucketWidth;
    const bEnd = bStart + bucketWidth;
    histogram.push({
      bucketStart: Math.round(bStart * 10) / 10,
      bucketEnd: Math.round(bEnd * 10) / 10,
      count: 0,
      frequency: 0
    });
  }

  for (let i = 0; i < numSimulations; i++) {
    const val = terminalForwards[i];
    let idx = Math.floor((val - minF) / bucketWidth);
    if (idx >= bucketsCount) idx = bucketsCount - 1;
    if (idx < 0) idx = 0;
    histogram[idx].count++;
  }

  for (const h of histogram) {
    h.frequency = Math.round((h.count / numSimulations) * 1000) / 10;
  }

  const endTime = performance.now();

  return {
    simulationCount: numSimulations,
    stepsCount: numSteps,
    algorithm,
    executionTimeMs: Math.round(endTime - startTime),
    finalForwardMean: Math.round(meanF * 100) / 100,
    finalForwardStd: Math.round(stdF * 100) / 100,
    finalForwardMin: Math.round(minF * 100) / 100,
    finalForwardMax: Math.round(maxF * 100) / 100,
    percentile5: Math.round(p5 * 100) / 100,
    percentile50: Math.round(p50 * 100) / 100,
    percentile95: Math.round(p95 * 100) / 100,
    strike: K,
    callPayoffAverage: Math.round(avgCallPayoff * 100) / 100,
    putPayoffAverage: Math.round(avgPutPayoff * 100) / 100,
    callPresentValue: Math.round(callPV * 100) / 100,
    putPresentValue: Math.round(putPV * 100) / 100,
    standardError: Math.round(standardError * 1000) / 1000,
    confidenceInterval95: [Math.round(ci95[0] * 100) / 100, Math.round(ci95[1] * 100) / 100],
    haganAnalyticalCallPV: Math.round(haganCall * 100) / 100,
    haganAnalyticalPutPV: Math.round(haganPut * 100) / 100,
    haganAnalyticalIV: Math.round(haganIV * 10000) / 10000,
    mcImpliedVol: Math.round(mcIV * 10000) / 10000,
    samplePaths,
    histogram
  };
}
