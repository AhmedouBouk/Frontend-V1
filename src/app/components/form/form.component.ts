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
        console.log('💰 Prix filter disabled - clearing data and refreshing map')
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        console.log('💰 Prix filter enabled - triggering search with default values')
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
        console.log('📅 Date filter disabled - clearing data and refreshing map')
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        console.log('📅 Date filter enabled - triggering search with default values')
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
        console.log('📐 Surface filter disabled - clearing data and refreshing map')
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        console.log('📐 Surface filter enabled - triggering search with default values')
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
        console.log('⚡ Energy filter disabled - clearing data and refreshing map')
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        console.log('⚡ Energy filter enabled - can search immediately (uses checkboxes)')
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Energy filter can search immediately since it uses checkboxes
        setTimeout(() => this.search(), 100)
      }
    })

    this.filterForm.get("useConsumptionFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setConsumptionToggle(enabled)
      
      if (!enabled) {
        this.formService.clearConsumptionFilter()
        console.log('🔥 Consumption filter disabled - clearing data and refreshing map')
        // Trigger map refresh to remove markers for this filter
        this.mapService.refreshMap()
      } else {
        console.log('🔥 Consumption filter enabled - triggering search with default values')
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Trigger search with current form values (or defaults)
        setTimeout(() => this.search(), 100)
      }
    })

    // Update data source and trigger search if any filters are active
    this.filterForm.get("dataSource")?.valueChanges.subscribe((source: DataSourceType) => {
      this.formService.setDataSource(source)
      // If any filters are active, trigger search for the new data source
      if (this.hasActiveFilters()) {
        console.log(`📊 Data source changed to ${source} with active filters - triggering search`)
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
        console.log('💰 Prix exact value entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('minPrice')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('usePriceFilter')?.value && this.filterForm.get('priceMode')?.value === 'interval' && value && this.filterForm.get('maxPrice')?.value) {
        console.log('💰 Prix interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('maxPrice')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('usePriceFilter')?.value && this.filterForm.get('priceMode')?.value === 'interval' && value && this.filterForm.get('minPrice')?.value) {
        console.log('💰 Prix interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    // Date filter value changes
    this.filterForm.get('exactDate')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useDateFilter')?.value && this.filterForm.get('dateMode')?.value === 'exact' && value) {
        console.log('📅 Date exact value entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('startDate')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useDateFilter')?.value && this.filterForm.get('dateMode')?.value === 'interval' && value && this.filterForm.get('endDate')?.value) {
        console.log('📅 Date interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('endDate')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useDateFilter')?.value && this.filterForm.get('dateMode')?.value === 'interval' && value && this.filterForm.get('startDate')?.value) {
        console.log('📅 Date interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    // Surface filter value changes
    this.filterForm.get('surface')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useSurfaceFilter')?.value && this.filterForm.get('surfaceMode')?.value === 'exact' && value) {
        console.log('📐 Surface exact value entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('minSurface')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useSurfaceFilter')?.value && this.filterForm.get('surfaceMode')?.value === 'interval' && value && this.filterForm.get('maxSurface')?.value) {
        console.log('📐 Surface interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('maxSurface')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useSurfaceFilter')?.value && this.filterForm.get('surfaceMode')?.value === 'interval' && value && this.filterForm.get('minSurface')?.value) {
        console.log('📐 Surface interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    // Consumption filter value changes
    this.filterForm.get('exactConsumption')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useConsumptionFilter')?.value && this.filterForm.get('consumptionMode')?.value === 'exact' && value) {
        console.log('🔥 Consumption exact value entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('minConsumption')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useConsumptionFilter')?.value && this.filterForm.get('consumptionMode')?.value === 'interval' && value && this.filterForm.get('maxConsumption')?.value) {
        console.log('🔥 Consumption interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    this.filterForm.get('maxConsumption')?.valueChanges.subscribe((value) => {
      if (this.filterForm.get('useConsumptionFilter')?.value && this.filterForm.get('consumptionMode')?.value === 'interval' && value && this.filterForm.get('minConsumption')?.value) {
        console.log('🔥 Consumption interval values entered - triggering search')
        setTimeout(() => this.search(), 300)
      }
    })

    // Energy class checkboxes - trigger search when any checkbox changes
    const energyClasses = ['energyClassA', 'energyClassB', 'energyClassC', 'energyClassD', 'energyClassE', 'energyClassF', 'energyClassG']
    energyClasses.forEach(className => {
      this.filterForm.get(className)?.valueChanges.subscribe((checked) => {
        if (this.filterForm.get('useEnergyFilter')?.value && checked) {
          console.log(`⚡ Energy class ${className} selected - triggering search`)
          setTimeout(() => this.search(), 300)
        }
      })
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
      console.log(`💰 Applying exact price filter: ${val}`)
      this.formService.setPriceFilter(val, val)
    } else {
      // Use user values if provided, otherwise use defaults
      const min = values.minPrice ? Number(values.minPrice) : 0
      const max = values.maxPrice ? Number(values.maxPrice) : 2000000
      console.log(`💰 Applying price interval filter: ${min} - ${max}`)
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
      console.log(`📅 Applying exact date filter: ${date}`)
      this.formService.setDateFilter(date, date)
    } else {
      const startDate = values.startDate || '2020-01-01' // Default start date
      const endDate = values.endDate || '2023-12-31' // Default end date
      console.log(`📅 Applying date interval filter: ${startDate} - ${endDate}`)
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
      console.log(`📐 Applying exact surface filter: ${val}`)
      this.formService.setSurfaceFilter(val, val)
    } else {
      // Use user values if provided, otherwise use defaults
      const min = values.minSurface ? Number(values.minSurface) : 0
      const max = values.maxSurface ? Number(values.maxSurface) : 10000
      console.log(`📐 Applying surface interval filter: ${min} - ${max}`)
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
      console.log(`🔥 Applying exact consumption filter: ${val}`)
      this.formService.setConsumptionFilter(val, val)
    } else {
      // Use user values if provided, otherwise use defaults
      const min = values.minConsumption ? Number(values.minConsumption) : 0
      const max = values.maxConsumption ? Number(values.maxConsumption) : 1000
      console.log(`🔥 Applying consumption interval filter: ${min} - ${max}`)
      this.formService.setConsumptionFilter(min, max)
    }
  }

  /**
   * Apply all filters and refresh the map with multiple data sources support
   */
  search() {
    const values = this.filterForm.value
  
    console.log('🔍 Starting search with active filters:', {
      price: values.usePriceFilter,
      date: values.useDateFilter,
      surface: values.useSurfaceFilter,
      energy: values.useEnergyFilter,
      consumption: values.useConsumptionFilter
    })

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
  
    console.log('✅ Search completed - map will load data for active filters')
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
      console.log("💰 Price filter toggled ON with defaults - waiting for search button")
    } else {
      this.filterForm.patchValue({
        usePriceFilter: false,
        minPrice: null,
        maxPrice: null,
      })
      // Clear the filter immediately
      this.formService.clearPriceFilter()
      console.log("💰 Price filter toggled OFF - filter cleared")
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
      console.log("📅 Date filter toggled ON with defaults - waiting for search button")
    } else {
      this.filterForm.patchValue({
        useDateFilter: false,
        startDate: null,
        endDate: null,
      })
      // Clear the filter immediately
      this.formService.clearDateFilter()
      console.log("📅 Date filter toggled OFF - filter cleared")
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
      console.log("📐 Surface filter toggled ON with defaults - waiting for search button")
    } else {
      this.filterForm.patchValue({
        useSurfaceFilter: false,
        minSurface: null,
        maxSurface: null,
      })
      // Clear the filter immediately
      this.formService.clearSurfaceFilter()
      console.log("📐 Surface filter toggled OFF - filter cleared")
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
      console.log("⚡ Energy filter toggled ON with all classes - waiting for search button")
    } else {
      // Clear the filter immediately
      this.formService.clearEnergyClassFilter()
      console.log("⚡ Energy filter toggled OFF - filter cleared")
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
      console.log("🔋 Consumption filter toggled ON with defaults - waiting for search button")
    } else {
      this.filterForm.patchValue({
        useConsumptionFilter: false,
        minConsumption: null,
        maxConsumption: null,
      })
      // Clear the filter immediately
      this.formService.clearConsumptionFilter()
      console.log("🔋 Consumption filter toggled OFF - filter cleared")
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
        console.log('🔼 Marqueurs affichés avec les filtres actifs')
      } else {
        console.log('🔼 Marqueurs activés - activez des filtres pour voir les données')
      }
    } else {
      // Just hide markers without clearing filters - clear map data only
      this.mapService.refreshMap()
      console.log('🔽 Marqueurs masqués (filtres conservés)')
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

    console.log("🔄 Filters reset - waiting for search button to apply changes")
  }
}
