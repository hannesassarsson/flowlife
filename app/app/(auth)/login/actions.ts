'use server'

/**
 * app/(auth)/login/actions.ts
 *
 * Follows the canonical @supabase/ssr Server Action pattern: sign in,
 * revalidatePath('/', 'layout') BEFORE redirecting, then redirect. The
 * revalidate call matters — without it, Next.js can serve a cached,
 * pre-login render of a layout to the now-authenticated user on their
 * very next navigation, which looks like a broken login even though the
 * session itself is fine.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = (formData.get('next') as string) || ''

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const params = new URLSearchParams({ error: 'Incorrect email or password.' })
    if (next) params.set('next', next)
    redirect(`/login?${params.toString()}`)
  }

  revalidatePath('/', 'layout')
  redirect(next || '/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
