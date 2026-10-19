// bb-plugin-thread-switcher — backend entry.
//
// The plugin is frontend-only: app.tsx adds the thread-title dropdown. The
// backend only logs that the plugin loaded.
import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");
}
