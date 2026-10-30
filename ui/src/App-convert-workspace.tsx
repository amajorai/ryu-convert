import {
	ArrowRight01Icon,
	File01Icon,
	Folder01Icon,
	PackageOpenIcon,
	PlusSignIcon,
} from "@hugeicons/core-free-icons";
import {
	RyuAppActions,
	RyuAppDetail,
	RyuAppField,
	RyuAppForm,
	RyuAppSection,
} from "@ryu/blocks/companion/app-ui";
import { Button, Input, Spinner } from "@ryu/blocks/companion/controls";
import { FileUpload } from "@ryu/ui/components/file-upload.tsx";
import { Slider } from "@ryu/ui/components/slider.tsx";
import { Glyph } from "./App-glyph.tsx";
import { QueueRow } from "./App-queue-row.tsx";
import {
	type ConversionResult,
	type FormatId,
	fileExtension,
	type QueueItem,
} from "./model.ts";
import { sliderQualitySchema } from "./schemas.ts";

interface ConvertWorkspaceProps {
	accept: string;
	addFiles: (files: FileList | File[]) => void;
	clearQueue: () => void;
	converting: boolean;
	convertQueue: () => Promise<void>;
	download: (item: QueueItem) => void;
	downloadResult: (result: ConversionResult) => void;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	imageQuality: number;
	maxWidth: string;
	mergePdfs: () => Promise<void>;
	mergeResult: ConversionResult | null;
	openPicker: () => void;
	queue: QueueItem[];
	removeItem: (id: string) => void;
	setImageQuality: (value: number) => void;
	setMaxWidth: (value: string) => void;
	updateTarget: (id: string, target: FormatId) => void;
}

export function ConvertWorkspace({
	accept,
	addFiles,
	clearQueue,
	convertQueue,
	converting,
	download,
	downloadResult,
	fileInputRef,
	imageQuality,
	mergePdfs,
	mergeResult,
	maxWidth,
	openPicker,
	queue,
	removeItem,
	setImageQuality,
	setMaxWidth,
	updateTarget,
}: ConvertWorkspaceProps) {
	const readyCount = queue.filter(
		(item) => item.status === "ready" || item.status === "error"
	).length;

	return (
		<>
			{queue.length > 0 ? (
				<input
					accept={accept}
					aria-hidden="true"
					className="convert-file-input"
					multiple
					onChange={(event) => {
						if (event.currentTarget.files) {
							addFiles(event.currentTarget.files);
						}
						event.currentTarget.value = "";
					}}
					ref={fileInputRef}
					tabIndex={-1}
					type="file"
				/>
			) : null}
			{queue.length === 0 ? (
				<EmptyWorkspace accept={accept} onFilesAdded={addFiles} />
			) : (
				<div className="convert-workspace-grid">
					<RyuAppSection className="convert-queue-section" title="Batch queue">
						<div className="convert-section-toolbar">
							<div>
								<strong>
									{queue.length} {queue.length === 1 ? "file" : "files"}
								</strong>
								<span> · source files stay untouched</span>
							</div>
							<div className="convert-section-actions">
								{queue.filter((item) => fileExtension(item.file.name) === "pdf")
									.length >= 2 ? (
									mergeResult ? (
										<Button
											onClick={() => downloadResult(mergeResult)}
											size="sm"
											type="button"
											variant="secondary"
										>
											Download combined.pdf
										</Button>
									) : (
										<Button
											onClick={() => void mergePdfs()}
											size="sm"
											type="button"
											variant="outline"
										>
											Merge PDFs
										</Button>
									)
								) : null}
								<Button
									onClick={openPicker}
									size="sm"
									type="button"
									variant="outline"
								>
									<Glyph icon={PlusSignIcon} />
									Add files
								</Button>
							</div>
						</div>
						<div
							aria-label="Files to convert"
							className="convert-queue-list"
							role="list"
						>
							{queue.map((item) => (
								<QueueRow
									item={item}
									key={item.id}
									onDownload={() => download(item)}
									onRemove={() => removeItem(item.id)}
									onTargetChange={(target) => updateTarget(item.id, target)}
								/>
							))}
						</div>
						<div className="convert-file-upload-wrap">
							<FileUpload
								accept={accept}
								description="or browse from this device"
								items={[]}
								onFilesAdded={addFiles}
								title="Drop more files"
							/>
						</div>
					</RyuAppSection>
					<RyuAppDetail className="convert-settings">
						<div className="convert-settings-heading">
							<h3>Local settings</h3>
							<p>Applied to the next batch run. Nothing is uploaded.</p>
						</div>
						<RyuAppForm
							onSubmit={(event) => {
								event.preventDefault();
								void convertQueue();
							}}
						>
							<RyuAppField
								description="JPEG, WebP, and AVIF use this quality value."
								label="Image quality"
							>
								<div className="convert-quality-control">
									<Slider
										aria-label="Image quality"
										max={1}
										min={0.1}
										onValueChange={(values) => {
											const value = sliderQualitySchema.parse(values);
											if (value !== undefined) {
												setImageQuality(value);
											}
										}}
										step={0.01}
										value={[imageQuality]}
									/>
									<span>{Math.round(imageQuality * 100)}%</span>
								</div>
							</RyuAppField>
							<RyuAppField
								description="Leave blank to preserve the source width."
								label="Max image width"
							>
								<Input
									inputMode="numeric"
									min="1"
									onChange={(event) =>
										setMaxWidth(
											event.currentTarget.value.replace(/[^0-9]/gu, "")
										)
									}
									placeholder="Original width"
									type="text"
									value={maxWidth}
								/>
							</RyuAppField>
							<div className="convert-settings-rule" />
							<div className="convert-settings-summary">
								<span>Ready to process</span>
								<strong>
									{readyCount} {readyCount === 1 ? "file" : "files"}
								</strong>
							</div>
							<RyuAppActions>
								<Button onClick={clearQueue} type="button" variant="ghost">
									Clear batch
								</Button>
								<Button disabled={converting} type="submit" variant="default">
									{converting ? <Spinner /> : <Glyph icon={ArrowRight01Icon} />}
									{converting ? "Converting…" : "Convert batch"}
								</Button>
							</RyuAppActions>
							<p className="convert-settings-footnote">
								{converting
									? "Processing in this browser…"
									: "No network, no Docker, no source mutation."}
							</p>
						</RyuAppForm>
					</RyuAppDetail>
				</div>
			)}
		</>
	);
}

