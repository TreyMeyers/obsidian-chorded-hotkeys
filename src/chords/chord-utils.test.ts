import { describe, expect, it } from "vitest";
import { normalizeKey } from "./chord-utils";

describe("normalizeKey", () => {
	it("makes key order irrelevant", () => {
		expect(normalizeKey("hew")).toBe(normalizeKey("weh"));
		expect(normalizeKey("hew")).toBe("ehw");
	});

	it("is case sensitive", () => {
		expect(normalizeKey("Ab")).not.toBe(normalizeKey("ab"));
	});

	it("handles empty input", () => {
		expect(normalizeKey("")).toBe("");
	});
});
