import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-8 text-center px-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Barber SaaS
          <span className="block text-primary mt-2">Manage your Shop with AI</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          The complete solution for barbershops. automated scheduling via WhatsApp,
          financial reports, and professional management.
        </p>

        <div className="flex gap-4 mt-8">
          <Link href="/login">
            <Button size="lg" className="px-8">Login</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="px-8">Get Started</Button>
          </Link>
        </div>
      </main>

      <footer className="absolute bottom-8 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Barber SaaS. All rights reserved.
      </footer>
    </div>
  );
}
