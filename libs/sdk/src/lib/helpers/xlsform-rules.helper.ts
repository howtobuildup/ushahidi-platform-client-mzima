/* eslint-disable @typescript-eslint/no-use-before-define */
export interface XlsFormFieldConfig {
  relevant?: string;
  constraint?: string;
  constraint_message?: string;
  choice_filter?: string;
  randomize_options?: boolean;
  randomize?: boolean;
  parameters?: string;
  [key: string]: any;
}

export interface XlsFormFieldLike {
  key?: string;
  config?: XlsFormFieldConfig | any[] | null;
  options?: any[] | null;
}

export type XlsFormValueMap = Record<string, any>;

export function getXlsFormConfig(field: XlsFormFieldLike): XlsFormFieldConfig {
  if (!field?.config || Array.isArray(field.config)) {
    return {};
  }

  return field.config;
}

export function hasRelevantRule(field: XlsFormFieldLike): boolean {
  return !!getXlsFormConfig(field).relevant?.trim();
}

export function shouldRandomizeOptions(field: XlsFormFieldLike): boolean {
  const config = getXlsFormConfig(field);
  return (
    config.randomize_options === true ||
    config.randomize === true ||
    /(?:^|\s)randomize\s*=\s*true(?:\s|$)/i.test(config.parameters || '')
  );
}

export function randomizeFieldOptions<T extends XlsFormFieldLike>(field: T): T {
  if (!Array.isArray(field.options) || !shouldRandomizeOptions(field)) {
    return field;
  }

  return {
    ...field,
    options: shuffle(field.options),
  } as T;
}

export function isFieldVisible(field: XlsFormFieldLike, values: XlsFormValueMap): boolean {
  const relevant = getXlsFormConfig(field).relevant?.trim();
  if (!relevant) {
    return true;
  }

  return evaluateRelevantExpression(relevant, values);
}

export function isFieldConstraintValid(field: XlsFormFieldLike, value: any): boolean {
  const constraint = getXlsFormConfig(field).constraint?.trim();
  if (!constraint || !isFilled(value)) {
    return true;
  }

  return evaluateConstraintExpression(constraint, value);
}

export function getFieldConstraintMessage(field: XlsFormFieldLike): string {
  return getXlsFormConfig(field).constraint_message || 'Value does not match the validation rule';
}

export function getFilteredOptions(field: XlsFormFieldLike, values: XlsFormValueMap): any[] {
  const options = Array.isArray(field.options) ? field.options : [];
  const choiceFilter = getXlsFormConfig(field).choice_filter;
  if (!choiceFilter) {
    return options;
  }

  const match = choiceFilter.match(/^\$\{([^}]+)\}\s*=\s*([A-Za-z0-9_ -]+)$/);
  if (!match) {
    return options;
  }

  const parentValue = values[match[1]];
  const optionProperty = match[2].trim();
  if (!isFilled(parentValue)) {
    return [];
  }

  return options.filter((option) => valueEquals(option?.[optionProperty], parentValue));
}

export function getOptionValue(option: any): any {
  if (!option || typeof option !== 'object') {
    return option;
  }

  return option.name ?? option.value ?? option.id ?? option.label ?? option.tag;
}

export function getOptionLabel(option: any, language = 'en'): string {
  if (!option || typeof option !== 'object') {
    return String(option ?? '');
  }

  return String(
    option.translations?.[language]?.label ??
      option.label ??
      option.tag ??
      option.name ??
      option.value ??
      option.id ??
      '',
  );
}

export function evaluateRelevantExpression(expression: string, values: XlsFormValueMap): boolean {
  const trimmedExpression = stripWrappingParentheses(expression.trim());
  if (!trimmedExpression) {
    return true;
  }

  const orParts = splitLogical(trimmedExpression, 'or');
  if (orParts.length > 1) {
    return orParts.some((part) => evaluateRelevantExpression(part, values));
  }

  const andParts = splitLogical(trimmedExpression, 'and');
  if (andParts.length > 1) {
    return andParts.every((part) => evaluateRelevantExpression(part, values));
  }

  return evaluatePredicate(trimmedExpression, values);
}

