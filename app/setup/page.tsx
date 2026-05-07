import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import SetupForm from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()

  // Already logged in → go to dashboard
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return <SetupForm />
}
