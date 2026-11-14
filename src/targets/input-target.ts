import { InsertionPoint, TextTarget, toSingleLine } from "./text-target";

type TextField = HTMLInputElement | HTMLTextAreaElement;

/**
 * Input types whose value is free text that chords may edit
 */
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", ""]);

/**
 * A plain `<input>` or `<textarea>`, e.g. the search pane, the command palette, or a settings field
 */
export class InputTarget implements TextTarget {
	public readonly editor = null;

	private constructor(private readonly el: TextField) { }

	/**
	 * @param el focused element
	 * @returns a target, or null if el isn't a free text field (passwords, numbers, checkboxes, ...)
	 */
	public static from(el: TextField): InputTarget | null {
		if (el.readOnly || el.disabled) return null;
		if (el.tagName === "INPUT" && !TEXT_INPUT_TYPES.has((el as HTMLInputElement).type)) return null;

		return new InputTarget(el);
	}

	public hasInputBeforeCursor(input: string): boolean {
		const { selectionStart, selectionEnd, value } = this.el;
		if (selectionStart === null || selectionStart !== selectionEnd) return false;

		return value.slice(0, selectionStart).endsWith(input);
	}

	public replaceInput(input: string, text = "", cursorOffset = text.length): InsertionPoint {
		const end = this.el.selectionStart ?? this.el.value.length;
		const start = Math.max(0, end - input.length);

		const insertedLength = this.replaceRange(start, end, text, cursorOffset);

		const insertionIndex = start + insertedLength;
		return {
			insert: (insertText, insertCursorOffset = insertText.length) => {
				this.replaceRange(insertionIndex, insertionIndex, insertText, insertCursorOffset);
			},
		};
	}

	/**
	 * Replaces a range of the value, moves the cursor, and notifies listeners
	 * @returns length of the text that was inserted
	 */
	private replaceRange(start: number, end: number, text: string, cursorOffset: number): number {
		if (this.el.tagName === "INPUT") {
			({ text, cursorOffset } = toSingleLine(text, cursorOffset));
		}

		this.el.setRangeText(text, start, end);
		this.el.setSelectionRange(start + cursorOffset, start + cursorOffset);

		// Programmatic changes don't fire input events; Obsidian's search and settings fields rely on them
		this.el.dispatchEvent(new Event("input", { bubbles: true }));

		return text.length;
	}
}
