import { App, PluginSettingTab, Setting } from "obsidian";
import type ChordsPlugin from "../main";
import { ChordType } from "../chords/chord-types";
import { CommandSuggest } from "../suggesters/command-suggester";
import { FileSuggest } from "../suggesters/file-suggester";
import { NO_CHORDS_CLASS } from "../targets/text-target";
import { ChordsPluginSettings, delayToWpm, parsePositiveNumber, wpmToDelay } from "./settings";

type NoticeSettingKey =
	| "showTextChordExecuted"
	| "showTemplateChordExecuted"
	| "showFileChordExecuted"
	| "showCommandChordExecuted";

const ERROR_CLASS = "chords-error";

/**
 * Chord type names for the type dropdown, e.g. { Text: "Text", ... }
 */
const CHORD_TYPE_OPTIONS: Record<string, string> = Object.fromEntries(
	Object.keys(ChordType)
		.filter(name => isNaN(Number(name)))
		.map(name => [name, name])
);

export default class ChordsSettingTab extends PluginSettingTab {
	private readonly plugin: ChordsPlugin;

	/**
	 * Trigger inputs for each chord, indexed like settings.chords
	 */
	private chordTriggerEls: HTMLInputElement[] = [];

	public constructor(app: App, plugin: ChordsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private get settings(): ChordsPluginSettings {
		return this.plugin.settings;
	}

	public display(): void {
		this.containerEl.empty();
		// Typing a chord's trigger while editing it shouldn't run the chord
		this.containerEl.addClass(NO_CHORDS_CLASS);

		new Setting(this.containerEl)
			.setName("Use chords outside the editor")
			.setDesc("Also trigger chords in other text fields, such as search, the command palette, note titles, and properties.")
			.addToggle(toggle => toggle
				.setValue(this.settings.enableOutsideEditor)
				.onChange(async value => {
					this.settings.enableOutsideEditor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(this.containerEl).setName("Notices").setHeading();
		this.addNoticeToggle("Text", "Show a notice when a text chord is executed", "showTextChordExecuted");
		this.addNoticeToggle("Template", "Show a notice when a template chord is executed", "showTemplateChordExecuted");
		this.addNoticeToggle("File", "Show a notice when a file chord is executed", "showFileChordExecuted");
		this.addNoticeToggle("Command", "Show a notice when a command chord is executed", "showCommandChordExecuted");

		new Setting(this.containerEl).setName("Delay").setHeading();
		this.addDelayModeToggle();
		if (this.settings.setDelayManually) {
			this.addDelaySetting();
		} else {
			this.addWpmSetting();
		}

		new Setting(this.containerEl).setName("Chords").setHeading();
		this.addChordsSettings();
	}

	/**
	 * Adds a toggle that controls whether a notice is shown when a chord type is executed
	 */
	private addNoticeToggle(name: string, desc: string, key: NoticeSettingKey): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle(toggle => toggle
				.setValue(this.settings[key])
				.onChange(async value => {
					this.settings[key] = value;
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * Adds a toggle to switch between WPM input and manual delay input
	 */
	private addDelayModeToggle(): void {
		new Setting(this.containerEl)
			.setName("Set delay manually")
			.setDesc("Keys pressed within this delay of each other are treated as one chord. By default it's calculated from your typing speed.")
			.addToggle(toggle => toggle
				.setValue(this.settings.setDelayManually)
				.onChange(async value => {
					this.settings.setDelayManually = value;
					await this.plugin.saveSettings();
					this.display();
				}));
	}

	/**
	 * Adds manual delay input
	 */
	private addDelaySetting(): void {
		new Setting(this.containerEl)
			.setName("Delay (ms)")
			.setDesc("Must be shorter than the time between keys when you type normally.")
			.addText(text => text
				.setValue(String(this.settings.delay))
				.onChange(async value => {
					const delay = parsePositiveNumber(value);
					text.inputEl.toggleClass(ERROR_CLASS, delay === null);
					if (delay === null) return;

					this.settings.delay = delay;
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * Adds typing speed input, which sets the delay automatically
	 */
	private addWpmSetting(): void {
		new Setting(this.containerEl)
			.setName("Typing speed (WPM)")
			.setDesc("The delay is calculated from your typing speed.")
			.addText(text => text
				.setValue(String(Math.round(delayToWpm(this.settings.delay))))
				.onChange(async value => {
					const wpm = parsePositiveNumber(value);
					text.inputEl.toggleClass(ERROR_CLASS, wpm === null);
					if (wpm === null) return;

					this.settings.delay = wpmToDelay(wpm);
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * Adds the editable list of chords
	 */
	private addChordsSettings(): void {
		new Setting(this.containerEl)
			.setDesc(createFragment(descEl => {
				descEl.appendText("For each chord, the first field is the set of keys used to trigger the chord.");
				descEl.createEl("br");
				descEl.appendText("The second field is the value for the chord.");
				descEl.createEl("br");
				descEl.appendText("The third field is the type of chord.");
			}));

		this.chordTriggerEls = [];
		const lastIndex = this.settings.chords.length - 1;

		this.settings.chords.forEach(({ key, value, chordType }, index) => {
			const chordSetting = new Setting(this.containerEl)
				.addText(text => {
					this.chordTriggerEls.push(text.inputEl);
					text.inputEl.addClass("chords-key");
					text.setPlaceholder("sav")
						.setValue(key)
						.onChange(async newKey => {
							await this.plugin.chordManager.updateChordKey(index, newKey);
							this.displayDuplicates();
						});
				});

			switch (chordType) {
				case ChordType.Text:
					this.addTextValueInput(chordSetting, value, index);
					break;
				case ChordType.Command:
					this.addCommandValueInput(chordSetting, value, index);
					break;
				case ChordType.Template:
				case ChordType.File:
					this.addFileValueInput(chordSetting, value, index);
					break;
			}

			chordSetting
				.addDropdown(dropdown => dropdown
					.addOptions(CHORD_TYPE_OPTIONS)
					.setValue(ChordType[chordType])
					.onChange(async newValue => {
						const newChordType = ChordType[newValue as keyof typeof ChordType];
						await this.plugin.chordManager.updateChordType(index, newChordType);
						this.display();
					}))
				.addExtraButton(button => button
					.setIcon("chevron-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						await this.plugin.chordManager.swapIndex(index, index - 1);
						this.display();
					}))
				.addExtraButton(button => button
					.setIcon("chevron-down")
					.setTooltip("Move down")
					.setDisabled(index === lastIndex)
					.onClick(async () => {
						await this.plugin.chordManager.swapIndex(index, index + 1);
						this.display();
					}))
				.addExtraButton(button => button
					.setIcon("x")
					.setTooltip("Delete")
					.onClick(async () => {
						await this.plugin.chordManager.removeChord(index);
						this.display();
					}));

			chordSetting.infoEl.remove();
		});

		this.displayDuplicates();

		new Setting(this.containerEl)
			.addButton(button => button
				.setButtonText("Add new chord")
				.setCta()
				.onClick(async () => {
					await this.plugin.chordManager.addBlankChord();
					this.display();
				}));
	}

	/**
	 * Highlights duplicate triggers
	 */
	private displayDuplicates(): void {
		this.chordTriggerEls.forEach((inputEl, index) => {
			inputEl.toggleClass(ERROR_CLASS, this.plugin.chordManager.isDuplicateKey(index));
		});
	}

	/**
	 * Highlights a chord's value input if it doesn't refer to anything that exists
	 */
	private validateChordValue(inputEl: HTMLElement, index: number): void {
		inputEl.toggleClass(ERROR_CLASS, !this.plugin.chordManager.hasValidValue(index));
	}

	/**
	 * Adds a file path input, used by file and template chords
	 */
	private addFileValueInput(chordSetting: Setting, value: string, index: number): void {
		chordSetting.addSearch(search => {
			new FileSuggest(this.app, search.inputEl);
			search.inputEl.parentElement?.addClass("chords-search");
			search.setPlaceholder("File.md")
				.setValue(value)
				.onChange(async newValue => {
					await this.plugin.chordManager.updateChordValue(index, newValue);
					this.validateChordValue(search.inputEl, index);
				});

			this.validateChordValue(search.inputEl, index);
		});
	}

	/**
	 * Adds a command name input
	 */
	private addCommandValueInput(chordSetting: Setting, value: string, index: number): void {
		chordSetting.addSearch(search => {
			new CommandSuggest(this.app, search.inputEl);
			search.inputEl.parentElement?.addClass("chords-search");
			search.setPlaceholder("Save current file")
				.setValue(value)
				.onChange(async newValue => {
					await this.plugin.chordManager.updateChordValue(index, newValue);
					this.validateChordValue(search.inputEl, index);
				});

			this.validateChordValue(search.inputEl, index);
		});
	}

	/**
	 * Adds a text input for text chords
	 */
	private addTextValueInput(chordSetting: Setting, value: string, index: number): void {
		chordSetting.addTextArea(textArea => {
			textArea.inputEl.addClass("chords-text-area");
			textArea.setPlaceholder("Text to insert, {c} for cursor")
				.setValue(value)
				.onChange(async newValue => {
					await this.plugin.chordManager.updateChordValue(index, newValue);
				});
		});
	}
}
