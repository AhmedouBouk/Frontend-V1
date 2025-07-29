import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
  selector: 'app-map-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-alert.component.html',
  styleUrls: ['./map-alert.component.scss']
})
export class MapAlertComponent {
  @Input() show: boolean = false
  @Input() resultCount: number = 0
  @Input() maxResults: number = 500
}
