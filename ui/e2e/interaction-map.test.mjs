import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import {
	namedAssertionIsPresent,
	reconcileLocalInteractionMap,
} from "../../../../apps-store/companion-suite.mjs";

const uiRoot = resolve(import.meta.dirname, "..");
const mapPath = resolve(import.meta.dirname, "companion-interactions.json");
const specPath = resolve(import.meta.dirname, "convert-companion.spec.ts");
const eventAttributes = new Set([
	"onBlur",
	"onChange",
	"onCheckedChange",
	"onClick",
	"onDragStart",
	"onDrop",
	"onFocus",
	"onKeyDown",
	"onKeyUp",
	"onMouseEnter",
	"onMouseLeave",
	"onOpenChange",
	"onPointerDown",
	"onPointerUp",
	"onPress",
	"onSelect",
	"onSubmit",
	"onValueChange",
]);
const semanticTags = new Set([
	"a",
	"button",
	"details",
	"form",
	"input",
	"select",
	"summary",
	"textarea",
]);
const interactiveComponentName =
	/(?:Button|Link|Trigger|Switch|Checkbox|Radio|Select|Combobox|MenuItem|CommandItem|Tab|Picker|Toggle|Control)$/u;

function componentName(node) {
	for (let current = node.parent; current; current = current.parent) {
		if (ts.isFunctionDeclaration(current) && current.name) {
			return current.name.text;
		}
		if (
			ts.isVariableDeclaration(current) &&
			ts.isIdentifier(current.name) &&
			current.initializer &&
			(ts.isArrowFunction(current.initializer) ||
				ts.isFunctionExpression(current.initializer))
		) {
			return current.name.text;
		}
	}
	return "module";
}

function scanCurrentConvertRows() {
	const rows = [];
	for (const sourceFilePath of ["src/App.tsx", "src/ToolsView.tsx"]) {
		const sourcePath = resolve(uiRoot, sourceFilePath);
		const source = readFileSync(sourcePath, "utf8");
		const sourceFile = ts.createSourceFile(
			sourcePath,
			source,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX
		);
		const visit = (node) => {
			if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
				const sourceTag = node.tagName.getText(sourceFile);
				const tag = sourceTag.includes(".")
					? (sourceTag.split(".").at(-1) ?? sourceTag)
					: sourceTag;
				const events = node.attributes.properties
					.filter(
						(attribute) =>
							ts.isJsxAttribute(attribute) &&
							eventAttributes.has(attribute.name.getText())
					)
					.map((attribute) => attribute.name.getText());
				if (
					events.length > 0 ||
					semanticTags.has(tag.toLowerCase()) ||
					interactiveComponentName.test(tag)
				) {
					const position = sourceFile.getLineAndCharacterOfPosition(
						node.getStart(sourceFile)
					);
					rows.push({
						package: "convert",
						source_file: `apps-store/convert/ui/${sourceFilePath}`,
						line: String(position.line + 1),
						component: componentName(node),
						tag,
						events: events.join(","),
					});
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(sourceFile);
	}
	return rows;
}

const censusRows = scanCurrentConvertRows();
const map = JSON.parse(readFileSync(mapPath, "utf8"));
const specSource = readFileSync(specPath, "utf8");

describe("Convert package-owned interaction map", () => {
	test("reconciles all live Convert controls to named rendered assertions", () => {
		const reconciled = reconcileLocalInteractionMap("convert", censusRows, map);
		expect(reconciled).toHaveLength(37);
		for (const { assertion } of reconciled) {
			expect(
				namedAssertionIsPresent(
					specSource,
					assertion.testTitle,
					assertion.assertionMarker
				)
			).toBe(true);
		}
	});

	test("rejects duplicate controls and stale source-line identities", () => {
		const first = map.assertions[0];
		expect(first).toBeDefined();
		expect(() =>
			reconcileLocalInteractionMap("convert", censusRows, {
				...map,
				assertions: [first, { ...first }],
				expectedRows: 2,
				scope: "partial",
			})
		).toThrow("duplicates an interaction identity");

		const stale = { ...first, row: { ...first.row, line: "99999" } };
		expect(() =>
			reconcileLocalInteractionMap("convert", censusRows, {
				...map,
				assertions: [stale],
				expectedRows: 1,
				scope: "partial",
			})
		).toThrow("does not match exactly one current central census row");
	});
});
