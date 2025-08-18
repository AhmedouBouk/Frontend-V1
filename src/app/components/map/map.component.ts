import { Component, AfterViewInit, OnDestroy, ViewChild, inject, OnInit, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import { forkJoin , Observable, Subscription } from "rxjs"
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

  // TypeLocale filter properties
  selectedTypeLocales: string[] = []
  isTypeLocaleToggleActive = false

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
        
        // Only reload DVF data when price filter changes and toggle is active
        if (this.isPriceToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadPrice(), 300)
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
        
        // Only reload DVF data when date filter changes and toggle is active
        if (this.isDateToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadDate(), 300)
        }
      }),
      this.formService.getExactDateObservable().subscribe(value => {
        if (value !== null && value !== '') {
          this.exactDate = value;
        } else {
          this.exactDate = null;
        }
        
        // Only reload DVF data when exact date changes and toggle is active
        if (this.isDateToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadDate(), 300)
        }
      }),
      this.formService.getDateModeObservable().subscribe(mode => this.dateMode = mode),
      
      // 💰 Exact price subscription
      this.formService.getExactPriceObservable().subscribe(value => {
        this.exactPrice = value;
        
        // Only reload DVF data when exact price changes and toggle is active
        if (this.isPriceToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadPrice(), 300)
        }
      }),
      
      this.formService.getPriceModeObservable().subscribe(mode => {
        this.priceMode = mode;
      }),

      this.formService.getSelectedEnergyClassesObservable().subscribe(classes => {
        this.energyClasses = classes || [];
        this.updateEnergyFilterState();
        
        // Only reload DPE data when energy classes change and toggle is active
        if (this.isEnergyToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadEnergy(), 300)
        }
      }),
      this.formService.getExactEnergyClassObservable().subscribe(value => {
        this.energyExactClass = value;
        this.updateEnergyFilterState();
        
        // Only reload DPE data when exact energy class changes and toggle is active
        if (this.isEnergyToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadEnergy(), 300)
        }
      }),
      this.formService.getEnergyClassRangeObservable().subscribe(value => {
        this.energyClassRange = value;
        this.updateEnergyFilterState();
        
        // Only reload DPE data when energy class range changes and toggle is active
        if (this.isEnergyToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadEnergy(), 300)
        }
      }),

      this.formService.getConsumptionToggleObservable().subscribe(active => {
        this.isConsumptionToggleActive = active;
        
        if (active) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadConsumption(), 100) // Short debounce for toggle activation
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
      
        // Only reload DPE data when consumption filter changes and toggle is active
        if (this.isConsumptionToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout);
          this.fetchDataTimeout = setTimeout(() => this.reloadConsumption(), 300);
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
      
        // Only reload DPE data when exact consumption changes and toggle is active
        if (this.isConsumptionToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout);
          this.fetchDataTimeout = setTimeout(() => this.reloadConsumption(), 300);
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
    this.fetchDataTimeout = setTimeout(() => this.reloadSurface(), 100)
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
  
  // Only reload Parcelle data when surface range changes and toggle is active
  if (this.isSurfaceToggleActive && value) {
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    this.fetchDataTimeout = setTimeout(() => this.reloadSurface(), 300)
  }
}),

this.formService.getExactSurfaceObservable().subscribe(value => {
  this.exactSurface = value;
  
  // Only reload Parcelle data when exact surface changes and toggle is active
  if (this.isSurfaceToggleActive && value !== null) {
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    this.fetchDataTimeout = setTimeout(() => this.reloadSurface(), 300)
  }
}),

