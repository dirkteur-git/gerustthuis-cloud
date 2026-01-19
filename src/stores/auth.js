import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import router from '@/router'
import { supabase } from '@/services/supabase'

export const useAuthStore = defineStore('auth', () => {

  // State
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(false)
  const error = ref('')

  // Computed
  const isAuthenticated = computed(() => !!user.value)

  const userInitials = computed(() => {
    if (!profile.value) return ''
    const first = profile.value.first_name?.[0] || ''
    const last = profile.value.last_name?.[0] || ''
    return (first + last).toUpperCase()
  })

  // Role-based computed properties
  const role = computed(() => profile.value?.role || null)
  const isConsumer = computed(() => role.value === 'consumer')
  const isBusiness = computed(() => role.value === 'business')
  const isAdmin = computed(() => role.value === 'admin')

  const organization = computed(() => profile.value?.organization || null)
  const household = computed(() => profile.value?.household || null)

  // Fetch user profile from profiles table
  async function fetchProfile(userId) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return null
    }

    return data
  }

  // Actions
  async function login(credentials) {
    loading.value = true
    error.value = ''

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email || credentials.username,
        password: credentials.password
      })

      if (authError) {
        error.value = authError.message === 'Invalid login credentials'
          ? 'Ongeldige inloggegevens'
          : authError.message
        return false
      }

      user.value = data.user
      profile.value = await fetchProfile(data.user.id)

      // Redirect based on role
      if (profile.value?.role === 'business') {
        router.push('/pro/dashboard')
      } else {
        router.push('/app/dashboard')
      }

      return true
    } catch (e) {
      console.error('Login error:', e)
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName
          }
        }
      })

      if (authError) {
        error.value = authError.message
        return false
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'consumer'
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
      }

      user.value = authData.user
      profile.value = await fetchProfile(authData.user.id)

      router.push('/app/dashboard')
      return true
    } catch (e) {
      console.error('Registration error:', e)
      error.value = 'Registratie mislukt'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
    router.push('/login')
  }

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      user.value = session.user
      profile.value = await fetchProfile(session.user.id)
      return true
    }

    return false
  }

  async function forgotPassword(email) {
    loading.value = true
    error.value = ''

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (resetError) {
        error.value = resetError.message
        return false
      }

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
    return profile.value?.role === 'business' ? '/pro/dashboard' : '/app/dashboard'
  }

  // Listen for auth changes
  supabase?.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      user.value = session.user
      profile.value = await fetchProfile(session.user.id)
    } else if (event === 'SIGNED_OUT') {
      user.value = null
      profile.value = null
    }
  })

  return {
    // State
    user,
    profile,
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
