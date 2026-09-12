import {
	ArrowRight01Icon,
	CheckmarkCircle02Icon,
	Clock01Icon,
	File01Icon,
	Folder01Icon,
	PackageOpenIcon,
	PlusSignIcon,
	Search01Icon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	RyuAppActions,
	RyuAppDetail,
	RyuAppEmpty,
	RyuAppField,
	RyuAppForm,
	RyuAppMain,
	RyuAppSection,
	RyuAppToolbar,
} from "@ryu/blocks/companion/app-ui";
import { Badge, Button, Input, Spinner } from "@ryu/blocks/companion/controls";
import { FileUpload } from "@ryu/ui/components/file-upload.tsx";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { Progress } from "@ryu/ui/components/progress.tsx";
import { Slider } from "@ryu/ui/components/slider.tsx";
import { Tabs, TabsList, TabsTrigger } from "@ryu/ui/components/tabs.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadHistory, notify, saveHistory } from "./bridge";
import { convertFile, mergePdfFiles } from "./conversion";
import {
	CATEGORIES,
	type ConversionResult,
	type ConvertView,
	defaultTargetForFile,
	detectCategory,
	type FileCategory,
	FORMAT_DEFINITIONS,
	type FormatDefinition,
	type FormatId,
	fileExtension,
	formatFileSize,
	formatLabel,
	type HistoryItem,
	type QueueItem,
	targetsForFile,
} from "./model";
import { ToolsView } from "./ToolsView";
import { zipResults } from "./tools";

const ACCEPTED_FILES = [
	"image/*",
	"audio/*",
	"video/*",
	"application/pdf",
	"application/json",
	"text/*",
	...FORMAT_DEFINITIONS.map((format) => `.${format.extension}`),
	".htm",
	".mdx",
	".text",
	".tif",
	".tsv",
	".yml",
].join(",");

interface Notice {
	message: string;
	variant: "info" | "success" | "error";
}

