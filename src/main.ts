import { Plugin } from "obsidian";
import { ChordsPluginSettings, DEFAULT_SETTINGS } from "./settings/settings";
import ChordsSettingTab from "./settings/settings-tab";
import ChordManager from "./chords/chord-manager";
import { getTextTarget } from "./targets/get-text-target";

export default class ChordsPlugin extends Plugin {
	public settings: ChordsPluginSettings = { ...DEFAULT_SETTINGS, chords: [] };
	public chordManager!: ChordManager;

	/**
	 * Characters typed since the last pause longer than settings.delay
	 */
	private input = "";

	/**
	 * Element the input was typed into, a chord can't span elements
	 */
	private inputEl: EventTarget | null = null;

	private timeoutId: number | null = null;

	/**
	 * Documents (main window and popout windows) that already have a keydown listener
	 */
	private readonly listenedDocs = new WeakSet<Document>();

	public async onload(): Promise<void> {
		await this.loadSettings();

		this.chordManager = new ChordManager(this);

		this.addSettingTab(new ChordsSettingTab(this.app, this));

		// Listen in every window: the main window, popouts that are already open, and popouts opened later
		this.listenForKeys(activeDocument);
		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.iterateAllLeaves(leaf => this.listenForKeys(leaf.view.containerEl.doc));
		});
		this.registerEvent(this.app.workspace.on("window-open", win => this.listenForKeys(win.doc)));

		this.register(() => this.resetInput());
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<ChordsPluginSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			// Never share the default array, chords are mutated in place
			chords: Array.isArray(data?.chords) ? data.chords : [],
		};
	}

	private listenForKeys(doc: Document): void {
		if (this.listenedDocs.has(doc)) return;

		this.listenedDocs.add(doc);
		this.registerDomEvent(doc, "keydown", event => this.onKeydown(event));
	}

	private onKeydown(event: KeyboardEvent): void {
		// Only plain character input can form a chord; named keys (Shift, Enter, ...),
		// shortcuts, and IME composition don't insert the typed character
		if (event.key.length > 1 || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
			this.resetInput();
			return;
		}

		const target = getTextTarget(this.app, event, this.settings.enableOutsideEditor);
		if (!target) {
			this.resetInput();
			return;
		}

		if (event.target !== this.inputEl) {
			this.resetInput();
			this.inputEl = event.target;
		}

		this.input += event.key;

		// Wait for a pause in typing, then check if the input forms a chord
		this.clearTimeout();
		this.timeoutId = window.setTimeout(() => {
			const input = this.input;
			this.resetInput();
			void this.chordManager.handleChord(input, target);
		}, this.settings.delay);
	}

	private resetInput(): void {
		this.input = "";
		this.inputEl = null;
		this.clearTimeout();
	}

	private clearTimeout(): void {
		if (this.timeoutId !== null) {
			window.clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}
}
