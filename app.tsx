// bb-plugin-thread-switcher — frontend entry.
//
// Click the thread name in a thread header to open a dropdown of every active
// thread, the one that most recently needed attention first. bb has no slot
// for the title itself, so an app overlay listens for clicks on the title
// element (`.bb-thread-title` in a thread header) and draws its own
// portalled dropdown under it. A double click still renames the thread.
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  definePluginApp,
  experimental_ThreadStatusGlyph as ThreadStatusGlyph,
  experimental_useSidebarThreads,
  ThreadTitle,
  useBbNavigate,
  useSidebarSplitLayout,
} from "@get-bb/plugin-sdk/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { usePortalScopeProps } from "@/lib/portal-scope";
import { cn } from "@/lib/utils";
import {
  filterThreads,
  formatAge,
  orderThreadsByAttention,
  threadIdFromPath,
} from "@/lib/order";

/** The thread name in a thread header (not in other page headers). */
const TITLE_SELECTOR = ".bb-thread-title";
const HEADER_SELECTOR = ".app-page-header-content-row";
const THREAD_HEADER_MARKER = "[data-thread-header-pane-actions]";
/** Wait this long after a click so a double click can still rename. */
const DOUBLE_CLICK_GRACE_MS = 250;
const DROPDOWN_WIDTH = 440;
const STYLE_ID = "bb-plugin-thread-switcher-style";

interface OpenState {
  anchor: DOMRect;
  /** The thread whose header was clicked, when known. */
  currentThreadId: string | null;
}

function findThreadTitle(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const title = target.closest<HTMLElement>(TITLE_SELECTOR);
  if (!title) return null;
  // The rename editor replaces the title while it is open.
  if (title.closest("input, textarea, [contenteditable='true']")) return null;
  const header = title.closest(HEADER_SELECTOR);
  if (!header?.parentElement?.querySelector(THREAD_HEADER_MARKER)) return null;
  return title;
}

