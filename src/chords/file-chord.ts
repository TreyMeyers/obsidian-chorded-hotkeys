import { Notice, normalizePath } from "obsidian";
import type { ChordContext } from "./chord-types";
import { insertAt, replaceKeyInput } from "./chord-utils";

/**
 * Removes the user input and pastes the content of a file
 * @param context chord context
 * @param key user input to trigger the chord
 * @param path file path
 */
export default async function execute({ app, editor }: ChordContext, key: string, path: string): Promise<void> {
	// Remove the input synchronously so it's gone before the user types anything else
	const from = replaceKeyInput(editor, key);

	const file = app.vault.getFileByPath(normalizePath(path));
	if (!file) {
		new Notice(`File not found for chord: ${path}`);
		return;
	}

	const content = await app.vault.cachedRead(file);
	insertAt(editor, from, content);
}
