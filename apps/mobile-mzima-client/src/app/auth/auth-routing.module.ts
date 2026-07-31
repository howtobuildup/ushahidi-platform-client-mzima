import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotAuthorizedGuard } from '@guards';
import { AuthPage } from './auth.page';

const routes: Routes = [
  {
    path: '',
    component: AuthPage,
    children: [
      {
        path: 'login',
        loadChildren: () => import('./login/login.module').then((m) => m.LoginPageModule),
        canActivate: [NotAuthorizedGuard],
      },
      {
        path: 'signup',
        redirectTo: '/auth/login',
        pathMatch: 'full',
        // loadChildren: () => import('./signup/signup.module').then((m) => m.SignupPageModule),
        // canActivate: [IsSignupEnabledGuard],
      },
      {
        path: '',
        redirectTo: '/auth/login',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class AuthPageRoutingModule {}
