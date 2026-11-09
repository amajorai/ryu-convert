import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const e2eDirectory = import.meta.dirname;
const appRoot = path.resolve(e2eDirectory, "..");
const baseURL = "http://127.0.0.1:5847";

export default defineConfig({
	testDir: e2eDirectory,
	testMatch: "convert-companion.spec.ts",
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		viewport: { width: 1440, height: 1000 },
	},
	webServer: {
		command:
			"bun run build && bun run vite --config=e2e/host/vite.config.ts --host 127.0.0.1 --port 5847 --strictPort",
		cwd: appRoot,
		url: `${baseURL}/__ready`,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
