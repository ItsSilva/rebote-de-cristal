import { defineConfig } from "vite";

export default defineConfig(async ({ command }) => {
  const { needlePlugins, useGzip, loadConfig } = await import(
    "@needle-tools/engine/vite"
  );
  const needleConfig = await loadConfig();
  return {
    base: "./",
    plugins: [
      needlePlugins(command, needleConfig, {
        noPoster: true,
        allowHotReload: false,
      }),
    ],
    server: {
      https: false,
      strictPort: true,
      port: 3000,
      hmr: false,
      proxy: { "/socket": { target: "ws://127.0.0.1:8787", ws: true } },
    },
    build: {
      outDir: "./dist",
      emptyOutDir: true,
    },
  };
});
