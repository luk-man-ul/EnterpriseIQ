import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:3000/api/v1",
    },
  },
});
