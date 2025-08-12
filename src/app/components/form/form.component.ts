import { Component, inject, type OnInit } from "@angular/core"
import { FormBuilder, type FormGroup, ReactiveFormsModule } from "@angular/forms"
import { CommonModule } from "@angular/common"
import { FormService } from "../../services/form.service"
import { MapService } from "../../services/map.service"

type DataSourceType = "dvf" | "dpe" | "parcelles"
type FilterMode = "exact" | "range"

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
      priceMode: ["range"],
      price: [null],
      minPrice: [null],
      maxPrice: [null],

      // Date (DVF)
      useDateFilter: [false],
      dateMode: ["range"],
      exactDate: [null],
      startDate: [null],
      endDate: [null],

      // Surface (Parcelle)
      useSurfaceFilter: [false],
      surfaceMode: ["range"],
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
      consumptionMode: ["range"],
      exactConsumption: [null],
      minConsumption: [null],
      maxConsumption: [null],
    })
  }

  ngOnInit(): void {
    // Restaurer l'état des filtres depuis localStorage
    this.formService.restoreFilterState()
    
    // Synchroniser les propriétés locales avec FormService
    this.setupFormServiceSubscriptions()
    
    // Configurer les listeners pour les changements de mode
    this.setupModeChangeListeners()
    
    // Restaurer l'état du formulaire depuis FormService
    this.restoreFormState()
    
    // Forçage de l'état des boutons radio après le chargement du DOM
    setTimeout(() => {
      this.forceRadioButtonsState()
    }, 500)

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
   * Setup listeners for mode changes to ensure they're correctly synced with FormService
   */
  private setupModeChangeListeners(): void {
    // Suivre les changements de mode pour les persister dans FormService
    this.filterForm.get('priceMode')?.valueChanges.subscribe((mode: string) => {
      console.log(`🔄 Mode prix changé à: ${mode}`)
      this.formService.setPriceMode(mode as FilterMode)
    })
    
    this.filterForm.get('dateMode')?.valueChanges.subscribe((mode: string) => {
      console.log(`🔄 Mode date changé à: ${mode}`)
      this.formService.setDateMode(mode as FilterMode)
    })
    
    this.filterForm.get('surfaceMode')?.valueChanges.subscribe((mode: string) => {
      console.log(`🔄 Mode surface changé à: ${mode}`)
      this.formService.setSurfaceMode(mode as FilterMode)
    })
    
    this.filterForm.get('consumptionMode')?.valueChanges.subscribe((mode: string) => {
      console.log(`🔄 Mode consommation changé à: ${mode}`)
      this.formService.setConsumptionMode(mode as FilterMode)
    })
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
      if (this.filterForm.get('useConsumptionFilter')?.value && this.filterForm.get('consumptionMode')?.value === 'range' && value && this.filterForm.get('minConsumption')?.value) {
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

    // Souscriptions aux modes des filtres pour synchronisation UI
    this.formService.getPriceModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ priceMode: mode }, { emitEvent: false })
    })

    this.formService.getDateModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ dateMode: mode }, { emitEvent: false })
    })

    this.formService.getSurfaceModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ surfaceMode: mode }, { emitEvent: false })
    })

    this.formService.getEnergyModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ energyMode: mode }, { emitEvent: false })
    })

    this.formService.getConsumptionModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ consumptionMode: mode }, { emitEvent: false })
    })

    // Souscription à l'état des marqueurs
    this.formService.getMarkersVisibleObservable().subscribe(visible => {
      this.markersVisible = visible
    })

    // Souscriptions aux valeurs des filtres pour synchronisation UI
    this.formService.getPriceFilterObservable().subscribe(value => {
      if (value) {
        this.filterForm.patchValue({ 
          minPrice: value[0], 
          maxPrice: value[1] 
        }, { emitEvent: false })
      }
    })

    this.formService.getExactPriceObservable().subscribe(value => {
      if (value !== null) {
        this.filterForm.patchValue({ price: value }, { emitEvent: false })
      }
    })

    this.formService.getDateFilterObservable().subscribe(value => {
      if (value) {
        this.filterForm.patchValue({ 
          startDate: value[0], 
          endDate: value[1] 
        }, { emitEvent: false })
      }
    })

    this.formService.getExactDateObservable().subscribe(value => {
      if (value !== null) {
        this.filterForm.patchValue({ exactDate: value }, { emitEvent: false })
      }
    })

    this.formService.getSurfaceFilterObservable().subscribe(value => {
      if (value) {
        this.filterForm.patchValue({ 
          minSurface: value[0], 
          maxSurface: value[1] 
        }, { emitEvent: false })
      }
    })

    this.formService.getExactSurfaceObservable().subscribe(value => {
      if (value !== null) {
        this.filterForm.patchValue({ surface: value }, { emitEvent: false })
      }
    })

    this.formService.getConsumptionFilterObservable().subscribe(value => {
      if (value) {
        this.filterForm.patchValue({ 
          minConsumption: value[0], 
          maxConsumption: value[1] 
        }, { emitEvent: false })
      }
    })

    this.formService.getExactConsumptionObservable().subscribe(value => {
      if (value !== null) {
        this.filterForm.patchValue({ exactConsumption: value }, { emitEvent: false })
      }
    })

    // Souscription aux classes énergétiques sélectionnées
    this.formService.getSelectedEnergyClassesObservable().subscribe(classes => {
      const energyUpdates = {
        energyClassA: classes ? classes.includes('A') : false,
        energyClassB: classes ? classes.includes('B') : false,
        energyClassC: classes ? classes.includes('C') : false,
        energyClassD: classes ? classes.includes('D') : false,
        energyClassE: classes ? classes.includes('E') : false,
        energyClassF: classes ? classes.includes('F') : false,
        energyClassG: classes ? classes.includes('G') : false
      }
      this.filterForm.patchValue(energyUpdates, { emitEvent: false })
    })
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
      this.formService.setExactPrice(val)
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
      this.formService.setExactDate(date)
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
      this.formService.setExactSurface(val)
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
      this.formService.setExactConsumption(val)
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
        priceMode: "range",
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
        dateMode: "range",
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
        surfaceMode: "range",
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
        consumptionMode: "range",
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

  // ===== MÉTHODES DE SYNCHRONISATION AVEC FORMSERVICE =====

  /**
   * Configure toutes les souscriptions aux observables du FormService
   */
  private setupFormServiceSubscriptions(): void {
    // Souscriptions aux états d'expansion des chevrons
    this.formService.getPriceExpandedObservable().subscribe(expanded => {
      this.priceExpanded = expanded
    })

    this.formService.getDateExpandedObservable().subscribe(expanded => {
      this.dateExpanded = expanded
    })

    this.formService.getSurfaceExpandedObservable().subscribe(expanded => {
      this.surfaceExpanded = expanded
    })

    this.formService.getEnergyExpandedObservable().subscribe(expanded => {
      this.energyExpanded = expanded
    })

    this.formService.getConsumptionExpandedObservable().subscribe(expanded => {
      this.consumptionExpanded = expanded
    })

    // Souscriptions aux états des toggles
    this.formService.getPriceToggleObservable().subscribe(active => {
      this.allPriceSelected = active
      this.filterForm.patchValue({ usePriceFilter: active }, { emitEvent: false })
    })

    this.formService.getDateToggleObservable().subscribe(active => {
      this.allDateSelected = active
      this.filterForm.patchValue({ useDateFilter: active }, { emitEvent: false })
    })

    this.formService.getSurfaceToggleObservable().subscribe(active => {
      this.allSurfaceSelected = active
      this.filterForm.patchValue({ useSurfaceFilter: active }, { emitEvent: false })
    })

    this.formService.getEnergyToggleObservable().subscribe(active => {
      this.allEnergySelected = active
      this.filterForm.patchValue({ useEnergyFilter: active }, { emitEvent: false })
    })

    this.formService.getConsumptionToggleObservable().subscribe(active => {
      this.allConsumptionSelected = active
      this.filterForm.patchValue({ useConsumptionFilter: active }, { emitEvent: false })
    })

    // Souscriptions aux états de chargement
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

    // Souscription à l'état de visibilité des marqueurs
    this.formService.getMarkersVisibleObservable().subscribe(visible => {
      this.markersVisible = visible
    })

    // Souscriptions aux modes des filtres pour synchroniser les form controls
    this.formService.getPriceModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ priceMode: mode }, { emitEvent: false })
    })

    this.formService.getDateModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ dateMode: mode }, { emitEvent: false })
    })

    this.formService.getSurfaceModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ surfaceMode: mode }, { emitEvent: false })
    })

    this.formService.getEnergyModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ energyMode: mode }, { emitEvent: false })
    })

    this.formService.getConsumptionModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ consumptionMode: mode }, { emitEvent: false })
    })
  }

  /**
   * Restaure l'état du formulaire depuis les valeurs du FormService
   */
  /**
   * Force l'état des boutons radio en utilisant le ViewChild pour sélectionner directement les éléments DOM
   * Cette approche est plus robuste que de compter sur Angular Forms
   */
  private forceRadioButtonsState(): void {
    console.log('🔄 Forçage de l\'état des boutons radio...')
    
    // Obtenir les valeurs actuelles des modes
    let priceMode: string = 'range'
    let dateMode: string = 'range'
    let surfaceMode: string = 'range'
    let consumptionMode: string = 'range'
    
    this.formService.getPriceModeObservable().pipe().subscribe(mode => {
      if (mode) priceMode = mode
    }).unsubscribe()
    
    this.formService.getDateModeObservable().pipe().subscribe(mode => {
      if (mode) dateMode = mode
    }).unsubscribe()
    
    this.formService.getSurfaceModeObservable().pipe().subscribe(mode => {
      if (mode) surfaceMode = mode
    }).unsubscribe()
    
    this.formService.getConsumptionModeObservable().pipe().subscribe(mode => {
      if (mode) consumptionMode = mode
    }).unsubscribe()
    
    // Utiliser setTimeout pour s'assurer que le DOM est prêt
    setTimeout(() => {
      console.log('🔄 Mise à jour des boutons radio:', { priceMode, dateMode, surfaceMode, consumptionMode })
      
      // Mettre à jour le formulaire avec les valeurs
      this.filterForm.patchValue({
        priceMode,
        dateMode, 
        surfaceMode,
        consumptionMode
      }, { emitEvent: false })
      
      // Rafraîchir manuellement tous les boutons radio pour contourner le problème Angular
      try {
        const radioInputs = document.querySelectorAll('input[type="radio"]')
        radioInputs.forEach((radio: any) => {
          const formName = radio.getAttribute('formcontrolname')
          const value = radio.value
          
          // Déterminer si ce bouton radio devrait être sélectionné
          let shouldBeChecked = false
          
          if (formName === 'priceMode') shouldBeChecked = value === priceMode
          else if (formName === 'dateMode') shouldBeChecked = value === dateMode
          else if (formName === 'surfaceMode') shouldBeChecked = value === surfaceMode
          else if (formName === 'consumptionMode') shouldBeChecked = value === consumptionMode
          
          // Forcer l'état checked
          if (shouldBeChecked && !radio.checked) {
            radio.checked = true
            console.log(`🔄 Bouton radio ${formName}=${value} forcé à checked=true`)
          }
        })
      } catch (e) {
        console.error('Erreur lors de la manipulation du DOM:', e)
      }
    }, 300)
  }

  private restoreFormState(): void {
    console.log('🔄 Restauration de l\'état du formulaire...')

    // Utiliser un délai pour s'assurer que les souscriptions sont établies
    setTimeout(() => {
      console.log('🔍 Début de la restauration des états du formulaire')
      
      // Restaurer directement depuis les BehaviorSubjects actuels
      const formUpdates: any = {}

      // FORCER des valeurs par défaut pour les modes (même s'ils sont null dans FormService)
      // Utiliser 'interval' comme valeur par défaut sécuritaire
      formUpdates.priceMode = 'range'
      formUpdates.dateMode = 'range'
      formUpdates.surfaceMode = 'range'
      formUpdates.consumptionMode = 'range'
      
      console.log('🔍 Modes par défaut définis :', formUpdates)

      // Puis, essayer de restaurer les vraies valeurs des modes depuis FormService
      this.formService.getPriceModeObservable().pipe().subscribe(mode => {
        if (mode) {
          console.log('🔍 Mode prix restauré :', mode)
          formUpdates.priceMode = mode
        }
      }).unsubscribe()

      this.formService.getDateModeObservable().pipe().subscribe(mode => {
        if (mode) {
          console.log('🔍 Mode date restauré :', mode)
          formUpdates.dateMode = mode
        }
      }).unsubscribe()

      this.formService.getSurfaceModeObservable().pipe().subscribe(mode => {
        if (mode) {
          console.log('🔍 Mode surface restauré :', mode)
          formUpdates.surfaceMode = mode
        }
      }).unsubscribe()

      this.formService.getConsumptionModeObservable().pipe().subscribe(mode => {
        if (mode) {
          console.log('🔍 Mode consommation restauré :', mode)
          formUpdates.consumptionMode = mode
        }
      }).unsubscribe()
      
      // Restaurer les valeurs des filtres
      // Prix
      this.formService.getPriceFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.minPrice = value[0]
          formUpdates.maxPrice = value[1]
        }
      }).unsubscribe()

      this.formService.getExactPriceObservable().pipe().subscribe(value => {
        if (value !== null) {
          formUpdates.price = value
        }
      }).unsubscribe()

      // Date
      this.formService.getDateFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.startDate = value[0]
          formUpdates.endDate = value[1]
        }
      }).unsubscribe()

      this.formService.getExactDateObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.exactDate = value
        }
      }).unsubscribe()

      // Surface
      this.formService.getSurfaceFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.minSurface = value[0]
          formUpdates.maxSurface = value[1]
        }
      }).unsubscribe()

      this.formService.getExactSurfaceObservable().pipe().subscribe(value => {
        if (value !== null) {
          formUpdates.surface = value
        }
      }).unsubscribe()

      // Consommation
      this.formService.getConsumptionFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.minConsumption = value[0]
          formUpdates.maxConsumption = value[1]
        }
      }).unsubscribe()

      this.formService.getExactConsumptionObservable().pipe().subscribe(value => {
        if (value !== null) {
          formUpdates.exactConsumption = value
        }
      }).unsubscribe()

      // Appliquer toutes les mises à jour en une fois
      if (Object.keys(formUpdates).length > 0) {
        console.log('📊 Mise à jour du formulaire avec valeurs:', formUpdates)
        this.filterForm.patchValue(formUpdates, { emitEvent: false })
      }

      console.log('✅ État du formulaire restauré')
    }, 200)
  }

  /**
   * Méthodes pour gérer les chevrons (expansion/contraction des sections)
   */
  togglePriceExpanded(): void {
    this.priceExpanded = !this.priceExpanded
    this.formService.setPriceExpanded(this.priceExpanded)
  }

  toggleDateExpanded(): void {
    this.dateExpanded = !this.dateExpanded
    this.formService.setDateExpanded(this.dateExpanded)
  }

  toggleSurfaceExpanded(): void {
    this.surfaceExpanded = !this.surfaceExpanded
    this.formService.setSurfaceExpanded(this.surfaceExpanded)
  }

  toggleEnergyExpanded(): void {
    this.energyExpanded = !this.energyExpanded
    this.formService.setEnergyExpanded(this.energyExpanded)
  }

  toggleConsumptionExpanded(): void {
    this.consumptionExpanded = !this.consumptionExpanded
    this.formService.setConsumptionExpanded(this.consumptionExpanded)
  }
}
