import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";

/**
 * The threads the switcher lists: visible active threads, the one that most
 * recently needed attention first. Ties fall back to the latest update.
 */
export function orderThreadsByAttention(
  threads: readonly PluginSidebarThread[],
): PluginSidebarThread[] {
  return threads
    .filter((thread) => !thread.isArchived && !thread.isHidden)
    .sort(
      (a, b) =>
        b.latestAttentionAt - a.latestAttentionAt || b.updatedAt - a.updatedAt,
    );
}

/** Keeps threads whose title, project, or branch contains every query word. */
export function filterThreads(
  threads: readonly PluginSidebarThread[],
  query: string,
  projectNames: ReadonlyMap<string, string>,
): PluginSidebarThread[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...threads];
  return threads.filter((thread) => {
    const haystack = [
      thread.displayTitle,
      projectNames.get(thread.projectId) ?? "",
      thread.environment?.branchName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** A short age such as "now", "5m", "3h", or "2d". */
export function formatAge(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

/** The thread id in an app path such as `/projects/p/threads/thr_x`. */
export function threadIdFromPath(pathname: string): string | null {
  const match = /\/threads\/([^/?#]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}
