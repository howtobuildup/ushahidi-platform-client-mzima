import { PostsService } from '@mzima-client/sdk';
import { of, Subject, throwError } from 'rxjs';

import { DashboardPage } from './dashboard.page';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DashboardPage', () => {
  let page: DashboardPage;
  let posts: { getEwerDashboard: jest.Mock };
  let connected: boolean;
  let networkStatus$: Subject<boolean>;

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
    posts = { getEwerDashboard: jest.fn().mockReturnValue(of(result())) };
    return new DashboardPage(
      posts as unknown as PostsService,
      { networkStatus$, checkNetworkStatus: async () => connected } as any,
      // Returns the key, so the tests assert which label was chosen rather
      // than restating the English.
      { instant: (key: string) => key } as any,
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
});
