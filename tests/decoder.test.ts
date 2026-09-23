import { describe, expect, it } from "vitest";
import { decodeCalldata, UnknownSelectorError } from "../src/decoder/decodeCalldata.js";

describe("decoder", () => {
  it("rejects unknown selectors", () => {
    expect(() => decodeCalldata({
      to: "0x1111111111111111111111111111111111111111",
      data: "0xdeadbeef"
    })).toThrow(UnknownSelectorError);
  });
});