this.formService.getSurfaceModeObservable().subscribe(mode => {
  this.surfaceMode = mode;
  
  // Only reload Parcelle data when surface mode changes and toggle is active
  if (this.isSurfaceToggleActive) {
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    this.fetchDataTimeout = setTimeout(() => this.reloadSurface(), 300)
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

      // ✅ Auto-reload subscription - Re-enabled to fix immediate filter activation
      this.formService.getReloadTrigger().subscribe(() => {
        if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
        this.fetchDataTimeout = setTimeout(() => this.fetchData(), 300) // 300ms debounce
      }
    ));
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

      // Toggle state subscriptions with selective reload triggers
      this.formService.getPriceToggleObservable().subscribe(active => {
        this.isPriceToggleActive = active
        // Set usePriceFilter based on toggle state
        this.usePriceFilter = active;
        console.log(`💰 Price filter toggle ${active ? 'activated' : 'deactivated'} - usePriceFilter set to ${this.usePriceFilter}`);
        
        if (active) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadPrice(), 100)
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
          this.fetchDataTimeout = setTimeout(() => this.reloadDate(), 100)
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
          this.fetchDataTimeout = setTimeout(() => this.reloadEnergy(), 100)
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
          this.fetchDataTimeout = setTimeout(() => this.reloadConsumption(), 100)
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
      this.formService.getTypeLocaleToggleObservable().subscribe(active => {
        this.isTypeLocaleToggleActive = active
        
        if (active) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadTypeLocale(), 100)
        } else {
          // Clear properties when type locale toggle is disabled
          this.visibleDvfProperties = []
          this.visibleDpeProperties = []
          this.visibleParcelleProperties = []
          this.alertMessages['dvf'] = { count: 0, show: false }
          this.alertMessages['dpe'] = { count: 0, show: false }
          this.alertMessages['parcelles'] = { count: 0, show: false }
          this.updateGlobalAlert()
          this.cdr.detectChanges()
        }
      }),
      this.formService.getSelectedTypeLocalesObservable().subscribe(value => {
        this.selectedTypeLocales = value || []
        
        if (this.isTypeLocaleToggleActive) {
          if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
          this.fetchDataTimeout = setTimeout(() => this.reloadTypeLocale(), 300)
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

  // Selective reload methods for each filter type
  private reloadPrice(): void {
    if (!this.markersVisible) return
    
    this.formService.setPriceLoading(true)
    
    this.loadDvfDataAsync().finally(() => {
      this.formService.setPriceLoading(false)
      this.updateGlobalAlert()
      this.cdr.detectChanges()
      
      // Force immediate marker update after price data is loaded
      if (this.mapDisplay) {
        this.mapDisplay.forceUpdateMarkers()
      }
    })
  }

  private reloadDate(): void {
    if (!this.markersVisible) return
    
    this.formService.setDateLoading(true)
    
    this.loadDvfDataAsync().finally(() => {
      this.formService.setDateLoading(false)
      this.updateGlobalAlert()
      this.cdr.detectChanges()
    })
  }

  private reloadEnergy(): void {
    if (!this.markersVisible) return
    
    this.formService.setEnergyLoading(true)
    
    this.loadDpeDataAsync().finally(() => {
      this.formService.setEnergyLoading(false)
      this.updateGlobalAlert()
      this.cdr.detectChanges()
    })
  }

  private reloadConsumption(): void {
    if (!this.markersVisible) return
    
    this.formService.setConsumptionLoading(true)
    
    this.loadDpeDataAsync().finally(() => {
      this.formService.setConsumptionLoading(false)
      this.updateGlobalAlert()
      this.cdr.detectChanges()
    })
  }

  private reloadSurface(): void {
    if (!this.markersVisible) return
    
    this.formService.setSurfaceLoading(true)
    
    this.loadParcelleDataAsync().finally(() => {
      this.formService.setSurfaceLoading(false)
      this.updateGlobalAlert()
      this.cdr.detectChanges()
    })
  }

  private reloadTypeLocale(): void {
    if (!this.markersVisible) return
    
    this.formService.setTypeLocaleLoading(true)
    
    this.loadDvfDataAsync().finally(() => {
      this.loadDpeDataAsync().finally(() => {
        this.loadParcelleDataAsync().finally(() => {
          this.formService.setTypeLocaleLoading(false)
          this.updateGlobalAlert()
          this.cdr.detectChanges()
        })
      })
    })
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
      if (this.isTypeLocaleToggleActive) {
        this.formService.setTypeLocaleLoading(true)
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
        this.formService.setTypeLocaleLoading(false)
        
        this.updateGlobalAlert()
        this.cdr.detectChanges()
      })
    }, 300)
  }

  private async loadDvfDataAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      // DVF should ONLY load if price OR date filter is active
      // Type Locale filter should work as "join filter" only when price/date are already active
      if (!this.isPriceToggleActive && !this.isDateToggleActive) {
        this.visibleDvfProperties = []
        this.alertMessages['dvf'] = { count: 0, show: false }
        // Force marker update when clearing data
        this.cdr.detectChanges()
        if (this.mapDisplay) {
          this.mapDisplay.forceUpdateMarkers()
        }
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
        } else if (this.priceMode === 'range') {
          priceRange = [this.minPrice, this.maxPrice]
          console.log('💰 DVF price range applied:', priceRange)
        }
      }

      let dateRange: [string, string] | null = null
      let exactDate: string | null = null
      
      if (this.isDateToggleActive) {
        if (this.dateMode === "exact" && this.exactDate && this.exactDate !== '') {
          exactDate = this.exactDate
        } else if (this.dateMode === "range") {
          dateRange = [this.startDate, this.endDate]
        }
      } 

      let typeLocaleFilter: string[] | null = null
      if (this.isTypeLocaleToggleActive && this.selectedTypeLocales && this.selectedTypeLocales.length > 0) {
        typeLocaleFilter = this.selectedTypeLocales
        console.log('🏠 DVF - Type Locale filter applied:', typeLocaleFilter)
      } else {
        console.log('🏠 DVF - No Type Locale filter applied (toggle inactive or no selection)')
        typeLocaleFilter = null  // Explicitly set to null when toggle is inactive
      }

      this.dvfService.getDvfProperties(topLeft, bottomRight, priceRange, exactPrice, dateRange, typeLocaleFilter, exactDate).subscribe({
        next: (properties: DvfProperty[]) => {
          console.log('💰 DVF Data received:', properties.length, 'properties')
          this.visibleDvfProperties = properties
          this.alertMessages['dvf'] = { 
            count: properties.length, 
            show: properties.length >= this.maxResults 
          }
          
          // Force immediate marker update after data is received
          console.log('💰 Calling cdr.detectChanges() and forceUpdateMarkers()')
          this.cdr.detectChanges()
          if (this.mapDisplay) {
            this.mapDisplay.forceUpdateMarkers()
            console.log('💰 forceUpdateMarkers() called successfully')
          } else {
            console.error('💰 mapDisplay is null/undefined!')
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
          dateRange = [this.startDate, this.endDate]
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

      // 🏠 Type Locale filter parameters
      let typeLocaleFilter: string[] | null = null
      if (this.isTypeLocaleToggleActive && this.selectedTypeLocales && this.selectedTypeLocales.length > 0) {
        typeLocaleFilter = this.selectedTypeLocales
        console.log('🏠 DPE - Type Locale filter applied:', typeLocaleFilter)
      } else {
        console.log('🏠 DPE - No Type Locale filter applied (toggle inactive or no selection)')
        typeLocaleFilter = null  // Explicitly set to null when toggle is inactive
      }

      // Make separate independent requests based on active filters
      let dpeObservables: Observable<DpeProperty[]>[] = [];

      // 1. Classe Energie filter (independent)
      if (energyFilter && Array.isArray(energyFilter) && energyFilter.length > 0 && filterMode === 'class') {
        dpeObservables.push(
          this.dpeService.getDpePropertiesByClasse(topLeft, bottomRight, energyFilter, typeLocaleFilter)
        );
      }

      // 2. Consumption filter (independent) 
      if (consumptionFilterToUse || exactConsumptionToUse) {
        dpeObservables.push(
          this.dpeService.getDpePropertiesByConsumption(topLeft, bottomRight, consumptionFilterToUse, exactConsumptionToUse, typeLocaleFilter)
        );
      }

      // 3. Valeur DPE filter (independent)
      if (energyFilter && filterMode !== 'class') {
        // Type guard function to check if energyFilter is a valid number tuple
        const isNumberTuple = (value: any): value is [number, number] => {
          return Array.isArray(value) && 
                 value.length === 2 && 
                 typeof value[0] === 'number' && 
                 typeof value[1] === 'number';
        };

        // Use the type guard to safely determine if we have a valid number tuple
        const valeurFilter = isNumberTuple(energyFilter) ? energyFilter : null;
        
        // Check if energyFilter is a number for exact value
        const exactValeur = typeof energyFilter === 'number' ? energyFilter : null;
        
        dpeObservables.push(
          this.dpeService.getDpePropertiesByValeur(topLeft, bottomRight, valeurFilter, exactValeur, typeLocaleFilter)
        );
      }

      // If no specific filters, make a general request
      if (dpeObservables.length === 0) {
        dpeObservables.push(
          this.dpeService.getDpeProperties(topLeft, bottomRight, {}, typeLocaleFilter)
        );
      }

      // Combine all independent requests
      forkJoin(dpeObservables).subscribe({
        next: (properties: DpeProperty[][]) => {
          this.visibleDpeProperties = properties.flat()
          
          // Update alert state
          this.alertMessages['dpe'] = {
            count: this.visibleDpeProperties.length,
            show: this.visibleDpeProperties.length >= this.maxResults
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

      let typeLocaleFilter: string[] | null = null
      if (this.isTypeLocaleToggleActive && this.selectedTypeLocales && this.selectedTypeLocales.length > 0) {
        typeLocaleFilter = this.selectedTypeLocales
        console.log('🏠 Parcelle - Type Locale filter applied:', typeLocaleFilter)
      } else {
        console.log('🏠 Parcelle - No Type Locale filter applied (toggle inactive or no selection)')
        typeLocaleFilter = null  // Explicitly set to null when toggle is inactive
      }

      if (typeLocaleFilter) {
        if (!Array.isArray(typeLocaleFilter)) {
          console.error('Invalid Type Locale filter:', typeLocaleFilter)
          typeLocaleFilter = null
        } else if (typeLocaleFilter.length === 0) {
          console.log('Empty Type Locale filter, ignoring')
          typeLocaleFilter = null
        }
      }

      this.parcelleService.getParcelleProperties(topLeft, bottomRight, surfaceParam, typeLocaleFilter).subscribe({
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
