import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi } from "viem";
import { decodeCalldata } from "../src/decoder/decodeCalldata.js";
import { authorizeIntent } from "../src/policy/engine.js";

const ROUTER = "0x4444444444444444444444444444444444444444";
const TOKEN_IN = "0x1111111111111111111111111111111111111111";
const TOKEN_OUT = "0x2222222222222222222222222222222222222222";
const RECIPIENT = "0x3333333333333333333333333333333333333333";
const OTHER = "0x5555555555555555555555555555555555555555";
const NOW = 1_800_000_000n;

const abi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)"
]);

function swap(overrides: Partial<{
  recipient: `0x${string}`;
  deadline: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
}> = {}) {
  const params = {
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    fee: 3000,
    recipient: overrides.recipient ?? RECIPIENT,
    deadline: overrides.deadline ?? NOW + 300n,
    amountIn: overrides.amountIn ?? 1000n,
    amountOutMinimum: overrides.amountOutMinimum ?? 900n,
    sqrtPriceLimitX96: 0n,
  };
  return decodeCalldata({
    to: ROUTER,
    data: encodeFunctionData({ abi, functionName: "exactInputSingle", args: [params] }),
  });
}

describe("swap policy rejection paths", () => {
  it("rejects forbidden recipient", () => {
    const result = authorizeIntent(swap(), { allowedRecipients: [OTHER] }, NOW);
    expect(result.reasons.map(x => x.code)).toContain("RECIPIENT_NOT_ALLOWED");
  });

  it("rejects swap above cap", () => {
    const result = authorizeIntent(swap({ amountIn: 1001n }), { maxSwapAmountIn: 1000n }, NOW);
    expect(result.reasons.map(x => x.code)).toContain("SWAP_AMOUNT_EXCEEDED");
  });

  it("rejects zero minimum output", () => {
    const result = authorizeIntent(swap({ amountOutMinimum: 0n }), { requireNonZeroMinOutput: true }, NOW);
    expect(result.reasons.map(x => x.code)).toContain("ZERO_MIN_OUTPUT");
  });

  it("rejects excessive deadline", () => {
    const result = authorizeIntent(swap({ deadline: NOW + 3601n }), { maxDeadlineSeconds: 3600n }, NOW);
    expect(result.reasons.map(x => x.code)).toContain("DEADLINE_TOO_LONG");
  });

  it("reports expected exposure for an allowed swap", () => {
    const result = authorizeIntent(swap(), {
      allowedProtocols: ["uniswap-v3"],
      allowedTargets: [ROUTER],
      allowedTokens: [TOKEN_IN, TOKEN_OUT],
      allowedRecipients: [RECIPIENT],
      maxSwapAmountIn: 2000n,
      maxDeadlineSeconds: 600n,
      requireNonZeroMinOutput: true
    }, NOW);

    expect(result.decision).toBe("ALLOW");
    expect(result.exposureChanges).toHaveLength(2);
    expect(result.exposureChanges[0].delta).toBe(-1000n);
    expect(result.exposureChanges[1].delta).toBe(900n);
  });
});
