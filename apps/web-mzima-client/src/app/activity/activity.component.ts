import { Component } from '@angular/core';

interface SummaryMetric {
  labelKey: string;
  value: number;
  tone?: 'danger' | 'primary';
}

interface BarMetric {
  labelKey: string;
  value: number;
  color?: string;
}

interface TimelinePoint {
  day: string;
  conflict: number;
  gbv: number;
  environmental: number;
}

@Component({
  selector: 'app-activity',
  templateUrl: './activity.component.html',
  styleUrls: ['./activity.component.scss'],
})
export class ActivityComponent {
  public selectedRange = 'feb-mar-2026';

  public readonly summaryMetrics: SummaryMetric[] = [
    { labelKey: 'dashboard.summary.total_incidents', value: 625, tone: 'danger' },
    { labelKey: 'dashboard.summary.environmental_conflict', value: 30 },
    { labelKey: 'dashboard.summary.gender_based_violence', value: 179 },
    { labelKey: 'dashboard.summary.political_conflict', value: 336, tone: 'primary' },
    { labelKey: 'dashboard.summary.clan_conflict', value: 250 },
  ];

  public readonly locationMetrics: BarMetric[] = [
    { labelKey: 'dashboard.locations.jubaland', value: 84, color: '#7075ad' },
    { labelKey: 'dashboard.locations.puntland', value: 98, color: '#5a5e8a' },
    { labelKey: 'dashboard.locations.south_west', value: 41, color: '#8d91bd' },
    { labelKey: 'dashboard.locations.galmudug', value: 113, color: '#c6c8de' },
  ];

  public readonly incidentTypeMetrics: BarMetric[] = [
    { labelKey: 'dashboard.incident_types.environmental', value: 28, color: '#5a5e8a' },
    { labelKey: 'dashboard.incident_types.gbv', value: 72, color: '#a54844' },
    { labelKey: 'dashboard.incident_types.political', value: 58, color: '#5a5e8a' },
    { labelKey: 'dashboard.incident_types.clan', value: 42, color: '#a54844' },
    { labelKey: 'dashboard.incident_types.other', value: 42, color: '#5a5e8a' },
    { labelKey: 'dashboard.incident_types.escalation', value: 53, color: '#a54844' },
    { labelKey: 'dashboard.incident_types.response', value: 42, color: '#5a5e8a' },
    { labelKey: 'dashboard.incident_types.reported', value: 103, color: '#a54844' },
    { labelKey: 'dashboard.incident_types.verified', value: 90, color: '#5a5e8a' },
    { labelKey: 'dashboard.incident_types.pending', value: 120, color: '#a54844' },
    { labelKey: 'dashboard.incident_types.closed', value: 75, color: '#5a5e8a' },
    { labelKey: 'dashboard.incident_types.referred', value: 75, color: '#a54844' },
  ];

  public readonly timeline: TimelinePoint[] = [
    { day: 'Feb 1', conflict: 18, gbv: 14, environmental: 10 },
    { day: 'Feb 3', conflict: 34, gbv: 20, environmental: 17 },
    { day: 'Feb 5', conflict: 32, gbv: 12, environmental: 15 },
    { day: 'Feb 7', conflict: 27, gbv: 13, environmental: 16 },
    { day: 'Feb 9', conflict: 24, gbv: 8, environmental: 12 },
    { day: 'Feb 11', conflict: 31, gbv: 7, environmental: 17 },
    { day: 'Feb 13', conflict: 28, gbv: 12, environmental: 16 },
    { day: 'Feb 15', conflict: 32, gbv: 10, environmental: 13 },
    { day: 'Feb 17', conflict: 32, gbv: 18, environmental: 17 },
    { day: 'Feb 19', conflict: 33, gbv: 12, environmental: 14 },
    { day: 'Feb 21', conflict: 26, gbv: 17, environmental: 15 },
    { day: 'Feb 23', conflict: 35, gbv: 10, environmental: 18 },
    { day: 'Feb 25', conflict: 32, gbv: 8, environmental: 14 },
    { day: 'Feb 27', conflict: 27, gbv: 12, environmental: 16 },
    { day: 'Mar 1', conflict: 24, gbv: 8, environmental: 13 },
    { day: 'Mar 3', conflict: 31, gbv: 7, environmental: 16 },
    { day: 'Mar 5', conflict: 27, gbv: 12, environmental: 15 },
    { day: 'Mar 7', conflict: 32, gbv: 10, environmental: 14 },
    { day: 'Mar 9', conflict: 33, gbv: 18, environmental: 17 },
    { day: 'Mar 11', conflict: 32, gbv: 12, environmental: 14 },
    { day: 'Mar 13', conflict: 27, gbv: 11, environmental: 16 },
    { day: 'Mar 15', conflict: 24, gbv: 8, environmental: 13 },
    { day: 'Mar 17', conflict: 31, gbv: 11, environmental: 16 },
    { day: 'Mar 19', conflict: 27, gbv: 12, environmental: 15 },
    { day: 'Mar 21', conflict: 32, gbv: 10, environmental: 14 },
    { day: 'Mar 23', conflict: 33, gbv: 18, environmental: 17 },
    { day: 'Mar 25', conflict: 32, gbv: 12, environmental: 14 },
    { day: 'Mar 27', conflict: 27, gbv: 23, environmental: 16 },
    { day: 'Mar 29', conflict: 35, gbv: 12, environmental: 18 },
    { day: 'Mar 31', conflict: 32, gbv: 10, environmental: 14 },
    { day: 'Apr 2', conflict: 27, gbv: 8, environmental: 13 },
  ];

  public maxValue(items: BarMetric[]): number {
    return Math.max(...items.map((item) => item.value));
  }

  public timelineTotal(point: TimelinePoint): number {
    return point.conflict + point.gbv + point.environmental;
  }
}
