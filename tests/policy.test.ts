import { describe, expect, it } from "vitest";
import { encodeFunctionData, maxUint256, parseAbi } from "viem";
import { decodeCalldata } from "../src/decoder/decodeCalldata.js";
import { authorizeIntent } from "../src/policy/engine.js";

const TOKEN = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";

const approveAbi = parseAbi(["function approve(address spender,uint256 amount)"]);

function approval(amount: bigint, spender = SPENDER) {
  return decodeCalldata({
    to: TOKEN,
    data: encodeFunctionData({
      abi: approveAbi,
      functionName: "approve",
      args: [spender, amount],
    }),
  });
}

describe("policy engine rejection paths", () => {
  it("rejects a forbidden protocol", () => {
    const result = authorizeIntent(approval(10n), { allowedProtocols: ["uniswap-v3"] });
    expect(result.reasons.map(x => x.code)).toContain("PROTOCOL_NOT_ALLOWED");
  });

  it("rejects a forbidden target", () => {
    const result = authorizeIntent(approval(10n), { allowedTargets: [OTHER] });
    expect(result.reasons.map(x => x.code)).toContain("TARGET_NOT_ALLOWED");
  });

  it("rejects a forbidden token", () => {
    const result = authorizeIntent(approval(10n), { allowedTokens: [OTHER] });
    expect(result.reasons.map(x => x.code)).toContain("TOKEN_NOT_ALLOWED");
  });

  it("rejects a forbidden spender", () => {
    const result = authorizeIntent(approval(10n), { allowedSpenders: [OTHER] });
    expect(result.reasons.map(x => x.code)).toContain("SPENDER_NOT_ALLOWED");
  });

  it("rejects unlimited approval", () => {
    const result = authorizeIntent(approval(maxUint256), { denyUnlimitedApproval: true });
    expect(result.reasons.map(x => x.code)).toContain("UNLIMITED_APPROVAL");
  });

  it("rejects approval above cap", () => {
    const result = authorizeIntent(approval(101n), { maxApprovalAmount: 100n });
    expect(result.reasons.map(x => x.code)).toContain("APPROVAL_AMOUNT_EXCEEDED");
  });

  it("allows a bounded allowlisted approval", () => {
    const result = authorizeIntent(approval(50n), {
      allowedProtocols: ["erc20"],
      allowedTokens: [TOKEN],
      allowedTargets: [TOKEN],
      allowedSpenders: [SPENDER],
      maxApprovalAmount: 100n,
      denyUnlimitedApproval: true
    });
    expect(result.decision).toBe("ALLOW");
    expect(result.exposureChanges[0].kind).toBe("approval");
  });
});
