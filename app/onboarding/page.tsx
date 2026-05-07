import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  // Already onboarded → go to dashboard
  if (profile?.company_id) redirect('/dashboard')

  return <OnboardingForm />
}
