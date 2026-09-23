import type { PolicyRejection, RejectionCode } from "../types.js";

export function reject(code: RejectionCode, message: string): PolicyRejection {
  return { code, message };
}