function iconForCategory(category: FileCategory) {
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

function Glyph({
	icon,
	className = "",
}: {
	icon: typeof File01Icon;
	className?: string;
}) {
	return <HugeiconsIcon aria-hidden="true" className={className} icon={icon} />;
}

function newId(prefix: string): string {
	return `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function initialView(): ConvertView {
	const view =
		typeof window === "undefined" ? undefined : window.ryu?.context?.view;
	return view === "history" || view === "formats" || view === "tools"
		? view
		: "convert";
}

function isConvertView(value: unknown): value is ConvertView {
	return (
		value === "convert" ||
		value === "history" ||
		value === "formats" ||
		value === "tools"
	);
}

export function App() {
	const isStandalonePreview = typeof window !== "undefined" && !window.ryu;
	const [view, setView] = useState<ConvertView>(initialView);
	const [queue, setQueue] = useState<QueueItem[]>([]);
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const historyRef = useRef<HistoryItem[]>([]);
	const [historyLoading, setHistoryLoading] = useState(true);
	const [historyError, setHistoryError] = useState<string | null>(null);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [imageQuality, setImageQuality] = useState(0.92);
	const [maxWidth, setMaxWidth] = useState("");
	const [converting, setConverting] = useState(false);
	const [mergeResult, setMergeResult] = useState<ConversionResult | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let active = true;
		void loadHistory()
			.then((items) => {
				if (!active) {
					return;
				}
				historyRef.current = items;
				setHistory(items);
			})
			.catch((error: unknown) => {
				if (!active) {
					return;
				}
				setHistoryError(
					error instanceof Error
						? error.message
						: "Conversion history is unavailable on this host."
				);
			})
			.finally(() => {
				if (active) {
					setHistoryLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, []);

	const setViewAndClearNotice = useCallback((nextView: ConvertView) => {
		setView(nextView);
		setNotice(null);
	}, []);

	const addFiles = useCallback((fileList: FileList | File[]) => {
		const files = Array.from(fileList);
		if (files.length === 0) {
			return;
		}
		const nextItems = files.map<QueueItem>((file) => ({
			file,
			id: newId("file"),
			progress: 0,
			status: "ready",
			target: defaultTargetForFile(file.name, file.type),
		}));
		setQueue((current) => [...current, ...nextItems]);
		setMergeResult(null);
		setView("convert");
		setNotice({
			message: `${files.length} ${files.length === 1 ? "file" : "files"} ready for a local conversion.`,
			variant: "info",
		});
	}, []);

	const openPicker = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const updateQueueItem = useCallback(
		(id: string, update: Partial<QueueItem>) => {
			setQueue((current) =>
				current.map((item) => (item.id === id ? { ...item, ...update } : item))
			);
		},
		[]
	);

	const updateTarget = useCallback(
		(id: string, target: FormatId) => {
			updateQueueItem(id, {
				error: undefined,
				output: undefined,
				progress: 0,
				status: "ready",
				target,
			});
		},
		[updateQueueItem]
	);

	const appendHistory = useCallback(async (item: HistoryItem) => {
		const next = [item, ...historyRef.current].slice(0, 40);
		historyRef.current = next;
		setHistory(next);
		try {
			await saveHistory(next);
		} catch {
			setHistoryError("This run finished, but its history could not be saved.");
		}
	}, []);

	const convertQueue = useCallback(async () => {
		if (converting) {
			return;
		}
		const pending = queue.filter(
			(item) => item.status === "ready" || item.status === "error"
		);
		if (pending.length === 0) {
			setNotice({
				message: "Add a file or choose a new output first.",
				variant: "info",
			});
			return;
		}

		setConverting(true);
		setNotice(null);
		let completed = 0;
		for (const item of pending) {
			updateQueueItem(item.id, {
				error: undefined,
				progress: null,
				status: "converting",
			});
			try {
				const result = await convertFile(item.file, item.target, {
					imageQuality,
					maxWidth: maxWidth.trim() ? Number(maxWidth) : null,
					onProgress: (progress) => {
						updateQueueItem(item.id, {
							progress: Math.round(progress * 100),
						});
					},
				});
				updateQueueItem(item.id, {
					output: result,
					progress: 100,
					status: "complete",
				});
				await appendHistory({
					completedAt: new Date().toISOString(),
					id: newId("conversion"),
					name: result.fileName,
					size: result.blob.size,
					source: item.file.name,
					target: item.target,
				});
				completed += 1;
			} catch (error: unknown) {
				updateQueueItem(item.id, {
					error:
						error instanceof Error
							? error.message
							: "The local conversion failed.",
					progress: 0,
					status: "error",
				});
			}
		}
		setConverting(false);
		setNotice({
			message:
				completed === pending.length
					? `${completed} ${completed === 1 ? "file" : "files"} converted locally. Download the result${completed === 1 ? "" : "s"} below.`
					: `${completed} of ${pending.length} files converted. Review the errors and try again.`,
			variant: completed === pending.length ? "success" : "error",
		});
		if (completed > 0) {
			await notify(
				`${completed} local conversion${completed === 1 ? "" : "s"} complete.`,
				"success"
			);
		}
	}, [
		appendHistory,
		converting,
		imageQuality,
		maxWidth,
		queue,
		updateQueueItem,
	]);

	const downloadResult = useCallback((result: ConversionResult) => {
		const url = URL.createObjectURL(result.blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = result.fileName;
		anchor.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
		setNotice({
			message: `${result.fileName} is ready in your downloads.`,
			variant: "success",
		});
	}, []);

	const download = useCallback(
		(item: QueueItem) => {
			if (item.output) {
				downloadResult(item.output);
			}
		},
		[downloadResult]
	);

	const mergePdfs = useCallback(async () => {
		const pdfFiles = queue.filter(
			(item) => fileExtension(item.file.name) === "pdf"
		);
		try {
			const result = await mergePdfFiles(pdfFiles.map((item) => item.file));
			setMergeResult(result);
			await appendHistory({
				completedAt: new Date().toISOString(),
				id: newId("conversion"),
				name: result.fileName,
				size: result.blob.size,
				source: `${pdfFiles.length} PDFs`,
				target: "pdf",
			});
			setNotice({
				message: `${pdfFiles.length} PDFs merged locally. Download the combined file when ready.`,
				variant: "success",
			});
			await notify("PDF merge complete.", "success");
		} catch (error: unknown) {
			setNotice({
				message:
					error instanceof Error
						? error.message
						: "The local PDF merge failed.",
				variant: "error",
			});
		}
	}, [appendHistory, queue]);

	const downloadAll = useCallback(async () => {
		const completed = queue.filter((item) => item.output);
		if (completed.length === 0) {
			return;
		}
		try {
			if (completed.length === 1 && completed[0]?.output) {
				downloadResult(completed[0].output);
				return;
			}
			const archive = await zipResults(
				completed.flatMap((item) => (item.output ? [item.output] : [])),
				"convert-results.zip"
			);
			downloadResult(archive);
		} catch (error: unknown) {
			setNotice({
				message:
					error instanceof Error ? error.message : "The batch archive failed.",
				variant: "error",
			});
		}
	}, [downloadResult, queue]);

	const removeItem = useCallback((id: string) => {
		setQueue((current) => current.filter((item) => item.id !== id));
	}, []);

	const clearQueue = useCallback(() => {
		setQueue([]);
		setMergeResult(null);
		setNotice({
			message: "Batch cleared. Your source files were not changed.",
			variant: "info",
		});
	}, []);

	const filteredFormats = useMemo(
		() => FORMAT_DEFINITIONS.filter((format) => format.available),
		[]
	);
	const completedCount = queue.filter(
		(item) => item.status === "complete"
	).length;

	return (
		<div className="convert-app">
			<RyuAppToolbar
				actions={
					<>
						<Badge className="convert-local-badge" variant="outline">
							<span className="convert-status-dot" />
							Local only
						</Badge>
						{completedCount > 0 ? (
							<Button
								onClick={() => void downloadAll()}
								size="sm"
								type="button"
								variant="secondary"
							>
								Download all
							</Button>
						) : null}
					</>
				}
				title="Convert"
			>
				<span className="convert-toolbar-caption">Private file workspace</span>
			</RyuAppToolbar>
			<RyuAppMain className="convert-main">
				<div className="convert-heading-row">
					<div>
						<p className="convert-eyebrow">LOCAL FILE WORKSPACE</p>
						<h2>One place for the files that need a new shape.</h2>
						<p className="convert-heading-copy">
							Drop a batch, pick an output, and keep every byte on this device.
						</p>
					</div>
					{isStandalonePreview ? (
						<Tabs
							className="convert-view-tabs"
							onValueChange={(nextView) => {
								if (isConvertView(nextView)) {
									setViewAndClearNotice(nextView);
								}
							}}
							value={view}
						>
							<TabsList
								aria-label="Convert preview views"
								className="convert-view-switcher"
								manageLayout={false}
								variant="segmented"
							>
								<TabsTrigger className="convert-view-button" value="convert">
									<Glyph icon={File01Icon} />
									Convert
								</TabsTrigger>
								<TabsTrigger className="convert-view-button" value="history">
									<Glyph icon={Clock01Icon} />
									History
								</TabsTrigger>
								<TabsTrigger className="convert-view-button" value="formats">
									<Glyph icon={PackageOpenIcon} />
									Formats
								</TabsTrigger>
								<TabsTrigger className="convert-view-button" value="tools">
									<Glyph icon={Settings01Icon} />
									Tools
								</TabsTrigger>
							</TabsList>
						</Tabs>
					) : null}
				</div>

				{notice ? (
					<div
						aria-live="polite"
						className={`convert-notice is-${notice.variant}`}
						role="status"
					>
						<span className="convert-notice-mark">
							{notice.variant === "error" ? "!" : "✓"}
						</span>
						{notice.message}
					</div>
				) : null}

				{view === "convert" ? (
					<ConvertWorkspace
						accept={ACCEPTED_FILES}
						addFiles={addFiles}
						clearQueue={clearQueue}
						converting={converting}
						convertQueue={convertQueue}
						download={download}
						downloadResult={downloadResult}
						fileInputRef={fileInputRef}
						imageQuality={imageQuality}
						maxWidth={maxWidth}
						mergePdfs={mergePdfs}
						mergeResult={mergeResult}
						openPicker={openPicker}
						queue={queue}
						removeItem={removeItem}
						setImageQuality={setImageQuality}
						setMaxWidth={setMaxWidth}
						updateTarget={updateTarget}
					/>
				) : view === "history" ? (
					<HistoryView
						error={historyError}
						items={history}
						loading={historyLoading}
						onStart={
							isStandalonePreview
								? () => setViewAndClearNotice("convert")
								: undefined
						}
					/>
				) : view === "tools" ? (
					<ToolsView onDownloadResult={downloadResult} onNotice={setNotice} />
				) : (
					<FormatsView formats={filteredFormats} />
				)}
			</RyuAppMain>
		</div>
	);
}

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

function ConvertWorkspace({
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
								<strong>{queue.length} files</strong>
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
								className="convert-queue-upload"
								description="or browse from this device"
								items={[]}
								onFilesAdded={addFiles}
								title="Drop more files"
							/>
						</div>
					</RyuAppSection>
					<RyuAppDetail className="convert-settings">
						<div className="convert-settings-heading">
							<p className="convert-eyebrow">OUTPUT CONTROL</p>
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
											const value = Array.isArray(values) ? values[0] : values;
											if (typeof value === "number") {
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
									{
										queue.filter(
											(item) =>
												item.status === "ready" || item.status === "error"
										).length
									}{" "}
									files
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
				<p className="convert-eyebrow">START A BATCH</p>
				<h3>Your next conversion starts here.</h3>
				<p>
					Images, text, structured data, PDFs, and browser-supported media — all
					processed on this device.
				</p>
			</div>
			<FileUpload
				accept={accept}
				className="convert-file-upload"
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

function QueueRow({
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
								: `${item.progress}% complete`
						}
						className="convert-progress"
						value={item.progress}
					/>
				) : null}
			</div>
			<div className="convert-file-target">
				<span>To</span>
				<NativeSelect
					aria-label={`Output format for ${item.file.name}`}
					onChange={(event) =>
						onTargetChange(event.currentTarget.value as FormatId)
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
				aria-label={`Remove ${item.file.name}`}
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

function HistoryView({
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
					<p className="convert-eyebrow">RECENT RUNS</p>
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
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function FormatsView({ formats }: { formats: FormatDefinition[] }) {
	return (
		<div className="convert-secondary-view">
			<div className="convert-secondary-heading">
				<div>
					<p className="convert-eyebrow">LOCAL ADAPTERS</p>
					<h3>Formats that work here</h3>
					<p>
						These are the real browser-local output paths in this release. Input
						detection also accepts common neighboring extensions.
					</p>
				</div>
				<Badge variant="outline">{formats.length} adapters</Badge>
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
