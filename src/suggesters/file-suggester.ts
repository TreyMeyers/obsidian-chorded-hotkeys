import { AbstractInputSuggest, App, TFile } from "obsidian";

/**
 * Suggests Markdown file paths for a text input
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
	public constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);

		this.onSelect(file => {
			this.setValue(file.path);
			inputEl.trigger("input");
			this.close();
		});
	}

	protected getSuggestions(query: string): TFile[] {
		const lowerCaseQuery = query.toLowerCase();
		return this.app.vault.getMarkdownFiles().filter(f => f.path.toLowerCase().includes(lowerCaseQuery));
	}

	public renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}
}
