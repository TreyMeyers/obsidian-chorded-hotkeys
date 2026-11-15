/**
 * Normalizes a chord trigger so that key order doesn't matter ("hew", "weh" -> "ehw")
 * @param key chord trigger or user input
 * @returns the characters of key in sorted order
 */
export function normalizeKey(key: string): string {
	return key.split("").sort().join("");
}

type GroupMember = { groupId?: string };
type GroupState = { id: string; enabled: boolean };

/**
 * Finds the group a chord belongs to
 * @param chord chord to check
 * @param groups all chord groups
 * @returns the group, or undefined if the chord is ungrouped or its group no longer exists
 */
export function findChordGroup<G extends { id: string }>(chord: GroupMember, groups: readonly G[]): G | undefined {
	return chord.groupId === undefined ? undefined : groups.find(group => group.id === chord.groupId);
}

/**
 * Checks if a chord can be triggered
 * @param chord chord to check
 * @param groups all chord groups
 * @returns false if the chord or its group is turned off
 */
export function isChordActive(chord: GroupMember & { enabled?: boolean }, groups: readonly GroupState[] = []): boolean {
	return chord.enabled !== false && findChordGroup(chord, groups)?.enabled !== false;
}

/**
 * Name to show for a group, since groups can be left unnamed
 * @param group chord group
 * @returns the group's name, or a placeholder
 */
export function groupDisplayName(group: { name: string }): string {
	return group.name.trim() || "Untitled group";
}

/**
 * Creates an id for a new group
 * @param groups existing groups
 * @returns an id no existing group uses
 */
export function createGroupId(groups: readonly { id: string }[]): string {
	let id: string;
	do {
		id = Math.random().toString(36).slice(2, 10);
	} while (id === "" || groups.some(group => group.id === id));
	return id;
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
 * @param groupName name of the chord's group, if it has one
 * @returns if the key, value, type or group name contains the filter
 */
export function matchesChordFilter(
	chord: { key: string; value: string },
	typeName: string,
	filter: string,
	groupName = ""
): boolean {
	return [chord.key, chord.value, typeName, groupName].some(text => text.toLowerCase().includes(filter));
}
