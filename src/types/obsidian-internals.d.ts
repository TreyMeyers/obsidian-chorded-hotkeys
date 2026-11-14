import "obsidian";

/**
 * Typings for undocumented Obsidian internals used by this plugin.
 * These are not part of the public API and may change between Obsidian releases,
 * so every call site must handle them being missing or behaving differently.
 */
declare module "obsidian" {
	interface App {
		commands: {
			listCommands(): Command[];
			executeCommandById(id: string): boolean;
		};
		plugins: {
			plugins: Record<string, Plugin | undefined>;
			enabledPlugins: Set<string>;
		};
	}
}
