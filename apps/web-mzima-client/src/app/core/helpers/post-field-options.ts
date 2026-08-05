import { PostContentField, xlsFormRules } from '@mzima-client/sdk';

function fieldOptions(field: PostContentField): any[] {
  let options = field.options;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch {
      return [];
    }
  }

  if (Array.isArray(options)) return options;
  if (!options || typeof options !== 'object') return [];

  return Object.entries(options).map(([name, label]) => ({ name, label }));
}

function rawChoiceValue(value: any): any {
  if (!value || typeof value !== 'object') return value;
  return value.value ?? value.name ?? value.id ?? value.label ?? value;
}

export function postFieldChoiceLabel(field: PostContentField, value: any, language = 'en'): string {
  const rawValue = rawChoiceValue(value);
  if (rawValue === undefined || rawValue === null || rawValue === '') return '';

  const option = fieldOptions(field).find(
    (candidate) => String(xlsFormRules.getOptionValue(candidate)) === String(rawValue),
  );
  if (option !== undefined) return xlsFormRules.getOptionLabel(option, language);

  return String(rawValue).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export function postFieldChoiceValues(field: PostContentField, value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string') return [value];

  const trimmedValue = value.trim();
  if (trimmedValue.startsWith('[')) {
    try {
      const decoded = JSON.parse(trimmedValue);
      if (Array.isArray(decoded)) return decoded;
    } catch {
      return [value];
    }
  }

  const configuredValues = new Set(
    fieldOptions(field).map((option) => String(xlsFormRules.getOptionValue(option))),
  );
  if (configuredValues.has(trimmedValue)) return [trimmedValue];

  const tokens = trimmedValue.split(/\s+/).filter(Boolean);
  return tokens.length > 1 && tokens.every((token) => configuredValues.has(token))
    ? tokens
    : [value];
}

export function deduplicatePostLocationFields(fields: PostContentField[]): PostContentField[] {
  const result: PostContentField[] = [];
  const locationIndexes = new Map<string, number>();

  fields.forEach((field) => {
    if (field.input !== 'location') {
      result.push(field);
      return;
    }

    const key = String(field.label || field.key || field.id)
      .trim()
      .toLowerCase();
    const existingIndex = locationIndexes.get(key);
    if (existingIndex === undefined) {
      locationIndexes.set(key, result.length);
      result.push(field);
      return;
    }

    const existingFieldValue = result[existingIndex].value;
    const nextFieldValue = field.value;
    const existingValue =
      existingFieldValue &&
      typeof existingFieldValue === 'object' &&
      Object.prototype.hasOwnProperty.call(existingFieldValue, 'value')
        ? existingFieldValue.value
        : existingFieldValue;
    const nextValue =
      nextFieldValue &&
      typeof nextFieldValue === 'object' &&
      Object.prototype.hasOwnProperty.call(nextFieldValue, 'value')
        ? nextFieldValue.value
        : nextFieldValue;
    const existingHasValue =
      existingValue !== undefined && existingValue !== null && existingValue !== '';
    const nextHasValue = nextValue !== undefined && nextValue !== null && nextValue !== '';
    if (!existingHasValue && nextHasValue) result[existingIndex] = field;
  });

  return result;
}
