import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  MediaService,
  PostContentField,
  PostResult,
  PostStatus,
  PostsService,
} from '@mzima-client/sdk';
import {
  getPostItemActions,
  PostItemActionType,
  PostItemActionTypeUserRole,
  postStatusChangedHeader,
  postStatusChangedMessage,
} from '@constants';
import { ActionSheetButton, ModalController } from '@ionic/angular';
import {
  AlertService,
  DeploymentService,
  NetworkService,
  SessionService,
  ShareService,
  ToastService,
} from '@services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { cloneDeep } from 'lodash';
import { CollectionsModalComponent } from '../../../shared/components';
import { Router } from '@angular/router';

interface EwerTileSummary {
  incidentType: string;
  escalationLabel: string;
  escalationRisk: boolean;
  location: string;
  site?: string;
  status?: string;
  sourcesLabel?: string;
  actors?: string;
  responseLabel: string;
  responseActive: boolean;
  monitorCode?: string;
  hasMedia: boolean;
}

@UntilDestroy()
@Component({
  selector: 'app-post-item',
  templateUrl: './post-item.component.html',
  styleUrls: ['./post-item.component.scss'],
})
export class PostItemComponent implements OnInit, OnChanges {
  @Input() public post: PostResult;
  @Input() public checkbox = false;
  @Input() public isProfile?: boolean;
  @Output() public postUpdated = new EventEmitter<{ post: PostResult }>();
  @Output() public postDeleted = new EventEmitter<{ post: PostResult }>();
  @Output() selected = new EventEmitter<boolean>();
  public mediaUrl: string;
  public media: any;
  public mediaId?: number;
  public isMediaLoading: boolean;
  public isActionsOpen = false;
  public actionSheetButtons?: ActionSheetButton[] = getPostItemActions();
  public isConnection = true;
  public ewerTile?: EwerTileSummary;

  constructor(
    private networkService: NetworkService,
    private mediaService: MediaService,
    protected sessionService: SessionService,
    private alertService: AlertService,
    private toastService: ToastService,
    private postsService: PostsService,
    private shareService: ShareService,
    private deploymentService: DeploymentService,
    private modalController: ModalController,
    private router: Router,
  ) {}

