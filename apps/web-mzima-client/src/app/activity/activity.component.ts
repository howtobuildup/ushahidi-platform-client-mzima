import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormInterface, FormsService, PostsService } from '@mzima-client/sdk';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { NotificationService } from '../core/services/notification.service';

interface FilterOption {
  labelKey: string;
  value: string;
}

interface DashboardFilter {
  key: string;
  labelKey: string;
  value: string;
  options: FilterOption[];
}

type ExportFormat = 'png' | 'jpg' | 'pdf';

/**
 * Largest canvas area to ask the browser for. Safari caps a canvas at this,
 * and a canvas over the limit fails quietly rather than throwing.
 */
const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * The reporting period, kept as month keys rather than a formatted string so
 * the month names follow a language change. Intl was formatting them against a
 * hardcoded 'en', which left them in English on a Somali dashboard.
 */
interface ReportingPeriod {
  startKey: string;
  startYear: string;
  endKey: string;
  endYear: string;
}

interface KpiMetric {
  labelKey: string;
  value: string;
  // The caption under the figure. Held as a key and its parameters rather than
  // a built string, so it follows a language change without the dashboard
  // having to be fetched again.
  detailKey: string;
  detailParams?: Record<string, string | number>;
  tone: 'primary' | 'danger' | 'social' | 'success' | 'warning';
}

interface ChartMetric {
  key?: string;
  labelKey: string;
  // Shown when labelKey is empty, for values the dashboard has no translation
  // for. Passing those through the translate pipe would corrupt them: the
  // missing-translation handler keeps only the text after the last dot.
  label?: string;
  value: number;
  color?: string;
  count?: number;
  total?: number;
}

type DistrictMetric = ChartMetric;

interface StackedMetric {
  labelKey: string;
  total: number;
  values: Record<string, number>;
}

interface TimelineMetric {
  labelKey: string;
  shortLabelKey: string;
  total: number;
  values: {
    conflict: number;
    gbv: number;
    social: number;
    warning: number;
    climate: number;
  };
}

interface GenderMetric {
  labelKey: string;
  detailKey: string;
  value: number;
  color: string;
}

interface NamedValue {
  name: string;
  value: number;
}

interface RespondingActorValue {
  key: string;
  name: string;
  frequency: number;
  percentage: number;
}

interface DashboardResponse {
  result: {
    reporting_period: { start: string | null; end: string | null };
    kpis: {
      total_reports: number;
      gbv: number;
      conflicts: number;
      social_violence: number;
      early_warning: number;
      environmental_climate: number;
      response_rate: number;
      escalation_rate: number;
    };
    districts: NamedValue[];
    district_options: NamedValue[];
    incident_mix: Record<string, number>;
    incident_categories: Array<{ key: string; name: string; value: number }>;
    district_types: Array<
      NamedValue & {
        types: Record<string, number>;
        total: number;
      }
    >;
    conflict_types: NamedValue[];
    conflict_drivers: NamedValue[];
    conflict_response: NamedValue[];
    escalation_signals: { escalating: number; stable: number };
    gbv_nature: NamedValue[];
    gbv_districts: NamedValue[];
    survivor_ages: NamedValue[];
    gender_profiles: { survivors: number; perpetrators: number };
    social_violence: NamedValue[];
    response_coverage: Record<string, { percentage: number; count: number; total: number }>;
    early_warning_districts: NamedValue[];
    timeline: Array<{
      month: string;
      conflict: number;
      gbv: number;
      social: number;
      warning: number;
      climate: number;
      total: number;
    }>;
    responding_actors: RespondingActorValue[];
    responding_actors_total_yes: number;
  };
}

@Component({
  selector: 'app-activity',
  templateUrl: './activity.component.html',
  styleUrls: ['./activity.component.scss'],
})
export class ActivityComponent implements OnInit {
  @ViewChild('dashboardContent') dashboardContent!: ElementRef<HTMLElement>;

  public filtersApplied = false;
  public loading = true;
  public loadError = false;
  public reportingPeriod: ReportingPeriod | null = null;
  public selectedIncidentType = 'all';
  public selectedDistrictFilter = 'all';
  public selectedFormId = '';
  public forms: FormInterface[] = [];
  public dateFrom = '';
  public dateTo = '';
  public conflictTotal = 0;
  public gbvTotal = 0;
  public socialTotal = 0;
  public warningTotal = 0;
  public escalationRate = 0;

