import { Component, OnInit } from '@angular/core';
import { EwerDashboardResult, FormsService, PostsService } from '@mzima-client/sdk';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
// Types only. Importing the module for its enums would pull d3 into every
// test that touches this page, and d3 ships ESM that Jest will not parse. The
// two values needed are string enums, so the literals stand in for them.
import type { Color, LegendPosition, ScaleType } from '@swimlane/ngx-charts';
import { NetworkService } from '@services';

export interface FilterOption {
  value: string;
  /** Translated where the app knows the term, raw survey wording otherwise. */
  label: string;
}

export interface DashboardFilters {
  /** Empty means every project. */
  formId: string;
  incidentType: string;
  district: string;
  /** One of the presets, or 'custom' when explicit dates are set. */
  period: string;
  dateFrom: string;
  dateTo: string;
}

interface ChartDatum {
  name: string;
  value: number;
}

interface StackedDatum {
  name: string;
  series: ChartDatum[];
}

/**
 * One colour per incident category, used by the cards and both charts.
 *
 * The web dashboard colours its category cards one way and its donut another,
 * so the same category is two colours on one page. Here a category is one
 * colour wherever it appears, which is what lets someone match a slice to a
 * card without reading either label.
 */
const CATEGORY_COLOURS: Record<string, string> = {
  gbv: '#b5443a',
  conflict: '#5a5e8a',
  social: '#c98b3a',
  warning: '#6aa89a',
  climate: '#4f7a9c',
  uncategorized: '#8d9199',
};

/**
 * Periods offered as a segment, in days back from today.
 *
 * A date range is the filter people actually reach for, and two free-form date
 * inputs are the worst of the web dashboard's controls to use on a phone.
 * 'all' and 'custom' carry no day count.
 */
export const PERIOD_PRESETS: Array<{ value: string; days: number | null }> = [
  { value: 'week', days: 7 },
  { value: 'month', days: 30 },
  { value: 'quarter', days: 90 },
  { value: 'all', days: null },
];

/** Incident types the dashboard can filter by, as the API names them. */
const INCIDENT_TYPES = ['conflict', 'gbv', 'social', 'warning', 'climate'];

/** The category keys the API returns, mapped to what the app calls them. */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  gbv: 'dashboard.categories.gbv',
  conflict: 'dashboard.categories.conflict',
  social: 'dashboard.categories.social',
  // The short forms exist for charts, where a legend has no room for
  // "Environmental and Climate Early Warning".
  warning: 'dashboard.categories.early_warning_short',
  climate: 'dashboard.categories.environmental_climate_short',
  uncategorized: 'dashboard.categories.uncategorized',
};

interface KpiCard {
  labelKey: string;
  value: string;
  captionKey: string;
  captionParams?: Record<string, unknown>;
  tone: 'total' | 'response' | 'escalation' | 'gbv' | 'conflict' | 'social' | 'warning' | 'climate';
}

