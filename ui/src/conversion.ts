import type { OutputFormat } from "mediabunny";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
	type ConversionResult,
	csvToJson,
	detectCategory,
	escapeHtml,
	FORMAT_DEFINITIONS,
	type FormatId,
	fileExtension,
	fileNameForTarget,
	fileStem,
	htmlToText,
	jsonToCsv,
	markdownToHtml,
} from "./model";
import { zipResults } from "./tools";

export interface ConversionOptions {
	crop: ImageCrop | null;
	imageQuality: number;
	maxWidth: number | null;
	onProgress?: (progress: number) => void;
	rotation: number;
	watermark: string;
}

export interface ImageCrop {
	height: number;
	width: number;
	x: number;
	y: number;
}

const DEFAULT_OPTIONS: ConversionOptions = {
	crop: null,
	imageQuality: 0.92,
	maxWidth: null,
	rotation: 0,
	watermark: "",
};

const IMAGE_MIME_TYPES: Partial<Record<FormatId, string>> = {
	avif: "image/avif",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};

interface LocalPdfPage {
	getTextContent(): Promise<{
		items: Array<{ hasEOL?: boolean; str?: string }>;
	}>;
	getViewport(options: { scale: number }): {
		height: number;
		width: number;
	};
	render(options: {
		canvasContext: CanvasRenderingContext2D;
		viewport: { height: number; width: number };
	}): { promise: Promise<void> };
}

interface LocalPdfDocument {
	getPage(pageNumber: number): Promise<LocalPdfPage>;
	numPages: number;
}

interface LocalPdfModule {
	getDocument(options: {
		data: Uint8Array;
		disableWorker: boolean;
		isEvalSupported: boolean;
		verbosity: number;
		useWorkerFetch: boolean;
	}): { promise: Promise<LocalPdfDocument> };
}

export async function convertFile(
	file: File,
	target: FormatId,
	options: Partial<ConversionOptions> = {}
): Promise<ConversionResult> {
	const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
	const category = detectCategory(file.name, file.type);

	if (category === "images") {
		return convertImage(file, target, resolvedOptions);
	}
	if (category === "media") {
		return convertMedia(file, target, resolvedOptions);
	}
	return convertDocument(file, target);
}

export async function mergePdfFiles(files: File[]): Promise<ConversionResult> {
	if (files.length < 2) {
		throw new Error("Choose at least two PDF files to merge.");
	}
	const merged = await PDFDocument.create();
	for (const file of files) {
		if (fileExtension(file.name) !== "pdf") {
			throw new Error("PDF merge only accepts PDF files.");
		}
		const source = await PDFDocument.load(await file.arrayBuffer());
		const pages = await merged.copyPages(source, source.getPageIndices());
		for (const page of pages) {
			merged.addPage(page);
		}
	}
	return {
		blob: bytesToBlob(
			await merged.save({ useObjectStreams: true }),
			"application/pdf"
		),
		fileName: "combined.pdf",
		format: "pdf",
	};
}

async function convertImage(
	file: File,
	target: FormatId,
	options: ConversionOptions
): Promise<ConversionResult> {
	if (target === "pdf") {
		const bytes = await imageToPdf(file, options);
		return {
			blob: bytesToBlob(bytes, "application/pdf"),
			fileName: fileNameForTarget(file.name, target),
			format: target,
		};
	}

	const mimeType = IMAGE_MIME_TYPES[target];
	if (!mimeType) {
		throw new Error(`Image output ${target.toUpperCase()} is not available.`);
	}
	const blob = await renderImage(file, mimeType, options);
	return {
		blob,
		fileName: fileNameForTarget(file.name, target),
		format: target,
	};
}

