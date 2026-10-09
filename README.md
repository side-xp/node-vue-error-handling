# Vue Error Handling

Handles the routing and component errors of a Vue app at the closest level possible, so they never fail silently.

> Work in progress: the package is being implemented feature by feature, and is not published yet.

## Requirements

- **Vue ≥ 3.5**
- **Vue Router 4 or 5** (optional): only needed to handle the navigation errors.
- **Vite** (optional): the chunk loading failures (e.g. after a new deployment) are detected out of the box in the apps built with Vite. With another bundler, give the detection to the `isChunkLoadError` option.

## Install

```bash
npm install @side-xp/vue-error-handling
```

## Usage

### Install the plugin

Install the error handling on the app, **before the router** (so the errors of the first navigation are handled):

```ts
import { createErrorHandling } from '@side-xp/vue-error-handling'
import { createApp } from 'vue'

const app = createApp(App)
app.use(
  createErrorHandling({
    // To handle the navigation errors (optional)
    router,
    // Every error (e.g. to plug a monitoring service)
    onError: (caught) => monitoring.capture(caught.error),
    // The errors nothing else handled (e.g. with any notification system)
    onUnhandledError: (caught) => toast.error('Something went wrong.'),
  }),
)
app.use(router)
app.mount('#app')
```

Every error is given to `onError()`, then to `onUnhandledError()` if nothing else handled it. Without `onError()`, the errors are logged with `console.error()`.

> An error handler already set on the app (`app.config.errorHandler`) before installing the plugin still receives the errors. The handlers are removed when the app is unmounted.

### Caught errors

The errors are caught from all their sources:

