/* eslint-disable @typescript-eslint/no-use-before-define */
import { SurveyItemTask } from '@mzima-client/sdk';
import * as surveyHelper from './survey';

type XlsFormRow = Record<string, any>;
type WorkbookRows = Record<string, XlsFormRow[]>;

interface ZipEntry {
  compressedSize: number;
  dataOffset: number;
  method: number;
  name: string;
}

interface ChoiceOption {
  name: string;
  label: string;
  translations?: Record<string, { label: string }>;
  [key: string]: any;
}

interface XlsFormGroupContext {
  relevant: string;
}

export interface ImportedXlsForm {
  name: string;
  tasks: SurveyItemTask[];
  enabledLanguages: {
    default: string;
    available: string[];
  };
  translations: Record<string, { name: string; description: string }>;
}

export async function importXlsForm(file: File): Promise<ImportedXlsForm> {
  const workbook = await readXlsxWorkbook(file);
  const surveyRows = getRows(workbook, 'survey');
  const choiceRows = getRows(workbook, 'choices');
  const settingsRows = getRows(workbook, 'settings');
  const choicesByList = buildChoices(choiceRows);
  const name = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const defaultLanguage = parseLanguageCode(settingsRows[0]?.['default_language']) || 'en';
  const availableLanguages = surveyRows.some((row) => row['label::Somali (so)']) ? ['so'] : [];

  return {
    name,
    tasks: buildTasks(surveyRows, choicesByList),
    enabledLanguages: {
      default: defaultLanguage,
      available: availableLanguages.filter((language) => language !== defaultLanguage),
    },
    translations: availableLanguages.includes('so')
      ? {
          so: {
            name,
            description: '',
          },
        }
      : {},
  };
}

function getRows(workbook: WorkbookRows, sheetName: string): XlsFormRow[] {
  return workbook[sheetName] || [];
}

function buildChoices(rows: XlsFormRow[]): Record<string, ChoiceOption[]> {
  return rows.reduce((result, row) => {
    const listName = String(row['list_name'] || '').trim();
    if (!listName) return result;

    if (!result[listName]) {
      result[listName] = [];
    }

    const option: ChoiceOption = {
      name: String(row['name'] || '').trim(),
      label: String(row['label::English (en)'] || row['name'] || '').trim(),
      translations: {
        so: {
          label: String(
            row['label::Somali (so)'] || row['label::English (en)'] || row['name'] || '',
          ).trim(),
        },
      },
    };

    Object.keys(row).forEach((key) => {
      if (!['list_name', 'name', 'label::English (en)', 'label::Somali (so)'].includes(key)) {
        const value = String(row[key] || '').trim();
        if (value) option[key] = value;
      }
    });

    result[listName].push(option);
    return result;
  }, {} as Record<string, ChoiceOption[]>);
}

function buildTasks(
  rows: XlsFormRow[],
  choicesByList: Record<string, ChoiceOption[]>,
): SurveyItemTask[] {
  const defaultTask = clone(surveyHelper.defaultTask);

  const groupStack: XlsFormGroupContext[] = [];
  let priority = defaultTask.fields.length + 1;
  rows.forEach((row) => {
    const type = String(row['type'] || '').trim();
    const baseType = type.split(/\s+/)[0];

    if (baseType === 'begin_group') {
      groupStack.push({
        relevant: String(row['relevant'] || '').trim(),
      });
      return;
    }

    if (baseType === 'end_group') {
      groupStack.pop();
      return;
    }

    const inheritedRelevant = combineRelevantExpressions(
      groupStack.map((group) => group.relevant).filter(Boolean),
    );
    const mapped = mapSurveyRowToField(row, choicesByList, priority, inheritedRelevant);
    if (mapped) {
      defaultTask.fields.push(mapped);
      priority += 1;
    }
  });

  return [defaultTask as unknown as SurveyItemTask];
}

