import { FormBuilder, FormControl, ValidatorFn, Validators } from '@angular/forms';
import { xlsFormRules } from '@mzima-client/sdk';
import { AlphanumericValidator, FormValidator, PhotoRequiredValidator } from '@validators';

export class PostEditForm {
  private formBuilder: FormBuilder;

  constructor(private fb: FormBuilder) {
    this.formBuilder = fb;
  }

  public addFormControl(value: any, field: any): FormControl {
    if (field.input === 'video') {
      const videoValidators = [];
      if (field.required) {
        videoValidators.push(Validators.required);
      }
      videoValidators.push(new FormValidator().videoValidator);
      return new FormControl(value, videoValidators);
    }

    const validators: ValidatorFn[] = [];
    switch (field.type) {
      case 'description':
        validators.push(Validators.minLength(2), AlphanumericValidator());
        if (field.required) validators.push(Validators.required);
        break;
      case 'title':
        validators.push(Validators.required, Validators.minLength(2), AlphanumericValidator());
        break;
      case 'media':
        if (field.required) {
          validators.push(PhotoRequiredValidator());
        }
        break;
      default:
        if (field.required) {
          validators.push(Validators.required);
        }
        break;
    }
    validators.push(this.xlsFormConstraintValidator(field));
    return new FormControl(value, validators);
  }

  public addFormArray(value: string, field: any) {
    const validators = [
      field.required ? Validators.required : null,
      this.xlsFormConstraintValidator(field),
    ].filter(Boolean) as ValidatorFn[];
    return this.formBuilder.array([] || [new FormControl(value)], validators);
  }

  private xlsFormConstraintValidator(field: any): ValidatorFn {
    return (control) =>
      xlsFormRules.isFieldConstraintValid(field, control.value)
        ? null
        : { xlsFormConstraint: true };
  }
}
