import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { SelectComponent } from './select.component';

describe('SelectComponent', () => {
  let component: SelectComponent;
  let fixture: ComponentFixture<SelectComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [SelectComponent],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
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
});
