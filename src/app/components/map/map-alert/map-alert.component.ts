import { Component, Input, OnChanges } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
  selector: 'app-map-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-alert.component.html',
  styleUrls: ['./map-alert.component.scss']
})
export class MapAlertComponent implements OnChanges {
  @Input() resultCount: number = 0
  @Input() maxResults: number = 500
  
  isManuallyHidden: boolean = false
  
  closeAlert(): void {
    this.isManuallyHidden = true
  }
  
  // Reset manual hide when result count changes (for automatic show/hide)
  ngOnChanges(): void {
    if (this.resultCount < this.maxResults) {
      this.isManuallyHidden = false
    }
  }
}
