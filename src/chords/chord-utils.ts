import type { Editor, EditorPosition } from "obsidian";

/**
 * Normalizes a chord trigger so that key order doesn't matter ("hew", "weh" -> "ehw")
 * @param key chord trigger or user input
 * @returns the characters of key in sorted order
 */
export function normalizeKey(key: string): string {
	return key.split("").sort().join("");
}

/**
 * Replaces the user input directly before the cursor
 * @param editor editor for active file
 * @param key user input to replace
 * @param replacement text to replace key with
 * @returns position where the replacement starts
 */
export function replaceKeyInput(editor: Editor, key: string, replacement = ""): EditorPosition {
	const cursor = editor.getCursor();
	const from: EditorPosition = { line: cursor.line, ch: Math.max(0, cursor.ch - key.length) };

	editor.replaceRange(replacement, from, cursor);

	return from;
}

/**
 * Inserts text at a position and places the cursor inside it
 * @param editor editor for active file
 * @param from position to insert at
 * @param text text to insert
 * @param cursorOffset cursor position relative to the start of text, defaults to the end of text
 */
export function insertAt(editor: Editor, from: EditorPosition, text: string, cursorOffset = text.length): void {
	editor.replaceRange(text, from);
	setCursorAtOffset(editor, from, cursorOffset);
}

/**
 * Moves the cursor a number of characters past a position, spanning lines if needed
 * @param editor editor for active file
 * @param from starting position
 * @param offset number of characters past from
 */
export function setCursorAtOffset(editor: Editor, from: EditorPosition, offset: number): void {
	editor.setCursor(editor.offsetToPos(editor.posToOffset(from) + offset));
}
