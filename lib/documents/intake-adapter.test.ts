import { describe, it, expect } from "vitest";
import { mapIntakeToTemplateData } from "./intake-adapter";

describe("mapIntakeToTemplateData", () => {
  it("maps camelCase EstateVault quiz answers to snake_case template shape", () => {
    const result = mapIntakeToTemplateData({
      firstName: "John",
      lastName: "Smith",
      dateOfBirth: "1975-01-15",
      city: "Detroit",
      state: "Michigan",
      maritalStatus: "Married",
      hasMinorChildren: "Yes",
      executorName: "Jane Smith",
      executorRelationship: "Spouse",
      successorExecutorName: "Bob Jones",
      successorExecutorRelationship: "Brother",
      beneficiaries: [
        { name: "Jane Smith", relationship: "Spouse", share: "100" },
      ],
      beneficiariesEqualShares: "No",
      guardianName: "Alice Johnson",
      guardianRelationship: "Sister",
      successorGuardianName: "Tom Brown",
      organDonation: "yes_all",
      hasSpecificGifts: "No",
    });

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    const d = result.data!;
    expect(d.first_name).toBe("John");
    expect(d.last_name).toBe("Smith");
    expect(d.date_of_birth).toBe("1975-01-15");
    expect(d.city).toBe("Detroit");
    expect(d.marital_status).toBe("Married");
    expect(d.has_minor_children).toBe(true);
    expect(d.personal_representative.full_name).toBe("Jane Smith");
    expect(d.personal_representative.relationship).toBe("Spouse");
    expect(d.successor_personal_representative.full_name).toBe("Bob Jones");
    expect(d.primary_beneficiaries).toHaveLength(1);
    expect(d.primary_beneficiaries[0].full_name).toBe("Jane Smith");
    expect(d.primary_beneficiaries[0].share_percent).toBe("100");
    expect(d.guardian?.full_name).toBe("Alice Johnson");
    expect(d.successor_guardian?.full_name).toBe("Tom Brown");
    expect(d.organ_donation).toBe("yes_all");
    expect(d.has_specific_gifts).toBe(false);
  });

  it("passes through existing snake_case fields", () => {
    const result = mapIntakeToTemplateData({
      first_name: "Maria",
      last_name: "Garcia",
      date_of_birth: "1980-06-20",
      city: "Ann Arbor",
      county: "Washtenaw",
      marital_status: "Single",
    });

    expect(result.error).toBeNull();
    expect(result.data!.first_name).toBe("Maria");
    expect(result.data!.last_name).toBe("Garcia");
    expect(result.data!.county).toBe("Washtenaw");
  });

  it("provides defaults for missing fields", () => {
    const result = mapIntakeToTemplateData({
      firstName: "Bob",
      lastName: "Test",
    });

    expect(result.error).toBeNull();
    const d = result.data!;
    expect(d.first_name).toBe("Bob");
    expect(d.last_name).toBe("Test");
    expect(d.middle_name).toBe("");
    expect(d.has_children).toBe(false);
    expect(d.bond_waiver).toBe(true);
    expect(d.no_contest_clause).toBe(true);
    expect(d.dpoa_powers).toEqual(["banking", "real_estate", "business", "tax", "insurance", "government_benefits", "retirement", "digital"]);
    expect(d.children).toEqual([]);
    expect(d.primary_beneficiaries).toEqual([]);
  });

  it("handles equal share distribution for beneficiaries", () => {
    const result = mapIntakeToTemplateData({
      firstName: "Test",
      lastName: "User",
      beneficiaries: [
        { name: "Child A", relationship: "Child", share: "" },
        { name: "Child B", relationship: "Child", share: "" },
        { name: "Child C", relationship: "Child", share: "" },
      ],
      beneficiariesEqualShares: "Yes",
    });

    expect(result.error).toBeNull();
    const bens = result.data!.primary_beneficiaries;
    expect(bens).toHaveLength(3);
    expect(bens[0].share_percent).toBe("33");
    expect(bens[1].share_percent).toBe("33");
    expect(bens[2].share_percent).toBe("33");
  });

  it("returns error on catastrophic parse failure", () => {
    const result = mapIntakeToTemplateData(null as unknown as Record<string, unknown>);
    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
  });
});
