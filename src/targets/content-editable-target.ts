import { InsertionPoint, TextTarget, toSingleLine } from "./text-target";

/**
 * A contenteditable element that isn't a CodeMirror editor, e.g. the inline title or a property value
 */
export class ContentEditableTarget implements TextTarget {
	public readonly editor = null;

	private constructor(private readonly el: HTMLElement) { }

	/**
	 * @param el focused element
	 * @returns a target, or null if el isn't editable plain text
	 */
	public static from(el: HTMLElement): ContentEditableTarget | null {
		// CodeMirror owns its DOM; editing it directly would desync the editor state
		if (!el.isContentEditable || el.closest(".cm-editor")) return null;

		return new ContentEditableTarget(el);
	}

	public hasInputBeforeCursor(input: string): boolean {
		const caret = this.getCaret();
		return caret !== null && (caret.node.textContent ?? "").slice(0, caret.offset).endsWith(input);
	}

	public replaceInput(input: string, text = "", cursorOffset = text.length): InsertionPoint {
		const doc = this.el.ownerDocument;
		const caret = this.getCaret();
		if (!caret) return { insert: () => { } };

		const range = doc.createRange();
		range.setStart(caret.node, Math.max(0, caret.offset - input.length));
		range.setEnd(caret.node, caret.offset);
		range.deleteContents();

		const textNode = this.insertText(range, text, cursorOffset);

		return {
			insert: (insertText, insertCursorOffset = insertText.length) => {
				const insertRange = doc.createRange();
				insertRange.setStart(textNode, textNode.length);
				this.insertText(insertRange, insertText, insertCursorOffset);
			},
		};
	}

	/**
	 * Inserts text at a collapsed range, moves the caret, and notifies listeners
	 * @returns the inserted text node
	 */
	private insertText(range: Range, text: string, cursorOffset: number): Text {
		({ text, cursorOffset } = toSingleLine(text, cursorOffset));

		const textNode = this.el.ownerDocument.createTextNode(text);
		range.insertNode(textNode);

		const selection = this.el.ownerDocument.getSelection();
		selection?.collapse(textNode, cursorOffset);

		this.el.dispatchEvent(new Event("input", { bubbles: true }));

		return textNode;
	}

	/**
	 * @returns the collapsed caret position within this element, if it's inside a text node
	 */
	private getCaret(): { node: Text; offset: number } | null {
		const selection = this.el.ownerDocument.getSelection();
		if (!selection?.isCollapsed) return null;

		const node = selection.anchorNode;
		if (!node || node.nodeType !== Node.TEXT_NODE || !this.el.contains(node)) return null;

		return { node: node as Text, offset: selection.anchorOffset };
	}
}
