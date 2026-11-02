import {
	decodePDFRawStream,
	PDFArray,
	PDFContentStream,
	PDFContext,
	PDFDict,
	type PDFDocument,
	PDFName,
	PDFNull,
	type PDFObject,
	PDFObjectCopier,
	PDFPage,
	PDFPageLeaf,
	PDFRawStream,
	PDFRef,
	PDFStream,
} from "pdf-lib";
import { usedPdfXObjects } from "./pdf-resource-usage.ts";

/** Copy a page without importing other pages through annotations or form trees. */
export function copySubsetPage(
	source: PDFDocument,
	destination: PDFDocument,
	index: number
): PDFPage {
	const selected = source.getPage(index);
	const blocked = new Set<PDFObject>();
	const selectedContents = new Set<PDFObject>();
	const resourceUsage = new Map<PDFDict, Set<PDFName>>();
	const usedObjects = new Set<PDFObject>();
	const visitedForms = new Map<PDFStream, Set<PDFDict>>();
	const contentBytes = (stream: PDFStream) => {
		if (stream instanceof PDFRawStream) {
			return decodePDFRawStream(stream).decode();
		}
		if (stream instanceof PDFContentStream) {
			return stream.getUnencodedContents();
		}
		throw new Error("This PDF content stream cannot be safely separated.");
	};
	const useResources = (resources: PDFDict, streams: PDFStream[]) => {
		const used = resourceUsage.get(resources) ?? new Set<PDFName>();
		resourceUsage.set(resources, used);
		const xObjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
		if (!xObjects) {
			return;
		}
		const decoded = streams.map(contentBytes);
		const combined = new Uint8Array(
			decoded.reduce((length, stream) => length + stream.length, 0)
		);
		let offset = 0;
		for (const stream of decoded) {
			combined.set(stream, offset);
			offset += stream.length;
		}
		for (const name of usedPdfXObjects(combined)) {
			used.add(name);
			const reference = xObjects.get(name);
			if (reference) {
				usedObjects.add(reference);
			}
			const form = xObjects?.lookup(name);
			if (form) {
				usedObjects.add(form);
			}
			if (
				!(form instanceof PDFStream) ||
				form.dict.get(PDFName.of("Subtype")) !== PDFName.of("Form")
			) {
				continue;
			}
			const nested =
				form.dict.lookupMaybe(PDFName.of("Resources"), PDFDict) ?? resources;
			const contexts = visitedForms.get(form) ?? new Set<PDFDict>();
			if (!contexts.has(nested)) {
				contexts.add(nested);
				visitedForms.set(form, contexts);
				useResources(nested, [form]);
			}
		}
	};
	const collectContents = (
		object: PDFObject | undefined,
		output: Set<PDFObject>
	) => {
		if (!object || output.has(object)) {
			return;
		}
		output.add(object);
		const resolved =
			object instanceof PDFRef ? source.context.lookup(object) : object;
		if (resolved instanceof PDFArray) {
			for (const item of resolved.asArray()) {
				collectContents(item, output);
			}
		} else if (resolved instanceof PDFStream) {
			output.add(resolved);
		}
	};
	collectContents(selected.node.get(PDFName.of("Contents")), selectedContents);
	const selectedResources = selected.node.Resources();
	if (selectedResources) {
		useResources(
			selectedResources,
			[...selectedContents].filter(
				(object): object is PDFStream => object instanceof PDFStream
			)
		);
	}
	const appearances = new Set<PDFObject>();
	const collectAppearances = (object: PDFObject | undefined) => {
		if (!object || appearances.has(object)) {
			return;
		}
		appearances.add(object);
		const resolved =
			object instanceof PDFRef ? source.context.lookup(object) : object;
		if (resolved instanceof PDFStream) {
			const resources =
				resolved.dict.lookupMaybe(PDFName.of("Resources"), PDFDict) ??
				selectedResources;
			if (resources) {
				useResources(resources, [resolved]);
			}
		} else if (resolved instanceof PDFDict) {
			for (const [, value] of resolved.entries()) {
				collectAppearances(value);
			}
		}
	};
	for (const annotation of selected.node
		.lookupMaybe(PDFName.of("Annots"), PDFArray)
		?.asArray() ?? []) {
		const resolved = source.context.lookup(annotation);
		if (resolved instanceof PDFDict) {
			collectAppearances(resolved.get(PDFName.of("AP")));
		}
	}
	const resourceDictionaries = new Set<PDFDict>(resourceUsage.keys());
	for (const page of source.getPages()) {
		const resources = page.node.Resources();
		if (resources) {
			resourceDictionaries.add(resources);
		}
	}
	for (const [, object] of source.context.enumerateIndirectObjects()) {
		if (
			object instanceof PDFStream &&
			object.dict.get(PDFName.of("Subtype")) === PDFName.of("Form")
		) {
			const resources = object.dict.lookupMaybe(
				PDFName.of("Resources"),
				PDFDict
			);
			if (resources) {
				resourceDictionaries.add(resources);
			}
		}
	}
	for (const resources of resourceDictionaries) {
		for (const [, reference] of resources
			.lookupMaybe(PDFName.of("XObject"), PDFDict)
			?.entries() ?? []) {
			const object = source.context.lookup(reference);
			if (
				!(usedObjects.has(reference) || (object && usedObjects.has(object)))
			) {
				blocked.add(reference);
				if (object) {
					blocked.add(object);
				}
			}
		}
	}
	for (const page of source.getPages()) {
		if (page === selected) {
			continue;
		}
		blocked.add(page.ref);
		blocked.add(page.node);
		const resources = page.node.Resources();
		if (resources && !resourceUsage.has(resources)) {
			blocked.add(resources);
		}
		collectContents(page.node.get(PDFName.of("Contents")), blocked);
		const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
		for (const annotation of annotations?.asArray() ?? []) {
			blocked.add(annotation);
			if (annotation instanceof PDFRef) {
				const target = source.context.lookup(annotation);
				if (target) {
					blocked.add(target);
				}
			}
		}
	}
	for (const content of selectedContents) {
		blocked.delete(content);
	}

	// A private context keeps the donor unchanged and retains only the reachable
	// selected graph. References retain their IDs while cycles are visited once.
	const isolated = PDFContext.create();
	const visited = new Map<PDFObject, PDFObject>();
	const visitedReferences = new Set<PDFRef>();
	const sanitize = (object: PDFObject): PDFObject => {
		if (blocked.has(object)) {
			return PDFNull;
		}
		if (object instanceof PDFRef) {
			const target = source.context.lookup(object);
			if (!target || blocked.has(target)) {
				return PDFNull;
			}
			if (!visitedReferences.has(object)) {
				visitedReferences.add(object);
				isolated.assign(object, sanitize(target));
			}
			return object;
		}
		const existing = visited.get(object);
		if (existing) {
			return existing;
		}
		const cloned = object.clone(isolated);
		visited.set(object, cloned);
		if (object instanceof PDFArray && cloned instanceof PDFArray) {
			for (let offset = 0; offset < object.size(); offset += 1) {
				cloned.set(offset, sanitize(object.get(offset)));
			}
		} else {
			const originalDictionary =
				object instanceof PDFStream ? object.dict : object;
			const clonedDictionary =
				cloned instanceof PDFStream ? cloned.dict : cloned;
			if (
				originalDictionary instanceof PDFDict &&
				clonedDictionary instanceof PDFDict
			) {
				for (const [key, value] of originalDictionary.entries()) {
					if (object === selected.node && key === PDFName.of("Parent")) {
						clonedDictionary.delete(key);
						continue;
					}
					if (
						key === PDFName.of("XObject") &&
						resourceUsage.has(originalDictionary)
					) {
						const entries = originalDictionary.lookupMaybe(key, PDFDict);
						const retained = PDFDict.withContext(isolated);
						for (const [name, reference] of entries?.entries() ?? []) {
							if (resourceUsage.get(originalDictionary)?.has(name)) {
								retained.set(name, sanitize(reference));
							}
						}
						clonedDictionary.set(key, retained);
						continue;
					}
					const safe = sanitize(value);
					if (safe === PDFNull) {
						clonedDictionary.delete(key);
					} else {
						clonedDictionary.set(key, safe);
					}
				}
			}
		}
		if (object === selected.node && cloned instanceof PDFPageLeaf) {
			for (const inherited of PDFPageLeaf.InheritableEntries) {
				const key = PDFName.of(inherited);
				const value = selected.node.getInheritableAttribute(key);
				if (value) {
					cloned.set(key, sanitize(value));
				}
			}
			cloned.delete(PDFName.of("Parent"));
		}
		return cloned;
	};
	sanitize(selected.ref);
	const pageReference = PDFObjectCopier.for(isolated, destination.context).copy(
		selected.ref
	);
	const pageNode = destination.context.lookup(pageReference);
	if (!(pageNode instanceof PDFPageLeaf)) {
		throw new Error("The selected PDF page is unavailable.");
	}
	return PDFPage.of(pageNode, pageReference, destination);
}
