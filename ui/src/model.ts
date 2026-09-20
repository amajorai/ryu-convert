export type ConvertView = "convert" | "history" | "formats" | "tools";
export type FileCategory =
	| "archives"
	| "data"
	| "documents"
	| "images"
	| "media";
export type QueueStatus = "ready" | "converting" | "complete" | "error";

export type FormatId =
	| "png"
	| "jpeg"
	| "webp"
	| "avif"
	| "gif"
	| "bmp"
	| "svg"
	| "tiff"
	| "heic"
	| "heif"
	| "ico"
	| "jxl"
	| "raw"
	| "pdf"
	| "txt"
	| "md"
	| "html"
	| "rtf"
	| "doc"
	| "json"
	| "csv"
	| "tsv"
	| "yaml"
	| "xml"
	| "toml"
	| "vcf"
	| "ics"
	| "ppt"
	| "pptx"
	| "xls"
	| "xlsx"
	| "odt"
	| "ods"
	| "odp"
	| "epub"
	| "tex"
	| "webm"
	| "mp4"
	| "mov"
	| "mkv"
	| "avi"
	| "wmv"
	| "mpeg"
	| "ts"
	| "m3u8"
	| "mp3"
	| "wav"
	| "ogg"
	| "flac"
	| "aac"
	| "m4a"
	| "docx"
	| "zip";

export interface FormatDefinition {
	available: boolean;
	category: FileCategory;
	description: string;
	extension: string;
	id: FormatId;
	inputOnly?: boolean;
	label: string;
	mimeType: string;
}

export interface HistoryItem {
	completedAt: string;
	id: string;
	name: string;
	size: number;
	source: string;
	target: FormatId;
}

export interface ConversionResult {
	blob: Blob;
	fileName: string;
	format: FormatId;
}

export interface QueueItem {
	error?: string;
	file: File;
	id: string;
	output?: ConversionResult;
	progress: number | null;
	status: QueueStatus;
	target: FormatId;
}

export const CATEGORIES: Array<{
	id: "all" | FileCategory;
	label: string;
	description: string;
}> = [
	{ id: "all", label: "All files", description: "Every local adapter" },
	{ id: "archives", label: "Archives", description: "ZIP bundles" },
	{ id: "images", label: "Images", description: "Raster and vector" },
	{ id: "documents", label: "Documents", description: "PDF and text" },
	{ id: "data", label: "Data", description: "Structured text" },
	{ id: "media", label: "Media", description: "Audio and video" },
];

export const FORMAT_DEFINITIONS: FormatDefinition[] = [
	{
		id: "png",
		label: "PNG",
		extension: "png",
		category: "images",
		mimeType: "image/png",
		description: "Lossless image output with wide browser support.",
		available: true,
	},
	{
		id: "jpeg",
		label: "JPEG",
		extension: "jpg",
		category: "images",
		mimeType: "image/jpeg",
		description: "Compact photo output with adjustable quality.",
		available: true,
	},
	{
		id: "webp",
		label: "WebP",
		extension: "webp",
		category: "images",
		mimeType: "image/webp",
		description: "Modern image output for smaller web assets.",
		available: true,
	},
	{
		id: "avif",
		label: "AVIF",
		extension: "avif",
		category: "images",
		mimeType: "image/avif",
		description: "High-efficiency image output when the browser supports it.",
		available: true,
	},
	{
		id: "pdf",
		label: "PDF",
		extension: "pdf",
		category: "documents",
		mimeType: "application/pdf",
		description: "Portable document output made locally with embedded fonts.",
		available: true,
	},
	{
		id: "txt",
		label: "Plain text",
		extension: "txt",
		category: "documents",
		mimeType: "text/plain",
		description: "Clean, portable text without presentation markup.",
		available: true,
	},
	{
		id: "md",
		label: "Markdown",
		extension: "md",
		category: "documents",
		mimeType: "text/markdown",
		description: "Portable notes with headings, lists, and links.",
		available: true,
	},
	{
		id: "html",
		label: "HTML",
		extension: "html",
		category: "documents",
		mimeType: "text/html",
		description: "A standalone HTML document with escaped local content.",
		available: true,
	},
	{
		id: "json",
		label: "JSON",
		extension: "json",
		category: "data",
		mimeType: "application/json",
		description: "Structured data with stable two-space formatting.",
		available: true,
	},
	{
		id: "csv",
		label: "CSV",
		extension: "csv",
		category: "data",
		mimeType: "text/csv",
		description: "Spreadsheet-friendly rows and columns.",
		available: true,
	},
	{
		id: "yaml",
		label: "YAML",
		extension: "yaml",
		category: "data",
		mimeType: "application/yaml",
		description: "Human-readable configuration and data output.",
		available: true,
	},
	{
		id: "webm",
		label: "WebM",
		extension: "webm",
		category: "media",
		mimeType: "video/webm",
		description: "Local media output through the browser's WebCodecs path.",
		available: true,
	},
	{
		id: "docx",
		label: "DOCX",
		extension: "docx",
		category: "documents",
		mimeType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		description: "Readable Word input through the local document adapter.",
		available: true,
	},
];

