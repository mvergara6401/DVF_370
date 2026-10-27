import { ArbitrageOpportunity, ArbitrageStep, PayoffScenario } from '../types/quant';

export interface ArbitrageInput {
  spotPrice: number;
  strike: number;
  timeToMaturityYears: number;
  riskFreeRate: number;
  marketCallPrice: number;
  marketPutPrice: number;
  dividendYield?: number;
  contractMultiplier?: number;
}

export function detectArbitrage(input: ArbitrageInput): ArbitrageOpportunity {
  const {
    spotPrice: S,
    strike: K,
    timeToMaturityYears: T,
    riskFreeRate: r,
    marketCallPrice: C,
    marketPutPrice: P,
    contractMultiplier = 100
  } = input;

  const bondPresentValue = K * Math.exp(-r * T);
  const syntheticCall = S + P - bondPresentValue;
  const syntheticPut = bondPresentValue + C - S;
  const callLowerBound = Math.max(0, S - bondPresentValue);
  const putLowerBound = Math.max(0, bondPresentValue - S);

  const parityDifference = (C - P) - (S - bondPresentValue);
  const tolerance = 0.01; // $0.01 threshold for financial friction/arbitrage signal

  // 1. Check if Call is below absolute lower bound
  if (C < callLowerBound - tolerance) {
    const discrepancy = callLowerBound - C;
    const steps: ArbitrageStep[] = [
      {
        stepNumber: 1,
        action: 'BUY',
        asset: `Call Option (Strike $${K})`,
        quantity: '1 Contract',
        unitPrice: C,
        cashFlow: -C * contractMultiplier,
        explanation: 'Buy underpriced Call option below theoretical minimum bound.'
      },
      {
        stepNumber: 2,
        action: 'SELL',
        asset: 'Underlying Stock (Short Sell)',
        quantity: `${contractMultiplier} Shares`,
        unitPrice: S,
        cashFlow: S * contractMultiplier,
        explanation: 'Short sell underlying stock at spot price S.'
      },
      {
        stepNumber: 3,
        action: 'LEND',
        asset: 'Zero-Coupon Risk-Free Bond',
        quantity: `$${(bondPresentValue * contractMultiplier).toFixed(2)} present value`,
        unitPrice: bondPresentValue,
        cashFlow: -bondPresentValue * contractMultiplier,
        explanation: `Invest present value of Strike ($${bondPresentValue.toFixed(2)}/share) at rate ${(r * 100).toFixed(2)}% to yield exactly $${K} at maturity.`
      }
    ];

    const lowST = Math.max(0, K * 0.7);
    const midST = K;
    const highST = K * 1.3;

    const payoffScenarios: PayoffScenario[] = [
      {
        terminalPriceLabel: `S_T = $${lowST.toFixed(2)} (< Strike)`,
        spotAtMaturity: lowST,
        callPayoff: 0,
        putPayoff: 0,
        stockPayoff: (S - lowST) * contractMultiplier,
        bondPayoff: (K - bondPresentValue) * contractMultiplier,
        totalTerminalPayoff: (K - lowST) * contractMultiplier,
        netRisklessProfit: (discrepancy + (K - lowST)) * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${midST.toFixed(2)} (= Strike)`,
        spotAtMaturity: midST,
        callPayoff: 0,
        putPayoff: 0,
        stockPayoff: (S - midST) * contractMultiplier,
        bondPayoff: (K - bondPresentValue) * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${highST.toFixed(2)} (> Strike)`,
        spotAtMaturity: highST,
        callPayoff: (highST - K) * contractMultiplier,
        putPayoff: 0,
        stockPayoff: (S - highST) * contractMultiplier,
        bondPayoff: (K - bondPresentValue) * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      }
    ];

    return {
      hasArbitrage: true,
      type: 'call_below_lower_bound',
      name: 'Call Below Theoretical Lower Bound Arbitrage',
      discrepancy,
      profitPerContract: discrepancy * contractMultiplier,
      syntheticCallPrice: syntheticCall,
      syntheticPutPrice: syntheticPut,
      marketCallPrice: C,
      marketPutPrice: P,
      theoreticalLowerBoundCall: callLowerBound,
      theoreticalLowerBoundPut: putLowerBound,
      steps,
      payoffScenarios,
      summaryNote: `Market Call price ($${C.toFixed(2)}) trades below its non-arbitrage lower bound ($${callLowerBound.toFixed(2)}). Upfront locked profit of $${(discrepancy * contractMultiplier).toFixed(2)} per contract.`
    };
  }

  // 2. Check if Put is below absolute lower bound
  if (P < putLowerBound - tolerance) {
    const discrepancy = putLowerBound - P;
    const steps: ArbitrageStep[] = [
      {
        stepNumber: 1,
        action: 'BUY',
        asset: `Put Option (Strike $${K})`,
        quantity: '1 Contract',
        unitPrice: P,
        cashFlow: -P * contractMultiplier,
        explanation: 'Buy underpriced Put option below theoretical minimum bound.'
      },
      {
        stepNumber: 2,
        action: 'BUY',
        asset: 'Underlying Stock',
        quantity: `${contractMultiplier} Shares`,
        unitPrice: S,
        cashFlow: -S * contractMultiplier,
        explanation: 'Buy underlying stock at spot price S.'
      },
      {
        stepNumber: 3,
        action: 'BORROW',
        asset: 'Risk-Free Cash Loan',
        quantity: `$${(bondPresentValue * contractMultiplier).toFixed(2)} principal`,
        unitPrice: bondPresentValue,
        cashFlow: bondPresentValue * contractMultiplier,
        explanation: `Borrow present value of strike ($${bondPresentValue.toFixed(2)}/share), repaying exactly $${K} at maturity.`
      }
    ];

    const lowST = Math.max(0, K * 0.7);
    const midST = K;
    const highST = K * 1.3;

    const payoffScenarios: PayoffScenario[] = [
      {
        terminalPriceLabel: `S_T = $${lowST.toFixed(2)} (< Strike)`,
        spotAtMaturity: lowST,
        callPayoff: 0,
        putPayoff: (K - lowST) * contractMultiplier,
        stockPayoff: (lowST - S) * contractMultiplier,
        bondPayoff: (bondPresentValue - K) * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${midST.toFixed(2)} (= Strike)`,
        spotAtMaturity: midST,
        callPayoff: 0,
        putPayoff: 0,
        stockPayoff: (midST - S) * contractMultiplier,
        bondPayoff: (bondPresentValue - K) * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${highST.toFixed(2)} (> Strike)`,
        spotAtMaturity: highST,
        callPayoff: 0,
        putPayoff: 0,
        stockPayoff: (highST - S) * contractMultiplier,
        bondPayoff: (bondPresentValue - K) * contractMultiplier,
        totalTerminalPayoff: (highST - K) * contractMultiplier,
        netRisklessProfit: (discrepancy + (highST - K)) * contractMultiplier
      }
    ];

    return {
      hasArbitrage: true,
      type: 'put_below_lower_bound',
      name: 'Put Below Theoretical Lower Bound Arbitrage',
      discrepancy,
      profitPerContract: discrepancy * contractMultiplier,
      syntheticCallPrice: syntheticCall,
      syntheticPutPrice: syntheticPut,
      marketCallPrice: C,
      marketPutPrice: P,
      theoreticalLowerBoundCall: callLowerBound,
      theoreticalLowerBoundPut: putLowerBound,
      steps,
      payoffScenarios,
      summaryNote: `Market Put price ($${P.toFixed(2)}) trades below its non-arbitrage lower bound ($${putLowerBound.toFixed(2)}). Upfront locked profit of $${(discrepancy * contractMultiplier).toFixed(2)} per contract.`
    };
  }

  // 3. Put-Call Parity: Call Overpriced vs Synthetic Call (C > Synthetic Call => Parity Diff > 0)
  if (parityDifference > tolerance) {
    const discrepancy = parityDifference;
    const steps: ArbitrageStep[] = [
      {
        stepNumber: 1,
        action: 'SELL',
        asset: `Call Option (Strike $${K})`,
        quantity: '1 Contract (100 shares)',
        unitPrice: C,
        cashFlow: C * contractMultiplier,
        explanation: `Sell (write) overvalued market Call at $${C.toFixed(2)}.`
      },
      {
        stepNumber: 2,
        action: 'BUY',
        asset: `Put Option (Strike $${K})`,
        quantity: '1 Contract (100 shares)',
        unitPrice: P,
        cashFlow: -P * contractMultiplier,
        explanation: `Buy undervalued market Put at $${P.toFixed(2)} to construct synthetic short stock.`
      },
      {
        stepNumber: 3,
        action: 'BUY',
        asset: 'Underlying Stock',
        quantity: `${contractMultiplier} Shares`,
        unitPrice: S,
        cashFlow: -S * contractMultiplier,
        explanation: `Buy 1 share of underlying stock at spot price $${S.toFixed(2)}.`
      },
      {
        stepNumber: 4,
        action: 'BORROW',
        asset: 'Zero-Coupon Risk-Free Debt',
        quantity: `$${(bondPresentValue * contractMultiplier).toFixed(2)} principal`,
        unitPrice: bondPresentValue,
        cashFlow: bondPresentValue * contractMultiplier,
        explanation: `Borrow $${bondPresentValue.toFixed(2)}/share at risk-free rate r = ${(r * 100).toFixed(2)}%, repaying exactly $${K} at maturity T.`
      }
    ];

    const lowST = Math.max(0, K * 0.7);
    const midST = K;
    const highST = K * 1.3;

    const payoffScenarios: PayoffScenario[] = [
      {
        terminalPriceLabel: `S_T = $${lowST.toFixed(2)} (< Strike)`,
        spotAtMaturity: lowST,
        callPayoff: 0,
        putPayoff: (K - lowST) * contractMultiplier,
        stockPayoff: lowST * contractMultiplier,
        bondPayoff: -K * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${midST.toFixed(2)} (= Strike)`,
        spotAtMaturity: midST,
        callPayoff: 0,
        putPayoff: 0,
        stockPayoff: midST * contractMultiplier,
        bondPayoff: -K * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${highST.toFixed(2)} (> Strike)`,
        spotAtMaturity: highST,
        callPayoff: -(highST - K) * contractMultiplier,
        putPayoff: 0,
        stockPayoff: highST * contractMultiplier,
        bondPayoff: -K * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      }
    ];

    return {
      hasArbitrage: true,
      type: 'call_overpriced',
      name: 'Conversion Arbitrage (Call Overpriced / Synthetic Call Cheaper)',
      discrepancy,
      profitPerContract: discrepancy * contractMultiplier,
      syntheticCallPrice: syntheticCall,
      syntheticPutPrice: syntheticPut,
      marketCallPrice: C,
      marketPutPrice: P,
      theoreticalLowerBoundCall: callLowerBound,
      theoreticalLowerBoundPut: putLowerBound,
      steps,
      payoffScenarios,
      summaryNote: `Call is overpriced relative to Put + Stock + Debt. Conversion strategy locks in $${(discrepancy * contractMultiplier).toFixed(2)} risk-free profit immediately, with exactly $0 terminal payoff regardless of where stock finishes.`
    };
  }

  // 4. Put-Call Parity: Put Overpriced vs Synthetic Put (C < Synthetic Call => Parity Diff < 0)
  if (parityDifference < -tolerance) {
    const discrepancy = Math.abs(parityDifference);
    const steps: ArbitrageStep[] = [
      {
        stepNumber: 1,
        action: 'BUY',
        asset: `Call Option (Strike $${K})`,
        quantity: '1 Contract (100 shares)',
        unitPrice: C,
        cashFlow: -C * contractMultiplier,
        explanation: `Buy undervalued market Call at $${C.toFixed(2)}.`
      },
      {
        stepNumber: 2,
        action: 'SELL',
        asset: `Put Option (Strike $${K})`,
        quantity: '1 Contract (100 shares)',
        unitPrice: P,
        cashFlow: P * contractMultiplier,
        explanation: `Sell overvalued market Put at $${P.toFixed(2)}.`
      },
      {
        stepNumber: 3,
        action: 'SELL',
        asset: 'Underlying Stock (Short Sale)',
        quantity: `${contractMultiplier} Shares`,
        unitPrice: S,
        cashFlow: S * contractMultiplier,
        explanation: `Short sell underlying stock at spot price $${S.toFixed(2)}.`
      },
      {
        stepNumber: 4,
        action: 'LEND',
        asset: 'Zero-Coupon Risk-Free Bond',
        quantity: `$${(bondPresentValue * contractMultiplier).toFixed(2)} invested`,
        unitPrice: bondPresentValue,
        cashFlow: -bondPresentValue * contractMultiplier,
        explanation: `Invest $${bondPresentValue.toFixed(2)}/share at rate ${(r * 100).toFixed(2)}% to receive exactly $${K} at maturity T.`
      }
    ];

    const lowST = Math.max(0, K * 0.7);
    const midST = K;
    const highST = K * 1.3;

    const payoffScenarios: PayoffScenario[] = [
      {
        terminalPriceLabel: `S_T = $${lowST.toFixed(2)} (< Strike)`,
        spotAtMaturity: lowST,
        callPayoff: 0,
        putPayoff: -(K - lowST) * contractMultiplier,
        stockPayoff: -lowST * contractMultiplier,
        bondPayoff: K * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${midST.toFixed(2)} (= Strike)`,
        spotAtMaturity: midST,
        callPayoff: 0,
        putPayoff: 0,
        stockPayoff: -midST * contractMultiplier,
        bondPayoff: K * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      },
      {
        terminalPriceLabel: `S_T = $${highST.toFixed(2)} (> Strike)`,
        spotAtMaturity: highST,
        callPayoff: (highST - K) * contractMultiplier,
        putPayoff: 0,
        stockPayoff: -highST * contractMultiplier,
        bondPayoff: K * contractMultiplier,
        totalTerminalPayoff: 0,
        netRisklessProfit: discrepancy * contractMultiplier
      }
    ];

    return {
      hasArbitrage: true,
      type: 'put_overpriced',
      name: 'Reverse Conversion Arbitrage (Put Overpriced / Synthetic Put Cheaper)',
      discrepancy,
      profitPerContract: discrepancy * contractMultiplier,
      syntheticCallPrice: syntheticCall,
      syntheticPutPrice: syntheticPut,
      marketCallPrice: C,
      marketPutPrice: P,
      theoreticalLowerBoundCall: callLowerBound,
      theoreticalLowerBoundPut: putLowerBound,
      steps,
      payoffScenarios,
      summaryNote: `Put is overpriced relative to Call + Short Stock + Bond. Reverse conversion strategy locks in $${(discrepancy * contractMultiplier).toFixed(2)} risk-free profit immediately with 0 maturity risk.`
    };
  }

  // No arbitrage opportunity detected
  return {
    hasArbitrage: false,
    type: 'none',
    name: 'Put-Call Parity Holds (No Arbitrage)',
    discrepancy: Math.abs(parityDifference),
    profitPerContract: 0,
    syntheticCallPrice: syntheticCall,
    syntheticPutPrice: syntheticPut,
    marketCallPrice: C,
    marketPutPrice: P,
    theoreticalLowerBoundCall: callLowerBound,
    theoreticalLowerBoundPut: putLowerBound,
    steps: [],
    payoffScenarios: [],
    summaryNote: `Market prices conform to Put-Call Parity within $${Math.abs(parityDifference).toFixed(4)}. No profitable risk-free synthetic arbitrage exists.`
  };
}
