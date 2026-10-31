import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  PostContentField,
  PostPropertiesInterface,
  PostResult,
  SurveysService,
  UserInterface,
} from '@mzima-client/sdk';
import { postFieldChoiceLabel } from '@helpers';
import { Subject, Subscription } from 'rxjs';

// The words a location question starts with, in English and in Somali: gobol
// is a region, degmo a district, tuulo a village, xaafad a neighbourhood,
// magaalo a town and deegaan a locality.
const PLACE_WORD =
  /^(region|district|village|ward|site|location|state|city|county|subcounty|zone|area|settlement|town|locality|neighbou?rhood|gob[ao]l\w*|degm\w*|tuul\w*|xaa?fad\w*|magaal\w*|deegaan\w*)$/;

interface PostTileSummary {
  // Survey data, shown as it came when no translation matches it.
  incidentType: string;
  incidentTypeKey: string;
  // The keys are empty when the survey does not ask, so the tile leaves the
  // pill off rather than claiming there is no escalation or response.
  escalationLabelKey: string;
  escalationRisk: boolean;
  location: string;
  locationKey: string;
  site?: string;
  status?: string;
  sourcesCount: number;
  actors?: string;
  responseLabelKey: string;
  responseActive: boolean;
  monitorCode?: string;
  hasMedia: boolean;
}

@Component({
  selector: 'app-post-preview',
  templateUrl: './post-preview.component.html',
  styleUrls: ['./post-preview.component.scss'],
})
export class PostPreviewComponent implements OnInit, OnChanges, OnDestroy {
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
  // Every post in the data view gets this tile, whichever survey it is from.
  public tile?: PostTileSummary;
  public surveyName = '';
  private surveyNameSubscription?: Subscription;

  constructor(private surveysService: SurveysService) {}

  ngOnInit() {
    this.allowed_privileges = this.post?.allowed_privileges ?? '';
    this.buildTile();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['post']) {
      this.allowed_privileges = this.post?.allowed_privileges ?? '';
      this.buildTile();
    }
  }

  ngOnDestroy(): void {
    this.surveyNameSubscription?.unsubscribe();
  }

  /** The post's title, when it says more than its survey's name. */
  public get tileTitle(): string {
    const title = (this.post?.title ?? '').trim();
    return title.toLowerCase() === this.surveyName.trim().toLowerCase() ? '' : title;
  }

  /** Translation key for a post under review or archived; empty once published. */
  public get reviewStatusKey(): string {
    const keys: Record<string, string> = { draft: 'post.draft', archived: 'post.archived' };
    return keys[this.post?.status ?? ''] ?? '';
  }

  private buildTile(): void {
    this.tile = this.post ? this.buildTileSummary() : undefined;

    this.surveyNameSubscription?.unsubscribe();
    this.surveyName = '';
    if (this.feedView) {
      this.surveyNameSubscription = this.surveysService
        .getSurveyName((this.post as PostResult)?.form_id)
        .subscribe((name) => (this.surveyName = name));
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

  private buildTileSummary(): PostTileSummary {
    const fields = this.getFields();

    const incidentType = this.getFieldDisplay(fields, ['Incidence_type', 'Incidence type']);
    const monitorCode = this.getFieldDisplay(fields, [
      '_1_Field_Monitor_Code',
      'Field Monitor Code',
    ]);
    const escalation = this.findField(fields, [
      '_12_Are_there_escalation_indic',
      'Are there escalation indicators',
    ]);
    const response = this.findField(fields, [
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

    const escalationRisk = this.isAffirmative(
      this.formatFieldValue(escalation, this.getRawValue(escalation)),
    );
    const responseActive = this.isAffirmative(
      this.formatFieldValue(response, this.getRawValue(response)),
    );
    const { location, site } = this.buildPlace(fields);

    return {
      // Held as keys so the tile follows a language change. The incident type
      // is survey data, so it resolves against the same keys the dashboard
      // uses and falls back to the label the survey gave.
      incidentType,
      incidentTypeKey: this.incidentTypeKey(incidentType),
      escalationLabelKey: !escalation
        ? ''
        : escalationRisk
        ? 'post.tile.escalation_risk'
        : 'post.tile.no_escalation',
      escalationRisk,
      location,
      locationKey: location ? '' : 'post.tile.no_location',
      site,
      status,
      sourcesCount: sourceCount || 0,
      actors,
      responseLabelKey: !response
        ? ''
        : responseActive
        ? 'post.tile.response_active'
        : 'post.tile.no_response',
      responseActive,
      monitorCode,
      hasMedia: !!fields.find((field) => field.type === 'media' && this.getRawValue(field)),
    };
  }

  /**
   * Where the post happened: the district and region as the heading, and the
   * village or site under it.
   *
   * EWER names its location questions. Other surveys name theirs as they
   * like, so for those this takes the questions whose label or XLSForm name
   * starts with a word for a place, in the order the survey asks them (region,
   * district, village). A survey that only asks for a GPS point gives its
   * coordinates.
   */
  private buildPlace(fields: PostContentField[]): { location: string; site: string } {
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
    if (state || city || site) {
      return { location: [city, state].filter(Boolean).join(', '), site };
    }

    const [region, district, village] = fields
      .filter((field) => this.isPlaceField(field))
      .map((field) => this.formatFieldValue(field, this.getRawValue(field)))
      .filter((value) => value && value.length <= 60 && !/^(yes|no)$/i.test(value));
    if (region) {
      return { location: [district, region].filter(Boolean).join(', '), site: village ?? '' };
    }

    const point = fields
      .filter((field) => field.input === 'location')
      .map((field) => this.getRawValue(field))
      .find((value) => value?.lat !== undefined && value?.lon !== undefined);
    return {
      location: point ? `${(+point.lat).toFixed(4)}, ${(+point.lon).toFixed(4)}` : '',
      site: '',
    };
  }

  private isPlaceField(field: PostContentField): boolean {
    if (!['select', 'radio', 'text'].includes(field.input)) return false;
    const config = field.config as any;
    return [field.label, config?.xlsform_name].some((name) => {
      // The first word that is not a question number: "_2a_City_where..." is a city.
      const firstWord = String(name ?? '')
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .find((word) => /^[a-z]/.test(word));
      return !!firstWord && PLACE_WORD.test(firstWord);
    });
  }

  /**
   * Translation key for an incident type, or empty when there is none.
   *
   * The value is whatever the survey recorded, so anything unrecognised keeps
   * that label rather than being guessed at.
   */
  private incidentTypeKey(value: string): string {
    const keys: Record<string, string> = {
      conflicts: 'dashboard.categories.conflict',
      clan_community_instigated: 'dashboard.categories.conflict',
      gender_based_violence: 'dashboard.categories.gbv',
      gbv: 'dashboard.categories.gbv',
      social_violence: 'dashboard.categories.social',
      social_other_violence: 'dashboard.categories.social',
      early_warning: 'dashboard.categories.early_warning',
      environmental_and_climate_early_warning: 'dashboard.categories.environmental_climate',
      environmental_climate_change_related: 'dashboard.categories.environmental_climate',
    };
    const normalized = (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return keys[normalized] || '';
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
