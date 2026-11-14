/**
 * Matches Templater's `<% tp.file.cursor() %>` markers, same pattern Templater uses
 */
const CURSOR_MARKER = /<%\s*tp\.file\.cursor\((?<order>(?:-?[0-9]+(?:\.[0-9]+)?)?)\)\s*%>/g;

/**
 * Removes Templater cursor markers from text
 * @param content rendered template
 * @returns text without markers, and the offset of the first marker to jump to (lowest order), or the end of the text
 */
export function resolveCursorMarkers(content: string): { text: string; cursorOffset: number } {
	let text = "";
	let lastIndex = 0;
	let cursor: { offset: number; order: number } | null = null;

	for (const match of content.matchAll(CURSOR_MARKER)) {
		text += content.slice(lastIndex, match.index);
		lastIndex = match.index + match[0].length;

		const order = Number(match.groups?.order || 0);
		if (cursor === null || order < cursor.order) {
			cursor = { offset: text.length, order };
		}
	}

	text += content.slice(lastIndex);
	return { text, cursorOffset: cursor?.offset ?? text.length };
}
