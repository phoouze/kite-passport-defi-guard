import type {
  AuthorizationPolicy,
  AuthorizationResult,
  TransactionInput,
} from "../types.js";
import { decodeCalldata } from "../decoder/decodeCalldata.js";
import { authorizeIntent } from "../policy/engine.js";

export interface PreflightReport {
  transaction: TransactionInput;
  authorization: AuthorizationResult;
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
  const authorization = authorizeIntent(
    intent,
    policy,
    nowSeconds,
    tx.value ?? 0n
  );

  return {
    transaction: tx,
    authorization,
    simulation: {
      performed: false,
      reason:
        "RPC execution simulation is intentionally not performed by the core library. Integrators should eth_call against their selected chain/provider after authorization.",
    },
  };
}
