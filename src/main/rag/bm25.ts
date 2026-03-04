/**
 * BM25 Keyword Search — a classic probabilistic ranking function.
 * This gives us the "keyword match" half of hybrid retrieval,
 * complementing the vector/semantic search in vectorStore.ts.
 *
 * Algorithm: Okapi BM25 with configurable k1 and b parameters.
 */

interface BM25Document {
    id: string;
    text: string;
    source: string;
    kbId: string;
}

interface BM25Result {
    text: string;
    source: string;
    score: number;
}

// ── Stopwords & Tokenizer ──────────────────────────────────

const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its',
    'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
    'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
    'their', 'what', 'which', 'who', 'whom', 'where', 'when', 'why',
    'how', 'not', 'no', 'nor', 'if', 'then', 'else', 'so', 'as',
    'up', 'out', 'about', 'into', 'over', 'after', 'before', 'between',
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// ── BM25 Engine ────────────────────────────────────────────

export class BM25Engine {
    private k1: number;
    private b: number;
    private documents: BM25Document[] = [];
    private docTokens: string[][] = [];
    private avgDl: number = 0;
    private df: Map<string, number> = new Map(); // document frequency per term

    constructor(k1: number = 1.5, b: number = 0.75) {
        this.k1 = k1;
        this.b = b;
    }

    /**
     * Index a set of documents for BM25 scoring.
     */
    index(documents: BM25Document[]): void {
        this.documents = documents;
        this.docTokens = documents.map(doc => tokenize(doc.text));

        // Average document length
        const totalLength = this.docTokens.reduce((sum, tokens) => sum + tokens.length, 0);
        this.avgDl = documents.length > 0 ? totalLength / documents.length : 0;

        // Document frequency
        this.df.clear();
        for (const tokens of this.docTokens) {
            const uniqueTerms = new Set(tokens);
            for (const term of uniqueTerms) {
                this.df.set(term, (this.df.get(term) || 0) + 1);
            }
        }
    }

    /**
     * Search indexed documents using BM25 scoring.
     */
    search(query: string, limit: number = 5, kbId?: string): BM25Result[] {
        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) return [];

        const N = this.documents.length;
        const scores: { index: number; score: number }[] = [];

        for (let i = 0; i < this.documents.length; i++) {
            // Filter by knowledge base if specified
            if (kbId && this.documents[i].kbId !== kbId) continue;

            const docTokens = this.docTokens[i];
            const dl = docTokens.length;
            let score = 0;

            // Term frequency map for this document
            const tf = new Map<string, number>();
            for (const token of docTokens) {
                tf.set(token, (tf.get(token) || 0) + 1);
            }

            for (const term of queryTokens) {
                const termFreq = tf.get(term) || 0;
                if (termFreq === 0) continue;

                const docFreq = this.df.get(term) || 0;

                // IDF: inverse document frequency (with smoothing)
                const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));

                // BM25 TF normalization
                const tfNorm = (termFreq * (this.k1 + 1)) /
                    (termFreq + this.k1 * (1 - this.b + this.b * (dl / this.avgDl)));

                score += idf * tfNorm;
            }

            if (score > 0) {
                scores.push({ index: i, score });
            }
        }

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ index, score }) => ({
                text: this.documents[index].text,
                source: this.documents[index].source,
                score,
            }));
    }
}

// Singleton instance — shared across the app
export const bm25Engine = new BM25Engine();
