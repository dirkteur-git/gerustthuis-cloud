import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()

  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('gerustthuis_token') || null)
  const loading = ref(false)
  const error = ref('')

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  const userInitials = computed(() => {
    if (!user.value) return ''
    const first = user.value.firstName?.[0] || ''
    const last = user.value.lastName?.[0] || ''
    return (first + last).toUpperCase()
  })

  // Role-based computed properties
  const role = computed(() => user.value?.role || null)
  const isConsumer = computed(() => role.value === 'consumer')
  const isBusiness = computed(() => role.value === 'business')
  const isAdmin = computed(() => role.value === 'admin')

  const organization = computed(() => user.value?.organization || null)
  const household = computed(() => user.value?.household || null)

  // Actions
  async function login(credentials) {
    loading.value = true
    error.value = ''

    try {
      // Demo authentication - check against environment variables or demo credentials
      const demoUsers = {
        // Consumer demo user
        'demo@gerustthuis.nl': {
          password: 'demo123',
          user: {
            id: 'consumer-1',
            username: 'demo',
            firstName: 'Jan',
            lastName: 'de Vries',
            email: 'demo@gerustthuis.nl',
            role: 'consumer',
            household: {
              id: 'household-1',
              name: 'Familie de Vries',
              elderName: 'Oma Ans'
            }
          }
        },
        // Business demo user
        'zorg@gerustthuis.nl': {
          password: 'zorg123',
          user: {
            id: 'business-1',
            username: 'zorginstelling',
            firstName: 'Marianne',
            lastName: 'Bakker',
            email: 'zorg@gerustthuis.nl',
            role: 'business',
            organization: 'Zorginstelling De Eik'
          }
        }
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))

      const demoUser = demoUsers[credentials.username] || demoUsers[credentials.email]

      if (demoUser && demoUser.password === credentials.password) {
        const newToken = 'demo-token-' + Date.now()
        token.value = newToken
        user.value = demoUser.user
        localStorage.setItem('gerustthuis_token', newToken)
        localStorage.setItem('gerustthuis_user', JSON.stringify(demoUser.user))

        // Redirect based on role
        if (demoUser.user.role === 'business') {
          router.push('/pro/dashboard')
        } else {
          router.push('/app/dashboard')
        }

        return true
      } else {
        error.value = 'Ongeldige inloggegevens'
        return false
      }
    } catch (e) {
      error.value = 'Er is een fout opgetreden'
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(data) {
    loading.value = true
    error.value = ''

    try {
      await new Promise(resolve => setTimeout(resolve, 500))

      // Demo registration - create consumer account
      const newUser = {
        id: 'consumer-' + Date.now(),
        username: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: 'consumer',
        household: null
      }

      const newToken = 'demo-token-' + Date.now()
      token.value = newToken
      user.value = newUser
      localStorage.setItem('gerustthuis_token', newToken)
      localStorage.setItem('gerustthuis_user', JSON.stringify(newUser))

      router.push('/app/dashboard')
      return true
    } catch (e) {
      error.value = 'Registratie mislukt'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('gerustthuis_token')
    localStorage.removeItem('gerustthuis_user')
    router.push('/login')
  }

  async function checkAuth() {
    const storedToken = localStorage.getItem('gerustthuis_token')
    const storedUser = localStorage.getItem('gerustthuis_user')

    if (storedToken && storedUser) {
      try {
        token.value = storedToken
        user.value = JSON.parse(storedUser)
        return true
      } catch (e) {
        logout()
        return false
      }
    }

    return false
  }

  async function forgotPassword(email) {
    loading.value = true
    error.value = ''

    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      return true
    } catch (e) {
      error.value = 'Kon geen reset e-mail versturen'
      return false
    } finally {
      loading.value = false
    }
  }

  // Get redirect path based on user role
  function getRedirectPath() {
    if (!user.value) return '/login'
    return user.value.role === 'business' ? '/pro/dashboard' : '/app/dashboard'
  }

  return {
    // State
    user,
    token,
    loading,
    error,

    // Computed
    isAuthenticated,
    userInitials,
    role,
    isConsumer,
    isBusiness,
    isAdmin,
    organization,
    household,

    // Actions
    login,
    register,
    logout,
    checkAuth,
    forgotPassword,
    getRedirectPath
  }
})
