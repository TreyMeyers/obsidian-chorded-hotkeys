import type { App, Editor } from "obsidian";

/**
 * The different types of chords.
 * Values are persisted numerically in data.json: only append new types, never reorder.
 */
export enum ChordType {
	Text,
	Command,
	Template,
	File,
}

/**
 * The format in which chords are saved
 */
export interface ChordData {
	key: string;
	value: string;
	chordType: ChordType;
}

/**
 * Everything a chord needs to execute
 */
export interface ChordContext {
	app: App;
	editor: Editor;
}

/**
 * Executes a chord whose trigger `key` was just typed before the cursor
 */
export type ChordExecutor = (context: ChordContext, key: string, value: string) => void | Promise<void>;
