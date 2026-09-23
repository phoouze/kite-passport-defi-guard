import {
  getAddress,
  maxUint256,
  type Address,
} from "viem";
import type {
  AuthorizationPolicy,
  AuthorizationResult,
  DeFiIntent,
  ExposureChange,
  PolicyRejection,
} from "../types.js";
import { reject } from "./reasons.js";

const eq = (a: Address, b: Address) =>
  getAddress(a).toLowerCase() === getAddress(b).toLowerCase();

const includes = (items: Address[] | undefined, value: Address) =>
  !items || items.some((item) => eq(item, value));

export function authorizeIntent(
  intent: DeFiIntent,
  policy: AuthorizationPolicy,
  nowSeconds: bigint = BigInt(Math.floor(Date.now() / 1000)),
  txValue: bigint = 0n
): AuthorizationResult {
  const reasons: PolicyRejection[] = [];

  if (policy.allowedProtocols && !policy.allowedProtocols.includes(intent.protocol))
    reasons.push(reject("PROTOCOL_NOT_ALLOWED", `Protocol ${intent.protocol} is not allowed.`));

  if (!includes(policy.allowedTargets, intent.target))
    reasons.push(reject("TARGET_NOT_ALLOWED", `Target ${intent.target} is not allowlisted.`));

  if (txValue > 0n && policy.allowNativeValue !== true)
    reasons.push(reject("NATIVE_VALUE_NOT_ALLOWED", "Transaction sends native value but policy does not allow it."));

  if (intent.action === "approve") {
    if (!includes(policy.allowedTokens, intent.token))
      reasons.push(reject("TOKEN_NOT_ALLOWED", `Token ${intent.token} is not allowed.`));

    if (!includes(policy.allowedSpenders, intent.spender))
      reasons.push(reject("SPENDER_NOT_ALLOWED", `Spender ${intent.spender} is not allowlisted.`));

    if (policy.denyUnlimitedApproval !== false && intent.amount === maxUint256)
      reasons.push(reject("UNLIMITED_APPROVAL", "Unlimited ERC20 approval is forbidden."));

    if (policy.maxApprovalAmount !== undefined && intent.amount > policy.maxApprovalAmount)
      reasons.push(reject("APPROVAL_AMOUNT_EXCEEDED", `Approval amount ${intent.amount} exceeds maximum ${policy.maxApprovalAmount}.`));
  }

  if (intent.action === "swap") {
    if (!includes(policy.allowedTokens, intent.tokenIn) || !includes(policy.allowedTokens, intent.tokenOut))
      reasons.push(reject("TOKEN_NOT_ALLOWED", "Swap contains a token outside the allowlist."));

    if (!includes(policy.allowedRecipients, intent.recipient))
      reasons.push(reject("RECIPIENT_NOT_ALLOWED", `Recipient ${intent.recipient} is not allowlisted.`));

    if (policy.maxSwapAmountIn !== undefined && intent.amountIn > policy.maxSwapAmountIn)
      reasons.push(reject("SWAP_AMOUNT_EXCEEDED", `Swap input ${intent.amountIn} exceeds maximum ${policy.maxSwapAmountIn}.`));

    if (policy.requireNonZeroMinOutput !== false && intent.amountOutMinimum === 0n)
      reasons.push(reject("ZERO_MIN_OUTPUT", "amountOutMinimum is zero, allowing unbounded execution slippage."));

    if (
      policy.maxDeadlineSeconds !== undefined &&
      (intent.deadline < nowSeconds || intent.deadline - nowSeconds > policy.maxDeadlineSeconds)
    )
      reasons.push(reject("DEADLINE_TOO_LONG", `Swap deadline ${intent.deadline} is outside the allowed execution window.`));
  }

  return {
    decision: reasons.length ? "DENY" : "ALLOW",
    intent,
    reasons,
    expectedResult: describeExpectedResult(intent),
    exposureChanges: exposureFor(intent),
  };
}

function describeExpectedResult(intent: DeFiIntent): string {
  if (intent.action === "approve")
    return `Grant spender ${intent.spender} allowance of ${intent.amount} units of ${intent.token}.`;

  return `Spend ${intent.amountIn} units of ${intent.tokenIn} for at least ${intent.amountOutMinimum} units of ${intent.tokenOut}, delivered to ${intent.recipient}.`;
}

function exposureFor(intent: DeFiIntent): ExposureChange[] {
  if (intent.action === "approve") {
    return [{ asset: intent.token, delta: intent.amount, kind: "approval" }];
  }

  return [
    { asset: intent.tokenIn, delta: -intent.amountIn, kind: "spend" },
    { asset: intent.tokenOut, delta: intent.amountOutMinimum, kind: "receive-minimum" },
  ];
}
