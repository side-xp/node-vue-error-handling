import {
  type ComponentInternalInstance,
  type ComponentPublicInstance,
  defineComponent,
  getCurrentInstance,
  h,
  type InjectionKey,
  inject,
  onErrorCaptured,
  onUnmounted,
  type PropType,
  provide,
  type Ref,
  ref,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from 'vue'
import { createComponentError } from './caughtErrors'
import { type ErrorHandlingContext, injectErrorHandling, type NavigationBoundaryHandle } from './errorHandling'
import { callSafely } from './safeCalls'
import type {
  BoundaryError,
  ComponentError,
  ErrorBoundaryActions,
  ErrorBoundaryProps,
  ErrorBoundarySlots,
  ErrorFilter,
  NavigationError,
  ReportedError,
  VuePhase,
} from './types'

/** What the content of an error boundary gets from it, to report errors to it. */
export interface ErrorBoundaryHandle {
  /** The closest parent boundary, if any. */
  parent: ErrorBoundaryHandle | null
  /** Handles an error reported by the content, if the boundary can. Returns `true` if it handled it. */
  handleReportedError(caught: ReportedError): boolean
}

/** Injection key of the closest error boundary, provided to its content only (not to its fallback). */
export const ERROR_BOUNDARY_KEY: InjectionKey<ErrorBoundaryHandle | null> = Symbol('errorBoundary')

/** Phases of the errors that prevent the content from being displayed: the content is replaced by the fallback. */
const BREAKING_PHASES: ReadonlySet<VuePhase> = new Set(['setup', 'render', 'mount', 'asyncComponent'])

/** Default errors handled by an error boundary: the ones that prevent its content from being displayed. */
const DEFAULT_FILTER: ErrorFilter = [...BREAKING_PHASES, 'reported']

/**
 * Checks if an error prevents the content from being displayed.
 * A reported error does: the component reports it because it can't work properly anymore. A navigation error does
 * too: the page couldn't be loaded.
 */
function isBreakingError(caught: BoundaryError): boolean {
  return caught.source !== 'component' || BREAKING_PHASES.has(caught.phase)
}

/** Checks if an error matches the given filter. A filter function that fails doesn't match, so the error continues. */
function matchesFilter(caught: ComponentError | ReportedError, filter: ErrorFilter): boolean {
  if (typeof filter === 'function') {
    return callSafely(filter, caught) === true
  }
  return filter.includes(caught.source === 'reported' ? 'reported' : caught.phase)
}

/**
 * Renders the content of an error boundary, and provides the boundary to it.
 * Vue gives the errors of plain elements and template expressions to the component that renders them, and starts
 * looking for `onErrorCaptured()` hooks from its parent: rendering the content in this child component lets the
 * boundary capture them too.
 */
const ErrorBoundaryContent = defineComponent(
  (props: { boundary: ErrorBoundaryHandle }, { slots }) => {
    provide(ERROR_BOUNDARY_KEY, props.boundary)
    return () => slots.default?.()
  },
  {
    name: 'ErrorBoundaryContent',
    props: {
      boundary: { type: Object as PropType<ErrorBoundaryHandle>, required: true },
    },
  },
)

/**
 * Handles the errors of its content at the closest level possible:
 * - The errors that prevent the content from being displayed (and the reported errors) replace it with the
 *   `fallback` slot.
 * - The other handled errors are given to the `default` slot, to display them next to the content.
 * - The errors it doesn't handle continue to the parent boundaries, then to the app.
 *
 * A navigation boundary (`navigation` prop) also displays the navigation errors.
 */
export const ErrorBoundary = defineComponent(
  (props: ErrorBoundaryProps, { slots }) => {
    const context: ErrorHandlingContext = injectErrorHandling('ErrorBoundary')

    /** The error handled by this boundary, if any. */
    const error: ShallowRef<BoundaryError | null> = shallowRef(null)

    /** Key of the content, changed to display it again from scratch. */
    const contentKey: Ref<number> = ref(0)

    /** Whether this boundary is unmounted: it can't display the errors reported afterwards (e.g. by a timer). */
    let isUnmounted = false
    onUnmounted(() => {
      isUnmounted = true
    })

    /** This boundary. */
    const self: ComponentInternalInstance | null = getCurrentInstance()

    /**
     * Checks if an error comes from the content, from the component in which it happened.
     * The content is rendered by `ErrorBoundaryContent`, so its errors come through it. The errors of the fallback
     * don't: they go to the parent boundaries, otherwise a failing fallback would never be displayed anywhere.
     */
    function isFromContent(instance: ComponentPublicInstance | null): boolean {
      // A template ref on the content wouldn't work: it's not set yet when the content fails during its first mount
      let current: ComponentInternalInstance | null = instance?.$ ?? null
      while (current && current.parent !== self) {
        current = current.parent
      }
      return (current?.type as unknown) === ErrorBoundaryContent
    }

    /** Checks if this boundary handles the given error, and can display it. */
    function canHandle(caught: BoundaryError): boolean {
      const isAccepted: boolean =
        caught.source === 'navigation'
          ? props.navigation === true
          : matchesFilter(caught, props.filter ?? DEFAULT_FILTER)
      if (!isAccepted) {
        return false
      }
      // Without a fallback, the content can't be replaced: a parent boundary may do it
      if (isBreakingError(caught) && !slots.fallback) {
        return false
      }
      // Ignored errors continue to the app, where they're ignored too
      return !context.isIgnored(caught)
    }

    /** Handles the given error, if this boundary can. Returns `true` if it handled it. */
    function tryHandle(caught: BoundaryError): boolean {
      if (!canHandle(caught)) {
        return false
      }
      context.handleBoundaryError(caught, { name: props.name })
      error.value = caught
      return true
    }

    onErrorCaptured((thrown, instance, info) => {
      if (!isFromContent(instance)) {
        return
      }
      // Stops the propagation to the parent boundaries and the app
      return tryHandle(createComponentError(thrown, instance, info, context.isChunkLoadError)) ? false : undefined
    })

    const handle: ErrorBoundaryHandle = {
      parent: inject(ERROR_BOUNDARY_KEY, null),

      handleReportedError(caught: ReportedError): boolean {
        return !isUnmounted && tryHandle(caught)
      },
    }

    const navigationHandle: NavigationBoundaryHandle = {
      handleNavigationError: (caught: NavigationError): boolean => tryHandle(caught),

      clearAfterNavigation(): void {
        error.value = null
      },
    }

    /** Unregisters this boundary from the navigation boundaries, while it's one. */
    let unregisterNavigation: (() => void) | null = null

    // Registered at setup (the first one mounted displays the navigation errors), then whenever the prop changes
    watch(
      () => props.navigation,
      (isNavigation) => {
        if (isNavigation && !unregisterNavigation) {
          unregisterNavigation = context.registerNavigationBoundary(navigationHandle)
        } else if (!isNavigation && unregisterNavigation) {
          unregisterNavigation()
          unregisterNavigation = null
          // It doesn't display the navigation errors anymore
          if (error.value?.source === 'navigation') {
            error.value = null
          }
        }
      },
      { immediate: true },
    )
    onUnmounted(() => unregisterNavigation?.())

    const actions: ErrorBoundaryActions = {
      retry(): void {
        const retriedError: BoundaryError | null = error.value
        error.value = null
        // The page wasn't loaded: navigating to it again loads it from scratch
        if (retriedError?.source === 'navigation') {
          void context.retryNavigation(retriedError)
        } else {
          contentKey.value++
        }
      },

      clear(): void {
        error.value = null
      },
    }

    return (): VNodeChild => {
      const currentError: BoundaryError | null = error.value
      if (currentError && isBreakingError(currentError) && slots.fallback) {
        return slots.fallback({ ...actions, error: currentError })
      }
      return h(ErrorBoundaryContent, { key: contentKey.value, boundary: handle }, () =>
        slots.default?.({ ...actions, error: currentError }),
      )
    }
  },
  {
    name: 'ErrorBoundary',
    props: {
      name: { type: String, required: false },
      filter: { type: [Array, Function] as PropType<ErrorFilter>, required: false },
      navigation: { type: Boolean, default: false },
    },
    slots: Object as SlotsType<ErrorBoundarySlots>,
  },
)
