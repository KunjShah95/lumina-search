import React from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n'

interface LanguagePickerProps {
  value?: string
  onChange?: (lang: string) => void
  compact?: boolean
}

export default function LanguagePicker({ value, onChange, compact = false }: LanguagePickerProps) {
  const { t, i18n } = useTranslation()
  const currentLang = value || i18n.language || 'en'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value
    i18n.changeLanguage(newLang)
    onChange?.(newLang)
  }

  if (compact) {
    return (
      <select
        value={currentLang}
        onChange={handleChange}
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          background: 'var(--bg-2)',
          color: 'var(--text-1)',
          fontSize: '13px',
          cursor: 'pointer',
        }}
        aria-label={t('settings.language')}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-2)' }}>
        {t('settings.language')}
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => {
              i18n.changeLanguage(lang.code)
              onChange?.(lang.code)
            }}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: currentLang === lang.code 
                ? '2px solid var(--accent)' 
                : '1px solid var(--border)',
              background: currentLang === lang.code 
                ? 'var(--bg-3)' 
                : 'var(--bg-2)',
              color: 'var(--text-1)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ fontWeight: 500 }}>{lang.nativeName}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{lang.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
