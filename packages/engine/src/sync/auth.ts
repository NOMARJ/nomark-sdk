import { loadSupabase } from './supabase-loader.js'

export type AuthConfig = {
  supabaseUrl: string
  supabaseKey: string
}

export type AuthSession = {
  user: { id: string; email: string }
}

export type AuthClient = {
  signIn: (email: string) => Promise<{ error: { message: string } | null }>
  signOut: () => Promise<{ error: { message: string } | null }>
  getSession: () => Promise<AuthSession | null>
  onAuthStateChange: (callback: (event: string, session: AuthSession | null) => void) => () => void
}

export function createAuthClient(config: AuthConfig): AuthClient {
  const supabase = loadSupabase()
  const db = supabase.createClient(config.supabaseUrl, config.supabaseKey) as SupabaseAuthClient

  return {
    async signIn(email: string) {
      const { error } = await db.auth.signInWithOtp({ email })
      return { error }
    },

    async signOut() {
      const { error } = await db.auth.signOut()
      return { error }
    },

    async getSession() {
      const { data, error } = await db.auth.getSession()
      if (error || !data.session) return null
      return {
        user: {
          id: data.session.user.id,
          email: data.session.user.email,
        },
      }
    },

    onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
      const { data } = db.auth.onAuthStateChange(
        (event: string, session: { user: { id: string; email: string } } | null) => {
          callback(
            event,
            session ? { user: { id: session.user.id, email: session.user.email } } : null
          )
        }
      )
      return () => data.subscription.unsubscribe()
    },
  }
}

type SupabaseAuthClient = {
  auth: {
    signInWithOtp: (params: { email: string }) => Promise<{ data: unknown; error: { message: string } | null }>
    signOut: () => Promise<{ error: { message: string } | null }>
    getSession: () => Promise<{
      data: { session: { user: { id: string; email: string } } | null }
      error: { message: string } | null
    }>
    onAuthStateChange: (
      callback: (event: string, session: { user: { id: string; email: string } } | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } }
  }
}
