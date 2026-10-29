import { expect, test } from "bun:test";
import { PDFName } from "pdf-lib";
import { usedPdfXObjects } from "./pdf-resource-usage.ts";

test("resource usage ignores fake operators in strings comments and containers", () => {
	const usage = usedPdfXObjects(
		new TextEncoder().encode(
			"(/Private Do \\(nested\\)) Tj % /Private Do\n <2F5072697661746520446F> Tj [/Private Do] << /Private Do >> /Used Do /Escaped#20Name Do"
		)
	);
	expect(usage.has(PDFName.of("Private"))).toBe(false);
	expect(usage.has(PDFName.of("Used"))).toBe(true);
	expect(usage.has(PDFName.of("Escaped Name"))).toBe(true);
});

test("ambiguous inline image data refuses resource-separated output", () => {
	expect(() =>
		usedPdfXObjects(
			new TextEncoder().encode("BI /W 1 /H 1 ID binary EI /Private Do")
		)
	).toThrow("inline images");
});
