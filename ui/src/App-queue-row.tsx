import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Badge, Button } from "@ryu/blocks/companion/controls";
import { useLiteralMessages } from "@ryu/i18n/react";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { Progress } from "@ryu/ui/components/progress.tsx";
import { Glyph, iconForCategory } from "./App-glyph.tsx";
import {
	detectCategory,
	type FormatId,
	fileExtension,
	formatFileSize,
	type QueueItem,
	targetsForFile,
} from "./model.ts";

export function QueueRow({
	item,
	onDownload,
	onRemove,
	onTargetChange,
}: {
	item: QueueItem;
	onDownload: () => void;
	onRemove: () => void;
	onTargetChange: (target: FormatId) => void;
}) {
	const tl = useLiteralMessages();
	const category = detectCategory(item.file.name, item.file.type);
	const targetOptions = targetsForFile(item.file.name, item.file.type);
	const source = fileExtension(item.file.name).toUpperCase() || "FILE";
	const statusLabel =
		item.status === "converting"
			? "Working"
			: item.status === "complete"
				? "Ready"
				: item.status === "error"
					? "Needs review"
					: "Queued";
	return (
		<div className={`convert-file-row is-${item.status}`} role="listitem">
			<div className="convert-file-icon">
				<Glyph icon={iconForCategory(category)} />
			</div>
			<div className="convert-file-details">
				<div className="convert-file-name-line">
					<strong title={item.file.name}>{item.file.name}</strong>
					<Badge variant="outline">{source}</Badge>
				</div>
				<span>
					{formatFileSize(item.file.size)} · {category}
				</span>
				{item.status === "error" ? (
					<small className="convert-error-copy">{item.error}</small>
				) : null}
				{item.status === "converting" ? (
					<Progress
						aria-label={
							item.progress === null
								? "Conversion in progress"
								: tl("{progress}% complete", {
										progress: String(item.progress),
									})
						}
						className="w-full max-w-60"
						value={item.progress}
					/>
				) : null}
			</div>
			<div className="convert-file-target">
				<span>To</span>
				<NativeSelect
					aria-label={tl("Output format for {name}", { name: item.file.name })}
					onChange={(event) =>
						onTargetChange(
							targetOptions.find(
								(format) => format.id === event.currentTarget.value
							)?.id ?? item.target
						)
					}
					value={item.target}
				>
					{targetOptions.map((format) => (
						<NativeSelectOption key={format.id} value={format.id}>
							{format.label}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</div>
			<Badge
				className={`convert-row-status is-${item.status}`}
				variant="outline"
			>
				{item.status === "complete" ? (
					<Glyph icon={CheckmarkCircle02Icon} />
				) : null}
				{statusLabel}
			</Badge>
			{item.output ? (
				<Button
					onClick={onDownload}
					size="sm"
					type="button"
					variant="secondary"
				>
					Download
				</Button>
			) : null}
			<Button
				aria-label={tl("Remove {name}", { name: item.file.name })}
				onClick={onRemove}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				×
			</Button>
		</div>
	);
}
