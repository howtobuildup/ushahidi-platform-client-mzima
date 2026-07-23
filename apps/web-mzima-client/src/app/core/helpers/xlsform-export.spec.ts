import { SurveyItem } from '@mzima-client/sdk';
import { TextDecoder } from 'util';
import { exportXlsForm } from './xlsform-export';
import { importXlsForm } from './xlsform-import';

Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder });

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('XLSForm export', () => {
  it('creates an XLSX that can be imported again with questions and choices intact', async () => {
    const survey = {
      name: 'NAGAASHO EWER',
      enabled_languages: { default: 'en', available: ['so'] },
      tasks: [
        {
          fields: [
            { type: 'title', label: 'Title' },
            { type: 'description', label: 'Description' },
            {
              type: 'varchar',
              input: 'text',
              key: 'generated-monitor',
              label: 'Field monitor',
              instructions: 'Enter the monitor name',
              required: true,
              default: '',
              options: [],
              translations: {
                so: {
                  label: 'Kormeeraha goobta',
                  instructions: 'Geli magaca kormeeraha',
                },
              },
              config: { xlsform_name: 'field_monitor' },
            },
            {
              type: 'varchar',
              input: 'select',
              key: 'generated-incident',
              label: 'Incident type',
              required: true,
              default: '',
              translations: {
                so: {
                  label: 'Nooca dhacdada',
                  options: { climate_shock: 'Dhibaato cimilo' },
                },
              },
              config: {
                xlsform_name: 'incident_type',
                relevant: "${field_monitor} != ''",
              },
              options: [
                {
                  name: 'climate_shock',
                  label: 'Environmental and Climate Early Warning',
                  region: 'hiran',
                },
              ],
            },
            {
              type: 'point',
              input: 'location',
              key: 'generated-location',
              label: 'Location',
              required: false,
              default: '',
              options: [],
              translations: {},
              config: { xlsform_name: 'location' },
            },
          ],
        },
      ],
    } as unknown as SurveyItem;

    const exported = exportXlsForm(survey);
    const bytes = await readBlob(exported.blob);
    const imported = await importXlsForm({
      name: exported.fileName,
      arrayBuffer: async () => bytes,
    } as File);
    const fields = imported.tasks[0].fields;
    const incidentType = fields.find((field) => field.config?.xlsform_name === 'incident_type');

    expect(exported.fileName).toBe('NAGAASHO_EWER.xlsx');
    expect(exported.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(fields.some((field) => field.type === 'title')).toBe(true);
    expect(fields.some((field) => field.type === 'description')).toBe(true);
    expect(fields.find((field) => field.config?.xlsform_name === 'location')?.type).toBe('point');
    expect(incidentType).toMatchObject({
      input: 'select',
      label: 'Incident type',
      required: true,
      config: {
        xlsform_name: 'incident_type',
        relevant: "${field_monitor} != ''",
      },
    });
    expect(incidentType?.options).toEqual([
      expect.objectContaining({
        name: 'climate_shock',
        label: 'Environmental and Climate Early Warning',
        region: 'hiran',
      }),
    ]);
  });
});
