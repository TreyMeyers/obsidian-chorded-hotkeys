import {
	ButtonComponent,
	DropdownComponent,
	ExtraButtonComponent,
	Menu,
	SearchComponent,
	TextAreaComponent,
	TextComponent,
	ToggleComponent,
	setIcon,
} from "obsidian";
import type ChordsPlugin from "../main";
import { ChordData, ChordGroup, ChordType } from "../chords/chord-types";
import { dropIndex, findChordGroup, groupDisplayName, matchesChordFilter } from "../chords/chord-utils";
import { CommandSuggest } from "../suggesters/command-suggester";
import { FileSuggest } from "../suggesters/file-suggester";

const ERROR_CLASS = "chords-error";
const DISABLED_CLASS = "is-disabled";
const DROP_BEFORE_CLASS = "chords-drop-before";
const DROP_AFTER_CLASS = "chords-drop-after";
const DROP_INTO_CLASS = "chords-drop-into";

/**
 * Chord type names for the type dropdown, e.g. { Text: "Text", ... }
 */
const CHORD_TYPE_OPTIONS: Record<string, string> = Object.fromEntries(
	Object.keys(ChordType)
		.filter(name => isNaN(Number(name)))
		.map(name => [name, name])
);

/**
 * Message shown under a chord whose value doesn't refer to anything that exists
 */
const INVALID_VALUE_MESSAGES: Record<ChordType, string> = {
	[ChordType.Text]: "",
	[ChordType.Command]: "Command not found.",
	[ChordType.Template]: "File not found.",
	[ChordType.File]: "File not found.",
};

type RowField = "keyEl" | "typeEl" | "valueEl";

/**
 * The elements of one rendered chord
 */
interface ChordRow {
	rowEl: HTMLElement;
	keyEl: HTMLInputElement;
	typeEl: HTMLSelectElement;
	valueEl: HTMLInputElement | HTMLTextAreaElement;
	messageEl: HTMLElement;
}

/**
 * The chords shown together: one group's, or the ungrouped ones
 * @member group the group, or null for ungrouped chords
 * @member indexes indexes in settings.chords of the section's chords that match the filter, in display order
 */
interface Section {
	group: ChordGroup | null;
	indexes: number[];
}

/**
 * The editable list of chords and chord groups in the settings tab.
 * Only the list is re-rendered when chords change, so the rest of the tab keeps its scroll position.
 *
 * Chords are stored in one flat array; a section shows the chords of one group in array order,
 * so moving a chord within its section is a move in that array past its neighbours in the section.
 */
export default class ChordListEditor {
	private readonly plugin: ChordsPlugin;
	private readonly searchEl: HTMLInputElement;
	private readonly listEl: HTMLElement;

	/**
	 * Rendered chords by their index in settings.chords (filtered out and collapsed chords have no row)
	 */
	private readonly rows = new Map<number, ChordRow>();

	/**
	 * Name inputs of the rendered groups by group id
	 */
	private readonly groupNameEls = new Map<string, HTMLInputElement>();

	/**
	 * Lowercase filter text, empty when not filtering
	 */
	private filter = "";

	/**
	 * Index of the chord being dragged
	 */
	private dragIndex: number | null = null;

	public constructor(plugin: ChordsPlugin, containerEl: HTMLElement) {
		this.plugin = plugin;

		const toolbarEl = containerEl.createDiv({ cls: "chords-toolbar" });
		const search = new SearchComponent(toolbarEl)
			.setPlaceholder("Filter chords")
			.onChange(value => {
				this.filter = value.trim().toLowerCase();
				this.renderList();
			});
		this.searchEl = search.inputEl;

		new ButtonComponent(toolbarEl)
			.setButtonText("Add group")
			.onClick(() => this.addGroup());

		new ButtonComponent(toolbarEl)
			.setButtonText("Add chord")
			.setCta()
			.onClick(() => this.addChord(null));

		this.listEl = containerEl.createDiv({ cls: "chords-list" });
		this.renderList();

		// A group's command can run while the settings are open (they're a separate window since Obsidian 1.15)
		plugin.chordManager.onGroupToggled = () => this.renderList();
	}

	private get chords(): ChordData[] {
		return this.plugin.settings.chords;
	}

	private get groups(): ChordGroup[] {
		return this.plugin.settings.groups;
	}

