import type { Editor } from "obsidian";

/**
 * Text fields inside an element with this class never trigger chords
 */
export const NO_CHORDS_CLASS = "chords-disabled";

/**
 * A place where text was just typed and where a chord can replace it
 */
export interface TextTarget {
	/**
	 * The Obsidian editor, if the target is a Markdown editor
	 */
	readonly editor: Editor | null;

	/**
	 * Checks that `input` is the text directly before the cursor,
	 * so the chord only removes what the user actually typed
	 */
	hasInputBeforeCursor(input: string): boolean;

	/**
	 * Replaces `input` directly before the cursor with `text`
	 * @param input text typed by the user to trigger the chord
	 * @param text replacement text
	 * @param cursorOffset where to place the cursor, relative to the start of text. Defaults to the end of text
	 * @returns where more text can be inserted later, e.g. after an async read
	 */
	replaceInput(input: string, text?: string, cursorOffset?: number): InsertionPoint;
}

/**
 * A remembered position in a TextTarget
 */
export interface InsertionPoint {
	/**
	 * Inserts text at this point
	 * @param text text to insert
	 * @param cursorOffset where to place the cursor, relative to the start of text. Defaults to the end of text
	 */
	insert(text: string, cursorOffset?: number): void;
}

/**
 * Converts text for single-line fields, replacing line breaks with spaces
 * @param text text to convert
 * @param cursorOffset cursor offset in text
 * @returns converted text and the matching cursor offset
 */
export function toSingleLine(text: string, cursorOffset: number): { text: string; cursorOffset: number } {
	const singleLine = (s: string) => s.replace(/\r?\n/g, " ");
	return {
		text: singleLine(text),
		cursorOffset: singleLine(text.slice(0, cursorOffset)).length,
	};
}