  async ionViewWillEnter() {
    await this.checkNetwork();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['post']) {
      this.ewerTile = this.buildEwerTile();
    }
  }

  ngOnInit(): void {
    this.ewerTile = this.buildEwerTile();

    this.sessionService.currentUserData$.pipe(untilDestroyed(this)).subscribe({
      next: ({ role, userId }) => {
        if (role === 'admin') {
          this.actionSheetButtons = getPostItemActions(PostItemActionTypeUserRole.ADMIN);
        } else if (String(userId) === String(this.post.user_id)) {
          this.actionSheetButtons = getPostItemActions(PostItemActionTypeUserRole.AUTHOR);
        } else if (role === 'member') {
          this.actionSheetButtons = getPostItemActions(PostItemActionTypeUserRole.USER);
        } else {
          this.actionSheetButtons = getPostItemActions();
        }
      },
    });

    if (this.isConnection) {
      this.getMedia();
    }
  }

  private getMedia() {
    this.mediaId = this.post.post_content
      ?.flatMap((c) => c.fields)
      .find((f) => f.input === 'upload')?.value?.value;

    this.mediaUrl = this.post.post_content
      ?.flatMap((c) => c.fields)
      .find((f) => f.input === 'upload')?.value?.photoUrl;
  }

  private async checkNetwork() {
    this.isConnection = await this.networkService.checkNetworkStatus();
  }

  public makeAction(ev: any) {
    this.isActionsOpen = false;
    const role = ev.detail.role;
    if (role === 'cancel' || !ev.detail.data) return;
    const action: PostItemActionType = ev.detail.data.action;

    const actions: Record<PostItemActionType, () => void> = {
      [PostItemActionType.SHARE]: () =>
        this.shareService.share({
          title: this.post.title,
          text: this.post.title,
          url: `https://${this.deploymentService.getDeployment().fqdn}/feed/${
            this.post.id
          }/view?mode=POST`,
          dialogTitle: 'Share Post',
        }),
      [PostItemActionType.EDIT]: () => this.editPost(),
      [PostItemActionType.ADD_TO_COLLECTION]: () => this.addToCollection(),
      [PostItemActionType.PUBLISH]: () => this.setPostStatus(PostStatus.Published),
      [PostItemActionType.PUT_UNDER_REVIEW]: () => this.setPostStatus(PostStatus.Draft),
      [PostItemActionType.ARCHIVE]: () => this.setPostStatus(PostStatus.Archived),
      [PostItemActionType.DELETE]: () => this.deletePost(),
    };

    actions[action]();
  }

  private editPost(): void {
    this.router.navigate([this.post.id, 'edit'], { queryParams: { profile: this.isProfile } });
  }

  private async addToCollection(): Promise<void> {
    const modal = await this.modalController.create({
      component: CollectionsModalComponent,
      componentProps: {
        postId: this.post.id,
        selectedCollections: new Set(this.post.sets ?? []),
      },
    });
    modal.onWillDismiss().then(({ data }) => {
      const { collections, changed } = data ?? {};
      if (changed) {
        this.post.sets = collections;
        this.postUpdated.emit({ post: this.post });
        this.toastService.presentToast({
          header: 'Success',
          message: `The post “${this.post.title}” was ${
            collections?.length
              ? `added in ${collections.length} collections`
              : 'removed from all collections'
          }.`,
          buttons: [],
        });
      }
    });
    modal.present();
  }

  private setPostStatus(status: PostStatus): void {
    this.postsService.updateStatus(this.post.id, status).subscribe((res) => {
      this.post = res.result;
      this.ewerTile = this.buildEwerTile();
      this.postUpdated.emit({ post: this.post });
      this.toastService.presentToast({
        header: postStatusChangedHeader[status],
        message: postStatusChangedMessage(status, this.post.title),
        buttons: [],
      });
    });
  }

  private async deletePost(): Promise<void> {
    const result = await this.alertService.presentAlert({
      header: 'Are you sure you want to delete this post?',
      message: 'This action cannot be undone. Please proceed with caution.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          role: 'confirm',
          cssClass: 'danger',
        },
      ],
    });

    if (result.role === 'confirm') {
      const post = cloneDeep(this.post);
      this.postsService.delete(this.post.id).subscribe({
        next: () => {
          this.postDeleted.emit({ post });
          this.toastService.presentToast({
            message: 'Post has been successfully deleted',
          });
        },
      });
    }
  }

  public showOptions(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.isActionsOpen = true;
  }

  public preventClick(ev: Event): void {
    ev.stopPropagation();
  }

  private buildEwerTile(): EwerTileSummary | undefined {
    const fields = this.getFields();
    if (!fields.length) return undefined;

    const incidentType = this.getFieldDisplay(fields, ['Incidence_type', 'Incidence type']);
    const state = this.getFieldDisplay(fields, [
      '_2_State_where_incidence_occurred',
      'State where incidence occurred',
      'Region where incidence occurred',
    ]);
    const city = this.getFieldDisplay(fields, [
      '_2a_City_where_incidence_occurred',
      'City where incidence occurred',
      'District where incidence occurred',
    ]);
    const site = this.getFieldDisplay(fields, [
      '_2b_Ward_Site_where_e_area_or_zone_etc',
      'Ward/Site where the Incidence Occurred? Specific description of the incident/conflict site like ward name, area or zone, etc',
      'Village where incidence occurred',
    ]);
    const monitorCode = this.getFieldDisplay(fields, [
      '_1_Field_Monitor_Code',
      'Field Monitor Code',
    ]);

    if (!incidentType && !state && !city && !site && !monitorCode) return undefined;

    const escalation = this.getFieldDisplay(fields, [
      '_12_Are_there_escalation_indic',
      'Are there escalation indicators',
    ]);
    const response = this.getFieldDisplay(fields, [
      '_10_Has_any_response_happened',
      'Has any response happened?',
      'Has the victim/survivor been reached and supported/referred?',
    ]);
    const status = this.getFieldDisplay(fields, [
      '_6_What_is_the_statu_situation_indicator',
      'What is the status of the situation/indicator?',
      'What is the status of the incident?',
    ]);
    const actors = this.getFieldDisplay(fields, [
      '_9_Who_are_the_actors_involved',
      '_10a_Who_are_the_actors_respon',
      'Who are the actors involved in the incidence (Perpetrators or contributors to the conflict)',
      'Who are the actors responding to the situation on the ground?',
    ]);
    const sourceCount = this.getFieldValueCount(fields, [
      '_8_What_are_the_sources_of_inf',
      'What are the sources of information?',
    ]);

    const escalationRisk = this.isAffirmative(escalation);
    const responseActive = this.isAffirmative(response);

    return {
      incidentType: incidentType || this.post?.title || 'Incident',
      escalationLabel: escalationRisk ? 'Escalation risk' : 'No escalation',
      escalationRisk,
      location: [city, state].filter(Boolean).join(', ') || city || state || 'Location unavailable',
      site,
      status,
      sourcesLabel: sourceCount
        ? `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`
        : undefined,
      actors,
      responseLabel: responseActive ? 'Response active' : 'No response yet',
      responseActive,
      monitorCode,
      hasMedia: !!fields.find(
        (field) =>
          (field.input === 'upload' || field.type === 'media') &&
          (field.value?.photoUrl || this.getRawValue(field)),
      ),
    };
  }

  private getFields(): PostContentField[] {
    return this.post?.post_content?.flatMap((content) => content.fields || []) || [];
  }

  private getFieldDisplay(fields: PostContentField[], names: string[]): string {
    const field = this.findField(fields, names);
    return this.formatValue(this.getRawValue(field));
  }

  private getFieldValueCount(fields: PostContentField[], names: string[]): number {
    const field = this.findField(fields, names);
    const value = this.getRawValue(field);
    if (Array.isArray(value)) return value.filter(Boolean).length;
    const display = this.formatValue(value);
    if (!display) return 0;
    return display
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean).length;
  }

  private findField(fields: PostContentField[], names: string[]): PostContentField | undefined {
    const normalizedNames = names.map((name) => this.normalize(name));
    return fields.find((field) => {
      const config = field.config as any;
      const candidates = [
        field.key,
        field.label,
        config?.xlsform_name,
        config?.name,
        config?.label,
      ].map((candidate) => this.normalize(candidate));

      return normalizedNames.some((name) => candidates.includes(name));
    });
  }

  private getRawValue(field?: PostContentField): any {
    if (!field?.value) return undefined;
    const value = field.value as any;
    return value.value ?? value;
  }

  private formatValue(value: any): string {
    if (value === undefined || value === null || value === '') return '';
    if (Array.isArray(value)) {
      return value
        .map((item) => this.formatValue(item))
        .filter(Boolean)
        .join(', ');
    }
    if (typeof value === 'object') {
      return this.formatValue(value.label ?? value.name ?? value.value ?? '');
    }
    return String(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private normalize(value: any): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private isAffirmative(value: string): boolean {
    return /^(yes|true|1|y)$/i.test(value.trim());
  }
}
