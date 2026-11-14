import type { ChordContext } from "./chord-types";
import { replaceKeyInput, setCursorAtOffset } from "./chord-utils";

const CURSOR_TAG = "{c}";

/**
 * Replaces the user input with the chord's text
 * @param context chord context
 * @param key user input to trigger the chord
 * @param value text to insert, may contain tags
 */
export default function execute({ editor }: ChordContext, key: string, value: string): void {
	const { text, cursorOffset } = parseTextChord(value);

	const from = replaceKeyInput(editor, key, text);
	setCursorAtOffset(editor, from, cursorOffset);
}

/**
 * Resolves the tags in a text chord's value:
 * - `{c}` marks where the cursor is placed (first occurrence only, later ones are removed)
 * - `\{c}` inserts a literal `{c}`
 * - `\\` inserts a literal `\`
 * @param value text chord value
 * @returns text to insert and the cursor offset from the start of that text
 */
export function parseTextChord(value: string): { text: string; cursorOffset: number } {
	let text = "";
	let cursorOffset: number | null = null;
	let i = 0;

	while (i < value.length) {
		if (value.startsWith("\\\\", i)) {
			text += "\\";
			i += 2;
		} else if (value.startsWith("\\" + CURSOR_TAG, i)) {
			text += CURSOR_TAG;
			i += 1 + CURSOR_TAG.length;
		} else if (value.startsWith(CURSOR_TAG, i)) {
			cursorOffset ??= text.length;
			i += CURSOR_TAG.length;
		} else {
			text += value[i];
			i += 1;
		}
	}

	return { text, cursorOffset: cursorOffset ?? text.length };
}