async function renderImage(
	file: File,
	mimeType: string,
	options: ConversionOptions
): Promise<Blob> {
	const imageUrl = URL.createObjectURL(file);
	try {
		const image = await loadImage(imageUrl);
		const sourceWidth = image.naturalWidth || image.width;
		const sourceHeight = image.naturalHeight || image.height;
		if (!(sourceWidth && sourceHeight)) {
			throw new Error("The image has no readable dimensions.");
		}
		const crop = normalizeCrop(options.crop, sourceWidth, sourceHeight);
		const rotation = normalizeImageRotation(options.rotation);
		const rotatedWidth =
			rotation === 90 || rotation === 270 ? crop.height : crop.width;
		const rotatedHeight =
			rotation === 90 || rotation === 270 ? crop.width : crop.height;
		const width = options.maxWidth
			? Math.min(rotatedWidth, Math.max(1, options.maxWidth))
			: rotatedWidth;
		const scale = width / rotatedWidth;
		const height = Math.max(1, Math.round(rotatedHeight * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("The browser could not create an image canvas.");
		}
		if (mimeType === "image/jpeg") {
			context.fillStyle = "#ffffff";
			context.fillRect(0, 0, width, height);
		}
		context.save();
		context.translate(width / 2, height / 2);
		context.scale(scale, scale);
		context.rotate((rotation * Math.PI) / 180);
		context.drawImage(
			image,
			-crop.x - crop.width / 2,
			-crop.y - crop.height / 2
		);
		context.restore();
		if (options.watermark.trim()) {
			context.fillStyle = "rgba(15, 23, 42, 0.55)";
			context.font = `${Math.max(14, Math.round(width / 32))}px sans-serif`;
			context.textAlign = "right";
			context.textBaseline = "bottom";
			context.fillText(options.watermark.trim(), width - 18, height - 16);
		}
		return await canvasToBlob(canvas, mimeType, options.imageQuality);
	} finally {
		URL.revokeObjectURL(imageUrl);
	}
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.decoding = "async";
		image.addEventListener("load", () => resolve(image), { once: true });
		image.addEventListener(
			"error",
			() => reject(new Error("The browser could not read this image.")),
			{ once: true }
		);
		image.src = url;
	});
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: string,
	quality: number
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(
						new Error(
							`${mimeType.replace("image/", "").toUpperCase()} output is not supported by this browser.`
						)
					);
					return;
				}
				resolve(blob);
			},
			mimeType,
			Math.min(1, Math.max(0.1, quality))
		);
	});
}

async function imageToPdf(
	file: File,
	options: ConversionOptions
): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const extension = fileExtension(file.name);
	let image;
	if (extension === "jpg" || extension === "jpeg") {
		image = await pdf.embedJpg(await file.arrayBuffer());
	} else if (extension === "png") {
		image = await pdf.embedPng(await file.arrayBuffer());
	} else {
		const png = await renderImage(file, "image/png", options);
		image = await pdf.embedPng(await png.arrayBuffer());
	}

	const margin = 36;
	const maxWidth = 595 - margin * 2;
	const maxHeight = 842 - margin * 2;
	const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
	const width = image.width * scale;
	const height = image.height * scale;
	const page = pdf.addPage([width + margin * 2, height + margin * 2]);
	page.drawImage(image, {
		x: margin,
		y: margin,
		width,
		height,
	});
	return pdf.save({ useObjectStreams: true });
}

async function convertDocument(
	file: File,
	target: FormatId
): Promise<ConversionResult> {
	const extension = fileExtension(file.name);
	const sourceDefinition = FORMAT_DEFINITIONS.find(
		(format) => format.extension === extension
	);
	if (
		sourceDefinition?.inputOnly &&
		sourceDefinition.category === "documents"
	) {
		throw new Error(
			`${sourceDefinition.label} needs a local document engine; this browser-only path does not fake the conversion.`
		);
	}
	if (extension === "pdf") {
		if (target === "png" || target === "jpeg" || target === "webp") {
			return pdfToImages(file, target);
		}
		if (target === "txt" || target === "md") {
			return pdfToText(file, target);
		}
		const bytes = await file.arrayBuffer();
		return {
			blob: new Blob([bytes], { type: "application/pdf" }),
			fileName: fileNameForTarget(file.name, target),
			format: target,
		};
	}
	if (extension === "zip") {
		return zipToDocument(file, target);
	}
	if (target === "pdf") {
		const bytes = await documentToPdf(file);
		return {
			blob: bytesToBlob(bytes, "application/pdf"),
			fileName: fileNameForTarget(file.name, target),
			format: target,
		};
	}
	let raw = await readDocumentText(file, extension);
	const sourceIsHtml =
		extension === "html" || extension === "htm" || extension === "docx";
	const sourceIsMarkdown = extension === "md" || extension === "mdx";

	if (target === "json") {
		if (extension === "csv" || extension === "tsv") {
			raw = csvToJson(raw.replaceAll("\t", ","));
		} else if (extension === "yaml" || extension === "yml") {
			raw = JSON.stringify(parseYaml(raw), null, 2);
		} else if (tryParseJson(raw)) {
			raw = JSON.stringify(JSON.parse(raw), null, 2);
		} else {
			raw = JSON.stringify(
				{ text: sourceIsHtml ? htmlToText(raw) : raw },
				null,
				2
			);
		}
	} else if (target === "csv") {
		if (extension === "yaml" || extension === "yml") {
			raw = jsonToCsv(JSON.stringify(parseYaml(raw)));
		} else if (extension === "json") {
			raw = jsonToCsv(raw);
		} else if (extension !== "csv" && extension !== "tsv") {
			raw = `value\n${csvCell(sourceIsHtml ? htmlToText(raw) : raw)}`;
		}
	} else if (target === "yaml") {
		if (extension === "csv" || extension === "tsv") {
			raw = stringifyYaml(JSON.parse(csvToJson(raw.replaceAll("\t", ","))));
		} else if (extension === "json") {
			raw = stringifyYaml(JSON.parse(raw));
		} else if (extension === "yaml" || extension === "yml") {
			raw = stringifyYaml(parseYaml(raw));
		} else {
			raw = stringifyYaml({ text: sourceIsHtml ? htmlToText(raw) : raw });
		}
	} else if (target === "html") {
		const body = sourceIsHtml
			? raw
			: sourceIsMarkdown
				? markdownToHtml(raw)
				: `<pre>${escapeHtml(formatReadableText(raw, extension))}</pre>`;
		raw = htmlDocument(body, fileStem(file.name));
	} else if (target === "md") {
		raw = sourceIsHtml
			? htmlToMarkdown(raw)
			: formatReadableText(raw, extension);
	} else if (target === "txt") {
		raw = sourceIsHtml ? htmlToText(raw) : formatReadableText(raw, extension);
	}

	return {
		blob: new Blob([raw], { type: mimeTypeForTextTarget(target) }),
		fileName: fileNameForTarget(file.name, target),
		format: target,
	};
}

