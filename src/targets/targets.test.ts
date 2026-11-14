// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { getTextTarget } from "./get-text-target";
import { InputTarget } from "./input-target";
import { ContentEditableTarget } from "./content-editable-target";
import { NO_CHORDS_CLASS, toSingleLine } from "./text-target";

const appWithoutEditor = { workspace: { activeEditor: null } } as unknown as App;

function keydownOn(el: HTMLElement): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { key: "a" });
	Object.defineProperty(event, "target", { value: el });
	return event;
}

function createInput(value: string, caret = value.length, tag: "input" | "textarea" = "input"): HTMLInputElement | HTMLTextAreaElement {
	const el = document.createElement(tag);
	document.body.appendChild(el);
	el.value = value;
	el.setSelectionRange(caret, caret);
	return el;
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("toSingleLine", () => {
	it("replaces line breaks and keeps the cursor on the same character", () => {
		expect(toSingleLine("a\r\nb\nc", 4)).toEqual({ text: "a b c", cursorOffset: 3 });
	});
});

describe("getTextTarget", () => {
	it("returns null outside the editor when disabled", () => {
		expect(getTextTarget(appWithoutEditor, keydownOn(createInput("x") as HTMLElement), false)).toBeNull();
	});

	it("accepts text and search inputs and textareas", () => {
		const search = createInput("x");
		(search as HTMLInputElement).type = "search";
		expect(getTextTarget(appWithoutEditor, keydownOn(search), true)).toBeInstanceOf(InputTarget);
		expect(getTextTarget(appWithoutEditor, keydownOn(createInput("x", 1, "textarea")), true)).toBeInstanceOf(InputTarget);
	});

	it("rejects password and number inputs", () => {
		for (const type of ["password", "number", "checkbox"]) {
			const el = document.createElement("input");
			el.type = type;
			expect(getTextTarget(appWithoutEditor, keydownOn(el), true)).toBeNull();
		}
	});

	it("rejects read-only inputs", () => {
		const el = createInput("x") as HTMLInputElement;
		el.readOnly = true;
		expect(getTextTarget(appWithoutEditor, keydownOn(el), true)).toBeNull();
	});

	it("rejects contenteditable inside a CodeMirror editor", () => {
		const editor = document.createElement("div");
		editor.className = "cm-editor";
		const content = editor.appendChild(document.createElement("div"));
		content.contentEditable = "true";
		Object.defineProperty(content, "isContentEditable", { value: true });
		expect(getTextTarget(appWithoutEditor, keydownOn(content), true)).toBeNull();
	});

	it("rejects fields inside an element with the no-chords class", () => {
		const container = document.createElement("div");
		container.className = NO_CHORDS_CLASS;
		document.body.appendChild(container);
		const el = container.appendChild(document.createElement("input"));
		expect(getTextTarget(appWithoutEditor, keydownOn(el), true)).toBeNull();
	});

	it("rejects non-editable elements", () => {
		expect(getTextTarget(appWithoutEditor, keydownOn(document.createElement("div")), true)).toBeNull();
	});
});

describe("InputTarget", () => {
	it("checks the text directly before the caret", () => {
		const target = InputTarget.from(createInput("say hew there", 7))!;
		expect(target.hasInputBeforeCursor("hew")).toBe(true);
		expect(target.hasInputBeforeCursor("weh")).toBe(false);
	});

	it("replaces the input, places the cursor, and fires an input event", () => {
		const el = createInput("say hew there", 7);
		const onInput = vi.fn();
		el.addEventListener("input", onInput);

		InputTarget.from(el)!.replaceInput("hew", "**bold**", 2);

		expect(el.value).toBe("say **bold** there");
		expect(el.selectionStart).toBe(6);
		expect(onInput).toHaveBeenCalledOnce();
	});

	it("inserts later at the insertion point", () => {
		const el = createInput("say hew", 7);
		const point = InputTarget.from(el)!.replaceInput("hew");

		el.setSelectionRange(0, 0);
		point.insert("hello");

		expect(el.value).toBe("say hello");
		expect(el.selectionStart).toBe(9);
	});

	it("flattens line breaks in single-line inputs only", () => {
		const input = createInput("ab", 2);
		InputTarget.from(input)!.replaceInput("ab", "1\n2");
		expect(input.value).toBe("1 2");

		const textarea = createInput("ab", 2, "textarea");
		InputTarget.from(textarea)!.replaceInput("ab", "1\n2");
		expect(textarea.value).toBe("1\n2");
	});
});

describe("ContentEditableTarget", () => {
	function createEditable(text: string, caret: number): HTMLElement {
		const el = document.createElement("div");
		el.contentEditable = "true";
		Object.defineProperty(el, "isContentEditable", { value: true });
		el.textContent = text;
		document.body.appendChild(el);
		document.getSelection()!.collapse(el.firstChild, caret);
		return el;
	}

	it("replaces the input before the caret and places the cursor", () => {
		const el = createEditable("My hew title", 6);
		const target = ContentEditableTarget.from(el)!;

		expect(target.hasInputBeforeCursor("hew")).toBe(true);
		target.replaceInput("hew", "new", 1);

		expect(el.textContent).toBe("My new title");
		const selection = document.getSelection()!;
		expect(selection.anchorNode?.textContent).toBe("new");
		expect(selection.anchorOffset).toBe(1);
	});

	it("inserts later after the replaced text", () => {
		const el = createEditable("ab", 2);
		const point = ContentEditableTarget.from(el)!.replaceInput("ab");
		point.insert("xyz");
		expect(el.textContent).toBe("xyz");
	});
});
