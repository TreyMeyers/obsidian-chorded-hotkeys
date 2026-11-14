import { App, Command, Notice } from "obsidian";
import type { ChordContext } from "./chord-types";
import { replaceKeyInput } from "./chord-utils";

/**
 * Removes the user input and executes a command
 * @param context chord context
 * @param key user input to trigger the chord
 * @param value command name
 */
export default function execute({ app, editor }: ChordContext, key: string, value: string): void {
	replaceKeyInput(editor, key);

	const command = findCommandByName(app, value);
	if (!command) {
		new Notice(`Command not found: ${value}`);
		return;
	}

	app.commands.executeCommandById(command.id);
}

/**
 * Finds a command by its display name
 * @param app app instance
 * @param name command name as shown in the command palette
 * @returns the command if found
 */
export function findCommandByName(app: App, name: string): Command | undefined {
	return app.commands.listCommands().find(c => c.name === name);
}
