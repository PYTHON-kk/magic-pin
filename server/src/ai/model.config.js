/**
 * LLM provider configuration — supports OpenAI, Anthropic, Gemini, DeepSeek, Groq, OpenRouter.
 * All via their REST APIs using native fetch (Node 18+).
 */
const config = require('../config/env');

const PROVIDER_CONFIGS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    chatPath: '/chat/completions',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildBody: (model, messages, options) => ({
      model,
      messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1024,
      response_format: { type: 'json_object' },
    }),
    extractContent: (response) => response.choices?.[0]?.message?.content,
  },

  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    chatPath: '/messages',
    authHeader: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    buildBody: (model, messages, options) => {
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const userMsgs = messages.filter((m) => m.role !== 'system');
      return {
        model,
        system,
        messages: userMsgs,
        temperature: options.temperature ?? 0,
        max_tokens: options.maxTokens ?? 1024,
      };
    },
    extractContent: (response) => response.content?.[0]?.text,
  },

  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-flash-lite-latest',
    chatPath: null, // Built dynamically
    authHeader: () => ({}),
    buildBody: (model, messages, options) => {
      const systemInstruction = messages.find((m) => m.role === 'system')?.content || '';
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      return {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0,
          maxOutputTokens: options.maxTokens ?? 1024,
          responseMimeType: 'application/json',
        },
      };
    },
    extractContent: (response) => response.candidates?.[0]?.content?.parts?.[0]?.text,
  },

  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    chatPath: '/chat/completions',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildBody: (model, messages, options) => ({
      model,
      messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1024,
      response_format: { type: 'json_object' },
    }),
    extractContent: (response) => response.choices?.[0]?.message?.content,
  },

  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    chatPath: '/chat/completions',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildBody: (model, messages, options) => ({
      model,
      messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1024,
      response_format: { type: 'json_object' },
    }),
    extractContent: (response) => response.choices?.[0]?.message?.content,
  },

  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    chatPath: '/chat/completions',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildBody: (model, messages, options) => ({
      model,
      messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1024,
      response_format: { type: 'json_object' },
    }),
    extractContent: (response) => response.choices?.[0]?.message?.content,
  },
};

function getProviderConfig() {
  const provider = config.LLM_PROVIDER.toLowerCase();
  const providerCfg = PROVIDER_CONFIGS[provider];
  if (!providerCfg) {
    throw new Error(
      `Unknown LLM provider: "${provider}". Supported: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`
    );
  }
  return {
    ...providerCfg,
    model: config.LLM_MODEL || providerCfg.defaultModel,
    apiKey: config.LLM_API_KEY,
    provider,
  };
}

module.exports = { getProviderConfig, PROVIDER_CONFIGS };
