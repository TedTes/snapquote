import { describe, expect, it } from "vitest";
import { quoteCustomerIdForSync } from "../src/auth/quoteSync";

describe("quoteCustomerIdForSync", () => {
  it("uses the mapped remote customer id after a local customer is synced", () => {
    expect(
      quoteCustomerIdForSync({
        quoteCustomerId: "cust-local",
        customerIdMap: new Map([["cust-local", "7dca46b9-b731-445b-9635-37eaa8e03dee"]]),
      }),
    ).toBe("7dca46b9-b731-445b-9635-37eaa8e03dee");
  });

  it("uses an existing remote customer id directly", () => {
    expect(
      quoteCustomerIdForSync({
        quoteCustomerId: "790a3153-958a-4251-aa4d-d2df76e78141",
        customerIdMap: new Map(),
      }),
    ).toBe("790a3153-958a-4251-aa4d-d2df76e78141");
  });

  it("waits when a quote only has an unsynced local customer id", () => {
    expect(
      quoteCustomerIdForSync({
        quoteCustomerId: "cust-local",
        customerIdMap: new Map(),
      }),
    ).toBeNull();
  });
});
