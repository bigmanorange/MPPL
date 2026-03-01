import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      "georgetta-renascent-doubly.ngrok-free.dev"

    // THIS FIXES YOUR CONNECTION ERROR
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
