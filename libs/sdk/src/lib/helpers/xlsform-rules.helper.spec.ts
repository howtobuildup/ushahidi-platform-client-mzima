import { buildXlsFormValueMap, getFilteredOptions } from './xlsform-rules.helper';

describe('getFilteredOptions', () => {
  const options = [
    { name: 'erigavo', region: 'sanaag' },
    { name: 'laas_anod', region: 'sool' },
  ];

  it('filters standard XLSForm property-first expressions', () => {
    expect(
      getFilteredOptions(
        { config: { choice_filter: 'region=${region}' }, options },
        { region: 'sanaag' },
      ),
    ).toEqual([{ name: 'erigavo', region: 'sanaag' }]);
  });

  it('filters the existing question-first expression format', () => {
    expect(
      getFilteredOptions(
        { config: { choice_filter: '${region}=region' }, options },
        { region: 'sool' },
      ),
    ).toEqual([{ name: 'laas_anod', region: 'sool' }]);
  });

  it('keeps manually added options without filter metadata visible', () => {
    const manualOption = { name: 'new_district', label: 'New district' };

    expect(
      getFilteredOptions(
        {
          config: { choice_filter: '${region}=region' },
          options: [...options, manualOption],
        },
        { region: 'sanaag' },
      ),
    ).toEqual([{ name: 'erigavo', region: 'sanaag' }, manualOption]);
  });

  it('keeps all saved options visible when imported filter metadata is absent', () => {
    const unscopedOptions = [
      { name: 'erigavo', label: 'Erigavo' },
      { name: 'laas_anod', label: "Laas'anod" },
    ];

    expect(
      getFilteredOptions(
        { config: { choice_filter: '${region}=region' }, options: unscopedOptions },
        { region: 'sanaag' },
      ),
    ).toEqual(unscopedOptions);
  });
});

describe('buildXlsFormValueMap', () => {
  it('maps persisted XLSForm names to generated field keys', () => {
    const fields = [
      {
        key: 'generated-region-id',
        config: { xlsform_name: 'region' },
      },
    ];

    expect(buildXlsFormValueMap(fields, { 'generated-region-id': 'sanaag' })).toMatchObject({
      region: 'sanaag',
    });
  });

  it('derives unique aliases from labels for existing imported surveys', () => {
    const fields = [
      {
        key: 'generated-region-id',
        label: 'Region where incidence occurred',
      },
      {
        key: 'generated-district-id',
        label: 'District where incidence occurred',
      },
    ];

    expect(
      buildXlsFormValueMap(fields, {
        'generated-region-id': 'sanaag',
        'generated-district-id': 'erigavo',
      }),
    ).toMatchObject({
      region: 'sanaag',
      district: 'erigavo',
      region_where_incidence_occurred: 'sanaag',
      district_where_incidence_occurred: 'erigavo',
    });
  });
});
