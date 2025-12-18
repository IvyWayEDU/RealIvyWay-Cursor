"use client"

import { useSearchParams } from "next/navigation"

export default function LoginClient() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next")

  return (
    <div>
      {/* Your existing login UI stays here */}
    </div>
  )
}
