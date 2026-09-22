import { PostsService } from '@mzima-client/sdk';
import { of, Subject, throwError } from 'rxjs';

import { DashboardPage } from './dashboard.page';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DashboardPage', () => {
  let page: DashboardPage;
  let posts: { getEwerDashboard: jest.Mock };
  let connected: boolean;
  let networkStatus$: Subject<boolean>;
  let forms$: any;

  const result = (kpis: Partial<Record<string, number>> = {}) => ({
    result: {
      reporting_period: { start: null, end: null },
      kpis: {
        total_reports: 100,
        gbv: 25,
        conflicts: 40,
        social_violence: 10,
        early_warning: 5,
        environmental_climate: 20,
        response_rate: 60,
        escalation_rate: 24,
        ...kpis,
      },
      districts: [],
      district_options: [],
      incident_mix: {},
      incident_categories: [],
      district_types: [],
    },
  });

  const build = () => {
    connected = true;
    networkStatus$ = new Subject<boolean>();
    forms$ = of({ results: [{ id: 2, name: 'NAGAASHO EWER' }] });
    posts = { getEwerDashboard: jest.fn().mockReturnValue(of(result())) };
    return new DashboardPage(
      posts as unknown as PostsService,
      { networkStatus$, checkNetworkStatus: async () => connected } as any,
      // Returns the key, so the tests assert which label was chosen rather
      // than restating the English.
      { instant: (key: string) => key } as any,
      { get: () => forms$ } as any,
      { back: jest.fn() } as any,
    );
  };

  beforeEach(() => {
    page = build();
  });

  it('shows the eight summary cards, in the order the web uses', async () => {
    await page.ngOnInit();

    expect(page.kpis.map((kpi) => kpi.labelKey)).toEqual([
      'dashboard.kpi.total_reports',
      'dashboard.kpi.response_rate',
      'dashboard.kpi.escalation_signals',
      'dashboard.kpi.gbv',
      'dashboard.kpi.conflicts',
      'dashboard.kpi.social',
      'dashboard.kpi.early_warning',
      'dashboard.kpi.environmental_climate',
    ]);
  });

  it('shows rates as percentages and counts as counts', async () => {
    await page.ngOnInit();

    const by = (key: string) => page.kpis.find((kpi) => kpi.labelKey === `dashboard.kpi.${key}`)!;
    expect(by('total_reports').value).toBe('100');
    expect(by('response_rate').value).toBe('60%');
    expect(by('escalation_signals').value).toBe('24%');
    expect(by('gbv').value).toBe('25');
  });

  it('works out each category share of the total', async () => {
    await page.ngOnInit();

    const gbv = page.kpis.find((kpi) => kpi.labelKey === 'dashboard.kpi.gbv')!;
    expect(gbv.captionParams).toEqual({ percent: 25 });
  });

  it('does not divide by zero when nothing has been reported', async () => {
    posts.getEwerDashboard.mockReturnValue(of(result({ total_reports: 0, gbv: 0 })));

    await page.ngOnInit();

    const gbv = page.kpis.find((kpi) => kpi.labelKey === 'dashboard.kpi.gbv')!;
    expect(gbv.captionParams).toEqual({ percent: 0 });
  });

  it('says it is offline rather than asking for numbers it cannot get', async () => {
    connected = false;

    await page.ngOnInit();

    expect(page.offline).toBe(true);
    expect(page.loading).toBe(false);
    expect(posts.getEwerDashboard).not.toHaveBeenCalled();
  });

  it('fills itself in once the connection returns', async () => {
    connected = false;
    await page.ngOnInit();
    expect(posts.getEwerDashboard).not.toHaveBeenCalled();

    connected = true;
    networkStatus$.next(true);
    // The reconnect path re-checks the network before requesting, so the call
    // lands a tick later.
    await flush();

    expect(posts.getEwerDashboard).toHaveBeenCalled();
  });

  it('does not reload on a reconnect when it already has the numbers', async () => {
    await page.ngOnInit();
    expect(posts.getEwerDashboard).toHaveBeenCalledTimes(1);

    networkStatus$.next(true);
    await flush();

    expect(posts.getEwerDashboard).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the request fails', async () => {
    posts.getEwerDashboard.mockReturnValue(throwError(() => new Error('boom')));

    await page.ngOnInit();

    expect(page.loadError).toBe(true);
    expect(page.loading).toBe(false);
  });

  it('finishes the pull-to-refresh even when the request fails', async () => {
    posts.getEwerDashboard.mockReturnValue(throwError(() => new Error('boom')));
    const complete = jest.fn();

    await page.load({ target: { complete } });

    expect(complete).toHaveBeenCalled();
  });

  describe('the charts', () => {
    const withCharts = () => ({
      result: {
        ...result().result,
        districts: [
          { name: 'Erigavo', value: 43 },
          { name: 'Bardere', value: 29 },
        ],
        incident_categories: [
          { key: 'gbv', name: 'Gender Based Violence', value: 38 },
          { key: 'conflict', name: 'Conflicts', value: 40 },
        ],
        district_types: [
          { name: 'Erigavo', value: 43, total: 43, types: { gbv: 30, conflict: 13, social: 0 } },
        ],
      },
    });

    it('plots each district by how many reports it has', async () => {
      posts.getEwerDashboard.mockReturnValue(of(withCharts()));

      await page.ngOnInit();

      expect(page.districtChart).toEqual([
        { name: 'Erigavo', value: 43 },
        { name: 'Bardere', value: 29 },
      ]);
    });

    it('names the type mix slices by translation key, not by survey wording', async () => {
      posts.getEwerDashboard.mockReturnValue(of(withCharts()));

      await page.ngOnInit();

      expect(page.typeMixChart).toEqual([
        { name: 'dashboard.categories.gbv', value: 38 },
        { name: 'dashboard.categories.conflict', value: 40 },
      ]);
      expect(page.typeMixTotal).toBe(78);
    });

    it('keeps the survey wording for a category it does not recognise', async () => {
      const unknown = withCharts();
      unknown.result.incident_categories = [
        { key: 'something_new', name: 'Something new', value: 3 },
      ];
      posts.getEwerDashboard.mockReturnValue(of(unknown));

      await page.ngOnInit();

      expect(page.typeMixChart).toEqual([{ name: 'Something new', value: 3 }]);
    });

    it('stacks each district by type, leaving out the types with none', async () => {
      posts.getEwerDashboard.mockReturnValue(of(withCharts()));

      await page.ngOnInit();

      expect(page.districtTypeChart).toEqual([
        {
          name: 'Erigavo',
          series: [
            { name: 'dashboard.categories.gbv', value: 30 },
            { name: 'dashboard.categories.conflict', value: 13 },
          ],
        },
      ]);
    });

    it('gives a category the same colour in both charts', async () => {
      posts.getEwerDashboard.mockReturnValue(of(withCharts()));

      await page.ngOnInit();

      // gbv then conflict, the order the categories arrived in.
      expect(page.categoryScheme.domain).toEqual(['#b5443a', '#5a5e8a']);
    });

    it('copes with a dashboard that has no districts yet', async () => {
      await page.ngOnInit();

      expect(page.districtChart).toEqual([]);
      expect(page.districtTypeChart).toEqual([]);
      expect(page.typeMixTotal).toBe(0);
    });
  });

  describe('filtering', () => {
    const paramsOf = (call = 0) => posts.getEwerDashboard.mock.calls[call][0];

    it('asks for everything until a filter is set', async () => {
      await page.ngOnInit();

      expect(paramsOf()).toEqual({
        form_id: '',
        incident_type: '',
        district: '',
        date_from: '',
        date_to: '',
      });
    });

    it('turns a period into a pair of dates', async () => {
      await page.ngOnInit();

      page.selectPeriod('week');
      await flush();

      const params = paramsOf(1);
      expect(params['date_to']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const days = (Date.parse(params['date_to']) - Date.parse(params['date_from'])) / 86_400_000;
      expect(Math.round(days)).toBe(7);
    });

    it('sends no dates for all time', async () => {
      await page.ngOnInit();
      page.selectPeriod('month');
      await flush();

      page.selectPeriod('all');
      await flush();

      expect(paramsOf(2)['date_from']).toBe('');
      expect(paramsOf(2)['date_to']).toBe('');
    });

    it('does not reload when the period has not changed', async () => {
      await page.ngOnInit();

      page.selectPeriod('all');

      expect(posts.getEwerDashboard).toHaveBeenCalledTimes(1);
    });

    it('applies the sheet in one go rather than one reload per control', async () => {
      await page.ngOnInit();
      page.openFilterSheet();

      page.draft.formId = '2';
      page.draft.incidentType = 'gbv';
      page.draft.district = 'Erigavo';
      page.applyFilterSheet();
      await flush();

      expect(posts.getEwerDashboard).toHaveBeenCalledTimes(2);
      expect(paramsOf(1)).toMatchObject({
        form_id: '2',
        incident_type: 'gbv',
        district: 'Erigavo',
      });
    });

    it('leaves the dashboard alone when the sheet is closed without applying', async () => {
      await page.ngOnInit();
      page.openFilterSheet();

      page.draft.district = 'Erigavo';
      page.filterSheetOpen = false;

      expect(page.filters.district).toBe('');
      expect(posts.getEwerDashboard).toHaveBeenCalledTimes(1);
    });

    it('hides the district charts once a district is chosen', async () => {
      await page.ngOnInit();
      expect(page.showDistrictCharts).toBe(true);

      page.openFilterSheet();
      page.draft.district = 'Erigavo';
      page.applyFilterSheet();
      await flush();

      expect(page.showDistrictCharts).toBe(false);
    });

    it('filters by a district tapped in the chart', async () => {
      await page.ngOnInit();

      page.onDistrictSelected({ name: 'Bardere', value: 29 });
      await flush();

      expect(page.filters.district).toBe('Bardere');
      expect(paramsOf(1)['district']).toBe('Bardere');
    });

    it('ignores a tap on the district already filtered by', async () => {
      await page.ngOnInit();
      page.onDistrictSelected('Bardere');
      await flush();

      page.onDistrictSelected('Bardere');
      await flush();

      expect(posts.getEwerDashboard).toHaveBeenCalledTimes(2);
    });

    it('counts only the sheet filters on the badge, not the period', async () => {
      await page.ngOnInit();
      page.selectPeriod('week');
      await flush();
      expect(page.activeFilterCount).toBe(0);

      page.onDistrictSelected('Bardere');
      await flush();

      expect(page.activeFilterCount).toBe(1);
    });

    it('shows a chip per active filter, named the way it was chosen', async () => {
      await page.ngOnInit();
      page.openFilterSheet();
      page.draft.formId = '2';
      page.draft.incidentType = 'gbv';
      page.applyFilterSheet();
      await flush();

      expect(page.activeChips).toEqual([
        { key: 'formId', label: 'NAGAASHO EWER' },
        { key: 'incidentType', label: 'dashboard.categories.gbv' },
      ]);
    });

    it('clears one filter from its chip, leaving the others', async () => {
      await page.ngOnInit();
      page.openFilterSheet();
      page.draft.incidentType = 'gbv';
      page.draft.district = 'Erigavo';
      page.applyFilterSheet();
      await flush();

      page.removeFilter('district');
      await flush();

      expect(page.filters.district).toBe('');
      expect(page.filters.incidentType).toBe('gbv');
      expect(page.showDistrictCharts).toBe(true);
    });

    it('offers the projects the deployment has, for when there is more than one', async () => {
      await page.ngOnInit();

      expect(page.projectOptions).toEqual([{ value: '2', label: 'NAGAASHO EWER' }]);
    });

    it('still shows a dashboard when the project list cannot be fetched', async () => {
      // Set after build(), which seeds the working list; the service reads the
      // variable when called, not when constructed.
      forms$ = throwError(() => new Error('boom'));

      await page.ngOnInit();

      expect(page.projectOptions).toEqual([]);
      expect(page.kpis.length).toBe(8);
    });

    it('takes its district options from the dashboard it just loaded', async () => {
      posts.getEwerDashboard.mockReturnValue(
        of({
          result: {
            ...result().result,
            district_options: [{ name: 'Erigavo', value: 43 }],
          },
        }),
      );

      await page.ngOnInit();

      expect(page.districtOptions).toEqual([{ value: 'Erigavo', label: 'Erigavo' }]);
    });
  });
});
