import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import FunnelView from '@/views/FunnelView.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'funnel', component: FunnelView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
