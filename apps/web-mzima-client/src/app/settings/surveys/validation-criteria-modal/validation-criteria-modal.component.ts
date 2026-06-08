import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormAttributeInterface } from '@mzima-client/sdk';

interface ValidationCondition {
  operator: '=' | '!=' | '<' | '<=' | '>' | '>=';
  value: string;
}

@Component({
  selector: 'app-validation-criteria-modal',
  templateUrl: './validation-criteria-modal.component.html',
  styleUrls: ['./validation-criteria-modal.component.scss'],
})
export class ValidationCriteriaModalComponent {
  public mode: 'choice' | 'conditions' | 'manual' = 'choice';
  public manualExpression = '';
  public conditions: ValidationCondition[] = [];
  public currentField?: FormAttributeInterface;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private matDialogRef: MatDialogRef<ValidationCriteriaModalComponent>,
  ) {
    this.currentField = data?.currentField;
    this.manualExpression = data?.expression || '';
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
    this.conditions.push({
      operator: this.isNumericField ? '<=' : '=',
      value: this.getFieldOptions()[0] || '',
    });
  }

  public removeCondition(index: number): void {
    this.conditions.splice(index, 1);
  }

  public getFieldOptions(): string[] {
    if (!this.currentField?.options?.length) {
      return [];
    }

    return this.currentField.options
      .map((option: any) => {
        if (typeof option === 'string') return option;
        return option?.tag || option?.label || option?.name || option?.value || option?.id;
      })
      .filter((option: any) => option !== null && option !== undefined)
      .map((option: any) => String(option));
  }

  public get isNumericField(): boolean {
    return (
      this.currentField?.input === 'number' ||
      ['int', 'decimal'].includes(this.currentField?.type || '')
    );
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

    return this.conditions.every((condition) => condition.operator && condition.value);
  }

  private buildExpression(): string {
    return this.conditions
      .filter((condition) => condition.operator && condition.value)
      .map((condition) => {
        const value = this.isNumericField
          ? condition.value
          : "'" + condition.value.replace(/'/g, "\\'") + "'";
        return '. ' + condition.operator + ' ' + value;
      })
      .join(' and ');
  }

  private parseExpression(expression: string): ValidationCondition[] {
    if (
      !expression ||
      expression.includes('regex(') ||
      expression.includes('string-length(') ||
      /\s+or\s+/i.test(expression)
    ) {
      return [];
    }

    return expression
      .split(/\s+and\s+/i)
      .map((part) => part.match(/^\.\s*(<=|>=|<|>|=|!=)\s*['"]?([^'"]+)['"]?$/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map((match: RegExpMatchArray) => ({
        operator: match[1] as ValidationCondition['operator'],
        value: match[2],
      }));
  }
}
