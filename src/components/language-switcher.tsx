"use client"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { Languages } from "lucide-react"

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage()

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
            className="gap-2"
        >
            <Languages className="h-4 w-4" />
            {language === 'en' ? 'PT-BR' : 'EN-US'}
        </Button>
    )
}
