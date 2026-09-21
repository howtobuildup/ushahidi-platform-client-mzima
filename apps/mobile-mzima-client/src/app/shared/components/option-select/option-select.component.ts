import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectOptionInterface } from '@models';
import { xlsFormRules } from '@mzima-client/sdk';

type Option = SelectOptionInterface | string | Record<string, any>;

/**
 * The survey form's answer picker.
 *
 * Ionic's own select opens a popover that is sized to its content, floats over
 * the question it belongs to and truncates the longer survey labels. This draws
 * the list as a panel under the field instead, at the field's full width, so a
 * long option is readable and the question stays visible while choosing.
 *
 * `app-select` is left alone: it is used by the map, profile and collection
 * screens, which keep Ionic's behaviour.
 */
@Component({
  selector: 'app-option-select',
  templateUrl: './option-select.component.html',
  styleUrls: ['./option-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OptionSelectComponent),
      multi: true,
    },
  ],
})
export class OptionSelectComponent implements ControlValueAccessor {
  /**
   * Below this many options a search box is more clutter than help, so it is
   * only drawn for lists long enough to need it.
   */
  private static readonly SEARCH_THRESHOLD = 6;

  @Input() public options: Option[] = [];
  @Input() public placeholder = '';
  @Input() public language = 'en';
  @Input() public disabled = false;
  @Output() public selectBlur = new EventEmitter();

  @ViewChild('search') private searchInput?: ElementRef<HTMLInputElement>;

  public isOpen = false;
  public query = '';
  public value: any;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  public writeValue(value: any): void {
    this.value = value;
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.close();
  }

  public get showSearch(): boolean {
    return (this.options?.length ?? 0) > OptionSelectComponent.SEARCH_THRESHOLD;
  }

  public get filteredOptions(): Option[] {
    const options = this.options ?? [];
    const query = this.query.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => this.getOptionLabel(option).toLowerCase().includes(query));
  }

  public get selectedLabel(): string {
    const selected = (this.options ?? []).find((option) => this.isSelected(option));
    return selected ? this.getOptionLabel(selected) : '';
  }

  public toggle(): void {
    if (this.disabled) return;
    this.isOpen ? this.close() : this.open();
  }

  public select(option: Option): void {
    this.value = this.getOptionValue(option);
    // Close first. A choice can add or remove dependent questions through the
    // form's dynamic rules, and rebuilding controls while the panel is still on
    // screen is the kind of mid-render DOM change that has crashed the Android
    // WebView before.
    this.close();
    this.onChange(this.value);
  }

  public isSelected(option: Option): boolean {
    const value = this.getOptionValue(option);
    if (value === null || value === undefined || this.value === null || this.value === undefined) {
      return value === this.value;
    }
    // Survey answers arrive from the API as strings but can be set as numbers
    // in the form, so compare on the text rather than the type.
    return String(value) === String(this.value);
  }

  public getOptionValue(option: Option): any {
    return xlsFormRules.getOptionValue(option);
  }

  public getOptionLabel(option: Option): string {
    return xlsFormRules.getOptionLabel(option, this.language);
  }

  // Clicking anywhere else on the page closes the panel, which also means
  // opening one question's list closes another's.
  @HostListener('document:click', ['$event'])
  public handleDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('keydown.escape')
  public handleEscape(): void {
    if (this.isOpen) this.close();
  }

  private open(): void {
    this.isOpen = true;
    this.query = '';
    if (this.showSearch) {
      setTimeout(() => this.searchInput?.nativeElement.focus());
    }
  }

  private close(): void {
    this.isOpen = false;
    this.query = '';
    this.onTouched();
    this.selectBlur.emit();
  }
}
