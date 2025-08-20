import { Component, Input, type OnChanges } from "@angular/core"
import { CommonModule } from "@angular/common"

@Component({
  selector: "app-map-alert",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./map-alert.component.html",
  styleUrls: ["./map-alert.component.scss"],
})
export class MapAlertComponent implements OnChanges {
  @Input() resultCount = 0
  @Input() maxResults = 500
  @Input() activeFilters: string[] = []

  isManuallyHidden = false

  closeAlert(): void {
    this.isManuallyHidden = true
  }

  getFilterText(): string {
    if (this.activeFilters.length === 0) return ""

    if (this.activeFilters.length === 1) {
      return `filtre ${this.activeFilters[0]}`
    } else if (this.activeFilters.length === 2) {
      return `filtres ${this.activeFilters.join(" et ")}`
    } else {
      const lastFilter = this.activeFilters[this.activeFilters.length - 1]
      const otherFilters = this.activeFilters.slice(0, -1).join(", ")
      return `filtres ${otherFilters} et ${lastFilter}`
    }
  }

  // Reset manual hide when result count changes (for automatic show/hide)
  ngOnChanges(): void {
    if (this.resultCount < this.maxResults) {
      this.isManuallyHidden = false
    }
  }
}
