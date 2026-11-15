import { App, PluginSettingTab, Setting } from "obsidian";
import type ChordsPlugin from "../main";
import { NO_CHORDS_CLASS } from "../targets/text-target";
import ChordListEditor from "./chord-list";
import { ChordsPluginSettings, delayToWpm, parsePositiveNumber, wpmToDelay } from "./settings";

type NoticeSettingKey =
	| "showTextChordExecuted"
	| "showTemplateChordExecuted"
	| "showFileChordExecuted"
	| "showCommandChordExecuted";

const ERROR_CLASS = "chords-error";

export default class ChordsSettingTab extends PluginSettingTab {
	private readonly plugin: ChordsPlugin;

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

		new Setting(this.containerEl)
			.setName("Commands to toggle chord groups")
			.setDesc("Add a command for each chord group that turns the group on or off, so groups can be switched from the command palette or with a hotkey. A notice shows the group's new state.")
			.addToggle(toggle => toggle
				.setValue(this.settings.groupToggleCommands)
				.onChange(async value => {
					this.settings.groupToggleCommands = value;
					this.plugin.chordManager.syncGroupCommands();
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

		new Setting(this.containerEl)
			.setName("Chords")
			.setDesc("Type a chord's keys at the same time, in any order, to trigger it. Groups organize chords and turn them on or off together.")
			.setHeading();
		new ChordListEditor(this.plugin, this.containerEl);
	}

	public hide(): void {
		this.plugin.chordManager.onGroupToggled = null;
		super.hide();
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
}
