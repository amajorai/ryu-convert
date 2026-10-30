import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { RyuAppEmpty } from "@ryu/blocks/companion/app-ui";
import { Badge, Button, Spinner } from "@ryu/blocks/companion/controls";
import { formatDateTime } from "@ryu/ui/lib/timezone.ts";
import { Glyph } from "./App-glyph.tsx";
import { formatFileSize, formatLabel, type HistoryItem } from "./model.ts";

export function HistoryView({
	error,
	items,
	loading,
	onStart,
}: {
	error: string | null;
	items: HistoryItem[];
	loading: boolean;
	onStart?: () => void;
}) {
	return (
		<div className="convert-secondary-view">
			<div className="convert-secondary-heading">
				<div>
					<h3>Conversion history</h3>
					<p>
						Metadata only. Converted output stays in your downloads, not in app
						storage.
					</p>
				</div>
				<Badge variant="outline">
					<span className="convert-status-dot" />
					Private by default
				</Badge>
			</div>
			{loading ? (
				<div className="convert-loading">
					<Spinner /> Loading history…
				</div>
			) : error ? (
				<RyuAppEmpty description={error} title="History unavailable" />
			) : items.length === 0 ? (
				<RyuAppEmpty
					actions={
						onStart ? (
							<Button onClick={onStart} type="button" variant="secondary">
								Start with a file above
							</Button>
						) : undefined
					}
					description="Your completed local runs will appear here."
					title="No conversions yet"
				/>
			) : (
				<div
					aria-label="Conversion history"
					className="convert-history-list"
					role="list"
				>
					{items.map((item) => (
						<HistoryRow item={item} key={item.id} />
					))}
				</div>
			)}
		</div>
	);
}

function HistoryRow({ item }: { item: HistoryItem }) {
	return (
		<div className="convert-history-row" role="listitem">
			<div className="convert-history-icon">
				<Glyph icon={CheckmarkCircle02Icon} />
			</div>
			<div className="convert-history-copy">
				<strong>{item.name}</strong>
				<span>
					{item.source} → {formatLabel(item.target)}
				</span>
			</div>
			<span className="convert-history-size">{formatFileSize(item.size)}</span>
			<time dateTime={item.completedAt}>
				{formatHistoryDate(item.completedAt)}
			</time>
		</div>
	);
}

function formatHistoryDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "Unknown time";
	}
	return formatDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}
