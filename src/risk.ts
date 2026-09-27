import { maxUint256 } from "viem";
import type { AuthorizationPolicy, AuthorizationResult, DeFiIntent } from "./types.js";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskFactorCode =
  | "POLICY_DENIED"
  | "UNLIMITED_APPROVAL"
  | "LARGE_APPROVAL"
  | "APPROVAL_NEAR_LIMIT"
  | "SWAP_NEAR_LIMIT"
  | "ZERO_MIN_OUTPUT"
  | "LONG_DEADLINE"
  | "NATIVE_VALUE";

export interface RiskFactor {
  code: RiskFactorCode;
  severity: Exclude<RiskLevel, "LOW">;
  message: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  summary: string;
}

const severityScore: Record<RiskFactor["severity"], number> = {
  MEDIUM: 25,
  HIGH: 55,
  CRITICAL: 100,
};

function add(factors: RiskFactor[], code: RiskFactorCode, severity: RiskFactor["severity"], message: string) {
  if (!factors.some((factor) => factor.code === code)) factors.push({ code, severity, message });
}

function ratioNearLimit(value: bigint, limit?: bigint): boolean {
  return limit !== undefined && limit > 0n && value <= limit && value * 100n >= limit * 80n;
}

export function assessRisk(
  intent: DeFiIntent,
  policy: AuthorizationPolicy,
  authorization: AuthorizationResult,
  nowSeconds: bigint = BigInt(Math.floor(Date.now() / 1000)),
  txValue: bigint = 0n
): RiskAssessment {
  const factors: RiskFactor[] = [];

  if (authorization.decision === "DENY")
    add(factors, "POLICY_DENIED", "CRITICAL", "The transaction violates one or more authorization policy rules.");

  if (txValue > 0n)
    add(factors, "NATIVE_VALUE", "MEDIUM", `The transaction also transfers ${txValue} units of native value.`);

  if (intent.action === "approve") {
    if (intent.amount === maxUint256) {
      add(factors, "UNLIMITED_APPROVAL", "CRITICAL", "The approval grants the spender an unlimited token allowance.");
    } else if (ratioNearLimit(intent.amount, policy.maxApprovalAmount)) {
      add(factors, "APPROVAL_NEAR_LIMIT", "HIGH", "The approval consumes at least 80% of the configured approval limit.");
    } else if (policy.maxApprovalAmount === undefined && intent.amount >= 10n ** 24n) {
      add(factors, "LARGE_APPROVAL", "MEDIUM", "The approval amount is unusually large and no policy cap is configured.");
    }
  }

  if (intent.action === "swap") {
    if (intent.amountOutMinimum === 0n)
      add(factors, "ZERO_MIN_OUTPUT", "HIGH", "The swap has no minimum output protection.");

    if (ratioNearLimit(intent.amountIn, policy.maxSwapAmountIn))
      add(factors, "SWAP_NEAR_LIMIT", "HIGH", "The swap consumes at least 80% of the configured input limit.");

    const remaining = intent.deadline - nowSeconds;
    if (remaining > 1800n)
      add(factors, "LONG_DEADLINE", "MEDIUM", "The swap remains executable for more than 30 minutes.");
  }

  const score = Math.min(100, factors.reduce((max, factor) => Math.max(max, severityScore[factor.severity]), 0));
  const level: RiskLevel = score >= 100 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  const summary = factors.length === 0
    ? "No elevated risk signals were detected for the decoded intent."
    : `${factors.length} risk signal${factors.length === 1 ? "" : "s"} detected; highest severity is ${level}.`;

  return { level, score, factors, summary };
}
