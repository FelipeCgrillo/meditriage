import { anthropic } from '@ai-sdk/anthropic';

/**
 * Default Anthropic model. Picked as a currently generally available model id
 * across Anthropic API accounts. Override per-environment with the
 * ANTHROPIC_MODEL env var when a newer/different snapshot is required.
 *
 * Note: avoid hard-coding deprecated snapshots (e.g. claude-3-5-sonnet-20240620)
 * here — when a snapshot is retired the AI provider call fails and the
 * patient-facing UI falls back to the static safe message.
 */
export const DEFAULT_ANTHROPIC_MODEL: string = 'claude-3-5-sonnet-20241022';

/**
 * Resolve the Anthropic model id to use at runtime.
 * Reads ANTHROPIC_MODEL when set (trimmed), otherwise returns the default.
 */
export function getAnthropicModelId(): string {
    const raw = process.env.ANTHROPIC_MODEL;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length > 0) return trimmed;
    }
    return DEFAULT_ANTHROPIC_MODEL;
}

/**
 * Anthropic AI Provider Configuration
 * Uses ANTHROPIC_MODEL if set, otherwise DEFAULT_ANTHROPIC_MODEL.
 */
export const aiModel = anthropic(getAnthropicModelId());

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
