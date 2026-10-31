import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SurveysService } from '@mzima-client/sdk';
import { of } from 'rxjs';

import { PostPreviewComponent } from './post-preview.component';

describe('PostPreviewComponent', () => {
  let component: PostPreviewComponent;
  let fixture: ComponentFixture<PostPreviewComponent>;

  const surveyNames: Record<number, string> = {
    9: 'NAGAASHO EWER Updated',
    11: 'Training Post test',
  };

  const field = (label: string, input: string, value: any, extra: any = {}) => ({
    label,
    input,
    type: 'varchar',
    config: {},
    value: { value },
    ...extra,
  });

  const showPost = (fields: any[], post: any = {}) => {
    component.post = {
      id: 7,
      form_id: 11,
      title: 'Training Post test',
      status: 'published',
      post_content: [{ fields }],
      ...post,
    } as any;
    component.ngOnChanges({ post: {} as any });
    return component.tile!;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PostPreviewComponent],
      providers: [
        {
          provide: SurveysService,
          useValue: { getSurveyName: (id: number) => of(surveyNames[id] ?? '') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostPreviewComponent);
    component = fixture.componentInstance;
    component.feedView = true;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('a post from a survey other than EWER', () => {
    it('puts the district and region in the heading and the village under it', () => {
      const tile = showPost([
        field('Magaca Mashruuca', 'select', 'nagaansho'),
        field('Gobal ka', 'select', 'Sanaag'),
        field('Degmada', 'select', 'Erigavo'),
        field('Xafada/ Tuulada', 'select', 'goob', {
          options: [{ name: 'goob', label: 'Goob' }],
        }),
      ]);

      expect(tile.location).toBe('Erigavo, Sanaag');
      expect(tile.site).toBe('Goob');
    });

    it('finds a place by its XLSForm name when the label does not say', () => {
      const tile = showPost([
        field('Where did it happen?', 'text', 'Bosaso', { config: { xlsform_name: 'town' } }),
      ]);

      expect(tile.location).toBe('Bosaso');
    });

    it('ignores a yes or no answer to a question about a place', () => {
      const tile = showPost([
        field('Site visited by the monitor?', 'select', 'yes'),
        field('Region', 'select', 'Bari'),
      ]);

      expect(tile.location).toBe('Bari');
    });

    it('falls back to the GPS point', () => {
      const tile = showPost([field('Goobta', 'location', { lat: 10.4, lon: 47.36 })]);

      expect(tile.location).toBe('10.4000, 47.3600');
    });

    it('says the location is unavailable when the survey asks for none', () => {
      const tile = showPost([field('Magaca Mashruuca', 'select', 'nagaansho')]);

      expect(tile.location).toBe('');
      expect(tile.locationKey).toBe('post.tile.no_location');
    });

    it('leaves off the escalation and response pills it has no answers for', () => {
      const tile = showPost([field('Region', 'select', 'Bari')]);

      expect(tile.escalationLabelKey).toBe('');
      expect(tile.responseLabelKey).toBe('');
    });

    it('shows its survey name where EWER shows the incident type', () => {
      const tile = showPost([field('Region', 'select', 'Bari')]);

      expect(tile.incidentType).toBe('');
      expect(component.surveyName).toBe('Training Post test');
    });

    it('drops a title that only repeats the survey name', () => {
      showPost([]);

      expect(component.tileTitle).toBe('');
    });

    it('keeps a title of its own', () => {
      showPost([], { title: 'Market fire in Bosaso' });

      expect(component.tileTitle).toBe('Market fire in Bosaso');
    });
  });

  describe('an EWER post', () => {
    const ewerPost = (escalation: any) =>
      showPost(
        [
          field('Incidence type', 'select', 'conflicts'),
          field('Region where incidence occurred', 'select', 'Sanaag'),
          field('District where incidence occurred', 'select', 'Erigavo'),
          field('Village where incidence occurred', 'select', 'Goob'),
          field('Are there escalation indicators', 'radio', escalation),
        ],
        { form_id: 9, title: null },
      );

    it('keeps its own location questions', () => {
      const tile = ewerPost('No');

      expect(tile.location).toBe('Erigavo, Sanaag');
      expect(tile.site).toBe('Goob');
    });

    it('shows its incident type rather than the survey name', () => {
      const tile = ewerPost('No');

      expect(tile.incidentTypeKey).toBe('dashboard.categories.conflict');
    });

    it('says there is no escalation when the question is there but unanswered', () => {
      expect(ewerPost(null).escalationLabelKey).toBe('post.tile.no_escalation');
    });

    it('flags escalation risk', () => {
      const tile = ewerPost('Yes');

      expect(tile.escalationRisk).toBe(true);
      expect(tile.escalationLabelKey).toBe('post.tile.escalation_risk');
    });
  });

  it('marks a post under review, and says nothing once it is published', () => {
    showPost([], { status: 'draft' });
    expect(component.reviewStatusKey).toBe('post.draft');

    showPost([], { status: 'published' });
    expect(component.reviewStatusKey).toBe('');
  });
});
