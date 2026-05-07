import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Already authenticated → let dashboard/onboarding handle routing
  if (user) redirect('/dashboard')

  return <LoginForm />
}
