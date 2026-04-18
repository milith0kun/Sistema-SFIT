import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      JWT_ACCESS_SECRET: "test-access-secret-sfit-min32chars!!",
      JWT_REFRESH_SECRET: "test-refresh-secret-sfit-min32chars!",
      MONGODB_URI: "mongodb://localhost:27017/sfit_test",
      NODE_ENV: "test",
      QR_HMAC_SECRET: "test-qr-secret-sfit-32chars!!!!!!",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["src/test/**", "node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
