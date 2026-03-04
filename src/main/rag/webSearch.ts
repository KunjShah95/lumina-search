import { tavily } from '@tavily/core';

// Initialize Tavily client, optionally fallback to a mock for development
const tvly = process.env.TAVILY_API_KEY ? tavily({ apiKey: process.env.TAVILY_API_KEY }) : null;

export interface WebSearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
}

export async function performWebSearch(query: string, maxResults: number = 3): Promise<WebSearchResult[]> {
    if (!tvly) {
        console.warn('TAVILY_API_KEY is not set. Using mock web search results.');
        return [
            {
                title: 'Mock Web Search Result - Example Context',
                url: 'https://example.com/mock-result',
                content: `This is a mock search result for the query: "${query}". It provides fabricated context because no API key was provided. In a real environment, this would contain scraped page content.`,
                score: 0.99
            }
        ];
    }

    try {
        const response = await tvly.search(query, {
            searchDepth: "advanced",
            includeAnswer: false,
            maxResults: maxResults,
        });

        return response.results.map((result: any) => ({
            title: result.title,
            url: result.url,
            content: result.content,
            score: result.score
        }));

    } catch (error) {
        console.error('Error during Tavily web search:', error);
        return [];
    }
}
