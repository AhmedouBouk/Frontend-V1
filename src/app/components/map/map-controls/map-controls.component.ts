import { Component, Input, Output, EventEmitter } from "@angular/core"
import { CommonModule } from "@angular/common"

@Component({
  selector: "app-map-controls",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./map-controls.component.html",
  styleUrls: ["./map-controls.component.scss"],
})
export class MapControlsComponent {
  @Input() isLoading = false
  @Output() locateUser = new EventEmitter<void>()
  @Output() toggleSidebar = new EventEmitter<void>()

  onLocateUser(): void {
    this.locateUser.emit()
  }

  onToggleSidebar(): void {
    if (!this.isLoading) {
      this.toggleSidebar.emit()
    }
  }
}
