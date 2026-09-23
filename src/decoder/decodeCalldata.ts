import type { DeFiIntent, TransactionInput } from "../types.js";
import type { ProtocolAdapter } from "../adapters/types.js";
import { erc20Adapter } from "../adapters/erc20.js";
import { uniswapV3Adapter } from "../adapters/uniswap.js";

const adapters: ProtocolAdapter[] = [erc20Adapter, uniswapV3Adapter];

export class UnknownSelectorError extends Error {
  constructor(public readonly selector: string) {
    super(`Unsupported calldata selector: ${selector}`);
    this.name = "UnknownSelectorError";
  }
}

export function decodeCalldata(tx: TransactionInput): DeFiIntent {
  const adapter = adapters.find((candidate) => candidate.canDecode(tx));
  if (!adapter) throw new UnknownSelectorError(tx.data.slice(0, 10));
  return adapter.decode(tx);
}
