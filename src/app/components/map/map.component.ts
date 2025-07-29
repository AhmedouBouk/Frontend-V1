import {
  Component,
  type AfterViewInit,
  type OnDestroy,
  ViewChild,
  inject,
  type OnInit,
  ChangeDetectorRef,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import { HttpClient } from "@angular/common/http"
import type { Subscription } from "rxjs"
import type { DvfProperty } from "../../models/dvf-property.model"
import type { DpeProperty } from "../../models/dpe.model"
import type { ParcelleProperty } from "../../models/parcelle.model"
import { MapService } from "../../services/map.service"
import { FormService } from "../../services/form.service"
import { DvfService } from "../../services/dvf.service"
import { DpeService } from "../../services/dpe.service"
import { ParcelleService } from "../../services/parcelle.service"

// Import the three new components
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
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  // Timeout for debouncing map movements
  private mapMoveTimeout: any = null;

  @ViewChild(MapDisplayComponent) mapDisplay!: MapDisplayComponent

  private fetchDataTimeout: any

  // Source de données courante
  currentDataSource = "dvf"

  // Activation des filtres
  usePriceFilter = false
  useDateFilter = false
  useSurfaceFilter = false
  useEnergyFilter = false

  public minPrice = 0
  public maxPrice = 2000000
  public startDate = "2020-01-01"
  public endDate = "2023-12-31"
  public minSurface = 0
  public maxSurface = 10000
  public energyClasses: string[] = []
  public energyExactClass: string | null = null
  public energyClassRange: [string, string] | null = null

  public visibleDvfProperties: DvfProperty[] = []
  public visibleDpeProperties: DpeProperty[] = []
  public visibleParcelleProperties: ParcelleProperty[] = []
  public selectedPropertyIndex: number | null = null
  public tableCollapsed = false // Sidebar ouvert par défaut
  public isLoading = false
  public dateMode = "exact"
  public exactDate = ""
  
  // Alert properties
  public showAlert = false
  public resultCount = 0
  public maxResults = 500

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
      console.log(`✅ Tous les filtres désactivés pour ${this.currentDataSource} — pas de requête API`)
    }
  }

  ngOnInit(): void {
    // Initialize subscriptions to form service events
  }

  ngAfterViewInit(): void {
    this.subscriptions.push(
      // Re-enable map refresh for search button functionality
      this.mapService.getRefreshObservable().subscribe(() => {
        console.log('🔄 Map refresh requested - triggering fetchData')
        this.fetchData()
      }),

      // Data source subscription - only update the source, don't fetch data automatically
      this.formService
        .getDataSourceObservable()
        .subscribe((source) => {
          console.log('📊 Data source changed to:', source)
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
            this.usePriceFilter = true
            console.log('💰 Price filter updated:', min, 'to', max)
          } else {
            this.usePriceFilter = false
            this.minPrice = 0
            this.maxPrice = 0
            console.log('💰 Price filter cleared')
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
            this.useDateFilter = true
            console.log('📅 Date filter updated:', start, 'to', end)
          } else {
            this.useDateFilter = false
            this.startDate = ""
            this.endDate = ""
            this.exactDate = ""
            console.log('📅 Date filter cleared')
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
            console.log('🏠 Surface filter updated:', min, 'to', max)
          } else {
            this.useSurfaceFilter = false
            this.minSurface = 0
            this.maxSurface = 0
            console.log('🏠 Surface filter cleared')
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
          console.log('⚡ Energy classes filter updated:', classes)
          if (classes && classes.length > 0) {
            // Always activate filter when classes are selected
            this.useEnergyFilter = true
            this.energyClasses = classes
            this.energyClassRange = ["",""]
            this.energyExactClass = null
            console.log('⚡ Energy filter activated with classes:', classes)
          } else {
            this.useEnergyFilter = false
            this.energyClasses = []
            console.log('⚡ No energy classes selected - filter disabled')
            // Clear displayed properties when filter is disabled
            if (this.currentDataSource === 'dpe') {
              this.visibleDpeProperties = []
              this.cdr.detectChanges()
            }
          }
        }),

      // DPE filters - Exact class
      this.formService
        .getExactEnergyClassObservable()
        .subscribe((exactClass: string | null) => {
          if (exactClass) {
            this.useEnergyFilter = true
            this.energyExactClass = exactClass
            this.energyClasses = []
            this.energyClassRange = ["",""]
            console.log('⚡ Exact energy class filter updated:', exactClass)
          } else {
            this.energyExactClass = null
            console.log('⚡ Exact energy class filter cleared')
          }
        }),

      // DPE filters - Class range
      this.formService
        .getEnergyClassRangeObservable()
        .subscribe((range: [string, string] | null) => {
          if (range) {
            this.useEnergyFilter = true
            this.energyClassRange = range
            this.energyClasses = []
            this.energyExactClass = null
            console.log('⚡ Energy class range filter updated:', range)
          } else {
            this.useEnergyFilter = false
            this.energyClasses = []
            console.log('⚡ Energy class range filter cleared')
            // Clear displayed properties when filter is disabled
            if (this.currentDataSource === 'dpe') {
              this.visibleDpeProperties = []
              this.cdr.detectChanges()
            }
          }
        }),
    )
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
    if (this.mapMoveTimeout) clearTimeout(this.mapMoveTimeout)
  }

  // Handle map movement events with debouncing
  onMapMoved(): void {
    console.log('🗺️ Map moved - scheduling data refresh...')
    
    // Clear any existing timeout to prevent multiple requests
    if (this.mapMoveTimeout) {
      clearTimeout(this.mapMoveTimeout)
    }
    
    // Debounce the data fetching to avoid too many requests
    this.mapMoveTimeout = setTimeout(() => {
      console.log('🔄 Auto-refreshing data after map movement')
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

  // Handle sidebar toggle - only toggles the UI without fetching data
  onToggleSidebar(): void {
    this.tableCollapsed = !this.tableCollapsed
    setTimeout(() => {
      this.mapDisplay.invalidateSize()
    }, 300)
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

  // Handle table toggle
  onTableToggled(collapsed: boolean): void {
    this.tableCollapsed = collapsed
    console.log('📊 Sidebar toggled:', collapsed ? 'fermé' : 'ouvert')
  }

  // Handle map size invalidation
  onMapSizeInvalidated(): void {
    this.mapDisplay.invalidateSize()
  }

  // Handle location search from search component
  onLocationSelected(location: {lat: number, lon: number, name: string}): void {
    console.log('📍 Location selected:', location)
    
    // Center map on selected location
    this.mapDisplay.setMapView(location.lat, location.lon, 14)
    
    // Optionally fetch data for the new location
    setTimeout(() => {
      this.fetchData()
    }, 500)
  }

  // Handle user location request from search component
  onUserLocationRequested(): void {
    console.log('📍 User location requested')
    this.onLocateUser()
  }

  private fetchData(): void {
    if (this.fetchDataTimeout) {
      clearTimeout(this.fetchDataTimeout)
    }

    setTimeout(() => {
      this.isLoading = true
      this.cdr.detectChanges()
    }, 0)

    this.fetchDataTimeout = setTimeout(() => {
      if (!this.mapDisplay) {
        console.error("Map display not initialized")
        setTimeout(() => {
          this.isLoading = false
          this.cdr.detectChanges()
        }, 0)
        return
      }

      switch (this.currentDataSource) {
        case "dvf":
          this.loadDvfData()
          break
        case "dpe":
          this.loadDpeData()
          break
        case "parcelles":
          this.loadParcelleData()
          break
        case "none":
          console.log('🚫 Aucune source de données sélectionnée - pas de chargement')
          this.isLoading = false
          // Clear all data when no source is selected
          this.visibleDvfProperties = []
          this.visibleDpeProperties = []
          this.visibleParcelleProperties = []
          this.resultCount = 0
          this.showAlert = false
          break
        default:
          console.error(`❌ Source de données inconnue: ${this.currentDataSource}`)
          this.isLoading = false
      }
    }, 300)
  }

  private loadDvfData(): void {
    // Continue even if no filters are applied - we want to show all data in this case
    // instead of returning empty results

    const bounds = this.mapDisplay.getMapBounds()
    if (!bounds) return

    const lat_min = bounds.getSouth()
    const lat_max = bounds.getNorth()
    const lon_min = bounds.getWest()
    const lon_max = bounds.getEast()

    const topLeft: [number, number] = [lat_max, lon_min]
    const bottomRight: [number, number] = [lat_min, lon_max]

    // Only set price range if the filter is explicitly enabled
    // This prevents sending extreme values (0 to 10,000,000) when no filter is applied
    let priceRange: [number, number] | null = null
    if (this.usePriceFilter && this.minPrice !== 0 && this.maxPrice !== 0) {
      priceRange = [this.minPrice, this.maxPrice]
    }

    let dateRange: [string, string] | null = null
    let exactDate: string | null = null
    if (this.useDateFilter) {
      if (this.dateMode === "range") {
        dateRange = [this.startDate, this.endDate || this.startDate]
      } else if (this.dateMode === "exact") {
        exactDate = this.exactDate
      }
    }

    let surfaceRange: [number, number] | null = null
    if (this.useSurfaceFilter) {
      surfaceRange = [this.minSurface, this.maxSurface]
    }

    this.dvfService
      .getDvfProperties(topLeft, bottomRight, priceRange, dateRange, exactDate, surfaceRange, null, null, null, null, 500)
      .subscribe({
        next: (properties: DvfProperty[]) => {
          console.log("Received DVF data successfully:", properties.length, "properties")
          this.visibleDvfProperties = properties
          
          // Update alert state
          this.resultCount = properties.length
          this.showAlert = properties.length >= this.maxResults

          setTimeout(() => {
            this.isLoading = false
            this.cdr.detectChanges()
          }, 0)

          // DISABLED: Automatic fit to markers to prevent infinite loop
          // if (properties.length > 0) {
          //   this.mapDisplay.fitToMarkers()
          // }
        },
        error: (error: any) => {
          console.error("Error fetching DVF data:", error)
          setTimeout(() => {
            this.isLoading = false
            this.cdr.detectChanges()
          }, 0)
        },
      })
  }

  private loadDpeData(): void {
    // Always load DPE data when requested, regardless of filter state
    // The backend will handle filtering based on the provided parameters

    const bounds = this.mapDisplay.getMapBounds()
    if (!bounds) return

    const topLeft: [number, number] = [bounds.getNorth(), bounds.getWest()]
    const bottomRight: [number, number] = [bounds.getSouth(), bounds.getEast()]

    // Determine energy filter mode and values
    let energyFilter: string[] | number | [number, number] | null = null
    let filterMode: 'exact' | 'interval' | 'class' = 'class'

    if (this.energyClasses && this.energyClasses.length > 0) {
      // Class filtering mode
      energyFilter = this.energyClasses
      filterMode = 'class'
    } else if (this.energyExactClass) {
      // Exact class filtering (treat as single class array)
      energyFilter = [this.energyExactClass]
      filterMode = 'class'
    } else if (this.energyClassRange && this.energyClassRange.length === 2) {
      // Range filtering - convert to class array (A to C = ['A', 'B', 'C'])
      const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
      const startIndex = classes.indexOf(this.energyClassRange[0])
      const endIndex = classes.indexOf(this.energyClassRange[1])
      if (startIndex !== -1 && endIndex !== -1) {
        energyFilter = classes.slice(startIndex, endIndex + 1)
        filterMode = 'class'
      }
    }

    // Surface range for DPE filtering
    const surfaceRange: [number, number] = this.useSurfaceFilter 
      ? [this.minSurface, this.maxSurface] 
      : [0, 10000]

    console.log('🏠 DPE Energy filter:', { filterMode, energyFilter, surfaceRange })

    this.dpeService
      .getDpeProperties(
        topLeft,
        bottomRight,
        energyFilter,
        filterMode,
        surfaceRange
      )
      .subscribe({
        next: (properties: DpeProperty[]) => {
          console.log("Received DPE data successfully:", properties.length, "properties")
          this.visibleDpeProperties = properties
          
          // Update alert state
          this.resultCount = properties.length
          this.showAlert = properties.length >= this.maxResults

          setTimeout(() => {
            this.isLoading = false
            this.cdr.detectChanges()
          }, 0)

          // DISABLED: Automatic fit to markers to prevent infinite loop
          // if (properties.length > 0) {
          //   this.mapDisplay.fitToMarkers()
          // }
        },
        error: (error) => {
          console.error("Error fetching DPE data:", error)
          setTimeout(() => {
            this.isLoading = false
            this.cdr.detectChanges()
          }, 0)
        },
      })
  }

  private loadParcelleData(): void {
    if (!this.useSurfaceFilter) {
      this.visibleParcelleProperties = []
      setTimeout(() => {
        this.isLoading = false
        this.cdr.detectChanges()
      }, 0)
      return
    }

    const bounds = this.mapDisplay.getMapBounds()
    if (!bounds) return

    const topLeft: [number, number] = [bounds.getNorth(), bounds.getWest()]
    const bottomRight: [number, number] = [bounds.getSouth(), bounds.getEast()]

    this.parcelleService.getParcelleProperties(topLeft, bottomRight, [this.minSurface, this.maxSurface]).subscribe({
      next: (properties: ParcelleProperty[]) => {
        console.log("Received Parcelle data successfully:", properties.length, "properties")
        this.visibleParcelleProperties = properties
        
        // Update alert state
        this.resultCount = properties.length
        this.showAlert = properties.length >= this.maxResults

        setTimeout(() => {
          this.isLoading = false
          this.cdr.detectChanges()
        }, 0)

        // DISABLED: Automatic fit to markers to prevent infinite loop
        // if (properties.length > 0) {
        //   this.mapDisplay.fitToMarkers()
        // }
      },
      error: (error: any) => {
        console.error("Error fetching parcelle data:", error)
        setTimeout(() => {
          this.isLoading = false
          this.cdr.detectChanges()
        }, 0)
      },
    })
  }
}
