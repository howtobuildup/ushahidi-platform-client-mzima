import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { STORAGE_KEYS } from '@constants';
import { InfiniteScrollCustomEvent } from '@ionic/angular';
import { shouldScopePostsToCurrentUser } from '@helpers';
import { GeoJsonFilter, PostApiResponse, PostResult, PostsService } from '@mzima-client/sdk';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DatabaseService, NetworkService, SessionService } from '@services';
import { distinctUntilChanged, lastValueFrom } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'app-activity',
  templateUrl: 'activity.page.html',
  styleUrls: ['activity.page.scss'],
})
export class ActivityPage {
  public isPostsLoading = false;
  public isConnection = true;
  public posts: PostResult[] = [];
  public totalPosts = 0;
  private currentUserId?: string | number;
  private shouldScopeToOwnPosts = false;
  private params: GeoJsonFilter = {
    limit: 20,
    page: 1,
    orderby: 'created',
    order: 'desc',
  };

  constructor(
    private router: Router,
    private postsService: PostsService,
    private databaseService: DatabaseService,
    private networkService: NetworkService,
    private sessionService: SessionService,
  ) {
    this.sessionService.currentUserData$.pipe(untilDestroyed(this)).subscribe({
      next: (userData) => {
        this.currentUserId = userData.userId;
        this.shouldScopeToOwnPosts = shouldScopePostsToCurrentUser(
          userData.permissions,
          userData.role,
        );
      },
    });
    this.initNetworkListener();
  }

  ionViewWillEnter(): void {
    this.getSubmissionHistory();
  }

  public async getSubmissionHistory(add = false): Promise<void> {
    this.isPostsLoading = true;
    const cacheKey = this.getPostsCacheKey();

    try {
      const response = await lastValueFrom(
        this.postsService.getPosts('', this.withPostAccessScope(this.params)),
      );
      await this.databaseService.set(cacheKey, response);
      this.postDisplayProcessing(response, add);
    } catch (error) {
      console.error('error: ', error);
      const response = await this.databaseService.get(cacheKey);
      if (response) {
        this.postDisplayProcessing(response, add);
      } else {
        this.isPostsLoading = false;
      }
    }
  }

  public async loadMorePosts(ev: any): Promise<void> {
    if (this.isConnection && this.totalPosts > this.posts.length && this.params.page) {
      this.params.page++;
      await this.getSubmissionHistory(true);
      (ev as InfiniteScrollCustomEvent).target.complete();
    }
  }

  public showPost(id: string): void {
    this.router.navigate([id]);
  }

  public back(): void {
    this.router.navigate(['/map']);
  }

  private initNetworkListener(): void {
    this.networkService.networkStatus$
      .pipe(distinctUntilChanged(), untilDestroyed(this))
      .subscribe({
        next: (value) => {
          this.isConnection = value;
          if (this.isConnection) {
            this.getSubmissionHistory();
          }
        },
      });
  }

  private postDisplayProcessing(response: PostApiResponse, add: boolean): void {
    this.posts = add ? [...this.posts, ...response.results] : response.results;
    this.isPostsLoading = false;
    this.totalPosts = response.meta.total;
  }

  private withPostAccessScope<T extends Record<string, any>>(params: T): T {
    return {
      ...params,
      ...(this.shouldScopeToOwnPosts ? { user: 'me' } : {}),
    };
  }

  private getPostsCacheKey(): string {
    if (!this.shouldScopeToOwnPosts) return `${STORAGE_KEYS.POSTS}_activity`;

    return `${STORAGE_KEYS.POSTS}_activity_user_${this.currentUserId || 'me'}`;
  }
}