  public readonly incidentFilters: DashboardFilter[] = [
    {
      key: 'incident',
      labelKey: 'dashboard.filters.incident_type',
      value: 'all',
      options: [
        { labelKey: 'dashboard.filters.all_types', value: 'all' },
        { labelKey: 'dashboard.categories.conflict', value: 'conflict' },
        { labelKey: 'dashboard.categories.gbv', value: 'gbv' },
        { labelKey: 'dashboard.categories.social', value: 'social' },
        { labelKey: 'dashboard.categories.early_warning', value: 'warning' },
        { labelKey: 'dashboard.categories.environmental_climate', value: 'climate' },
      ],
    },
  ];

  public summaryKpis: KpiMetric[] = [];
  public incidentKpis: KpiMetric[] = [];
  public districts: DistrictMetric[] = [];
  public incidentMix: ChartMetric[] = [];
  public districtTypes: StackedMetric[] = [];
  public conflictTypes: ChartMetric[] = [];
  public conflictDrivers: ChartMetric[] = [];
  public conflictResponse: ChartMetric[] = [];
  public escalationSignals: ChartMetric[] = [];
  public gbvNature: ChartMetric[] = [];
  public gbvDistricts: ChartMetric[] = [];
  public survivorAges: ChartMetric[] = [];
  public genderProfiles: GenderMetric[] = [];
  public socialViolence: ChartMetric[] = [];
  public responseCoverage: ChartMetric[] = [];
  public earlyWarningDistricts: ChartMetric[] = [];
  public timeline: TimelineMetric[] = [];
  public respondingActors: ChartMetric[] = [];

  private readonly colors = {
    primary: '#505596',
    danger: '#b7473d',
    social: '#cf8b4c',
    success: '#5d9f94',
    warning: '#e5a52f',
  };

  constructor(
    private postsService: PostsService,
    private formsService: FormsService,
    private notification: NotificationService,
  ) {}

  public ngOnInit(): void {
    this.formsService.get().subscribe({
      next: (response) => {
        this.forms = response.results;
      },
    });
    this.loadDashboard();
  }

  public applyFilters(): void {
    this.filtersApplied = true;
    this.loadDashboard();
    window.setTimeout(() => {
      this.filtersApplied = false;
    }, 1800);
  }

