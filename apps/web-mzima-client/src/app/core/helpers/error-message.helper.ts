function getNestedErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (Array.isArray(value)) {
    const messages = value.map(getNestedErrorMessage).filter(Boolean);
    return messages.length ? messages.join(' ') : undefined;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const directMessage = getNestedErrorMessage(objectValue['message']);
    if (directMessage) {
      return directMessage;
    }

    const messages = Object.values(objectValue).map(getNestedErrorMessage).filter(Boolean);
    return messages.length ? messages.join(' ') : undefined;
  }

  return undefined;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const value = error as {
      error?: unknown;
      errors?: unknown;
      message?: unknown;
      detail?: unknown;
      title?: unknown;
    };

    for (const candidate of [value.error, value.errors, value.message, value.detail, value.title]) {
      const message = getNestedErrorMessage(candidate);
      if (message) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}
