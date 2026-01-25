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
  const initialized = ref(false)

  // Promise to wait for initialization
  let initPromise = null
  let initResolve = null

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
    if (!userId) return null

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        return null
      }

      // If no profile exists, create one
      if (!data) {
        const { data: session } = await supabase.auth.getSession()
        const userEmail = session?.session?.user?.email || ''

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail,
            role: 'consumer'
          })
          .select()
          .single()

        if (createError) {
          return null
        }

        return newProfile
      }

      return data
    } catch (e) {
      return null
    }
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
      initialized.value = true

      // Redirect based on role
      if (profile.value?.role === 'business') {
        router.push('/pro/dashboard')
      } else {
        router.push('/app/dashboard')
      }

      return true
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName
          },
          emailRedirectTo: `${window.location.origin}/app/dashboard`
        }
      })

      if (authError) {
        error.value = authError.message
        return false
      }

      // Create household for new user
      const householdName = data.firstName
        ? `${data.firstName}'s Woning`
        : `Mijn Woning`

      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .insert({ name: householdName })
        .select()
        .single()

      if (!householdError) {
        // Add user as admin of the household
        const { error: memberError } = await supabase
          .from('household_members')
          .insert({
            household_id: householdData.id,
            user_id: authData.user.id,
            role: 'admin',
            accepted_at: new Date().toISOString()
          })

      }

      // Create profile with household reference
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'consumer',
          household_id: householdData?.id
        })

      user.value = authData.user
      profile.value = await fetchProfile(authData.user.id)
      initialized.value = true

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
    try {
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (e) {
      // Ignore logout errors
    }
    user.value = null
    profile.value = null
    initialized.value = false
    router.push('/login')
  }

  async function checkAuth() {
    // Already initialized
    if (initialized.value) {
      return !!user.value
    }

    // Wait for the init promise if it exists
    if (initPromise) {
      await initPromise
      return !!user.value
    }

    // Fallback: do our own check
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        initialized.value = true
        return false
      }

      if (session?.user) {
        user.value = session.user
        profile.value = await fetchProfile(session.user.id)
        initialized.value = true
        return true
      }

      initialized.value = true
      return false
    } catch (e) {
      initialized.value = true
      return false
    }
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

  // Initialize auth state from existing session on load
  // This runs immediately when the store is created
  initPromise = new Promise((resolve) => {
    initResolve = resolve
  })

  // Single unified auth state handler using onAuthStateChange
  // This is more reliable than getSession() which can have race conditions
  if (!supabase) {
    console.error('[Auth] Supabase client not available - cannot initialize auth')
    initialized.value = true
    if (initResolve) {
      initResolve()
      initResolve = null
    }
  } else {
    supabase.auth.onAuthStateChange(async (event, session) => {
    // Handle both INITIAL_SESSION and SIGNED_IN for initialization
    // Some Supabase versions send SIGNED_IN instead of INITIAL_SESSION on page load
    if (event === 'INITIAL_SESSION' || (event === 'SIGNED_IN' && !initialized.value)) {
      // First event after page load - contains existing session if any
      if (session?.user) {
        user.value = session.user
        // Fetch profile in background - don't block initialization
        fetchProfile(session.user.id).then(p => {
          profile.value = p
        }).catch(() => {})
      }
      initialized.value = true
      if (initResolve) {
        initResolve()
        initResolve = null
      }
    } else if (event === 'SIGNED_IN' && session?.user) {
      // User just signed in (after already initialized)
      if (!user.value || user.value.id !== session.user.id) {
        user.value = session.user
        profile.value = await fetchProfile(session.user.id)
      }
    } else if (event === 'SIGNED_OUT') {
      user.value = null
      profile.value = null
      initialized.value = true
      if (initResolve) {
        initResolve()
        initResolve = null
      }
    }
  })
  }

  return {
    // State
    user,
    profile,
    loading,
    error,
    initialized,

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
