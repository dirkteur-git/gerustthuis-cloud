import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Layouts
import ConsumerLayout from '@/components/layout/ConsumerLayout.vue'
import BusinessLayout from '@/components/layout/BusinessLayout.vue'

const routes = [
  // Auth routes (no auth required)
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/auth/ForgotPassword.vue')
  },

  // Root redirect
  {
    path: '/',
    redirect: () => {
      const authStore = useAuthStore()
      if (authStore.isAuthenticated) {
        return authStore.getRedirectPath()
      }
      return '/login'
    }
  },

  // Consumer Dashboard (/app/*)
  {
    path: '/app',
    component: ConsumerLayout,
    meta: { requiresAuth: true, role: 'consumer' },
    children: [
      {
        path: '',
        redirect: '/app/dashboard'
      },
      {
        path: 'dashboard',
        name: 'consumer-dashboard',
        component: () => import('@/views/consumer/Dashboard.vue')
      },
      {
        path: 'status',
        name: 'consumer-status',
        component: () => import('@/views/consumer/Status.vue')
      },
      {
        path: 'alerts',
        name: 'consumer-alerts',
        component: () => import('@/views/consumer/Alerts.vue')
      },
      {
        path: 'dagboek',
        name: 'consumer-dagboek',
        component: () => import('@/views/consumer/Dagboek.vue')
      },
      {
        path: 'sensoren',
        name: 'consumer-sensoren',
        component: () => import('@/views/consumer/Sensoren.vue')
      },
      {
        path: 'familie',
        name: 'consumer-familie',
        component: () => import('@/views/consumer/Familie.vue')
      },
      {
        path: 'instellingen',
        name: 'consumer-instellingen',
        component: () => import('@/views/consumer/Instellingen.vue')
      }
    ]
  },

  // Business Dashboard (/pro/*)
  {
    path: '/pro',
    component: BusinessLayout,
    meta: { requiresAuth: true, role: 'business' },
    children: [
      {
        path: '',
        redirect: '/pro/dashboard'
      },
      {
        path: 'dashboard',
        name: 'business-dashboard',
        component: () => import('@/views/business/Dashboard.vue')
      },
      {
        path: 'kamers',
        name: 'business-kamers',
        component: () => import('@/views/business/Kamers.vue')
      },
      {
        path: 'kamers/:id',
        name: 'business-kamer-detail',
        component: () => import('@/views/business/KamerDetail.vue')
      },
      {
        path: 'bewoners',
        name: 'business-bewoners',
        component: () => import('@/views/business/Bewoners.vue')
      },
      {
        path: 'meldingen',
        name: 'business-meldingen',
        component: () => import('@/views/business/Meldingen.vue')
      },
      {
        path: 'instellingen',
        name: 'business-instellingen',
        component: () => import('@/views/business/Instellingen.vue')
      }
    ]
  },

  // Hub routes (development/internal - auth required)
  {
    path: '/hub',
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'hub',
        component: () => import('@/views/hub/StartHub.vue')
      },
      {
        path: 'business-case',
        name: 'hub-business-case',
        component: () => import('@/views/hub/BusinessCase.vue')
      },
      {
        path: 'roadmap',
        name: 'hub-roadmap',
        component: () => import('@/views/hub/Roadmap.vue')
      },
      {
        path: 'plattegrond',
        name: 'hub-floorplan',
        component: () => import('@/views/hub/FloorPlan.vue')
      },
      {
        path: 'weekoverzicht',
        name: 'hub-weekoverzicht',
        component: () => import('@/views/hub/Weekoverzicht.vue')
      },
      {
        path: 'architectuur',
        name: 'hub-architectuur',
        component: () => import('@/views/hub/Architectuur.vue')
      },
      {
        path: 'sensor-data',
        name: 'hub-sensor-data',
        component: () => import('@/views/hub/SensorData.vue')
      }
    ]
  },

  // Legacy redirects for backwards compatibility
  { path: '/dashboard', redirect: '/app/dashboard' },
  { path: '/status', redirect: '/app/status' },
  { path: '/alerts', redirect: '/app/alerts' },
  { path: '/kamers', redirect: '/pro/kamers' },
  { path: '/bewoners', redirect: '/pro/bewoners' },
  { path: '/meldingen', redirect: '/pro/meldingen' },

  // 404
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Check auth on initial load
  if (!authStore.isAuthenticated) {
    await authStore.checkAuth()
  }

  // Guest-only routes (login, register)
  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    return next(authStore.getRedirectPath())
  }

  // Protected routes
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  // Role-based access
  if (to.meta.role && authStore.isAuthenticated) {
    const userRole = authStore.role

    // Consumer trying to access business routes
    if (to.meta.role === 'business' && userRole !== 'business') {
      return next('/app/dashboard')
    }

    // Business trying to access consumer routes
    if (to.meta.role === 'consumer' && userRole === 'business') {
      return next('/pro/dashboard')
    }
  }

  next()
})

export default router
