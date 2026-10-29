import { describe, expect, test } from "bun:test";
import { formatLabel, jsonToCsv } from "./model.ts";
import {
	convertedJsonSchema,
	historyRowsSchema,
	type ImageToolOutput,
	imageFormatSchema,
	imageToolOutputSchema,
	jsonObjectSchema,
	sliderQualitySchema,
} from "./schemas.ts";

describe("Convert local persisted/file boundaries", () => {
	test("retains history row metadata, identity and future format fallback", () => {
		const row = {
			completedAt: "legacy timestamp",
			id: "conversion",
			name: "result",
			size: 12,
			source: "file",
			target: "future-format",
			metadata: { tool: "legacy" },
		};
		const parsed = historyRowsSchema
			.parse([null, row, {}, row])
			.filter((item) => item !== null);
		expect(parsed).toHaveLength(2);
		expect(Object.is(parsed[0], row)).toBe(true);
		expect(formatLabel(parsed[0]!.target)).toBe(formatLabel("png"));
	});
	test("retains native JSON prototype-named keys and overflow numbers in CSV", () => {
		const value = JSON.parse(
			'{"__proto__":{"metadata":"retained"},"number":1e400}'
		);
		expect(Object.is(convertedJsonSchema.parse(value), value)).toBe(true);
		expect(Object.is(jsonObjectSchema.parse(value), value)).toBe(true);
		expect(jsonToCsv('{"__proto__":"named key","number":1e400}')).toBe(
			"__proto__,number\nnamed key,Infinity"
		);
		const invalid = Object.fromEntries([["__proto__", () => {}]]);
		expect(convertedJsonSchema.safeParse(invalid).success).toBe(false);
	});
	test("keeps PDF in tool outputs while limiting raster MIME choices to images", () => {
		const formats = [
			"avif",
			"jpeg",
			"png",
			"webp",
			"pdf",
		] satisfies ImageToolOutput[];
		for (const format of formats) {
			expect(imageToolOutputSchema.parse(format)).toBe(format);
		}
		expect(imageFormatSchema.safeParse("pdf").success).toBe(false);
	});
	test("accepts both genuine scalar and array slider values and ignores missing values", () => {
		expect(sliderQualitySchema.parse(0.92)).toBe(0.92);
		expect(sliderQualitySchema.parse([0.92])).toBe(0.92);
		expect(sliderQualitySchema.parse([])).toBeUndefined();
		expect(sliderQualitySchema.parse(undefined)).toBeUndefined();
	});
});
