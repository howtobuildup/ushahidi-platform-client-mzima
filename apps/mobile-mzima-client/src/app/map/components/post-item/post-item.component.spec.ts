import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { MediaService, PostsService } from '@mzima-client/sdk';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import {
  AlertService,
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
  describe('the EWER tile', () => {
    const postWith = (fields: any[]) =>
      ({ id: 4321, title: 'Untitled', post_content: [{ fields }] } as any);

    const field = (label: string, value: any) => ({ label, value, type: 'varchar' });

    const build = (fields: any[]) => {
      component.post = postWith(fields);
      component.ngOnInit();
      return component.ewerTile!;
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
});
