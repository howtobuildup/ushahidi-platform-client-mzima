import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SavedsearchesService, PostsService, UserInterface } from '@mzima-client/sdk';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SessionService } from '@services';
import { isSubmitOnlyUser } from '@helpers';
import { Subject } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'app-main-view',
  template: '',
})
export abstract class MainViewComponent {
  searchId = '';
  collectionId = '';
  params: any = {
    limit: 200,
    offset: 0,
  };
  filters: any;
  public user: UserInterface;
  public $destroy = new Subject<boolean>();
  protected currentUserId?: string | number;
  protected shouldScopeToOwnPosts = false;

  constructor(
    protected router: Router,
    protected route: ActivatedRoute,
    protected postsService: PostsService,
    protected savedSearchesService: SavedsearchesService,
    protected sessionService: SessionService,
  ) {
    this.sessionService.currentUserData$.pipe(untilDestroyed(this)).subscribe({
      next: (userData) => {
        this.user = userData;
        this.currentUserId = userData.userId;
        this.shouldScopeToOwnPosts = isSubmitOnlyUser(userData.permissions, userData.role);
      },
    });
    this.updateFilters();
  }

  public updateFilters(): void {
    this.filters = JSON.parse(
      localStorage.getItem(this.sessionService.getLocalStorageNameMapper('filters')) ?? '{}',
    );
  }

  ionViewWillEnter(): void {
    this.$destroy.next(false);
  }

  ionViewWillLeave(): void {
    this.$destroy.next(true);
  }

  abstract loadData(): void;

  protected withPostAccessScope<T extends Record<string, any>>(params: T): T {
    return {
      ...params,
      ...(this.shouldScopeToOwnPosts ? { user: 'me' } : {}),
    };
  }

  protected getPostsCacheKey(baseKey: string): string {
    if (!this.shouldScopeToOwnPosts) return baseKey;

    return `${baseKey}_user_${this.currentUserId || 'me'}`;
  }

  initCollection() {
    this.collectionId = '';
    this.params.set = '';

    if (this.route.snapshot.data['view'] === 'search') {
      this.searchId = this.route.snapshot.paramMap.get('id')!;
      this.savedSearchesService.getById(this.searchId).subscribe((sSearch) => {
        this.postsService.applyFilters(Object.assign(sSearch.result.filter, { set: [] }));
      });
    }
  }
}
