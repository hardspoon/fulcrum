import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18nInstance from '@/i18n'
import { useLanguage, useUpdateConfig, CONFIG_KEYS, type Language } from './use-config'
import { supportedLanguages, type SupportedLanguage } from '@/i18n'

/**
 * Hook to sync language between i18n and backend settings.
 * - On mount: applies saved language preference from backend
 * - Provides changeLanguage function to update both i18n and backend
 *
 * Uses the i18n singleton directly for mutations to avoid the react-i18next
 * wrapper (which gets a new reference on every language change) from
 * re-triggering the sync effect and reverting user-initiated changes.
 */
export function useLanguageSync() {
  // useTranslation() subscribes to language changes so consumers re-render
  const { i18n } = useTranslation()
  const { data: savedLanguage, isSuccess } = useLanguage()
  const updateConfig = useUpdateConfig()

  // Apply saved language on mount / when backend value changes.
  // Intentionally uses the stable i18nInstance singleton (not the wrapper
  // from useTranslation) so this effect only re-runs when savedLanguage
  // changes — not when the language itself changes.
  useEffect(() => {
    if (isSuccess && savedLanguage && savedLanguage !== i18nInstance.language) {
      i18nInstance.changeLanguage(savedLanguage)
    }
  }, [isSuccess, savedLanguage])

  // Change language and persist to backend
  const changeLanguage = useCallback(
    async (lang: Language) => {
      if (lang) {
        await i18nInstance.changeLanguage(lang)
      } else {
        // Auto-detect: use browser language or fallback to 'en'
        const browserLang = navigator.language.split('-')[0] as SupportedLanguage
        const detectedLang = supportedLanguages.includes(browserLang) ? browserLang : 'en'
        await i18nInstance.changeLanguage(detectedLang)
      }
      // Persist to backend (empty string for null/auto)
      updateConfig.mutate({
        key: CONFIG_KEYS.LANGUAGE,
        value: lang ?? '',
      })
    },
    [updateConfig]
  )

  return {
    language: i18n.language as SupportedLanguage,
    savedLanguage,
    changeLanguage,
    isUpdating: updateConfig.isPending,
  }
}
