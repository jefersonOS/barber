"use client"

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { translations } from '@/lib/translations'

type Language = 'en' | 'pt'

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
    // Default to 'pt' since user requested it, but we can default to 'en' if preferred.
    // Given the request "change to portuguese", I'll default to 'en' and let them switch, or check browser.
    // For simplicity, let's start with 'en' to match current state, or 'pt' if we want to force it.
    // I'll default to 'en'
    const [language, setLanguageState] = useState<Language>('en')

    useEffect(() => {
        // Persist choice if needed? For MVP, just state.
    }, [])

    const setLanguage = (lang: Language) => {
        setLanguageState(lang)
    }

    const t = (key: string) => {
        // @ts-ignore
        const text = translations[language][key]
        return text || key
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLanguage = () => {
    const context = useContext(LanguageContext)
    if (!context) throw new Error("useLanguage must be used within LanguageProvider")
    return context
}