	private get isFiltering(): boolean {
		return this.filter !== "";
	}

	/**
	 * Adds a blank chord to the top of a group (or of the ungrouped chords), ready to be typed into
	 */
	private async addChord(group: ChordGroup | null): Promise<void> {
		// The new chord is blank, so it wouldn't match a filter
		this.clearFilter();

		if (group?.collapsed) {
			await this.plugin.chordManager.setGroupCollapsed(group.id, false);
		}
		await this.plugin.chordManager.addBlankChord(group?.id ?? null);
		this.renderList();

		const row = this.rows.get(0);
		row?.rowEl.addClass("is-new");
		row?.keyEl.focus();
	}

	/**
	 * Adds an empty group to the end of the list, ready to be named
	 */
	private async addGroup(): Promise<void> {
		// An empty group is hidden while filtering
		this.clearFilter();

		const group = await this.plugin.chordManager.addGroup();
		this.renderList();

		const nameEl = this.groupNameEls.get(group.id);
		nameEl?.closest(".chords-group")?.classList.add("is-new");
		nameEl?.focus();
	}

	private clearFilter(): void {
		this.searchEl.value = "";
		this.filter = "";
	}

	private renderList(): void {
		this.listEl.empty();
		this.rows.clear();
		this.groupNameEls.clear();
		this.listEl.toggleClass("is-filtering", this.isFiltering);

		const sections = this.getSections();
		sections.forEach(section => this.renderSection(section));

		if (this.chords.length === 0 && this.groups.length === 0) {
			this.listEl.createDiv({ cls: "chords-empty", text: "No chords yet. Add one to get started." });
		} else if (this.isFiltering && sections.every(section => section.indexes.length === 0)) {
			this.listEl.createDiv({ cls: "chords-empty", text: "No chords match the filter." });
		}

		this.refreshValidation();
	}

	/**
	 * Splits the chords that match the filter into the ungrouped chords followed by each group's chords
	 */
	private getSections(): Section[] {
		const ungrouped: Section = { group: null, indexes: [] };
		const byGroup = new Map<ChordGroup, Section>(this.groups.map(group => [group, { group, indexes: [] }]));

		this.chords.forEach((chord, index) => {
			// A chord whose group no longer exists is shown as ungrouped
			const group = findChordGroup(chord, this.groups);
			const groupName = group ? groupDisplayName(group) : "";
			if (matchesChordFilter(chord, ChordType[chord.chordType], this.filter, groupName)) {
				(group ? byGroup.get(group) : ungrouped)?.indexes.push(index);
			}
		});

		return [ungrouped, ...byGroup.values()];
	}

	private renderSection(section: Section): void {
		const { group, indexes } = section;

		// Don't show sections without results, or an "Ungrouped" heading above nothing
		if (indexes.length === 0 && (this.isFiltering || !group)) return;

		const sectionEl = this.listEl.createDiv({ cls: "chords-section" });
		let showChords = true;
		if (group) {
			sectionEl.addClass("chords-group");
			sectionEl.toggleClass(DISABLED_CLASS, !group.enabled);
			this.renderGroupHeader(sectionEl, group, indexes.length);
			// Matches have to be visible, so the filter overrides collapsing
			showChords = !group.collapsed || this.isFiltering;
		} else if (this.groups.length > 0) {
			const headerEl = sectionEl.createDiv({ cls: "chords-ungrouped-header", text: "Ungrouped" });
			this.registerDropInto(headerEl, null);
		}

		if (!showChords) return;

		indexes.forEach((index, position) => {
			const chord = this.chords[index];
			if (chord) {
				this.renderRow(sectionEl, chord, index, indexes[position - 1], indexes[position + 1]);
			}
		});

		if (indexes.length === 0) {
			sectionEl.createDiv({ cls: "chords-group-empty", text: "No chords in this group. Add one, or drag a chord onto the group." });
		}
	}

