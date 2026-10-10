import { describe, expectTypeOf, it } from 'vitest'
import type { RouteLocationNormalized, RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { RouteLike, RouterLike } from '@/types'

// Checked by the type-checking (`npm run verify`): the library declares its own router types, so the apps without
// `vue-router` don't need its types, but the router of the apps that have it must still match them
describe('router types', () => {
  it('accept the router of Vue Router', () => {
    expectTypeOf<Router>().toExtend<RouterLike>()
  })

  it('accept the routes of Vue Router', () => {
    expectTypeOf<RouteLocationNormalized>().toExtend<RouteLike>()
    expectTypeOf<RouteLocationNormalizedLoaded>().toExtend<RouteLike>()
  })
})