function inputFormat(
	id: FormatId,
	label: string,
	extension: string,
	category: FileCategory,
	mimeType: string,
	description: string
): FormatDefinition {
	return {
		available: true,
		category,
		description,
		extension,
		id,
		inputOnly: true,
		label,
		mimeType,
	};
}

function mediaFormat(
	id: FormatId,
	label: string,
	extension: string,
	category: FileCategory,
	mimeType: string,
	description: string
): FormatDefinition {
	return {
		available: true,
		category,
		description,
		extension,
		id,
		label,
		mimeType,
	};
}

FORMAT_DEFINITIONS.push(
	{
		available: true,
		category: "images",
		description: "Animated/raster input that can be rasterized by the browser.",
		extension: "gif",
		id: "gif",
		label: "GIF",
		mimeType: "image/gif",
	},
	{
		available: true,
		category: "images",
		description: "Bitmap input that can be rasterized by the browser.",
		extension: "bmp",
		id: "bmp",
		label: "BMP",
		mimeType: "image/bmp",
	},
	{
		available: true,
		category: "images",
		description: "Vector input that can be rasterized by the browser.",
		extension: "svg",
		id: "svg",
		label: "SVG",
		mimeType: "image/svg+xml",
	},
	inputFormat(
		"tiff",
		"TIFF",
		"tiff",
		"images",
		"image/tiff",
		"Image input; output needs a TIFF decoder."
	),
	inputFormat(
		"heic",
		"HEIC",
		"heic",
		"images",
		"image/heic",
		"HEIF-family input; browser codec support varies."
	),
	inputFormat(
		"heif",
		"HEIF",
		"heif",
		"images",
		"image/heif",
		"HEIF-family input; browser codec support varies."
	),
	inputFormat(
		"ico",
		"ICO",
		"ico",
		"images",
		"image/x-icon",
		"Icon input; output needs a browser decoder."
	),
	inputFormat(
		"jxl",
		"JPEG XL",
		"jxl",
		"images",
		"image/jxl",
		"JPEG XL input marker for a local codec engine."
	),
	inputFormat(
		"raw",
		"RAW",
		"raw",
		"images",
		"application/octet-stream",
		"Camera RAW input marker for a local codec engine."
	),
	inputFormat(
		"rtf",
		"RTF",
		"rtf",
		"documents",
		"application/rtf",
		"Rich-text input marker; layout conversion is not claimed."
	),
	inputFormat(
		"doc",
		"DOC",
		"doc",
		"documents",
		"application/msword",
		"Legacy Word input marker for a local office engine."
	),
	inputFormat(
		"ppt",
		"PPT",
		"ppt",
		"documents",
		"application/vnd.ms-powerpoint",
		"Legacy PowerPoint input marker for a local office engine."
	),
	inputFormat(
		"pptx",
		"PPTX",
		"pptx",
		"documents",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"PowerPoint input marker for a local office engine."
	),
	inputFormat(
		"xls",
		"XLS",
		"xls",
		"documents",
		"application/vnd.ms-excel",
		"Legacy spreadsheet input marker for a local office engine."
	),
	inputFormat(
		"xlsx",
		"XLSX",
		"xlsx",
		"documents",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"Spreadsheet input marker for a local office engine."
	),
	inputFormat(
		"odt",
		"ODT",
		"odt",
		"documents",
		"application/vnd.oasis.opendocument.text",
		"OpenDocument text input marker."
	),
	inputFormat(
		"ods",
		"ODS",
		"ods",
		"documents",
		"application/vnd.oasis.opendocument.spreadsheet",
		"OpenDocument spreadsheet input marker."
	),
	inputFormat(
		"odp",
		"ODP",
		"odp",
		"documents",
		"application/vnd.oasis.opendocument.presentation",
		"OpenDocument presentation input marker."
	),
	inputFormat(
		"epub",
		"EPUB",
		"epub",
		"documents",
		"application/epub+zip",
		"E-book input marker for a local ebook engine."
	),
	inputFormat(
		"tex",
		"LaTeX",
		"tex",
		"documents",
		"application/x-tex",
		"LaTeX input marker for a local typesetting engine."
	),
	inputFormat(
		"xml",
		"XML",
		"xml",
		"data",
		"application/xml",
		"XML input accepted as local text."
	),
	inputFormat(
		"toml",
		"TOML",
		"toml",
		"data",
		"application/toml",
		"TOML input accepted as local text."
	),
	inputFormat(
		"vcf",
		"VCF",
		"vcf",
		"data",
		"text/vcard",
		"Contact-card input marker for schema-aware conversion."
	),
	inputFormat(
		"ics",
		"ICS",
		"ics",
		"data",
		"text/calendar",
		"Calendar input marker for schema-aware conversion."
	),
	mediaFormat(
		"mp4",
		"MP4",
		"mp4",
		"media",
		"video/mp4",
		"Mediabunny container output; browser codec support determines conversion."
	),
	mediaFormat(
		"mov",
		"MOV",
		"mov",
		"media",
		"video/quicktime",
		"Mediabunny QuickTime output; browser codec support determines conversion."
	),
	mediaFormat(
		"mkv",
		"MKV",
		"mkv",
		"media",
		"video/x-matroska",
		"Mediabunny Matroska output; browser codec support determines conversion."
	),
	inputFormat(
		"avi",
		"AVI",
		"avi",
		"media",
		"video/x-msvideo",
		"AVI input marker for a local FFmpeg engine; Mediabunny does not decode this container."
	),
	inputFormat(
		"wmv",
		"WMV",
		"wmv",
		"media",
		"video/x-ms-wmv",
		"WMV input marker for a local FFmpeg engine; Mediabunny does not decode this container."
	),
	mediaFormat(
		"ts",
		"MPEG-TS",
		"ts",
		"media",
		"video/mp2t",
		"Mediabunny transport-stream output; codec support determines conversion."
	),
	inputFormat(
		"m3u8",
		"HLS",
		"m3u8",
		"media",
		"application/vnd.apple.mpegurl",
		"HLS playlist input marker; external segments are not fetched by this file-only build."
	),
	inputFormat(
		"mpeg",
		"MPEG",
		"mpeg",
		"media",
		"video/mpeg",
		"MPEG input marker for a local media engine; browser support varies."
	),
	mediaFormat(
		"mp3",
		"MP3",
		"mp3",
		"media",
		"audio/mpeg",
		"Local MP3 output when the browser can decode and encode the source."
	),
	mediaFormat(
		"wav",
		"WAV",
		"wav",
		"media",
		"audio/wav",
		"Local uncompressed audio output through Mediabunny."
	),
	mediaFormat(
		"ogg",
		"Ogg",
		"ogg",
		"media",
		"audio/ogg",
		"Local Ogg output when the browser supports the source codec."
	),
	mediaFormat(
		"flac",
		"FLAC",
		"flac",
		"media",
		"audio/flac",
		"Local lossless audio output through Mediabunny."
	),
	mediaFormat(
		"aac",
		"AAC",
		"aac",
		"media",
		"audio/aac",
		"Local AAC/ADTS output when the browser can encode AAC."
	),
	mediaFormat(
		"m4a",
		"M4A",
		"m4a",
		"media",
		"audio/mp4",
		"Audio-only MP4 output with an M4A filename."
	),
	{
		available: true,
		category: "archives",
		description:
			"Inspect a local ZIP manifest; completed batches can also be bundled as ZIP.",
		extension: "zip",
		id: "zip",
		inputOnly: true,
		label: "ZIP",
		mimeType: "application/zip",
	}
);

