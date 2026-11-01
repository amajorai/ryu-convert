import { z } from "zod";

export const storedFormatIdSchema = z.string();
export type StoredFormatId = z.output<typeof storedFormatIdSchema>;
export const conversionNumberSchema = z.union([
	z.number(),
	z.literal(Number.POSITIVE_INFINITY),
	z.literal(Number.NEGATIVE_INFINITY),
]);
export type ConvertJsonValue =
	| string
	| number
	| boolean
	| null
	| ConvertJsonValue[]
	| { [key: string]: ConvertJsonValue };
const fileJsonFields: z.ZodType<ConvertJsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		conversionNumberSchema,
		z.boolean(),
		z.null(),
		z.array(fileJsonFields),
		jsonRecordFields,
	])
);
const jsonRecordFields: z.ZodType<Record<string, ConvertJsonValue>> = z.custom<
	Record<string, ConvertJsonValue>
>(
	(value) =>
		z.record(z.string(), fileJsonFields).safeParse(value).success &&
		Object.values(value ?? {}).every(
			(entry) => fileJsonFields.safeParse(entry).success
		)
);
export const convertedJsonSchema = z.custom<ConvertJsonValue>(
	(value) => fileJsonFields.safeParse(value).success
);
const historyItemFields = z.object({
	completedAt: z.string(),
	id: z.string(),
	name: z.string(),
	size: conversionNumberSchema,
	source: z.string(),
	target: storedFormatIdSchema,
});
export type HistoryItem = z.output<typeof historyItemFields>;
export const historyRowsSchema = z
	.array(
		z
			.custom<HistoryItem>(
				(value) => historyItemFields.safeParse(value).success
			)
			.nullable()
			.catch(null)
	)
	.catch([]);
export const jsonObjectSchema = jsonRecordFields;
export const conversionOperationErrorSchema = z
	.instanceof(Error)
	.nullable()
	.catch(null);
export type ConversionOperationError = z.output<
	typeof conversionOperationErrorSchema
>;

export const imageFormatSchema = z.enum(["avif", "jpeg", "png", "webp"]);
export const imageToolOutputSchema = imageFormatSchema.or(z.literal("pdf"));
export type ImageToolOutput = z.output<typeof imageToolOutputSchema>;

export const convertViewSchema = z.enum([
	"convert",
	"history",
	"formats",
	"tools",
]);
export const pdfToolSchema = z.enum([
	"compress",
	"extract",
	"page-numbers",
	"rotate",
	"split",
	"watermark",
]);

export const sliderQualitySchema = z
	.union([conversionNumberSchema, z.array(conversionNumberSchema)])
	.transform((value) => (Array.isArray(value) ? value[0] : value))
	.or(z.undefined())
	.catch(undefined);
