import {
	ButtonComponent,
	DropdownComponent,
	ExtraButtonComponent,
	SearchComponent,
	TextAreaComponent,
	TextComponent,
	ToggleComponent,
	setIcon,
} from "obsidian";
import type ChordsPlugin from "../main";
import { ChordData, ChordType } from "../chords/chord-types";
import { dropIndex, matchesChordFilter } from "../chords/chord-utils";
import { CommandSuggest } from "../suggesters/command-suggester";
import { FileSuggest } from "../suggesters/file-suggester";

const ERROR_CLASS = "chords-error";
const DROP_BEFORE_CLASS = "chords-drop-before";
const DROP_AFTER_CLASS = "chords-drop-after";

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
 * The editable list of chords in the settings tab.
 * Only the list is re-rendered when chords change, so the rest of the tab keeps its scroll position.
 */
export default class ChordListEditor {
	private readonly plugin: ChordsPlugin;
	private readonly searchEl: HTMLInputElement;
	private readonly listEl: HTMLElement;

	/**
	 * Rendered chords by their index in settings.chords (filtered out chords have no row)
	 */
	private readonly rows = new Map<number, ChordRow>();

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
			.setButtonText("Add chord")
			.setCta()
			.onClick(() => this.addChord());

		this.listEl = containerEl.createDiv({ cls: "chords-list" });
		this.renderList();
	}

	private get chords(): ChordData[] {
		return this.plugin.settings.chords;
	}

	/**
	 * Adds a blank chord to the top of the list, ready to be typed into
	 */
	private async addChord(): Promise<void> {
		// The new chord is blank, so it wouldn't match a filter
		this.searchEl.value = "";
		this.filter = "";

		await this.plugin.chordManager.addBlankChord();
		this.renderList();

		const row = this.rows.get(0);
		row?.rowEl.addClass("is-new");
		row?.keyEl.focus();
	}

	private renderList(): void {
		this.listEl.empty();
		this.rows.clear();
		this.listEl.toggleClass("is-filtering", this.filter !== "");

		this.chords.forEach((chord, index) => {
			if (matchesChordFilter(chord, ChordType[chord.chordType], this.filter)) {
				this.renderRow(chord, index);
			}
		});

		if (this.rows.size === 0) {
			this.listEl.createDiv({
				cls: "chords-empty",
				text: this.chords.length === 0 ? "No chords yet. Add one to get started." : "No chords match the filter.",
			});
		}

		this.refreshValidation();
	}

	private renderRow(chord: ChordData, index: number): void {
		const manager = this.plugin.chordManager;
		const rowEl = this.listEl.createDiv({ cls: "chords-row" });

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
			.setDisabled(index === 0)
			.onClick(() => this.moveChord(index, index - 1));
		new ExtraButtonComponent(actionsEl)
			.setIcon("chevron-down")
			.setTooltip("Move down")
			.setDisabled(index === this.chords.length - 1)
			.onClick(() => this.moveChord(index, index + 1));
		actionsEl.querySelectorAll(".clickable-icon").forEach(el => el.classList.add("chords-row-move"));
		new ExtraButtonComponent(actionsEl)
			.setIcon("trash-2")
			.setTooltip("Delete chord")
			.onClick(async () => {
				await manager.removeChord(index);
				this.renderList();
			});

		const messageEl = rowEl.createDiv({ cls: "chords-row-message" });

		this.rows.set(index, { rowEl, keyEl, typeEl: type.selectEl, valueEl, messageEl });
		this.registerReordering(rowEl, handleEl, index);
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
	 * Lets a chord be moved by dragging its handle, or with Alt+ArrowUp/ArrowDown from any of its fields
	 */
	private registerReordering(rowEl: HTMLElement, handleEl: HTMLElement, index: number): void {
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
			void this.moveChord(from, dropIndex(from, index, isInLowerHalf(event, rowEl)));
		});

		rowEl.addEventListener("keydown", event => {
			if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;

			event.preventDefault();
			void this.moveChord(index, event.key === "ArrowUp" ? index - 1 : index + 1);
		});
	}

	/**
	 * Moves a chord to a new position, keeping focus in the field that had it
	 */
	private async moveChord(from: number, to: number): Promise<void> {
		// Positions in a filtered list don't correspond to positions in settings.chords
		if (this.filter !== "" || to < 0 || to >= this.chords.length) return;

		const focusedField = this.getFocusedField(from);
		if (to !== from) {
			await this.plugin.chordManager.moveChord(from, to);
		}

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
		this.rows.forEach(({ rowEl }) => rowEl.removeClass(DROP_BEFORE_CLASS, DROP_AFTER_CLASS));
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

			rowEl.toggleClass("is-disabled", !manager.isActive(index));

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
