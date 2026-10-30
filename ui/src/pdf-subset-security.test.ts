import { expect, test } from "bun:test";
import {
	decodePDFRawStream,
	drawObject,
	PDFDict,
	PDFDocument,
	PDFName,
	PDFRawStream,
	StandardFonts,
} from "pdf-lib";
import { copySubsetPage } from "./pdf-subset.ts";

test("subset excludes an unused shared Form XObject rendered only on an excluded page", async () => {
	const source = await PDFDocument.create();
	const font = await source.embedFont(StandardFonts.Helvetica);
	const selected = source.addPage();
	const excluded = source.addPage();
	selected.drawText("SELECTED_PUBLIC_PAGE", { font });
	const secretForm = source.context.register(
		source.context.flateStream("BT /F1 12 Tf (EXCLUDED_FORM_SECRET) Tj ET", {
			Type: "XObject",
			Subtype: "Form",
			BBox: [0, 0, 200, 100],
			Resources: { Font: { F1: font.ref } },
		})
	);
	const resources = selected.node.lookup(PDFName.of("Resources"), PDFDict);
	resources.set(
		PDFName.of("XObject"),
		source.context.obj({ Secret: secretForm })
	);
	excluded.node.set(PDFName.of("Resources"), resources);
	excluded.pushOperators(drawObject("Secret"));
	const output = await PDFDocument.create();
	output.addPage(copySubsetPage(source, output, 0));
	const saved = await PDFDocument.load(await output.save());
	const streams = saved.context
		.enumerateIndirectObjects()
		.filter(
			(entry): entry is [(typeof entry)[0], PDFRawStream] =>
				entry[1] instanceof PDFRawStream
		)
		.map(([, stream]) =>
			new TextDecoder().decode(decodePDFRawStream(stream).decode())
		)
		.join("\n");
	expect(saved.getPageCount()).toBe(1);
	expect(streams).toContain(
		Buffer.from("SELECTED_PUBLIC_PAGE").toString("hex").toUpperCase()
	);
	expect(streams).not.toContain("EXCLUDED_FORM_SECRET");
});

test("subset retains used nested Form XObjects and removes their unused siblings", async () => {
	const source = await PDFDocument.create();
	const page = source.addPage();
	const font = await source.embedFont(StandardFonts.Helvetica);
	const used = source.context.register(
		source.context.flateStream("BT /F1 12 Tf (VISIBLE_FORM) Tj ET", {
			Type: "XObject",
			Subtype: "Form",
			BBox: [0, 0, 200, 100],
			Resources: { Font: { F1: font.ref } },
		})
	);
	const unused = source.context.register(
		source.context.flateStream("PRIVATE_UNUSED_FORM", {
			Type: "XObject",
			Subtype: "Form",
			BBox: [0, 0, 200, 100],
		})
	);
	const outer = source.context.register(
		source.context.flateStream("/Used Do", {
			Type: "XObject",
			Subtype: "Form",
			BBox: [0, 0, 200, 100],
			Resources: { XObject: { Used: used, Private: unused } },
		})
	);
	page.node
		.Resources()!
		.set(
			PDFName.of("XObject"),
			source.context.obj({ Outer: outer, Private: unused })
		);
	page.pushOperators(drawObject("Outer"));
	const output = await PDFDocument.create();
	output.addPage(copySubsetPage(source, output, 0));
	const saved = await PDFDocument.load(await output.save());
	const text = saved.context
		.enumerateIndirectObjects()
		.filter(
			(entry): entry is [(typeof entry)[0], PDFRawStream] =>
				entry[1] instanceof PDFRawStream
		)
		.map(([, stream]) =>
			new TextDecoder().decode(decodePDFRawStream(stream).decode())
		)
		.join("\n");
	expect(text).toContain("VISIBLE_FORM");
	expect(text).not.toContain("PRIVATE_UNUSED_FORM");
});
