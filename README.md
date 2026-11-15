# Obsidian Chorded Hotkeys 
Use 🎵 chords 🎵 to trigger text insertion, template insertion, or command execution.
A chord is a set of keys pressed at the same time, the order doesn't matter! 

## Warning
Chorded Hotkeys works through text replacement, it is advised that you create a backup of your vault before installing this plugin.

## Use Case
The use of chorded hotkeys is that it lets you quickly and easily trigger an action without using modifier keys (ctrl, alt, shift, etc). Chords are fast to use because the order of key-presses doesn't matter, you just press a set of keys at the same time, and presto, you've triggered a chord.

You might find this plugin helpful if there are specific commands you use often, templates you include frequently, or patterns of text you repeat.

## Creating Your First Chord
1. After installing, go to the Chorded Hotkeys settings tab.
2. Click 'Add new chord' it will default to a 'Text' chord, which will be a simple text insertion.
3. The first field is the chord-trigger, the set of keys to execute the chord, these are the keys you'll have to press simultaneously to trigger the chord. So keep it short, Between two and four letters work best. For now, put 'hew' in the first box.
4. The second field is the value for the chord, it's treated differently depending on the chord type. For a text chord, it's the text to insert. Put 'Hello World'.
5. That's it! Your first chord is done. To try it out: close the settings, go to a file, and press the three letters 'hew' all at the same time.

## Chord Types
The current chord types are:
1. **Text:** Inserts text. 
2. **Command:** Runs a command.
3. **File:** Pastes the contents of a file.
4. **Template:** (Requires [Templater](https://github.com/SilentVoid13/Templater)) Pastes the contents of a template. Functionally equivalent to the file chord but also evaluates templates.

*Remark*: Since the order of key-presses doesn't matter, the chord-triggers of 'hew', 'hwe', 'ehw', etc. are all considered duplicates. Each chord must have a unique trigger.

## Where Chords Work
Chords work in notes in every Obsidian window, including popout windows.

By default they also work in other text fields, such as search, the command palette, note titles, and properties. Turn off *Use chords outside the editor* in the settings to limit chords to notes. Chords never trigger in password fields or in the Chorded Hotkeys settings.

Outside the editor, template chords still need an open note for Templater, and the cursor is placed at the first `tp.file.cursor()` marker.

## Turning Chords Off
Each chord has a toggle in the settings. A chord that's turned off is kept, but can't be triggered until you turn it back on. Chords that are turned off don't count as duplicates, so several alternatives can share a trigger as long as only one is on.

## Chord Groups
Groups organize your chords and let you turn a whole set on or off at once.

- Click 'Add group' in the settings and give the group a name. Use the group's **+** button to add a chord to it, drag a chord onto a group, or use a chord's folder button to move it to another group.
- A group's toggle turns all of its chords on or off. Chords that are turned off individually stay off when their group is on.
- Groups can be collapsed to keep the list short, and deleting a group keeps its chords (they become ungrouped).
- Turn on *Commands to toggle chord groups* to get a 'Toggle group' command for every group, which you can run from the command palette or bind to a hotkey. A notice shows whether the group was enabled or disabled.

Since chords in a disabled group don't count as duplicates, groups can work as dictionaries: use the same triggers in several groups and switch between them.

## Tags 
A tag is a special element added to a chord to augment its effect.
Currently there is only one tag, the cursor tag. Adding '{c}' in the value field of a text chord will move the cursor to that position upon activation.

To insert a literal `{c}`, escape it as `\{c}`. To insert a literal backslash, use `\\`.

## Demo
https://user-images.githubusercontent.com/14039575/199102931-e87a107d-202f-42e9-8247-10f9b4d6f397.mp4

# Compare with similar plugins

**Chorded hotkeys**

- Use chords for text insertion, template insertion, or command execution.
- Any set of keys can be used as a trigger, the triggering method is to press all the keys at once (like you're playing a musical chord).

**Key sequence shortcut**

- Limited to commands.
- Type Ctrl-M to open a menu, then input your character sequence to trigger.

**Sequence hotkeys**, **Hotkeys chords**

- Limited to commands.
- Sequence of hotkeys (event keys required) to trigger commands.