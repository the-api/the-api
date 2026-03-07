import type { AdditionalMessageType } from './types';

export const toAdditionalArray = (input: unknown): AdditionalMessageType[] => {
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === 'string') {
          const message = item.trim();
          return message ? { message } : null;
        }
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const message = typeof record.message === 'string'
            ? record.message
            : JSON.stringify(record);
          return { ...record, message } as AdditionalMessageType;
        }
        return null;
      })
      .filter(Boolean) as AdditionalMessageType[];
  }

  if (typeof input === 'string') {
    const message = input.trim();
    return message ? [{ message }] : [];
  }

  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const message = typeof record.message === 'string'
      ? record.message
      : JSON.stringify(record);
    return [{ ...record, message } as AdditionalMessageType];
  }

  return [];
};

export const parseErrorMessage = (
  message: string,
): { name: string; additionalText: string } => {
  const match = message.match(/^(\w+):?\s?(.*?)$/);
  return {
    name: match?.[1] ?? message,
    additionalText: match?.[2] ?? '',
  };
};

export const getErrorNameAndAdditional = (
  err: Error | { message: string; additional?: unknown },
): { name: string; additional: AdditionalMessageType[] } => {
  const message = 'message' in err ? err.message : String(err);
  const { name, additionalText } = parseErrorMessage(message);

  const ownAdditional = (err as { additional?: unknown }).additional;
  const additional = typeof ownAdditional !== 'undefined'
    ? toAdditionalArray(ownAdditional)
    : toAdditionalArray(additionalText);

  return { name, additional };
};
