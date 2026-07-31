import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { SelectComponent } from './select.component';

describe('SelectComponent', () => {
  let component: SelectComponent;
  let fixture: ComponentFixture<SelectComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [SelectComponent],
      imports: [FormsModule, IonicModule.forRoot(), TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('supports XLSForm name and label options without remapping them', () => {
    const option = {
      name: 'climate_shock',
      label: 'Environmental and climate Early warning',
    };

    expect(component.getOptionValue(option)).toBe('climate_shock');
    expect(component.getOptionLabel(option)).toBe('Environmental and climate Early warning');
  });

  it('preserves falsy option values', () => {
    const option = { value: 0, label: 'None' };

    expect(component.getOptionValue(option)).toBe(0);
    expect(component.getOptionLabel(option)).toBe('None');
  });

  it('updates the form only after the Ionic select overlay is dismissed', () => {
    const onChange = jest.fn();
    component.registerOnChange(onChange);

    component.handleSelectChange({ target: { value: ' gender_based_violence ' } } as any);

    expect(onChange).not.toHaveBeenCalled();

    component.handleDismiss();

    expect(onChange).toHaveBeenCalledWith('gender_based_violence');
  });

  it('does not update the form when an overlay is dismissed without a selection', () => {
    const onChange = jest.fn();
    component.registerOnChange(onChange);

    component.handleDismiss();

    expect(onChange).not.toHaveBeenCalled();
  });
});
