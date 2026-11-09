import { APP_DOWNLOAD_GRANT, ExtensionHost } from "@ryu/app-host/ExtensionHost";
import { capabilitiesFromGrants, type HostServices } from "@ryu/app-host/rpc";
import { htmlCompanionSrcdoc } from "@ryu/app-host/third-party-plugin";
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../../../../packages/i18n/src/react.tsx";
import manifest from "../../../manifest.json" with { type: "json" };
import appHtml from "../../dist/index.html?raw";
import "./host.css";

import { rpcJsonResponseSchema } from "@ryu/app-host/rpc";
import {
	type ConvertFixture,
	type ConvertHostInput,
	convertDownloadMessageSchema,
	type DownloadAttempt,
	type HostCall,
} from "../fixture-schemas.ts";
import styles from "./host.module.css";

declare global {
	interface Window {
		__convertFixture?: ConvertFixture;
	}
}

const STORAGE_PREFIX = "convert-proof:";
const storageKey = (namespace: string | undefined, key: string) =>
	`${namespace ?? "default"}/${key}`;
const calls: HostCall[] = [];
const downloads: DownloadAttempt[] = [];
const toasts: HostCall[] = [];

function recordCall(method: string, input: ConvertHostInput): void {
	calls.push({
		input: rpcJsonResponseSchema.parse(structuredClone(input)),
		method,
	});
}

const services: HostServices = {
	listAgents: async () => [],
	registerRoute: async (claim) => ({ path: claim.path }),
	storageGet: async (input) => {
		recordCall("storage.get", input);
		return localStorage.getItem(
			`${STORAGE_PREFIX}${storageKey(input.namespace, input.key)}`
		);
	},
	storageSet: async (input) => {
		recordCall("storage.set", input);
		localStorage.setItem(
			`${STORAGE_PREFIX}${storageKey(input.namespace, input.key)}`,
			input.value
		);
	},
	uiToastShow: async (input) => {
		recordCall("ui.toast.show", input);
		toasts.push({
			input: rpcJsonResponseSchema.parse(structuredClone(input)),
			method: "ui.toast.show",
		});
		return `convert-toast-${toasts.length}`;
	},
};

const fixture: ConvertFixture = {
	calls,
	downloads,
	getStored: (namespace, key) =>
		localStorage.getItem(`${STORAGE_PREFIX}${storageKey(namespace, key)}`),
	toasts,
};
Object.assign(window, { __convertFixture: fixture });

window.addEventListener("message", (event) => {
	const iframe = document.querySelector<HTMLIFrameElement>(
		'iframe[title="Convert"]'
	);
	if (event.source !== iframe?.contentWindow) {
		return;
	}
	const message = convertDownloadMessageSchema.safeParse(event.data);
	if (message.success) {
		downloads.push({
			body: message.data.body,
			filename: message.data.filename,
			href: message.data.href,
		});
	}
});

function ProductHost() {
	const nonce = useMemo(() => crypto.randomUUID(), []);
	const search = new URLSearchParams(window.location.search);
	const view = search.get("view") ?? "convert";
	const preview = search.get("surface") === "preview";
	const srcdoc = useMemo(
		() => htmlCompanionSrcdoc(nonce, appHtml, manifest.id, { view }),
		[nonce, view]
	);
	const approvedGrants = manifest.permission_grants;
	const granted = useMemo(
		() => capabilitiesFromGrants(approvedGrants),
		[approvedGrants]
	);
	if (preview) {
		return (
			<main className={styles.host}>
				<p className={styles.banner}>
					Standalone Convert preview · no host services
				</p>
				<iframe
					className={styles.frame}
					srcDoc={appHtml}
					title="Convert preview"
				/>
			</main>
		);
	}
	return (
		<main className={styles.host}>
			<p className={styles.banner}>
				Shipped Convert bundle in ExtensionHost · deterministic local storage ·
				no network service
			</p>
			<ExtensionHost
				allowDownloads={approvedGrants.includes(APP_DOWNLOAD_GRANT)}
				allowForms
				granted={granted}
				nonce={nonce}
				services={services}
				srcdoc={srcdoc}
				title="Convert"
			/>
		</main>
	);
}

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<I18nProvider>
			<ProductHost />
		</I18nProvider>
	);
}
