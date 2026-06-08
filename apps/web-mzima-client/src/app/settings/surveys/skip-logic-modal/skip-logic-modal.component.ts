import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormAttributeInterface } from '@mzima-client/sdk';

interface SkipLogicCondition {
  fieldKey: string;
  operator: '=' | '!=';
  response: string;
}

@Component({
  selector: 'app-skip-logic-modal',
  templateUrl: './skip-logic-modal.component.html',
  styleUrls: ['./skip-logic-modal.component.scss'],
})
export class SkipLogicModalComponent {
  public mode: 'choice' | 'conditions' | 'manual' = 'choice';
  public manualExpression = '';
  public conditions: SkipLogicCondition[] = [];
  public availableFields: FormAttributeInterface[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private matDialogRef: MatDialogRef<SkipLogicModalComponent>,
  ) {
    this.manualExpression = data?.expression || '';
    this.availableFields = (data?.fields || []).filter((field: FormAttributeInterface) => {
      return field.key && field.key !== data?.currentField?.key;
    });
    this.conditions = this.parseExpression(this.manualExpression);
    if (this.conditions.length) {
      this.mode = 'conditions';
    } else if (this.manualExpression) {
      this.mode = 'manual';
    }
  }

  public selectConditionsMode(): void {
    if (!this.conditions.length) {
      this.addCondition();
    }
    this.mode = 'conditions';
  }

  public selectManualMode(): void {
    this.manualExpression = this.buildExpression();
    this.mode = 'manual';
  }

  public addCondition(): void {
    const firstField = this.availableFields[0];
    this.conditions.push({
      fieldKey: firstField?.key || '',
      operator: '=',
      response: this.getFieldOptions(firstField)[0] || '',
    });
  }

  public removeCondition(index: number): void {
    this.conditions.splice(index, 1);
  }

  public onQuestionChange(condition: SkipLogicCondition): void {
    const field = this.findField(condition.fieldKey);
    condition.response = this.getFieldOptions(field)[0] || '';
  }

  public getFieldOptions(field?: FormAttributeInterface): string[] {
    if (!field?.options?.length) {
      return [];
    }

    return field.options
      .map((option: any) => {
        if (typeof option === 'string') return option;
        return option?.tag || option?.label || option?.name || option?.value || option?.id;
      })
      .filter((option: any) => option !== null && option !== undefined)
      .map((option: any) => String(option));
  }

  public getConditionOptions(condition: SkipLogicCondition): string[] {
    return this.getFieldOptions(this.findField(condition.fieldKey));
  }

  public save(): void {
    const expression =
      this.mode === 'manual' ? this.manualExpression.trim() : this.buildExpression();
    this.matDialogRef.close(expression);
  }

  public clear(): void {
    this.matDialogRef.close('');
  }

  public cancel(): void {
    this.matDialogRef.close(null);
  }

  public canSave(): boolean {
    if (this.mode === 'manual') {
      return !!this.manualExpression.trim();
    }

    return this.conditions.every((condition) => condition.fieldKey && condition.response);
  }

  private buildExpression(): string {
    return this.conditions
      .filter((condition) => condition.fieldKey && condition.response)
      .map(
        (condition) =>
          '${' +
          condition.fieldKey +
          '} ' +
          condition.operator +
          " '" +
          condition.response.replace(/'/g, "\\'") +
          "'",
      )
      .join(' and ');
  }

  private findField(key: string): FormAttributeInterface | undefined {
    return this.availableFields.find((field) => field.key === key);
  }

  private parseExpression(expression: string): SkipLogicCondition[] {
    if (!expression || expression.includes('selected(') || /\s+or\s+/i.test(expression)) {
      return [];
    }

    return expression
      .split(/\s+and\s+/i)
      .map((part) => part.match(/^\$\{([^}]+)\}\s*(!=|=)\s*['"]([^'"]+)['"]$/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map((match: RegExpMatchArray) => ({
        fieldKey: match[1],
        operator: match[2] as '=' | '!=',
        response: match[3],
      }));
  }
}
