import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import AdminLoginClient from "./AdminLoginClient"

export default async function AdminLoginPage() {
  // If already logged in as admin, redirect to admin dashboard
  const session = await getSession();
  if (session?.user?.role === 'admin') {
    redirect('/admin');
  }

  return (
    <Suspense fallback={null}>
      <AdminLoginClient />
    </Suspense>
  )
}

