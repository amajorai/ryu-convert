// Text, Markdown, HTML and CSV/JSON transforms used by the local adapters.
// Split out of model.ts by size; model.ts re-exports it.

import {
	type ConvertJsonValue,
	convertedJsonSchema,
	jsonObjectSchema,
} from "./schemas.ts";

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function markdownToHtml(markdown: string): string {
	const lines = markdown.replaceAll("\r\n", "\n").split("\n");
	const output: string[] = [];
	let inList = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (inList) {
				output.push("</ul>");
				inList = false;
			}
			continue;
		}
		if (trimmed.startsWith("### ")) {
			output.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
			continue;
		}
		if (trimmed.startsWith("## ")) {
			output.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
			continue;
		}
		if (trimmed.startsWith("# ")) {
			output.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`);
			continue;
		}
		if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
			if (!inList) {
				output.push("<ul>");
				inList = true;
			}
			output.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
			continue;
		}
		if (inList) {
			output.push("</ul>");
			inList = false;
		}
		output.push(`<p>${inlineMarkdown(trimmed)}</p>`);
	}

	if (inList) {
		output.push("</ul>");
	}
	return output.join("\n");
}

function inlineMarkdown(value: string): string {
	return escapeHtml(value)
		.replace(/\*\*(.+?)\*\*/gu, "<strong>$1</strong>")
		.replace(/`(.+?)`/gu, "<code>$1</code>")
		.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/gu, '<a href="$2">$1</a>');
}

export function htmlToText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/giu, "")
		.replace(/<style[\s\S]*?<\/style>/giu, "")
		.replace(/<br\s*\/?>(?=\S)/giu, "\n")
		.replace(/<\/(p|div|h[1-6]|li|tr)>/giu, "\n")
		.replace(/<[^>]+>/gu, "")
		.replace(/&nbsp;/gu, " ")
		.replace(/&amp;/gu, "&")
		.replace(/&lt;/gu, "<")
		.replace(/&gt;/gu, ">")
		.replace(/&quot;/gu, '"')
		.replace(/&#39;/gu, "'")
		.replace(/[ \t]+\n/gu, "\n")
		.replace(/\n{3,}/gu, "\n\n")
		.trim();
}

export function parseCsv(input: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;

	for (let index = 0; index < input.length; index += 1) {
		const character = input[index];
		const next = input[index + 1];
		if (character === '"') {
			if (quoted && next === '"') {
				cell += '"';
				index += 1;
			} else {
				quoted = !quoted;
			}
		} else if (character === "," && !quoted) {
			row.push(cell);
			cell = "";
		} else if ((character === "\n" || character === "\r") && !quoted) {
			if (character === "\r" && next === "\n") {
				index += 1;
			}
			row.push(cell);
			if (row.some((value) => value.trim())) {
				rows.push(row);
			}
			row = [];
			cell = "";
		} else {
			cell += character;
		}
	}

	row.push(cell);
	if (row.some((value) => value.trim())) {
		rows.push(row);
	}
	return rows;
}

export function csvToJson(input: string): string {
	const [headerRow, ...body] = parseCsv(input);
	if (!headerRow) {
		return "[]";
	}
	const headers = headerRow.map(
		(header, index) => header.trim() || `column_${index + 1}`
	);
	const records = body.map((row) =>
		Object.fromEntries(
			headers.map((header, index) => [header, row[index] ?? ""])
		)
	);
	return JSON.stringify(records, null, 2);
}

function csvCell(value: ConvertJsonValue | undefined): string {
	const text = value === null || value === undefined ? "" : String(value);
	return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function jsonToCsv(input: string): string {
	const value = convertedJsonSchema.parse(JSON.parse(input));
	const records = Array.isArray(value) ? value : [value];
	const objects = records.map((record) => {
		const object = jsonObjectSchema.safeParse(record);
		return object.success ? object.data : { value: record };
	});
	const headers = [
		...new Set(objects.flatMap((record) => Object.keys(record))),
	];
	if (headers.length === 0) {
		return "";
	}
	return [
		headers.map(csvCell).join(","),
		...objects.map((record) =>
			headers.map((header) => csvCell(record[header])).join(",")
		),
	].join("\n");
}

export function looksLikeJson(extension: string): boolean {
	return extension === "json";
}

export function looksLikeYaml(extension: string): boolean {
	return extension === "yaml" || extension === "yml";
}
