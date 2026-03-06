import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Operator {
    syntax: string
    description: string
    example: string
    icon: string
}

const OPERATORS: Operator[] = [
    {
        syntax: 'site:',
        description: 'Limit search to a specific domain',
        example: 'machine learning site:arxiv.org',
        icon: '🌐'
    },
    {
        syntax: 'filetype:',
        description: 'Search for specific file extensions',
        example: 'deep learning filetype:pdf',
        icon: '📄'
    },
    {
        syntax: 'date:',
        description: 'Filter by date range (e.g., 2023, 2023-2024)',
        example: 'quantum physics date:2023-2024',
        icon: '📅'
    },
    {
        syntax: 'language:',
        description: 'Filter by language code (en, es, fr, etc.)',
        example: 'cooking recipes language:fr',
        icon: '🗣️'
    },
    {
        syntax: 'source:',
        description: 'Limit to specific source types (web, news, scholar)',
        example: 'black holes source:scholar',
        icon: '🔍'
    },
    {
        syntax: '!',
        description: 'Exclude terms from results',
        example: 'apple !fruit',
        icon: '🚫'
    },
    {
        syntax: '" "',
        description: 'Search for an exact phrase',
        example: '"artificial general intelligence"',
        icon: '✍️'
    }
]

interface Props {
    onClose: () => void
    onSelectOperator?: (syntax: string) => void
}

export default function SearchOperatorsGuide({ onClose, onSelectOperator }: Props) {
    return (
        <motion.div
            className="settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                className="operators-guide-panel"
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
            >
                <div className="settings-header">
                    <span className="settings-title">🔍 Advanced Search Operators</span>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="operators-guide-body">
                    <p className="operators-intro">
                        Use these operators in the search bar to narrow down your results.
                        You can combine multiple operators in a single query.
                    </p>

                    <div className="operators-grid">
                        {OPERATORS.map((op) => (
                            <div
                                key={op.syntax}
                                className="operator-card"
                                onClick={() => onSelectOperator?.(op.syntax)}
                            >
                                <div className="operator-icon">{op.icon}</div>
                                <div className="operator-info">
                                    <code className="operator-syntax">{op.syntax}</code>
                                    <p className="operator-desc">{op.description}</p>
                                    <div className="operator-example">
                                        <span>Example:</span>
                                        <code>{op.example}</code>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="settings-footer">
                    <button className="btn-primary" onClick={onClose}>Got it</button>
                </div>
            </motion.div>
        </motion.div>
    )
}
