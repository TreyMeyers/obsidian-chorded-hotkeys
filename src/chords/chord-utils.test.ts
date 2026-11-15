import { describe, expect, it } from "vitest";
import { dropIndex, isChordActive, matchesChordFilter, moveItem, normalizeKey } from "./chord-utils";

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

describe("isChordActive", () => {
	it("treats chords saved without the flag as enabled", () => {
		expect(isChordActive({})).toBe(true);
		expect(isChordActive({ enabled: true })).toBe(true);
	});

	it("is false for a chord that's turned off", () => {
		expect(isChordActive({ enabled: false })).toBe(false);
	});
});

describe("moveItem", () => {
	it("moves an item down", () => {
		const items = ["a", "b", "c", "d"];
		moveItem(items, 0, 2);
		expect(items).toEqual(["b", "c", "a", "d"]);
	});

	it("moves an item up", () => {
		const items = ["a", "b", "c", "d"];
		moveItem(items, 3, 1);
		expect(items).toEqual(["a", "d", "b", "c"]);
	});

	it("ignores positions outside the array", () => {
		const items = ["a", "b"];
		moveItem(items, 0, 2);
		moveItem(items, -1, 0);
		expect(items).toEqual(["a", "b"]);
	});
});

describe("dropIndex", () => {
	it("accounts for the dragged item leaving its old position", () => {
		expect(dropIndex(0, 2, false)).toBe(1);
		expect(dropIndex(0, 2, true)).toBe(2);
	});

	it("drops before or after an earlier item", () => {
		expect(dropIndex(3, 1, false)).toBe(1);
		expect(dropIndex(3, 1, true)).toBe(2);
	});

	it("stays put when dropped next to itself", () => {
		expect(dropIndex(1, 1, false)).toBe(1);
		expect(dropIndex(1, 1, true)).toBe(1);
		expect(dropIndex(1, 0, true)).toBe(1);
		expect(dropIndex(1, 2, false)).toBe(1);
	});
});

describe("matchesChordFilter", () => {
	const chord = { key: "sav", value: "Save current file" };

	it("matches key, value and type, ignoring case in the chord", () => {
		expect(matchesChordFilter(chord, "Command", "sav")).toBe(true);
		expect(matchesChordFilter(chord, "Command", "current")).toBe(true);
		expect(matchesChordFilter(chord, "Command", "comm")).toBe(true);
		expect(matchesChordFilter(chord, "Command", "template")).toBe(false);
	});

	it("matches everything when the filter is empty", () => {
		expect(matchesChordFilter({ key: "", value: "" }, "Text", "")).toBe(true);
	});
});