function evaluatePredicate(expression: string, values: XlsFormValueMap): boolean {
  const selectedMatch = expression.match(
    /^selected\s*\(\s*\$\{([^}]+)\}\s*,\s*['"]([^'"]+)['"]\s*\)$/i,
  );
  if (selectedMatch) {
    return valueContains(values[selectedMatch[1]], selectedMatch[2]);
  }

  const comparisonMatch = expression.match(/^\$\{([^}]+)\}\s*(!=|=)\s*['"]?([^'"]+)['"]?$/);
  if (comparisonMatch) {
    const [, fieldKey, operator, expectedValue] = comparisonMatch;
    const matches = valueEquals(values[fieldKey], expectedValue.trim());
    return operator === '=' ? matches : !matches;
  }

  const fieldOnlyMatch = expression.match(/^\$\{([^}]+)\}$/);
  if (fieldOnlyMatch) {
    return isFilled(values[fieldOnlyMatch[1]]);
  }

  return true;
}

function evaluateConstraintExpression(expression: string, value: any): boolean {
  const trimmedExpression = stripWrappingParentheses(expression.trim());
  const orParts = splitLogical(trimmedExpression, 'or');
  if (orParts.length > 1) {
    return orParts.some((part) => evaluateConstraintExpression(part, value));
  }

  const andParts = splitLogical(trimmedExpression, 'and');
  if (andParts.length > 1) {
    return andParts.every((part) => evaluateConstraintExpression(part, value));
  }

  const stringLengthMatch = trimmedExpression.match(
    /^string-length\s*\(\s*\.\s*\)\s*(<=|>=|<|>|=|!=)\s*(-?\d+(?:\.\d+)?)$/i,
  );
  if (stringLengthMatch) {
    return compareValues(String(value ?? '').length, stringLengthMatch[2], stringLengthMatch[1]);
  }

  const regexMatch = trimmedExpression.match(/^regex\s*\(\s*\.\s*,\s*['"](.+)['"]\s*\)$/i);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1]).test(String(value ?? ''));
    } catch {
      return true;
    }
  }

  const comparisonMatch = trimmedExpression.match(/^\.\s*(<=|>=|<|>|=|!=)\s*['"]?([^'"]+)['"]?$/i);
  if (comparisonMatch) {
    return compareValues(value, comparisonMatch[2].trim(), comparisonMatch[1]);
  }

  return true;
}

function compareValues(actualValue: any, expectedValue: any, operator: string): boolean {
  const actualNumber = Number(actualValue);
  const expectedNumber = Number(expectedValue);
  const useNumberComparison = !Number.isNaN(actualNumber) && !Number.isNaN(expectedNumber);
  const actual = useNumberComparison ? actualNumber : String(actualValue ?? '');
  const expected = useNumberComparison ? expectedNumber : String(expectedValue ?? '');

  switch (operator) {
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    case '!=':
      return actual !== expected;
    case '=':
      return actual === expected;
    default:
      return true;
  }
}

function valueEquals(value: any, expectedValue: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => valueEquals(item, expectedValue));
  }

  if (value && typeof value === 'object') {
    return [value.name, value.value, value.id, value.tag, value.label].some((item) =>
      valueEquals(item, expectedValue),
    );
  }

  return String(value ?? '') === expectedValue;
}

function valueContains(value: any, expectedValue: string): boolean {
  return Array.isArray(value)
    ? value.some((item) => valueEquals(item, expectedValue))
    : valueEquals(value, expectedValue);
}

function isFilled(value: any): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => item !== null && item !== undefined && item !== '');
  }

  return value !== null && value !== undefined && value !== '';
}

function splitLogical(expression: string, operator: 'and' | 'or'): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    const remaining = expression.slice(index);

    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      current += char;
      continue;
    }

    const operatorMatch = remaining.match(new RegExp(`^\\s+${operator}\\s+`, 'i'));
    if (depth === 0 && operatorMatch) {
      parts.push(current.trim());
      index += operatorMatch[0].length - 1;
      current = '';
      continue;
    }

    current += char;
  }

  if (parts.length) {
    parts.push(current.trim());
  }

  return parts;
}

function stripWrappingParentheses(expression: string): string {
  if (!expression.startsWith('(') || !expression.endsWith(')')) {
    return expression;
  }

  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;

    if (depth === 0 && index < expression.length - 1) {
      return expression;
    }
  }

  return expression.slice(1, -1).trim();
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
