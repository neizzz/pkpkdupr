import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
             "@": path.resolve(__dirname, "./src"),
             "@pkpkdupr/shared": path.resolve(__dirname, "../../packages/shared/src"),
         },
     },
    server: {
        host: "0.0.0.0",
        port: 3100,
        proxy: {
             "/api": {
                target: "http://localhost:4000",
                changeOrigin: true,
             },
         },
     },
});
