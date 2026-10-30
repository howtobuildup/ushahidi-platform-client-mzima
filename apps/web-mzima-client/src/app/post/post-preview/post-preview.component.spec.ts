import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostPreviewComponent } from './post-preview.component';

describe('PostPreviewComponent', () => {
  let component: PostPreviewComponent;
  let fixture: ComponentFixture<PostPreviewComponent>;

  const field = (label: string, input: string, value: any, extra: any = {}) => ({
    label,
    input,
    type: 'varchar',
    config: {},
    value: { value },
    ...extra,
  });

  const showPost = (fields: any[]) => {
    component.post = { id: 7, title: 'Training Post test', post_content: [{ fields }] } as any;
    component.ngOnChanges({ post: {} as any });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PostPreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PostPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('a post from a survey other than EWER', () => {
    it('names where it happened, most specific place first', () => {
      showPost([
        field('Magaca Mashruuca', 'select', 'nagaansho'),
        field('Gobal ka', 'select', 'Sanaag'),
        field('Degmada', 'select', 'Erigavo'),
        field('Xafada/ Tuulada', 'select', 'goob', {
          options: [{ name: 'goob', label: 'Goob' }],
        }),
      ]);

      expect(component.ewerTile).toBeUndefined();
      expect(component.placeName).toBe('Goob, Erigavo, Sanaag');
    });

    it('finds a place by its XLSForm name when the label does not say', () => {
      showPost([
        field('Where did it happen?', 'text', 'Bosaso', { config: { xlsform_name: 'town' } }),
      ]);

      expect(component.placeName).toBe('Bosaso');
    });

    it('ignores a yes or no answer to a question about a place', () => {
      showPost([
        field('Site visited by the monitor?', 'select', 'yes'),
        field('Region', 'select', 'Bari'),
      ]);

      expect(component.placeName).toBe('Bari');
    });

    it('falls back to the GPS point', () => {
      showPost([field('Goobta', 'location', { lat: 10.4, lon: 47.36 })]);

      expect(component.placeName).toBe('10.4000, 47.3600');
    });

    it('is left empty when the survey asks for no location', () => {
      showPost([field('Magaca Mashruuca', 'select', 'nagaansho')]);

      expect(component.placeName).toBe('');
    });
  });

  it('leaves an EWER post to its own tile', () => {
    showPost([
      field('Incidence type', 'select', 'conflicts'),
      field('Region where incidence occurred', 'select', 'Sanaag'),
    ]);

    expect(component.ewerTile?.location).toBe('Sanaag');
    expect(component.placeName).toBe('');
  });
});
