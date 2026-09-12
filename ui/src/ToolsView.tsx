import {
	RyuAppActions,
	RyuAppField,
	RyuAppSection,
} from "@ryu/blocks/companion/app-ui";
import { Badge, Button, Input } from "@ryu/blocks/companion/controls";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { useRef, useState } from "react";
import { convertFile, type ImageCrop } from "./conversion";
import {
	type ConversionResult,
	type FormatId,
	fileExtension,
	formatFileSize,
	formatLabel,
} from "./model";
import { type PdfTool, runPdfTool } from "./tools";

export interface ToolNotice {
	message: string;
	variant: "info" | "success" | "error";
}

interface ToolsViewProps {
	onDownloadResult: (result: ConversionResult) => void;
	onNotice: (notice: ToolNotice) => void;
}

export function ToolsView({ onDownloadResult, onNotice }: ToolsViewProps) {
	const [pdfFile, setPdfFile] = useState<File | null>(null);
	const [pdfTool, setPdfTool] = useState<PdfTool>("compress");
	const [pdfPages, setPdfPages] = useState("");
	const [pdfRotation, setPdfRotation] = useState("90");
	const [pdfWatermark, setPdfWatermark] = useState("");
	const [pdfBusy, setPdfBusy] = useState(false);
	const [pdfResult, setPdfResult] = useState<ConversionResult | null>(null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imageTarget, setImageTarget] = useState<FormatId>("webp");
	const [imageQuality, setImageQuality] = useState("0.92");
	const [imageWidth, setImageWidth] = useState("");
	const [imageRotation, setImageRotation] = useState("0");
	const [imageWatermark, setImageWatermark] = useState("");
	const [crop, setCrop] = useState({ height: "", width: "", x: "", y: "" });
	const [imageBusy, setImageBusy] = useState(false);
	const [imageResult, setImageResult] = useState<ConversionResult | null>(null);

	async function handlePdfTool(): Promise<void> {
		if (!pdfFile) {
			onNotice({
				message: "Choose a PDF before running a PDF tool.",
				variant: "info",
			});
			return;
		}
		setPdfBusy(true);
		try {
			const result = await runPdfTool(pdfFile, pdfTool, {
				degrees: Number(pdfRotation),
				pages: pdfPages,
				watermark: pdfWatermark,
			});
			setPdfResult(result);
			onNotice({
				message: `${formatLabel(result.format)} PDF tool result is ready locally.`,
				variant: "success",
			});
		} catch (error: unknown) {
			onNotice({
				message:
					error instanceof Error
						? error.message
						: "The PDF tool failed locally.",
				variant: "error",
			});
		} finally {
			setPdfBusy(false);
		}
	}

	async function handleImageTool(): Promise<void> {
		if (!imageFile) {
			onNotice({
				message: "Choose an image before running the image tool.",
				variant: "info",
			});
			return;
		}
		setImageBusy(true);
		try {
			const cropOptions = toCrop(crop);
			const result = await convertFile(imageFile, imageTarget, {
				crop: cropOptions,
				imageQuality: Number(imageQuality) || 0.92,
				maxWidth: imageWidth.trim() ? Number(imageWidth) : null,
				rotation: Number(imageRotation),
				watermark: imageWatermark,
			});
			setImageResult(result);
			onNotice({
				message: `${result.fileName} is ready locally.`,
				variant: "success",
			});
		} catch (error: unknown) {
			onNotice({
				message:
					error instanceof Error
						? error.message
						: "The image tool failed locally.",
				variant: "error",
			});
		} finally {
			setImageBusy(false);
		}
	}

	return (
		<div className="convert-tools-view">
			<div className="convert-secondary-heading">
				<div>
					<p className="convert-eyebrow">LOCAL TOOLBOX</p>
					<h3>Reference workflows, owned locally.</h3>
					<p>
						PDF organization, image editing, and batch outputs run in this
						Companion. Nothing is sent to a hosted converter.
					</p>
				</div>
				<Badge variant="outline">
					<span className="convert-status-dot" />
					No Docker
				</Badge>
			</div>
			<div className="convert-tool-grid">
				<RyuAppSection className="convert-tool-card" title="PDF toolkit">
					<p className="convert-tool-description">
						Merge, split, extract, rotate, watermark, number, and re-save PDFs
						with pdf-lib in this browser.
					</p>
					<ToolFilePicker
						accept="application/pdf,.pdf"
						label="Choose PDF"
						onChange={setPdfFile}
					/>
					{pdfFile ? <FileSummary file={pdfFile} /> : null}
					<RyuAppField label="Operation">
						<NativeSelect
							onChange={(event) =>
								setPdfTool(event.currentTarget.value as PdfTool)
							}
							value={pdfTool}
						>
							<NativeSelectOption value="compress">
								Compress / optimize
							</NativeSelectOption>
							<NativeSelectOption value="split">
								Split every page
							</NativeSelectOption>
							<NativeSelectOption value="extract">
								Extract selected pages
							</NativeSelectOption>
							<NativeSelectOption value="rotate">
								Rotate pages
							</NativeSelectOption>
							<NativeSelectOption value="page-numbers">
								Add page numbers
							</NativeSelectOption>
							<NativeSelectOption value="watermark">
								Add watermark
							</NativeSelectOption>
						</NativeSelect>
					</RyuAppField>
					{pdfTool === "extract" ? (
						<RyuAppField description="Example: 1, 3-5" label="Pages">
							<Input
								onChange={(event) => setPdfPages(event.currentTarget.value)}
								placeholder="1, 3-5"
								value={pdfPages}
							/>
						</RyuAppField>
					) : null}
					{pdfTool === "rotate" ? (
						<RyuAppField label="Rotation">
							<NativeSelect
								onChange={(event) => setPdfRotation(event.currentTarget.value)}
								value={pdfRotation}
							>
								<NativeSelectOption value="90">
									90° clockwise
								</NativeSelectOption>
								<NativeSelectOption value="180">180°</NativeSelectOption>
								<NativeSelectOption value="270">
									270° clockwise
								</NativeSelectOption>
							</NativeSelect>
						</RyuAppField>
					) : null}
					{pdfTool === "watermark" ? (
						<RyuAppField label="Watermark">
							<Input
								onChange={(event) => setPdfWatermark(event.currentTarget.value)}
								placeholder="Private copy"
								value={pdfWatermark}
							/>
						</RyuAppField>
					) : null}
					<RyuAppActions>
						<Button
							disabled={pdfBusy}
							onClick={() => void handlePdfTool()}
							type="button"
						>
							{pdfBusy ? "Working…" : "Run PDF tool"}
						</Button>
						{pdfResult ? (
							<Button
								onClick={() => onDownloadResult(pdfResult)}
								type="button"
								variant="secondary"
							>
								Download {pdfResult.fileName}
							</Button>
						) : null}
					</RyuAppActions>
				</RyuAppSection>

				<RyuAppSection className="convert-tool-card" title="Image lab">
					<p className="convert-tool-description">
						The iLoveIMG-shaped core: resize, crop, rotate, compress, watermark,
						and convert raster/vector input with Canvas.
					</p>
					<ToolFilePicker
						accept="image/*,.svg,.avif,.webp"
						label="Choose image"
						onChange={setImageFile}
					/>
					{imageFile ? <FileSummary file={imageFile} /> : null}
					<div className="convert-tool-field-grid">
						<RyuAppField label="Output">
							<NativeSelect
								onChange={(event) =>
									setImageTarget(event.currentTarget.value as FormatId)
								}
								value={imageTarget}
							>
								<NativeSelectOption value="png">PNG</NativeSelectOption>
								<NativeSelectOption value="jpeg">JPEG</NativeSelectOption>
								<NativeSelectOption value="webp">WebP</NativeSelectOption>
								<NativeSelectOption value="avif">AVIF</NativeSelectOption>
								<NativeSelectOption value="pdf">PDF</NativeSelectOption>
							</NativeSelect>
						</RyuAppField>
						<RyuAppField label="Rotate">
							<NativeSelect
								onChange={(event) =>
									setImageRotation(event.currentTarget.value)
								}
								value={imageRotation}
							>
								<NativeSelectOption value="0">0°</NativeSelectOption>
								<NativeSelectOption value="90">90°</NativeSelectOption>
								<NativeSelectOption value="180">180°</NativeSelectOption>
								<NativeSelectOption value="270">270°</NativeSelectOption>
							</NativeSelect>
						</RyuAppField>
					</div>
					<div className="convert-tool-field-grid">
						<RyuAppField
							description="Leave blank to keep width"
							label="Max width"
						>
							<Input
								inputMode="numeric"
								onChange={(event) =>
									setImageWidth(
										event.currentTarget.value.replace(/[^0-9]/gu, "")
									)
								}
								placeholder="Original"
								value={imageWidth}
							/>
						</RyuAppField>
						<RyuAppField description="0.10 to 1.00" label="Quality">
							<Input
								max="1"
								min="0.1"
								onChange={(event) => setImageQuality(event.currentTarget.value)}
								step="0.01"
								type="number"
								value={imageQuality}
							/>
						</RyuAppField>
					</div>
					<RyuAppField
						description="Optional pixel rectangle: x, y, width, height"
						label="Crop"
					>
						<div className="convert-crop-grid">
							{(["x", "y", "width", "height"] as const).map((key) => (
								<Input
									aria-label={`Crop ${key}`}
									inputMode="numeric"
									key={key}
									onChange={(event) =>
										setCrop((current) => ({
											...current,
											[key]: event.currentTarget.value.replace(/[^0-9]/gu, ""),
										}))
									}
									placeholder={key}
									value={crop[key]}
								/>
							))}
						</div>
					</RyuAppField>
					<RyuAppField label="Watermark">
						<Input
							onChange={(event) => setImageWatermark(event.currentTarget.value)}
							placeholder="Optional text"
							value={imageWatermark}
						/>
					</RyuAppField>
					<RyuAppActions>
						<Button
							disabled={imageBusy}
							onClick={() => void handleImageTool()}
							type="button"
						>
							{imageBusy ? "Working…" : "Run image tool"}
						</Button>
						{imageResult ? (
							<Button
								onClick={() => onDownloadResult(imageResult)}
								type="button"
								variant="secondary"
							>
								Download {imageResult.fileName}
							</Button>
						) : null}
					</RyuAppActions>
				</RyuAppSection>
			</div>

			<RyuAppSection className="convert-parity-matrix" title="Coverage matrix">
				<div className="convert-parity-grid">
					<ParityCard
						detail="Merge · split · extract · rotate · compress · watermark · page numbers · selectable text/Markdown"
						label="PDF workflows"
						value="Browser local"
					/>
					<ParityCard
						detail="Resize · crop · rotate · quality · watermark · PNG/JPEG/WebP/AVIF/PDF"
						label="Image workflows"
						value="Browser local"
					/>
					<ParityCard
						detail="Inspect ZIP manifests and bundle completed outputs without unpacking off-device"
						label="Archive workflows"
						value="Browser local"
					/>
					<ParityCard
						detail="Mediabunny: MP4 · MOV · MKV · WebM · WAV · MP3 · Ogg · FLAC · AAC · MPEG-TS"
						label="Media workflows"
						value="Codec-dependent"
					/>
					<ParityCard
						detail="Accepted formats are visible; faithful conversion needs a local office, OCR, or ebook engine"
						label="Office / OCR / ebook"
						value="Input-aware"
					/>
					<ParityCard
						detail="Protect, unlock, sign, redact, forms, compare, repair, and OCR need local PDF/security engines"
						label="PDF security / OCR"
						value="Engine needed"
					/>
					<ParityCard
						detail="PDF to Word/PowerPoint/Excel, PDF/A, and EPUB fidelity need a local office or ebook engine"
						label="Office / ebook fidelity"
						value="Engine needed"
					/>
					<ParityCard
						detail="Background removal, AI upscale, face detection, HTML capture, and model effects are not faked"
						label="Image AI / advanced"
						value="Model needed"
					/>
				</div>
			</RyuAppSection>
		</div>
	);
}

