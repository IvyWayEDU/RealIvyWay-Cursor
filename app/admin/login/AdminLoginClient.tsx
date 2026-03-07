"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { useEffect, useState } from "react"
import { adminLogin } from "@/lib/auth/actions"

export default function AdminLoginClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = searchParams.get("next")
  const errorParam = searchParams.get("error")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (errorParam === "suspended") {
      setError("This account has been suspended. Please contact support for assistance.")
    }
  }, [errorParam])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const result = await adminLogin(email, password)

    if (result.success && result.redirectTo) {
      router.push(next || result.redirectTo)
    } else {
      setError(result.error || "Failed to log in")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Top Section - Blue */}
          <div className="bg-[#0088CB] px-8 py-8 flex flex-col items-center">
            {/* Logo */}
            <div className="mb-6 flex items-center justify-center">
              <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Image
                  src="/logo/ivyway-logo.png"
                  alt="IvyWay Logo"
                  width={80}
                  height={27}
                  className="object-contain"
                />
              </div>
            </div>
            
            {/* Headline */}
            <h1 className="text-white text-2xl font-semibold mb-2 text-center">
              Admin Login
            </h1>
            
            {/* Subtitle */}
            <p className="text-white text-sm text-center opacity-90">
              Administrative access only
            </p>
          </div>

          {/* Bottom Section - White */}
          <div className="px-8 py-8">
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Email and Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
                    placeholder="Enter admin email"
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
                    placeholder="Enter password"
                  />
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#0088CB] text-white py-3 px-4 rounded-md font-medium hover:bg-[#0070A3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Logging in..." : "Log in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}