  public clearFilters(): void {
    this.selectedIncidentType = 'all';
    this.selectedDistrictFilter = 'all';
    this.selectedFormId = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  public maxValue(items: ChartMetric[]): number {
    return Math.max(1, ...items.map((item) => item.value));
  }

  public metricTotal(items: ChartMetric[]): number {
    return items.reduce((total, item) => total + item.value, 0);
  }

  public percentage(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }

  /**
   * Can this metric back its percentage with a count?
   *
   * A percentage with nothing behind it is a rendering error, not a value to
   * interpolate around, so the readout is suppressed rather than printed with
   * the numerator missing.
   */
  public hasCount(item: ChartMetric): boolean {
    return item.count !== undefined && item.count !== null && !!item.total;
  }

  public donutBackground(items: ChartMetric[]): string {
    const total = this.metricTotal(items);
    if (!total) return '#e9ebf2';
    let start = 0;
    const segments = items.map((item) => {
      const end = start + (item.value / total) * 100;
      const segment = `${item.color} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  public gaugeBackground(metric: ChartMetric): string {
    const valueDegrees = Math.min(metric.value, 100) * 1.8;
    return `conic-gradient(from 270deg at 50% 100%, ${metric.color} 0deg ${valueDegrees}deg, #e9ebf2 ${valueDegrees}deg 180deg, transparent 180deg 360deg)`;
  }

  public singleDonutBackground(value: number, color: string): string {
    return `conic-gradient(${color} 0% ${value}%, #d9dce8 ${value}% 100%)`;
  }

  public stackHeight(value: number, total: number): number {
    return total ? (value / total) * 100 : 0;
  }

  public async downloadChart(event: Event, format: ExportFormat): Promise<void> {
    const card = (event.currentTarget as HTMLElement).closest('.chart-card') as HTMLElement;
    if (!card) return;

    const title = card.querySelector('h3')?.textContent || 'dashboard-chart';
    try {
      await this.downloadElement(card, this.fileName(title), format);
    } catch (error) {
      this.reportExportFailure('Dashboard chart export could not be generated.', error);
    }
  }

  public async downloadDashboardPdf(): Promise<void> {
    if (!this.dashboardContent?.nativeElement) {
      this.reportExportFailure(
        'Dashboard PDF export could not be generated.',
        new Error('The dashboard has not finished rendering.'),
      );
      return;
    }

    try {
      await this.downloadElement(
        this.dashboardContent.nativeElement,
        'ewer-monitoring-dashboard',
        'pdf',
      );
    } catch (error) {
      this.reportExportFailure('Dashboard PDF export could not be generated.', error);
    }
  }

  /**
   * Both export paths used to discard the cause, which left a failure with
   * nothing to act on. Keep the readable message on screen and put the
   * underlying error where it can be read.
   */
  private reportExportFailure(message: string, error: unknown): void {
    console.error(message, error);
    const detail = error instanceof Error ? error.message : String(error ?? '');
    this.notification.showError(detail ? `${message} ${detail}` : message);
  }

  private loadDashboard(): void {
    this.loading = true;
    this.loadError = false;
    this.postsService.getEwerDashboard(this.dashboardParams()).subscribe({
      next: (response: DashboardResponse) => {
        this.populateDashboard(response.result);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private dashboardParams(): Record<string, string> {
    return {
      form_id: this.selectedFormId,
      incident_type: this.selectedIncidentType === 'all' ? '' : this.selectedIncidentType,
      district: this.selectedDistrictFilter === 'all' ? '' : this.selectedDistrictFilter,
      date_from: this.dateFrom,
      date_to: this.dateTo,
    };
  }

  private populateDashboard(data: DashboardResponse['result']): void {
    const total = data.kpis.total_reports;
    this.conflictTotal = data.kpis.conflicts;
    this.gbvTotal = data.kpis.gbv;
    this.socialTotal = data.kpis.social_violence;
    this.warningTotal = data.kpis.early_warning;
    this.escalationRate = data.kpis.escalation_rate;
    this.reportingPeriod = this.formatPeriod(
      data.reporting_period.start,
      data.reporting_period.end,
    );
    this.summaryKpis = [
      this.kpi(
        'dashboard.kpis.total_reports',
        total,
        'dashboard.kpis.stored_submissions',
        'primary',
        { count: total },
      ),
      this.kpi(
        'dashboard.kpis.response_rate',
        `${data.kpis.response_rate}%`,
        'dashboard.kpis.responded_detail',
        'success',
      ),
      this.kpi(
        'dashboard.kpis.escalation_signals',
        `${data.kpis.escalation_rate}%`,
        'dashboard.kpis.escalation_indicators_detail',
        'warning',
      ),
    ];
    this.incidentKpis = [
      this.kpi('dashboard.kpis.gbv', data.kpis.gbv, 'dashboard.kpis.incident_share', 'danger', {
        percent: this.percentage(data.kpis.gbv, total),
      }),
      this.kpi(
        'dashboard.kpis.conflicts',
        data.kpis.conflicts,
        'dashboard.kpis.incident_share',
        'primary',
        { percent: this.percentage(data.kpis.conflicts, total) },
      ),
      this.kpi(
        'dashboard.kpis.social_violence',
        data.kpis.social_violence,
        'dashboard.kpis.incident_share',
        'social',
        { percent: this.percentage(data.kpis.social_violence, total) },
      ),
      this.kpi(
        'dashboard.kpis.early_warning',
        data.kpis.early_warning,
        'dashboard.kpis.incident_share',
        'success',
        { percent: this.percentage(data.kpis.early_warning, total) },
      ),
      this.kpi(
        'dashboard.kpis.environmental_climate',
        data.kpis.environmental_climate,
        'dashboard.kpis.incident_share',
        'success',
        { percent: this.percentage(data.kpis.environmental_climate, total) },
      ),
    ];

    const districtColors = ['#51569a', '#656aa8', '#7f84bb', '#a4a8cf', '#367f8f'];
    this.districts = data.districts.map((item, index) => ({
      labelKey: this.districtKey(item.name),
      value: item.value,
      color: districtColors[index % districtColors.length],
    }));
    this.updateSelectedDistrict(data.district_options || data.districts);
    const incidentColors = [
      this.colors.primary,
      this.colors.danger,
      this.colors.social,
      this.colors.success,
      '#367f8f',
      '#8b6aa8',
      '#cfb24c',
      '#477da3',
    ];
    this.incidentMix = data.incident_categories.map((item, index) => ({
      key: item.key,
      labelKey: this.incidentCategoryKey(item.key, item.name),
      value: item.value,
      color: incidentColors[index % incidentColors.length],
    }));
    this.districtTypes = data.district_types.map((item) => ({
      labelKey: this.districtKey(item.name),
      total: item.total,
      values: item.types,
    }));

    this.conflictTypes = this.mapNamedValues(data.conflict_types, this.conflictTypeKey, [
      '#505596',
      '#b8bce0',
      '#9297ca',
    ]).filter((item) => item.labelKey !== 'dashboard.conflict.other');
    this.conflictDrivers = this.mapNamedValues(
      data.conflict_drivers.slice(0, 7),
      this.conflictDriverKey,
      ['#505596', '#656aa8', '#858ac0', '#979bcc', '#a5a9d2', '#aeb2d7', '#c5c8e3'],
    );
    this.conflictResponse = data.conflict_response
      .slice(0, 4)
      .map((item) =>
        this.metric(
          this.conflictTypeKey(item.name),
          item.value,
          item.value >= 70 ? '#4f9e88' : '#e5a52f',
        ),
      );
    this.escalationSignals = [
      this.metric('dashboard.escalation.escalating', data.escalation_signals.escalating, '#e5a52f'),
      this.metric('dashboard.escalation.stable', data.escalation_signals.stable, '#c3c8d3'),
    ];

    // The bar shows "count / total (percentage%)", so the count has to survive
    // alongside the percentage. Overwriting value with the percentage on its
    // own left the template reading an undefined count and rendering a bare
    // slash.
    const gbvNatureMetrics = this.mapNamedValues(data.gbv_nature, this.gbvNatureKey, [
      '#b7473d',
      '#c96960',
      '#d3928c',
      '#d3928c',
      '#d3928c',
      '#d3928c',
    ]);
    const gbvNatureTotal = this.metricTotal(gbvNatureMetrics);
    this.gbvNature = gbvNatureMetrics.map((item) => ({
      ...item,
      count: item.value,
      total: gbvNatureTotal,
      value: this.percentage(item.value, gbvNatureTotal),
    }));
    this.gbvDistricts = data.gbv_districts
      .slice(0, 4)
      .map((item, index) =>
        this.metric(this.districtKey(item.name), item.value, index < 2 ? '#b7473d' : '#cf918b'),
      );
    const ageTotal = data.survivor_ages.reduce((sum, item) => sum + item.value, 0);
    this.survivorAges = this.mapNamedValues(data.survivor_ages, this.ageKey, [
      '#cf918b',
      '#cf918b',
      '#b7473d',
      '#cf918b',
      '#cf918b',
    ]).map((item) => ({ ...item, value: this.percentage(item.value, ageTotal) }));
    this.genderProfiles = [
      {
        labelKey: 'dashboard.gbv.survivors',
        detailKey: 'dashboard.gbv.female',
        value: data.gender_profiles.survivors,
        color: '#b7473d',
      },
      {
        labelKey: 'dashboard.gbv.perpetrators',
        detailKey: 'dashboard.gbv.male',
        value: data.gender_profiles.perpetrators,
        color: '#505596',
      },
    ];

    const socialTotal = data.social_violence.reduce((sum, item) => sum + item.value, 0);
    this.socialViolence = this.mapNamedValues(data.social_violence, this.socialKey, [
      '#cf8b4c',
      '#d89e68',
      '#dfa974',
      '#dfa974',
      '#dfa974',
      '#dfa974',
    ]).map((item) => ({ ...item, value: this.percentage(item.value, socialTotal) }));
    this.responseCoverage = [
      this.coverageMetric('dashboard.categories.gbv', data.response_coverage['gbv'], '#4f9e88'),
      this.coverageMetric(
        'dashboard.categories.conflict',
        data.response_coverage['conflict'],
        '#505596',
      ),
      this.coverageMetric(
        'dashboard.categories.social',
        data.response_coverage['social'],
        '#cf8b4c',
      ),
      this.coverageMetric(
        'dashboard.categories.early_warning_short',
        data.response_coverage['warning'],
        '#5d9f94',
      ),
      this.coverageMetric(
        'dashboard.categories.environmental_climate_short',
        data.response_coverage['climate'],
        '#367f8f',
      ),
    ];
    this.earlyWarningDistricts = data.early_warning_districts
      .slice(0, 4)
      .map((item, index) =>
        this.metric(this.districtKey(item.name), item.value, index ? '#9ac5bd' : '#5d9f94'),
      );
    this.timeline = data.timeline.slice(-6).map((item) => ({
      labelKey: this.monthKey(item.month),
      shortLabelKey: this.shortMonthKey(item.month),
      total: item.total,
      values: {
        conflict: item.conflict,
        gbv: item.gbv,
        social: item.social,
        warning: item.warning,
        climate: item.climate,
      },
    }));
    const actorColors = ['#505596', '#656aa8', '#979bcc', '#979bcc', '#b8bce0', '#b8bce0'];
    this.respondingActors = data.responding_actors.map((item, index) => ({
      labelKey: this.responderKey(item.key),
      label: item.name,
      value: item.percentage,
      count: item.frequency,
      total: data.responding_actors_total_yes,
      color: actorColors[index % actorColors.length],
    }));
  }

  private kpi(
    labelKey: string,
    value: string | number,
    detailKey: string,
    tone: KpiMetric['tone'],
    detailParams?: Record<string, string | number>,
  ): KpiMetric {
    return { labelKey, value: String(value), detailKey, detailParams, tone };
  }

  private metric(labelKey: string, value = 0, color = '#505596'): ChartMetric {
    return { labelKey, value: value || 0, color };
  }

  private incidentCategoryKey(key: string, name: string): string {
    const labels: Record<string, string> = {
      conflict: 'dashboard.categories.conflict',
      gbv: 'dashboard.categories.gbv',
      social: 'dashboard.categories.social',
      warning: 'dashboard.categories.early_warning',
      climate: 'dashboard.categories.environmental_climate',
      uncategorized: 'dashboard.categories.uncategorized',
    };
    return labels[key] || name;
  }

  private coverageMetric(
    labelKey: string,
    coverage: { percentage: number; count: number; total: number } | undefined,
    color: string,
  ): ChartMetric {
    return {
      ...this.metric(labelKey, coverage?.percentage || 0, color),
      count: coverage?.count || 0,
      total: coverage?.total || 0,
    };
  }

  private mapNamedValues(
    values: NamedValue[],
    keyMapper: (value: string) => string = (value) => value,
    colors: string[] = [],
  ): ChartMetric[] {
    const grouped = new Map<string, number>();
    values.forEach((item) => {
      const key = keyMapper.call(this, item.name);
      grouped.set(key, (grouped.get(key) || 0) + item.value);
    });

    return Array.from(grouped.entries()).map(([key, value], index) =>
      this.metric(key, value, colors[index] || '#979bcc'),
    );
  }

  private formatPeriod(start: string | null, end: string | null): ReportingPeriod | null {
    if (!start || !end) return null;
    return {
      startKey: this.shortMonthKey(start),
      startYear: start.split('-')[0],
      endKey: this.shortMonthKey(end),
      endYear: end.split('-')[0],
    };
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private districtKey(value: string): string {
    const keys: Record<string, string> = {
      baidoa: 'dashboard.districts.baidoa',
      hudur: 'dashboard.districts.hudur',
      kismayo: 'dashboard.districts.kismayo',
      dhobley: 'dashboard.districts.dhobley',
      sool: 'dashboard.districts.sool',
      sool_region: 'dashboard.districts.sool',
      lower_shabelle: 'dashboard.districts.lower_shabelle',
      lower_shabele: 'dashboard.districts.lower_shabelle',
      shabeellaha_hoose: 'dashboard.districts.lower_shabelle',
    };
    const normalizedValue = this.normalize(value);

    return keys[normalizedValue] || value || 'Unknown';
  }

  public districtOptions: FilterOption[] = [
    { labelKey: 'dashboard.filters.all_districts', value: 'all' },
  ];

  private updateSelectedDistrict(districts: NamedValue[]): void {
    const options = districts.map((district) => ({
      labelKey: this.districtKey(district.name),
      value: this.normalize(district.name),
    }));
    this.districtOptions = [
      { labelKey: 'dashboard.filters.all_districts', value: 'all' },
      ...options,
    ];

    if (
      this.selectedDistrictFilter !== 'all' &&
      !this.districtOptions.some((option) => option.value === this.selectedDistrictFilter)
    ) {
      this.selectedDistrictFilter = 'all';
    }
  }

  private conflictTypeKey(value: string): string {
    const keys: Record<string, string> = {
      clan_community_instigated: 'dashboard.conflict.clan',
      environmental_climate_change_related: 'dashboard.conflict.environmental',
      politically_motivated: 'dashboard.conflict.political',
    };
    return keys[this.normalize(value)] || 'dashboard.conflict.other';
  }

  private conflictDriverKey(value: string): string {
    const keys: Record<string, string> = {
      land_disputes: 'dashboard.conflict.land_disputes',
      grazing_land: 'dashboard.conflict.grazing_land',
      water_sources: 'dashboard.conflict.water_sources',
      revenge_killings: 'dashboard.conflict.revenge_killings',
      borderland_clashes: 'dashboard.conflict.borderland_clashes',
      inheritance_marriage: 'dashboard.conflict.inheritance_marriage',
      // The survey stores these as written-out labels rather than the coded
      // names above, so only revenge killings was resolving and the rest of
      // the chart stayed in English whatever the language.
      land_dispute: 'dashboard.conflict.land_disputes',
      clashes_over_grazing_land: 'dashboard.conflict.grazing_land',
      clashes_over_water_sources: 'dashboard.conflict.water_sources',
      borderland_conflicts_clashes: 'dashboard.conflict.borderland_clashes',
      family_conflict_over_marriage: 'dashboard.conflict.inheritance_marriage',
      inheritance_dispute: 'dashboard.conflict.inheritance_marriage',
      land_grabbing: 'dashboard.conflict.land_grabbing',
    };
    return keys[this.normalize(value)] || value || 'dashboard.conflict.other';
  }

  /**
   * Translation key for a responding actor, or empty when there is none.
   *
   * The canonical keys come from the API and mostly match the translations
   * already carried here; the handful that do not are mapped across. Anything
   * unknown returns empty so the caller shows the label the survey gave,
   * rather than a guess at what it means.
   */
  private responderKey(key: string): string {
    const known = [
      'police',
      'traditional_elders',
      'religious_leaders',
      'local_government',
      'community_mediation',
      'cbos',
      'government_ministries',
      'local_ngo',
      'international_ngo',
      'emergency_services',
    ];
    const aliases: Record<string, string> = {
      national_army: 'somali_national_army',
      somali_national_army: 'somali_national_army',
      informal_justice_mechanism_e_g_clan_eld: 'informal_justice',
      informal_justice_mechanisms: 'informal_justice',
      formal_justice_mechanism_formal_courts: 'formal_justice',
      formal_justice_mechanisms: 'formal_justice',
    };

    const normalized = this.normalize(key);
    if (aliases[normalized]) {
      return `dashboard.responders.${aliases[normalized]}`;
    }
    return known.includes(normalized) ? `dashboard.responders.${normalized}` : '';
  }

  private gbvNatureKey(value: string): string {
    const keys: Record<string, string> = {
      domestic_violence: 'dashboard.gbv.domestic_violence',
      rape_and_sexual_violence: 'dashboard.gbv.rape_sexual_violence',
      early_forced_marriage: 'dashboard.gbv.early_forced_marriage',
      fgm_c: 'dashboard.gbv.fgmc',
      physical_assaults: 'dashboard.gbv.physical_assault',
      other_forms_of_gbv: 'dashboard.gbv.other',
      // Recorded by the survey but absent here, so both were counted as
      // "other" rather than shown as themselves.
      denial_resource: 'dashboard.gbv.denial_resource',
      denial_of_resources: 'dashboard.gbv.denial_resource',
      sexual_harassment: 'dashboard.gbv.sexual_harassment',
    };
    return keys[this.normalize(value)] || 'dashboard.gbv.other';
  }

  private ageKey(value: string): string {
    const keys: Record<string, string> = {
      '0_12_children': 'dashboard.gbv.age_under_12',
      '13_17_young_adults': 'dashboard.gbv.age_12_17',
      '18_35_years': 'dashboard.gbv.age_18_35',
      '36_49_years': 'dashboard.gbv.age_36_49',
      '50_years_and_above': 'dashboard.gbv.age_50_plus',
    };
    return keys[this.normalize(value)] || 'dashboard.gbv.age_50_plus';
  }

  private socialKey(value: string): string {
    const keys: Record<string, string> = {
      theft_robbery: 'dashboard.social.theft_robbery',
      individual_violent_incidents: 'dashboard.social.individual_violence',
      kidnapping_and_abductions: 'dashboard.social.kidnapping',
      drug_related_violence: 'dashboard.social.drug_related',
      youth_group_violence: 'dashboard.social.youth_group',
      // The survey records this shorter name, which matched nothing.
      youth_conflict: 'dashboard.social.youth_group',
      murder_manslaughter: 'dashboard.social.murder',
    };
    return keys[this.normalize(value)] || 'dashboard.social.youth_group';
  }

  private monthKey(value: string): string {
    const month = Number(value.split('-')[1]);
    const keys = [
      '',
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    return `dashboard.months.${keys[month]}`;
  }

  private shortMonthKey(value: string): string {
    const month = Number(value.split('-')[1]);
    const keys = [
      '',
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];
    return `dashboard.months.${keys[month]}`;
  }

  /**
   * How finely to rasterise, without producing a canvas the browser refuses.
   *
   * A single chart card is small enough that device pixel ratio is free, but
   * the whole dashboard is several thousand pixels tall, and at ratio 2 the
   * canvas runs to tens of millions of pixels. Past the browser's limit the
   * canvas comes back blank or toDataURL yields nothing, which is how a
   * working per-chart export sat beside a failing whole-dashboard one.
   *
   * 16 megapixels is the smallest limit in current browsers, so staying under
   * it keeps the export working everywhere rather than only where it is
   * generous.
   */
  private rasterScale(element: HTMLElement): number {
    const width = element.scrollWidth || element.clientWidth;
    const height = element.scrollHeight || element.clientHeight;
    const preferred = Math.min(2, window.devicePixelRatio || 1);
    const area = width * height;

    if (!area) {
      return preferred;
    }

    return Math.max(0.5, Math.min(preferred, Math.sqrt(MAX_CANVAS_PIXELS / area)));
  }

  /**
   * Swap every conic-gradient in the clone for an equivalent SVG.
   *
   * html2canvas 1.4.1 parses linear-gradient and radial-gradient and knows
   * nothing of conic-gradient: it throws "Error parsing CSS component value,
   * unexpected EOF" rather than skipping the declaration. The donuts and the
   * response gauges are drawn with conic-gradient, so any export containing
   * one of them failed outright.
   *
   * Only the offscreen copy html2canvas rasterises is touched, so the live
   * dashboard keeps drawing the donut and gauges the way it always has and
   * cannot regress from this.
   *
   * Detection is by resolved background-image rather than by matching text in
   * the style attribute: that catches a gradient wherever it came from, and
   * the resolved value is the one html2canvas goes on to parse. Every element
   * is examined because a gradient reaching an element through a rule would
   * not appear in its style attribute at all.
   */
  private replaceConicGradients(documentClone: Document): void {
    const view = documentClone.defaultView;

    Array.from(documentClone.querySelectorAll<HTMLElement>('*')).forEach((clone) => {
      const inline = clone.getAttribute('style') ?? '';
      const resolved = view ? view.getComputedStyle(clone).backgroundImage : '';
      const declaration = [inline, resolved].find((candidate) =>
        candidate?.includes('conic-gradient'),
      );

      if (!declaration) {
        return;
      }

      const width = clone.offsetWidth || clone.getBoundingClientRect().width || 200;
      const height = clone.offsetHeight || clone.getBoundingClientRect().height || 200;
      const svg = this.conicGradientToSvg(declaration, width, height);

      // Clear the shorthand first, or it would reinstate the gradient.
      clone.style.background = 'none';
      if (svg) {
        clone.style.backgroundImage = svg;
        clone.style.backgroundSize = '100% 100%';
        clone.style.backgroundRepeat = 'no-repeat';
      }
    });
  }

  /**
   * Read the colour ranges out of a conic-gradient body.
   *
   * Two forms have to be handled. As authored, a stop carries both its start
   * and end: `red 0% 40%`. Once the browser has resolved the declaration it
   * may hand back the expanded equivalent, `red 0%, red 40%`, where each stop
   * carries one position and a range runs from one stop to the next. Reading
   * the attribute gives the first, reading the resolved value gives the
   * second, and both reach this method.
   */
  private conicGradientStops(
    body: string,
    toDegrees: (amount: string, unit: string) => number,
  ): Array<{ color: string; from: number; to: number }> {
    const colour = '(#[0-9a-f]{3,8}|rgba?\\([^)]*\\)|transparent)';
    const paired = new RegExp(`${colour}\\s+(-?[\\d.]+)(deg|%)\\s+(-?[\\d.]+)(deg|%)`, 'gi');
    const ranges: Array<{ color: string; from: number; to: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = paired.exec(body)) !== null) {
      ranges.push({
        color: match[1],
        from: toDegrees(match[2], match[3]),
        to: toDegrees(match[4], match[5]),
      });
    }

    if (ranges.length) {
      return ranges;
    }

    const single = new RegExp(`${colour}\\s+(-?[\\d.]+)(deg|%)`, 'gi');
    const points: Array<{ color: string; at: number }> = [];

    while ((match = single.exec(body)) !== null) {
      points.push({ color: match[1], at: toDegrees(match[2], match[3]) });
    }

    // A range runs from each stop to the next, and the colour is the one the
    // range opens with.
    return points.slice(0, -1).map((point, index) => ({
      color: point.color,
      from: point.at,
      to: points[index + 1].at,
    }));
  }

  /**
   * Render a conic-gradient as an SVG data URI of the same geometry.
   *
   * Handles both forms this dashboard produces: the donut's bare percentage
   * stops, and the gauges' `from 270deg at 50% 100%` with degree stops, whose
   * centre sits on the bottom edge. Returns null when the value is not a
   * conic-gradient or carries no stops, and the caller then just drops the
   * background rather than exporting something wrong.
   */
  private conicGradientToSvg(value: string, width: number, height: number): string | null {
    const opening = value?.indexOf('conic-gradient(') ?? -1;
    if (opening < 0) {
      return null;
    }

    let depth = 0;
    let closing = -1;
    for (let index = opening + 'conic-gradient'.length; index < value.length; index++) {
      if (value[index] === '(') {
        depth++;
      } else if (value[index] === ')') {
        depth--;
        if (depth === 0) {
          closing = index;
          break;
        }
      }
    }
    if (closing < 0) {
      return null;
    }

    const body = value.slice(opening + 'conic-gradient('.length, closing);
    const rotation = Number(/from\s+(-?[\d.]+)deg/i.exec(body)?.[1] ?? 0);
    const centre = /at\s+([\d.]+)%\s+([\d.]+)%/i.exec(body);
    const cx = (Number(centre?.[1] ?? 50) / 100) * width;
    const cy = (Number(centre?.[2] ?? 50) / 100) * height;

    // Reach the far corner, so the wedges cover the box however it is cropped.
    const radius = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(width - cx, cy),
      Math.hypot(cx, height - cy),
      Math.hypot(width - cx, height - cy),
    );

    const toDegrees = (amount: string, unit: string) =>
      unit === '%' ? Number(amount) * 3.6 : Number(amount);
    const point = (degrees: number) => {
      const radians = ((rotation + degrees - 90) * Math.PI) / 180;
      return `${(cx + radius * Math.cos(radians)).toFixed(2)},${(
        cy +
        radius * Math.sin(radians)
      ).toFixed(2)}`;
    };

    const ranges = this.conicGradientStops(body, toDegrees);
    const shapes: string[] = [];

    for (const { color, from, to } of ranges) {
      if (color === 'transparent' || /rgba\([^)]*,\s*0\s*\)/i.test(color)) {
        continue;
      }

      const sweep = to - from;
      if (sweep <= 0) {
        continue;
      }

      if (sweep >= 360) {
        shapes.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}"/>`);
        continue;
      }

      const largeArc = sweep > 180 ? 1 : 0;
      shapes.push(
        `<path d="M ${cx},${cy} L ${point(from)} A ${radius},${radius} 0 ${largeArc} 1 ${point(
          to,
        )} Z" fill="${color}"/>`,
      );
    }

    if (!shapes.length) {
      return null;
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}">${shapes.join('')}</svg>`;

    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }

  private async downloadElement(
    element: HTMLElement,
    fileName: string,
    format: ExportFormat,
  ): Promise<void> {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: this.rasterScale(element),
      useCORS: true,
      ignoreElements: (ignoredElement) =>
        ignoredElement.classList.contains('chart-actions') ||
        ignoredElement.classList.contains('dashboard-export'),
      onclone: (documentClone) => this.replaceConicGradients(documentClone),
    });

    if (format === 'pdf') {
      this.downloadCanvasPdf(canvas, fileName);
      return;
    }

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const extension = format === 'jpg' ? 'jpg' : 'png';
    const blob = await this.canvasToBlob(canvas, mimeType);
    this.downloadBlob(blob, `${fileName}.${extension}`);
  }

  private canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error('Canvas export failed.'));
        },
        mimeType,
        0.95,
      );
    });
  }

  /**
   * Page the canvas by cutting it, rather than by placing the whole image on
   * every page at a negative offset and letting the page crop it. The offset
   * approach embedded a copy of the full-height image once per page, so a
   * dashboard running to six pages carried six copies of a multi-megabyte
   * JPEG and relied on the reader clipping each one.
   */
  private downloadCanvasPdf(canvas: HTMLCanvasElement, fileName: string): void {
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const imageWidth = pageWidth - margin * 2;
    // Points per source pixel, so a slice can be measured in source pixels.
    const scale = imageWidth / canvas.width;
    const sliceHeight = Math.max(1, Math.floor((pageHeight - margin * 2) / scale));

    const slice = document.createElement('canvas');
    const context = slice.getContext('2d');
    if (!context) {
      throw new Error('This browser would not provide a drawing context.');
    }

    for (let offset = 0, page = 0; offset < canvas.height; offset += sliceHeight, page++) {
      const height = Math.min(sliceHeight, canvas.height - offset);
      slice.width = canvas.width;
      slice.height = height;
      // Slices are opaque so that JPEG, which has no alpha, does not render
      // the transparent remainder of a short final slice as black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height);

      const imageData = slice.toDataURL('image/jpeg', 0.95);
      if (!imageData.startsWith('data:image/jpeg')) {
        throw new Error('The dashboard image could not be encoded for export.');
      }

      if (page > 0) {
        pdf.addPage();
      }
      pdf.addImage(imageData, 'JPEG', margin, margin, imageWidth, height * scale);
    }

    pdf.save(`${fileName}.pdf`);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  private fileName(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'dashboard-chart'
    );
  }
}
