/**
 * What GET /ewer/dashboard returns.
 *
 * The contract belongs beside the method that calls it, so the web and mobile
 * clients describe the same response rather than each keeping their own copy
 * and drifting apart when the controller changes.
 */

export interface EwerNamedValue {
  name: string;
  value: number;
}

export interface EwerDashboardKpis {
  total_reports: number;
  gbv: number;
  conflicts: number;
  social_violence: number;
  early_warning: number;
  environmental_climate: number;
  /** Percentages, already rounded by the API. */
  response_rate: number;
  escalation_rate: number;
}

export interface EwerDistrictTypes extends EwerNamedValue {
  types: Record<string, number>;
  total: number;
}

export interface EwerIncidentCategory {
  key: string;
  name: string;
  value: number;
}

export interface EwerDashboardResult {
  reporting_period: { start: string | null; end: string | null };
  kpis: EwerDashboardKpis;
  districts: EwerNamedValue[];
  district_options: EwerNamedValue[];
  incident_mix: Record<string, number>;
  incident_categories: EwerIncidentCategory[];
  district_types: EwerDistrictTypes[];
  /**
   * The rest of the response. The web dashboard reads all of it; the mobile
   * one shows only the summary above, so the remainder is left untyped here
   * rather than described twice.
   */
  [key: string]: any;
}

export interface EwerDashboardResponse {
  result: EwerDashboardResult;
}
