import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative so dist/ works on GitHub Pages or any static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
