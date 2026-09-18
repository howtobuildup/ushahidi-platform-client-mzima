import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateAgoPipe, FieldLabelPipe, FilterValuePipe } from '@pipes';

@NgModule({
  declarations: [DateAgoPipe, FieldLabelPipe, FilterValuePipe],
  imports: [CommonModule],
  exports: [DateAgoPipe, FieldLabelPipe, FilterValuePipe],
})
export class PipeModule {}
