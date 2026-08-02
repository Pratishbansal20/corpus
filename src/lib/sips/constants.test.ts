import { describe, it, expect } from "vitest";
import { bankLabel } from "./constants";

describe("bankLabel", () => {
  it("masks to the last 4, matching how accounts read elsewhere", () => {
    expect(bankLabel({ bankName: "HDFC Bank", last4: "4583" })).toBe(
      "HDFC Bank ••4583",
    );
  });

  it("prefers a nickname when the user set one", () => {
    expect(
      bankLabel({ bankName: "HDFC Bank", nickname: "Salary", last4: "4583" }),
    ).toBe("Salary ••4583");
  });

  it("falls back to the bank name when the nickname is blank", () => {
    expect(
      bankLabel({ bankName: "HDFC Bank", nickname: "   ", last4: "4583" }),
    ).toBe("HDFC Bank ••4583");
  });

  it("omits the mask when no last 4 is stored", () => {
    expect(bankLabel({ bankName: "SBI", last4: null })).toBe("SBI");
  });
});
