/* eslint-disable @typescript-eslint/no-use-before-define, no-control-regex */
import { FormAttributeInterface, SurveyItem } from '@mzima-client/sdk';

type XlsFormCell = string | number | boolean | null | undefined;
type XlsFormRow = XlsFormCell[];

interface ChoiceSheet {
  headers: string[];
  rows: XlsFormRow[];
}

interface ZipFile {
  name: string;
  data: Uint8Array;
}

export interface ExportedXlsForm {
  blob: Blob;
  fileName: string;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ENGLISH_LABEL = 'label::English (en)';
const SOMALI_LABEL = 'label::Somali (so)';

export function exportXlsForm(survey: SurveyItem): ExportedXlsForm {
  const fields = (survey.tasks || []).reduce(
    (result, task) => [
      ...result,
      ...(task.fields || []).filter((field) => !['title', 'description'].includes(field.type)),
    ],
    [] as FormAttributeInterface[],
  );
  const includeSomali =
    survey.enabled_languages?.default === 'so' ||
    survey.enabled_languages?.available?.includes('so') ||
    fields.some((field) => !!field.translations?.['so']);
  const choiceSheet = buildChoiceSheet(fields, includeSomali);
  const files = buildWorkbookFiles([
    {
      name: 'survey',
      rows: [
        getSurveyHeaders(includeSomali),
        ...fields.map((field, index) => mapSurveyField(field, index, includeSomali)),
      ],
    },
    {
      name: 'choices',
      rows: [choiceSheet.headers, ...choiceSheet.rows],
    },
    {
      name: 'settings',
      rows: [
        ['form_title', 'form_id', 'version', 'default_language'],
        [
          survey.name,
          sanitizeIdentifier(survey.name, 'survey'),
          '1',
          formatLanguage(survey.enabled_languages?.default || 'en'),
        ],
      ],
    },
  ]);

  return {
    blob: new Blob([createZip(files)], { type: XLSX_MIME }),
    fileName: `${sanitizeFileName(survey.name || 'survey')}.xlsx`,
  };
}

function getSurveyHeaders(includeSomali: boolean): string[] {
  return [
    'type',
    'name',
    ENGLISH_LABEL,
    ...(includeSomali ? [SOMALI_LABEL] : []),
    'hint::English (en)',
    ...(includeSomali ? ['hint::Somali (so)'] : []),
    'required',
    'relevant',
    'constraint',
    'constraint_message::English (en)',
    ...(includeSomali ? ['constraint_message::Somali (so)'] : []),
    'default',
    'choice_filter',
    'parameters',
  ];
}

function mapSurveyField(
  field: FormAttributeInterface,
  index: number,
  includeSomali: boolean,
): XlsFormRow {
  const config = getConfig(field);
  const name = sanitizeIdentifier(config['xlsform_name'] || field.key, `question_${index + 1}`);
  const listName = hasChoices(field)
    ? sanitizeIdentifier(config['xlsform_list_name'], `list_${name}`)
    : '';

  return [
    mapFieldType(field, listName),
    name,
    field.label || name,
    ...(includeSomali ? [getTranslation(field, 'so', 'label') || field.label || name] : []),
    field.instructions || '',
    ...(includeSomali
      ? [getTranslation(field, 'so', 'instructions') || field.instructions || '']
      : []),
    field.required ? 'yes' : 'no',
    config['relevant'] || '',
    config['constraint'] || '',
    config['constraint_message'] || '',
    ...(includeSomali ? [config['constraint_message::Somali (so)'] || ''] : []),
    field.default ?? '',
    config['choice_filter'] || '',
    config['parameters'] || '',
  ];
}

function buildChoiceSheet(fields: FormAttributeInterface[], includeSomali: boolean): ChoiceSheet {
  const extraHeaders: string[] = [];
  const rows: Array<Record<string, XlsFormCell>> = [];

  fields.forEach((field, fieldIndex) => {
    if (!hasChoices(field)) return;

    const config = getConfig(field);
    const fieldName = sanitizeIdentifier(
      config['xlsform_name'] || field.key,
      `question_${fieldIndex + 1}`,
    );
    const listName = sanitizeIdentifier(config['xlsform_list_name'], `list_${fieldName}`);

    (field.options || []).forEach((rawOption, optionIndex) => {
      const option = normalizeOption(rawOption, optionIndex);
      const row: Record<string, XlsFormCell> = {
        list_name: listName,
        name: option.name,
        [ENGLISH_LABEL]: option.label,
      };
      if (includeSomali) {
        row[SOMALI_LABEL] =
          option.translations?.['so']?.['label'] ||
          field.translations?.['so']?.['options']?.[option.name] ||
          option.label;
      }

      Object.keys(option).forEach((key) => {
        if (['name', 'label', 'translations', 'value'].includes(key)) return;
        const value = option[key];
        if (value === null || value === undefined || typeof value === 'object') return;
        row[key] = value;
        if (!extraHeaders.includes(key)) extraHeaders.push(key);
      });
      rows.push(row);
    });
  });

  const headers = [
    'list_name',
    'name',
    ENGLISH_LABEL,
    ...(includeSomali ? [SOMALI_LABEL] : []),
    ...extraHeaders,
  ];
  return {
    headers,
    rows: rows.map((row) => headers.map((header) => row[header] ?? '')),
  };
}

function normalizeOption(rawOption: any, index: number): any {
  if (rawOption !== null && typeof rawOption === 'object') {
    const name = String(rawOption.name ?? rawOption.value ?? `option_${index + 1}`);
    return {
      ...rawOption,
      name,
      label: String(rawOption.label ?? rawOption.value ?? name),
    };
  }

  const value = String(rawOption ?? `option_${index + 1}`);
  return { name: value, label: value };
}

function hasChoices(field: FormAttributeInterface): boolean {
  return ['select', 'radio', 'checkbox', 'tags'].includes(field.input);
}

function mapFieldType(field: FormAttributeInterface, listName: string): string {
  switch (field.input) {
    case 'select':
    case 'radio':
      return `select_one ${listName}`;
    case 'checkbox':
    case 'tags':
      return `select_multiple ${listName}`;
    case 'location':
      return 'geopoint';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'upload':
      return 'image';
  }

  switch (field.type) {
    case 'point':
      return 'geopoint';
    case 'int':
    case 'integer':
      return 'integer';
    case 'decimal':
      return 'decimal';
    case 'datetime':
      return 'datetime';
    case 'media':
      return 'image';
    default:
      return 'text';
  }
}

function getConfig(field: FormAttributeInterface): Record<string, any> {
  return field.config && !Array.isArray(field.config) ? field.config : {};
}

function getTranslation(field: FormAttributeInterface, language: string, property: string): string {
  return String(field.translations?.[language]?.[property] || '');
}

function formatLanguage(code: string): string {
  switch (code) {
    case 'so':
      return 'Somali (so)';
    case 'en':
      return 'English (en)';
    default:
      return code;
  }
}

function sanitizeIdentifier(value: unknown, fallback: string): string {
  const sanitized = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized || fallback;
}

function sanitizeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^\.+|\.+$/g, '') || 'survey'
  );
}