	private renderGroupHeader(sectionEl: HTMLElement, group: ChordGroup, chordCount: number): void {
		const manager = this.plugin.chordManager;
		const groupIndex = this.groups.indexOf(group);
		const headerEl = sectionEl.createDiv({ cls: "chords-group-header" });

		new ExtraButtonComponent(headerEl)
			.setIcon(group.collapsed ? "chevron-right" : "chevron-down")
			.setTooltip(group.collapsed ? "Show chords" : "Hide chords")
			.setDisabled(this.isFiltering)
			.onClick(async () => {
				await manager.setGroupCollapsed(group.id, !group.collapsed);
				this.renderList();
			});

		const name = new TextComponent(headerEl)
			.setPlaceholder("Group name")
			.setValue(group.name)
			.onChange(newName => manager.renameGroup(group.id, newName));
		name.inputEl.addClass("chords-group-name");
		name.inputEl.setAttr("aria-label", "Group name");
		this.groupNameEls.set(group.id, name.inputEl);

		headerEl.createSpan({
			cls: "chords-group-count",
			text: this.isFiltering ? `${chordCount} shown` : `${chordCount} ${chordCount === 1 ? "chord" : "chords"}`,
		});

		const actionsEl = headerEl.createDiv({ cls: "chords-row-actions" });
		new ToggleComponent(actionsEl)
			.setValue(group.enabled)
			.setTooltip("Enable group")
			.onChange(async enabled => {
				await manager.setGroupEnabled(group.id, enabled);
				sectionEl.toggleClass(DISABLED_CLASS, !enabled);
				this.refreshValidation();
			});
		new ExtraButtonComponent(actionsEl)
			.setIcon("plus")
			.setTooltip("Add chord to group")
			.onClick(() => this.addChord(group));
		new ExtraButtonComponent(actionsEl)
			.setIcon("chevron-up")
			.setTooltip("Move group up")
			.setDisabled(groupIndex === 0 || this.isFiltering)
			.onClick(() => this.moveGroup(groupIndex, groupIndex - 1));
		new ExtraButtonComponent(actionsEl)
			.setIcon("chevron-down")
			.setTooltip("Move group down")
			.setDisabled(groupIndex === this.groups.length - 1 || this.isFiltering)
			.onClick(() => this.moveGroup(groupIndex, groupIndex + 1));
		new ExtraButtonComponent(actionsEl)
			.setIcon("trash-2")
			.setTooltip("Delete group, keeping its chords")
			.onClick(async () => {
				await manager.removeGroup(group.id);
				this.renderList();
			});

		this.registerDropInto(headerEl, group.id);
	}

	private async moveGroup(from: number, to: number): Promise<void> {
		await this.plugin.chordManager.moveGroup(from, to);
		this.renderList();
	}

	/**
	 * @param previous index of the chord above this one in its section, if there is one
	 * @param next index of the chord below this one in its section, if there is one
	 */
	private renderRow(parentEl: HTMLElement, chord: ChordData, index: number, previous?: number, next?: number): void {
		const manager = this.plugin.chordManager;
		const rowEl = parentEl.createDiv({ cls: "chords-row" });

		const handleEl = rowEl.createDiv({
			cls: "chords-row-handle",
			attr: { "aria-label": "Drag to reorder, or press Alt+↑/↓ in a field", draggable: "true" },
		});
		setIcon(handleEl, "grip-vertical");

		const fieldsEl = rowEl.createDiv({ cls: "chords-row-fields" });

		const key = new TextComponent(fieldsEl)
			.setPlaceholder("Keys")
			.setValue(chord.key)
			.onChange(async newKey => {
				await manager.updateChordKey(index, newKey);
				this.refreshValidation();
			});
		const keyEl = key.inputEl;
		keyEl.addClass("chords-key");
		keyEl.spellcheck = false;
		keyEl.setAttrs({ "aria-label": "Keys that trigger the chord", autocapitalize: "off", autocorrect: "off" });

		const type = new DropdownComponent(fieldsEl)
			.addOptions(CHORD_TYPE_OPTIONS)
			.setValue(ChordType[chord.chordType])
			.onChange(async newValue => {
				await manager.updateChordType(index, ChordType[newValue as keyof typeof ChordType]);
				this.renderList();
				this.rows.get(index)?.valueEl.focus();
			});
		type.selectEl.setAttr("aria-label", "Chord type");

		const valueEl = this.renderValueInput(fieldsEl, chord, index);

		const actionsEl = rowEl.createDiv({ cls: "chords-row-actions" });
		new ToggleComponent(actionsEl)
			.setValue(chord.enabled !== false)
			.setTooltip("Enable chord")
			.onChange(async enabled => {
				await manager.setChordEnabled(index, enabled);
				this.refreshValidation();
			});
		new ExtraButtonComponent(actionsEl)
			.setIcon("chevron-up")
			.setTooltip("Move up")
			.setDisabled(previous === undefined)
			.onClick(() => this.moveChord(index, previous));
		new ExtraButtonComponent(actionsEl)
			.setIcon("chevron-down")
			.setTooltip("Move down")
			.setDisabled(next === undefined)
			.onClick(() => this.moveChord(index, next));
		actionsEl.querySelectorAll(".clickable-icon").forEach(el => el.classList.add("chords-row-move"));
		if (this.groups.length > 0) {
			const groupButton = new ExtraButtonComponent(actionsEl)
				.setIcon("folder")
				.setTooltip("Move to group");
			groupButton.extraSettingsEl.addEventListener("click", event => this.showGroupMenu(event, chord, index));
		}
		new ExtraButtonComponent(actionsEl)
			.setIcon("trash-2")
			.setTooltip("Delete chord")
			.onClick(async () => {
				await manager.removeChord(index);
				this.renderList();
			});

		const messageEl = rowEl.createDiv({ cls: "chords-row-message" });

		this.rows.set(index, { rowEl, keyEl, typeEl: type.selectEl, valueEl, messageEl });
		this.registerReordering(rowEl, handleEl, index, previous, next);
	}

