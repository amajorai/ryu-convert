export {};

declare global {
	interface Window {
		ryu?: {
			context?: { view?: string } | null;
			storage?: {
				get(input: { key: string; namespace?: string }): Promise<string | null>;
				set(input: {
					key: string;
					namespace?: string;
					value: string;
				}): Promise<void>;
			};
			ui?: {
				toast?: {
					show(input: {
						title: string;
						variant?: "info" | "success" | "error";
					}): Promise<unknown>;
				};
			};
		};
	}
}
