import { beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "test-access-secret-sfit-min32chars!!";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-sfit-min32chars!";
});

// Silence console.error in tests
vi.spyOn(console, "error").mockImplementation(() => undefined);
