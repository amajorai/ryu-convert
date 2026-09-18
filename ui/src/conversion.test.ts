import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { convertFile, mergePdfFiles } from "./conversion";
import {
	csvToJson,
	detectCategory,
	fileNameForTarget,
	formatFileSize,
	jsonToCsv,
	markdownToHtml,
	parseCsv,
	targetsForFile,
} from "./model";
import { runPdfTool, zipResults } from "./tools";

function fileFromBytes(bytes: Uint8Array, name: string): File {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return new File([copy.buffer], name, { type: "application/pdf" });
}

function pcmWavFile(): File {
	const sampleRate = 8000;
	const sampleCount = 800;
	const buffer = new ArrayBuffer(44 + sampleCount * 2);
	const view = new DataView(buffer);
	const writeAscii = (offset: number, value: string) => {
		for (let index = 0; index < value.length; index += 1) {
			view.setUint8(offset + index, value.charCodeAt(index));
		}
	};
	writeAscii(0, "RIFF");
	view.setUint32(4, 36 + sampleCount * 2, true);
	writeAscii(8, "WAVE");
	writeAscii(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeAscii(36, "data");
	view.setUint32(40, sampleCount * 2, true);
	return new File([buffer], "tone.wav", { type: "audio/wav" });
}

describe("Convert format model", () => {
	test("detects categories from both MIME type and extension", () => {
		expect(detectCategory("photo.jpeg", "")).toBe("images");
		expect(detectCategory("report.bin", "application/pdf")).toBe("documents");
		expect(detectCategory("rows.csv", "text/csv")).toBe("data");
		expect(detectCategory("recording.mkv", "")).toBe("media");
	});

	test("parses quoted CSV cells and maps rows to JSON", () => {
		const csv = 'name,note\nAda,"likes, commas"\n';
		expect(parseCsv(csv)).toEqual([
			["name", "note"],
			["Ada", "likes, commas"],
		]);
		expect(JSON.parse(csvToJson(csv))).toEqual([
			{ name: "Ada", note: "likes, commas" },
		]);
	});

	test("creates a stable CSV header union from JSON records", () => {
		expect(jsonToCsv('[{"name":"Ada","role":"Builder"},{"name":"Lin"}]')).toBe(
			"name,role\nAda,Builder\nLin,"
		);
	});

	test("renders Markdown without injecting source HTML", () => {
		expect(markdownToHtml("# Local\n\n- private\n- fast")).toContain(
			"<h1>Local</h1>"
		);
		expect(markdownToHtml("<script>alert(1)</script>")).not.toContain(
			"<script>"
		);
	});

	test("exposes practical target sets and safe output names", () => {
		expect(targetsForFile("portrait.png").map((format) => format.id)).toEqual([
			"png",
			"jpeg",
			"webp",
			"avif",
			"pdf",
		]);
		expect(targetsForFile("notes.md").map((format) => format.id)).toContain(
			"pdf"
		);
		expect(targetsForFile("report.pdf").map((format) => format.id)).toEqual([
			"png",
			"jpeg",
			"webp",
			"txt",
			"md",
			"pdf",
		]);
		expect(targetsForFile("clip.mkv").map((format) => format.id)).toEqual([
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
		expect(targetsForFile("bundle.zip").map((format) => format.id)).toEqual([
			"json",
			"txt",
			"md",
			"pdf",
		]);
		expect(fileNameForTarget("report.final.json", "csv")).toBe(
			"report.final.csv"
		);
		expect(formatFileSize(1536)).toBe("1.5 KB");
	});

	test("converts structured text and creates a readable local PDF", async () => {
		const source = new File(
			['[{"name":"Ada","role":"Builder"}]'],
			"people.json",
			{
				type: "application/json",
			}
		);
		const csv = await convertFile(source, "csv");
		expect(await csv.blob.text()).toBe("name,role\nAda,Builder");

		const notes = new File(["Local-first notes ↔ private"], "notes.txt", {
			type: "text/plain",
		});
		const pdf = await convertFile(notes, "pdf");
		const loaded = await PDFDocument.load(await pdf.blob.arrayBuffer());
		expect(loaded.getPageCount()).toBe(1);
	});

	test("extracts selectable PDF text and rejects OCR-shaped gaps honestly", async () => {
		const document = await PDFDocument.create();
		document.addPage().drawText("Local PDF text");
		const extracted = await convertFile(
			fileFromBytes(await document.save(), "notes.pdf"),
			"txt"
		);
		expect(await extracted.blob.text()).toContain("Local PDF text");

		const blank = await PDFDocument.create();
		blank.addPage();
		await expect(
			convertFile(fileFromBytes(await blank.save(), "scan.pdf"), "md")
		).rejects.toThrow("OCR requires a local OCR engine");
	});

	test("inspects ZIP manifests locally instead of decoding archive bytes as text", async () => {
		const archive = await zipResults(
			[
				{
					blob: new Blob(["private"], { type: "text/plain" }),
					fileName: "notes.txt",
					format: "txt",
				},
			],
			"bundle.zip"
		);
		const archiveFile = new File([archive.blob], "bundle.zip", {
			type: "application/zip",
		});
		const manifest = await convertFile(archiveFile, "json");
		expect(await manifest.blob.text()).toContain('"name": "notes.txt"');
	});

	test("converts local audio through the Mediabunny adapter", async () => {
		const result = await convertFile(pcmWavFile(), "wav");
		expect(result.fileName).toBe("tone.wav");
		expect(result.blob.type).toBe("audio/wav");
		expect(result.blob.size).toBeGreaterThan(44);
	});

	test("merges multiple local PDFs without a service", async () => {
		const first = await PDFDocument.create();
		first.addPage();
		const second = await PDFDocument.create();
		second.addPage();
		const merged = await mergePdfFiles([
			fileFromBytes(await first.save(), "one.pdf"),
			fileFromBytes(await second.save(), "two.pdf"),
		]);
		const loaded = await PDFDocument.load(await merged.blob.arrayBuffer());
		expect(merged.fileName).toBe("combined.pdf");
		expect(loaded.getPageCount()).toBe(2);
	});

	test("runs local PDF toolbox operations", async () => {
		const document = await PDFDocument.create();
		document.addPage();
		document.addPage();
		const source = fileFromBytes(await document.save(), "toolbox.pdf");
		const numbered = await runPdfTool(source, "page-numbers");
		const numberedPdf = await PDFDocument.load(
			await numbered.blob.arrayBuffer()
		);
		expect(numberedPdf.getPageCount()).toBe(2);

		const extracted = await runPdfTool(source, "extract", { pages: "2" });
		expect(extracted.format).toBe("zip");
		expect(extracted.fileName).toBe("toolbox-pages.zip");
	});
});
