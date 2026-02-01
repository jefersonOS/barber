import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    return (
        <div className="flex min-h-screen w-full">
            <div className="hidden md:block">
                <DashboardSidebar />
            </div>
            <div className="flex-1 flex flex-col">
                {/* Header could go here */}
                <main className="flex-1 p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
