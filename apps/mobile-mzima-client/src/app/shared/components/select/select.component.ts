import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { SelectOptionInterface } from '@models';
import { xlsFormRules } from '@mzima-client/sdk';

@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  @Input() public options?: Array<SelectOptionInterface | string | Record<string, any>>;
  @Input() public label?: string;
  @Input() public placeholder: string = '';
  @Input() public hintHTML?: string;
  @Input() public hint?: string;
  @Input() public required = false;
  @Input() public rounded = false;
  @Input() public disabled = false;
  @Input() public errors: string[] = [];
  @Input() public language = 'en';
  @Input() public color: 'light' | 'default' = 'default';
  @Output() public selectFocus = new EventEmitter();
  @Output() public selectBlur = new EventEmitter();
  public isOnFocus: boolean;
  private hasPendingValue = false;
  private pendingValue: any;

  value: string;
  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  public handleSelectChange(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value;
    this.pendingValue = typeof value === 'string' ? value.trim() : value;
    this.hasPendingValue = true;
  }

  public handleDismiss(): void {
    if (!this.hasPendingValue) return;

    const value = this.pendingValue;
    this.hasPendingValue = false;
    this.pendingValue = undefined;
    this.onChange(value);
  }

  public handleFocus(): void {
    this.isOnFocus = true;
    this.selectFocus.emit();
  }

  public handleBlur(): void {
    this.onTouched();
    this.isOnFocus = false;
    this.selectBlur.emit();
  }

  public getOptionValue(option: SelectOptionInterface | string | Record<string, any>): any {
    return xlsFormRules.getOptionValue(option);
  }

  public getOptionLabel(option: SelectOptionInterface | string | Record<string, any>): string {
    return xlsFormRules.getOptionLabel(option, this.language);
  }
}
