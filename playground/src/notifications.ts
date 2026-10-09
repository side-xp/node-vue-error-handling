import { type ShallowReactive, shallowReactive } from 'vue'

/** How long a notification stays displayed. */
const NOTIFICATION_DURATION_MS = 4_000

/** A notification displayed on screen. */
export interface Notification {
  id: number
  text: string
}

/** Notifications currently displayed. */
export const notifications: ShallowReactive<Notification[]> = shallowReactive([])

/** Id of the next notification. */
let nextId = 0

/** Displays a notification for a few seconds. */
export function notify(text: string): void {
  const notification: Notification = { id: nextId++, text }
  notifications.push(notification)
  setTimeout(() => {
    notifications.splice(notifications.indexOf(notification), 1)
  }, NOTIFICATION_DURATION_MS)
}
