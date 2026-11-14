import { AbstractInputSuggest, App, Command } from "obsidian";

/**
 * Suggests command names for a text input
 */
export class CommandSuggest extends AbstractInputSuggest<Command> {
	public constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);

		this.onSelect(command => {
			this.setValue(command.name);
			inputEl.trigger("input");
			this.close();
		});
	}

	protected getSuggestions(query: string): Command[] {
		const lowerCaseQuery = query.toLowerCase();
		return this.app.commands.listCommands().filter(c => c.name.toLowerCase().includes(lowerCaseQuery));
	}

	public renderSuggestion(command: Command, el: HTMLElement): void {
		el.setText(command.name);
	}
}
