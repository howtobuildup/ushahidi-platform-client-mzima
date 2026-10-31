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
  SurveyItem,
  SurveysService,
  xlsFormRules,
} from '@mzima-client/sdk';
import {
  getPostItemActions,
  PostItemActionType,
  PostItemActionTypeUserRole,
  postStatusChangedHeader,
  postStatusChangedMessage,
  STORAGE_KEYS,
} from '@constants';
import { ActionSheetButton, ModalController } from '@ionic/angular';
import {
  AlertService,
  DatabaseService,
  DeploymentService,
  NetworkService,
  SessionService,
  ShareService,
  ToastService,
} from '@services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { cloneDeep } from 'lodash';
import { Subscription } from 'rxjs';
import { CollectionsModalComponent } from '../../../shared/components';
import { Router } from '@angular/router';

// The words a location question starts with, in English and in Somali: gobol
// is a region, degmo a district, tuulo a village, xaafad a neighbourhood,
// magaalo a town and deegaan a locality.
const PLACE_WORD =
  /^(region|district|village|ward|site|location|state|city|county|subcounty|zone|area|settlement|town|locality|neighbou?rhood|gob[ao]l\w*|degm\w*|tuul\w*|xaa?fad\w*|magaal\w*|deegaan\w*)$/;

interface PostTileSummary {
  // Survey data, shown as it came when no translation matches it.
  incidentType: string;
  incidentTypeKey: string;
  // The keys are empty when the survey does not ask, so the tile leaves the
  // pill off rather than claiming there is no escalation or response.
  escalationLabelKey: string;
  escalationRisk: boolean;
  location: string;
  locationKey: string;
  site?: string;
  status?: string;
  sourcesCount: number;
  actors?: string;
  responseLabelKey: string;
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
  public isMediaLoading: boolean;
  public isActionsOpen = false;
  public actionSheetButtons?: ActionSheetButton[] = getPostItemActions();
  public isConnection = true;
  // Every post gets this tile, whichever survey it is from.
  public tile?: PostTileSummary;
  public surveyName = '';
  private surveyNameSubscription?: Subscription;

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
    private surveysService: SurveysService,
    private databaseService: DatabaseService,
  ) {}

  async ionViewWillEnter() {
    await this.checkNetwork();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['post']) {
      this.buildTile();
    }
  }

  ngOnInit(): void {
    this.buildTile();

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
      this.buildTile();
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

  /** The post's title, when it says more than its survey's name. */
  public get tileTitle(): string {
    const title = (this.post?.title ?? '').trim();
    return title.toLowerCase() === this.surveyName.trim().toLowerCase() ? '' : title;
  }

  /** Translation key for a post under review or archived; empty once published. */
  public get reviewStatusKey(): string {
    const keys: Record<string, string> = { draft: 'post.draft', archived: 'post.archived' };
    return keys[this.post?.status ?? ''] ?? '';
  }

  private buildTile(): void {
    this.tile = this.post ? this.buildTileSummary() : undefined;
    this.loadSurveyName();
  }

  /**
   * The survey's name from the server or, offline, from the copy of the
   * survey list the app keeps.
   */
  private loadSurveyName(): void {
    const formId = this.post?.form_id;
    this.surveyNameSubscription?.unsubscribe();
    this.surveyName = '';
    if (!formId) return;

    this.surveyNameSubscription = this.surveysService
      .getSurveyName(formId)
      .pipe(untilDestroyed(this))
      .subscribe(async (name) => {
        if (!name) {
          const surveys: SurveyItem[] =
            (await this.databaseService.get(STORAGE_KEYS.SURVEYS)) ?? [];
          name = surveys.find((survey) => survey.id === formId)?.name ?? '';
        }
        if (this.post?.form_id === formId) this.surveyName = name;
      });
  }

  private buildTileSummary(): PostTileSummary {
    const fields = this.getFields();

    const incidentType = this.getFieldDisplay(fields, ['Incidence_type', 'Incidence type']);
    const monitorCode = this.getFieldDisplay(fields, [
      '_1_Field_Monitor_Code',
      'Field Monitor Code',
    ]);
    const escalation = this.findField(fields, [
      '_12_Are_there_escalation_indic',
      'Are there escalation indicators',
    ]);
    const response = this.findField(fields, [
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

    const escalationRisk = this.isAffirmative(this.formatValue(this.getRawValue(escalation)));
    const responseActive = this.isAffirmative(this.formatValue(this.getRawValue(response)));
    const { location, site } = this.buildPlace(fields);

    return {
      // Held as keys so the tile follows a language change. The incident type
      // is survey data, so it resolves against the same keys the dashboard
      // uses and falls back to the label the survey gave.
      incidentType,
      incidentTypeKey: this.incidentTypeKey(incidentType),
      escalationLabelKey: !escalation
        ? ''
        : escalationRisk
        ? 'post.tile.escalation_risk'
        : 'post.tile.no_escalation',
      escalationRisk,
      location,
      locationKey: location ? '' : 'post.tile.no_location',
      site,
      status,
      sourcesCount: sourceCount || 0,
      actors,
      responseLabelKey: !response
        ? ''
        : responseActive
        ? 'post.tile.response_active'
        : 'post.tile.no_response',
      responseActive,
      monitorCode,
      hasMedia: !!fields.find(
        (field) =>
          (field.input === 'upload' || field.type === 'media') &&
          (field.value?.photoUrl || this.getRawValue(field)),
      ),
    };
  }

  /**
   * Where the post happened: the district and region as the heading, and the
   * village or site under it.
   *
   * EWER names its location questions. Other surveys name theirs as they
   * like, so for those this takes the questions whose label or XLSForm name
   * starts with a word for a place, in the order the survey asks them (region,
   * district, village). A survey that only asks for a GPS point gives its
   * coordinates.
   */
  private buildPlace(fields: PostContentField[]): { location: string; site: string } {
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
    if (state || city || site) {
      return { location: [city, state].filter(Boolean).join(', '), site };
    }

    const [region, district, village] = fields
      .filter((field) => this.isPlaceField(field))
      .map((field) => this.choiceLabel(field, this.getRawValue(field)))
      .filter((value) => value && value.length <= 60 && !/^(yes|no)$/i.test(value));
    if (region) {
      return { location: [district, region].filter(Boolean).join(', '), site: village ?? '' };
    }

    const point = fields
      .filter((field) => field.input === 'location')
      .map((field) => this.getRawValue(field))
      .find((value) => value?.lat !== undefined && value?.lon !== undefined);
    return {
      location: point ? `${(+point.lat).toFixed(4)}, ${(+point.lon).toFixed(4)}` : '',
      site: '',
    };
  }

  private isPlaceField(field: PostContentField): boolean {
    if (!['select', 'radio', 'text'].includes(field.input)) return false;
    const config = field.config as any;
    return [field.label, config?.xlsform_name].some((name) => {
      // The first word that is not a question number: "_2a_City_where..." is a city.
      const firstWord = String(name ?? '')
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .find((word) => /^[a-z]/.test(word));
      return !!firstWord && PLACE_WORD.test(firstWord);
    });
  }

  /**
   * The label of the option a choice answer names. Answers from the app hold
   * the option's name, "goob", where the survey shows "Goob".
   */
  private choiceLabel(field: PostContentField, value: any): string {
    let options = (field as any).options;
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch {
        options = [];
      }
    }
    const option = Array.isArray(options)
      ? options.find(
          (candidate) => String(xlsFormRules.getOptionValue(candidate)) === String(value),
        )
      : undefined;
    return option !== undefined ? xlsFormRules.getOptionLabel(option) : this.formatValue(value);
  }

  /**
   * Translation key for an incident type, or empty when there is none.
   *
   * The value is whatever the survey recorded, so anything unrecognised keeps
   * that label rather than being guessed at.
   */
  private incidentTypeKey(value: string): string {
    const keys: Record<string, string> = {
      conflicts: 'dashboard.categories.conflict',
      clan_community_instigated: 'dashboard.categories.conflict',
      gender_based_violence: 'dashboard.categories.gbv',
      gbv: 'dashboard.categories.gbv',
      social_violence: 'dashboard.categories.social',
      social_other_violence: 'dashboard.categories.social',
      early_warning: 'dashboard.categories.early_warning',
      environmental_and_climate_early_warning: 'dashboard.categories.environmental_climate',
      environmental_climate_change_related: 'dashboard.categories.environmental_climate',
    };
    const normalized = (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return keys[normalized] || '';
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
