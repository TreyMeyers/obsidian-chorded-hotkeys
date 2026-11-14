import type { Editor, EditorPosition } from "obsidian";
import type { InsertionPoint, TextTarget } from "./text-target";

/**
 * A Markdown editor, edited through Obsidian's Editor API
 */
export class EditorTarget implements TextTarget {
	public constructor(public readonly editor: Editor) { }

	public hasInputBeforeCursor(input: string): boolean {
		const cursor = this.editor.getCursor();
		if (cursor.ch < input.length) return false;

		return this.editor.getRange({ line: cursor.line, ch: cursor.ch - input.length }, cursor) === input;
	}

	public replaceInput(input: string, text = "", cursorOffset = text.length): InsertionPoint {
		const cursor = this.editor.getCursor();
		const from: EditorPosition = { line: cursor.line, ch: Math.max(0, cursor.ch - input.length) };

		this.editor.replaceRange(text, from, cursor);
		this.setCursorAtOffset(from, cursorOffset);

		// Track the insertion point as an offset so it stays valid across line breaks in text
		const insertionOffset = this.editor.posToOffset(from) + text.length;
		return {
			insert: (insertText, insertCursorOffset = insertText.length) => {
				const at = this.editor.offsetToPos(insertionOffset);
				this.editor.replaceRange(insertText, at);
				this.setCursorAtOffset(at, insertCursorOffset);
			},
		};
	}

	private setCursorAtOffset(from: EditorPosition, offset: number): void {
		this.editor.setCursor(this.editor.offsetToPos(this.editor.posToOffset(from) + offset));
	}
}
