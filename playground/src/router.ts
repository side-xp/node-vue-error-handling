import { createRouter, createWebHistory, type Router } from 'vue-router'
import { shouldPageLoadFail } from './navigationScenarios'

/** Router of the playground. Pages are lazy loaded, as in a real app, so chunk loading failures can be reproduced. */
export const router: Router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/HomePage.vue'),
    },
    {
      path: '/component-errors',
      name: 'componentErrors',
      component: () => import('./pages/ComponentErrorsPage.vue'),
    },
    {
      path: '/unhandled-errors',
      name: 'unhandledErrors',
      component: () => import('./pages/UnhandledErrorsPage.vue'),
    },
    {
      path: '/outside-errors',
      name: 'outsideErrors',
      component: () => import('./pages/OutsideErrorsPage.vue'),
    },
    {
      path: '/error-boundaries',
      name: 'errorBoundaries',
      component: () => import('./pages/ErrorBoundariesPage.vue'),
    },
    {
      path: '/navigation-errors',
      name: 'navigationErrors',
      component: () => import('./pages/NavigationErrorsPage.vue'),
    },
    {
      path: '/navigation-errors/guard-fails',
      name: 'guardFails',
      component: () => import('./pages/LoadedPage.vue'),
      beforeEnter: () => {
        throw new Error('The navigation guard failed')
      },
    },
    {
      path: '/navigation-errors/load-fails',
      name: 'loadFails',
      component: async () => {
        if (shouldPageLoadFail.value) {
          throw new Error('The page failed to load')
        }
        return import('./pages/LoadedPage.vue')
      },
    },
    {
      path: '/navigation-errors/setup-fails',
      name: 'setupFails',
      component: () => import('./pages/FailingPage.vue'),
    },
  ],
})
