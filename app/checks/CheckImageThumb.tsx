'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'

interface Props {
  path: string | null
  className?: string
}

export default function CheckImageThumb({ path, className = 'h-10 w-10 object-cover rounded border cursor-pointer' }: Props) {
  const [url,     setUrl]     = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (!path) return
    createClient()
      .storage
      .from('check-images')
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [path])

  if (!path) {
    return <div className="h-10 w-10 rounded border border-dashed border-gray-200 bg-gray-50" />
  }

  if (!url) {
    return <div className="h-10 w-10 rounded border bg-gray-100 animate-pulse" />
  }

  return (
    <>
      <img
        src={url}
        alt="Çek görseli"
        onClick={() => setPreview(true)}
        className={className}
      />
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreview(false)}
        >
          <img src={url} className="max-h-[90%] max-w-[90%] rounded-lg" />
        </div>
      )}
    </>
  )
}
