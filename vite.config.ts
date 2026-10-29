import { defineConfig } from "vite";

export default defineConfig({
  oxc: {
    // React 16.8 has neither the automatic JSX runtime nor Fast Refresh.
    jsx: { runtime: "classic" },
  },
});
