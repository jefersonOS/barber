"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Calendar, Scissors, Users, Settings, LogOut, BarChart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { LanguageSwitcher } from "@/components/language-switcher"

export function DashboardSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { t } = useLanguage()

    async function handleSignOut() {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push("/login")
    }

    const sidebarItems = [
        { icon: LayoutDashboard, label: t("navbar.dashboard"), href: "/dashboard" },
        { icon: Calendar, label: t("navbar.schedule"), href: "/dashboard/schedule" },
        { icon: Scissors, label: t("navbar.services"), href: "/dashboard/services" },
        { icon: Users, label: t("navbar.professionals"), href: "/dashboard/professionals" },
        { icon: BarChart, label: t("navbar.reports"), href: "/dashboard/reports" },
        { icon: Settings, label: t("navbar.settings"), href: "/dashboard/settings" },
    ]

    return (
        <div className="flex h-full w-64 flex-col border-r bg-gray-50/40 dark:bg-gray-800/40">
            <div className="flex h-14 items-center border-b px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold">
                    <span className="text-xl">Barber<span className="text-primary">SaaS</span></span>
                </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-4 text-sm font-medium">
                    {sidebarItems.map((item, index) => {
                        const Icon = item.icon
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                    pathname === item.href
                                        ? "bg-gray-100 text-primary dark:bg-gray-800"
                                        : "text-muted-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
            </div>
            <div className="border-t p-4 space-y-2">
                <div className="px-2">
                    <LanguageSwitcher />
                </div>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    {t("navbar.signout")}

                </Button>
            </div>
        </div>
    )
}
