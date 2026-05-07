import AppShell from './AppShell'

interface Props {
  userEmail: string
  title: string
  description?: string
}

export default function ComingSoon({ userEmail, title, description }: Props) {
  return (
    <AppShell userEmail={userEmail}>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-20 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          <p className="mt-1.5 text-sm text-gray-500">{description ?? 'Bu modül hazırlanıyor.'}</p>
          <p className="mt-1 text-xs text-gray-400">Yakında aktif olacak.</p>
        </div>
      </main>
    </AppShell>
  )
}
