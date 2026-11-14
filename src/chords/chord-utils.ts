/**
 * Normalizes a chord trigger so that key order doesn't matter ("hew", "weh" -> "ehw")
 * @param key chord trigger or user input
 * @returns the characters of key in sorted order
 */
export function normalizeKey(key: string): string {
	return key.split("").sort().join("");
}
