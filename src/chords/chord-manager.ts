import { Notice } from "obsidian";
import type { TextTarget } from "../targets/text-target";
import type ChordsPlugin from "../main";
import type { ChordsPluginSettings } from "../settings/settings";
import { ChordData, ChordExecutor, ChordGroup, ChordType } from "./chord-types";
import { createGroupId, groupDisplayName, isChordActive, moveItem, normalizeKey } from "./chord-utils";
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

const GROUP_COMMAND_PREFIX = "toggle-group-";

/**
 * Responsible for mapping user input to chords and updating settings.chords and settings.groups
 */
export default class ChordManager {
	private readonly plugin: ChordsPlugin;

	/**
	 * Maps normalized chord keys to their index in settings.chords
	 */
	private readonly chordIndexes = new Map<string, number>();

	/**
	 * Ids of the groups that currently have a toggle command
	 */
	private readonly groupCommands = new Set<string>();

	/**
	 * Called when a group is toggled from outside the settings tab (by its command), so an open tab can update
	 */
	public onGroupToggled: (() => void) | null = null;

	public constructor(plugin: ChordsPlugin) {
		this.plugin = plugin;
		this.rebuildIndex();
	}

	private get chords(): ChordData[] {
		return this.plugin.settings.chords;
	}

	private get groups(): ChordGroup[] {
		return this.plugin.settings.groups;
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
	 * @returns false if the chord or its group is turned off
	 */
	public isActive(index: number): boolean {
		const chord = this.chords[index];
		return chord !== undefined && isChordActive(chord, this.groups);
	}

	/**
	 * Moves a chord into a group
	 * @param index index of chord in settings.chords
	 * @param groupId id of the group, or null to make the chord ungrouped
	 */
	public async setChordGroup(index: number, groupId: string | null): Promise<void> {
		const chord = this.chords[index];
		if (!chord) return;

		assignGroup(chord, groupId);
		this.rebuildIndex();
		await this.plugin.saveSettings();
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
	 * @param groupId id of the group to add the chord to, or null for an ungrouped chord
	 */
	public async addBlankChord(groupId: string | null = null): Promise<void> {
		const chord: ChordData = { key: "", value: "", chordType: ChordType.Text };
		assignGroup(chord, groupId);
		this.chords.unshift(chord);
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Moves a chord to a new position in settings.chords, used to change display order
	 * @param from index of the chord
	 * @param to index the chord should end up at
	 * @param groupId id of the group the chord should end up in, null for ungrouped, leave out to keep its group
	 */
	public async moveChord(from: number, to: number, groupId?: string | null): Promise<void> {
		const chord = this.chords[from];
		if (chord && groupId !== undefined) {
			assignGroup(chord, groupId);
		}

		moveItem(this.chords, from, to);
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Creates an empty, enabled group at the end of the group list
	 * @returns the new group
	 */
	public async addGroup(): Promise<ChordGroup> {
		const group: ChordGroup = { id: createGroupId(this.groups), name: "", enabled: true };
		this.groups.push(group);
		this.syncGroupCommands();
		await this.plugin.saveSettings();
		return group;
	}

	/**
	 * Changes a group's name, and with it the name of its toggle command
	 * @param id id of the group
	 * @param name new name
	 */
	public async renameGroup(id: string, name: string): Promise<void> {
		const group = this.getGroup(id);
		if (!group) return;

		group.name = name;
		this.syncGroupCommands();
		await this.plugin.saveSettings();
	}

	/**
	 * Turns all chords of a group on or off; chords that are turned off individually stay off
	 * @param id id of the group
	 * @param enabled if the group's chords can be triggered
	 */
	public async setGroupEnabled(id: string, enabled: boolean): Promise<void> {
		const group = this.getGroup(id);
		if (!group) return;

		group.enabled = enabled;
		this.rebuildIndex();
		await this.plugin.saveSettings();
	}

	/**
	 * Shows or hides a group's chords in the settings
	 * @param id id of the group
	 * @param collapsed if the chords are hidden
	 */
	public async setGroupCollapsed(id: string, collapsed: boolean): Promise<void> {
		const group = this.getGroup(id);
		if (!group) return;

		group.collapsed = collapsed;
		await this.plugin.saveSettings();
	}

	/**
	 * Moves a group to a new position in settings.groups, used to change display order
	 * @param from index of the group
	 * @param to index the group should end up at
	 */
	public async moveGroup(from: number, to: number): Promise<void> {
		moveItem(this.groups, from, to);
		await this.plugin.saveSettings();
	}

	/**
	 * Deletes a group. Its chords are kept and become ungrouped.
	 * @param id id of the group
	 */
	public async removeGroup(id: string): Promise<void> {
		const index = this.groups.findIndex(group => group.id === id);
		if (index === -1) return;

		this.groups.splice(index, 1);
		this.chords.forEach(chord => {
			if (chord.groupId === id) delete chord.groupId;
		});
		this.rebuildIndex();
		this.syncGroupCommands();
		await this.plugin.saveSettings();
	}

	/**
	 * Makes the registered "Toggle group" commands match the groups and the groupToggleCommands setting.
	 * Command ids are derived from group ids, so hotkeys survive renaming a group.
	 */
	public syncGroupCommands(): void {
		const wanted = this.plugin.settings.groupToggleCommands ? this.groups : [];

		this.groupCommands.forEach(id => {
			if (!wanted.some(group => group.id === id)) {
				this.removeCommand(GROUP_COMMAND_PREFIX + id);
				this.groupCommands.delete(id);
			}
		});

		wanted.forEach(group => {
			// Adding a command that already exists replaces it, which is how a rename reaches the command palette
			this.plugin.addCommand({
				id: GROUP_COMMAND_PREFIX + group.id,
				name: `Toggle group: ${groupDisplayName(group)}`,
				callback: () => void this.toggleGroup(group.id),
			});
			this.groupCommands.add(group.id);
		});
	}

	/**
	 * Flips a group on or off and tells the user, used by the group's command
	 */
	private async toggleGroup(id: string): Promise<void> {
		const group = this.getGroup(id);
		if (!group) return;

		await this.setGroupEnabled(id, !group.enabled);
		new Notice(`Chord group ${group.enabled ? "enabled" : "disabled"}: ${groupDisplayName(group)}`);
		this.onGroupToggled?.();
	}

	private getGroup(id: string): ChordGroup | undefined {
		return this.groups.find(group => group.id === id);
	}

	private removeCommand(id: string): void {
		// Plugin.removeCommand only exists since Obsidian 1.7.2, older versions need the internal command registry
		const removeCommand = (this.plugin as { removeCommand?: (commandId: string) => void }).removeCommand;
		if (removeCommand) {
			removeCommand.call(this.plugin, id);
		} else {
			this.plugin.app.commands.removeCommand(`${this.plugin.manifest.id}:${id}`);
		}
	}

	/**
	 * Checks if a chord's key is shared with another chord (both duplicates will return true).
	 * Chords that are turned off (individually or through their group) don't conflict with anything,
	 * so alternatives can share a key.
	 * @param index index of chord in settings.chords
	 * @returns if more than one active chord has the same key
	 */
	public isDuplicateKey(index: number): boolean {
		const chord = this.chords[index];
		if (!chord || !isChordActive(chord, this.groups)) return false;

		const key = normalizeKey(chord.key);
		return this.chords.some((c, i) => i !== index && isChordActive(c, this.groups) && normalizeKey(c.key) === key);
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
	 * Rebuilds the key -> chord mapping, leaving out chords that are turned off or in a group that is.
	 * When keys are duplicated, the first chord wins.
	 */
	private rebuildIndex(): void {
		this.chordIndexes.clear();

		this.chords.forEach((chord, index) => {
			const key = normalizeKey(chord.key);
			if (key && isChordActive(chord, this.groups) && !this.chordIndexes.has(key)) {
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

/**
 * Puts a chord in a group, or makes it ungrouped
 */
function assignGroup(chord: ChordData, groupId: string | null): void {
	if (groupId === null) {
		delete chord.groupId;
	} else {
		chord.groupId = groupId;
	}
}