async function pdfToImages(
	file: File,
	target: "jpeg" | "png" | "webp"
): Promise<ConversionResult> {
	const document = await openLocalPdf(file);
	const mimeType = IMAGE_MIME_TYPES[target];
	if (!mimeType) {
		throw new Error(`PDF image output ${target.toUpperCase()} is unavailable.`);
	}
	const results: ConversionResult[] = [];
	for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
		const page = await document.getPage(pageNumber);
		const viewport = page.getViewport({ scale: 1.5 });
		const canvas = window.document.createElement("canvas");
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("The browser could not create a PDF rendering canvas.");
		}
		await page.render({ canvasContext: context, viewport }).promise;
		const blob = await canvasToBlob(canvas, mimeType, 0.92);
		const extension = target === "jpeg" ? "jpg" : target;
		results.push({
			blob,
			fileName: `${fileStem(file.name)}-page-${String(pageNumber).padStart(2, "0")}.${extension}`,
			format: target,
		});
	}
	return zipResults(results, `${fileStem(file.name)}-images.zip`);
}

async function pdfToText(
	file: File,
	target: "txt" | "md"
): Promise<ConversionResult> {
	const document = await openLocalPdf(file);
	const pages: string[] = [];
	for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
		const page = await document.getPage(pageNumber);
		const content = await page.getTextContent();
		const text = content.items
			.map((item) => item.str ?? "")
			.join(" ")
			.replace(/\s+/gu, " ")
			.trim();
		pages.push(text);
	}
	const body = pages.filter(Boolean).join("\n\n").trim();
	if (!body) {
		throw new Error(
			"This PDF has no selectable text; OCR requires a local OCR engine."
		);
	}
	const value =
		target === "md" ? `# ${fileStem(file.name)}\n\n${body}\n` : body;
	return {
		blob: new Blob([value], { type: mimeTypeForTextTarget(target) }),
		fileName: fileNameForTarget(file.name, target),
		format: target,
	};
}

async function openLocalPdf(file: File): Promise<LocalPdfDocument> {
	const module = (await import(
		"pdfjs-dist/legacy/build/pdf.mjs"
	)) as unknown as LocalPdfModule;
	return module.getDocument({
		data: new Uint8Array(await file.arrayBuffer()),
		disableWorker: true,
		isEvalSupported: false,
		verbosity: 0,
		useWorkerFetch: false,
	}).promise;
}

