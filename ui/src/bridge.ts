import type { HistoryItem } from "./model";

const STORAGE_KEY = "history";
const STORAGE_NAMESPACE = "convert";

function localStorageGet(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function localStorageSet(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// A null-origin preview may not expose localStorage. The converter still works.
	}
}

function liveStorage(): NonNullable<Window["ryu"]>["storage"] | null {
	const storage = window.ryu?.storage;
	return storage?.set ? storage : null;
}

export async function loadHistory(): Promise<HistoryItem[]> {
	const storage = liveStorage();
	if (storage) {
		try {
			const value = await storage.get({
				key: STORAGE_KEY,
				namespace: STORAGE_NAMESPACE,
			});
			return parseHistory(value);
		} catch {
			throw new Error(
				"Conversion history could not be loaded. Reload before converting."
			);
		}
	}
	if (window.ryu) {
		throw new Error("Conversion history storage is unavailable on this host.");
	}
	return parseHistory(localStorageGet(`${STORAGE_NAMESPACE}:${STORAGE_KEY}`));
}

export async function saveHistory(items: HistoryItem[]): Promise<void> {
	const value = JSON.stringify(items.slice(0, 40));
	const storage = liveStorage();
	if (storage) {
		await storage.set({
			key: STORAGE_KEY,
			namespace: STORAGE_NAMESPACE,
			value,
		});
		return;
	}
	if (window.ryu) {
		throw new Error("Conversion history storage is unavailable on this host.");
	}
	localStorageSet(`${STORAGE_NAMESPACE}:${STORAGE_KEY}`, value);
}

function parseHistory(value: string | null): HistoryItem[] {
	if (!value) {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(isHistoryItem).slice(0, 40);
	} catch {
		return [];
	}
}

function isHistoryItem(value: unknown): value is HistoryItem {
	if (!value || typeof value !== "object") {
		return false;
	}
	const item = value as Partial<HistoryItem>;
	return (
		typeof item.id === "string" &&
		typeof item.name === "string" &&
		typeof item.source === "string" &&
		typeof item.target === "string" &&
		typeof item.completedAt === "string" &&
		typeof item.size === "number"
	);
}

export async function notify(
	message: string,
	variant: "info" | "success" | "error" = "info"
): Promise<void> {
	try {
		await window.ryu?.ui?.toast?.show({ title: message, variant });
	} catch {
		// Inline status stays authoritative when the optional host toast is unavailable.
	}
}
