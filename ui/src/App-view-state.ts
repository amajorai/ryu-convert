import { type ConvertView, FORMAT_DEFINITIONS } from "./model.ts";
import { convertViewSchema } from "./schemas.ts";

export const ACCEPTED_FILES = [
	"image/*",
	"audio/*",
	"video/*",
	"application/pdf",
	"application/json",
	"text/*",
	...FORMAT_DEFINITIONS.map((format) => `.${format.extension}`),
	".htm",
	".mdx",
	".text",
	".tif",
	".tsv",
	".yml",
].join(",");

export interface Notice {
	message: string;
	variant: "info" | "success" | "error";
}

export function newId(prefix: string): string {
	return `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function initialView(): ConvertView {
	const view = globalThis.window?.ryu?.context?.view;
	return view === "history" || view === "formats" || view === "tools"
		? view
		: "convert";
}

export function isConvertView(value: string): value is ConvertView {
	return convertViewSchema.safeParse(value).success;
}
