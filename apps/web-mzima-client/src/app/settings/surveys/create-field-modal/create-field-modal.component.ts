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
      this.setTempSelectedFieldType();
    }
    this.editMode = true;
    this.setHasOptionValidate();
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
    this.selectedFieldType.options[index] = option.value.trim();
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
    if (this.selectedFieldType.options.length) {
      this.emptyTitleOption = !!this.selectedFieldType.options.filter(
        (el: string) => el.trim() === '',
      ).length;
    }
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
    this.checkForEmptyOptions();
    this.fieldOptions.push({ value: '', error: '' });
  }

  private setTempSelectedFieldType() {
    this.fieldOptions = this.selectedFieldType.options.map((opt: string) => ({
      value: opt,
      error: '',
    }));
    this.fieldOptions.forEach((opt, i) => this.optionValidation(i));
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
      return surveyHelper.areOptionsUnique(this.selectedFieldType.options);
    }
    return true;
  }
}
