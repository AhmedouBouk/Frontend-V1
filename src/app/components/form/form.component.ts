import { Component, inject, type OnInit } from "@angular/core"
import { FormBuilder, type FormGroup, ReactiveFormsModule } from "@angular/forms"
import { CommonModule } from "@angular/common"
import { FormService } from "../../services/form.service"
import { MapService } from "../../services/map.service"
import { AppComponent } from "../../app.component"

@Component({
  selector: "app-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./form.component.html",
  styleUrls: ["./form.component.scss"],
})
export class FormComponent implements OnInit {
  filterForm: FormGroup
  private readonly fb = inject(FormBuilder)
  private readonly formService = inject(FormService)
  private readonly mapService = inject(MapService)
  private readonly appComponent = inject(AppComponent)

  constructor() {
    this.filterForm = this.fb.group({
      // Prix
      usePriceFilter: [false],
      priceMode: ["interval"],
      price: [null],
      minPrice: [null],
      maxPrice: [null],

      // Date
      useDateFilter: [false],
      dateMode: ["interval"],
      exactDate: [null],
      startDate: [null],
      endDate: [null],

      
      
    })
  }
  ngOnInit(): void {
    // ⚠️ Exécution immédiate si l'utilisateur décoche un filtre sans cliquer sur "Rechercher"
  
    this.filterForm.get("usePriceFilter")?.valueChanges.subscribe((enabled: boolean) => {
      if (!enabled) {
        this.formService.clearPriceFilter()
        this.mapService.refreshMap()
      }
    })
  
    this.filterForm.get("useDateFilter")?.valueChanges.subscribe((enabled: boolean) => {
      if (!enabled) {
        this.formService.clearDateFilter()
        this.mapService.refreshMap()
      }
    })
  
    
  }
  

  search(): void {
    const values = this.filterForm.value

    // Filtre de prix
    if (values.usePriceFilter) {
      if (values.priceMode === "exact") {
        const val = Number(values.price)
        this.formService.setPriceFilter(val, val)
      } else {
        const min = Number(values.minPrice)
        const max = Number(values.maxPrice)
        this.formService.setPriceFilter(min, max)
      }
    } else {
      this.formService.clearPriceFilter()
    }

    // Filtre de date
    if (values.useDateFilter) {
      if (values.dateMode === "exact") {
        const date = values.exactDate
        this.formService.setDateFilter(date, date)
      } else {
        const start = values.startDate
        const end = values.endDate || start
        this.formService.setDateFilter(start, end)
      }
    } else {
      this.formService.clearDateFilter()
    }

    

    // Déclencher le refresh de la carte
    this.mapService.refreshMap()

    // Fermer la sidebar sur mobile après une recherche
    if (window.innerWidth <= 768) {
      this.appComponent.sidebarOpen = false
    }
  }

  resetFilters(): void {
    this.filterForm.patchValue({
      usePriceFilter: false,
      priceMode: "interval",
      price: null,
      minPrice: null,
      maxPrice: null,

      useDateFilter: false,
      dateMode: "interval",
      exactDate: null,
      startDate: null,
      endDate: null,

      
    })

    this.formService.clearPriceFilter()
    this.formService.clearDateFilter()
    

    // Déclencher le refresh de la carte
    this.mapService.refreshMap()
  }
}
