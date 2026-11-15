/**
 * Normalizes a chord trigger so that key order doesn't matter ("hew", "weh" -> "ehw")
 * @param key chord trigger or user input
 * @returns the characters of key in sorted order
 */
export function normalizeKey(key: string): string {
	return key.split("").sort().join("");
}

/**
 * Checks if a chord can be triggered
 * @param chord chord to check
 * @returns false if the chord is turned off
 */
export function isChordActive(chord: { enabled?: boolean }): boolean {
	return chord.enabled !== false;
}

/**
 * Moves an item of an array to a new position, shifting the items in between
 * @param items array to modify
 * @param from index of the item to move
 * @param to index the item should end up at
 */
export function moveItem<T>(items: T[], from: number, to: number): void {
	if (from < 0 || from >= items.length || to < 0 || to >= items.length) return;

	const [item] = items.splice(from, 1);
	items.splice(to, 0, item as T);
}

/**
 * Finds where a dragged item ends up when it's dropped on another item
 * @param from index of the dragged item
 * @param target index of the item it was dropped on
 * @param after if it was dropped after (true) or before (false) the target
 * @returns index for the dragged item, as used by moveItem
 */
export function dropIndex(from: number, target: number, after: boolean): number {
	const to = after ? target + 1 : target;
	// Removing the dragged item shifts everything behind it up by one
	return from < to ? to - 1 : to;
}

/**
 * Checks if a chord should be shown for a filter
 * @param chord chord's key and value
 * @param typeName name of the chord's type
 * @param filter lowercase filter text, an empty filter matches everything
 * @returns if the key, value or type contains the filter
 */
export function matchesChordFilter(chord: { key: string; value: string }, typeName: string, filter: string): boolean {
	return [chord.key, chord.value, typeName].some(text => text.toLowerCase().includes(filter));
}
