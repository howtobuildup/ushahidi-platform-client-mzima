import { NgModule } from '@angular/core';
import { ActivityPage } from './activity.page';
import { SharedModule } from '@shared';
import { ActivityPageRoutingModule } from './activity-routing.module';
import { PostItemModule } from '../map/components/post-item/post-item.module';

@NgModule({
  imports: [SharedModule, ActivityPageRoutingModule, PostItemModule],
  declarations: [ActivityPage],
})
export class ActivityPageModule {}
