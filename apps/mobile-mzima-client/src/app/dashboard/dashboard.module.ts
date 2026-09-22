import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { SharedModule } from '@shared';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardPage } from './dashboard.page';

@NgModule({
  declarations: [DashboardPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    NgxChartsModule,
    DashboardRoutingModule,
  ],
})
export class DashboardPageModule {}
