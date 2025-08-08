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
  allConsumptionSelected = false

  // Section visibility states for chevrons (all start as false = closed)
  priceExpanded = false
  dateExpanded = false
  surfaceExpanded = false
  energyExpanded = false
  consumptionExpanded = false

  // Marker visibility state
  markersVisible = false

  // Loading states for each filter
  priceLoading = false
  dateLoading = false
  surfaceLoading = false
  energyLoading = false
  consumptionLoading = false

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

      // Classe énergie (DPE) - Seulement les classes A-G
      useEnergyFilter: [false],
      energyClassA: [false],
      energyClassB: [false],
      energyClassC: [false],
      energyClassD: [false],
      energyClassE: [false],
      energyClassF: [false],
      energyClassG: [false],

      // Consommation énergétique (DPE) - Valeurs kWh/m²/an
      useConsumptionFilter: [false],
      consumptionMode: ["interval"],
      exactConsumption: [null],
      minConsumption: [null],
      maxConsumption: [null],
    })
  }

  ngOnInit(): void {
    // Auto-trigger search when filters are enabled/disabled
    this.filterForm.get("usePriceFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setPriceToggle(enabled)
      
      if (!enabled) {
        this.formService.clearPriceFilter()
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        // Set markers visible and trigger search immediately with default values
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Trigger search with current form values (or defaults)
        setTimeout(() => this.search(), 100)
      }
    })

    this.filterForm.get("useDateFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setDateToggle(enabled)
      
      if (!enabled) {
        this.formService.clearDateFilter()
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Trigger search with current form values (or defaults)
        setTimeout(() => this.search(), 100)
      }
    })

    this.filterForm.get("useSurfaceFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setSurfaceToggle(enabled)
      
      if (!enabled) {
        this.formService.clearSurfaceFilter()
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Trigger search with current form values (or defaults)
        setTimeout(() => this.search(), 100)
      }
    })

    this.filterForm.get("useEnergyFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setEnergyToggle(enabled)
      
      if (!enabled) {
        this.formService.clearEnergyClassFilter()
        this.mapService.refreshMap()
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        setTimeout(() => this.search(), 100)
      }
    })

    this.filterForm.get("useConsumptionFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setConsumptionToggle(enabled)
      
      if (!enabled) {
        this.formService.clearConsumptionFilter()
        this.mapService.refreshMap()
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        setTimeout(() => this.search(), 100)
      }
    })

    // Update data source and trigger search if any filters are active
    this.filterForm.get("dataSource")?.valueChanges.subscribe((source: DataSourceType) => {
      this.formService.setDataSource(source)
      if (this.hasActiveFilters()) {
        setTimeout(() => this.search(), 100)
      }
    })

    // Listen for value changes in input fields to trigger automatic search
    this.setupValueChangeListeners()
  }

  /**
   * Setup listeners for input field changes to trigger automatic search
   */
  private setupValueChangeListeners(): void {
    // Price filter value changes
    this.filterForm.get('price')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('usePriceFilter')?.value && this.filterForm.get('priceMode')?.value === 'exact' && value) {
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('minPrice')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('usePriceFilter')?.value && this.filterForm.get('priceMode')?.value === 'interval' && value && this.filterForm.get('maxPrice')?.value) {
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('maxPrice')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('usePriceFilter')?.value && this.filterForm.get('priceMode')?.value === 'interval' && value && this.filterForm.get('minPrice')?.value) {
        
        setTimeout(() => this.search(), 300)
      }
    })

    // Date filter value changes
    this.filterForm.get('exactDate')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useDateFilter')?.value && this.filterForm.get('dateMode')?.value === 'exact' && value) {
        
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('startDate')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useDateFilter')?.value && this.filterForm.get('dateMode')?.value === 'interval' && value && this.filterForm.get('endDate')?.value) {
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('endDate')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useDateFilter')?.value && this.filterForm.get('dateMode')?.value === 'interval' && value && this.filterForm.get('startDate')?.value) {
        setTimeout(() => this.search(), 300)
      }
    })

    // Surface filter value changes
    this.filterForm.get('surface')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useSurfaceFilter')?.value && this.filterForm.get('surfaceMode')?.value === 'exact' && value) {
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('minSurface')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useSurfaceFilter')?.value && this.filterForm.get('surfaceMode')?.value === 'interval' && value && this.filterForm.get('maxSurface')?.value) {
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('maxSurface')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useSurfaceFilter')?.value && this.filterForm.get('surfaceMode')?.value === 'interval' && value && this.filterForm.get('minSurface')?.value) {
        setTimeout(() => this.search(), 300)
      }
    })

    // Consumption filter value changes
    this.filterForm.get('exactConsumption')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useConsumptionFilter')?.value && this.filterForm.get('consumptionMode')?.value === 'exact' && value) {
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('minConsumption')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useConsumptionFilter')?.value && this.filterForm.get('consumptionMode')?.value === 'interval' && value && this.filterForm.get('maxConsumption')?.value) {
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('maxConsumption')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useConsumptionFilter')?.value && this.filterForm.get('consumptionMode')?.value === 'interval' && value && this.filterForm.get('minConsumption')?.value) {
        setTimeout(() => this.search(), 300)
      }
    })

    // Energy class checkboxes - trigger search when any checkbox changes
    const energyClasses = ['energyClassA', 'energyClassB', 'energyClassC', 'energyClassD', 'energyClassE', 'energyClassF', 'energyClassG']
    energyClasses.forEach(className => {
      this.filterForm.get(className)?.valueChanges.subscribe((checked) => {
        if (this.filterForm.get('useEnergyFilter')?.value && checked) {
          setTimeout(() => this.search(), 300)
        }
      })
    })

    // Subscribe to loading states
    this.formService.getPriceLoadingObservable().subscribe(loading => {
      this.priceLoading = loading
    })

    this.formService.getDateLoadingObservable().subscribe(loading => {
      this.dateLoading = loading
    })

    this.formService.getSurfaceLoadingObservable().subscribe(loading => {
      this.surfaceLoading = loading
    })

    this.formService.getEnergyLoadingObservable().subscribe(loading => {
      this.energyLoading = loading
    })

    this.formService.getConsumptionLoadingObservable().subscribe(loading => {
      this.consumptionLoading = loading
    })
  }

  // Chevron toggle methods - independent of filter activation
  togglePriceExpanded(): void {
    this.priceExpanded = !this.priceExpanded
  }

  toggleDateExpanded(): void {
    this.dateExpanded = !this.dateExpanded
  }

  toggleSurfaceExpanded(): void {
    this.surfaceExpanded = !this.surfaceExpanded
  }

  toggleEnergyExpanded(): void {
    this.energyExpanded = !this.energyExpanded
  }

  toggleConsumptionExpanded(): void {
    this.consumptionExpanded = !this.consumptionExpanded
  }

  /**
   * Handle price filter application
   */
  private applyPriceFilter(values: any): void {
    if (!values.usePriceFilter) {
      this.formService.clearPriceFilter()
      return
    }

    if (values.priceMode === "exact") {
      // Use user value if provided, otherwise default to 0
      const val = values.price ? Number(values.price) : 0
      this.formService.setPriceFilter(val, val)
    } else {
      // Use user values if provided, otherwise use defaults
      const min = values.minPrice ? Number(values.minPrice) : 0
      const max = values.maxPrice ? Number(values.maxPrice) : 2000000
      this.formService.setPriceFilter(min, max)
    }
  }

  /**
   * Handle date filter application
   */
  private applyDateFilter(values: any): void {
    if (!values.useDateFilter) {
      this.formService.clearDateFilter()
      return
    }

    if (values.dateMode === "exact") {
      const date = values.exactDate || '2020-01-01' // Default date if empty
      this.formService.setDateFilter(date, date)
    } else {
      const startDate = values.startDate || '2020-01-01' // Default start date
      const endDate = values.endDate || '2023-12-31' // Default end date
      this.formService.setDateFilter(startDate, endDate)
    }
  }

  /**
   * Handle surface filter application
   */
  private applySurfaceFilter(values: any): void {
    if (!values.useSurfaceFilter) {
      this.formService.clearSurfaceFilter()
      return
    }

    if (values.surfaceMode === "exact") {
      // Use user value if provided, otherwise default to 0
      const val = values.surface ? Number(values.surface) : 0
      this.formService.setSurfaceFilter(val, val)
    } else {
      // Use user values if provided, otherwise use defaults
      const min = values.minSurface ? Number(values.minSurface) : 0
      const max = values.maxSurface ? Number(values.maxSurface) : 10000
      this.formService.setSurfaceFilter(min, max)
    }
  }

  /**
   * Handle energy class filter application
   */
  private applyEnergyFilter(values: any): void {
    if (!values.useEnergyFilter) {
      this.formService.clearEnergyClassFilter()
      return
    }

    const selectedClasses = [
      values.energyClassA ? "A" : null,
      values.energyClassB ? "B" : null,
      values.energyClassC ? "C" : null,
      values.energyClassD ? "D" : null,
      values.energyClassE ? "E" : null,
      values.energyClassF ? "F" : null,
      values.energyClassG ? "G" : null,
    ].filter((c): c is string => c !== null)

    this.formService.setSelectedEnergyClasses(selectedClasses)
  }

  /**
   * Handle consumption filter application
   */
  private applyConsumptionFilter(values: any): void {
    if (!values.useConsumptionFilter) {
      this.formService.clearConsumptionFilter()
      return
    }

    if (values.consumptionMode === "exact") {
      // Use user value if provided, otherwise default to 0
      const val = values.exactConsumption ? Number(values.exactConsumption) : 0
      this.formService.setConsumptionFilter(val, val)
    } else {
      // Use user values if provided, otherwise use defaults
      const min = values.minConsumption ? Number(values.minConsumption) : 0
      const max = values.maxConsumption ? Number(values.maxConsumption) : 1000
      this.formService.setConsumptionFilter(min, max)
    }
  }

  /**
   * Apply all filters and refresh the map with multiple data sources support
   */
  search() {
    const values = this.filterForm.value
  
    // Apply all active filters - the map component will determine which data sources to load
    this.applyPriceFilter(values)
    this.applyDateFilter(values)
    this.applySurfaceFilter(values)
    this.applyEnergyFilter(values)
    this.applyConsumptionFilter(values)

    // Set markers as visible since we're searching
    this.markersVisible = true

    // Refresh map - it will automatically load the appropriate data sources based on active filters
    this.mapService.refreshMap()
  }

  /**
   * Toggle all price filter options
   */
  toggleAllPriceOptions(): void {
    this.allPriceSelected = !this.allPriceSelected

    if (this.allPriceSelected) {
      this.filterForm.patchValue({
        usePriceFilter: true,
        priceMode: "interval",
        minPrice: 0,
        maxPrice: 2000000,
      })
      // Apply the filter with default values immediately
      this.applyPriceFilter(this.filterForm.value)
    } else {
      this.filterForm.patchValue({
        usePriceFilter: false,
        minPrice: null,
        maxPrice: null,
      })
      // Clear the filter immediately
      this.formService.clearPriceFilter()
    }
  }

  /**
   * Toggle all date filter options
   */
  toggleAllDateOptions(): void {
    this.allDateSelected = !this.allDateSelected

    if (this.allDateSelected) {
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 3)).toISOString().split("T")[0]

      this.filterForm.patchValue({
        useDateFilter: true,
        dateMode: "interval",
        startDate,
        endDate,
      })
      // Apply the filter with default values immediately
      this.applyDateFilter(this.filterForm.value)
    } else {
      this.filterForm.patchValue({
        useDateFilter: false,
        startDate: null,
        endDate: null,
      })
      // Clear the filter immediately
      this.formService.clearDateFilter()
    }
  }

  /**
   * Toggle all surface filter options
   */
  toggleAllSurfaceOptions(): void {
    this.allSurfaceSelected = !this.allSurfaceSelected

    if (this.allSurfaceSelected) {
      this.filterForm.patchValue({
        useSurfaceFilter: true,
        surfaceMode: "interval",
        minSurface: 0,
        maxSurface: 10000,
      })
      // Apply the filter with default values immediately
      this.applySurfaceFilter(this.filterForm.value)
    } else {
      this.filterForm.patchValue({
        useSurfaceFilter: false,
        minSurface: null,
        maxSurface: null,
      })
      // Clear the filter immediately
      this.formService.clearSurfaceFilter()
    }
  }

  /**
   * Toggle all energy class filter options
   */
  toggleAllEnergyOptions(): void {
    this.allEnergySelected = !this.allEnergySelected

    this.filterForm.patchValue({
      useEnergyFilter: this.allEnergySelected,
      energyClassA: this.allEnergySelected,
      energyClassB: this.allEnergySelected,
      energyClassC: this.allEnergySelected,
      energyClassD: this.allEnergySelected,
      energyClassE: this.allEnergySelected,
      energyClassF: this.allEnergySelected,
      energyClassG: this.allEnergySelected,
    })

    if (this.allEnergySelected) {
      // Apply the filter with all classes selected immediately
      this.applyEnergyFilter(this.filterForm.value)
    } else {
      // Clear the filter immediately
      this.formService.clearEnergyClassFilter()
    }
  }

  /**
   * Toggle all consumption filter options
   */
  toggleAllConsumptionOptions(): void {
    this.allConsumptionSelected = !this.allConsumptionSelected

    if (this.allConsumptionSelected) {
      this.filterForm.patchValue({
        useConsumptionFilter: true,
        consumptionMode: "interval",
        minConsumption: 0,
        maxConsumption: 1000,
      })
      // Apply the filter with default values immediately
      this.applyConsumptionFilter(this.filterForm.value)
    } else {
      this.filterForm.patchValue({
        useConsumptionFilter: false,
        minConsumption: null,
        maxConsumption: null,
      })
      // Clear the filter immediately
      this.formService.clearConsumptionFilter()
    }
  }

  /**
   * Check if any filters are currently active
   */
  hasActiveFilters(): boolean {
    return this.filterForm.get('usePriceFilter')?.value ||
           this.filterForm.get('useDateFilter')?.value ||
           this.filterForm.get('useSurfaceFilter')?.value ||
           this.filterForm.get('useEnergyFilter')?.value ||
           this.filterForm.get('useConsumptionFilter')?.value
  }

  /**
   * Toggle markers visibility on the map
   */
  toggleMarkers(): void {
    this.markersVisible = !this.markersVisible
    
    // Update the FormService with the new state
    this.formService.setMarkersVisible(this.markersVisible)
    
    if (this.markersVisible) {
      // Show markers with current active filters
      if (this.hasActiveFilters()) {
        this.search()
      } else {
      }
    } else {
      // Just hide markers without clearing filters - clear map data only
      this.mapService.refreshMap()
    }
  }

  resetFilters(): void {
    // Reset toggle states
    this.allPriceSelected = false
    this.allDateSelected = false
    this.allSurfaceSelected = false
    this.allEnergySelected = false
    this.allConsumptionSelected = false
    this.markersVisible = false

    // Reset expansion states
    this.priceExpanded = false
    this.dateExpanded = false
    this.surfaceExpanded = false
    this.energyExpanded = false
    this.consumptionExpanded = false

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
      energyClassA: false,
      energyClassB: false,
      energyClassC: false,
      energyClassD: false,
      energyClassE: false,
      energyClassF: false,
      energyClassG: false,
      useConsumptionFilter: false,
      consumptionMode: "interval",
      exactConsumption: null,
      minConsumption: null,
      maxConsumption: null,
    })

    this.formService.clearPriceFilter()
    this.formService.clearDateFilter()
    this.formService.clearSurfaceFilter()
    this.formService.clearEnergyClassFilter()
    this.formService.clearConsumptionFilter()
    this.formService.setDataSource("dvf")
  }
}
