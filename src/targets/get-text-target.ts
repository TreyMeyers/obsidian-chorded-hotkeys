import type { App } from "obsidian";
import { ContentEditableTarget } from "./content-editable-target";
import { EditorTarget } from "./editor-target";
import { InputTarget } from "./input-target";
import { NO_CHORDS_CLASS, TextTarget } from "./text-target";

/**
 * Finds where a key event is typing text
 * @param app app instance
 * @param event keydown event
 * @param includeNonEditor if text fields outside the Markdown editor (search, inputs, titles, ...) are allowed
 * @returns the target, or null if the event isn't typing into supported text
 */
export function getTextTarget(app: App, event: KeyboardEvent, includeNonEditor: boolean): TextTarget | null {
	const editor = app.workspace.activeEditor?.editor;
	if (editor?.hasFocus()) {
		return new EditorTarget(editor);
	}

	if (!includeNonEditor) return null;

	// Compare tag names rather than using instanceof: elements in popout windows
	// belong to a different window, so instanceof checks against this window's classes fail
	const el = event.target as HTMLElement | null;
	if (!el?.tagName || el.closest(`.${NO_CHORDS_CLASS}`)) return null;

	switch (el.tagName) {
		case "INPUT":
		case "TEXTAREA":
			return InputTarget.from(el as HTMLInputElement | HTMLTextAreaElement);
		default:
			return ContentEditableTarget.from(el);
	}
}
