import {
  decodeFunctionData,
  getAddress,
  parseAbi,
  toFunctionSelector,
} from "viem";
import type { ProtocolAdapter } from "./types.js";
import type { ApprovalIntent, TransactionInput } from "../types.js";

const abi = parseAbi(["function approve(address spender,uint256 amount)"]);
const APPROVE_SELECTOR = toFunctionSelector("approve(address,uint256)");

export const erc20Adapter: ProtocolAdapter = {
  name: "erc20",

  canDecode(tx: TransactionInput): boolean {
    return tx.data.slice(0, 10).toLowerCase() === APPROVE_SELECTOR.toLowerCase();
  },

  decode(tx: TransactionInput): ApprovalIntent {
    const decoded = decodeFunctionData({ abi, data: tx.data });
    if (decoded.functionName !== "approve") {
      throw new Error("Unsupported ERC20 calldata");
    }

    const [spender, amount] = decoded.args;
    return {
      protocol: "erc20",
      action: "approve",
      target: getAddress(tx.to),
      selector: APPROVE_SELECTOR,
      rawCalldata: tx.data,
      token: getAddress(tx.to),
      spender: getAddress(spender),
      amount,
    };
  },
};
