import { describe, expect, it } from "vitest";
import { delayToWpm, parsePositiveNumber, wpmToDelay } from "./settings";

describe("delay conversion", () => {
	it("round-trips between wpm and delay", () => {
		expect(delayToWpm(wpmToDelay(80))).toBeCloseTo(80);
	});

	it("gives a shorter delay for faster typists", () => {
		expect(wpmToDelay(120)).toBeLessThan(wpmToDelay(60));
	});
});

describe("parsePositiveNumber", () => {
	it.each([
		["80", 80],
		[" 27.5 ", 27.5],
	])("parses %j", (input, expected) => {
		expect(parsePositiveNumber(input)).toBe(expected);
	});

	it.each(["", " ", "0", "-5", "abc", "Infinity"])("rejects %j", input => {
		expect(parsePositiveNumber(input)).toBeNull();
	});
});