	/**
	 * Shows a menu to pick the group a chord belongs to
	 */
	private showGroupMenu(event: MouseEvent, chord: ChordData, index: number): void {
		const current = findChordGroup(chord, this.groups) ?? null;
		const menu = new Menu();

		const addOption = (title: string, group: ChordGroup | null): void => {
			menu.addItem(item => item
				.setTitle(title)
				.setChecked(group === current)
				.onClick(async () => {
					await this.plugin.chordManager.setChordGroup(index, group?.id ?? null);
					this.renderList();
				}));
		};

		addOption("No group", null);
		menu.addSeparator();
		this.groups.forEach(group => addOption(groupDisplayName(group), group));
		menu.showAtMouseEvent(event);
	}

	/**
	 * Adds the input for a chord's value, which depends on the chord's type
	 */
	private renderValueInput(fieldsEl: HTMLElement, chord: ChordData, index: number): HTMLInputElement | HTMLTextAreaElement {
		const manager = this.plugin.chordManager;

		if (chord.chordType === ChordType.Text) {
			const textArea = new TextAreaComponent(fieldsEl)
				.setPlaceholder("Text to insert, {c} for cursor")
				.setValue(chord.value)
				.onChange(newValue => manager.updateChordValue(index, newValue));
			textArea.inputEl.addClass("chords-value", "chords-text-area");
			textArea.inputEl.rows = 1;
			textArea.inputEl.setAttr("aria-label", "Text to insert");
			return textArea.inputEl;
		}

		const isCommand = chord.chordType === ChordType.Command;
		const search = new SearchComponent(fieldsEl)
			.setPlaceholder(isCommand ? "Search commands" : "Search files")
			.setValue(chord.value)
			.onChange(async newValue => {
				await manager.updateChordValue(index, newValue);
				this.refreshValidation();
			});
		search.inputEl.parentElement?.addClass("chords-value");
		search.inputEl.setAttr("aria-label", isCommand ? "Command to run" : "File path");

		if (isCommand) {
			new CommandSuggest(this.plugin.app, search.inputEl);
		} else {
			new FileSuggest(this.plugin.app, search.inputEl);
		}
		return search.inputEl;
	}

	/**
	 * Lets a chord be moved by dragging its handle (onto a chord of another group to change group as well),
	 * or within its section with Alt+ArrowUp/ArrowDown from any of its fields
	 */
	private registerReordering(rowEl: HTMLElement, handleEl: HTMLElement, index: number, previous?: number, next?: number): void {
		handleEl.addEventListener("dragstart", event => {
			this.dragIndex = index;
			rowEl.addClass("is-dragging");
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = "move";
				event.dataTransfer.setData("text/plain", this.chords[index]?.key ?? "");
				event.dataTransfer.setDragImage(rowEl, 0, 0);
			}
		});

		handleEl.addEventListener("dragend", () => {
			this.dragIndex = null;
			rowEl.removeClass("is-dragging");
			this.clearDropMarkers();
		});

