# bb-plugin-thread-switcher

Click the thread name in a bb thread header to open a dropdown of all active
threads. The thread that most recently needed attention is first.

See [PLUGIN_OVERVIEW.md](PLUGIN_OVERVIEW.md) for the behaviour.

## Develop

```sh
npm install
bb plugin build
bb plugin install .
bb plugin dev     # rebuild and reload on save
```

## Files

- `app.tsx` registers an app overlay. It listens for clicks on the thread
  title and draws the dropdown.
- `lib/order.ts` holds the sort, filter, and age helpers.
- `server.ts` is an empty backend. bb requires one.
