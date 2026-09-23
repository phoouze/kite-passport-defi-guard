import {
  decodeFunctionData,
  getAddress,
  parseAbi,
  toFunctionSelector,
} from "viem";
import type { ProtocolAdapter } from "./types.js";
import type { SwapIntent, TransactionInput } from "../types.js";

const abi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)"
]);

const SELECTOR = toFunctionSelector(
  "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))"
);

export const uniswapV3Adapter: ProtocolAdapter = {
  name: "uniswap-v3",

  canDecode(tx: TransactionInput): boolean {
    return tx.data.slice(0, 10).toLowerCase() === SELECTOR.toLowerCase();
  },

  decode(tx: TransactionInput): SwapIntent {
    const decoded = decodeFunctionData({ abi, data: tx.data });
    if (decoded.functionName !== "exactInputSingle") {
      throw new Error("Unsupported Uniswap calldata");
    }

    const p = decoded.args[0];
    return {
      protocol: "uniswap-v3",
      action: "swap",
      target: getAddress(tx.to),
      selector: SELECTOR,
      rawCalldata: tx.data,
      tokenIn: getAddress(p.tokenIn),
      tokenOut: getAddress(p.tokenOut),
      fee: p.fee,
      recipient: getAddress(p.recipient),
      deadline: p.deadline,
      amountIn: p.amountIn,
      amountOutMinimum: p.amountOutMinimum,
      sqrtPriceLimitX96: p.sqrtPriceLimitX96,
    };
  },
};
