import { Component, AfterViewInit, OnDestroy, ViewChild, inject, OnInit, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { Subscription } from "rxjs"
import { DvfProperty } from "../../models/dvf-property.model"
import { DpeProperty } from "../../models/dpe.model"
import { ParcelleProperty } from "../../models/parcelle.model"
import { MapService } from "../../services/map.service"
import { FormService } from "../../services/form.service"
import { DvfService } from "../../services/dvf.service"
import { DpeService } from "../../services/dpe.service"
import { ParcelleService } from "../../services/parcelle.service"
import { MapDisplayComponent } from "./map-display/map-display.component"
import { MapControlsComponent } from "./map-controls/map-controls.component"
import { MapResultsComponent } from "./map-results/map-results.component"
import { MapAlertComponent } from "./map-alert/map-alert.component"
import { MapSearchComponent } from "./map-search/map-search.component"

@Component({
  selector: "app-map",
  standalone: true,
  imports: [CommonModule, MapDisplayComponent, MapControlsComponent, MapResultsComponent, MapAlertComponent, MapSearchComponent],
  styleUrls: ["./map.component.scss"],
  templateUrl: "./map.component.html",
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  // Timeout for debouncing map movements
  private mapMoveTimeout: any = null;

  @ViewChild(MapDisplayComponent) mapDisplay!: MapDisplayComponent
  @Input() leftSidebarOpen = true // Valeur par défaut, sera écrasée par la restauration FormService

  private fetchDataTimeout: any

  // Sources de données actives (peut être multiple maintenant)
  activeDataSources: string[] = []
  currentDataSource = "dvf" // Gardé pour compatibilité

  // Filter flags
  usePriceFilter = false
  useDateFilter = false
  useSurfaceFilter = false
  useEnergyFilter = false
  markersVisible = true // Track if markers should be visible

  // DVF filter properties
  minPrice = 0
  maxPrice = 2000000
  exactPrice: number | null = null
  priceMode = "range"
  
  // Filter toggle states - these track UI toggle state
  isPriceToggleActive = false
  isDateToggleActive = false
  isSurfaceToggleActive = false
  isEnergyToggleActive = false
  isConsumptionToggleActive = false

  // Date properties
  startDate = "2020-01-01"
  endDate = "2023-12-31"
  minSurface = 0
  maxSurface = 10000
  energyClasses: string[] = []
  energyExactClass: string | null = null
  energyClassRange: [string, string] | null = null

  // Consumption filter properties
  consumptionFilter: [number, number] | null = null
  exactConsumption: number | null = null
  consumptionMode = "exact"

  // Surface filter properties
  surfaceFilter: [number, number] | null = null
  exactSurface: number | null = null
  surfaceMode = "exact"

  public visibleDvfProperties: DvfProperty[] = []
  public visibleDpeProperties: DpeProperty[] = []
  public visibleParcelleProperties: ParcelleProperty[] = []
  public selectedPropertyIndex: number | null = null
  public tableCollapsed = false // Sidebar ouvert par défaut
  public isLoading = false
  public dateMode = "exact"
  public exactDate: string | null = null
  
  // Alert properties - maintenant par source de données
  public showAlert = false
  public resultCount = 0
  public maxResults = 500
  public alertMessages: {[key: string]: {count: number, show: boolean}} = {
    dvf: { count: 0, show: false },
    dpe: { count: 0, show: false },
    parcelles: { count: 0, show: false }
  }

  // Services
  private readonly mapService = inject(MapService)
  private readonly formService = inject(FormService)
  private readonly http = inject(HttpClient)
  private readonly cdr = inject(ChangeDetectorRef)
  private readonly dvfService = inject(DvfService)
  private readonly dpeService = inject(DpeService)
  private readonly parcelleService = inject(ParcelleService)
  private readonly subscriptions: Subscription[] = []

  get isFilterActive(): boolean {
    return this.usePriceFilter || this.useDateFilter || this.useSurfaceFilter || this.useEnergyFilter
  }
  
  get activeFilters(): string[] {
    const filters: string[] = []
    
    if (this.usePriceFilter) {
      filters.push('prix')
    }
    if (this.useDateFilter) {
      filters.push('période')
    }
    if (this.useSurfaceFilter) {
      filters.push('surface')
    }
    if (this.useEnergyFilter) {
      filters.push('classe énergétique')
    }
    
    // Check for consumption filter
    let hasConsumptionFilter = false
    this.formService.getExactConsumptionObservable().subscribe(value => {
      if (value !== null) hasConsumptionFilter = true
    }).unsubscribe()
    
    this.formService.getConsumptionFilterObservable().subscribe(value => {
      if (value !== null) hasConsumptionFilter = true
    }).unsubscribe()
    
    if (hasConsumptionFilter) {
      filters.push('consommation')
    }
    
    return filters
  }

  private checkAndFetchIfNeeded(): void {
    const hasActiveFilters =
      (this.currentDataSource === "dvf" && (this.usePriceFilter || this.useDateFilter)) ||
      (this.currentDataSource === "parcelles" && this.useSurfaceFilter) ||
      (this.currentDataSource === "dpe")

    if (hasActiveFilters) {
      this.fetchData()
    } else {
      this.visibleDvfProperties = []
      this.visibleDpeProperties = []
      this.visibleParcelleProperties = []
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle left sidebar state changes
    if (changes['leftSidebarOpen'] && !changes['leftSidebarOpen'].firstChange) {
      const previousValue = changes['leftSidebarOpen'].previousValue;
      const currentValue = changes['leftSidebarOpen'].currentValue;
      

      
      // When sidebar opens/closes, the map bounds change significantly
      // We need to trigger a new request after a short delay to allow the map to resize
      setTimeout(() => {
        if (this.mapDisplay) {
          // Force map to recalculate its size
          this.mapDisplay.invalidateSize();
          
          // Trigger new data fetch with updated bounds
          this.fetchData();
        }
      }, 300); // Allow time for CSS transitions to complete
    }
  }

  ngOnInit(): void {
    // Restaurer l'état des filtres depuis FormService
    this.formService.restoreFilterState()
    
    // Subscribe to toggle states
    this.subscriptions.push(
      this.formService.getPriceFilterObservable().subscribe(value => { 
        if (value) { 
          this.minPrice = value[0]; 
          this.maxPrice = value[1];
        } else {
          // Clear price values when filter is cleared
          this.minPrice = 0;
          this.maxPrice = 2000000;
        }
      }),

      this.formService.getDateFilterObservable().subscribe(value => { 
        if (value) { 
          this.startDate = value[0]; 
          this.endDate = value[1];
        } else if (!this.exactDate) {
          // Only clear date values if exactDate is not set
          this.startDate = "2020-01-01";
          this.endDate = "2023-12-31";
        } 
      }),
      this.formService.getExactDateObservable().subscribe(value => {
        if (value !== null && value !== '') {
          this.exactDate = value;
        } else {
          this.exactDate = null;
        }
      }),
      this.formService.getDateModeObservable().subscribe(mode => this.dateMode = mode),
      
      // 💰 Exact price subscription
      this.formService.getExactPriceObservable().subscribe(value => {
        this.exactPrice = value;
      }),
      
      this.formService.getPriceModeObservable().subscribe(mode => {
        this.priceMode = mode;
      }),

      this.formService.getSelectedEnergyClassesObservable().subscribe(classes => {
        this.energyClasses = classes || [];
        this.updateEnergyFilterState();
      }),
      this.formService.getExactEnergyClassObservable().subscribe(value => {
        this.energyExactClass = value;
        this.updateEnergyFilterState();
      }),
      this.formService.getEnergyClassRangeObservable().subscribe(value => {
        this.energyClassRange = value;
        this.updateEnergyFilterState();
      }),

      this.formService.getConsumptionToggleObservable().subscribe(active => {
        this.isConsumptionToggleActive = active;
        
        if (active) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.fetchData(), 100) // Short debounce for toggle activation
        }
      }),
      this.formService.getConsumptionFilterObservable().subscribe(value => {
        this.consumptionFilter = value;
      
        // Log exactly what arrived from the form
        if (value) {
          const [min, max] = value;
          this.logConsumption('range', { min: Number(min), max: Number(max) });
        } else {
          this.logConsumption('range', null);
        }
      
        if (this.isConsumptionToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout);
          this.fetchDataTimeout = setTimeout(() => this.fetchData(), 300);
        }
      }), 
      
      
      this.formService.getExactConsumptionObservable().subscribe(value => {
        this.exactConsumption = value;
      
        // Log exactly what arrived from the form
        if (value !== null && value !== undefined && value !== undefined) {
          this.logConsumption('exact', { exact: Number(value) });
        } else {
          this.logConsumption('exact', null);
        }
      
        if (this.isConsumptionToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout);
          this.fetchDataTimeout = setTimeout(() => this.fetchData(), 300);
        }
      }), 
      // ðŸ  Surface filter subscriptions with immediate reload - FIXED VERSION
this.formService.getSurfaceToggleObservable().subscribe(active => {
  this.isSurfaceToggleActive = active;
  
  if (active) {
    this.useSurfaceFilter = true
    
    // Clear any existing timeout to prevent race conditions
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    
    // Trigger immediate data fetch when toggle is activated
    this.fetchDataTimeout = setTimeout(() => this.fetchData(), 100)
  } else {
    this.useSurfaceFilter = false
    this.visibleParcelleProperties = []
    this.alertMessages['parcelles'] = { count: 0, show: false }
    this.updateGlobalAlert()
    this.cdr.detectChanges()
  }
}),

this.formService.getSurfaceFilterObservable().subscribe(value => {
  this.surfaceFilter = value;
  if (value) {
    this.minSurface = value[0];
    this.maxSurface = value[1];
    this.useSurfaceFilter = true;
  }
  
  // TRIGGER RELOAD when surface range changes and toggle is active
  if (this.isSurfaceToggleActive && value) {
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    this.fetchDataTimeout = setTimeout(() => this.fetchData(), 300)
  }
}),

this.formService.getExactSurfaceObservable().subscribe(value => {
  this.exactSurface = value;
  
  // TRIGGER RELOAD when exact surface changes and toggle is active
  if (this.isSurfaceToggleActive && value !== null) {
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    this.fetchDataTimeout = setTimeout(() => this.fetchData(), 300)
  }
}),

this.formService.getSurfaceModeObservable().subscribe(mode => {
  this.surfaceMode = mode;
  
  // TRIGGER RELOAD when surface mode changes and toggle is active
  if (this.isSurfaceToggleActive) {
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    this.fetchDataTimeout = setTimeout(() => this.fetchData(), 300)
  }
}),

      // Subscribe to sidebar state changes
      this.formService.getTableCollapsedObservable().subscribe(collapsed => {
        this.tableCollapsed = collapsed;
      }),
      
      this.formService.getLeftSidebarOpenObservable().subscribe(open => {
        this.leftSidebarOpen = open;
      }),

      // Subscribe to markers visibility
      this.formService.getMarkersVisibleObservable().subscribe(visible => {
        this.markersVisible = visible;
      }),

      // ✅ Auto-reload subscription - triggers when parameters change
      this.formService.getReloadTrigger().subscribe(() => {
        if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
        this.fetchDataTimeout = setTimeout(() => this.fetchData(), 300) // 300ms debounce
      })
    );
  }

  ngAfterViewInit(): void {
    // Ensure exact date is restored from FormService after subscriptions
    this.formService.getExactDateObservable().pipe().subscribe(value => {
      if (value && value !== '') {
        this.exactDate = value;
      }
    }).unsubscribe();
    
    // Déclencher fetchData() automatiquement si des filtres sont actifs après restauration
    if (this.formService.hasActiveFilters()) {
      setTimeout(() => this.fetchData(), 100)
      setTimeout(() => this.fetchData(), 100)
    }
    
    this.subscriptions.push(
      // Listen for markers visibility changes
      this.formService.getMarkersVisibleObservable().subscribe((visible) => {
        this.markersVisible = visible
        
        if (!visible) {
          // Clear all displayed properties when markers are hidden
          this.visibleDvfProperties = []
          this.visibleDpeProperties = []
          this.visibleParcelleProperties = []
          this.cdr.detectChanges()
        }
      }),

      // Re-enable map refresh for search button functionality
      this.mapService.getRefreshObservable().subscribe(() => {
        
        this.fetchData()
      }),

      // Data source subscription - only update the source, don't fetch data automatically
      this.formService
        .getDataSourceObservable()
        .subscribe((source) => {
         
          this.currentDataSource = source
          // DISABLED: this.fetchData() - user must use search button
        }),

      // DVF filters
      this.formService
        .getPriceFilterObservable()
        .subscribe((filter) => {
          if (filter) {
            const [min, max] = filter
            this.minPrice = min
            this.maxPrice = max
            
          } else {
            this.minPrice = 0
            this.maxPrice = 0
            
            // Clear displayed properties when filter is disabled
            if (this.currentDataSource === 'dvf') {
              this.visibleDvfProperties = []
              this.cdr.detectChanges()
            }
          }
        }),

      this.formService
        .getDateFilterObservable()
        .subscribe((filter) => {
          if (filter) {
            const [start, end] = filter
            this.startDate = start
            this.endDate = end || start
            
            // Only switch to range mode and clear exactDate if we don't have an exact date
            if (!this.exactDate) {
              this.dateMode = "range"
            }
            
            // Refresh data if DPE is already active to apply date filter
            if (this.activeDataSources.includes('dpe')) {
              this.fetchData()
            }
          } else {
            // Only clear date values if exactDate is not set
            if (!this.exactDate || this.exactDate === '') {
              this.startDate = ""
              this.endDate = ""
            }
            
            // Refresh data if DPE is active to remove date filter
            if (this.activeDataSources.includes('dpe')) {
              this.fetchData()
            }
            // Clear displayed properties when filter is disabled
            if (this.currentDataSource === 'dvf') {
              this.visibleDvfProperties = []
              this.cdr.detectChanges()
            }
          }
        }),

      // Parcelle filters
      this.formService
        .getSurfaceFilterObservable()
        .subscribe((filter) => {
          if (filter) {
            const [min, max] = filter
            this.minSurface = min
            this.maxSurface = max
            this.useSurfaceFilter = true
            
          } else {
            this.useSurfaceFilter = false
            this.minSurface = 0
            this.maxSurface = 0
            
            // Clear displayed properties when filter is disabled
            if (this.currentDataSource === 'parcelles') {
              this.visibleParcelleProperties = []
              this.cdr.detectChanges()
            } else if (this.currentDataSource === 'dvf') {
              this.visibleDvfProperties = []
              this.cdr.detectChanges()
            }
          }
        }),

      // DPE filters - Multiple class selection
      this.formService
        .getSelectedEnergyClassesObservable()
        .subscribe((classes: string[] | null) => {
          
          if (classes && classes.length > 0) {
            this.energyClasses = classes
            this.energyClassRange = ["",""]
            this.energyExactClass = null
            
          } else {
            this.energyClasses = []
            
          }
          this.updateEnergyFilterState()
        }),

      // DPE filters - Exact class
      this.formService
        .getExactEnergyClassObservable()
        .subscribe((exactClass: string | null) => {
          if (exactClass) {
            this.energyExactClass = exactClass
            this.energyClasses = []
            this.energyClassRange = ["",""]
            
          } else {
            this.energyExactClass = null
            
          }
          this.updateEnergyFilterState()
        }),

      // DPE filters - Class range
      this.formService
        .getEnergyClassRangeObservable()
        .subscribe((range: [string, string] | null) => {
          if (range) {
            this.energyClassRange = range
            this.energyClasses = []
            this.energyExactClass = null
            
          } else {
            this.energyClassRange = ["",""]
            
          }
          this.updateEnergyFilterState()
        }),





      // Toggle state subscriptions with immediate reload triggers
      this.formService.getPriceToggleObservable().subscribe(active => {
        this.isPriceToggleActive = active
        // Set usePriceFilter based on toggle state
        this.usePriceFilter = active;
        console.log(`💰 Price filter toggle ${active ? 'activated' : 'deactivated'} - usePriceFilter set to ${this.usePriceFilter}`);
        
        if (active) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.fetchData(), 100)
        } else {
          // Clear DVF properties when price toggle is disabled
          // Only clear if date toggle is also inactive
          if (!this.isDateToggleActive) {
            this.visibleDvfProperties = []
            this.alertMessages['dvf'] = { count: 0, show: false }
            this.updateGlobalAlert()
            this.cdr.detectChanges()
          }
        }
      }),

      this.formService.getDateToggleObservable().subscribe(active => {
        this.isDateToggleActive = active
        // Set useDateFilter based on toggle state
        this.useDateFilter = active;
        console.log(`📅 Date filter toggle ${active ? 'activated' : 'deactivated'} - useDateFilter set to ${this.useDateFilter}`);
        
        if (active) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.fetchData(), 100)
        } else {
          // Clear DVF properties when date toggle is disabled
          // Only clear if price toggle is also inactive
          if (!this.isPriceToggleActive) {
            this.visibleDvfProperties = []
            this.alertMessages['dvf'] = { count: 0, show: false }
            this.updateGlobalAlert()
            this.cdr.detectChanges()
          }
        }
      }),

      this.formService.getEnergyToggleObservable().subscribe(active => {
        this.isEnergyToggleActive = active
        
        if (active) {
     
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.fetchData(), 100)
        } else {
          // Clear DPE properties when energy toggle is disabled
          // Only clear if consumption toggle is also inactive
          if (!this.isConsumptionToggleActive) {
            this.visibleDpeProperties = []
            this.alertMessages['dpe'] = { count: 0, show: false }
            this.updateGlobalAlert()
            this.cdr.detectChanges()
          }
        }
      }),

      this.formService.getConsumptionToggleObservable().subscribe(active => {
        this.isConsumptionToggleActive = active
        
        if (active) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.fetchData(), 100)
        } else {
          // Clear DPE properties when consumption toggle is disabled
          // Only clear if energy toggle is also inactive
          if (!this.isEnergyToggleActive) {
            this.visibleDpeProperties = []
            this.alertMessages['dpe'] = { count: 0, show: false }
            this.updateGlobalAlert()
            this.cdr.detectChanges()
          }
        }
      }),
    )
  }

  // Méthode pour mettre à jour l'état du filtre d'énergie
  private updateEnergyFilterState(): void {
    const hasEnergyClasses = this.energyClasses && this.energyClasses.length > 0
    const hasExactClass = !!(this.energyExactClass && this.energyExactClass.length > 0)
    const hasClassRange = !!(this.energyClassRange && this.energyClassRange.length === 2 && 
                          this.energyClassRange[0] && this.energyClassRange[1])
    
    const wasActive = this.useEnergyFilter
    this.useEnergyFilter = hasEnergyClasses || hasExactClass || hasClassRange
    
    
    
    // Si le filtre est désactivé et qu'on était sur DPE, effacer les résultats
    if (wasActive && !this.useEnergyFilter && this.currentDataSource === 'dpe') {
      this.visibleDpeProperties = []
      this.cdr.detectChanges()
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    if (this.mapMoveTimeout) clearTimeout(this.mapMoveTimeout)
  }

  // Handle map movement events with debouncing
  onMapMoved(): void {
    
    
    // Clear any existing timeout to prevent multiple requests
    if (this.mapMoveTimeout) {
      clearTimeout(this.mapMoveTimeout)
    }
    
    // Debounce the data fetching to avoid too many requests
    this.mapMoveTimeout = setTimeout(() => {
      this.fetchData()
    }, 1000) // Wait 1 second after user stops moving/zooming
  }

  // Handle geolocation
  onLocateUser(): void {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas prise en charge par votre navigateur.")
      return
    }

    this.isLoading = true

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords

        // Center map on user location
        this.mapDisplay.setMapView(latitude, longitude, 14)

        // Add user location marker
        this.mapDisplay.addUserLocationMarker(latitude, longitude, position.coords.accuracy)

        this.isLoading = false
      },
      (error) => {
        console.error("Erreur de géolocalisation:", error)
        this.isLoading = false

        let errorMessage = "Impossible de déterminer votre position."

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Vous avez refusé l'accès à votre position. Vérifiez les paramètres de votre navigateur."
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Les informations de localisation ne sont pas disponibles."
            break
          case error.TIMEOUT:
            errorMessage = "La demande de localisation a expiré."
            break
        }

        alert(errorMessage)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }



  // Handle property selection
  onPropertySelected(event: { index: number; property: any }): void {
    this.selectedPropertyIndex = event.index

    const lat = event.property.latitude || event.property.lat
    const lng = event.property.longitude || event.property.lng

    if (lat && lng) {
      this.mapDisplay.setMapView(lat, lng, 16)
    }
  }



  // Handle location search from search component
  onLocationSelected(location: {lat: number, lon: number, name: string}): void {
    
    
    // Center map on selected location
    this.mapDisplay.setMapView(location.lat, location.lon, 14)
    
    // Optionally fetch data for the new location
    setTimeout(() => {
      this.fetchData()
    }, 500)
  }

  // Handle user location request from search component
  onUserLocationRequested(): void {
    
    this.onLocateUser()
  }

  private fetchData(): void {
    this.isLoading = true
    this.cdr.detectChanges()

    // Clear previous timeout
    if (this.fetchDataTimeout) {
      clearTimeout(this.fetchDataTimeout)
    }

    // Add a small delay to prevent too many rapid API calls
    this.fetchDataTimeout = setTimeout(() => {
      // Check if markers should be visible
      if (!this.markersVisible) {
        
        this.isLoading = false
        this.cdr.detectChanges()
        return
      }

      

      // Set loading states for active filters
      if (this.isPriceToggleActive) {
        this.formService.setPriceLoading(true)
      }
      if (this.isDateToggleActive) {
        this.formService.setDateLoading(true)
      }
      if (this.isSurfaceToggleActive) {
        this.formService.setSurfaceLoading(true)
      }
      if (this.isEnergyToggleActive) {
        this.formService.setEnergyLoading(true)
      }
      if (this.isConsumptionToggleActive) {
        this.formService.setConsumptionLoading(true)
      }

      // Déterminer quelles sources de données charger selon les filtres actifs
      const sourcesToLoad: string[] = []
      
      // Utilisez directement les propriétés de classe maintenues à jour par les subscriptions
     
      
      // DVF si filtres prix ou date actifs (ou leurs toggles)
      if (this.isPriceToggleActive || this.isDateToggleActive) {
        sourcesToLoad.push('dvf')
      }
      
      // DPE si filtre énergie ou consommation actif
      // Note: Le filtre de date ne doit PAS activer automatiquement DPE
      // Il doit seulement ajouter le filtrage par date aux sources déjà actives
      if (this.isEnergyToggleActive || this.isConsumptionToggleActive) {
        sourcesToLoad.push('dpe')
      }
      
      // Parcelles si filtre surface actif
      if (this.isSurfaceToggleActive) {
        sourcesToLoad.push('parcelles')
      }
      
      // Si aucun filtre actif, charger selon currentDataSource pour compatibilité
      if (sourcesToLoad.length === 0) {
        sourcesToLoad.push(this.currentDataSource)
      }
      
      this.activeDataSources = sourcesToLoad
      
      
      // Charger toutes les sources nécessaires en parallèle
      const loadPromises: Promise<void>[] = []
      
      if (sourcesToLoad.includes('dvf')) {
        loadPromises.push(this.loadDvfDataAsync())
      } else {
        this.visibleDvfProperties = []
        this.alertMessages['dvf'] = { count: 0, show: false }
      }
      
      if (sourcesToLoad.includes('dpe')) {
        loadPromises.push(this.loadDpeDataAsync())
      } else {
        this.visibleDpeProperties = []
        this.alertMessages['dpe'] = { count: 0, show: false }
      }
      
      if (sourcesToLoad.includes('parcelles')) {
        loadPromises.push(this.loadParcelleDataAsync())
      } else {
        this.visibleParcelleProperties = []
        this.alertMessages['parcelles'] = { count: 0, show: false }
      }
      
      // Attendre que toutes les données soient chargées
      Promise.all(loadPromises).finally(() => {
        this.isLoading = false
        
        // Clear all loading states
        this.formService.setPriceLoading(false)
        this.formService.setDateLoading(false)
        this.formService.setSurfaceLoading(false)
        this.formService.setEnergyLoading(false)
        this.formService.setConsumptionLoading(false)
        
        this.updateGlobalAlert()
        this.cdr.detectChanges()
      })
    }, 300)
  }

  private async loadDvfDataAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      // DVF should load if price OR date filter is active (or both)
      // This allows date filter to work as a "join filter"
      if (!this.isPriceToggleActive && !this.isDateToggleActive) {
        this.visibleDvfProperties = []
        this.alertMessages['dvf'] = { count: 0, show: false }
        resolve()
        return
      }

      const bounds = this.mapDisplay?.getMapBounds()
      if (!bounds) {
        resolve()
        return
      }

      const topLeft: [number, number] = [bounds.getNorth(), bounds.getWest()]
      const bottomRight: [number, number] = [bounds.getSouth(), bounds.getEast()]

      // 💰 Price filter handling - exact price takes priority
      let priceRange: [number, number] | null = null
      let exactPrice: number | null = null
      
      if (this.isPriceToggleActive) {
        if (this.priceMode === 'exact' && this.exactPrice !== null && this.exactPrice !== undefined) {
          exactPrice = this.exactPrice
        } else if (this.priceMode === 'range' && this.minPrice !== 0 && this.maxPrice !== 0) {
          priceRange = [this.minPrice, this.maxPrice]
        }
      }

      let dateRange: [string, string] | null = null
      let exactDate: string | null = null
      
      if (this.isDateToggleActive) {
        
        
        if (this.dateMode === "exact" && this.exactDate && this.exactDate !== '') {
          
          exactDate = this.exactDate
        } else if (this.dateMode === "range") {
          dateRange = [this.startDate, this.endDate]
        } else {
          
        }
      } 

      this.dvfService.getDvfProperties(topLeft, bottomRight, priceRange, exactPrice, dateRange, exactDate).subscribe({
        next: (properties: DvfProperty[]) => {
          this.visibleDvfProperties = properties
          this.alertMessages['dvf'] = { 
            count: properties.length, 
            show: properties.length >= this.maxResults 
          }
          resolve()
        },
        error: (error: any) => {
          console.error("Error fetching DVF data:", error)
          this.alertMessages['dvf'] = { count: 0, show: false }
          reject(error)
        }
      })
    })
  }

  private loadDpeDataAsync(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Always load DPE data when requested, regardless of filter state
      // The backend will handle filtering based on the provided parameters

      const bounds = this.mapDisplay.getMapBounds()
      if (!bounds) {
        this.visibleDpeProperties = []
        this.alertMessages['dpe'] = { count: 0, show: false }
        resolve()
        return
      }
      
      const topLeft: [number, number] = [bounds.getNorth(), bounds.getWest()]
      const bottomRight: [number, number] = [bounds.getSouth(), bounds.getEast()]

      // Determine energy filter mode and values
      let energyFilter: string[] | number | [number, number] | null = null
      // Always using 'class' mode for energy filters
      const filterMode: 'exact' | 'interval' | 'class' = 'class'

      // Only apply energy filters if the energy filter toggle is active
      if (this.useEnergyFilter) {
        if (this.energyClasses && this.energyClasses.length > 0) {
          // Class filtering mode
          energyFilter = this.energyClasses
        } else if (this.energyExactClass) {
          // Exact class filtering (treat as single class array)
          energyFilter = [this.energyExactClass]
        } else if (this.energyClassRange && this.energyClassRange.length === 2) {
          // Range filtering - convert to class array (A to C = ['A', 'B', 'C'])
          const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
          const startIndex = classes.indexOf(this.energyClassRange[0])
          const endIndex = classes.indexOf(this.energyClassRange[1])
          if (startIndex !== -1 && endIndex !== -1) {
            energyFilter = classes.slice(startIndex, endIndex + 1)
          }
        }
      }

      // Surface range for DPE filtering
      const surfaceRange: [number, number] = this.useSurfaceFilter 
        ? [this.minSurface, this.maxSurface] 
        : [0, 10000]
        
      // Date filter parameters for DPE
      let dateRange: [string, string] | null = null
      let exactDate: string | null = null
      
      if (this.useDateFilter) {
        if (this.dateMode === "range") {
          dateRange = [this.startDate, this.endDate || this.startDate]
        } else if (this.dateMode === "exact") {
          exactDate = this.exactDate
        }
      }

      

      // 🔥 Consumption filter parameters - FIXED TO INCLUDE IN API CALL
      const consumptionFilterToUse = this.consumptionFilter && Array.isArray(this.consumptionFilter) && this.consumptionFilter.length === 2 ? this.consumptionFilter : null;
      const exactConsumptionToUse = this.exactConsumption !== null && this.exactConsumption !== undefined ? this.exactConsumption : null;

      console.log('🔥 MapComponent - Consumption parameters being sent to DPE service:', {
        consumptionFilter: consumptionFilterToUse,
        exactConsumption: exactConsumptionToUse,
        isConsumptionToggleActive: this.isConsumptionToggleActive
      });

      // Use DpeFilterOptions interface for cleaner API
      this.dpeService
        .getDpeProperties(
          topLeft,
          bottomRight,
          {
            energyFilter,
            filterMode,
            surfaceRange,
            exactDate,
            dateRange,
            consumptionFilter: consumptionFilterToUse,
            exactConsumption: exactConsumptionToUse
          }
        )
        .subscribe({
          next: (properties: DpeProperty[]) => {
            this.visibleDpeProperties = properties
            
            // Update alert state
            this.alertMessages['dpe'] = {
              count: properties.length,
              show: properties.length >= this.maxResults
            }

            resolve()
          },
          error: (error) => {
            console.error("Error fetching DPE data:", error)
            this.visibleDpeProperties = []
            resolve()
          }
        })
    })
  }

  private async loadParcelleDataAsync(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Surface filter should load when toggle is active (like price/date filters)
      if (!this.isSurfaceToggleActive) {
        this.visibleParcelleProperties = []
        this.alertMessages['parcelles'] = { count: 0, show: false }
        resolve()
        return
      }

      const bounds = this.mapDisplay.getMapBounds()
      if (!bounds) {
        resolve()
        return
      }

      const topLeft: [number, number] = [bounds.getNorth(), bounds.getWest()]
      const bottomRight: [number, number] = [bounds.getSouth(), bounds.getEast()]
      
      // 🏠 Surface filter handling - FIXED TO MATCH PRICE/DATE PATTERN
      let surfaceParam: [number, number] | null = null
      
      if (this.isSurfaceToggleActive) {
        if (this.surfaceMode === 'exact' && this.exactSurface !== null && this.exactSurface !== undefined) {
          // For exact surface, pass the exact value as both min and max
          surfaceParam = [this.exactSurface, this.exactSurface]
        } else if (this.surfaceMode === 'range' && this.surfaceFilter && 
                   this.surfaceFilter[0] !== null && this.surfaceFilter[1] !== null) {
          // Use actual range values from FormService
          surfaceParam = this.surfaceFilter
        } else {
          // No values provided - use SELECT * behavior (null = no surface filter)
          surfaceParam = null
        }
      }

      this.parcelleService.getParcelleProperties(topLeft, bottomRight, surfaceParam).subscribe({
        next: (properties: ParcelleProperty[]) => {
          this.visibleParcelleProperties = properties
          
          // Update alert state
          this.alertMessages['parcelles'] = {
            count: properties.length,
            show: properties.length >= this.maxResults
          }
          
          resolve()
        },
        error: (error: any) => {
          console.error("Error fetching Parcelle data:", error)
          this.visibleParcelleProperties = []
          this.alertMessages['parcelles'] = { count: 0, show: false }
          resolve()
        },
      })
    })
  }

  // Méthode pour mettre à jour l'alerte globale selon les sources actives
  private updateGlobalAlert(): void {
    let totalCount = 0
    let hasAlert = false
    let alertSources: string[] = []

    // Vérifier chaque source active
    for (const source of this.activeDataSources) {
      const alert = this.alertMessages[source]
      if (alert) {
        totalCount += alert.count
        if (alert.show) {
          hasAlert = true
          alertSources.push(source.toUpperCase())
        }
      }
    }

    // Mettre à jour les propriétés globales pour l'alerte
    this.resultCount = totalCount
    this.showAlert = hasAlert
    
    if (hasAlert) {
      
    }
  }

  /**
   * Toggle du sidebar gauche avec persistance
   */
  onToggleSidebar(): void {
    this.leftSidebarOpen = !this.leftSidebarOpen
    this.formService.setLeftSidebarOpen(this.leftSidebarOpen)
  }

  /**
   * Toggle du tableau de résultats avec persistance
   */
  onTableToggled(collapsed: boolean): void {
    this.tableCollapsed = collapsed
    this.formService.setTableCollapsed(collapsed)
  }

  /**
   * Invalidation de la taille de la carte
   */
  onMapSizeInvalidated(): void {
    // Déclencher une mise à jour de la taille de la carte si nécessaire
    if (this.mapDisplay) {
      setTimeout(() => {
        this.mapDisplay.invalidateSize()
      }, 100)
    }
  }

  /** Debug helper for consumption filter logs */
private logConsumption(tag: string, payload: any) {
  console.log(`🔎 [Consumption:${tag}]`, payload);
}

}
