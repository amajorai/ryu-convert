import type { HostServices, RpcJsonResponse } from "@ryu/app-host/rpc";
import { z } from "zod";
export type ConvertHostInput =
	| RpcJsonResponse
	| Parameters<NonNullable<HostServices["uiToastShow"]>>[0];

export interface HostCall {
	input: RpcJsonResponse;
	method: string;
}
export interface DownloadAttempt {
	body: number[];
	filename: string;
	href: string;
}
export interface ConvertFixture {
	calls: HostCall[];
	downloads: DownloadAttempt[];
	getStored(namespace: string, key: string): string | null;
	toasts: HostCall[];
}
export const convertDownloadMessageSchema = z.object({
	type: z.literal("convert-download"),
	body: z
		.array(z.number().int().nullable().catch(null))
		.transform((values) =>
			values.filter((value): value is number => value !== null)
		),
	filename: z.string(),
	href: z.string(),
});
