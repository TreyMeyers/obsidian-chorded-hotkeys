import { Notice } from "obsidian";
import type { TextTarget } from "../targets/text-target";
import type ChordsPlugin from "../main";
import type { ChordsPluginSettings } from "../settings/settings";
import { ChordData, ChordExecutor, ChordType } from "./chord-types";
import { isChordActive, moveItem, normalizeKey } from "./chord-utils";
import executeTextChord from "./text-chord";
import executeCommandChord, { findCommandByName } from "./command-chord";
import executeTemplateChord from "./template-chord";
import executeFileChord from "./file-chord";

/**
 * Chord execution functions, one per ChordType
 */
const CHORD_EXECUTORS: Record<ChordType, ChordExecutor> = {
	[ChordType.Text]: executeTextChord,
	[ChordType.Command]: executeCommandChord,
	[ChordType.Template]: executeTemplateChord,
	[ChordType.File]: executeFileChord,
};

/**
 * Setting that controls whether a notice is shown after a chord of each type executes
 */
const NOTICE_SETTINGS: Record<ChordType, keyof ChordsPluginSettings> = {
	[ChordType.Text]: "showTextChordExecuted",
	[ChordType.Command]: "showCommandChordExecuted",
	[ChordType.Template]: "showTemplateChordExecuted",
	[ChordType.File]: "showFileChordExecuted",
};

/**
 * Responsible for mapping user input to chords and updating settings.chords
 */
export default class ChordManager {
	private readonly plugin: ChordsPlugin;

	/**
	 * Maps normalized chord keys to their index in settings.chords
	 */
	private readonly chordIndexes = new Map<string, number>();

	public constructor(plugin: ChordsPlugin) {
		this.plugin = plugin;
		this.rebuildIndex();
	}

	private get chords(): ChordData[] {
		return this.plugin.settings.chords;
	}

	/**
	 * Attempts to execute a chord based on user input
	 * @param input user input
	 * @param target where the input was typed
	 */
	public async handleChord(input: string, target: TextTarget): Promise<void> {
		const chord = this.getChord(input);
		if (!chord) return;

		// Don't remove text unless it's exactly what the user typed, e.g. a key event may not have inserted anything
		if (!target.hasInputBeforeCursor(input)) return;

		try {
			await CHORD_EXECUTORS[chord.chordType]({ app: this.plugin.app, target }, input, chord.value);
		} catch (error) {
			console.error(`Chorded Hotkeys: failed to execute chord "${chord.key}"`, error);
			new Notice(`Chord failed: ${chord.key}. See the developer console for details.`);
			return;
		}

		if (this.plugin.settings[NOTICE_SETTINGS[chord.chordType]]) {
			new Notice(`${ChordType[chord.chordType]} chord executed: ${chord.key}`);
		}
	}

	/**
	 * Changes the key of a chord
	 * @param index index of chord in settings.chords
	 * @param newKey new key for the chord
	 */
	public async updateChordKey(index: number, newKey: string): Promise<void> {
		const chord = this.chords[index];
		if (!chord) return;

		chord.key = newKey;
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Changes the value of a chord
	 * @param index index of chord in settings.chords
	 * @param newValue new value for chord
	 */
	public async updateChordValue(index: number, newValue: string): Promise<void> {
		const chord = this.chords[index];
		if (!chord) return;

		chord.value = newValue;
		await this.plugin.saveSettings();
	}

	/**
	 * Changes the type of a chord
	 * @param index index of chord in settings.chords
	 * @param newChordType new ChordType for the chord
	 */
	public async updateChordType(index: number, newChordType: ChordType): Promise<void> {
		const chord = this.chords[index];
		if (!chord) return;

		chord.chordType = newChordType;
		await this.plugin.saveSettings();
	}

	/**
	 * Turns a chord on or off without deleting it
	 * @param index index of chord in settings.chords
	 * @param enabled if the chord can be triggered
	 */
	public async setChordEnabled(index: number, enabled: boolean): Promise<void> {
		const chord = this.chords[index];
		if (!chord) return;

		chord.enabled = enabled;
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Checks if a chord can currently be triggered
	 * @param index index of chord in settings.chords
	 * @returns false if the chord is turned off
	 */
	public isActive(index: number): boolean {
		const chord = this.chords[index];
		return chord !== undefined && isChordActive(chord);
	}

	/**
	 * Deletes a chord
	 * @param index index of chord in settings.chords
	 */
	public async removeChord(index: number): Promise<void> {
		this.chords.splice(index, 1);
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Creates an empty text chord at the top of the list
	 */
	public async addBlankChord(): Promise<void> {
		this.chords.unshift({ key: "", value: "", chordType: ChordType.Text });
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Moves a chord to a new position in settings.chords, used to change display order
	 * @param from index of the chord
	 * @param to index the chord should end up at
	 */
	public async moveChord(from: number, to: number): Promise<void> {
		moveItem(this.chords, from, to);
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Checks if a chord's key is shared with another chord (both duplicates will return true).
	 * Chords that are turned off don't conflict with anything, so alternatives can share a key.
	 * @param index index of chord in settings.chords
	 * @returns if more than one active chord has the same key
	 */
	public isDuplicateKey(index: number): boolean {
		const chord = this.chords[index];
		if (!chord || !isChordActive(chord)) return false;

		const key = normalizeKey(chord.key);
		return this.chords.some((c, i) => i !== index && isChordActive(c) && normalizeKey(c.key) === key);
	}

	/**
	 * Checks if a chord's value refers to something that exists
	 * @param index index of chord in settings.chords
	 * @returns if the value is valid for the chord's type
	 */
	public hasValidValue(index: number): boolean {
		const chord = this.chords[index];
		if (!chord) return false;

		switch (chord.chordType) {
			case ChordType.Command:
				return findCommandByName(this.plugin.app, chord.value) !== undefined;
			case ChordType.File:
			case ChordType.Template:
				return this.plugin.app.vault.getFileByPath(chord.value) !== null;
			case ChordType.Text:
				return true;
		}
	}

	/**
	 * Rebuilds the key -> chord mapping, leaving out chords that are turned off.
	 * When keys are duplicated, the first chord wins.
	 */
	private rebuildIndex(): void {
		this.chordIndexes.clear();

		this.chords.forEach((chord, index) => {
			const key = normalizeKey(chord.key);
			if (key && isChordActive(chord) && !this.chordIndexes.has(key)) {
				this.chordIndexes.set(key, index);
			}
		});
	}

	/**
	 * Gets a chord from user input
	 * @param input user input
	 * @returns chord if found
	 */
	private getChord(input: string): ChordData | undefined {
		const index = this.chordIndexes.get(normalizeKey(input));
		return index === undefined ? undefined : this.chords[index];
	}
}