		rowEl.addEventListener("dragover", event => {
			if (this.dragIndex === null) return;

			event.preventDefault();
			const after = isInLowerHalf(event, rowEl);
			this.clearDropMarkers();
			rowEl.addClass(after ? DROP_AFTER_CLASS : DROP_BEFORE_CLASS);
		});

		rowEl.addEventListener("drop", event => {
			if (this.dragIndex === null) return;

			event.preventDefault();
			const from = this.dragIndex;
			this.dragIndex = null;
			// The dragged chord joins the group of the chord it's dropped next to
			const groupId = this.chords[index]?.groupId ?? null;
			void this.moveChord(from, dropIndex(from, index, isInLowerHalf(event, rowEl)), groupId);
		});

		rowEl.addEventListener("keydown", event => {
			if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;

			event.preventDefault();
			void this.moveChord(index, event.key === "ArrowUp" ? previous : next);
		});
	}

	/**
	 * Lets a dragged chord be dropped on a section's header to move it into that section
	 * @param groupId id of the header's group, or null for the ungrouped chords
	 */
	private registerDropInto(headerEl: HTMLElement, groupId: string | null): void {
		headerEl.addEventListener("dragover", event => {
			if (this.dragIndex === null) return;

			event.preventDefault();
			this.clearDropMarkers();
			headerEl.addClass(DROP_INTO_CLASS);
		});

		headerEl.addEventListener("drop", event => {
			if (this.dragIndex === null) return;

			event.preventDefault();
			const from = this.dragIndex;
			this.dragIndex = null;
			void this.plugin.chordManager.setChordGroup(from, groupId).then(() => this.renderList());
		});
	}

	/**
	 * Moves a chord to a new position, keeping focus in the field that had it
	 * @param to index in settings.chords the chord should end up at, nothing happens when there's no such position
	 * @param groupId id of the group the chord should end up in, null for ungrouped, leave out to keep its group
	 */
	private async moveChord(from: number, to: number | undefined, groupId?: string | null): Promise<void> {
		// Positions in a filtered list don't correspond to positions in settings.chords
		if (this.isFiltering || to === undefined || to < 0 || to >= this.chords.length) return;

		const focusedField = this.getFocusedField(from);
		await this.plugin.chordManager.moveChord(from, to, groupId);

		this.renderList();
		if (focusedField) {
			this.rows.get(to)?.[focusedField].focus();
		}
	}

	private getFocusedField(index: number): RowField | null {
		const row = this.rows.get(index);
		if (!row) return null;

		const activeEl = row.rowEl.ownerDocument.activeElement;
		const fields: RowField[] = ["keyEl", "typeEl", "valueEl"];
		return fields.find(field => row[field] === activeEl) ?? null;
	}

	private clearDropMarkers(): void {
		this.listEl
			.querySelectorAll(`.${DROP_BEFORE_CLASS}, .${DROP_AFTER_CLASS}, .${DROP_INTO_CLASS}`)
			.forEach(el => el.classList.remove(DROP_BEFORE_CLASS, DROP_AFTER_CLASS, DROP_INTO_CLASS));
	}

	/**
	 * Dims chords that are turned off, highlights duplicate keys and values that don't refer to anything,
	 * and explains them under the chord.
	 * Blank fields aren't flagged, a chord that's still being filled in isn't a mistake.
	 */
	private refreshValidation(): void {
		const manager = this.plugin.chordManager;

		this.rows.forEach(({ rowEl, keyEl, valueEl, messageEl }, index) => {
			const chord = this.chords[index];
			if (!chord) return;

			rowEl.toggleClass(DISABLED_CLASS, !manager.isActive(index));

			const isDuplicate = chord.key !== "" && manager.isDuplicateKey(index);
			const isInvalid = chord.value !== "" && !manager.hasValidValue(index);
			keyEl.toggleClass(ERROR_CLASS, isDuplicate);
			valueEl.toggleClass(ERROR_CLASS, isInvalid);

			const messages = [
				isDuplicate ? "Another chord already uses these keys." : "",
				isInvalid ? INVALID_VALUE_MESSAGES[chord.chordType] : "",
			];
			messageEl.setText(messages.filter(Boolean).join(" "));
		});
	}
}

/**
 * Checks if the pointer is over the lower half of an element, i.e. a drop would land after it
 */
function isInLowerHalf(event: DragEvent, el: HTMLElement): boolean {
	const rect = el.getBoundingClientRect();
	return event.clientY > rect.top + rect.height / 2;
}
