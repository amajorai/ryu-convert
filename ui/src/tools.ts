import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
	type ConversionResult,
	fileExtension,
	fileNameForTarget,
	fileStem,
} from "./model";

export type PdfTool =
	| "compress"
	| "extract"
	| "page-numbers"
	| "rotate"
	| "split"
	| "watermark";

export interface PdfToolOptions {
	degrees?: number;
	pages?: string;
	watermark?: string;
}

export async function runPdfTool(
	file: File,
	tool: PdfTool,
	options: PdfToolOptions = {}
): Promise<ConversionResult> {
	if (fileExtension(file.name) !== "pdf") {
		throw new Error("This PDF tool only accepts a PDF file.");
	}
	const source = await PDFDocument.load(await file.arrayBuffer());
	if (tool === "split" || tool === "extract") {
		const pageIndexes =
			tool === "split"
				? source.getPageIndices()
				: parsePageSelection(options.pages ?? "", source.getPageCount());
		const results: ConversionResult[] = [];
		for (const [outputIndex, pageIndex] of pageIndexes.entries()) {
			const document = await PDFDocument.create();
			const [page] = await document.copyPages(source, [pageIndex]);
			document.addPage(page);
			results.push({
				blob: bytesToBlob(
					await document.save({ useObjectStreams: true }),
					"application/pdf"
				),
				fileName: `${fileStem(file.name)}-${String(outputIndex + 1).padStart(2, "0")}.pdf`,
				format: "pdf",
			});
		}
		return zipResults(
			results,
			`${fileStem(file.name)}-${tool === "split" ? "split" : "pages"}.zip`
		);
	}

	const font = await source.embedFont(StandardFonts.Helvetica);
	const pages = source.getPages();
	if (tool === "rotate") {
		const angle = normalizeRotation(options.degrees ?? 90);
		for (const page of pages) {
			page.setRotation(degrees(angle));
		}
	}
	if (tool === "watermark") {
		const watermark = pdfSafeText(options.watermark?.trim() || "Convert");
		for (const page of pages) {
			const { height, width } = page.getSize();
			page.drawText(watermark, {
				color: rgb(0.25, 0.3, 0.38),
				font,
				opacity: 0.28,
				rotate: degrees(-35),
				size: Math.max(18, Math.min(42, width / 14)),
				x: width * 0.2,
				y: height * 0.45,
			});
		}
	}
	if (tool === "page-numbers") {
		for (const [index, page] of pages.entries()) {
			const { width } = page.getSize();
			page.drawText(`${index + 1} / ${pages.length}`, {
				color: rgb(0.24, 0.27, 0.31),
				font,
				size: 9,
				x: width - 62,
				y: 22,
			});
		}
	}
	return {
		blob: bytesToBlob(
			await source.save({ useObjectStreams: true }),
			"application/pdf"
		),
		fileName: fileNameForTarget(`${fileStem(file.name)}-${tool}`, "pdf"),
		format: "pdf",
	};
}

export async function zipResults(
	results: ConversionResult[],
	fileName: string
): Promise<ConversionResult> {
	if (results.length === 0) {
		throw new Error("There are no completed files to archive.");
	}
	const module = (await import("jszip")) as unknown as {
		default: new () => {
			file(name: string, data: ArrayBuffer): void;
			generateAsync(options: { type: "blob" }): Promise<Blob>;
		};
	};
	const archive = new module.default();
	for (const result of results) {
		archive.file(result.fileName, await result.blob.arrayBuffer());
	}
	return {
		blob: await archive.generateAsync({ type: "blob" }),
		fileName,
		format: "zip",
	};
}

function parsePageSelection(value: string, pageCount: number): number[] {
	if (!value.trim()) {
		throw new Error("Enter pages such as 1, 3-5 to extract.");
	}
	const pageIndexes = new Set<number>();
	for (const token of value.split(",")) {
		const trimmed = token.trim();
		const range = /^(\d+)\s*-\s*(\d+)$/u.exec(trimmed);
		if (range) {
			const start = Number(range[1]);
			const end = Number(range[2]);
			if (start < 1 || end < start || end > pageCount) {
				throw new Error(`Page range ${trimmed} is outside this PDF.`);
			}
			for (let page = start; page <= end; page += 1) {
				pageIndexes.add(page - 1);
			}
			continue;
		}
		const page = Number(trimmed);
		if (!Number.isInteger(page) || page < 1 || page > pageCount) {
			throw new Error(`Page ${trimmed} is outside this PDF.`);
		}
		pageIndexes.add(page - 1);
	}
	return [...pageIndexes].sort((left, right) => left - right);
}

function normalizeRotation(value: number): number {
	const normalized = ((value % 360) + 360) % 360;
	if (
		normalized === 0 ||
		normalized === 90 ||
		normalized === 180 ||
		normalized === 270
	) {
		return normalized;
	}
	throw new Error("Rotation must be 0, 90, 180, or 270 degrees.");
}

function pdfSafeText(value: string): string {
	return Array.from(value, (character) => {
		const codePoint = character.codePointAt(0) ?? 63;
		return codePoint <= 255 ? character : "?";
	}).join("");
}

function bytesToBlob(bytes: Uint8Array, mimeType: string): Blob {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return new Blob([copy.buffer], { type: mimeType });
}
