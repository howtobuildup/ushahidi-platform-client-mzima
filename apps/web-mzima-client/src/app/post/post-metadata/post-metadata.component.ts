import { Component, Input, OnInit } from '@angular/core';
import { PostPropertiesInterface, PostResult } from '@mzima-client/sdk';
import { EventTrackerService } from '../../core/services/event-tracker.service';
import { EventType } from '@services';

@Component({
  selector: 'app-post-metadata',
  templateUrl: './post-metadata.component.html',
  styleUrls: ['./post-metadata.component.scss'],
})
export class PostMetadataComponent implements OnInit {
  @Input() post: PostResult | PostPropertiesInterface;
  author: string;

  constructor(private eventTrackerService: EventTrackerService) {}

  ngOnInit(): void {
    this.getUsername();
    this.eventTrackerService.trigger({ action: EventType.StatusChange, updateById: true });
  }

  private getUsername(): void {
    const authorNameOrContact =
      this.post.user?.realname || this.post.contact?.contact || this.post.author_realname;

    this.author = authorNameOrContact || 'Anonymous';
  }
}
