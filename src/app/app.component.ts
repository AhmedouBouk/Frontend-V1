import { Component, inject } from "@angular/core"
import { CommonModule } from "@angular/common"
import { RouterOutlet } from "@angular/router"
import { FormComponent } from "./components/form/form.component"
import { MapService } from "./services/map.service"
import { MapComponent } from "./components/map/map.component"

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormComponent, MapComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  sidebarOpen = false
  mapType = "street"

  private readonly mapService = inject(MapService)

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen
  }

  setMapType(type: "street" | "satellite" | "cadastre"): void {
    this.mapType = type
    this.mapService.setMapType(type)
  }

  centerMap(): void {
    this.mapService.centerMap()
  }
}