async function zipToDocument(
	file: File,
	target: FormatId
): Promise<ConversionResult> {
	if (
		!(
			target === "json" ||
			target === "txt" ||
			target === "md" ||
			target === "pdf"
		)
	) {
		throw new Error(
			"ZIP manifests can be exported as JSON, TXT, Markdown, or PDF."
		);
	}
	const module = (await import("jszip")) as unknown as {
		default: {
			loadAsync(data: ArrayBuffer): Promise<{
				files: Record<string, { dir: boolean; name: string }>;
			}>;
		};
	};
	const archive = await module.default.loadAsync(await file.arrayBuffer());
	const entries = Object.values(archive.files).map((entry) => ({
		directory: entry.dir,
		name: entry.name,
	}));
	if (entries.length === 0) {
		throw new Error("This ZIP archive contains no entries.");
	}
	const manifest = entries
		.map(({ directory, name }) => `${directory ? "[directory] " : ""}${name}`)
		.join("\n");
	const raw =
		target === "json"
			? JSON.stringify(entries, null, 2)
			: target === "md"
				? `# ${fileStem(file.name)}\n\n| Path | Kind |\n| --- | --- |\n${entries.map(({ directory, name }) => `| ${escapeMarkdownCell(name)} | ${directory ? "Directory" : "File"} |`).join("\n")}\n`
				: manifest;
	if (target === "pdf") {
		return {
			blob: bytesToBlob(
				await textToPdf(manifest, fileStem(file.name)),
				"application/pdf"
			),
			fileName: fileNameForTarget(file.name, target),
			format: target,
		};
	}
	return {
		blob: new Blob([raw], { type: mimeTypeForTextTarget(target) }),
		fileName: fileNameForTarget(file.name, target),
		format: target,
	};
}

function escapeMarkdownCell(value: string): string {
	return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

async function readDocumentText(
	file: File,
	extension: string
): Promise<string> {
	if (extension !== "docx") {
		return file.text();
	}
	const module = (await import("mammoth")) as unknown as {
		convertToHtml(input: {
			arrayBuffer: ArrayBuffer;
		}): Promise<{ value: string }>;
	};
	const result = await module.convertToHtml({
		arrayBuffer: await file.arrayBuffer(),
	});
	return result.value;
}

async function documentToPdf(file: File): Promise<Uint8Array> {
	const extension = fileExtension(file.name);
	const raw = await readDocumentText(file, extension);
	const readable =
		extension === "html" || extension === "htm" || extension === "docx"
			? htmlToText(raw)
			: formatReadableText(raw, extension);
	return textToPdf(readable, fileStem(file.name));
}

function tryParseJson(value: string): boolean {
	try {
		JSON.parse(value);
		return true;
	} catch {
		return false;
	}
}

function formatReadableText(value: string, extension: string): string {
	if (extension === "json") {
		try {
			return JSON.stringify(JSON.parse(value), null, 2);
		} catch {
			return value;
		}
	}
	if (extension === "html" || extension === "htm") {
		return htmlToText(value);
	}
	return value.replaceAll("\r\n", "\n").trim();
}

function htmlDocument(body: string, title: string): string {
	return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(title)}</title>\n<style>body{font-family:system-ui,sans-serif;max-width:70ch;margin:3rem auto;padding:0 1rem;line-height:1.6}pre{white-space:pre-wrap}code{background:#eee;padding:.1em .25em}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

function htmlToMarkdown(html: string): string {
	return html
		.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/giu, "# $1\n\n")
		.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/giu, "## $1\n\n")
		.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/giu, "### $1\n\n")
		.replace(/<li[^>]*>([\s\S]*?)<\/li>/giu, "- $1\n")
		.replace(/<br\s*\/?>(?=\S)/giu, "\n")
		.replace(/<\/(p|div)>/giu, "\n\n")
		.replace(/<[^>]+>/gu, "")
		.replace(/&nbsp;/gu, " ")
		.replace(/&amp;/gu, "&")
		.replace(/&lt;/gu, "<")
		.replace(/&gt;/gu, ">")
		.replace(/&quot;/gu, '"')
		.replace(/&#39;/gu, "'")
		.replace(/\n{3,}/gu, "\n\n")
		.trim();
}

