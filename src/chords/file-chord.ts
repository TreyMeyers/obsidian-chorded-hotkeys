import { Notice, normalizePath } from "obsidian";
import type { ChordContext } from "./chord-types";

/**
 * Removes the user input and pastes the content of a file
 * @param context chord context
 * @param input user input that triggered the chord
 * @param path file path
 */
export default async function execute({ app, target }: ChordContext, input: string, path: string): Promise<void> {
	// Remove the input synchronously so it's gone before the user types anything else
	const insertionPoint = target.replaceInput(input);

	const file = app.vault.getFileByPath(normalizePath(path));
	if (!file) {
		new Notice(`File not found for chord: ${path}`);
		return;
	}

	const content = await app.vault.cachedRead(file);
	insertionPoint.insert(content);
}
