import {
	ArrowRight01Icon,
	File01Icon,
	Folder01Icon,
	PackageOpenIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { FileCategory } from "./model.ts";

export function iconForCategory(category: FileCategory) {
	if (category === "images") {
		return Folder01Icon;
	}
	if (category === "data") {
		return PackageOpenIcon;
	}
	if (category === "media") {
		return ArrowRight01Icon;
	}
	return File01Icon;
}

export function Glyph({
	icon,
	className = "",
}: {
	icon: typeof File01Icon;
	className?: string;
}) {
	return <HugeiconsIcon aria-hidden="true" className={className} icon={icon} />;
}