function csvCell(value: string): string {
	return /[",\n\r]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function mimeTypeForTextTarget(target: FormatId): string {
	switch (target) {
		case "csv":
			return "text/csv;charset=utf-8";
		case "html":
			return "text/html;charset=utf-8";
		case "json":
			return "application/json;charset=utf-8";
		case "md":
			return "text/markdown;charset=utf-8";
		case "yaml":
			return "application/yaml;charset=utf-8";
		default:
			return "text/plain;charset=utf-8";
	}
}

async function textToPdf(text: string, title: string): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
	const margin = 48;
	const pageWidth = 595;
	const pageHeight = 842;
	const fontSize = 10;
	const lineHeight = 15;
	const contentWidth = pageWidth - margin * 2;
	let page = pdf.addPage([pageWidth, pageHeight]);
	let y = pageHeight - margin;

	page.drawText(pdfSafeText(title), {
		x: margin,
		y,
		font: boldFont,
		size: 16,
		color: rgb(0.08, 0.1, 0.12),
	});
	y -= 30;

	for (const paragraph of text.replaceAll("\r\n", "\n").split("\n")) {
		const lines = wrapPdfLine(
			pdfSafeText(paragraph),
			font,
			fontSize,
			contentWidth
		);
		for (const line of lines) {
			if (y < margin + lineHeight) {
				page = pdf.addPage([pageWidth, pageHeight]);
				y = pageHeight - margin;
			}
			page.drawText(line, {
				x: margin,
				y,
				font,
				size: fontSize,
				color: rgb(0.12, 0.14, 0.16),
			});
			y -= lineHeight;
		}
		y -= lineHeight * 0.35;
	}
	return pdf.save({ useObjectStreams: true });
}

function pdfSafeText(value: string): string {
	return Array.from(value, (character) => {
		const codePoint = character.codePointAt(0) ?? 63;
		return codePoint <= 255 ? character : "?";
	}).join("");
}

function wrapPdfLine(
	line: string,
	font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
	size: number,
	maxWidth: number
): string[] {
	if (!line) {
		return [""];
	}
	const words = line.split(/\s+/u);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) {
		lines.push(current);
	}
	return lines;
}

async function convertMedia(
	file: File,
	target: FormatId,
	options: ConversionOptions
): Promise<ConversionResult> {
	if (!MEDIA_OUTPUT_FORMATS.has(target)) {
		throw new Error(
			`${target.toUpperCase()} is an input-only media format in this browser.`
		);
	}
	let blob: Blob;
	try {
		blob = await mediaToMediabunny(file, target, options.onProgress);
	} catch (error: unknown) {
		if (target !== "webm") {
			throw error;
		}
		blob = await mediaToWebmWithMediaRecorder(file);
	}
	return {
		blob,
		fileName: fileNameForTarget(file.name, target),
		format: target,
	};
}

const MEDIA_OUTPUT_FORMATS = new Set<FormatId>([
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
]);

async function mediaToMediabunny(
	file: File,
	target: FormatId,
	onProgress?: (progress: number) => void
): Promise<Blob> {
	const mediabunny = await import("mediabunny");
	const input = new mediabunny.Input({
		formats: mediabunny.ALL_FORMATS,
		source: new mediabunny.BlobSource(file),
	});
	try {
		const bufferTarget = new mediabunny.BufferTarget();
		const output = new mediabunny.Output({
			format: mediaOutputFormat(mediabunny, target),
			target: bufferTarget,
		});
		const conversion = await mediabunny.Conversion.init({
			input,
			output,
			showWarnings: false,
			...(isAudioOnlyMediaTarget(target) ? { video: { discard: true } } : {}),
		});
		conversion.onProgress = onProgress;
		if (!conversion.isValid) {
			throw new Error(
				`Mediabunny cannot encode ${target.toUpperCase()} from this local codec.`
			);
		}
		await conversion.execute();
		if (!bufferTarget.buffer) {
			throw new Error("The local media engine produced no output.");
		}
		return new Blob([bufferTarget.buffer], { type: mediaMimeType(target) });
	} finally {
		input.dispose();
	}
}

function mediaOutputFormat(
	mediabunny: typeof import("mediabunny"),
	target: FormatId
): OutputFormat {
	switch (target) {
		case "webm":
			return new mediabunny.WebMOutputFormat();
		case "mp4":
		case "m4a":
			return new mediabunny.Mp4OutputFormat();
		case "mov":
			return new mediabunny.MovOutputFormat();
		case "mkv":
			return new mediabunny.MkvOutputFormat();
		case "ts":
			return new mediabunny.MpegTsOutputFormat();
		case "mp3":
			return new mediabunny.Mp3OutputFormat();
		case "wav":
			return new mediabunny.WavOutputFormat();
		case "ogg":
			return new mediabunny.OggOutputFormat();
		case "flac":
			return new mediabunny.FlacOutputFormat();
		case "aac":
			return new mediabunny.AdtsOutputFormat();
		default:
			throw new Error(
				`${target.toUpperCase()} is not a supported local media output.`
			);
	}
}

