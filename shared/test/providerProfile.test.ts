import { describe, expect, it } from "vitest";
import { orgProfileSchema, updateOrgProfileSchema } from "../src/schemas";

describe("provider profile schema", () => {
  it("defaults services for profiles created before the services migration", () => {
    const profile = orgProfileSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Bright Coat Painting",
      trade: "painting",
      logoUrl: null,
      profileBio: null,
      serviceArea: null,
      yearsInBusiness: null,
      defaultTaxRate: 0.13,
      defaultTerms: "",
      quoteValidDays: 14,
      setupCompletedAt: null,
      plan: "trial"
    });

    expect(profile.profileServices).toEqual([]);
  });

  it("accepts a focused service list and rejects oversized lists", () => {
    expect(updateOrgProfileSchema.parse({
      profileServices: ["Interior painting", "Cabinets"]
    }).profileServices).toEqual(["Interior painting", "Cabinets"]);

    expect(updateOrgProfileSchema.safeParse({
      profileServices: Array.from({ length: 13 }, (_, index) => `Service ${index + 1}`)
    }).success).toBe(false);
  });
});