function buildWorkbookFiles(sheets: Array<{ name: string; rows: XlsFormRow[] }>): ZipFile[] {
  return [
    {
      name: '[Content_Types].xml',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          sheets
            .map(
              (_, index) =>
                `<Override PartName="/xl/worksheets/sheet${
                  index + 1
                }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join('') +
          '</Types>',
      ),
    },
    {
      name: '_rels/.rels',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          `<sheets>${sheets
            .map(
              (sheet, index) =>
                `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${
                  index + 1
                }"/>`,
            )
            .join('')}</sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          sheets
            .map(
              (_, index) =>
                `<Relationship Id="rId${
                  index + 1
                }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
                  index + 1
                }.xml"/>`,
            )
            .join('') +
          '</Relationships>',
      ),
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encodeUtf8(createSheetXml(sheet.rows)),
    })),
  ];
}

function createSheetXml(rows: XlsFormRow[]): string {
  const rowXml = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, columnIndex) => {
            const reference = `${getColumnName(columnIndex)}${rowIndex + 1}`;
            return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
              String(cell ?? ''),
            )}</t></is></c>`;
          })
          .join('')}</row>`,
    )
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rowXml}</sheetData></worksheet>`
  );
}

function getColumnName(index: number): string {
  let result = '';
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createZip(files: ZipFile[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encodeUtf8(file.name);
    const checksum = crc32(file.data);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.data.length;
  });

  const centralDirectory = concatenate(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);

  return concatenate([...localParts, centralDirectory, end]);
}

function encodeUtf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) || 0;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function concatenate(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
