// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            injectRegister: null,

            strategies: "generateSW",
            filename: "pwa-sw.js",
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
                navigateFallback: "/index.html",
            },

            includeAssets: ["favicon.ico"],

            manifest: {
                name: "Tasker",
                short_name: "Tasker",
                description:
                    "Gerencie suas tarefas de forma simples e eficiente.",
                theme_color: "#ffffff",
                background_color: "#ffffff",
                display: "standalone",
                orientation: "portrait",
                scope: "/",
                start_url: "/",
                icons: [
                    {
                        src: "/icon-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            },

            devOptions: { enabled: false },
        }),
    ],

    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },

    server: {
        port: 5174,
        open: true,
        strictPort: true,
    },

    optimizeDeps: {
        include: ["react", "react-dom"],
        esbuildOptions: { target: "es2020" },
    },

    css: {
        modules: { localsConvention: "camelCaseOnly" },
    },

    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
});
