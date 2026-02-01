"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function Home() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <main className="flex flex-col items-center gap-8 text-center px-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          {t('landing.title')}
          <span className="block text-primary mt-2">Manage your Shop with AI</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {t('landing.subtitle')}
        </p>

        <div className="flex gap-4 mt-8">
          <Link href="/login">
            <Button size="lg" className="px-8">{t('landing.login')}</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="px-8">{t('landing.getStarted')}</Button>
          </Link>
        </div>
      </main>

      <footer className="absolute bottom-8 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Barber SaaS. All rights reserved.
      </footer>
    </div>
  );
}
