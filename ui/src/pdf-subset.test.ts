import { expect, test } from "bun:test";
import JSZip from "jszip";
import {
	decodePDFRawStream,
	PDFArray,
	PDFDict,
	PDFDocument,
	PDFName,
	PDFRawStream,
	StandardFonts,
} from "pdf-lib";
import { runPdfTool } from "./tools.ts";

test("extract and split exclude indirectly referenced page content", async () => {
	const source = await PDFDocument.create();
	const font = await source.embedFont(StandardFonts.Helvetica);
	const first = source.addPage();
	const second = source.addPage();
	first.drawText("SELECTED_PUBLIC_PAGE", { font });
	second.drawText("EXCLUDED_PRIVATE_PAGE", { font });
	const link = source.context.obj({
		Type: "Annot",
		Subtype: "Link",
		Rect: [0, 0, 100, 100],
		Dest: [second.ref, "Fit"],
	});
	first.node.set(
		PDFName.of("Annots"),
		source.context.obj([source.context.register(link)])
	);
	// Form/structure dictionaries and arbitrary content references also cross page boundaries.
	first.node.set(
		PDFName.of("CustomReference"),
		second.node.get(PDFName.of("Contents"))!
	);
	const excludedWidget = source.context.register(
		source.context.obj({
			Type: "Annot",
			Subtype: "Widget",
			P: second.ref,
			V: "EXCLUDED_FORM_VALUE",
		})
	);
	second.node.set(PDFName.of("Annots"), source.context.obj([excludedWidget]));
	const selectedWidget = source.context.obj({
		Type: "Annot",
		Subtype: "Widget",
		P: first.ref,
		V: "SELECTED_FORM_VALUE",
	});
	const parent = source.context.register(
		source.context.obj({ Kids: [excludedWidget, selectedWidget] })
	);
	selectedWidget.set(PDFName.of("Parent"), parent);
	first.node.set(PDFName.of("FormReference"), selectedWidget);
	const file = new File(
		[new Uint8Array(await source.save()).buffer],
		"report.pdf",
		{ type: "application/pdf" }
	);
	for (const tool of ["extract", "split"] as const) {
		const result = await runPdfTool(file, tool, { pages: "1" });
		const archive = await JSZip.loadAsync(await result.blob.arrayBuffer());
		const output = await PDFDocument.load(
			await archive.file("report-01.pdf")!.async("uint8array")
		);
		expect(output.getPageCount()).toBe(1);
		const text = output.context
			.enumerateIndirectObjects()
			.filter(
				(entry): entry is [(typeof entry)[0], PDFRawStream] =>
					entry[1] instanceof PDFRawStream
			)
			.map(([, stream]) =>
				new TextDecoder().decode(decodePDFRawStream(stream).decode())
			)
			.join("\n");
		expect(text).toContain(
			Buffer.from("SELECTED_PUBLIC_PAGE").toString("hex").toUpperCase()
		);
		expect(text).not.toContain(
			Buffer.from("EXCLUDED_PRIVATE_PAGE").toString("hex").toUpperCase()
		);
		const allObjects = output.context
			.enumerateIndirectObjects()
			.map(([, object]) => object.toString())
			.join("\n");
		expect(allObjects).not.toContain("EXCLUDED_FORM_VALUE");
		expect(allObjects).toContain("SELECTED_FORM_VALUE");
	}
	expect(source.getPageCount()).toBe(2);
	expect(first.node.lookup(PDFName.of("Annots"), PDFArray).size()).toBe(1);
});

test("subset preserves selected self-links, URI links, and rendering resources", async () => {
	const source = await PDFDocument.create();
	const page = source.addPage();
	page.drawText("VISIBLE", {
		font: await source.embedFont(StandardFonts.Helvetica),
	});
	const self = source.context.obj({
		Type: "Annot",
		Subtype: "Link",
		Rect: [0, 0, 20, 20],
		Dest: [page.ref, "Fit"],
	});
	const external = source.context.obj({
		Type: "Annot",
		Subtype: "Link",
		Rect: [20, 0, 40, 20],
		A: { S: "URI", URI: "https://example.com" },
	});
	page.node.set(
		PDFName.of("Annots"),
		source.context.obj([
			source.context.register(self),
			source.context.register(external),
		])
	);
	const file = new File(
		[new Uint8Array(await source.save()).buffer],
		"links.pdf"
	);
	const result = await runPdfTool(file, "extract", { pages: "1" });
	const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
	const output = await PDFDocument.load(
		await zip.file("links-01.pdf")!.async("uint8array")
	);
	expect(
		output.getPage(0).node.lookup(PDFName.of("Annots"), PDFArray).size()
	).toBe(2);
	const copiedLink = output
		.getPage(0)
		.node.lookup(PDFName.of("Annots"), PDFArray)
		.lookup(0, PDFDict);
	expect(copiedLink.lookup(PDFName.of("Dest"), PDFArray).get(0)).toBe(
		output.getPage(0).ref
	);
	expect(output.getPage(0).node.Resources()).toBeDefined();
});
