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

/**
 * Reduce a stored value or an option to a comparable form.
 */
function normalizeChoice(value: any): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * The same option appears in several incident branches with the branch
 * appended to its name, so a value recorded in one branch does not match the
 * option as the survey lists it.
 */
function stripBranchSuffix(value: string): string {
  return value.replace(/_(climate|conflict|gbv|social|warning|violence)$/, '');
}

/**
 * Find the option a stored value refers to.
 *
 * An exact match on the option name is tried first. Failing that the value is
 * compared loosely against both the name and the label, because this survey
 * records some answers as the option's display text rather than its name, and
 * some with the incident branch appended. Without that, those answers never
 * resolve to an option and so are shown in the language they were recorded in,
 * whatever language the reader has chosen.
 */
function findOption(field: PostContentField, rawValue: any): any {
  const options = fieldOptions(field);

  const exact = options.find(
    (candidate) => String(xlsFormRules.getOptionValue(candidate)) === String(rawValue),
  );
  if (exact !== undefined) return exact;

  const normalized = normalizeChoice(rawValue);
  const withoutBranch = stripBranchSuffix(normalized);

  return options.find((candidate) => {
    const names = [
      normalizeChoice(xlsFormRules.getOptionValue(candidate)),
      normalizeChoice(candidate?.label),
    ].filter(Boolean);

    return names.some((name) => name === normalized || name === withoutBranch);
  });
}

export function postFieldChoiceLabel(field: PostContentField, value: any, language = 'en'): string {
  const rawValue = rawChoiceValue(value);
  if (rawValue === undefined || rawValue === null || rawValue === '') return '';

  const option = findOption(field, rawValue);
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
