import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import SignupForm from './SignupForm'

export default async function SignupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Any authenticated user → dashboard (onboarding handles missing profile)
  if (user) redirect('/dashboard')

  return <SignupForm />
}
