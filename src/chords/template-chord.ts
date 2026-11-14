import { Notice, TFile, normalizePath } from "obsidian";
import type { ChordContext } from "./chord-types";
import { insertAt, replaceKeyInput } from "./chord-utils";

export const TEMPLATER_ID = "templater-obsidian";

/**
 * Templater's RunMode.DynamicProcessor
 */
const RUN_MODE_DYNAMIC_PROCESSOR = 4;

/**
 * The parts of Templater's internals used here. Templater has no public API,
 * so every member is optional and checked before use.
 */
interface TemplaterPlugin {
	settings?: { auto_jump_to_cursor?: boolean };
	templater?: {
		create_running_config?(templateFile: TFile, targetFile: TFile, runMode: number): unknown;
		parse_template?(config: unknown, content: string): Promise<string>;
	};
	editor_handler?: {
		cursor_jumper?: { jump_to_next_cursor_location?(): Promise<void> };
	};
}

/**
 * Removes the user input and pastes the content of a template, evaluated by Templater
 * @param context chord context
 * @param key user input to trigger the chord
 * @param path template file path
 */
export default async function execute({ app, editor }: ChordContext, key: string, path: string): Promise<void> {
	// Remove the input synchronously so it's gone before the user types anything else
	const from = replaceKeyInput(editor, key);

	const templaterPlugin = app.plugins.plugins[TEMPLATER_ID] as TemplaterPlugin | undefined;
	const templater = templaterPlugin?.templater;
	if (!templaterPlugin || !templater) {
		new Notice("Templater plugin must be enabled for template chords");
		return;
	}

	if (!templater.create_running_config || !templater.parse_template) {
		new Notice("This version of Templater isn't supported by Chorded Hotkeys");
		return;
	}

	const templateFile = app.vault.getFileByPath(normalizePath(path));
	if (!templateFile) {
		new Notice(`File not found for chord: ${path}`);
		return;
	}

	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		new Notice("Template chords require an open file");
		return;
	}

	const config = templater.create_running_config(templateFile, activeFile, RUN_MODE_DYNAMIC_PROCESSOR);
	const template = await app.vault.cachedRead(templateFile);
	const content = await templater.parse_template(config, template);

	insertAt(editor, from, content);

	// Let Templater move the cursor to any tp.file.cursor() markers, the same way it does for its own commands
	if (templaterPlugin.settings?.auto_jump_to_cursor) {
		await templaterPlugin.editor_handler?.cursor_jumper?.jump_to_next_cursor_location?.();
	}
}
