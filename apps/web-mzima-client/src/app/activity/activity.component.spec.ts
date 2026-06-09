import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PostsService } from '@mzima-client/sdk';
import { TranslateModule } from '@ngx-translate/core';
import { throwError } from 'rxjs';

import { ActivityComponent } from './activity.component';

describe('ActivityComponent', () => {
  let component: ActivityComponent;
  let fixture: ComponentFixture<ActivityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ActivityComponent],
      imports: [TranslateModule.forRoot()],
      providers: [
        {
          provide: PostsService,
          useValue: {
            getEwerDashboard: () => throwError(() => new Error('Dashboard unavailable')),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
