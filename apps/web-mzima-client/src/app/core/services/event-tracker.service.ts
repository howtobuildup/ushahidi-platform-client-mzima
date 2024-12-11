import { Injectable, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EventBusService, EventType } from './event-bus.service';

@UntilDestroy()
@Injectable({
  providedIn: 'root',
})
export class EventTrackerService implements OnInit {
  public action: EventType;
  public response: any;
  public updateById: boolean | undefined;
  constructor(private eventBusService: EventBusService) {}

  // eslint-disable-next-line @angular-eslint/contextual-lifecycle
  ngOnInit() {
    console.log('OnInit: Let my people go...');
    // this.emit({ payload })
    // this.trigger({ action: this.action, updateById: this.updateById });
  }

  // setTrigger({ action, updateById }: { action: EventType; updateById?: boolean }) {

  // }

  public trigger({ action, updateById }: { action: EventType; updateById?: boolean }) {
    this.action = action;
    this.updateById = updateById;

    this.eventBusService
      .on(this.action)
      .pipe(untilDestroyed(this))
      .subscribe({
        next: (response) => {
          console.log(response);
          console.log(this.action);
          this.action = action;
          this.response = response;
          this.updateById = updateById;
          const setResponse = () => (this.response = response);
          if (updateById) {
            if (this.response.id === response.id) setResponse();
          } else {
            setResponse();
          }
        },
      });
  }

  public emit({ payload }: { payload: any }) {
    console.log(this.action, payload);
    this.eventBusService.next({
      type: this.action,
      payload,
    });
  }
}
