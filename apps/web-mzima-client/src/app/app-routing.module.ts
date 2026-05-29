import { NgModule } from '@angular/core';
import { RouterModule, Routes, TitleStrategy } from '@angular/router';
import {
  AuthGuard,
  HostGuard,
  LoginRedirectGuard,
  ResetTokenGuard,
  SubmitPostsGuard,
} from '@guards';
import { PageNotFoundComponent } from './shared/components';
import { UshahidiPageTitleStrategy } from '@services';
import { LoginComponent, ResetComponent } from '@auth';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoginRedirectGuard],
    data: {
      breadcrumb: 'nav.login',
      ogTitle: 'nav.login',
    },
  },
  {
    path: 'login/reset',
    component: ResetComponent,
    data: {
      breadcrumb: 'nav.resetpassword',
      ogTitle: 'nav.resetpassword',
    },
  },
  {
    path: 'map',
    loadChildren: () => import('./map/map.module').then((m) => m.MapModule),
    canActivate: [AuthGuard, SubmitPostsGuard],
    data: {
      breadcrumb: 'nav.map',
      ogTitle: 'nav.map',
    },
  },
  {
    path: 'data',
    loadChildren: () => import('./data/data.module').then((m) => m.DataModule),
    canActivate: [AuthGuard, SubmitPostsGuard],
    data: {
      breadcrumb: 'nav.data',
      ogTitle: 'nav.data',
    },
  },
  {
    path: 'feed',
    loadChildren: () => import('./feed/feed.module').then((m) => m.FeedModule),
    canActivate: [AuthGuard, SubmitPostsGuard],
    data: {
      breadcrumb: 'nav.feed',
      ogTitle: 'nav.feed',
    },
  },
  {
    path: 'activity',
    loadChildren: () => import('./activity/activity.module').then((m) => m.ActivityModule),
    canActivate: [AuthGuard, SubmitPostsGuard],
    data: {
      breadcrumb: 'nav.activity',
      ogTitle: 'nav.activity',
    },
  },
  {
    path: 'settings',
    loadChildren: () => import('./settings/settings.module').then((m) => m.SettingsModule),
    canActivate: [AuthGuard, SubmitPostsGuard, HostGuard],
    data: {
      breadcrumb: 'nav.settings',
      ogTitle: 'nav.settings',
    },
  },
  {
    path: 'post',
    loadChildren: () => import('./post/post.module').then((m) => m.PostModule),
    canActivate: [AuthGuard, SubmitPostsGuard],
    data: {
      breadcrumb: 'nav.posts',
      ogTitle: 'nav.posts',
    },
  },
  {
    path: 'reset',
    title: 'reset',
    redirectTo: 'login/reset',
    pathMatch: 'full',
  },
  {
    path: 'no-access',
    component: PageNotFoundComponent,
    canActivate: [AuthGuard],
    data: {
      breadcrumb: 'app.page-not-found',
      ogTitle: 'app.page-not-found',
    },
  },
  {
    path: 'forgotpassword/confirm/:token',
    canActivate: [ResetTokenGuard],
    component: PageNotFoundComponent,
  },
  {
    path: 'views',
    children: [
      {
        path: 'map',
        redirectTo: '/map',
      },
      {
        path: 'data',
        redirectTo: '/feed',
      },
    ],
  },
  {
    path: '**',
    pathMatch: 'full',
    component: PageNotFoundComponent,
    data: {
      breadcrumb: 'app.page-not-found',
      ogTitle: 'app.page-not-found',
    },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [{ provide: TitleStrategy, useClass: UshahidiPageTitleStrategy }],
})
export class AppRoutingModule {}