/** Marks thread titles as clickable while the plugin runs. */
function useTitleAffordance() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `${HEADER_SELECTOR} ${TITLE_SELECTOR} { cursor: pointer; }
${HEADER_SELECTOR} ${TITLE_SELECTOR}:hover { text-decoration: underline; text-underline-offset: 3px; text-decoration-color: color-mix(in oklab, currentColor 40%, transparent); }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

function ThreadSwitcherOverlay() {
  const [open, setOpen] = useState<OpenState | null>(null);
  const splitLayout = useSidebarSplitLayout();
  const splitLayoutRef = useRef(splitLayout);
  splitLayoutRef.current = splitLayout;
  useTitleAffordance();

  useEffect(() => {
    let timer: number | undefined;
    const cancel = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.defaultPrevented) return;
      const title = findThreadTitle(event.target);
      if (!title) return;
      cancel();
      if (event.detail > 1) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        const paneId = title
          .closest("[data-split-pane-id]")
          ?.getAttribute("data-split-pane-id");
        const pane = splitLayoutRef.current?.panes.find(
          (candidate) => candidate.paneId === paneId,
        );
        setOpen({
          anchor: title.getBoundingClientRect(),
          currentThreadId:
            pane?.threadId ?? threadIdFromPath(window.location.pathname),
        });
      }, DOUBLE_CLICK_GRACE_MS);
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (findThreadTitle(event.target)) cancel();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("dblclick", onDoubleClick);
    return () => {
      cancel();
      document.removeEventListener("click", onClick);
      document.removeEventListener("dblclick", onDoubleClick);
    };
  }, []);

  if (!open) return null;
  return (
    <ThreadSwitcherDropdown
      anchor={open.anchor}
      currentThreadId={open.currentThreadId}
      onClose={() => setOpen(null)}
    />
  );
}

function ThreadSwitcherDropdown({
  anchor,
  currentThreadId,
  onClose,
}: {
  anchor: DOMRect;
  currentThreadId: string | null;
  onClose: () => void;
}) {
  const { status, threads, projects } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const portalScope = usePortalScopeProps();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [now] = useState(() => Date.now());

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const ordered = useMemo(() => orderThreadsByAttention(threads), [threads]);
  const visible = useMemo(
    () => filterThreads(ordered, query, projectNames),
    [ordered, query, projectNames],
  );
  const showProject = projects.length > 1;

  useEffect(() => setHighlight(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  // Close on a press outside, a resize, or a scroll outside the dropdown.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onScroll = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  const openThread = (thread: PluginSidebarThread, split: boolean) => {
    onClose();
    if (thread.id === currentThreadId && !split) return;
    navigate.toThread(thread.id, split ? { split: true } : undefined);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const thread = visible[highlight];
      if (!thread) return;
      event.preventDefault();
      openThread(thread, event.metaKey || event.ctrlKey);
    }
  };

  const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - 16);
  const left = Math.max(
    8,
    Math.min(anchor.left - 8, window.innerWidth - width - 8),
  );
  const top = anchor.bottom + 8;

  return createPortal(
    <div
      {...portalScope}
      ref={rootRef}
      role="dialog"
      aria-label="Switch thread"
      onKeyDown={onKeyDown}
      className="fixed z-[1000] flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      style={{ top, left, width, maxHeight: `calc(100vh - ${top + 16}px)` }}
    >
      <div className="border-b border-border p-2">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter threads"
          aria-label="Filter threads"
          aria-controls="bb-thread-switcher-list"
          aria-activedescendant={
            visible[highlight]
              ? `bb-thread-switcher-${visible[highlight].id}`
              : undefined
          }
          className="h-8 w-full rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <ul
        id="bb-thread-switcher-list"
        ref={listRef}
        role="listbox"
        aria-label="Active threads"
        className="min-h-0 flex-1 overflow-y-auto p-1"
      >
        {status === "loading" && visible.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>
        ) : status === "error" && visible.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            Could not load threads.
          </li>
        ) : visible.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            No matching threads.
          </li>
        ) : (
          visible.map((thread, index) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              index={index}
              isCurrent={thread.id === currentThreadId}
              isHighlighted={index === highlight}
              projectName={
                showProject ? projectNames.get(thread.projectId) : undefined
              }
              age={formatAge(thread.latestAttentionAt, now)}
              onHover={() => setHighlight(index)}
              onOpen={(split) => openThread(thread, split)}
            />
          ))
        )}
      </ul>
      <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        Enter opens · ⌘/Ctrl+Enter opens in a split · Esc closes
      </div>
    </div>,
    document.body,
  );
}

function ThreadRow({
  thread,
  index,
  isCurrent,
  isHighlighted,
  projectName,
  age,
  onHover,
  onOpen,
}: {
  thread: PluginSidebarThread;
  index: number;
  isCurrent: boolean;
  isHighlighted: boolean;
  projectName: string | undefined;
  age: string;
  onHover: () => void;
  onOpen: (split: boolean) => void;
}) {
  const detail = [projectName, thread.environment?.branchName]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      id={`bb-thread-switcher-${thread.id}`}
      role="option"
      aria-selected={isHighlighted}
      aria-current={isCurrent ? "page" : undefined}
      data-index={index}
    >
      <a
        href={thread.href}
        onMouseMove={onHover}
        onClick={(event) => {
          if (event.button !== 0 || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onOpen(event.metaKey || event.ctrlKey);
        }}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm no-underline",
          isHighlighted && "bg-accent text-accent-foreground",
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          <ThreadStatusGlyph indicator={thread.indicator} size="compact" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate",
              (thread.isUnread || thread.hasPendingInteraction) &&
                "font-medium",
              isCurrent && "text-muted-foreground",
            )}
          >
            <ThreadTitle threadId={thread.id} />
          </span>
          {detail ? (
            <span className="truncate text-xs text-muted-foreground">
              {detail}
            </span>
          ) : null}
        </span>
        {isCurrent ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            Current
          </span>
        ) : null}
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {age}
        </span>
      </a>
    </li>
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({
    id: "thread-switcher",
    component: ThreadSwitcherOverlay,
  });
});
