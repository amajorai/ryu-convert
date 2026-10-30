import {
	Clock01Icon,
	File01Icon,
	PackageOpenIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { RyuAppMain, RyuAppToolbar } from "@ryu/blocks/companion/app-ui";
import { Badge, Button } from "@ryu/blocks/companion/controls";
import { useLiteralMessages } from "@ryu/i18n/react";
import { Tabs, TabsList, TabsTrigger } from "@ryu/ui/components/tabs.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConvertWorkspace } from "./App-convert-workspace.tsx";
import { FormatsView } from "./App-formats-view.tsx";
import { Glyph } from "./App-glyph.tsx";
import { HistoryView } from "./App-history-view.tsx";
import {
	ACCEPTED_FILES,
	initialView,
	isConvertView,
	type Notice,
	newId,
} from "./App-view-state.ts";
import { loadHistory, notify, saveHistory } from "./bridge.ts";
import { convertFile, mergePdfFiles } from "./conversion.ts";
import {
	type ConversionResult,
	type ConvertView,
	defaultTargetForFile,
	FORMAT_DEFINITIONS,
	type FormatId,
	fileExtension,
	type HistoryItem,
	type QueueItem,
} from "./model.ts";
import { conversionOperationErrorSchema } from "./schemas.ts";
import { ToolsView } from "./ToolsView.tsx";
import { zipResults } from "./tools.ts";

export function App() {
	const isStandalonePreview = Boolean(
		globalThis.window && !globalThis.window.ryu
	);
	const tl = useLiteralMessages();
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
			.catch((error) => {
				const operationError = conversionOperationErrorSchema.parse(error);
				if (!active) {
					return;
				}
				setHistoryError(
					operationError === null
						? "Conversion history is unavailable on this host."
						: operationError.message
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

	const addFiles = useCallback(
		(fileList: FileList | File[]) => {
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
				message: tl(
					"{count, plural, one {{countText} file} other {{countText} files}} ready for a local conversion.",
					{ count: files.length, countText: String(files.length) }
				),
				variant: "info",
			});
		},
		[tl]
	);

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
			} catch (error) {
				const operationError = conversionOperationErrorSchema.parse(error);
				updateQueueItem(item.id, {
					error:
						operationError === null
							? "The local conversion failed."
							: operationError.message,
					progress: 0,
					status: "error",
				});
			}
		}
		setConverting(false);
		setNotice({
			message:
				completed === pending.length
					? tl(
							"{count, plural, one {{countText} file} other {{countText} files}} converted locally. Download the {count, plural, one {result} other {results}} below.",
							{ count: completed, countText: String(completed) }
						)
					: tl(
							"{completed} of {total} files converted. Review the errors and try again.",
							{
								completed: String(completed),
								total: String(pending.length),
							}
						),
			variant: completed === pending.length ? "success" : "error",
		});
		if (completed > 0) {
			await notify(
				tl(
					"{count, plural, one {{countText} local conversion} other {{countText} local conversions}} complete.",
					{ count: completed, countText: String(completed) }
				),
				"success"
			);
		}
	}, [
		appendHistory,
		converting,
		imageQuality,
		maxWidth,
		queue,
		tl,
		updateQueueItem,
	]);

	const downloadResult = useCallback(
		(result: ConversionResult) => {
			const url = URL.createObjectURL(result.blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = result.fileName;
			anchor.click();
			window.setTimeout(() => URL.revokeObjectURL(url), 0);
			setNotice({
				message: tl("{fileName} is ready in your downloads.", {
					fileName: result.fileName,
				}),
				variant: "success",
			});
		},
		[tl]
	);

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
				message: tl(
					"{count} PDFs merged locally. Download the combined file when ready.",
					{ count: String(pdfFiles.length) }
				),
				variant: "success",
			});
			await notify("PDF merge complete.", "success");
		} catch (error) {
			const operationError = conversionOperationErrorSchema.parse(error);
			setNotice({
				message:
					operationError === null
						? "The local PDF merge failed."
						: operationError.message,
				variant: "error",
			});
		}
	}, [appendHistory, queue, tl]);

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
		} catch (error) {
			const operationError = conversionOperationErrorSchema.parse(error);
			setNotice({
				message:
					operationError === null
						? "The batch archive failed."
						: operationError.message,
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
						<h2>Convert files locally.</h2>
						<p className="convert-heading-copy">
							Drop a batch, choose an output, and run it on this device.
						</p>
					</div>
					{isStandalonePreview ? (
						<div className="w-full shrink-0 sm:w-auto">
							<Tabs
								onValueChange={(nextView) => {
									if (isConvertView(nextView)) {
										setViewAndClearNotice(nextView);
									}
								}}
								value={view}
							>
								<TabsList
									aria-label="Convert preview views"
									className="w-full"
									manageLayout={false}
									variant="segmented"
								>
									<TabsTrigger value="convert">
										<Glyph icon={File01Icon} />
										Convert
									</TabsTrigger>
									<TabsTrigger value="history">
										<Glyph icon={Clock01Icon} />
										History
									</TabsTrigger>
									<TabsTrigger value="formats">
										<Glyph icon={PackageOpenIcon} />
										Formats
									</TabsTrigger>
									<TabsTrigger value="tools">
										<Glyph icon={Settings01Icon} />
										Tools
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
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
