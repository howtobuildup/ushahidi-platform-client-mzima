import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { MediaService, PostsService, SurveysService } from '@mzima-client/sdk';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import {
  AlertService,
  DatabaseService,
  DeploymentService,
  NetworkService,
  SessionService,
  ShareService,
  ToastService,
} from '@services';
import { of } from 'rxjs';

import { PostItemComponent } from './post-item.component';

describe('PostItemComponent', () => {
  let component: PostItemComponent;
  let fixture: ComponentFixture<PostItemComponent>;

  // What the server returns, and the copy of the survey list the app keeps
  // for when it is offline.
  const surveyNames: Record<number, string> = { 11: 'Training Post test' };
  const storedSurveys = [{ id: 12, name: 'Kept on the phone' }];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PostItemComponent],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
      // Stubbed rather than provided for real: the tile is built from the
      // post it is given, and none of these are touched on the way.
      providers: [
        { provide: MediaService, useValue: { getById: () => of(null) } },
        { provide: PostsService, useValue: {} },
        { provide: NetworkService, useValue: { networkStatus$: of(true) } },
        { provide: SessionService, useValue: { currentUserData$: of({}), isLogged: () => false } },
        { provide: AlertService, useValue: {} },
        { provide: ToastService, useValue: {} },
        { provide: ShareService, useValue: {} },
        { provide: DeploymentService, useValue: { getDeployment: () => null } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        {
          provide: SurveysService,
          useValue: { getSurveyName: (id: number) => of(surveyNames[id] ?? '') },
        },
        { provide: DatabaseService, useValue: { get: async () => storedSurveys } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostItemComponent);
    component = fixture.componentInstance;
    // The component reads its post on init, so it needs one before the first
    // change detection run.
    component.post = { id: 1, post_content: [] } as any;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // The tile is built from the survey's own field names and values, so these
  // cover the mapping rather than the rendering.
  describe('an EWER post', () => {
    const postWith = (fields: any[]) =>
      ({ id: 4321, title: 'Untitled', post_content: [{ fields }] } as any);

    const field = (label: string, value: any) => ({ label, value, type: 'varchar' });

    const build = (fields: any[]) => {
      component.post = postWith(fields);
      component.ngOnInit();
      return component.tile!;
    };

    it('resolves a known incident type to the key the dashboard uses', () => {
      const tile = build([
        field('Incidence type', 'Gender Based Violence'),
        field('Region where incidence occurred', 'Sanaag'),
      ]);

      expect(tile.incidentTypeKey).toBe('dashboard.categories.gbv');
    });

    it('keeps an unrecognised incident type as the survey recorded it', () => {
      const tile = build([
        field('Incidence type', 'Something the survey added later'),
        field('Region where incidence occurred', 'Sanaag'),
      ]);

      expect(tile.incidentTypeKey).toBe('');
      expect(tile.incidentType).toBe('Something the survey added later');
    });

    it('names the escalation and response states as keys, not English', () => {
      const tile = build([
        field('Incidence type', 'Conflicts'),
        field('Are there escalation indicators', 'Yes'),
        field('Has any response happened?', 'No'),
      ]);

      expect(tile.escalationLabelKey).toBe('post.tile.escalation_risk');
      expect(tile.escalationRisk).toBe(true);
      expect(tile.responseLabelKey).toBe('post.tile.no_response');
      expect(tile.responseActive).toBe(false);
    });

    it('says there is no escalation when the question is there but unanswered', () => {
      const tile = build([
        field('Incidence type', 'Conflicts'),
        field('Are there escalation indicators', null),
      ]);

      expect(tile.escalationLabelKey).toBe('post.tile.no_escalation');
    });

    it('falls back to a key when there is no location to show', () => {
      const tile = build([field('Incidence type', 'Conflicts')]);

      expect(tile.location).toBe('');
      expect(tile.locationKey).toBe('post.tile.no_location');
    });

    it('leaves the location key empty when a location is known', () => {
      const tile = build([
        field('Incidence type', 'Conflicts'),
        field('Region where incidence occurred', 'Sanaag'),
        field('District where incidence occurred', 'Erigavo'),
      ]);

      expect(tile.location).toBe('Erigavo, Sanaag');
      expect(tile.locationKey).toBe('');
    });

    it('counts the sources rather than wording them', () => {
      const tile = build([
        field('Incidence type', 'Conflicts'),
        field('What are the sources of information?', ['radio', 'elder']),
      ]);

      expect(tile.sourcesCount).toBe(2);
    });

    it('reports no sources as zero, so the pill can be hidden', () => {
      const tile = build([field('Incidence type', 'Conflicts')]);

      expect(tile.sourcesCount).toBe(0);
    });
  });

  describe('a post from a survey other than EWER', () => {
    const field = (label: string, input: string, value: any, extra: any = {}) => ({
      label,
      input,
      value,
      type: 'varchar',
      config: {},
      ...extra,
    });

    const build = (fields: any[], post: any = {}) => {
      component.post = {
        id: 7,
        form_id: 11,
        title: 'Training Post test',
        post_content: [{ fields }],
        ...post,
      } as any;
      component.ngOnInit();
      return component.tile!;
    };

    it('puts the district and region in the heading and the village under it', () => {
      const tile = build([
        field('Magaca Mashruuca', 'select', 'nagaansho'),
        field('Gobal ka', 'select', 'sanaag', { options: [{ name: 'sanaag', label: 'Sanaag' }] }),
        field('Degmada', 'select', 'Erigavo'),
        field('Xafada/ Tuulada', 'select', 'goob', { options: [{ name: 'goob', label: 'Goob' }] }),
      ]);

      expect(tile.location).toBe('Erigavo, Sanaag');
      expect(tile.site).toBe('Goob');
    });

    it('ignores a yes or no answer to a question about a place', () => {
      const tile = build([
        field('Site visited by the monitor?', 'select', 'yes'),
        field('Region', 'select', 'Bari'),
      ]);

      expect(tile.location).toBe('Bari');
    });

    it('falls back to the GPS point', () => {
      const tile = build([field('Goobta', 'location', { lat: 10.4, lon: 47.36 })]);

      expect(tile.location).toBe('10.4000, 47.3600');
    });

    it('says the location is unavailable when the survey asks for none', () => {
      const tile = build([field('Magaca Mashruuca', 'select', 'nagaansho')]);

      expect(tile.location).toBe('');
      expect(tile.locationKey).toBe('post.tile.no_location');
    });

    it('leaves off the escalation and response pills it has no answers for', () => {
      const tile = build([field('Region', 'select', 'Bari')]);

      expect(tile.escalationLabelKey).toBe('');
      expect(tile.responseLabelKey).toBe('');
    });

    it('shows its survey name, and drops a title that only repeats it', () => {
      build([]);

      expect(component.surveyName).toBe('Training Post test');
      expect(component.tileTitle).toBe('');
    });

    it('keeps a title of its own', () => {
      build([], { title: 'Market fire in Bosaso' });

      expect(component.tileTitle).toBe('Market fire in Bosaso');
    });

    it('finds the survey name in the stored list when offline', async () => {
      build([], { form_id: 12 });
      await new Promise((resolve) => setTimeout(resolve));

      expect(component.surveyName).toBe('Kept on the phone');
    });

    it('marks a post under review, and says nothing once it is published', () => {
      build([], { status: 'draft' });
      expect(component.reviewStatusKey).toBe('post.draft');

      build([], { status: 'published' });
      expect(component.reviewStatusKey).toBe('');
    });
  });
});