function ToolFilePicker({
	accept,
	label,
	onChange,
}: {
	accept: string;
	label: string;
	onChange: (file: File | null) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<div className="convert-tool-picker">
			<input
				accept={accept}
				aria-hidden="true"
				className="convert-file-input"
				onChange={(event) => {
					onChange(event.currentTarget.files?.[0] ?? null);
					event.currentTarget.value = "";
				}}
				ref={inputRef}
				tabIndex={-1}
				type="file"
			/>
			<Button
				onClick={() => inputRef.current?.click()}
				type="button"
				variant="outline"
			>
				{label}
			</Button>
		</div>
	);
}

function FileSummary({ file }: { file: File }) {
	return (
		<div className="convert-tool-file">
			<strong>{file.name}</strong>
			<span>
				{fileExtension(file.name).toUpperCase()} · {formatFileSize(file.size)}
			</span>
		</div>
	);
}

function ParityCard({
	detail,
	label,
	value,
}: {
	detail: string;
	label: string;
	value: string;
}) {
	return (
		<div className="convert-parity-card">
			<div>
				<strong>{label}</strong>
				<Badge variant="outline">{value}</Badge>
			</div>
			<p>{detail}</p>
		</div>
	);
}

function toCrop(crop: {
	height: string;
	width: string;
	x: string;
	y: string;
}): ImageCrop | null {
	if (!(crop.x || crop.y || crop.width || crop.height)) {
		return null;
	}
	return {
		height: Number(crop.height) || 1,
		width: Number(crop.width) || 1,
		x: Number(crop.x) || 0,
		y: Number(crop.y) || 0,
	};
}
