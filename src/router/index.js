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
        path: 'patronen',
        name: 'consumer-patronen',
        component: () => import('@/views/consumer/Patronen.vue')
      },
      {
        path: 'woning',
        name: 'consumer-woning',
        component: () => import('@/views/consumer/Woning.vue')
      },
      {
        path: 'instellingen',
        name: 'consumer-instellingen',
        component: () => import('@/views/consumer/Instellingen.vue')
      },
      {
        path: 'integraties',
        name: 'consumer-integraties',
        component: () => import('@/views/consumer/Integraties.vue')
      },
      {
        path: 'hue',
        name: 'consumer-hue',
        component: () => import('@/views/consumer/HueSetup.vue')
      }
    ]
  },

  // Hue OAuth callback - MUST be outside auth-protected routes
  // This handles the callback from Philips Hue OAuth
  {
    path: '/hue/callback',
    name: 'hue-callback',
    component: () => import('@/views/consumer/HueCallback.vue'),
    meta: { requiresAuth: false }
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

  // Legacy redirects for backwards compatibility
  { path: '/dashboard', redirect: '/app/dashboard' },
  { path: '/status', redirect: '/app/status' },
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

// Navigation guard - Authentication check
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Wait for auth to initialize
  if (!authStore.initialized) {
    await authStore.checkAuth()
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (requiresGuest && authStore.isAuthenticated) {
    next(authStore.getRedirectPath())
  } else {
    next()
  }
})

export default router
