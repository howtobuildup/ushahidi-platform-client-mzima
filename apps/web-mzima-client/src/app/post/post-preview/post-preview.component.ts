import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  PostContentField,
  PostPropertiesInterface,
  PostResult,
  UserInterface,
} from '@mzima-client/sdk';
import { postFieldChoiceLabel } from '@helpers';
import { Subject } from 'rxjs';

interface EwerTileSummary {
  incidentType: string;
  escalationLabel: string;
  escalationRisk: boolean;
  location: string;
  site?: string;
  status?: string;
  sourcesLabel?: string;
  actors?: string;
  responseLabel: string;
  responseActive: boolean;
  monitorCode?: string;
  hasMedia: boolean;
}

@Component({
  selector: 'app-post-preview',
  templateUrl: './post-preview.component.html',
  styleUrls: ['./post-preview.component.scss'],
})
export class PostPreviewComponent implements OnInit, OnChanges {
  @Input() public post: PostResult | PostPropertiesInterface;
  @Input() public user: UserInterface;
  @Input() public feedView?: boolean;
  @Input() public media?: any;
  @Input() public selectable?: boolean;
  @Input() public isChecked?: boolean;
  @Output() selected = new EventEmitter();
  @Output() edit = new EventEmitter();
  @Output() refresh = new EventEmitter();
  @Output() deleted = new EventEmitter();
  @Output() statusChanged = new EventEmitter();
  private details = new Subject<boolean>();
  public details$ = this.details.asObservable();
  private onDeleted = new Subject<PostPropertiesInterface>();
  public deleted$ = this.onDeleted.asObservable();
  public allowed_privileges: string | string[];
  public ewerTile?: EwerTileSummary;

  ngOnInit() {
    this.allowed_privileges = this.post?.allowed_privileges ?? '';
    this.ewerTile = this.buildEwerTile();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['post']) {
      this.allowed_privileges = this.post?.allowed_privileges ?? '';
      this.ewerTile = this.buildEwerTile();
    }
  }

  public showDetails(): void {
    this.details.next(true);
  }

  public postClicked(event: MouseEvent): void {
    if (this.selectable) {
      event.stopPropagation();
      this.isChecked = !this.isChecked;
      this.selected.emit(this.isChecked);
    }
  }

  public deletedHandle(): void {
    if (this.feedView) {
      this.deleted.emit();
    } else {
      this.onDeleted.next(this.post as PostPropertiesInterface);
    }
  }

  public statusChangedHandle(): void {
    this.statusChanged.emit();
  }

  private buildEwerTile(): EwerTileSummary | undefined {
    const fields = this.getFields();
    if (!fields.length) return undefined;

    const incidentType = this.getFieldDisplay(fields, ['Incidence_type', 'Incidence type']);
    const state = this.getFieldDisplay(fields, [
      '_2_State_where_incidence_occurred',
      'State where incidence occurred',
      'Region where incidence occurred',
    ]);
    const city = this.getFieldDisplay(fields, [
      '_2a_City_where_incidence_occurred',
      'City where incidence occurred',
      'District where incidence occurred',
    ]);
    const site = this.getFieldDisplay(fields, [
      '_2b_Ward_Site_where_e_area_or_zone_etc',
      'Ward/Site where the Incidence Occurred? Specific description of the incident/conflict site like ward name, area or zone, etc',
      'Village where incidence occurred',
    ]);
    const monitorCode = this.getFieldDisplay(fields, [
      '_1_Field_Monitor_Code',
      'Field Monitor Code',
    ]);

    if (!incidentType && !state && !city && !site && !monitorCode) return undefined;

    const escalation = this.getFieldDisplay(fields, [
      '_12_Are_there_escalation_indic',
      'Are there escalation indicators',
    ]);
    const response = this.getFieldDisplay(fields, [
      '_10_Has_any_response_happened',
      'Has any response happened?',
      'Has the victim/survivor been reached and supported/referred?',
    ]);
    const status = this.getFieldDisplay(fields, [
      '_6_What_is_the_statu_situation_indicator',
      'What is the status of the situation/indicator?',
      'What is the status of the incident?',
    ]);
    const actors = this.getFieldDisplay(fields, [
      '_9_Who_are_the_actors_involved',
      '_10a_Who_are_the_actors_respon',
      'Who are the actors involved in the incidence (Perpetrators or contributors to the conflict)',
      'Who are the actors responding to the situation on the ground?',
    ]);
    const sourceCount = this.getFieldValueCount(fields, [
      '_8_What_are_the_sources_of_inf',
      'What are the sources of information?',
    ]);

    const escalationRisk = this.isAffirmative(escalation);
    const responseActive = this.isAffirmative(response);

    return {
      incidentType: incidentType || this.post?.title || 'Incident',
      escalationLabel: escalationRisk ? 'Escalation risk' : 'No escalation',
      escalationRisk,
      location: [city, state].filter(Boolean).join(', ') || city || state || 'Location unavailable',
      site,
      status,
      sourcesLabel: sourceCount
        ? `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`
        : undefined,
      actors,
      responseLabel: responseActive ? 'Response active' : 'No response yet',
      responseActive,
      monitorCode,
      hasMedia: !!fields.find((field) => field.type === 'media' && this.getRawValue(field)),
    };
  }

  private getFields(): PostContentField[] {
    const post = this.post as PostResult;
    return post?.post_content?.flatMap((content) => content.fields || []) || [];
  }

  private getFieldDisplay(fields: PostContentField[], names: string[]): string {
    const field = this.findField(fields, names);
    return this.formatFieldValue(field, this.getRawValue(field));
  }

  private getFieldValueCount(fields: PostContentField[], names: string[]): number {
    const field = this.findField(fields, names);
    const value = this.getRawValue(field);
    if (Array.isArray(value)) return value.filter(Boolean).length;
    const display = this.formatValue(value);
    if (!display) return 0;
    return display
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean).length;
  }

  private findField(fields: PostContentField[], names: string[]): PostContentField | undefined {
    const normalizedNames = names.map((name) => this.normalize(name));
    return fields.find((field) => {
      const config = field.config as any;
      const candidates = [
        field.key,
        field.label,
        config?.xlsform_name,
        config?.name,
        config?.label,
      ].map((candidate) => this.normalize(candidate));

      return normalizedNames.some((name) => candidates.includes(name));
    });
  }

  private getRawValue(field?: PostContentField): any {
    if (!field?.value) return undefined;
    const value = field.value as any;
    return value.value ?? value;
  }

  private formatValue(value: any): string {
    if (value === undefined || value === null || value === '') return '';
    if (Array.isArray(value)) {
      return value
        .map((item) => this.formatValue(item))
        .filter(Boolean)
        .join(', ');
    }
    if (typeof value === 'object') {
      return this.formatValue(value.label ?? value.name ?? value.value ?? '');
    }
    return String(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private formatFieldValue(field: PostContentField | undefined, value: any): string {
    if (!field) return this.formatValue(value);
    if (Array.isArray(value)) {
      return value
        .map((item) => this.formatFieldValue(field, item))
        .filter(Boolean)
        .join(', ');
    }
    if (['checkbox', 'radio', 'select'].includes(field.input)) {
      return postFieldChoiceLabel(field, value);
    }
    return this.formatValue(value);
  }

  private normalize(value: any): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private isAffirmative(value: string): boolean {
    return /^(yes|true|1|y)$/i.test(value.trim());
  }
}
