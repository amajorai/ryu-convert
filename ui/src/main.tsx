import {
	markCompanionAppRoot,
	subscribeCompanionTheme,
} from "@ryu/app-host/companion-theme";
import { RyuAppShell } from "@ryu/blocks/companion/app-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./convert.css";

subscribeCompanionTheme();

const root = document.getElementById("ryu-plugin-root");
if (!root) {
	throw new Error("Convert root element is missing.");
}

markCompanionAppRoot(root, { surface: "standard" });

createRoot(root).render(
	<StrictMode>
		<RyuAppShell>
			<App />
		</RyuAppShell>
	</StrictMode>
);
