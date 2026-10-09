import { createRouter, createWebHistory, type Router } from 'vue-router'

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
  ],
})