function mapSurveyRowToField(
  row: XlsFormRow,
  choicesByList: Record<string, ChoiceOption[]>,
  priority: number,
  inheritedRelevant = '',
): any | null {
  const type = String(row['type'] || '').trim();
  const name = String(row['name'] || '').trim();
  const [baseType, listName] = type.split(/\s+/);
  if (!type || !name || ['start', 'end', 'today'].includes(baseType)) {
    return null;
  }

  const config: any = { xlsform_name: name };
  ['relevant', 'parameters', 'choice_filter'].forEach((key) => {
    const value = String(row[key] || '').trim();
    if (value) config[key] = value;
  });
  config.relevant = combineRelevantExpressions([inheritedRelevant, config.relevant]);
  if (!config.relevant) {
    delete config.relevant;
  }

  const field = {
    cardinality: baseType === 'select_multiple' ? 0 : 1,
    config,
    default: '',
    form_stage_id: getInterimId(priority),
    input: mapInput(baseType),
    instructions: '',
    key: name,
    label: String(row['label::English (en)'] || name).trim(),
    options: choicesByList[listName] || [],
    priority,
    required: String(row['required'] || '').toLowerCase() === 'yes',
    response_private: false,
    translations: {
      so: {
        label: String(row['label::Somali (so)'] || row['label::English (en)'] || name).trim(),
        options: mapSomaliOptionTranslations(choicesByList[listName] || []),
      },
    },
    type: mapType(baseType),
  };

  return field;
}

function combineRelevantExpressions(expressions: Array<string | null | undefined>): string {
  const uniqueExpressions = expressions
    .map((expression) => String(expression || '').trim())
    .filter(Boolean)
    .filter((expression, index, allExpressions) => allExpressions.indexOf(expression) === index);

  if (!uniqueExpressions.length) return '';
  if (uniqueExpressions.length === 1) return uniqueExpressions[0];

  return uniqueExpressions.map((expression) => `(${expression})`).join(' and ');
}

function mapInput(type: string): string {
  switch (type) {
    case 'select_one':
      return 'select';
    case 'select_multiple':
      return 'checkbox';
    case 'geopoint':
      return 'location';
    case 'datetime':
      return 'datetime';
    default:
      return 'text';
  }
}

function mapType(type: string): string {
  switch (type) {
    case 'geopoint':
      return 'point';
    case 'select_one':
    case 'select_multiple':
    case 'text':
      return 'varchar';
    case 'datetime':
      return 'datetime';
    default:
      return 'varchar';
  }
}

function mapSomaliOptionTranslations(options: ChoiceOption[]): Record<string, string> {
  return options.reduce((translations, option) => {
    translations[option['name']] = option['translations']?.['so']?.['label'] || option['label'];
    return translations;
  }, {} as Record<string, string>);
}

function parseLanguageCode(language: string): string {
  const match = String(language || '').match(/\(([^)]+)\)/);
  return match?.[1] || '';
}

