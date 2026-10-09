import { createRouter, createWebHistory, type Router } from 'vue-router'
import HomePage from './pages/HomePage.vue'

/** Router of the webpack playground. The deployed page is lazy loaded, so its chunk can be deleted after the build. */
export const router: Router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/deployed-page',
      name: 'deployedPage',
      component: () => import(/* webpackChunkName: "DeployedPage" */ './pages/DeployedPage.vue'),
    },
  ],
})
