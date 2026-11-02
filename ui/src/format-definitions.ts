// The Convert format table: every format the local adapters read or write.
// Split out of model.ts by size; model.ts re-exports it.

import type { FileCategory, FormatDefinition, FormatId } from "./model.ts";

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
