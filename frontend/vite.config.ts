import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  publicDir: mode === "cloudflare" ? "public-deploy" : "public",
}));
