import { anthropic } from '@ai-sdk/anthropic';

/**
 * Anthropic AI Provider Configuration  
 * Using Claude 3 Haiku for testing (faster and available in all accounts)
 * TODO: Upgrade to Claude 3.5 Sonnet when account has access
 */
export const aiModel = anthropic('claude-3-haiku-20240307');

/**
 * AI Generation Settings
 */
export const AI_CONFIG = {
    temperature: 0.3, // Low temperature for consistent medical reasoning
    maxTokens: 1000,
    topP: 0.9,
} as const;

/**
 * Validate Anthropic API key is configured
 */
export function validateAIConfig(): boolean {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('ANTHROPIC_API_KEY is not configured');
        return false;
    }
    return true;
}
