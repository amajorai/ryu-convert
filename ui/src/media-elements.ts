export {};

declare global {
	interface HTMLMediaElement {
		captureStream?(): MediaStream;
		mozCaptureStream?(): MediaStream;
	}
}
