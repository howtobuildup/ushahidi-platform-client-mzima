import { Component, OnInit } from '@angular/core';
import { EwerDashboardResult, PostsService } from '@mzima-client/sdk';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
// Types only. Importing the module for its enums would pull d3 into every
// test that touches this page, and d3 ships ESM that Jest will not parse. The
// two values needed are string enums, so the literals stand in for them.
import type { Color, LegendPosition, ScaleType } from '@swimlane/ngx-charts';
import { NetworkService } from '@services';

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
  /** False once a single district is selected, when both district charts say nothing. */
  public showDistrictCharts = true;

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
  ) {}

  async ngOnInit(): Promise<void> {
    this.networkService.networkStatus$.pipe(untilDestroyed(this)).subscribe((connected) => {
      const wasOffline = this.offline;
      this.offline = !connected;
      // Coming back online is the moment to fill a dashboard that had
      // nothing to show.
      if (wasOffline && connected && !this.result) this.load();
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
      .getEwerDashboard()
      .pipe(untilDestroyed(this))
      .subscribe({
        next: (response: { result: EwerDashboardResult }) => {
          this.result = response.result;
          this.kpis = this.buildKpis(response.result);
          this.buildCharts(response.result);
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
