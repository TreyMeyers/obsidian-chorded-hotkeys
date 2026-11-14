import { Editor, Plugin } from "obsidian";
import { ChordsPluginSettings, DEFAULT_SETTINGS } from "./settings/settings";
import ChordsSettingTab from "./settings/settings-tab";
import ChordManager from "./chords/chord-manager";

export default class ChordsPlugin extends Plugin {
	public settings: ChordsPluginSettings = { ...DEFAULT_SETTINGS, chords: [] };
	public chordManager!: ChordManager;

	/**
	 * Characters typed since the last pause longer than settings.delay
	 */
	private input = "";
	private timeoutId: number | null = null;

	public async onload(): Promise<void> {
		await this.loadSettings();

		this.chordManager = new ChordManager(this);

		this.addSettingTab(new ChordsSettingTab(this.app, this));

		// Listen in every window, including popout windows opened later
		this.app.workspace.onLayoutReady(() => {
			const docs = new Set<Document>([activeDocument]);
			this.app.workspace.iterateAllLeaves(leaf => {
				docs.add(leaf.view.containerEl.doc);
			});
			docs.forEach(doc => this.listenForKeys(doc));
		});
		this.registerEvent(this.app.workspace.on("window-open", win => this.listenForKeys(win.doc)));
		this.register(() => this.resetInput());
	}

	private listenForKeys(doc: Document): void {
		this.registerDomEvent(doc, "keydown", event => this.onKeydown(event));
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

	private getActiveEditor(): Editor | null {
		return this.app.workspace.activeEditor?.editor ?? null;
	}

	private onKeydown(event: KeyboardEvent): void {
		const editor = this.getActiveEditor();
		if (!editor?.hasFocus()) return;

		// Only plain character input can form a chord; named keys (Shift, Enter, ...),
		// shortcuts, and IME composition don't insert the typed character into the editor
		if (event.key.length > 1 || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
			this.resetInput();
			return;
		}

		this.input += event.key;

		// Wait for a pause in typing, then check if the input forms a chord
		this.clearTimeout();
		this.timeoutId = window.setTimeout(() => {
			const input = this.input;
			this.resetInput();
			void this.chordManager.handleChord(input, editor);
		}, this.settings.delay);
	}

	private resetInput(): void {
		this.input = "";
		this.clearTimeout();
	}

	private clearTimeout(): void {
		if (this.timeoutId !== null) {
			window.clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}
}
