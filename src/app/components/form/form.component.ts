import { Component, inject, type OnInit } from "@angular/core"
import { FormBuilder, type FormGroup, ReactiveFormsModule } from "@angular/forms"
import { CommonModule } from "@angular/common"
import { FormService } from "../../services/form.service"
import { MapService } from "../../services/map.service"

type DataSourceType = "dvf" | "dpe" | "parcelles"

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
  
  // Filter toggle states
  allPriceSelected = false
  allDateSelected = false
  allSurfaceSelected = false
  allEnergySelected = false

  constructor() {
    this.filterForm = this.fb.group({
      // Source de données
      dataSource: ["dvf"],

      // Prix (DVF)
      usePriceFilter: [false],
      priceMode: ["interval"],
      price: [null],
      minPrice: [null],
      maxPrice: [null],

      // Date (DVF)
      useDateFilter: [false],
      dateMode: ["interval"],
      exactDate: [null],
      startDate: [null],
      endDate: [null],

      // Surface (Parcelle)
      useSurfaceFilter: [false],
      surfaceMode: ["interval"],
      surface: [null],
      minSurface: [null],
      maxSurface: [null],

      // Classe énergie (DPE)
      useEnergyFilter: [false],
      energyMode: ["multiple"],  // Nouveau mode: exact, interval, multiple
      exactEnergyClass: [""],    // Pour le mode exact
      minEnergyClass: ["A"],     // Pour le mode intervalle
      maxEnergyClass: ["G"],     // Pour le mode intervalle
      // Pour le mode multiple (cases à cocher)
      energyClassA: [false],
      energyClassB: [false],
      energyClassC: [false],
      energyClassD: [false],
      energyClassE: [false],
      energyClassF: [false],
      energyClassG: [false],
    })
  }

  ngOnInit(): void {
    // Exécution immédiate si l'utilisateur décoche un filtre
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

    this.filterForm.get("useSurfaceFilter")?.valueChanges.subscribe((enabled: boolean) => {
      if (!enabled) {
        this.formService.clearSurfaceFilter()
        this.mapService.refreshMap()
      }
    })

    this.filterForm.get("useEnergyFilter")?.valueChanges.subscribe((enabled: boolean) => {
      if (!enabled) {
        this.formService.clearEnergyClassFilter()
        this.mapService.refreshMap()
      }
    })

    // Changement de source de données
    this.filterForm.get("dataSource")?.valueChanges.subscribe((source: DataSourceType) => {
      this.formService.setDataSource(source)
      this.mapService.refreshMap()
    })
  }

  /**
   * Handle price filter application
   * @param values The form values
   */
  private applyPriceFilter(values: any): void {
    if (!values.usePriceFilter) {
      this.formService.clearPriceFilter()
      return
    }
    
    if (values.priceMode === "exact") {
      const val = Number(values.price)
      this.formService.setPriceFilter(val, val)
    } else {
      const min = Number(values.minPrice)
      const max = Number(values.maxPrice)
      this.formService.setPriceFilter(min, max)
    }
  }
  
  /**
   * Handle date filter application
   * @param values The form values
   */
  private applyDateFilter(values: any): void {
    if (!values.useDateFilter) {
      this.formService.clearDateFilter()
      return
    }
    
    if (values.dateMode === "exact") {
      this.formService.setDateFilter(values.exactDate, values.exactDate)
    } else {
      this.formService.setDateFilter(values.startDate, values.endDate || values.startDate)
    }
  }
  
  /**
   * Handle surface filter application
   * @param values The form values
   */
  private applySurfaceFilter(values: any): void {
    if (!values.useSurfaceFilter) {
      this.formService.clearSurfaceFilter()
      return
    }
    
    if (values.surfaceMode === "exact") {
      const val = Number(values.surface)
      this.formService.setSurfaceFilter(val, val)
    } else {
      const min = Number(values.minSurface)
      const max = Number(values.maxSurface)
      this.formService.setSurfaceFilter(min, max)
    }
  }
  
  /**
   * Handle energy class filter application
   * @param values The form values
   */
  private applyEnergyFilter(values: any): void {
    if (!values.useEnergyFilter) {
      this.formService.clearEnergyClassFilter()
      return
    }
    
    const selectedClasses = [
      values.energyClassA ? 'A' : null,
      values.energyClassB ? 'B' : null,
      values.energyClassC ? 'C' : null,
      values.energyClassD ? 'D' : null,
      values.energyClassE ? 'E' : null,
      values.energyClassF ? 'F' : null,
      values.energyClassG ? 'G' : null,
    ].filter((c): c is string => c !== null)
    
    this.formService.setSelectedEnergyClasses(selectedClasses)
  }
  
  /**
   * Apply all filters and refresh the map
   */
  search() {
    const values = this.filterForm.value
    
    // Update data source
    this.formService.setDataSource(values.dataSource)
    
    // Apply filters independently of data source
    this.applyPriceFilter(values)
    this.applyDateFilter(values)
    this.applySurfaceFilter(values)
    this.applyEnergyFilter(values)
    
    // Refresh map with new filters
    this.mapService.refreshMap()
  }

  /**
   * Toggle all price filter options
   */
  toggleAllPriceOptions(): void {
    this.allPriceSelected = !this.allPriceSelected
    
    if (this.allPriceSelected) {
      // Enable price filter with wide interval
      this.filterForm.patchValue({
        usePriceFilter: true,
        priceMode: 'interval',
        minPrice: 0,
        maxPrice: 10000000 // 10 million euros as max
      })
      
      // Apply filter immediately
      this.formService.setPriceFilter(0, 10000000)
      this.mapService.refreshMap()
    } else {
      // Reset to default
      this.filterForm.patchValue({
        minPrice: null,
        maxPrice: null
      })
    }
  }
  
  /**
   * Toggle all date filter options
   */
  toggleAllDateOptions(): void {
    this.allDateSelected = !this.allDateSelected
    
    if (this.allDateSelected) {
      // Get current date and 10 years ago for wide range
      const endDate = new Date().toISOString().split('T')[0] // Today
      const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 10)).toISOString().split('T')[0] // 10 years ago
      
      // Enable date filter with wide interval
      this.filterForm.patchValue({
        useDateFilter: true,
        dateMode: 'interval',
        startDate,
        endDate
      })
      
      // Apply filter immediately
      this.formService.setDateFilter(startDate, endDate)
      this.mapService.refreshMap()
    } else {
      // Reset to default
      this.filterForm.patchValue({
        startDate: null,
        endDate: null
      })
    }
  }
  
  /**
   * Toggle all surface filter options
   */
  toggleAllSurfaceOptions(): void {
    this.allSurfaceSelected = !this.allSurfaceSelected
    
    if (this.allSurfaceSelected) {
      // Enable surface filter with wide interval
      this.filterForm.patchValue({
        useSurfaceFilter: true,
        surfaceMode: 'interval',
        minSurface: 0,
        maxSurface: 10000 // 10,000 m² as max
      })
      
      // Apply filter immediately
      this.formService.setSurfaceFilter(0, 10000)
      this.mapService.refreshMap()
    } else {
      // Reset to default
      this.filterForm.patchValue({
        minSurface: null,
        maxSurface: null
      })
    }
  }
  
  /**
   * Toggle all energy class filter options
   */
  toggleAllEnergyOptions(): void {
    this.allEnergySelected = !this.allEnergySelected
    
    // Set all energy classes
    this.filterForm.patchValue({
      useEnergyFilter: true,
      energyClassA: this.allEnergySelected,
      energyClassB: this.allEnergySelected,
      energyClassC: this.allEnergySelected,
      energyClassD: this.allEnergySelected,
      energyClassE: this.allEnergySelected,
      energyClassF: this.allEnergySelected,
      energyClassG: this.allEnergySelected
    })
    
    if (this.allEnergySelected) {
      // Apply filter with all classes selected
      this.formService.setSelectedEnergyClasses(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
      this.mapService.refreshMap()
    } else {
      // Clear the energy filter
      this.formService.clearEnergyClassFilter()
      this.mapService.refreshMap()
    }
  }
  
  resetFilters(): void {
    // Reset toggle states
    this.allPriceSelected = false
    this.allDateSelected = false
    this.allSurfaceSelected = false
    this.allEnergySelected = false
    
    this.filterForm.patchValue({
      dataSource: "dvf",

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

      useSurfaceFilter: false,
      surfaceMode: "interval",
      surface: null,
      minSurface: null,
      maxSurface: null,

      useEnergyFilter: false,
      energyFilterMode: "class",
      energyClassA: false,
      energyClassB: false,
      energyClassC: false,
      energyClassD: false,
      energyClassE: false,
      energyClassF: false,
      energyClassG: false,
    })

    this.formService.clearPriceFilter()
    this.formService.clearDateFilter()
    this.formService.clearSurfaceFilter()
    this.formService.clearEnergyClassFilter()
    this.formService.setDataSource("dvf")

    // Déclencher le refresh de la carte
    this.mapService.refreshMap()
  }
}
