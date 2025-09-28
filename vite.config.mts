import { defineConfig } from "vitest/config";

const entryPoints = ["/background.ts"];
// get basename without extension
const scriptNames = entryPoints.map(
    (path) => path.split("/").pop()?.split(".").shift() || "",
);
export default defineConfig(({ mode }) => ({
    root: "src",
    test: {
        root: "src/test",
    },
    esbuild: {
        pure: mode === "production" ? ["console.log"] : [],
    },
    build: {
        outDir: "../dist/chrome",
        emptyOutDir: true,
        target: ["chrome140", "firefox140"],
        minify: false,
        cssMinify: true,
        modulePreload: false /* we don't need to preload things */,
        rollupOptions: {
            input: entryPoints.concat(["/popup.html"]),
            output: {
                entryFileNames: (assetInfo) => {
                    if (scriptNames.includes(assetInfo.name)) {
                        // retain original path (e.g. src/content-scripts/abc.ts -> src/content-scripts/abc.js)
                        const relativePath =
                            assetInfo.facadeModuleId?.split("/src/").pop() ||
                            "";
                        return relativePath.replace(".ts", ".js");
                    } else {
                        return "assets/[name]-[hash].js";
                    }
                },
                minifyInternalExports: false, // since minification is off, this makes it worse
            },
        },
    },
}));