const FORMAT_BY_ID = new Map(
	FORMAT_DEFINITIONS.map((format) => [format.id, format])
);

const IMAGE_EXTENSIONS = new Set([
	"avif",
	"bmp",
	"gif",
	"heic",
	"heif",
	"ico",
	"jpeg",
	"jxl",
	"jpg",
	"png",
	"raw",
	"svg",
	"tif",
	"tiff",
	"webp",
]);

const MEDIA_EXTENSIONS = new Set([
	"aac",
	"avi",
	"flac",
	"m4a",
	"mkv",
	"mov",
	"mp3",
	"mp4",
	"mpeg",
	"ogg",
	"ts",
	"wav",
	"webm",
]);

const DATA_EXTENSIONS = new Set(["csv", "json", "tsv", "yaml", "yml"]);
const ARCHIVE_EXTENSIONS = new Set(["zip"]);

const TEXT_EXTENSIONS = new Set([
	"css",
	"html",
	"htm",
	"js",
	"jsx",
	"md",
	"mdx",
	"rtf",
	"text",
	"toml",
	"txt",
	"xml",
	"ics",
	"rtf",
	"tex",
	"toml",
	"vcf",
	"yaml",
	"yml",
]);

export function fileExtension(fileName: string): string {
	const lastPart = fileName.split(/[\\/]/u).at(-1) ?? fileName;
	const dot = lastPart.lastIndexOf(".");
	return dot > 0 ? lastPart.slice(dot + 1).toLowerCase() : "";
}

