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

interface KpiMetric {
  labelKey: string;
  value: string;
  detail: string;
  tone: 'primary' | 'danger' | 'social' | 'success' | 'warning';
}

interface ChartMetric {
  labelKey: string;
  value: number;
  color?: string;
  count?: number;
  total?: number;
}

interface DistrictMetric extends ChartMetric {
  x: number;
  y: number;
}

interface StackedMetric {
  labelKey: string;
  total: number;
  values: {
    conflict: number;
    gbv: number;
    social: number;
    warning: number;
    climate: number;
  };
}

interface TimelineMetric extends StackedMetric {
  shortLabelKey: string;
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
    incident_mix: Record<string, number>;
    district_types: Array<
      NamedValue & {
        conflict: number;
        gbv: number;
        social: number;
        warning: number;
        climate: number;
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
  public reportingPeriod = '';
  public selectedIncidentType = 'all';
  public selectedFormId = '';
  public forms: FormInterface[] = [];
  public selectedDistrict?: DistrictMetric;
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

  public kpis: KpiMetric[] = [];
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

  public selectDistrict(district: DistrictMetric): void {
    this.selectedDistrict = district;
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
    } catch {
      this.notification.showError('Dashboard chart export could not be generated.');
    }
  }

  public async downloadDashboardPdf(): Promise<void> {
    if (!this.dashboardContent?.nativeElement) return;
    try {
      await this.downloadElement(
        this.dashboardContent.nativeElement,
        'ewer-monitoring-dashboard',
        'pdf',
      );
    } catch {
      this.notification.showError('Dashboard PDF export could not be generated.');
    }
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
    this.kpis = [
      this.kpi('dashboard.kpis.total_reports', total, `${total} stored submissions`, 'primary'),
      this.kpi(
        'dashboard.kpis.gbv',
        data.kpis.gbv,
        this.incidentDetail(data.kpis.gbv, total),
        'danger',
      ),
      this.kpi(
        'dashboard.kpis.conflicts',
        data.kpis.conflicts,
        this.incidentDetail(data.kpis.conflicts, total),
        'primary',
      ),
      this.kpi(
        'dashboard.kpis.social_violence',
        data.kpis.social_violence,
        this.incidentDetail(data.kpis.social_violence, total),
        'social',
      ),
      this.kpi(
        'dashboard.kpis.early_warning',
        data.kpis.early_warning,
        this.incidentDetail(data.kpis.early_warning, total),
        'success',
      ),
      this.kpi(
        'dashboard.kpis.environmental_climate',
        data.kpis.environmental_climate,
        this.incidentDetail(data.kpis.environmental_climate, total),
        'success',
      ),
      this.kpi(
        'dashboard.kpis.response_rate',
        `${data.kpis.response_rate}%`,
        'Cases marked as responded to',
        'success',
      ),
      this.kpi(
        'dashboard.kpis.escalation_signals',
        `${data.kpis.escalation_rate}%`,
        'Cases with escalation indicators',
        'warning',
      ),
    ];

    const districtColors = ['#51569a', '#656aa8', '#7f84bb', '#a4a8cf', '#367f8f'];
    this.districts = data.districts.map((item, index) => ({
      labelKey: this.districtKey(item.name),
      value: item.value,
      x: 14 + (index % 4) * 23,
      y: 18 + Math.floor(index / 4) * 25,
      color: districtColors[index % districtColors.length],
    }));
    this.incidentMix = [
      this.metric('dashboard.categories.gbv', data.incident_mix['gbv'], this.colors.danger),
      this.metric(
        'dashboard.categories.conflict',
        data.incident_mix['conflict'],
        this.colors.primary,
      ),
      this.metric('dashboard.categories.social', data.incident_mix['social'], this.colors.social),
      this.metric(
        'dashboard.categories.early_warning',
        data.incident_mix['warning'],
        this.colors.success,
      ),
      this.metric(
        'dashboard.categories.environmental_climate',
        data.incident_mix['climate'],
        '#367f8f',
      ),
    ];
    this.districtTypes = data.district_types.map((item) => ({
      labelKey: this.districtKey(item.name),
      total: item.total,
      values: {
        conflict: item.conflict,
        gbv: item.gbv,
        social: item.social,
        warning: item.warning,
        climate: item.climate,
      },
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

    this.gbvNature = this.mapNamedValues(data.gbv_nature, this.gbvNatureKey, [
      '#b7473d',
      '#c96960',
      '#d3928c',
      '#d3928c',
      '#d3928c',
      '#d3928c',
    ]).map((item) => ({
      ...item,
      value: this.percentage(item.value, this.metricTotal(this.mapNamedValues(data.gbv_nature))),
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
      labelKey: this.actorKey(item.name),
      value: item.percentage,
      count: item.frequency,
      total: data.responding_actors_total_yes,
      color: actorColors[index % actorColors.length],
    }));
  }

  private kpi(
    labelKey: string,
    value: string | number,
    detail: string,
    tone: KpiMetric['tone'],
  ): KpiMetric {
    return { labelKey, value: String(value), detail, tone };
  }

  private metric(labelKey: string, value = 0, color = '#505596'): ChartMetric {
    return { labelKey, value: value || 0, color };
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

  private incidentDetail(value: number, total: number): string {
    return `${this.percentage(value, total)}% of incidents`;
  }

  private formatPeriod(start: string | null, end: string | null): string {
    if (!start || !end) return '';
    const format = (value: string) =>
      new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(
        new Date(`${value}T00:00:00`),
      );
    return `${format(start)} - ${format(end)}`;
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
    };
    const normalizedValue = this.normalize(value);

    return keys[normalizedValue] || value || 'Unknown';
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
    };
    return keys[this.normalize(value)] || value || 'dashboard.conflict.other';
  }

  private gbvNatureKey(value: string): string {
    const keys: Record<string, string> = {
      domestic_violence: 'dashboard.gbv.domestic_violence',
      rape_and_sexual_violence: 'dashboard.gbv.rape_sexual_violence',
      early_forced_marriage: 'dashboard.gbv.early_forced_marriage',
      fgm_c: 'dashboard.gbv.fgmc',
      physical_assaults: 'dashboard.gbv.physical_assault',
      other_forms_of_gbv: 'dashboard.gbv.other',
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
      murder_manslaughter: 'dashboard.social.murder',
    };
    return keys[this.normalize(value)] || 'dashboard.social.youth_group';
  }

  private actorKey(value: string): string {
    const keys: Record<string, string> = {
      police: 'dashboard.responders.police',
      traditional_elders: 'dashboard.responders.traditional_elders',
      religious_leaders: 'dashboard.responders.religious_leaders',
      district_administration: 'dashboard.responders.local_government',
      local_government: 'dashboard.responders.local_government',
      community_mediation: 'dashboard.responders.community_mediation',
      cbos: 'dashboard.responders.cbos',
    };
    return keys[this.normalize(value)] || value || 'Unknown';
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

  private async downloadElement(
    element: HTMLElement,
    fileName: string,
    format: ExportFormat,
  ): Promise<void> {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: Math.min(2, window.devicePixelRatio || 1),
      useCORS: true,
      ignoreElements: (ignoredElement) =>
        ignoredElement.classList.contains('chart-actions') ||
        ignoredElement.classList.contains('dashboard-export'),
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

  private downloadCanvasPdf(canvas: HTMLCanvasElement, fileName: string): void {
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    let y = margin;
    let remainingHeight = imageHeight;

    pdf.addImage(imageData, 'JPEG', margin, y, imageWidth, imageHeight);
    remainingHeight -= pageHeight - margin * 2;

    while (remainingHeight > 0) {
      y -= pageHeight - margin * 2;
      pdf.addPage();
      pdf.addImage(imageData, 'JPEG', margin, y, imageWidth, imageHeight);
      remainingHeight -= pageHeight - margin * 2;
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