function getInterimId(index: number): string {
  return `interim_id_${Date.now() + index}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function readXlsxWorkbook(file: File): Promise<WorkbookRows> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const zipEntries = readZipEntries(bytes);
  const xmlCache: Record<string, string> = {};
  const parser = new DOMParser();

  const getXml = async (path: string): Promise<string> => {
    if (!xmlCache[path]) {
      const entry = zipEntries[path];
      if (!entry) return '';
      xmlCache[path] = decodeText(await readZipEntry(bytes, entry));
    }
    return xmlCache[path];
  };

  const workbookXml = await getXml('xl/workbook.xml');
  const relationshipXml = await getXml('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relationshipXml) {
    throw new Error('This XLSForm workbook is missing required workbook metadata.');
  }

  const relationships = parseWorkbookRelationships(
    parser.parseFromString(relationshipXml, 'application/xml'),
  );
  const sharedStrings = await readSharedStrings(getXml, parser);
  const workbookDocument = parser.parseFromString(workbookXml, 'application/xml');
  const sheets = Array.from(workbookDocument.getElementsByTagName('sheet'));

  const result: WorkbookRows = {};
  for (const sheet of sheets) {
    const name = sheet.getAttribute('name') || '';
    const relationshipId = sheet.getAttribute('r:id') || '';
    const sheetPath = relationships[relationshipId];
    if (!name || !sheetPath) continue;

    const sheetXml = await getXml(sheetPath);
    if (!sheetXml) continue;

    result[name] = parseSheetRows(
      parser.parseFromString(sheetXml, 'application/xml'),
      sharedStrings,
    );
  }

  return result;
}

function readZipEntries(bytes: Uint8Array): Record<string, ZipEntry> {
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(bytes);
  const centralDirectorySize = readUint32(bytes, endOfCentralDirectoryOffset + 12);
  const centralDirectoryOffset = readUint32(bytes, endOfCentralDirectoryOffset + 16);
  const endOffset = centralDirectoryOffset + centralDirectorySize;
  const entries: Record<string, ZipEntry> = {};
  let offset = centralDirectoryOffset;

  while (offset < endOffset && readUint32(bytes, offset) === 0x02014b50) {
    const method = readUint16(bytes, offset + 10);
    const compressedSize = readUint32(bytes, offset + 20);
    const fileNameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const localHeaderOffset = readUint32(bytes, offset + 42);
    const name = decodeText(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    const localFileNameLength = readUint16(bytes, localHeaderOffset + 26);
    const localExtraLength = readUint16(bytes, localHeaderOffset + 28);

    entries[name] = {
      compressedSize,
      dataOffset: localHeaderOffset + 30 + localFileNameLength + localExtraLength,
      method,
      name,
    };

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const data = bytes.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new Error(`Unsupported XLSX compression method: ${entry.method}`);

  const decompressionStreamConstructor = (window as any)['DecompressionStream'];
  if (!decompressionStreamConstructor) {
    throw new Error(
      'Your browser cannot read XLSX files. Please use a current Chrome, Edge, or Safari version.',
    );
  }

  try {
    return await inflateZipData(data, decompressionStreamConstructor, 'deflate-raw');
  } catch {
    return inflateZipData(data, decompressionStreamConstructor, 'deflate');
  }
}

async function inflateZipData(
  data: Uint8Array,
  decompressionStreamConstructor: any,
  format: 'deflate' | 'deflate-raw',
): Promise<Uint8Array> {
  const compressedStream = new Blob([data]).stream() as any;
  const inflatedStream = compressedStream['pipeThrough'](
    new decompressionStreamConstructor(format),
  );
  return new Uint8Array(await new Response(inflatedStream).arrayBuffer());
}

async function readSharedStrings(
  getXml: (path: string) => Promise<string>,
  parser: DOMParser,
): Promise<string[]> {
  const sharedStringsXml = await getXml('xl/sharedStrings.xml');
  if (!sharedStringsXml) return [];

  return Array.from(
    parser.parseFromString(sharedStringsXml, 'application/xml').getElementsByTagName('si'),
  ).map((item) =>
    Array.from(item.getElementsByTagName('t'))
      .map((node) => node.textContent || '')
      .join(''),
  );
}

function parseWorkbookRelationships(document: Document): Record<string, string> {
  return Array.from(document.getElementsByTagName('Relationship')).reduce(
    (result, relationship) => {
      const id = relationship.getAttribute('Id') || '';
      const target = relationship.getAttribute('Target') || '';
      if (id && target) {
        result[id] = normalizeWorkbookTarget(target);
      }
      return result;
    },
    {} as Record<string, string>,
  );
}

function parseSheetRows(document: Document, sharedStrings: string[]): XlsFormRow[] {
  const rows = Array.from(document.getElementsByTagName('row')).map((row) =>
    parseSheetRow(row, sharedStrings),
  );
  const headers = (rows.shift() || []).map((value) => String(value || '').trim());

  return rows
    .map((row) =>
      headers.reduce((result, header, index) => {
        if (header) result[header] = row[index] || '';
        return result;
      }, {} as XlsFormRow),
    )
    .filter((row) => Object.values(row).some((value) => String(value || '').trim()));
}

function parseSheetRow(row: Element, sharedStrings: string[]): string[] {
  const values: string[] = [];
  Array.from(row.getElementsByTagName('c')).forEach((cell) => {
    const columnIndex = getColumnIndex(cell.getAttribute('r') || '');
    values[columnIndex] = parseCellValue(cell, sharedStrings);
  });
  return values;
}

function parseCellValue(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute('t') || '';
  const value = cell.getElementsByTagName('v')[0]?.textContent || '';

  if (type === 's') {
    return sharedStrings[Number(value)] || '';
  }

  if (type === 'inlineStr') {
    return Array.from(cell.getElementsByTagName('t'))
      .map((node) => node.textContent || '')
      .join('');
  }

  if (type === 'b') {
    return value === '1' ? 'true' : 'false';
  }

  return value;
}

function getColumnIndex(cellReference: string): number {
  return (
    cellReference
      .replace(/[0-9]/g, '')
      .split('')
      .reduce((result, letter) => result * 26 + letter.toUpperCase().charCodeAt(0) - 64, 0) - 1
  );
}

function normalizeWorkbookTarget(target: string): string {
  if (target.startsWith('/')) return target.replace(/^\//, '');
  return `xl/${target}`.replace(/\/+/g, '/');
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (readUint32(bytes, offset) === 0x06054b50) return offset;
  }
  throw new Error('This file is not a valid XLSX workbook.');
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
