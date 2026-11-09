import { activeLocale } from "@ryu/i18n/core";
import { formatByteSize } from "@ryu/i18n/format-intl";
import { FORMAT_DEFINITIONS } from "./format-definitions.ts";
import type { StoredFormatId } from "./schemas.ts";

export { FORMAT_DEFINITIONS } from "./format-definitions.ts";
export {
	csvToJson,
	escapeHtml,
	htmlToText,
	jsonToCsv,
	looksLikeJson,
	looksLikeYaml,
	markdownToHtml,
	parseCsv,
} from "./text-transforms.ts";
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

export type { HistoryItem } from "./schemas.ts";

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

const FORMAT_BY_ID = new Map<StoredFormatId, FormatDefinition>(
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

export function formatDefinition(id: StoredFormatId): FormatDefinition {
	return FORMAT_BY_ID.get(id) ?? FORMAT_DEFINITIONS[0]!;
}

export function formatLabel(id: StoredFormatId): string {
	return formatDefinition(id).label;
}

/** A file size in the UI locale: "1.5 KB" / "12 MB" in English, "1,5 Ko" in fr. */
export function formatFileSize(
	bytes: number,
	locale: string = activeLocale()
): string {
	const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
	return formatByteSize(size, locale, {
		fractionDigits: (value, unit) => (unit === "byte" || value >= 10 ? 0 : 1),
		maxUnit: "gigabyte",
	});
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

export function fileNameForTarget(fileName: string, target: FormatId): string {
	const definition = formatDefinition(target);
	const stem = fileStem(fileName) || "converted-file";
	return `${stem}.${definition.extension}`;
}
