import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LanguageGuard } from '@guards';

const routes: Routes = [
  {
    path: '',
    canActivate: [LanguageGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./profile/profile.module').then((m) => m.ProfilePageModule),
      },
      {
        path: 'information',
        loadChildren: () =>
          import('./information/information.module').then((m) => m.InformationPageModule),
      },
      // Deployment switching is disabled because Saferworld uses the backend
      // configured at build/deployment time.
      // {
      //   path: 'deployment',
      //   loadChildren: () =>
      //     import('./deployment/deployment.module').then((m) => m.DeploymentPageModule),
      // },
      {
        path: 'posts',
        loadChildren: () => import('./posts/posts.module').then((m) => m.PostsPageModule),
      },
      {
        path: 'collection',
        loadChildren: () =>
          import('./collection/collection.module').then((m) => m.CollectionPageModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class ProfilePageRoutingModule {}