function isAudioOnlyMediaTarget(target: FormatId): boolean {
	return ["aac", "flac", "m4a", "mp3", "ogg", "wav"].includes(target);
}

function mediaMimeType(target: FormatId): string {
	switch (target) {
		case "aac":
			return "audio/aac";
		case "flac":
			return "audio/flac";
		case "m4a":
			return "audio/mp4";
		case "mp3":
			return "audio/mpeg";
		case "ogg":
			return "audio/ogg";
		case "wav":
			return "audio/wav";
		case "mkv":
			return "video/x-matroska";
		case "mov":
			return "video/quicktime";
		case "mp4":
			return "video/mp4";
		case "ts":
			return "video/mp2t";
		case "webm":
			return "video/webm";
		default:
			return "application/octet-stream";
	}
}

async function mediaToWebmWithMediaRecorder(file: File): Promise<Blob> {
	if (typeof MediaRecorder === "undefined") {
		throw new Error("MediaRecorder is unavailable in this browser.");
	}
	const isVideo = file.type.startsWith("video/");
	const element = document.createElement(isVideo ? "video" : "audio");
	const media = element as HTMLMediaElement & {
		captureStream?: () => MediaStream;
		mozCaptureStream?: () => MediaStream;
	};
	const sourceUrl = URL.createObjectURL(file);
	media.src = sourceUrl;
	media.preload = "auto";
	if (isVideo) {
		media.muted = true;
		(media as HTMLVideoElement).playsInline = true;
	}
	try {
		await waitForMediaReady(media);
		const stream = media.captureStream?.() ?? media.mozCaptureStream?.();
		if (!stream) {
			throw new Error("This browser cannot capture a local media stream.");
		}
		const mimeType = [
			isVideo ? "video/webm;codecs=vp9,opus" : "audio/webm;codecs=opus",
			"video/webm",
			"audio/webm",
		].find((candidate) => MediaRecorder.isTypeSupported(candidate));
		if (!mimeType) {
			throw new Error("This browser cannot encode WebM locally.");
		}

		return await new Promise<Blob>((resolve, reject) => {
			const chunks: Blob[] = [];
			const recorder = new MediaRecorder(stream, { mimeType });
			const finish = () => {
				if (recorder.state !== "inactive") {
					recorder.stop();
				}
			};
			recorder.addEventListener("dataavailable", (event) => {
				if (event.data.size > 0) {
					chunks.push(event.data);
				}
			});
			recorder.addEventListener(
				"stop",
				() =>
					resolve(new Blob(chunks, { type: recorder.mimeType || mimeType })),
				{ once: true }
			);
			recorder.addEventListener(
				"error",
				() =>
					reject(new Error("The browser could not encode this media locally.")),
				{ once: true }
			);
			media.addEventListener("ended", finish, { once: true });
			recorder.start(250);
			void media.play().catch(() => {
				recorder.stop();
				reject(new Error("The browser blocked local media playback."));
			});
		});
	} finally {
		media.pause();
		media.src = "";
		URL.revokeObjectURL(sourceUrl);
	}
}

function bytesToBlob(bytes: Uint8Array, mimeType: string): Blob {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return new Blob([copy.buffer], { type: mimeType });
}

function waitForMediaReady(media: HTMLMediaElement): Promise<void> {
	if (media.readyState >= 2) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		const onReady = () => {
			cleanup();
			resolve();
		};
		const onError = () => {
			cleanup();
			reject(new Error("The browser could not decode this local media file."));
		};
		const cleanup = () => {
			media.removeEventListener("canplay", onReady);
			media.removeEventListener("error", onError);
		};
		media.addEventListener("canplay", onReady, { once: true });
		media.addEventListener("error", onError, { once: true });
		media.load();
	});
}

function normalizeCrop(
	crop: ImageCrop | null,
	width: number,
	height: number
): ImageCrop {
	if (!crop) {
		return { height, width, x: 0, y: 0 };
	}
	const x = Math.min(Math.max(0, crop.x), width - 1);
	const y = Math.min(Math.max(0, crop.y), height - 1);
	return {
		height: Math.min(Math.max(1, crop.height), height - y),
		width: Math.min(Math.max(1, crop.width), width - x),
		x,
		y,
	};
}

function normalizeImageRotation(value: number): number {
	const normalized = ((value % 360) + 360) % 360;
	if (
		normalized === 0 ||
		normalized === 90 ||
		normalized === 180 ||
		normalized === 270
	) {
		return normalized;
	}
	throw new Error("Image rotation must be 0, 90, 180, or 270 degrees.");
}
