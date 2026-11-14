import { describe, expect, it } from "vitest";
import { resolveCursorMarkers } from "./templater-cursor";

describe("resolveCursorMarkers", () => {
	it("places the cursor at the end when there are no markers", () => {
		expect(resolveCursorMarkers("abc")).toEqual({ text: "abc", cursorOffset: 3 });
	});

	it("removes a marker and places the cursor there", () => {
		expect(resolveCursorMarkers("**Def**: <% tp.file.cursor() %>!")).toEqual({ text: "**Def**: !", cursorOffset: 9 });
	});

	it("jumps to the lowest-order marker and removes the others", () => {
		expect(resolveCursorMarkers("a<%tp.file.cursor(2)%>b<% tp.file.cursor(1) %>c")).toEqual({ text: "abc", cursorOffset: 2 });
	});

	it("treats an unnumbered marker as order 0", () => {
		expect(resolveCursorMarkers("a<% tp.file.cursor(1) %>b<% tp.file.cursor() %>c")).toEqual({ text: "abc", cursorOffset: 2 });
	});
});
