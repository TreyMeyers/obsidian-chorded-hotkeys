import { describe, expect, it } from "vitest";
import { parseTextChord } from "./text-chord";

describe("parseTextChord", () => {
	it("places the cursor at the end when there is no cursor tag", () => {
		expect(parseTextChord("Hello World")).toEqual({ text: "Hello World", cursorOffset: 11 });
	});

	it("places the cursor at the cursor tag and removes it", () => {
		expect(parseTextChord("**{c}**")).toEqual({ text: "****", cursorOffset: 2 });
	});

	it("uses the first cursor tag and removes later ones", () => {
		expect(parseTextChord("a{c}b{c}c")).toEqual({ text: "abc", cursorOffset: 1 });
	});

	it("treats an escaped cursor tag as literal text", () => {
		expect(parseTextChord("\\{c}x{c}")).toEqual({ text: "{c}x", cursorOffset: 4 });
	});

	it("unescapes double backslashes without affecting a following cursor tag", () => {
		expect(parseTextChord("a\\\\{c}b")).toEqual({ text: "a\\b", cursorOffset: 2 });
	});

	it("only counts escapes before the cursor in the offset", () => {
		expect(parseTextChord("{c}\\\\")).toEqual({ text: "\\", cursorOffset: 0 });
	});

	it("keeps newlines in the text", () => {
		expect(parseTextChord("line 1\n{c}line 2")).toEqual({ text: "line 1\nline 2", cursorOffset: 7 });
	});
});
