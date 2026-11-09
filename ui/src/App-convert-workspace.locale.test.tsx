import { expect, test } from "bun:test";
import { I18nProvider } from "@ryu/i18n/react";
import { renderToStaticMarkup } from "react-dom/server";
import { QualityPercent } from "./App-convert-workspace.tsx";

// The image-quality readout beside the slider prints the reader's percent
// format instead of a hand-built "80%".
function readout(locale: string, value: number): string {
	return renderToStaticMarkup(
		<I18nProvider initialLocale={locale} initialPackId={null}>
			<QualityPercent value={value} />
		</I18nProvider>
	).replace(/<[^>]+>/g, "");
}

test("keeps the English form in English", () => {
	expect(readout("en", 0.8)).toBe("80%");
	expect(readout("en", 0.825)).toBe("83%");
});

test("uses the German spacing under de", () => {
	expect(readout("de", 0.8)).toBe("80 %");
});

test("uses Arabic-Indic digits under ar-EG", () => {
	expect(readout("ar-EG", 0.8)).toBe(
		new Intl.NumberFormat("ar-EG", { style: "percent" }).format(0.8)
	);
	expect(readout("ar-EG", 0.8)).toContain("٨٠");
});
