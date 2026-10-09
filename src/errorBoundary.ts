import {
  type ComponentInternalInstance,
  type ComponentPublicInstance,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  onErrorCaptured,
  type PropType,
  type Ref,
  ref,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from 'vue'
import { createComponentError } from './caughtErrors'
import { ERROR_HANDLING_KEY, type ErrorHandlingContext } from './errorHandling'
import { callSafely } from './safeCalls'
import type {
  ComponentError,
  ErrorBoundaryActions,
  ErrorBoundaryProps,
  ErrorBoundarySlots,
  ErrorFilter,
  VuePhase,
} from './types'

/** Phases of the errors that prevent the content from being displayed: the content is replaced by the fallback. */
const BREAKING_PHASES: ReadonlySet<VuePhase> = new Set(['setup', 'render', 'mount', 'asyncComponent'])

/** Default errors handled by an error boundary: the ones that prevent its content from being displayed. */
const DEFAULT_FILTER: ErrorFilter = [...BREAKING_PHASES]

/** Checks if an error prevents the content from being displayed. */
function isBreakingError(caught: ComponentError): boolean {
  return BREAKING_PHASES.has(caught.phase)
}

/** Checks if an error matches the given filter. A filter function that fails doesn't match, so the error continues. */
function matchesFilter(caught: ComponentError, filter: ErrorFilter): boolean {
  return typeof filter === 'function' ? callSafely(filter, caught) === true : filter.includes(caught.phase)
}

/** Gets the error handling installed on the app. */
function injectErrorHandling(): ErrorHandlingContext {
  const context: ErrorHandlingContext | undefined = inject(ERROR_HANDLING_KEY, undefined)
  if (!context) {
    throw new Error(
      'ErrorBoundary requires the error handling: install it with `app.use(createErrorHandling())` first.',
    )
  }
  return context
}

/**
 * Renders the content of an error boundary.
 * Vue gives the errors of plain elements and template expressions to the component that renders them, and starts
 * looking for `onErrorCaptured()` hooks from its parent: rendering the content in this child component lets the
 * boundary capture them too.
 */
const ErrorBoundaryContent = defineComponent(
  (_props, { slots }) =>
    () =>
      slots.default?.(),
  { name: 'ErrorBoundaryContent' },
)

/**
 * Handles the errors of its content at the closest level possible:
 * - The errors that prevent the content from being displayed replace it with the `fallback` slot.
 * - The other handled errors are given to the `default` slot, to display them next to the content.
 * - The errors it doesn't handle continue to the parent boundaries, then to the app.
 */
export const ErrorBoundary = defineComponent(
  (props: ErrorBoundaryProps, { slots }) => {
    const context: ErrorHandlingContext = injectErrorHandling()

    /** The error handled by this boundary, if any. */
    const error: ShallowRef<ComponentError | null> = shallowRef(null)

    /** Key of the content, changed to display it again from scratch. */
    const contentKey: Ref<number> = ref(0)

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
    function canHandle(caught: ComponentError): boolean {
      if (!matchesFilter(caught, props.filter ?? DEFAULT_FILTER)) {
        return false
      }
      // Without a fallback, the content can't be replaced: a parent boundary may do it
      if (isBreakingError(caught) && !slots.fallback) {
        return false
      }
      // Ignored errors continue to the app, where they're ignored too
      return !context.isIgnored(caught)
    }

    onErrorCaptured((thrown, instance, info) => {
      if (!isFromContent(instance)) {
        return
      }

      const caught: ComponentError = createComponentError(thrown, instance, info)
      if (!canHandle(caught)) {
        return
      }

      context.handleBoundaryError(caught)
      error.value = caught
      // Stops the propagation to the parent boundaries and the app
      return false
    })

    const actions: ErrorBoundaryActions = {
      retry(): void {
        error.value = null
        contentKey.value++
      },

      clear(): void {
        error.value = null
      },
    }

    return (): VNodeChild => {
      const currentError: ComponentError | null = error.value
      if (currentError && isBreakingError(currentError) && slots.fallback) {
        return slots.fallback({ ...actions, error: currentError })
      }
      return h(ErrorBoundaryContent, { key: contentKey.value }, () =>
        slots.default?.({ ...actions, error: currentError }),
      )
    }
  },
  {
    name: 'ErrorBoundary',
    props: {
      filter: { type: [Array, Function] as PropType<ErrorFilter>, required: false },
    },
    slots: Object as SlotsType<ErrorBoundarySlots>,
  },
)
