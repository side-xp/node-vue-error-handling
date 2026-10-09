# Vue Error Handling

Handles the routing and component errors of a Vue app at the closest level possible, so they never fail silently.

> Work in progress: the package is being implemented feature by feature, and is not published yet.

## Requirements

- **Vue ≥ 3.5**
- **Vue Router 4 or 5** (optional): only needed to handle the navigation errors.

## Install

```bash
npm install @side-xp/vue-error-handling
```

## Usage

### Install the plugin

Install the error handling on the app, **before the router**:

```ts
import { createErrorHandling } from '@side-xp/vue-error-handling'
import { createApp } from 'vue'

const app = createApp(App)
app.use(
  createErrorHandling({
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
| Errors caught by the app, and reported | `report()` | `reported` |

> Like Vue does with the errors of the components once an error handler is set, the browser doesn't log the `promise` and `global` errors anymore: they're given to `onError()` instead, which logs them by default. If you replace `onError()` (e.g. with a monitoring service), log them yourself if you still want them in the console.

### Report errors

To handle an error caught in the app's code like the others, keep the object returned by `createErrorHandling()`, and call `report()`:

```ts
// errorHandling.ts
export const errorHandling = createErrorHandling({ onError, onUnhandledError })

// main.ts
app.use(errorHandling)

// Anywhere in the app
try {
  await saveProfile()
} catch (error) {
  errorHandling.report(error)
}
```

### Each error is handled once

The same error can reach several handlers (e.g. reported, then rethrown). It's only handled the first time. To have an error ignored when it's thrown (e.g. handled by the app, but rethrown on purpose), mark it as handled:

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
| `onError(caught)` | `console.error()` | Receives every error that is not ignored. The single exit point of the errors (e.g. to plug a monitoring service) |
| `onUnhandledError(caught)` | | Receives the errors nothing else handled, after `onError()` (e.g. to display a notification) |
| `ignore(caught)` | | Returns `true` for the errors to ignore: they're given neither to `onError()` nor to `onUnhandledError()` |
| `throttleMs` | `5000` | Minimum delay before an error with the same message is given to `onUnhandledError()` again, so a repeated error doesn't flood the screen. `0` disables it |

The callbacks can't break the error handling: an error thrown by one of them is only logged with `console.error()` (handling it could loop). If `ignore()` throws, the error is not ignored.

### The `CaughtError` object

The callbacks receive a `CaughtError`, the same normalized object whatever the error is and wherever it was caught:

| Property | Description |
|---|---|
| `error` | The thrown value, as is |
| `message` | A readable message, from any thrown value. Meant for logs and developers: write the texts displayed to the users yourself (e.g. translated, from the error or its context) |
| `source` | Where the error was caught. Narrows the type of the error to get the properties of its source |

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
| `reported` | |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, the playground app and the release process.
