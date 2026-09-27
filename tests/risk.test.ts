import { describe, expect, it } from "vitest";
import { encodeFunctionData, maxUint256, parseAbi } from "viem";
import { preflight } from "../src/simulation/preflight.js";

const TOKEN = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";
const ROUTER = "0x4444444444444444444444444444444444444444";
const TOKEN_OUT = "0x5555555555555555555555555555555555555555";
const RECIPIENT = "0x3333333333333333333333333333333333333333";
const NOW = 1_800_000_000n;
const approveAbi = parseAbi(["function approve(address spender,uint256 amount)"]);
const swapAbi = parseAbi(["function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)"]);

function approve(amount: bigint) {
  return { to: TOKEN, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [SPENDER, amount] }) } as const;
}

function swap(amountIn: bigint, amountOutMinimum = 900n, deadline = NOW + 300n) {
  return {
    to: ROUTER,
    data: encodeFunctionData({ abi: swapAbi, functionName: "exactInputSingle", args: [{
      tokenIn: TOKEN, tokenOut: TOKEN_OUT, fee: 3000, recipient: RECIPIENT,
      deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n,
    }] }),
  } as const;
}

describe("risk assessment", () => {
  it("marks a normal bounded approval as LOW risk", () => {
    const report = preflight(approve(100n), { maxApprovalAmount: 1000n }, NOW);
    expect(report.authorization.decision).toBe("ALLOW");
    expect(report.risk.level).toBe("LOW");
    expect(report.risk.factors).toHaveLength(0);
  });

  it("marks an allowed approval near its policy limit as HIGH risk", () => {
    const report = preflight(approve(850n), { maxApprovalAmount: 1000n }, NOW);
    expect(report.authorization.decision).toBe("ALLOW");
    expect(report.risk.level).toBe("HIGH");
    expect(report.risk.factors.map(x => x.code)).toContain("APPROVAL_NEAR_LIMIT");
  });

  it("marks unlimited approval as CRITICAL even when policy permits it", () => {
    const report = preflight(approve(maxUint256), { denyUnlimitedApproval: false }, NOW);
    expect(report.authorization.decision).toBe("ALLOW");
    expect(report.risk.level).toBe("CRITICAL");
    expect(report.risk.factors.map(x => x.code)).toContain("UNLIMITED_APPROVAL");
  });

  it("marks a swap near its input cap as HIGH risk", () => {
    const report = preflight(swap(900n), { maxSwapAmountIn: 1000n }, NOW);
    expect(report.authorization.decision).toBe("ALLOW");
    expect(report.risk.factors.map(x => x.code)).toContain("SWAP_NEAR_LIMIT");
    expect(report.risk.level).toBe("HIGH");
  });

  it("reports zero minimum output as a HIGH risk signal", () => {
    const report = preflight(swap(100n, 0n), { requireNonZeroMinOutput: false }, NOW);
    expect(report.authorization.decision).toBe("ALLOW");
    expect(report.risk.factors.map(x => x.code)).toContain("ZERO_MIN_OUTPUT");
  });

  it("reports a long deadline as MEDIUM risk", () => {
    const report = preflight(swap(100n, 90n, NOW + 3600n), {}, NOW);
    expect(report.risk.level).toBe("MEDIUM");
    expect(report.risk.factors.map(x => x.code)).toContain("LONG_DEADLINE");
  });

  it("escalates a policy-denied transaction to CRITICAL", () => {
    const report = preflight(approve(101n), { maxApprovalAmount: 100n }, NOW);
    expect(report.authorization.decision).toBe("DENY");
    expect(report.risk.level).toBe("CRITICAL");
    expect(report.risk.factors.map(x => x.code)).toContain("POLICY_DENIED");
  });

  it("reports native value as an additional risk factor", () => {
    const tx = { ...approve(10n), value: 1n };
    const report = preflight(tx, { allowNativeValue: true }, NOW);
    expect(report.authorization.decision).toBe("ALLOW");
    expect(report.risk.factors.map(x => x.code)).toContain("NATIVE_VALUE");
  });
});
