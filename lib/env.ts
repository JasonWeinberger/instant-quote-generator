const GEMINI_ENV_KEYS = [
  'GEMINI_API_KEY',
  'API_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_API_KEY',
] as const;

const readEnvValue = (key: (typeof GEMINI_ENV_KEYS)[number]): string | undefined => {
  const fromProcess =
    typeof process !== 'undefined' && process.env ? (process.env[key] as string | undefined) : undefined;
  if (fromProcess && fromProcess.trim()) {
    return fromProcess.trim();
  }

  const fromImportMeta =
    typeof import.meta !== 'undefined' && import.meta.env
      ? ((import.meta.env as Record<string, string | undefined>)[key] ?? undefined)
      : undefined;

  if (fromImportMeta && fromImportMeta.trim()) {
    return fromImportMeta.trim();
  }

  return undefined;
};

export const getGeminiApiKey = (): string => {
  for (const key of GEMINI_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) {
      return value;
    }
  }
  return '';
};

export const isGeminiConfigured = (): boolean => getGeminiApiKey().length > 0;
