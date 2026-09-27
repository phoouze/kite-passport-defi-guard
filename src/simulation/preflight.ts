import type {
  AuthorizationPolicy,
  AuthorizationResult,
  TransactionInput,
} from "../types.js";
import { decodeCalldata } from "../decoder/decodeCalldata.js";
import { authorizeIntent } from "../policy/engine.js";
import { assessRisk, type RiskAssessment } from "../risk.js";

export interface PreflightReport {
  transaction: TransactionInput;
  authorization: AuthorizationResult;
  risk: RiskAssessment;
  simulation: {
    performed: false;
    reason: string;
  };
}

export function preflight(
  tx: TransactionInput,
  policy: AuthorizationPolicy,
  nowSeconds?: bigint
): PreflightReport {
  const intent = decodeCalldata(tx);
  const resolvedNow = nowSeconds ?? BigInt(Math.floor(Date.now() / 1000));
  const authorization = authorizeIntent(
    intent,
    policy,
    resolvedNow,
    tx.value ?? 0n
  );

  const risk = assessRisk(intent, policy, authorization, resolvedNow, tx.value ?? 0n);

  return {
    transaction: tx,
    authorization,
    risk,
    simulation: {
      performed: false,
      reason:
        "RPC execution simulation is intentionally not performed by the core library. Integrators should eth_call against their selected chain/provider after authorization.",
    },
  };
}
