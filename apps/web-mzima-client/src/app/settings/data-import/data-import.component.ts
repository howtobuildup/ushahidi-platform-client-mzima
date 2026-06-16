import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { omit, clone, invert, keys, includes } from 'lodash';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import {
  DataImportService,
  FormsService,
  FormAttributeInterface,
  FormCSVInterface,
  FormInterface,
} from '@mzima-client/sdk';
import { NotificationService } from '../../core/services/notification.service';
import { PollingService } from '../../core/services/polling.service';
import { LoaderService } from '../../core/services/loader.service';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { BreakpointService } from '@services';

enum PostStatus {
  Published = 'published',
  Draft = 'draft',
  Archived = 'archived',
}

@UntilDestroy()
@Component({
  selector: 'app-data-import',
  templateUrl: './data-import.component.html',
  styleUrls: ['./data-import.component.scss'],
})
export class DataImportComponent implements OnInit {
  PostStatus = PostStatus;
  selectedFile: File;
  selectedForm: FormInterface;
  forms$: Observable<FormInterface[]>;
  uploadedCSV: FormCSVInterface;
  hasRequiredTask = false;
  requiredFields = new Map<string, string>();
  maps_to: any = {};
  uploadErrors: any[] = [];

  statusOption: string;
  selectedStatus: PostStatus;
  displayedColumns: string[] = ['survey', 'csv'];
  public isDesktop = false;

  constructor(
    private importService: DataImportService,
    private translateService: TranslateService,
    private notification: NotificationService,
    private pollingService: PollingService,
    private loader: LoaderService,
    private router: Router,
    private route: ActivatedRoute,
    private confirm: ConfirmModalService,
    private formsService: FormsService,
    private breakpointService: BreakpointService,
  ) {
    this.breakpointService.isDesktop$.pipe(untilDestroyed(this)).subscribe({
      next: (isDesktop) => {
        this.isDesktop = isDesktop;
      },
    });
  }

  ngOnInit() {
    this.forms$ = this.formsService.getFresh();
  }

