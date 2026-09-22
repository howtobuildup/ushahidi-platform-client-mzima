import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { surveyHelper, regexHelper } from '@helpers';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { MultilevelSelectOption } from '../../../shared/components';
import {
  CategoriesService,
  SurveysService,
  CategoryInterface,
  FormAttributeInterface,
  SurveyItem,
} from '@mzima-client/sdk';
import { NotificationService } from '@services';
import _ from 'lodash';
import { SkipLogicModalComponent } from '../skip-logic-modal/skip-logic-modal.component';
import { ValidationCriteriaModalComponent } from '../validation-criteria-modal/validation-criteria-modal.component';

@Component({
  selector: 'app-create-field-modal',
  templateUrl: './create-field-modal.component.html',
  styleUrls: ['./create-field-modal.component.scss'],
})
export class CreateFieldModalComponent implements OnInit {
  private surveyId: string;
  public fields = _.cloneDeep(surveyHelper.surveyFields);
  public selectedFieldType: any;
  public editMode = false;
  /** The input this question had when the dialog opened. */
  public originalFieldInput = '';
  public availableCategories?: MultilevelSelectOption[];
  public categories: any = [];
  public availableSurveys: SurveyItem[] = [];
  public hasOptions = false;
  public fieldOptions: Array<{ value: string; error: string }> = [];
  public emptyTitleOption = false;
  public numberError = false;
  isTranslateMode = false;
  selectLanguageCode = 'en';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private matDialogRef: MatDialogRef<CreateFieldModalComponent>,
    private translate: TranslateService,
    private categoriesService: CategoriesService,
    private surveysService: SurveysService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    this.isTranslateMode = this.data?.isTranslateMode;
    this.selectLanguageCode = this.data?.selectLanguageCode;
    if (this.data?.selectedFieldType) {
      this.editField();
    }
    this.surveyId = this.data?.surveyId;
    this.getCategories();
  }

  private editField() {
    this.selectedFieldType = this.data.selectedFieldType;
    this.ensureFieldConfig();
    if (
      this.selectedFieldType.input === 'tags' &&
      this.selectedFieldType.options?.length &&
      typeof this.selectedFieldType.options[0] === 'object'
    ) {
      this.selectedFieldType.options = this.selectedFieldType.options.map(
        (option: any) => option.id,
      );
    }
    this.editMode = true;
    this.originalFieldInput = this.selectedFieldType.input;
    this.setHasOptionValidate();
    if (this.hasOptions) {
      this.setTempSelectedFieldType();
    }
    this.checkLoadAvailableData(this.selectedFieldType.input);
    if (Array.isArray(this.selectedFieldType.translations)) {
      this.selectedFieldType.translations = {};
    }

    if (!this.selectedFieldType.translations[this.selectLanguageCode]) {
      this.selectedFieldType.translations[this.selectLanguageCode] = { label: '' };
    }
  }

  private getCategories() {
    const array: MultilevelSelectOption[] = [];
    this.categoriesService
      .get()
      .pipe(
        map((res) => {
          for (const category of res?.results) {
            if (!category.parent_id) {
              array.push({
                id: category.id,
                name: category.tag,
                children: res?.results
                  ?.filter((cat: CategoryInterface) => cat.parent_id === category.id)
                  .map((cat: CategoryInterface) => {
                    return {
                      id: cat.id,
                      name: cat.tag,
                    };
                  }),
              });
            }
          }
          return array;
        }),
      )
      .subscribe({
        next: (response) => {
          this.availableCategories = response;
        },
        error: (err) => console.log(err),
      });
  }

  onChange(index: number) {
    const option = this.fieldOptions[index];
    const value = option.value.trim();
    const selectedOption = this.selectedFieldType.options[index];
    if (selectedOption && typeof selectedOption === 'object') {
      selectedOption.label = value;
      if (!selectedOption.name) {
        selectedOption.name = value;
      }
    } else {
      this.selectedFieldType.options[index] = value;
    }
    this.checkForEmptyOptions();
    this.optionValidation(index);
  }

  optionValidation(index: number) {
    const option = this.fieldOptions[index];

    if (!regexHelper.alphaNumeric(option.value)) {
      option.error = 'survey.special_characters_option';
    } else {
      const duplicates = this.fieldOptions.filter(
        (e, i) => e.value === option.value && i !== index,
      );
      option.error = duplicates.length ? 'survey.duplicate_option' : '';
    }
  }

  public checkForSpecialOptions(): boolean {
    return this.fieldOptions.some((option) => !!option.error);
  }

  private checkForEmptyOptions() {
    this.emptyTitleOption = this.fieldOptions.some((option) => option.value.trim() === '');
  }

  get onlyOptional() {
    const types = ['tags', 'description', 'title'];
    return !types.includes(this.selectedFieldType.type);
  }

  get canMakePrivate() {
    const types = ['tags', 'description', 'title'];
    return !types.includes(this.selectedFieldType.type);
  }

  get canDisableCaption() {
    const types = ['media'];
    return types.includes(this.selectedFieldType.type);
  }

  get canRandomizeOptions() {
    return surveyHelper.fieldCanHaveOptions(this.selectedFieldType);
  }

  get canValidateValue() {
    const inputs = ['upload', 'tags', 'location', 'relation', 'markdown'];
    const types = ['title', 'description'];
    return (
      !inputs.includes(this.selectedFieldType.input) && !types.includes(this.selectedFieldType.type)
    );
  }

  get canDisplay() {
    const inputs = [
      'upload',
      'tags',
      'location',
      'checkbox',
      'select',
      'radio',
      'date',
      'datetime',
    ];
    return !inputs.includes(this.selectedFieldType.input);
  }

  private loadAvailableSurveys() {
    this.surveysService.get().subscribe({
      next: (types) => {
        this.availableSurveys =
          types.results.filter((s: any) => s.id.toString() !== this.surveyId) || [];
      },
    });
  }

  private isNumber({ default: val, type }: any): boolean {
    if (type === 'decimal') {
      return /((?<!\S)[-+]?[0-9]*[.,][0-9]+$)/gm.test(String(val).trim());
    }
    if (type === 'int') {
      return /^-?\d+$/gm.test(String(val).trim());
    }
    return true;
  }

  public addNewTask() {
    this.normalizeFieldConfig();
    if (this.selectedFieldType.input === 'number') {
      if (this.isNumber(this.selectedFieldType)) {
        this.numberError = false;
      } else {
        this.numberError = true;
        return;
      }
    }

    if (this.hasOptions && !this.selectedFieldType.options?.length) {
      this.notificationService.showError(this.translate.instant('survey.add_options_first'));
      return;
    }

    if (!this.selectedFieldType.translations) {
      this.selectedFieldType.translations = {};
    }

    this.matDialogRef.close({
      ...this.selectedFieldType,
      label: this.selectedFieldType.label.trim(),
    });
  }

  public openSkipLogicModal() {
    this.ensureFieldConfig();
    const dialogRef = this.dialog.open(SkipLogicModalComponent, {
      width: '100%',
      maxWidth: 980,
      minWidth: 300,
      panelClass: 'modal',
      data: {
        currentField: this.selectedFieldType,
        fields: this.data?.fields || [],
        expression: this.selectedFieldType.config.relevant || '',
      },
    });

    dialogRef.afterClosed().subscribe({
      next: (expression) => {
        if (expression === null || expression === undefined) return;
        if (expression) {
          this.selectedFieldType.config.relevant = expression;
        } else {
          delete this.selectedFieldType.config.relevant;
        }
      },
    });
  }

  public openValidationCriteriaModal() {
    this.ensureFieldConfig();
    const dialogRef = this.dialog.open(ValidationCriteriaModalComponent, {
      width: '100%',
      maxWidth: 840,
      minWidth: 300,
      panelClass: 'modal',
      data: {
        currentField: this.selectedFieldType,
        expression: this.selectedFieldType.config.constraint || '',
      },
    });

    dialogRef.afterClosed().subscribe({
      next: (expression) => {
        if (expression === null || expression === undefined) return;
        if (expression) {
          this.selectedFieldType.config.constraint = expression;
        } else {
          delete this.selectedFieldType.config.constraint;
        }
      },
    });
  }

  /**
   * The types this question could become without stranding its answers.
   *
   * An answer lives in the table its field's `type` names: post_varchar,
   * post_int, post_datetime and so on. Changing `type` would leave every
   * answer already given behind in the old table, so only changes that keep
   * `type` are offered. Between a select, a radio and a checkbox that is the
   * whole difference, which is why a survey imported from a spreadsheet can be
   * corrected here rather than rebuilt.
   */
  public get convertibleFieldTypes(): any[] {
    if (!this.editMode || !this.selectedFieldType) return [];

    return this.fields.filter(
      (field: any) =>
        field.type === this.selectedFieldType.type &&
        // Categories are drawn from the deployment's own taxonomy rather than
        // from options typed here, so they are not interchangeable.
        field.input !== 'tags' &&
        this.selectedFieldType.input !== 'tags',
    );
  }

  public get canChangeFieldType(): boolean {
    return this.convertibleFieldTypes.length > 1;
  }

  /**
   * True where the new type holds fewer answers than the old one, so a post
   * that ticked several boxes would keep only one of them.
   */
  public get fieldTypeChangeLosesAnswers(): boolean {
    return (
      this.originalFieldInput === 'checkbox' &&
      ['select', 'radio'].includes(this.selectedFieldType?.input)
    );
  }

  /** True where the question now needs options it does not have. */
  public get fieldTypeChangeNeedsOptions(): boolean {
    return this.hasOptions && !this.selectedFieldType?.options?.length;
  }

  public changeFieldType(input: string): void {
    const target = this.convertibleFieldTypes.find((field: any) => field.input === input);
    if (!target || target.input === this.selectedFieldType.input) return;

    const couldHaveOptions = surveyHelper.fieldCanHaveOptions(this.selectedFieldType);
    const existingOptions = couldHaveOptions ? this.selectedFieldType.options ?? [] : [];

    this.selectedFieldType.input = target.input;
    this.selectedFieldType.type = target.type;

    // Only a checkbox holds more than one answer, so the marker follows the
    // type rather than lingering from whatever the field used to be.
    if (target.cardinality === undefined) {
      delete this.selectedFieldType.cardinality;
    } else {
      this.selectedFieldType.cardinality = target.cardinality;
    }

    this.setHasOptionValidate();

    if (this.hasOptions) {
      // Carried across untouched, so the wording, the stored names the answers
      // reference and any choice filter all survive the change.
      this.selectedFieldType.options = existingOptions;
      this.setTempSelectedFieldType();
    } else {
      delete this.selectedFieldType.options;
      this.fieldOptions = [];
      this.emptyTitleOption = false;
      if (this.selectedFieldType.config) {
        delete this.selectedFieldType.config.randomize_options;
      }
    }

    this.checkLoadAvailableData(this.selectedFieldType.input);
  }

  public selectField(field: Partial<FormAttributeInterface>) {
    this.selectedFieldType = _.cloneDeep(field);
    this.ensureFieldConfig();
    this.selectedFieldType.label = this.translate.instant(this.selectedFieldType.label);
    this.selectedFieldType.instructions = this.translate.instant(
      this.selectedFieldType.instructions,
    );
    this.setHasOptionValidate();
    this.checkLoadAvailableData(this.selectedFieldType.input);
    if (this.selectedFieldType.input === 'number' && this.selectedFieldType.type === 'int') {
      this.selectedFieldType.default = 0;
    }
    if (this.selectedFieldType.input === 'number' && this.selectedFieldType.type === 'decimal') {
      this.selectedFieldType.default = '0.0';
    }
  }

  private checkLoadAvailableData(input: string) {
    switch (input) {
      case 'relation':
        return this.loadAvailableSurveys();
    }
  }

  public removeOption(i: any) {
    this.selectedFieldType.options.splice(i, 1);
    this.fieldOptions.splice(i, 1);
    this.checkForEmptyOptions();
  }

  public addOption() {
    if (!this.selectedFieldType.options) this.selectedFieldType.options = [];
    this.selectedFieldType.options.push('');
    this.fieldOptions.push({ value: '', error: '' });
    this.checkForEmptyOptions();
  }

  private setTempSelectedFieldType() {
    if (!Array.isArray(this.selectedFieldType.options)) {
      this.selectedFieldType.options = [];
    }

    this.fieldOptions = this.selectedFieldType.options.map((option: any) => ({
      value: this.getEditableOptionLabel(option),
      error: '',
    }));
    this.fieldOptions.forEach((opt, i) => this.optionValidation(i));
  }

  private getEditableOptionLabel(option: any): string {
    if (!option || typeof option !== 'object') {
      return String(option ?? '');
    }

    return String(option.label ?? option.name ?? option.value ?? option.tag ?? option.id ?? '');
  }

  private setHasOptionValidate() {
    this.hasOptions = ['checkbox', 'radio', 'select'].some(
      (a) => a === this.selectedFieldType.input,
    );
  }

  private ensureFieldConfig() {
    if (!this.selectedFieldType.config || Array.isArray(this.selectedFieldType.config)) {
      this.selectedFieldType.config = {};
    }

    if (this.selectedFieldType.input === 'relation' && !this.selectedFieldType.config.input) {
      this.selectedFieldType.config.input = { form: [] };
    }
  }

  private normalizeFieldConfig() {
    this.ensureFieldConfig();
    const config = this.selectedFieldType.config;

    ['relevant', 'constraint', 'constraint_message'].forEach((key) => {
      if (typeof config[key] === 'string') {
        config[key] = config[key].trim();
      }
      if (!config[key]) {
        delete config[key];
      }
    });

    if (!config.randomize_options) {
      delete config.randomize_options;
    }
  }

  public validateDuplicate() {
    if (surveyHelper.fieldCanHaveOptions(this.selectedFieldType)) {
      return surveyHelper.areOptionsUnique(this.fieldOptions.map((option) => option.value.trim()));
    }
    return true;
  }
}
