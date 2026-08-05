import { PostContentField } from '@mzima-client/sdk';
import {
  deduplicatePostLocationFields,
  postFieldChoiceLabel,
  postFieldChoiceValues,
} from './post-field-options';

describe('postFieldChoiceLabel', () => {
  const field = {
    options: [
      {
        name: 'climate_shock',
        label: 'Environmental and Climate Early Warning',
        translations: { so: { label: 'Digniinta Hore ee Deegaanka iyo Cimilada' } },
      },
      { name: 'one_week_ago', label: 'One week Ago' },
      { name: 'field_monitor', label: 'Field Monitor' },
    ],
  } as PostContentField;

  it('uses the XLS option label instead of the stored machine name', () => {
    expect(postFieldChoiceLabel(field, 'climate_shock')).toBe(
      'Environmental and Climate Early Warning',
    );
    expect(postFieldChoiceLabel(field, 'one_week_ago')).toBe('One week Ago');
  });

  it('uses the requested option translation when available', () => {
    expect(postFieldChoiceLabel(field, 'climate_shock', 'so')).toBe(
      'Digniinta Hore ee Deegaanka iyo Cimilada',
    );
  });

  it('keeps legacy values readable when no configured option matches', () => {
    expect(postFieldChoiceLabel(field, 'legacy_value')).toBe('legacy value');
  });

  it('separates legacy space-delimited checkbox selections', () => {
    expect(postFieldChoiceValues(field, 'climate_shock field_monitor')).toEqual([
      'climate_shock',
      'field_monitor',
    ]);
  });

  it('shows a repeated GPS question only once and retains its populated value', () => {
    const emptyLocation = {
      id: 1,
      input: 'location',
      label: 'GPS location for the village or settlement',
      value: { value: null },
    } as PostContentField;
    const populatedLocation = {
      ...emptyLocation,
      id: 2,
      value: { value: { lat: 10.732893, lon: 47.296066 } },
    } as PostContentField;

    const fields = deduplicatePostLocationFields([
      emptyLocation,
      emptyLocation,
      populatedLocation,
      emptyLocation,
    ]);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toBe(populatedLocation);
  });
});