| Errors | Caught through | `source` |
|---|---|---|
| Errors of the components (setup, render, hooks, watchers, event handlers declared in templates...) | `app.config.errorHandler` | `component` |
| Promises rejected without being awaited or caught | `unhandledrejection` event | `promise` |
| Errors thrown outside of Vue (timers, listeners added with `addEventListener()`...) | `error` event | `global` |
| Errors caught by the app, and reported | `report()` (see [Report errors](#report-errors)) | `reported` |
| Navigation guards that throw, pages that fail to load (with the `router` option) | `router.onError()` | `navigation` |

> Like Vue does with the errors of the components once an error handler is set, the browser doesn't log the `promise` and `global` errors anymore: they're given to `onError()` instead, which logs them by default. If you replace `onError()` (e.g. with a monitoring service), log them yourself if you still want them in the console.

### Error boundaries

Wrap any part of the app with an `ErrorBoundary` to handle its errors in place, instead of breaking the page or reaching `onUnhandledError()`:

```vue
<script setup lang="ts">
import { ErrorBoundary } from '@side-xp/vue-error-handling'
</script>

<template>
  <!-- A widget that can't be displayed is replaced by its fallback, the rest of the page still works -->
  <ErrorBoundary>
    <WeatherWidget />
    <template #fallback="{ error, retry }">
      <p>The weather couldn't be loaded.</p>
      <button @click="retry">Retry</button>
    </template>
  </ErrorBoundary>

  <!-- The errors of a button are displayed under it, instead of a notification -->
  <ErrorBoundary :filter="['eventHandler']" v-slot="{ error, clear }">
    <button @click="clear(); save()">Save</button>
    <p v-if="error">The profile couldn't be saved.</p>
  </ErrorBoundary>
</template>
```

An error goes up from the component where it happened, and stops at the first boundary that handles it. A boundary only handles the errors it can display:

- The errors that prevent its content from being displayed (`setup`, `render`, `mount` and `asyncComponent` phases), and the errors reported by its content (see [Report errors](#report-errors)), replace the content with the `fallback` slot. Without a `fallback` slot, the boundary doesn't handle them.
- The other errors leave the content usable: the content stays, and the `default` slot receives the error, to display it next to the content.
- The errors that don't match its `filter` continue to the parent boundaries, then to `onUnhandledError()`. By default, a boundary only handles the errors that prevent its content from being displayed, and the reported errors.

The errors handled by a boundary are still given to `onError()` (e.g. for monitoring), but not to `onUnhandledError()`. The ignored errors are not handled by the boundaries.

| Prop | Default | Description |
|---|---|---|
| `navigation` | `false` | Also displays the navigation errors (see [Page boundary and navigation errors](#page-boundary-and-navigation-errors)) |
| `filter` | `['setup', 'render', 'mount', 'asyncComponent', 'reported']` | The errors to handle: a list of phases (and `'reported'` for the reported errors), or a function that returns `true` for the errors to handle (it receives the `CaughtError`) |

Both slots receive the `error` (`null` in the `default` slot when there's none), and the actions:

- `retry()`: clears the error, and displays the content again from scratch (e.g. an async component loads again). For a navigation error, navigates to the page again.
- `clear()`: clears the error, without displaying the content again from scratch.

> The errors of the `fallback` slot continue to the parent boundaries. The errors of plain elements and template expressions placed directly in the boundary are handled too (Vue normally skips the boundary for them: the boundary renders its content through an internal child component to prevent it).

### Page boundary and navigation errors

Wrap the router view with a boundary to handle the errors of the pages (e.g. in `App.vue`). With the `navigation` prop, it also displays the navigation errors (a navigation guard that throws, a page that fails to load), which no component threw:

```vue
<template>
  <AppHeader />
  <ErrorBoundary navigation>
    <RouterView />
    <template #fallback="{ error, retry }">
      <p>This page can't be displayed.</p>
      <button @click="retry">Retry</button>
    </template>
  </ErrorBoundary>
</template>
```

- `retry()` navigates to the page again if it failed to load, or displays it again from scratch.
- The error is cleared after each successful navigation: the user can leave it with any link, or the back button of the browser.
- Without a navigation boundary (or without its `fallback` slot), the navigation errors go to `onUnhandledError()`.

> Use a single navigation boundary (e.g. around the root router view, not the nested ones): a navigation that fails aborts the whole navigation. With several, the first one mounted displays the errors.

### Chunk loading failures (new deployments)

When a new version of the app is deployed, the chunks of the previous version are no longer served: the users still running it fail to load the pages they haven't visited yet. When a navigation fails this way, the page is loaded again, which gets the new version:

- At most once every 10 seconds (recorded in `sessionStorage`): if the page still fails to load, the navigation boundary displays the error instead of reloading in a loop. Without storage, the page is never loaded again automatically.
- Only for the navigation errors, which give the page to load. The other failures (e.g. an async component) are flagged with `isChunkLoadError`, to react in a fallback (e.g. offer to reload the app).
- Disable it with `reloadOnChunkLoadError: false`.

```vue
<ErrorBoundary navigation>
  <RouterView />
  <template #fallback="{ error, retry }">
    <template v-if="error.isChunkLoadError">
      <p>A new version of the app is available.</p>
      <button @click="reloadApp">Reload</button>
    </template>
    <template v-else>
      <p>This page can't be displayed.</p>
      <button @click="retry">Retry</button>
    </template>
  </template>
</ErrorBoundary>
```

The failures are detected from Vite's [`vite:preloadError`](https://vite.dev/guide/build#load-error-handling) event, since the browsers give them different messages. Vite only dispatches it in production builds: while developing, these errors are handled like the others. With another bundler, give the detection to the `isChunkLoadError` option, e.g. with webpack:

```ts
createErrorHandling({
  router,
  isChunkLoadError: (error) => error instanceof Error && error.name === 'ChunkLoadError',
})
```

### Report errors

Some errors never reach Vue: the ones caught by the app on purpose (`try...catch`), or thrown in callbacks that Vue doesn't call (timers, sockets, third-party libraries). Report them to handle them like the others.

In a component, use `useErrorHandling()` (in its `setup()`): the reported error goes to the closest error boundary first, then to the parent boundaries, then to `onUnhandledError()`, like a thrown error.

```vue
<script setup lang="ts">
import { useErrorHandling } from '@side-xp/vue-error-handling'

const { report } = useErrorHandling()

socket.on('message', (message) => {
  try {
    applyUpdate(message)
  } catch (error) {
    report(error)
  }
})
</script>
```

A reported error means the component can't work properly anymore: a boundary replaces its content with the `fallback` slot (and `retry()` displays it again from scratch). To display a reported error next to the content instead, keep it in the component's own state.

> The errors reported from the `fallback` slot of a boundary go to its parent boundaries. The errors reported after the boundary is unmounted (e.g. by a timer that wasn't cleared) go to `onUnhandledError()`.

Outside of a component, keep the object returned by `createErrorHandling()`, and call its `report()`. The error goes straight to `onUnhandledError()`, since there's no boundary to give it to:

```ts
// errorHandling.ts
export const errorHandling = createErrorHandling({ onError, onUnhandledError })

// main.ts
app.use(errorHandling)

// Anywhere in the app (e.g. a store)
try {
  await saveProfile()
} catch (error) {
  errorHandling.report(error)
}
```

### Each error is handled once

The same error can reach several handlers (e.g. reported, then rethrown). It's only given to `onError()` and `onUnhandledError()` the first time. An error boundary still displays an error that was already handled (e.g. a cached failure thrown again after a retry), since its content can't be displayed anyway. To have an error ignored when it's thrown (e.g. handled by the app, but rethrown on purpose), mark it as handled:

```ts
import { markAsHandled } from '@side-xp/vue-error-handling'

try {
  await saveProfile()
} catch (error) {
  displayFormError(error)
  markAsHandled(error)
  throw error
}
```

The handled errors are recorded in a `WeakSet`: the error objects are not modified, and not kept in memory. Primitive values (e.g. `throw 'message'`) can't be recorded: they're handled every time they reach a handler, and can't be marked as handled.

### Options

| Option | Default | Description |
|---|---|---|
| `router` | | The router of the app, to handle the navigation errors |
| `onError(caught)` | `console.error()` | Receives every error that is not ignored. The single exit point of the errors (e.g. to plug a monitoring service) |
| `onUnhandledError(caught)` | | Receives the errors nothing else handled, after `onError()` (e.g. to display a notification) |
| `ignore(caught)` | | Returns `true` for the errors to ignore: they're given neither to `onError()` nor to `onUnhandledError()` |
| `throttleMs` | `5000` | Minimum delay before an error with the same message is given to `onUnhandledError()` again, so a repeated error doesn't flood the screen. `0` disables it |
| `reloadOnChunkLoadError` | `true` | Whether the page is loaded again when a navigation fails to load a chunk (see [Chunk loading failures](#chunk-loading-failures-new-deployments)) |
| `isChunkLoadError(error)` | | Returns `true` for the chunk loading failures, in addition to the ones reported by Vite (e.g. with another bundler) |

The callbacks can't break the error handling: an error thrown by one of them is only logged with `console.error()` (handling it could loop). If `ignore()` throws, the error is not ignored.

### The `CaughtError` object

The callbacks receive a `CaughtError`, the same normalized object whatever the error is and wherever it was caught:

| Property | Description |
|---|---|
| `error` | The thrown value, as is |
| `message` | A readable message, from any thrown value. Meant for logs and developers: write the texts displayed to the users yourself (e.g. translated, from the error or its context) |
| `source` | Where the error was caught. Narrows the type of the error to get the properties of its source |
| `isChunkLoadError` | Whether a lazy loaded chunk failed to load (e.g. a page or an async component, after a new deployment) |

#### Component errors (`source: 'component'`)

The errors thrown by the components, caught by Vue: setup, render, lifecycle hooks, watchers, event handlers declared in templates (including the promises rejected by async handlers)...

| Property | Description |
|---|---|
| `phase` | The phase of the component in which the error happened (see below) |
| `instance` | The component in which the error happened, if any |
| `vueInfo` | The source given by Vue, as is. Its form differs between development builds (e.g. `'setup function'`) and production builds (e.g. `'https://vuejs.org/error-reference/#runtime-0'`) |

| Phase | Errors of |
|---|---|
| `setup` | The setup of the component (including `<script setup>`, and the `beforeCreate` and `created` hooks) |
| `render` | The render of the component, on mount or after a data change |
| `mount` | The `beforeMount` or `mounted` hooks |
| `update` | The `beforeUpdate` or `updated` hooks, or a component update |
| `unmount` | The `beforeUnmount` or `unmounted` hooks |
| `hook` | Other lifecycle hooks (e.g. `activated`, `errorCaptured`) |
| `watcher` | The getter, callback or cleanup of a watcher |
| `eventHandler` | An event handler declared in a template (native or component event) |
| `asyncComponent` | The loader of an async component (`defineAsyncComponent()`) |
| `other` | Other errors caught by Vue (e.g. directives, transitions, template refs, scheduler) |

#### Other errors

| `source` | Properties |
|---|---|
| `promise` | `event`: the `unhandledrejection` event (e.g. to get the rejected `promise`) |
| `global` | `event`: the `error` event (e.g. to get the file and line of the error). For a script loaded from another origin without CORS, the browser hides the error: `error` is `null`, and `message` is `'Script error.'` |
| `reported` | `instance`: the component that reported the error with `useErrorHandling()`, or `null` when reported with the `report()` of `createErrorHandling()` |
| `navigation` | `to`: the route the navigation was going to. `from`: the route it was coming from |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, the playground app and the release process.