@UntilDestroy()
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  public loading = true;
  public loadError = false;
  public offline = false;
  public result?: EwerDashboardResult;
  public kpis: KpiCard[] = [];

  public districtChart: ChartDatum[] = [];
  public typeMixChart: ChartDatum[] = [];
  public districtTypeChart: StackedDatum[] = [];
  public typeMixTotal = 0;
  public filters: DashboardFilters = this.defaultFilters();
  public projectOptions: FilterOption[] = [];
  public incidentOptions: FilterOption[] = [];
  public districtOptions: FilterOption[] = [];
  public filterSheetOpen = false;
  /** The sheet edits a copy, so cancelling leaves the dashboard alone. */
  public draft: DashboardFilters = this.defaultFilters();

  public readonly periods = PERIOD_PRESETS;

  /**
   * False once a single district is selected: both district charts collapse to
   * one bar, which says less than the KPI cards already do.
   */
  public get showDistrictCharts(): boolean {
    return !this.filters.district;
  }

  /** What the gear badge counts: the filters that are not the period. */
  public get activeFilterCount(): number {
    return [this.filters.formId, this.filters.incidentType, this.filters.district].filter(Boolean)
      .length;
  }

  public get activeChips(): Array<{ key: keyof DashboardFilters; label: string }> {
    const chips: Array<{ key: keyof DashboardFilters; label: string }> = [];
    const named = (options: FilterOption[], value: string) =>
      options.find((option) => option.value === value)?.label || value;

    if (this.filters.formId) {
      chips.push({ key: 'formId', label: named(this.projectOptions, this.filters.formId) });
    }
    if (this.filters.incidentType) {
      chips.push({
        key: 'incidentType',
        label: named(this.incidentOptions, this.filters.incidentType),
      });
    }
    if (this.filters.district) {
      chips.push({ key: 'district', label: this.filters.district });
    }
    return chips;
  }

  public readonly legendBelow = 'below' as LegendPosition;
  public categoryScheme: Color = {
    name: 'categories',
    selectable: true,
    group: 'ordinal' as ScaleType,
    domain: [],
  };
  public readonly districtScheme: Color = {
    name: 'districts',
    selectable: true,
    group: 'ordinal' as ScaleType,
    domain: ['#5a5e8a'],
  };

  constructor(
    private postsService: PostsService,
    private networkService: NetworkService,
    private translate: TranslateService,
    private formsService: FormsService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.networkService.networkStatus$.pipe(untilDestroyed(this)).subscribe((connected) => {
      const wasOffline = this.offline;
      this.offline = !connected;
      // Coming back online is the moment to fill a dashboard that had
      // nothing to show.
      if (wasOffline && connected && !this.result) this.load();
    });

    this.incidentOptions = INCIDENT_TYPES.map((value) => ({
      value,
      label: this.categoryLabel(value),
    }));

    this.formsService
      .get()
      .pipe(untilDestroyed(this))
      .subscribe({
        next: (response: any) => {
          this.projectOptions = (response?.results || []).map((form: any) => ({
            value: String(form.id),
            label: form.name,
          }));
        },
        // A dashboard without a project filter is still a dashboard.
        error: () => (this.projectOptions = []),
      });

    await this.load();
  }

  public async load(event?: any): Promise<void> {
    this.offline = !(await this.networkService.checkNetworkStatus());
    if (this.offline) {
      // The rest of the app works offline; this cannot, so say so rather than
      // spinning against a request that will not complete.
      this.loading = false;
      event?.target?.complete();
      return;
    }

    this.loading = !event;
    this.loadError = false;

    this.postsService
      .getEwerDashboard(this.requestParams())
      .pipe(untilDestroyed(this))
      .subscribe({
        next: (response: { result: EwerDashboardResult }) => {
          this.result = response.result;
          this.kpis = this.buildKpis(response.result);
          this.buildCharts(response.result);
          this.districtOptions = (response.result.district_options || []).map((district) => ({
            value: district.name,
            label: district.name,
          }));
          this.loading = false;
          event?.target?.complete();
        },
        error: () => {
          this.loadError = true;
          this.loading = false;
          event?.target?.complete();
        },
      });
  }

  private defaultFilters(): DashboardFilters {
    return { formId: '', incidentType: '', district: '', period: 'all', dateFrom: '', dateTo: '' };
  }

  /** Only the filters that are set; the API treats an empty value as absent. */
  private requestParams(): Record<string, string> {
    const { from, to } = this.periodRange();
    return {
      form_id: this.filters.formId,
      incident_type: this.filters.incidentType,
      district: this.filters.district,
      date_from: from,
      date_to: to,
    };
  }

  /**
   * The chosen preset as a pair of dates, or the explicit pair when the period
   * is custom. 'all' sends nothing, which the API reads as no date filter.
   */
  private periodRange(): { from: string; to: string } {
    if (this.filters.period === 'custom') {
      return { from: this.filters.dateFrom, to: this.filters.dateTo };
    }

    const preset = PERIOD_PRESETS.find((option) => option.value === this.filters.period);
    if (!preset?.days) {
      return { from: '', to: '' };
    }

    const from = new Date();
    from.setDate(from.getDate() - preset.days);
    return { from: from.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
  }

  public selectPeriod(period: string): void {
    if (period === this.filters.period) return;
    this.filters = { ...this.filters, period };
    this.load();
  }

  public openFilterSheet(): void {
    // Edited as a copy so that closing without applying changes nothing.
    this.draft = { ...this.filters };
    this.filterSheetOpen = true;
  }

  public applyFilterSheet(): void {
    this.filterSheetOpen = false;
    this.filters = { ...this.draft };
    this.load();
  }

  public clearFilterSheet(): void {
    this.draft = { ...this.draft, formId: '', incidentType: '', district: '' };
  }

  public removeFilter(key: keyof DashboardFilters): void {
    this.filters = { ...this.filters, [key]: '' };
    this.load();
  }

  /**
   * Tapping a district in the ranking chart filters by it, which is the
   * drill-down a phone can do better than a mouse and a select.
   */
  public onDistrictSelected(event: any): void {
    const name = typeof event === 'string' ? event : event?.name;
    if (!name || name === this.filters.district) return;
    this.filters = { ...this.filters, district: String(name) };
    this.load();
  }

  /**
   * The three charts: how many reports per district, what kinds of incident
   * they were, and the two crossed.
   */
  private buildCharts(result: EwerDashboardResult): void {
    this.districtChart = (result.districts || []).map((district) => ({
      name: district.name,
      value: district.value,
    }));

    const categories = result.incident_categories || [];
    this.typeMixChart = categories.map((category) => ({
      name: this.categoryLabel(category.key, category.name),
      value: category.value,
    }));
    this.typeMixTotal = categories.reduce((total, category) => total + category.value, 0);

    this.districtTypeChart = (result.district_types || []).map((district) => ({
      name: district.name,
      series: Object.entries(district.types || {})
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({ name: this.categoryLabel(key), value })),
    }));

    // The scheme is keyed by the labels the charts actually carry, so a
    // category keeps its colour across both of them.
    const seen = new Map<string, string>();
    for (const category of categories) {
      seen.set(this.categoryLabel(category.key, category.name), this.categoryColour(category.key));
    }
    for (const district of this.districtTypeChart) {
      for (const slice of district.series) {
        if (!seen.has(slice.name)) seen.set(slice.name, CATEGORY_COLOURS['uncategorized']);
      }
    }
    this.categoryScheme = { ...this.categoryScheme, domain: [...seen.values()] };
  }

  /**
   * A category's name in the current language, falling back to whatever the
   * survey recorded when the key is one this app does not know.
   */
  private categoryLabel(key: string, fallback?: string): string {
    const labelKey = CATEGORY_LABEL_KEYS[key];
    return labelKey ? this.translate.instant(labelKey) : fallback || key;
  }

  private categoryColour(key: string): string {
    return CATEGORY_COLOURS[key] || CATEGORY_COLOURS['uncategorized'];
  }

  /**
   * The eight summary cards, in the order the web dashboard shows them.
   *
   * Counts carry their share of the total as a caption, which is what makes a
   * number mean something on a small screen where the cards cannot sit side by
   * side for comparison.
   */
  private buildKpis(result: EwerDashboardResult): KpiCard[] {
    const kpis = result.kpis;
    const total = kpis.total_reports;
    const share = (value: number) => ({
      labelKey: '',
      value: String(value),
      captionKey: 'dashboard.kpi.share_of_incidents',
      captionParams: { percent: total ? Math.round((value / total) * 100) : 0 },
      tone: 'total' as KpiCard['tone'],
    });

    return [
      {
        labelKey: 'dashboard.kpi.total_reports',
        value: String(total),
        captionKey: 'dashboard.kpi.stored_submissions',
        captionParams: { count: total },
        tone: 'total',
      },
      {
        labelKey: 'dashboard.kpi.response_rate',
        value: `${kpis.response_rate}%`,
        captionKey: 'dashboard.kpi.responded_to',
        tone: 'response',
      },
      {
        labelKey: 'dashboard.kpi.escalation_signals',
        value: `${kpis.escalation_rate}%`,
        captionKey: 'dashboard.kpi.with_escalation',
        tone: 'escalation',
      },
      { ...share(kpis.gbv), labelKey: 'dashboard.kpi.gbv', tone: 'gbv' },
      { ...share(kpis.conflicts), labelKey: 'dashboard.kpi.conflicts', tone: 'conflict' },
      { ...share(kpis.social_violence), labelKey: 'dashboard.kpi.social', tone: 'social' },
      { ...share(kpis.early_warning), labelKey: 'dashboard.kpi.early_warning', tone: 'warning' },
      {
        ...share(kpis.environmental_climate),
        labelKey: 'dashboard.kpi.environmental_climate',
        tone: 'climate',
      },
    ];
  }
}
