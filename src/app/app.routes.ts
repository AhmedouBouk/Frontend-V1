import type { Routes } from "@angular/router"
import { MapComponent } from "./components/map/map.component"

export const routes: Routes = [
  { path: "", component: MapComponent },
  { path: "**", redirectTo: "" },
]
