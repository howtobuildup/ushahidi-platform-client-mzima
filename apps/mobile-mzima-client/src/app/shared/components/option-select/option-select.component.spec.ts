import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { OptionSelectComponent } from './option-select.component';

describe('OptionSelectComponent', () => {
  let component: OptionSelectComponent;
  let fixture: ComponentFixture<OptionSelectComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [OptionSelectComponent],
      imports: [FormsModule, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(OptionSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reads XLSForm name and label options', () => {
    const option = { name: 'climate_shock', label: 'Environmental and climate Early warning' };

    expect(component.getOptionValue(option)).toBe('climate_shock');
    expect(component.getOptionLabel(option)).toBe('Environmental and climate Early warning');
  });

  it('shows the chosen option in the field', () => {
    component.options = [
      { name: 'sanaag', label: 'Sanaag' },
      { name: 'awdal', label: 'Awdal' },
    ];
    component.writeValue('awdal');

    expect(component.selectedLabel).toBe('Awdal');
  });

  it('matches a numeric survey value against a string option name', () => {
    component.options = [{ name: '3', label: 'Three' }];
    component.writeValue(3);

    expect(component.selectedLabel).toBe('Three');
  });

  it('reports the choice and closes the panel', () => {
    const onChange = jest.fn();
    component.registerOnChange(onChange);
    component.options = [{ name: 'gender_based_violence', label: 'GBV' }];
    component.toggle();

    component.select(component.options[0]);

    expect(onChange).toHaveBeenCalledWith('gender_based_violence');
    expect(component.isOpen).toBe(false);
  });

  it('only offers a search box for lists long enough to need one', () => {
    component.options = [1, 2, 3].map((n) => ({ name: `${n}`, label: `${n}` }));
    expect(component.showSearch).toBe(false);

    component.options = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `${n}`, label: `${n}` }));
    expect(component.showSearch).toBe(true);
  });

  it('filters options on the label, ignoring case', () => {
    component.options = [
      { name: 'sanaag', label: 'Sanaag' },
      { name: 'awdal', label: 'Awdal' },
    ];
    component.query = 'AWD';

    expect(component.filteredOptions).toEqual([{ name: 'awdal', label: 'Awdal' }]);
  });

  it('does not open when disabled', () => {
    component.disabled = true;

    component.toggle();

    expect(component.isOpen).toBe(false);
  });
});