  uploadFile($event: any) {
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedFile = $event.target.files[0];
      this.checkFormAndFile();
    };
    reader.readAsDataURL($event.target.files[0]);
  }

  private checkFormAndFile() {
    if (this.selectedFile && this.selectedForm) {
      this.maps_to = {};
      this.loader.show();
      this.importService.uploadFile(this.selectedFile, this.selectedForm.id).subscribe({
        next: (csv) => {
          this.uploadedCSV = csv;

          if (this.uploadedCSV.columns?.every((c: any) => c === '')) {
            this.loader.hide();
            return this.notification.showError(
              this.translateService.instant('notify.data_import.empty_mapping_empty'),
            );
          }

          forkJoin([
            this.formsService.getStages(this.selectedForm.id.toString()),
            this.formsService.getAttributes(this.selectedForm.id.toString()),
          ]).subscribe({
            next: (result) => {
              this.loader.hide();
              this.selectedForm.tasks = result[0];
              this.selectedForm.attributes = result[1];
              this.hasRequiredTask = this.selectedForm.tasks.some((task) => task.required);
              this.setRequiredFields(this.selectedForm.attributes);
              this.autoMapColumns(this.selectedForm.attributes);
            },
            error: (err) => {
              this.loader.hide();
              this.notification.showError(err);
            },
          });
          this.uploadErrors = [];
        },
        error: (err) => {
          this.loader.hide();
          this.uploadErrors = this.getUploadErrors(err);
          this.notification.showError(err);
        },
      });
    }
  }

  private getUploadErrors(error: any): Array<{ message: string }> {
    const errors = error?.error?.errors;

    if (!errors) {
      return [];
    }

    const values = Array.isArray(errors) ? errors : Object.values(errors);

    return values.map((value: any) => ({
      message: typeof value === 'string' ? value : value?.message || JSON.stringify(value),
    }));
  }

  formChanged() {
    if (this.selectedFile && this.selectedForm) {
      this.checkFormAndFile();
    }
  }

  setRequiredFields(attributes: FormAttributeInterface[]) {
    this.requiredFields.clear();

    attributes.forEach((attr) => {
      if (attr.required) {
        this.requiredFields.set(attr.key, attr.label);
      }
    });
  }

  private autoMapColumns(attributes: FormAttributeInterface[]) {
    if (!this.uploadedCSV?.columns?.length) return;

    const usedColumns = new Set<number>();

    attributes.forEach((attribute) => {
      const matchedColumnIndex = this.findMatchingColumn(attribute, usedColumns);

      if (matchedColumnIndex !== null) {
        this.maps_to[attribute.key] = matchedColumnIndex;
        usedColumns.add(matchedColumnIndex);
      }
    });
  }

  private findMatchingColumn(
    attribute: FormAttributeInterface,
    usedColumns: Set<number>,
  ): number | null {
    const fieldNames = this.getAttributeMatchNames(attribute);
    const columns = this.uploadedCSV.columns || [];
    const availableColumns = columns
      .map((column, index) => ({ column, index }))
      .filter(({ index }) => !usedColumns.has(index));

    const exactMatch = availableColumns.find(({ column }) =>
      fieldNames.some((name) => this.normalizeMatchName(name) === this.normalizeMatchName(column)),
    );
    if (exactMatch) return exactMatch.index;

    const compactMatch = availableColumns.find(({ column }) =>
      fieldNames.some(
        (name) => this.normalizeCompactName(name) === this.normalizeCompactName(column),
      ),
    );
    if (compactMatch) return compactMatch.index;

    const fuzzyMatch = availableColumns.find(({ column }) =>
      fieldNames.some((name) => this.isNearColumnNameMatch(name, column)),
    );
    return fuzzyMatch?.index ?? null;
  }

  private getAttributeMatchNames(attribute: FormAttributeInterface): string[] {
    const translations = attribute.translations || {};
    const translationLabels = Object.values(translations)
      .map((translation: any) => translation?.label)
      .filter(Boolean);

    return [attribute.key, attribute.label, ...translationLabels]
      .filter(Boolean)
      .map((name) => String(name));
  }

  private normalizeMatchName(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\*/g, '')
      .replace(/[_/\\-]+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private normalizeCompactName(value: string): string {
    return this.normalizeMatchName(value).replace(/[^a-z0-9]/g, '');
  }

  private isNearColumnNameMatch(fieldName: string, columnName: string): boolean {
    const field = this.normalizeCompactName(fieldName);
    const column = this.normalizeCompactName(columnName);

    if (field.length < 8 || column.length < 8) return false;
    if (Math.abs(field.length - column.length) > 1) return false;

    return this.getLevenshteinDistance(field, column) <= 1;
  }

  private getLevenshteinDistance(source: string, target: string): number {
    const distances = Array.from({ length: source.length + 1 }, (_, index) => index);

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex++) {
      let previousDistance = distances[0];
      distances[0] = targetIndex;

      for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex++) {
        const currentDistance = distances[sourceIndex];
        distances[sourceIndex] =
          source[sourceIndex - 1] === target[targetIndex - 1]
            ? previousDistance
            : Math.min(previousDistance, distances[sourceIndex - 1], distances[sourceIndex]) + 1;
        previousDistance = currentDistance;
      }
    }

    return distances[source.length];
  }

  cancelImport() {
    this.confirm
      .open({
        title: this.translateService.instant('notify.data_import.csv_import_cancel_confirm'),
      })
      .then(() => {
        this.notification.showError(
          this.translateService.instant('notify.data_import.csv_import_cancel'),
        );
        this.importService.delete(this.uploadedCSV.id).subscribe(() => {
          if (this.isDesktop) {
            this.router.navigate([`/settings/data-import`]);
          } else {
            this.router.navigate([`/settings`]);
          }
        });
      });
  }

  private remapColumns() {
    let map: any = invert(clone(this.maps_to));
    map = omit(map, '');
    const mKeys = keys(map);
    this.uploadedCSV.columns.forEach((col, i) => {
      map[i] = includes(mKeys, i.toString()) ? map[i] : null;
    });
    return map;
  }

  finish() {
    this.uploadedCSV.maps_to = this.remapColumns();
    this.uploadedCSV.fixed = { form: this.selectedForm.id };

    if (this.statusOption === 'mark_as') {
      this.uploadedCSV.fixed.status = this.selectedStatus;
    } else {
      this.uploadedCSV.maps_to[this.selectedStatus] = 'status';
    }

    this.updateAndImport();
  }

  updateAndImport() {
    this.importService.update(this.uploadedCSV.id, this.uploadedCSV).subscribe(() => {
      this.importService.import({ id: this.uploadedCSV.id, action: 'import' }).subscribe({
        next: () => {
          // this.pollingService.getImportJobs();
          this.router.navigate(['results'], {
            relativeTo: this.route,
            queryParams: { job: this.uploadedCSV.id },
          });
        },
        error: (err) => {
          this.notification.showError(err);
        },
      });
    });
  }
}