function EmptyWorkspace({
	accept,
	onFilesAdded,
}: {
	accept: string;
	onFilesAdded: (files: File[]) => void;
}) {
	return (
		<div className="convert-empty-workspace">
			<div className="convert-empty-copy">
				<h3>No files queued.</h3>
				<p>
					Images, text, structured data, PDFs, and browser-supported media — all
					processed on this device.
				</p>
			</div>
			<FileUpload
				accept={accept}
				description="Images, documents, data, PDFs, and media · batch-ready"
				items={[]}
				onFilesAdded={onFilesAdded}
				title="Drop files to convert"
			/>
			<div className="convert-quick-grid">
				<QuickCard
					detail="PNG · JPG · WebP · AVIF · PDF"
					icon={Folder01Icon}
					label="Images"
				/>
				<QuickCard
					detail="TXT · MD · HTML · DOCX · PDF · PDF text"
					icon={File01Icon}
					label="Documents"
				/>
				<QuickCard
					detail="JSON ↔ CSV ↔ YAML"
					icon={PackageOpenIcon}
					label="Structured data"
				/>
				<QuickCard
					detail="Mediabunny: MP4 · WebM · WAV · MP3"
					icon={ArrowRight01Icon}
					label="Media"
				/>
			</div>
		</div>
	);
}

function QuickCard({
	detail,
	icon,
	label,
}: {
	detail: string;
	icon: typeof File01Icon;
	label: string;
}) {
	return (
		<div className="convert-quick-card">
			<span className="convert-quick-icon">
				<Glyph icon={icon} />
			</span>
			<span>
				<strong>{label}</strong>
				<small>{detail}</small>
			</span>
		</div>
	);
}
