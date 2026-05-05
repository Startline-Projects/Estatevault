export const TEST_USERS = {
  admin: { email: "test-admin@estatevault.test", password: "TestPass123!", name: "Test Admin" },
  partnerBasic: { email: "test-partner-basic@estatevault.test", password: "TestPass123!", name: "Basic Partner", slug: "test-basic" },
  partnerEnterprise: { email: "test-partner-ent@estatevault.test", password: "TestPass123!", name: "Enterprise Partner", slug: "test-ent" },
  client: { email: "test-client@estatevault.test", password: "TestPass123!", name: "Test Client" },
  attorney: { email: "test-attorney@estatevault.test", password: "TestPass123!", name: "Test Attorney" },
  salesRep: { email: "test-sales@estatevault.test", password: "TestPass123!", name: "Test Sales" },
} as const;
