import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.BASE_PATH || "./",
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "RunGuide",
        short_name: "RunGuide",
        lang: "cs",
        description: "Tvoje trasa, tvoje tempo a soukromá historie běhů.",
        start_url: "./runner.html",
        scope: "./",
        display: "standalone",
        background_color: "#f1f5f8",
        theme_color: "#172c45",
        icons: [192, 512].map((size) => ({
          src: `icons/icon-${size}.png`,
          sizes: `${size}x${size}`,
          type: "image/png",
          purpose: "any",
        })),
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,png,svg,woff2}"],
        navigateFallback: "runner.html",
        cleanupOutdatedCaches: true,
        // Only the application shell is cached. No GPS/auth API responses or map tile bulk caching.
      },
    }),
  ],
  build: {
    rollupOptions: { input: { landing: "index.html", runner: "runner.html" } },
  },
});
