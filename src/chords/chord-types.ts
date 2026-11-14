import type { App } from "obsidian";
import type { TextTarget } from "../targets/text-target";

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
	target: TextTarget;
}

/**
 * Executes a chord
 * @param context chord context
 * @param input text the user typed to trigger the chord, directly before the cursor
 * @param value the chord's value
 */
export type ChordExecutor = (context: ChordContext, input: string, value: string) => void | Promise<void>;
