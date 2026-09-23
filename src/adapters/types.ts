import type { DeFiIntent, TransactionInput } from "../types.js";

export interface ProtocolAdapter {
  name: string;
  canDecode(tx: TransactionInput): boolean;
  decode(tx: TransactionInput): DeFiIntent;
}
