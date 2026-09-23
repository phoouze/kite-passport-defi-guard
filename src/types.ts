import type { Address, Hex } from "viem";

export type Protocol = "erc20" | "uniswap-v3";
export type Action = "approve" | "swap";

export interface TransactionInput {
  to: Address;
  data: Hex;
  value?: bigint;
  chainId?: number;
}

export interface BaseIntent {
  protocol: Protocol;
  action: Action;
  target: Address;
  selector: Hex;
  rawCalldata: Hex;
}

export interface ApprovalIntent extends BaseIntent {
  protocol: "erc20";
  action: "approve";
  token: Address;
  spender: Address;
  amount: bigint;
}

export interface SwapIntent extends BaseIntent {
  protocol: "uniswap-v3";
  action: "swap";
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: bigint;
}

export type DeFiIntent = ApprovalIntent | SwapIntent;

export interface AuthorizationPolicy {
  allowedProtocols?: Protocol[];
  allowedTokens?: Address[];
  allowedTargets?: Address[];
  allowedSpenders?: Address[];
  allowedRecipients?: Address[];
  maxApprovalAmount?: bigint;
  maxSwapAmountIn?: bigint;
  maxDeadlineSeconds?: bigint;
  denyUnlimitedApproval?: boolean;
  requireNonZeroMinOutput?: boolean;
  allowNativeValue?: boolean;
}

export type RejectionCode =
  | "UNKNOWN_SELECTOR"
  | "PROTOCOL_NOT_ALLOWED"
  | "TARGET_NOT_ALLOWED"
  | "TOKEN_NOT_ALLOWED"
  | "SPENDER_NOT_ALLOWED"
  | "RECIPIENT_NOT_ALLOWED"
  | "APPROVAL_AMOUNT_EXCEEDED"
  | "UNLIMITED_APPROVAL"
  | "SWAP_AMOUNT_EXCEEDED"
  | "ZERO_MIN_OUTPUT"
  | "DEADLINE_TOO_LONG"
  | "NATIVE_VALUE_NOT_ALLOWED";

export interface PolicyRejection {
  code: RejectionCode;
  message: string;
}

export interface ExposureChange {
  asset: Address;
  delta: bigint;
  kind: "spend" | "receive-minimum" | "approval";
}

export interface AuthorizationResult {
  decision: "ALLOW" | "DENY";
  intent: DeFiIntent;
  reasons: PolicyRejection[];
  expectedResult: string;
  exposureChanges: ExposureChange[];
}
