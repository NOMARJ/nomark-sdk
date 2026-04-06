export type SupabaseModule = {
  createClient: (url: string, key: string) => unknown
}

export function loadSupabase(): SupabaseModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@supabase/supabase-js') as SupabaseModule
  } catch {
    throw new Error(
      '@supabase/supabase-js is required for sync features. Install it: npm install @supabase/supabase-js'
    )
  }
}
