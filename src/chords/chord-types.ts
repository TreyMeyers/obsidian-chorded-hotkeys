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
 * @member enabled false when the chord is turned off; missing (chords saved by older versions) means enabled
 * @member groupId id of the ChordGroup the chord belongs to; missing means ungrouped
 */
export interface ChordData {
	key: string;
	value: string;
	chordType: ChordType;
	enabled?: boolean;
	groupId?: string;
}

/**
 * A named set of chords that can be turned on and off together
 * @member id never changes, chords and the group's toggle command (and any hotkey bound to it) refer to it
 * @member name shown in the settings and in the toggle command, may be empty
 * @member enabled if the group's chords can be triggered
 * @member collapsed if the group's chords are hidden in the settings
 */
export interface ChordGroup {
	id: string;
	name: string;
	enabled: boolean;
	collapsed?: boolean;
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
