import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { CONST } from '@constants';

import { MenuComponent } from './menu.component';

describe('MenuComponent', () => {
  let fixture: ComponentFixture<MenuComponent>;

  const asRole = (role: string, permissions = 'Manage Posts') => {
    localStorage.setItem(`${CONST.LOCAL_STORAGE_PREFIX}role`, role);
    localStorage.setItem(`${CONST.LOCAL_STORAGE_PREFIX}permissions`, permissions);
    // The menu is built when the component is, so it has to be created after
    // the role is in place.
    fixture = TestBed.createComponent(MenuComponent);
    return fixture.componentInstance;
  };

  beforeEach(waitForAsync(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      declarations: [MenuComponent],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
      providers: [{ provide: Router, useValue: { url: '/map' } }],
    }).compileComponents();
  }));

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(asRole('admin')).toBeTruthy();
  });

  it('offers the dashboard to staff', () => {
    const routes = asRole('saferworld_staff').menu.map((item) => item.route);

    expect(routes).toContain('/dashboard');
  });

  it('offers the dashboard to partners', () => {
    const routes = asRole('saferworld_partner').menu.map((item) => item.route);

    expect(routes).toContain('/dashboard');
  });

  it('does not offer a field monitor a door that will not open', () => {
    const routes = asRole('field_monitor', 'Submit Posts').menu.map((item) => item.route);

    expect(routes).not.toContain('/dashboard');
    // The rest of the app is still theirs.
    expect(routes).toContain('/map');
    expect(routes).toContain('/activity');
    expect(routes).toContain('/profile');
  });

  it('leaves entries with no restriction alone', () => {
    const routes = asRole('field_monitor', 'Submit Posts').menu.map((item) => item.route);

    expect(routes.length).toBe(3);
  });
});
