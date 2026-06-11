import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PostPage } from './post.page';
import { LanguageGuard } from '@guards';

const routes: Routes = [
  {
    path: '',
    component: PostPage,
    canActivate: [LanguageGuard],
  },
  {
    path: 'edit',
    loadChildren: () => import('./post-edit/post-edit.module').then((m) => m.PostEditModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PostPageRoutingModule {}
