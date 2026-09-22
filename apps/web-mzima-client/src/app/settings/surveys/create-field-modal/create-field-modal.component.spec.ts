import { of } from 'rxjs';

import { CreateFieldModalComponent } from './create-field-modal.component';

describe('CreateFieldModalComponent', () => {
  // Built by hand rather than through TestBed: the conversion rules are plain
  // logic, and the dialog's own wiring is not what is under test here.
  const build = (field: any) =>
    new CreateFieldModalComponent(
      { selectedFieldType: field, selectLanguageCode: 'en', surveyId: '2', fields: [] },
      { close: jest.fn() } as any,
      { instant: (key: string) => key } as any,
      { get: () => of({ results: [] }) } as any,
      { get: () => of({ results: [] }) } as any,
      { showError: jest.fn() } as any,
      { open: jest.fn() } as any,
    );

  const selectField = () => ({
    label: 'Region',
    type: 'varchar',
    input: 'select',
    options: [
      { name: 'sanaag', label: 'Sanaag' },
      { name: 'awdal', label: 'Awdal' },
    ],
    config: { choice_filter: '${region}=region' },
    translations: {},
  });

  it('should create', () => {
    const component = build(selectField());
    component.ngOnInit();

    expect(component).toBeTruthy();
    expect(component.editMode).toBe(true);
  });

  describe('changing a question type', () => {
    it('offers the types that keep the answers where they are', () => {
      const component = build(selectField());
      component.ngOnInit();

      const offered = component.convertibleFieldTypes.map((field: any) => field.input);

      expect(offered).toEqual(expect.arrayContaining(['select', 'radio', 'checkbox']));
      // Anything storing its answers in another table would strand them.
      expect(offered).not.toEqual(expect.arrayContaining(['number', 'date', 'location']));
    });

    it('keeps the options, their stored names and the choice filter', () => {
      const component = build(selectField());
      component.ngOnInit();

      component.changeFieldType('checkbox');

      expect(component.selectedFieldType.input).toBe('checkbox');
      expect(component.selectedFieldType.type).toBe('varchar');
      expect(component.selectedFieldType.options).toEqual([
        { name: 'sanaag', label: 'Sanaag' },
        { name: 'awdal', label: 'Awdal' },
      ]);
      expect(component.selectedFieldType.config.choice_filter).toBe('${region}=region');
    });

    it('still shows the options for editing after the change', () => {
      const component = build(selectField());
      component.ngOnInit();

      component.changeFieldType('radio');

      expect(component.hasOptions).toBe(true);
      expect(component.fieldOptions.map((option) => option.value)).toEqual(['Sanaag', 'Awdal']);
    });

    it('marks a checkbox as holding more than one answer, and clears it again', () => {
      const component = build(selectField());
      component.ngOnInit();

      component.changeFieldType('checkbox');
      expect(component.selectedFieldType.cardinality).toBe(0);

      component.changeFieldType('select');
      expect(component.selectedFieldType.cardinality).toBeUndefined();
    });

    it('drops the options when the new type has none to show', () => {
      const component = build({ ...selectField(), config: { randomize_options: true } });
      component.ngOnInit();

      component.changeFieldType('text');

      expect(component.hasOptions).toBe(false);
      expect(component.selectedFieldType.options).toBeUndefined();
      expect(component.fieldOptions).toEqual([]);
      expect(component.selectedFieldType.config.randomize_options).toBeUndefined();
    });

    it('warns when the new type keeps fewer answers than the old one', () => {
      const component = build({ ...selectField(), input: 'checkbox' });
      component.ngOnInit();

      expect(component.fieldTypeChangeLosesAnswers).toBe(false);

      component.changeFieldType('select');
      expect(component.fieldTypeChangeLosesAnswers).toBe(true);

      component.changeFieldType('checkbox');
      expect(component.fieldTypeChangeLosesAnswers).toBe(false);
    });

    it('asks for options when the new type needs them and there are none', () => {
      const component = build({
        label: 'Notes',
        type: 'varchar',
        input: 'text',
        translations: {},
      });
      component.ngOnInit();

      component.changeFieldType('select');

      expect(component.fieldTypeChangeNeedsOptions).toBe(true);
    });

    it('ignores a type it was not offering', () => {
      const component = build(selectField());
      component.ngOnInit();

      component.changeFieldType('date');

      expect(component.selectedFieldType.input).toBe('select');
    });

    it('leaves categories alone, since their options come from the taxonomy', () => {
      const component = build({
        label: 'Categories',
        type: 'tags',
        input: 'tags',
        translations: {},
      });
      component.ngOnInit();

      expect(component.canChangeFieldType).toBe(false);
    });

    it('offers nothing while adding a field, where the type was just chosen', () => {
      const component = build(undefined);
      component.ngOnInit();

      expect(component.convertibleFieldTypes).toEqual([]);
      expect(component.canChangeFieldType).toBe(false);
    });
  });
});
