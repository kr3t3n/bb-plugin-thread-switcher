---
name: thread-switcher
description: Explains the Thread Switcher plugin, which opens a list of active threads when the user clicks the thread name in a thread header. Use when the user asks how the dropdown works or why it does not open.
---

# Thread Switcher

The Thread Switcher plugin has no CLI command and no agent tool. It changes
only the bb app.

- A single click on the thread name in a thread header opens the dropdown.
- The dropdown lists active, visible threads. It sorts them by
  `latestAttentionAt`, newest first.
- A double click on the thread name still renames the thread. The dropdown
  waits 250 ms after a click so that a double click can cancel it.
- On a phone-sized window, bb uses the header as a scroll-to-top button, so
  the dropdown does not open there.

If the dropdown does not open after a bb upgrade, the thread header markup
probably changed. The plugin finds the title with the `.bb-thread-title`
selector inside the header row
`[data-testid='app-page-header-content-row']`, which also holds
`[data-thread-header-pane-actions]`.
