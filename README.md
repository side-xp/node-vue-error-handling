# Vue Error Handling

Handles the routing and component errors of a Vue app at the closest level possible, so they never fail silently.

---
> 🤖 This package has mostly been implemented using AI coding assistant to solve problems we had to deal with on several of our apps. It looks promising, brings a real solution, but expect some questionable implementation or use cases that are not covered yet.
> We will refine this package and its usage over time.
---

- [Why this package](#why-this-package)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
  - [Install the plugin](#install-the-plugin)
  - [Caught errors](#caught-errors)
  - [Error boundaries](#error-boundaries)
  - [Built-in components](#built-in-components)
  - [Page boundary and navigation errors](#page-boundary-and-navigation-errors)
  - [Chunk loading failures (new deployments)](#chunk-loading-failures-new-deployments)
  - [Report errors](#report-errors)
  - [Each error is handled once](#each-error-is-handled-once)
  - [Server-side rendering](#server-side-rendering)
  - [Development warnings](#development-warnings)
  - [Options](#options)
  - [The `CaughtError` object](#the-caughterror-object)
  - [TypeScript](#typescript)
- [Recipes](#recipes)
  - [Notifications](#notifications)
  - [Monitoring](#monitoring)
  - [Translated messages in the fallbacks](#translated-messages-in-the-fallbacks)
- [Known issues](#known-issues)
- [Limitations and alternatives](#limitations-and-alternatives)
- [Contributing](#contributing)
- [License](#license)

## Why this package

Vue gives the building blocks: `app.config.errorHandler` for the app, and the `onErrorCaptured()` hook for a part of it. This package is a single plugin built on them, that defines the policy of the whole app (what is handled where, what reaches the user, what is logged), with error boundaries that follow it:

- **Every error goes through one place.** The errors of the components, the navigation errors (guards that throw, pages that fail to load), the errors thrown outside of Vue (timers, listeners, promises never awaited) and the errors reported by the app all reach a single `onError()`, including the ones a boundary handled (with the boundary that handled them). Monitoring is set up once, not per boundary.
- **Only the errors nothing handled reach the user**, through `onUnhandledError()`: throttled, each error given once.
- **The boundaries know Vue's phases.** By default, a boundary only replaces its content for the errors that prevent it from being displayed (setup, render, async component...). The others (e.g. a failing click handler) leave the content usable, and can be displayed next to it with a `filter`. The phases are read in the development and production builds of Vue alike.
- **The boundaries cover their whole content**: the errors of plain elements and template expressions placed directly in a boundary (that Vue gives to the parent component), and the errors reported by the components of its content (`useErrorHandling().report()`).
- **A fallback that fails is never left blank**: its errors go to the parent boundaries, which display their own fallback.
- **The navigation errors are displayed by the page boundary**, and cleared by the next navigation (including a link to the current page), with nothing to reset by hand.
- **New deployments**: a navigation that fails to load a chunk of the previous version loads the page again, without looping.
- **Readable messages and logs**: a message from any thrown value (including the objects with a `message`, like many API errors), and the default logs keep the context that Vue stops logging once an error handler is set (e.g. the component trace).

It doesn't come with reporters or integrations: plug any notification system and monitoring service into its callbacks (see [Recipes](#recipes)). See [Limitations and alternatives](#limitations-and-alternatives) for what it doesn't do.

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

Every error is given to `onError()`, then to `onUnhandledError()` if nothing else handled it. Without `onError()`, the errors are logged with `logCaughtError()`: with `console.error()`, and their context (where they were caught, the phase and the component trace of the component errors, the target route of the navigation errors...). Vue doesn't log the component trace anymore once an error handler is set. To keep these logs with your own `onError()`, call it yourself:

```ts
import { createErrorHandling, logCaughtError } from '@side-xp/vue-error-handling'

createErrorHandling({
  onError: (caught, info) => {
    // With `info`, the log also tells which error boundary handled the error
    logCaughtError(caught, info)
    monitoring.capture(caught.error)
  },
})
```

> An error handler already set on the app (`app.config.errorHandler`, e.g. by a monitoring service) before installing the plugin still receives the errors, as Vue would give them without the plugin: the component errors that no error boundary stopped, including the ignored and already handled ones (it isn't affected by the options of the plugin). The handlers are removed when the app is unmounted.

### Caught errors

The errors are caught from all their sources:

| Errors | Caught through | `source` |
|---|---|---|
| Errors of the components (setup, render, hooks, watchers, event handlers declared in templates...) | `app.config.errorHandler` | `component` |
| Promises rejected without being awaited or caught | `unhandledrejection` event | `promise` |
| Errors thrown outside of Vue (timers, listeners added with `addEventListener()`...) | `error` event | `global` |
| Errors caught by the app, and reported | `report()` (see [Report errors](#report-errors)) | `reported` |
| Navigation guards that throw, pages that fail to load (with the `router` option) | `router.onError()` | `navigation` |

> Like Vue does with the errors of the components once an error handler is set, the browser doesn't log the `promise` and `global` errors anymore: they're given to `onError()` instead, which logs them by default. If you replace `onError()` (e.g. with a monitoring service), call `logCaughtError()` in it if you still want them in the console.

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

The errors handled by a boundary are still given to `onError()` (e.g. for monitoring), but not to `onUnhandledError()`. The second argument of `onError()` tells how the error was handled: its `handledBy` is the boundary that handled it (`{ name }`, with the `name` prop of the boundary), or `null` if no boundary handled it. E.g. to report the errors handled by a boundary with a lower severity:

```ts
createErrorHandling({
  onError: (caught, { handledBy }) =>
    monitoring.capture(caught.error, {
      level: handledBy ? 'warning' : 'error',
      tags: { boundary: handledBy?.name },
    }),
})
```

The ignored errors are not handled by the boundaries.

| Prop | Default | Description |
|---|---|---|
| `name` | | Name of the boundary, given to `onError()` with the errors it handles (e.g. to tag them in a monitoring service) |
| `navigation` | `false` | Also displays the navigation errors (see [Page boundary and navigation errors](#page-boundary-and-navigation-errors)). Can be changed at any time: once disabled, the boundary clears the navigation error it displays |
| `filter` | `['setup', 'render', 'mount', 'asyncComponent', 'reported']` | The errors to handle: a list of phases (and `'reported'` for the reported errors), or a function that returns `true` for the errors to handle (it receives the `CaughtError`) |

Both slots receive the `error` (`null` in the `default` slot when there's none), and the actions:

- `retry()`: clears the error, and displays the content again from scratch (e.g. an async component loads again, except after a chunk loading failure in some browsers: see [Chunk loading failures](#chunk-loading-failures-new-deployments)). For a navigation error, navigates to the page again.
- `clear()`: clears the error, without displaying the content again from scratch.

> The errors of the `fallback` slot continue to the parent boundaries. The errors of plain elements and template expressions placed directly in the boundary are handled too (Vue normally skips the boundary for them: the boundary renders its content through an internal child component to prevent it).

### Built-in components

**`<Suspense>`**: the errors of the async setups (`async setup()`, top-level `await` in `<script setup>`) are handled like the other `setup` errors. Place the boundary **around** the `<Suspense>` (see [Known issues](#known-issues)): `retry()` then displays it again from scratch, and the async setups run again.

```vue
<ErrorBoundary>
  <Suspense>
    <Dashboard />
    <template #fallback>Loading...</template>
  </Suspense>
  <template #fallback="{ retry }">
    <button @click="retry">Retry</button>
  </template>
</ErrorBoundary>
```

**`<KeepAlive>`**: where the boundary is placed decides what is kept:

- A boundary **around** the `<KeepAlive>` replaces it with its fallback, cache included: after `retry()`, the cached components start from scratch.
- A boundary **inside** the `<KeepAlive>` (cached with the component it wraps) keeps its error while deactivated: it still displays its fallback when activated again, until `retry()`. The other cached components are kept.
- The errors of the `activated` and `deactivated` hooks have the `hook` phase: they leave the content, and continue to the app unless a boundary's `filter` accepts them.

```vue
<KeepAlive>
  <ErrorBoundary :key="tab">
    <component :is="tabs[tab]" />
    <template #fallback="{ retry }">
      <button @click="retry">Retry</button>
    </template>
  </ErrorBoundary>
</KeepAlive>
```

**`<Transition>`**: a boundary around a `<Transition>` (e.g. the page boundary around a router view with transitions) handles the errors of the components it displays, once they enter (with `mode="out-in"`, after the previous one has left). The errors of the JavaScript hooks of the transition (e.g. `@enter`) have the `other` phase: they leave the content, and continue to the app unless a boundary's `filter` accepts them.

```vue
<ErrorBoundary navigation>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <template #fallback="{ retry }">
    <button @click="retry">Retry</button>
  </template>
</ErrorBoundary>
```

**`<Teleport>`**: the errors go up the components, not the DOM. A boundary handles the errors of the content it teleports elsewhere (e.g. a modal in `<body>`), and its fallback replaces the teleport (the teleported content is removed from its target). A boundary placed inside a `<Teleport>` displays its fallback in the target.

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

- `retry()` navigates to the page again if it failed to load (with `router.push()`), or displays it again from scratch. The router doesn't tell how the failed navigation was made: retrying a `replace()` or a back/forward navigation adds a history entry. To navigate differently, use the route of the error in the fallback (e.g. `router.replace(error.to.fullPath)`, or `router.back()`).
- The error is cleared after each successful navigation: the user can leave it with any link, or the back button of the browser. Including a link to the current page: after a navigation error, the router stays on the previous page (e.g. a "Home" link, when the navigation from Home failed), and a link to the page that failed displays it again from scratch.
- Without a navigation boundary (or without its `fallback` slot), the navigation errors go to `onUnhandledError()`.

> Use a single navigation boundary (e.g. around the root router view, not the nested ones): a navigation that fails aborts the whole navigation. With several, the first one mounted displays the errors.

**Mount the navigation boundary before the first navigation ends.** Until a page is displayed, the router is on its start location, which matches no route. A boundary rendered from the route (e.g. inside a layout chosen from `route.meta`, or behind a `v-if` on the route) isn't mounted when the first navigation fails. Neither is any boundary when the app waits for `router.isReady()` before `app.mount()`. The error then goes to `onUnhandledError()` while the screen is empty, with `isInitialNavigation: true` (see [Blocking error screen](#blocking-error-screen)). A development warning is displayed in this case. With layouts chosen from the route, place the boundary around the layout instead of inside it, and wrap its fallback in a layout of its own (`LAYOUTS` maps the names of the layouts to their components):

```vue
<RouterView v-slot="{ Component, route }">
  <ErrorBoundary navigation>
    <component :is="LAYOUTS[route.meta.layout]" v-if="Component">
      <component :is="Component" />
    </component>
    <template #fallback="{ retry }">
      <DefaultLayout>
        <p>This page can't be displayed.</p>
        <button @click="retry">Retry</button>
      </DefaultLayout>
    </template>
  </ErrorBoundary>
</RouterView>
```

### Chunk loading failures (new deployments)

When a new version of the app is deployed, the chunks of the previous version are no longer served: the users still running it fail to load the pages they haven't visited yet. When a navigation fails this way, the page is loaded again, which gets the new version:

- At most once every 10 seconds (recorded in `sessionStorage`): if the page still fails to load, the navigation boundary displays the error instead of reloading in a loop. Without storage, the page is never loaded again automatically.
- Only for the navigation errors, which give the page to load. The other failures (e.g. an async component) are flagged with `isChunkLoadError`, to react in a fallback (e.g. offer to reload the app).
- `retry()` can't fix a chunk loading failure in every browser: Chrome keeps the failure of a module that failed to load, and gives it again to every `import()` of the same URL until the page is reloaded (even once the chunk is available again). Firefox loads it again. Offer to reload the app for these errors instead (as below).
- Disable it with `reloadOnChunkLoadError: false`.

```vue
<script setup lang="ts">
/** Loads the app again, which gets the chunks of the new version. */
function reloadApp(): void {
  window.location.reload()
}
</script>

<template>
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
</template>
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

> With several Vue apps on the same page (e.g. widgets, micro-frontends) using the same copy of the package, the record is shared by all of them. An error thrown outside of Vue (`promise` and `global` errors, which every app listens to) is only handled by the first app that receives it, and `markAsHandled()` applies to every app. Primitive values still reach every app. Apps bundled with their own copy of the package each have their own record.

### Server-side rendering

The plugin can be installed on an app rendered on a server: it doesn't access `window` there. On the server, only the errors of the components and of the navigations are caught (there are no `promise` and `global` errors), and the page is never loaded again after a chunk loading failure. See [Known issues](#known-issues) for the boundaries.

### Development warnings

In development, the package warns about the setups that can't work as intended, with Vue's warnings (they're removed from the production builds of the app):

- A boundary without a `fallback` slot that can never handle an error: with the `navigation` prop, or with a `filter` that only accepts the errors that need a fallback (e.g. the default one).
- A `navigation` boundary without the `router` option of `createErrorHandling()`.
- Several navigation boundaries mounted at once.
- The first navigation failed without a navigation boundary mounted (no page is displayed, see [Page boundary and navigation errors](#page-boundary-and-navigation-errors)).
- The error handling installed after the router (the errors of the first navigation may be missed).
- The error handling installed twice on the same app (the second one is skipped).

Like Vue's own warnings, they go through `app.config.warnHandler` if it's set and they're given while a component renders (e.g. the setup of a boundary), otherwise to the console (e.g. the warnings at install).

A misuse that can't work at all throws an error instead, in every build:

- An `ErrorBoundary`, or `useErrorHandling()`, in an app without the error handling installed.
- `useErrorHandling()` called outside of the `setup()` of a component (use the `report()` of `createErrorHandling()` instead).

### Options

| Option | Default | Description |
|---|---|---|
| `router` | | The router of the app, to handle the navigation errors |
| `onError(caught, info)` | `logCaughtError()` | Receives every error that is not ignored, and how it was handled (`info.handledBy`: the error boundary that handled it, or `null`). The single exit point of the errors (e.g. to plug a monitoring service) |
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
| `message` | A readable message, from any thrown value (including the objects that are not errors but have a `message`, e.g. `{ message, code }`). Meant for logs and developers: write the texts displayed to the users yourself (e.g. translated, from the error or its context) |
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
| `navigation` | `to`: the route the navigation was going to. `from`: the route it was coming from. Both are `RouteLike`: their common properties (`fullPath`, `path`, `name`, `params`, `query`, `hash`, `meta`, `matched`), so the package doesn't need the types of Vue Router. For the full route, resolve it with `router.resolve(caught.to.fullPath)`. `isInitialNavigation`: whether it's the first navigation of the app, so no page is displayed yet |

#### Keeping caught errors

A `CaughtError` keeps references to what it was caught from: the component (`instance`), the event, the routes. If the app keeps the caught errors (e.g. a list of the recent errors in a store), it also keeps these in memory, including the components that were unmounted since (and their whole tree). Keep only what you need instead, e.g.:

```ts
onError: (caught) => {
  recentErrors.push({
    message: caught.message,
    source: caught.source,
    phase: caught.source === 'component' ? caught.phase : undefined,
    // In `<script setup>`, the name is set with `defineOptions({ name })`
    component: caught.source === 'component' ? caught.instance?.$options.name : undefined,
  })
}
```

### TypeScript

The package is written in TypeScript, and ships its types. They don't depend on the types of Vue Router: the apps without it don't need them.

| Types | Description |
|---|---|
| `CaughtError` | Any caught error: a union of the types below, narrowed by its `source` |
| `ComponentError`, `PromiseRejectionError`, `GlobalError`, `ReportedError`, `NavigationError` | The caught errors of each `source` |
| `ErrorSource`, `VuePhase` | The values of `source` and `phase` |
| `BoundaryError` | The errors a boundary can display (`component`, `reported` and `navigation` errors), as given to its slots |
| `HandlingInfo`, `HandlingBoundary` | The second argument of `onError()` (`handledBy`) |
| `ErrorHandlingOptions`, `ErrorHandling` | The options of `createErrorHandling()`, and the object it returns |
| `ErrorBoundaryProps`, `ErrorBoundarySlots`, `ErrorBoundaryActions`, `ErrorFilter` | The props, slots and actions of `ErrorBoundary`, and its `filter` |
| `UseErrorHandlingReturn` | What `useErrorHandling()` returns |
| `RouterLike`, `RouteLike` | The router and the routes, as the package uses them. The router and the routes of Vue Router 4 and 5 match them |

The slots of `ErrorBoundary` are typed in the templates (checked by `vue-tsc`). With render functions, `h()` doesn't type the slots of a component (a limitation of Vue): type each slot function with `ErrorBoundarySlots`, e.g. `const fallback: ErrorBoundarySlots['fallback'] = ({ error, retry }) => ...`.

## Recipes

The examples use placeholders for the other libraries of the app: `toast` (any notification system), `monitoring` (any monitoring service), and `t()` (any translation function, e.g. the one of `useI18n()` with vue-i18n).

### Notifications

Notify the user of the errors that nothing else handled. The package never writes the texts displayed to the users: choose them from the error.

```ts
createErrorHandling({
  onUnhandledError: (caught) => {
    toast.error(caught.isChunkLoadError ? t('errors.newVersion') : t('errors.generic'))
  },
})
```

The same message is notified at most once every 5 seconds (see the `throttleMs` option), so a repeated error doesn't flood the screen. To skip the errors the users don't need to know about, use `ignore()` (they're not given to `onError()` either), or check them in `onUnhandledError()`.

### Blocking error screen

When the first navigation fails and no navigation boundary is mounted (e.g. the app waits for `router.isReady()` before mounting), no page is displayed: a notification would show over an empty screen. Display a blocking error screen instead:

```ts
createErrorHandling({
  router,
  onUnhandledError: (caught) => {
    if (caught.source === 'navigation' && caught.isInitialNavigation) {
      // Any screen of the app that offers to reload it (e.g. with `window.location.reload()`)
      showBlockingErrorScreen(caught)
      return
    }
    toast.error(t('errors.generic'))
  },
})
```

### Monitoring

Send every error to a monitoring service, with its context:

```ts
import { createErrorHandling, logCaughtError } from '@side-xp/vue-error-handling'

createErrorHandling({
  onError: (caught, info) => {
    // Keeps the logs in the console, with their context
    logCaughtError(caught, info)
    monitoring.capture(caught.error, {
      // The errors handled by a boundary didn't break the page
      level: info.handledBy ? 'warning' : 'error',
      tags: {
        source: caught.source,
        phase: caught.source === 'component' ? caught.phase : undefined,
        boundary: info.handledBy?.name,
        chunkLoadError: caught.isChunkLoadError,
      },
    })
  },
  // e.g. the requests aborted on purpose
  ignore: (caught) => caught.error instanceof DOMException && caught.error.name === 'AbortError',
})
```

> Some monitoring services come with their own Vue integration, which sets `app.config.errorHandler`. Installed before the plugin, it still receives the component errors (see [Install the plugin](#install-the-plugin)), but not the errors handled by the boundaries, the navigation errors or the reported ones. Choose one way to send the errors, so they're not sent twice: the integration of the service, or `onError()`.

### Translated messages in the fallbacks

Write the texts of the fallbacks from the error: its `source`, its `phase`, `isChunkLoadError`, or the error itself (e.g. an error class of the app):

```vue
<script setup lang="ts">
import { type BoundaryError, ErrorBoundary } from '@side-xp/vue-error-handling'

/** Gets the text displayed to the user for the given error. */
function getErrorText(error: BoundaryError): string {
  if (error.isChunkLoadError) {
    return t('errors.newVersion')
  }
  if (error.error instanceof ApiError && error.error.status === 404) {
    return t('errors.notFound')
  }
  if (error.source === 'navigation') {
    return t('errors.pageNotLoaded')
  }
  return t('errors.cantDisplay')
}
</script>

<template>
  <ErrorBoundary navigation>
    <RouterView />
    <template #fallback="{ error, retry }">
      <p>{{ getErrorText(error) }}</p>
      <button @click="retry">{{ t('errors.retry') }}</button>
    </template>
  </ErrorBoundary>
</template>
```

`caught.message` is meant for the logs and the developers: it's the technical message of the error, never translated.

## Known issues

- **Boundary inside a `<Suspense>` that is still loading**: it can't replace an async setup that fails with its fallback. Vue renders the failed component after its error, while the boundary already replaced it, and crashes (`Cannot read properties of null (reading 'insertBefore')`). It happens with any `onErrorCaptured()` hook, even without this package. Place the boundary around the `<Suspense>` instead. Once the `<Suspense>` is resolved, the boundaries inside it work as usual.
- **Boundary rendered on a server**: it handles the errors of its content (they're given to `onError()` as handled by the boundary), but the server renders the failed content (empty) instead of the fallback. The server renders the app in a single pass: the boundary is already rendered when its content fails. Vue's `onErrorCaptured()` has the same limitation. In the browser:
  - If the content fails again while hydrating, the boundary displays its fallback, without hydration mismatch.
  - If the content only failed on the server (e.g. a request that only failed there), it's displayed in the browser, and Vue reports a hydration mismatch (`Hydration completed but contains mismatches.`) like for any difference between the server and the browser.

## Limitations and alternatives

This package focuses on the error handling policy of the app and its boundaries. It doesn't include:

- **Reporters** for the monitoring services (Sentry, Bugsnag, OpenTelemetry...), rate-limiting of the reports, or breadcrumbs: plug the service of your choice into `onError()` (see [Monitoring](#monitoring)).
- **Automatic resets**: no clearing of a boundary when a value changes (like `resetKeys` in other libraries), no limit on the retries, no retry with backoff. Call `retry()` or `clear()` from the slots, or change the `key` of the boundary to display its content again from scratch.
- **Combined components and data fetching integrations**: no component combining `<Suspense>` and a boundary, no integration with data fetching libraries (e.g. resetting the failed queries of TanStack Query on retry).
- **Testing utilities and a devtools panel.**
- **Nuxt**: not supported, nor tested. Nuxt has its own error handling (`<NuxtErrorBoundary>`, its own `errorHandler`).
- **Older versions**: Vue 3.5 or later only (no Vue 2, no Vue 3.4 or earlier).

Other packages may fit better (as of October 2026):

- [`vue-error-boundary-kit`](https://github.com/macrulezru/vue-error-boundary-kit): a toolkit with these out of the box: reporters for the monitoring services, `resetKeys`, limited retries and retries with backoff, a component combining `<Suspense>` and a boundary, TanStack Query and Nuxt integrations, testing utilities and a devtools history (Vue 3.4 or later).
- [`vue-error-boundary`](https://github.com/dillonchanis/vue-error-boundary): a minimal boundary component (a fallback component and an error callback), for an app that only needs a boundary, without handling at the app level.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, the playground app and the release process.

## License

This project is licensed under the [MIT License](./LICENSE.md).

---

Crafted and maintained with love by [Sideways Experiments](https://sideways-experiments.com)

(c) 2022-2026 Sideways Experiments
