/**
 * Query Rewriting Agent — LLM-driven query decomposition and optimization.
 *
 * Features:
 *   - Rewrite ambiguous queries to be more specific
 *   - Decompose compound queries into sub-queries
 *   - Add context from conversation history
 *   - Generate follow-up questions automatically
 */

interface QueryRewriteResult {
    originalQuery: string;
    rewrittenQuery: string;
    subQueries?: string[];
    confidence: number;
    metadata: {
        rewritingType: 'clarify' | 'expand' | 'decompose' | 'contextual';
        conversationContext?: string[];
    };
}

export class QueryRewritingAgent {
    private conversationHistory: Array<{ role: string; content: string }> = [];

    constructor(conversationHistory?: Array<{ role: string; content: string }>) {
        if (conversationHistory) {
            this.conversationHistory = conversationHistory;
        }
    }

    /**
     * Set or update conversation history for context-aware rewriting.
     */
    setConversationHistory(history: Array<{ role: string; content: string }>): void {
        this.conversationHistory = history;
    }

    /**
     * Add a message to conversation history.
     */
    addMessage(role: string, content: string): void {
        this.conversationHistory.push({ role, content });
        // Keep only last 10 messages to avoid context overflow
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }
    }

    /**
     * Rewrite a query using conversation context and LLM.
     * Falls back to simple heuristics if OpenAI API is unavailable.
     */
    async rewriteQuery(query: string, model: string = 'gpt-4-turbo-preview'): Promise<QueryRewriteResult> {
        const lastUserMessage = this.conversationHistory
            .slice(-5)
            .filter(m => m.role === 'user')
            .pop()?.content || '';

        const lastAssistantMessage = this.conversationHistory
            .slice(-5)
            .filter(m => m.role === 'assistant')
            .pop()?.content || '';

        // Heuristic-based rewriting (works without API key)
        const rewritten = this.applyHeuristics(query, lastUserMessage, lastAssistantMessage);

        // If OpenAI API is available, use LLM for better rewriting
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey && query.length > 5 && model.includes('gpt')) {
            try {
                const llmRewritten = await this.llmRewrite(query, lastUserMessage, lastAssistantMessage);
                if (llmRewritten.confidence > 0.5) {
                    return llmRewritten;
                }
            } catch (err) {
                console.warn('[QueryRewritingAgent] LLM rewrite failed, using heuristics:', err);
            }
        }

        return rewritten;
    }

    private applyHeuristics(
        query: string,
        lastUserQuery: string,
        lastAssistantAnswer: string
    ): QueryRewriteResult {
        let rewritten = query.trim();
        let rewriteType: QueryRewriteResult['metadata']['rewritingType'] = 'clarify';
        let confidence = 0.7;

        // Check for pronouns and ambiguous terms
        const ambiguousTerms = ['it', 'he', 'she', 'they', 'this', 'that', 'these', 'those'];
        const hasAmbiguousTerms = ambiguousTerms.some(term => 
            new RegExp(`\\b${term}\\b`, 'i').test(query)
        );

        if (hasAmbiguousTerms && lastUserQuery) {
            rewritten = `${lastUserQuery} ${query}`;
            rewriteType = 'contextual';
            confidence = 0.8;
        }

        // Expand acronyms and common abbreviations
        const expansions: Record<string, string> = {
            'ai': 'artificial intelligence',
            'ml': 'machine learning',
            'llm': 'large language model',
            'rag': ' retrieval augmented generation',
            'nlp': 'natural language processing',
        };

        let expanded = false;
        for (const [abbr, full] of Object.entries(expansions)) {
            if (new RegExp(`\\b${abbr}\\b`, 'i').test(query)) {
                rewritten = rewritten.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
                expanded = true;
                confidence = Math.min(confidence + 0.1, 0.95);
            }
        }

        // Decompose compound queries
        if (/and|or|vs\.?|versus/i.test(query)) {
            const subQueries = query.split(/and|or|vs\.?|versus/i).map(s => s.trim()).filter(s => s.length > 3);
            if (subQueries.length > 1) {
                return {
                    originalQuery: query,
                    rewrittenQuery: rewritten,
                    subQueries,
                    confidence,
                    metadata: {
                        rewritingType: 'decompose',
                    },
                };
            }
        }

        // Add domain-specific modifiers if applicable
        const domainModifiers: Record<string, string> = {
            'code': 'programming example',
            'tutorial': 'step by step guide',
            'recipe': 'cooking instructions ingredients',
            'research': 'paper study analysis',
        };

        for (const [term, modifier] of Object.entries(domainModifiers)) {
            if (new RegExp(`\\b${term}\\b`, 'i').test(query)) {
                rewritten = `${rewritten} ${modifier}`;
                confidence = Math.min(confidence + 0.05, 0.95);
                break;
            }
        }

        // Capitalize first letter
        rewritten = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);

        return {
            originalQuery: query,
            rewrittenQuery: rewritten,
            confidence,
            metadata: {
                rewritingType: rewriteType,
            },
        };
    }

    private async llmRewrite(
        query: string,
        lastUserQuery: string,
        lastAssistantAnswer: string
    ): Promise<QueryRewriteResult> {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('No OpenAI API key configured');
        }

        const { OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const contextPrompt = lastUserQuery 
            ? `\nPrevious user query: "${lastUserQuery}"\nPrevious assistant response: "${lastAssistantAnswer.substring(0, 200)}..."`
            : '';

        const prompt = `Rewrite the following query to be more specific, clear, and comprehensive.
Consider the conversation context if provided.

Query: "${query}"${contextPrompt}

Respond in JSON format:
{
    "rewrittenQuery": "the improved query",
    "rewritingType": "clarify|expand|decompose|contextual",
    "confidence": 0.0-1.0,
    "subQueries": ["optional", "list", "of", "sub", "queries"] (only if query is compound)
}

Rules:
- Keep the original intent
- Add specificity and detail
- Clarify ambiguous terms
- Preserve domain terms (AI, ML, etc.)
- Split compound queries into sub-queries if helpful
`;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    { role: 'system', content: 'You are a query optimization assistant. Return only valid JSON.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.3,
                max_tokens: 500,
            });

            const content = response.choices[0]?.message?.content || '';
            const result = JSON.parse(content);

            return {
                originalQuery: query,
                rewrittenQuery: result.rewrittenQuery || query,
                subQueries: result.subQueries || undefined,
                confidence: result.confidence || 0.5,
                metadata: {
                    rewritingType: result.rewritingType as any || 'clarify',
                },
            };
        } catch (err) {
            console.error('[QueryRewritingAgent] LLM rewrite failed:', err);
            throw err;
        }
    }

    /**
     * Generate follow-up questions based on the conversation and current query.
     */
    async generateFollowUps(
        query: string,
        answer: string,
        model: string = 'gpt-4-turbo-preview'
    ): Promise<string[]> {
        if (!process.env.OPENAI_API_KEY) {
            // Fallback: simple heuristic follow-ups
            return [
                `Can you elaborate on "${query}"?`,
                `What are the key takeaways from this?`,
                `How does this relate to previous discussions?`,
            ];
        }

        const { OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are a helpful assistant that suggests insightful follow-up questions.' 
                    },
                    {
                        role: 'user',
                        content: `Based on the following query and answer, suggest 3 relevant follow-up questions.
The questions should be diverse, probing deeper into different aspects.

Query: "${query}"
Answer: "${answer.substring(0, 500)}..."

Format as JSON:
{
    "followUpQuestions": [
        "question 1",
        "question 2",
        "question 3"
    ]
}
`
                    }
                ],
                temperature: 0.7,
                max_tokens: 300,
            });

            const content = response.choices[0]?.message?.content || '';
            const result = JSON.parse(content);
            
            return result.followUpQuestions || [];
        } catch (err) {
            console.error('[QueryRewritingAgent] Follow-up generation failed:', err);
            return [];
        }
    }
}
