import { Search01Icon } from "@hugeicons/core-free-icons";
import { RyuAppSection } from "@ryu/blocks/companion/app-ui";
import { Badge } from "@ryu/blocks/companion/controls";
import { useLiteralMessages } from "@ryu/i18n/react";
import { Glyph, iconForCategory } from "./App-glyph.tsx";
import { CATEGORIES, type FormatDefinition } from "./model.ts";

export function FormatsView({ formats }: { formats: FormatDefinition[] }) {
	const tl = useLiteralMessages();
	return (
		<div className="convert-secondary-view">
			<div className="convert-secondary-heading">
				<div>
					<h3>Formats that work here</h3>
					<p>
						These are the real browser-local output paths in this release. Input
						detection also accepts common neighboring extensions.
					</p>
				</div>
				<Badge variant="outline">
					{tl("{count} adapters", { count: String(formats.length) })}
				</Badge>
			</div>
			{CATEGORIES.filter((category) => category.id !== "all").map(
				(category) => {
					const categoryFormats = formats.filter(
						(format) => format.category === category.id
					);
					return (
						<RyuAppSection
							className="convert-format-section"
							key={category.id}
							title={category.label}
						>
							<div className="convert-format-grid">
								{categoryFormats.map((format) => (
									<FormatCard format={format} key={format.id} />
								))}
							</div>
						</RyuAppSection>
					);
				}
			)}
			<div className="convert-limitations">
				<span className="convert-limitations-icon">
					<Glyph icon={Search01Icon} />
				</span>
				<div>
					<strong>Browser capability is visible, not hidden.</strong>
					<p>
						PDF security/OCR, office and ebook fidelity, image AI, and codecs
						that this browser cannot run remain unavailable instead of being
						mislabeled as successful conversions.
					</p>
				</div>
			</div>
		</div>
	);
}

function FormatCard({ format }: { format: FormatDefinition }) {
	return (
		<div className="convert-format-card">
			<div className="convert-format-card-top">
				<span className={`convert-format-glyph is-${format.category}`}>
					<Glyph icon={iconForCategory(format.category)} />
				</span>
				<Badge variant={format.inputOnly ? "secondary" : "outline"}>
					{format.inputOnly ? "Input" : `.${format.extension}`}
				</Badge>
			</div>
			<strong>{format.label}</strong>
			<p>{format.description}</p>
		</div>
	);
}
