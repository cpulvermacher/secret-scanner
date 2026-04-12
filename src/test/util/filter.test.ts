import { describe, it, expect } from "vitest";
import { filterWithReason } from "../../util/filter";
import type { SecretResult } from "../../util/tabdata";

function makeSecret(source: string): SecretResult {
	return {
		type: "API Key",
		pattern: "api_key",
		match: "api_key: 'secret'",
		severity: "medium",
		source,
		timestamp: "2026-01-01T00:00:00.000Z",
	};
}

describe("filterWithReason", () => {
	it("returns null for a regular https source", () => {
		expect(filterWithReason(makeSecret("https://example.com/app.js"))).toBeNull();
	});

	it("returns null for an http source", () => {
		expect(filterWithReason(makeSecret("http://localhost:3000/bundle.js"))).toBeNull();
	});

	it("filters out chrome extension sources", () => {
		expect(
			filterWithReason(makeSecret("chrome-extension://abcdefghijklmnop/background.js"))
		).toBe("extension");
	});

	it("filters out firefox extension sources", () => {
		expect(
			filterWithReason(makeSecret("moz-extension://12345678-1234-1234-1234-123456789abc/popup.js"))
		).toBe("extension");
	});

	it("does not filter a source that merely contains chrome-extension:// later in the string", () => {
		expect(
			filterWithReason(makeSecret("https://example.com/chrome-extension://fake"))
		).toBeNull();
	});
});
