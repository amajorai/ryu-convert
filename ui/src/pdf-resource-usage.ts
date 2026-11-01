import { PDFName } from "pdf-lib";

/** Read XObject invocations without treating strings, comments, or dictionaries as code. */
export function usedPdfXObjects(bytes: Uint8Array): Set<PDFName> {
	const names = new Set<PDFName>();
	const chunks: string[] = [];
	for (let offset = 0; offset < bytes.length; offset += 16_384) {
		chunks.push(
			String.fromCharCode(...bytes.subarray(offset, offset + 16_384))
		);
	}
	const text = chunks.join("");
	const whitespace = (value: string) =>
		[0, 9, 10, 12, 13, 32].includes(value.charCodeAt(0));
	const delimiter = (value: string) =>
		whitespace(value) || "()<>[]{}/%".includes(value);
	let cursor = 0;
	let depth = 0;
	let previousName: PDFName | undefined;
	while (cursor < text.length) {
		const character = text[cursor] ?? "";
		if (whitespace(character)) {
			cursor += 1;
			continue;
		}
		if (character === "%") {
			while (cursor < text.length && !/[\r\n]/.test(text[cursor] ?? "")) {
				cursor += 1;
			}
			continue;
		}
		if (character === "(") {
			let parentheses = 1;
			cursor += 1;
			while (cursor < text.length && parentheses > 0) {
				const next = text[cursor];
				cursor += 1;
				if (next === "\\") {
					cursor += 1;
				} else if (next === "(") {
					parentheses += 1;
				} else if (next === ")") {
					parentheses -= 1;
				}
			}
			if (parentheses !== 0) {
				throw new Error("This PDF has an incomplete content string.");
			}
			previousName = undefined;
			continue;
		}
		if (character === "<" && text[cursor + 1] !== "<") {
			const ending = text.indexOf(">", cursor + 1);
			if (ending < 0) {
				throw new Error("This PDF has an incomplete hexadecimal string.");
			}
			cursor = ending + 1;
			previousName = undefined;
			continue;
		}
		if (character === "[" || (character === "<" && text[cursor + 1] === "<")) {
			depth += 1;
			cursor += character === "[" ? 1 : 2;
			previousName = undefined;
			continue;
		}
		if (character === "]" || (character === ">" && text[cursor + 1] === ">")) {
			depth -= 1;
			cursor += character === "]" ? 1 : 2;
			previousName = undefined;
			if (depth < 0) {
				throw new Error("This PDF has an invalid content container.");
			}
			continue;
		}
		const isName = character === "/";
		const start = cursor + (isName ? 1 : 0);
		cursor = start;
		while (cursor < text.length && !delimiter(text[cursor] ?? "")) {
			cursor += 1;
		}
		if (cursor === start && !isName) {
			cursor += 1;
		}
		const token = text.slice(start, cursor);
		if (depth === 0 && !isName && token === "BI") {
			throw new Error(
				"This PDF uses inline images that cannot be safely separated. Convert its pages to images instead."
			);
		}
		if (depth === 0 && !isName && token === "Do" && previousName) {
			names.add(previousName);
		}
		previousName =
			isName && depth === 0
				? PDFName.of(
						token.replace(/#[\da-f]{2}/gi, (encoded) => encoded.toUpperCase())
					)
				: undefined;
	}
	if (depth !== 0) {
		throw new Error("This PDF has an incomplete content container.");
	}
	return names;
}