export function fileStem(fileName: string): string {
	const lastPart = fileName.split(/[\\/]/u).at(-1) ?? fileName;
	const dot = lastPart.lastIndexOf(".");
	return dot > 0 ? lastPart.slice(0, dot) : lastPart;
}

export function detectCategory(fileName: string, mimeType = ""): FileCategory {
	const extension = fileExtension(fileName);
	if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) {
		return "images";
	}
	if (
		mimeType.startsWith("audio/") ||
		mimeType.startsWith("video/") ||
		MEDIA_EXTENSIONS.has(extension)
	) {
		return "media";
	}
	if (DATA_EXTENSIONS.has(extension)) {
		return "data";
	}
	if (ARCHIVE_EXTENSIONS.has(extension)) {
		return "archives";
	}
	return "documents";
}

export function formatDefinition(id: FormatId): FormatDefinition {
	return FORMAT_BY_ID.get(id) ?? FORMAT_DEFINITIONS[0]!;
}

export function formatLabel(id: FormatId): string {
	return formatDefinition(id).label;
}

export function formatFileSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB"];
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1
	);
	const value = bytes / 1024 ** index;
	return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function targetsForFile(
	fileName: string,
	mimeType = ""
): FormatDefinition[] {
	const category = detectCategory(fileName, mimeType);
	const extension = fileExtension(fileName);

	if (category === "images") {
		const imageTargets: FormatId[] = ["png", "jpeg", "webp", "avif", "pdf"];
		return imageTargets.map((id) => formatDefinition(id));
	}
	if (category === "media") {
		const mediaTargets: FormatId[] = [
			"webm",
			"mp4",
			"mov",
			"mkv",
			"ts",
			"mp3",
			"wav",
			"ogg",
			"flac",
			"aac",
			"m4a",
		];
		return mediaTargets.map((id) => formatDefinition(id));
	}
	if (category === "archives") {
		const archiveTargets: FormatId[] = ["json", "txt", "md", "pdf"];
		return archiveTargets.map((id) => formatDefinition(id));
	}
	if (extension === "docx") {
		const documentTargets: FormatId[] = ["html", "txt", "md", "pdf"];
		return documentTargets.map((id) => formatDefinition(id));
	}
	if (extension === "pdf") {
		const pdfTargets: FormatId[] = ["png", "jpeg", "webp", "txt", "md", "pdf"];
		return pdfTargets.map((id) => formatDefinition(id));
	}
	if (category === "data") {
		const dataTargets: FormatId[] = ["json", "csv", "yaml", "txt", "pdf"];
		return dataTargets.map((id) => formatDefinition(id));
	}
	if (TEXT_EXTENSIONS.has(extension) || mimeType.startsWith("text/")) {
		const textTargets: FormatId[] = [
			"txt",
			"md",
			"html",
			"json",
			"csv",
			"yaml",
			"pdf",
		];
		return textTargets.map((id) => formatDefinition(id));
	}
	return [formatDefinition("txt"), formatDefinition("pdf")];
}

export function defaultTargetForFile(
	fileName: string,
	mimeType = ""
): FormatId {
	const extension = fileExtension(fileName);
	if (extension === "json") {
		return "csv";
	}
	if (extension === "csv") {
		return "json";
	}
	if (extension === "yaml" || extension === "yml") {
		return "json";
	}
	if (detectCategory(fileName, mimeType) === "images") {
		return "webp";
	}
	if (detectCategory(fileName, mimeType) === "media") {
		return "webm";
	}
	return "pdf";
}

export function isTextLike(fileName: string, mimeType = ""): boolean {
	return (
		TEXT_EXTENSIONS.has(fileExtension(fileName)) ||
		DATA_EXTENSIONS.has(fileExtension(fileName)) ||
		mimeType.startsWith("text/") ||
		mimeType === "application/json" ||
		mimeType === "application/yaml"
	);
}

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

export function fileNameForTarget(fileName: string, target: FormatId): string {
	const definition = formatDefinition(target);
	const stem = fileStem(fileName) || "converted-file";
	return `${stem}.${definition.extension}`;
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

function csvCell(value: unknown): string {
	const text = value === null || value === undefined ? "" : String(value);
	return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function jsonToCsv(input: string): string {
	const value: unknown = JSON.parse(input);
	const records = Array.isArray(value) ? value : [value];
	const objects: Record<string, unknown>[] = records.map((record) =>
		record && typeof record === "object" && !Array.isArray(record)
			? (record as Record<string, unknown>)
			: { value: record }
	);
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
