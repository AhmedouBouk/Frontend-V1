import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  OnInit,
  ChangeDetectorRef
} from "@angular/core"
import { CommonModule } from "@angular/common"
import * as L from "leaflet"
import "leaflet/dist/leaflet.css"
import { HttpClient } from "@angular/common/http"
import type { Subscription } from "rxjs" // Import Observable
import { DvfProperty } from "../../models/dvf-property.model"
import { DpeProperty } from "../../models/dpe.model"
import { ParcelleProperty } from "../../models/parcelle.model"
import { MapService } from "../../services/map.service"
import { FormService } from "../../services/form.service"
import { DvfService } from "../../services/dvf.service"
import { DpeService } from "../../services/dpe.service"
import { ParcelleService } from "../../services/parcelle.service"

// Create a default icon for Leaflet markers - fixes the missing icon issue in Angular
const defaultIcon = L.icon({
  iconUrl: 'assets/marker-icon.png',
  iconRetinaUrl: 'assets/marker-icon-2x.png', 
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  tooltipAnchor: [16, -28]
});

@Component({
  selector: "app-map",
  standalone: true,
  imports: [CommonModule],
  styleUrls: ["./map.component.scss"],
  templateUrl: "./map.component.html",
})
export class MapComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild("map") private readonly mapContainer!: ElementRef
  private map: any
  private markers: L.Marker[] = []
  private featureGroup: any // Kept as 'any' to avoid previous TS2694 error
  private fetchDataTimeout: any
  private baseLayers: any = {}
  private currentLayer: any  // Source de données courante (pour l'affichage des exportations et des tableaux)
  currentDataSource: string = "dvf"

  // Indicateur si les données doivent être affichées
  showDvfData: boolean = true
  showDpeData: boolean = true
  showParcellesData: boolean = true

  // Activation des filtres (indépendants du data source)
  usePriceFilter: boolean = false
  useDateFilter: boolean = false
  useSurfaceFilter: boolean = false
  useEnergyFilter: boolean = false
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
  public tableCollapsed = false
  public isLoading = false
  public dateMode = "exact"
  public exactDate = ""
  public exportDropdownOpen = false // State for export dropdown

  // Services for API calls will be used instead of mock data

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
      (this.currentDataSource === "dvf" && (this.usePriceFilter || this.useDateFilter || this.useSurfaceFilter || this.useEnergyFilter)) ||
      (this.currentDataSource === "parcelles" && this.useSurfaceFilter) ||
      (this.currentDataSource === "dpe" && this.useEnergyFilter)

    if (hasActiveFilters) {
      this.fetchData()
    } else {
      this.clearMarkers()
      this.visibleDvfProperties = []
      this.visibleDpeProperties = []
      this.visibleParcelleProperties = []
      console.log(`✅ Tous les filtres désactivés pour ${this.currentDataSource} — pas de requête API`)
    }
  }

  ngOnInit(): void {
    // We'll initialize subscriptions to any events from formService if needed
    // Form filter changes will be handled through direct method calls
    // This ensures proper typing and avoids any undefined methods
  }

  ngAfterViewInit(): void {
    this.initMap()

    this.subscriptions.push(
      this.mapService.getRefreshObservable().subscribe(() => this.fetchData()),

      // Abonnement à la source de données
      this.formService
        .getDataSourceObservable()
        .subscribe((source) => {
          this.currentDataSource = source
          this.clearMarkers()
          this.fetchData()
        }),

      // Filtres DVF
      this.formService
        .getPriceFilterObservable()
        .subscribe((filter) => {
          if (filter) {
            const [min, max] = filter
            this.minPrice = min
            this.maxPrice = max
            this.usePriceFilter = true
            if (this.currentDataSource === "dvf") {
              this.fetchData()
            }
          } else {
            this.usePriceFilter = false
            this.minPrice = 0
            this.maxPrice = 0
            this.checkAndFetchIfNeeded()
          }
        }),

      this.formService.getDateFilterObservable().subscribe((filter) => {
        if (filter) {
          const [start, end] = filter
          this.startDate = start
          this.endDate = end
          this.useDateFilter = true
          if (this.currentDataSource === "dvf") {
            this.fetchData()
          }
        } else {
          this.useDateFilter = false
          this.startDate = ""
          this.endDate = ""
          this.exactDate = ""
          this.checkAndFetchIfNeeded()
        }
      }),

      // Filtres Parcelle
      this.formService
        .getSurfaceFilterObservable()
        .subscribe((filter) => {
          if (filter) {
            const [min, max] = filter
            this.minSurface = min
            this.maxSurface = max
            this.useSurfaceFilter = true
            if (this.currentDataSource === "parcelles") {
              this.fetchData()
            }
          } else {
            this.useSurfaceFilter = false
            this.minSurface = 0
            this.maxSurface = 0
            this.checkAndFetchIfNeeded()
          }
        }),

      // Filtres DPE - Sélection multiple
      this.formService
        .getSelectedEnergyClassesObservable()
        .subscribe((classes: string[] | null) => {
          if (classes && classes.length > 0) {
            this.energyClasses = classes
            this.useEnergyFilter = true
            this.energyExactClass = null
            this.energyClassRange = null
            if (this.currentDataSource === "dpe") {
              this.fetchData()
            }
          } else {
            // Géré par les autres souscriptions ou clearEnergyClassFilter()
          }
        }),
        
      // Filtres DPE - Classe exacte
      this.formService
        .getExactEnergyClassObservable()
        .subscribe((energyClass: string | null) => {
          if (energyClass) {
            this.useEnergyFilter = true
            this.energyExactClass = energyClass
            this.energyClasses = []
            this.energyClassRange = null
            if (this.currentDataSource === "dpe") {
              this.fetchData()
            }
          } else {
            // Géré par les autres souscriptions ou clearEnergyClassFilter()
          }
        }),
        
      // Filtres DPE - Plage de classes
      this.formService
        .getEnergyClassRangeObservable()
        .subscribe((range: [string, string] | null) => {
          if (range) {
            this.useEnergyFilter = true
            this.energyClassRange = range
            this.energyClasses = []
            this.energyExactClass = null
            if (this.currentDataSource === "dpe") {
              this.fetchData()
            }
          } else {
            this.useEnergyFilter = false
            this.energyClasses = []
            this.checkAndFetchIfNeeded()
          }
        }),

      // S'abonner aux changements de type de carte
      this.mapService
        .getMapTypeObservable()
        .subscribe((type) => {
          if (this.map && this.baseLayers) {
            if (this.currentLayer) {
              this.map.removeLayer(this.currentLayer)
            }
            if (this.baseLayers[type]) {
              this.currentLayer = this.baseLayers[type].addTo(this.map)
            } else {
              this.currentLayer = this.baseLayers.street.addTo(this.map) // Fallback
            }
          }
        }),
    )
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    if (this.map) this.map.remove()
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
  }

  private initMap(): void {
    setTimeout(() => {
      if (!this.mapContainer) {
        console.error("Map container not found")
        return
      }

      // Create the map
      this.map = L.map(this.mapContainer.nativeElement, {
        center: [46.603354, 1.888334], // Center of France
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      })

      // Add zoom control to bottom right
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(this.map)

      // Add attribution control
      const attributionControl = L.control({
        position: "bottomright",
      }) as any

      attributionControl.onAdd = () => {
        const div = L.DomUtil.create("div", "leaflet-control-attribution")
        div.innerHTML = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        return div
      }

      attributionControl.addTo(this.map)

      // Define base layers
      this.baseLayers = {
        street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }),
        satellite: L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            attribution: "© Esri",
          },
        ),
        cadastre: (L as any).tileLayer.wms("https://data.geopf.fr/wms-r/wms", {
          layers: "CADASTRALPARCELS.PARCELLAIRE_EXPRESS",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "© IGN - Cadastre",
          opacity: 0.7,
        }),
      }

      // Create feature group for markers using type assertion
      this.featureGroup = (L as any).layerGroup().addTo(this.map)

      // Add the default layer to the map
      this.currentLayer = this.baseLayers.street.addTo(this.map)

      // Force a map resize to ensure it displays correctly
      this.map.invalidateSize(true)

      // Set up event listeners for map movement and zoom
      this.map.on("moveend", () => {
        console.log("Map moved to:", this.map.getCenter(), "at zoom level:", this.map.getZoom())
        this.checkAndFetchIfNeeded()
      })

      this.map.on("zoomend", () => {
        this.checkAndFetchIfNeeded()
      })

      // Additional timeout to ensure map is properly sized
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize()
        }
      }, 300)
    }, 100)
  }

  // Method to center the map (called by MapService)
  centerMap(): void {
    if (this.map) {
      this.map.setView([46.603354, 1.888334], 6)
    }
  }

  private fetchData(): void {
    // Annuler toute requête en cours
    if (this.fetchDataTimeout) {
      clearTimeout(this.fetchDataTimeout)
    }

    // Indiquer que le chargement est en cours
    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.isLoading = true;
      this.cdr.detectChanges();
    }, 0);

    // Attendre un court instant pour éviter les appels trop fréquents
    this.fetchDataTimeout = setTimeout(() => {
      // Vérifier si la carte est initialisée
      if (!this.map) {
        console.error(" Carte non initialisée")
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
        return;
      }

      // Appeler la méthode appropriée selon la source de données
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
        default:
          console.error(`❌ Source de données inconnue: ${this.currentDataSource}`)
          this.isLoading = false
      }
    }, 300)
  }

  private loadDvfData(): void {
    // Ne pas rafraîchir si aucun filtre n'est activé
    if (!this.usePriceFilter && !this.useDateFilter && !this.useSurfaceFilter && !this.useEnergyFilter) {
      this.clearMarkers()
      this.visibleDvfProperties = []
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
      return
    }

    // Use HTTP service to fetch DVF data
    // Get current map bounds to limit the geographic area
    const bounds = this.map.getBounds();
    const lat_min = bounds.getSouth();
    const lat_max = bounds.getNorth();
    const lon_min = bounds.getWest();
    const lon_max = bounds.getEast();
    
    // Log the request parameters for debugging
    console.log('DVF Request parameters:', {
      lat_min: lat_min.toString(),
      lat_max: lat_max.toString(),
      lon_min: lon_min.toString(),
      lon_max: lon_max.toString(),
      prix_min: this.usePriceFilter ? this.minPrice.toString() : 'n/a',
      prix_max: this.usePriceFilter ? this.maxPrice.toString() : 'n/a',
      date_min: this.useDateFilter ? this.startDate : 'n/a',
      date_max: this.useDateFilter ? this.endDate : 'n/a',
      surface_min: this.useSurfaceFilter ? this.minSurface.toString() : 'n/a',
      surface_max: this.useSurfaceFilter ? this.maxSurface.toString() : 'n/a',
      energy_class: this.useEnergyFilter ? (
        this.energyExactClass || 
        (this.energyClassRange ? `${this.energyClassRange[0]}-${this.energyClassRange[1]}` : '') ||
        (this.energyClasses.length > 0 ? this.energyClasses.join(',') : '')
      ) : 'n/a'
    });
    
    // Create the parameters needed for DVF service
    const topLeft: [number, number] = [lat_max, lon_min];
    const bottomRight: [number, number] = [lat_min, lon_max];
    
    // Set up price filter if enabled
    let priceRange: [number, number] | null = null;
    if (this.usePriceFilter) {
      priceRange = [this.minPrice, this.maxPrice];
    }
    
    // Set up date filter if enabled
    let dateRange: [string, string] | null = null;
    let exactDate: string | null = null;
    if (this.useDateFilter) {
      if (this.dateMode === 'range') {
        dateRange = [this.startDate, this.endDate || this.startDate];
      } else if (this.dateMode === 'exact') {
        exactDate = this.exactDate;
      }
    }
    
    // Set up surface filter if enabled
    let surfaceRange: [number, number] | null = null;
    let exactSurface: number | null = null;
    if (this.useSurfaceFilter) {
      surfaceRange = [this.minSurface, this.maxSurface];
    }
    
    // Set up energy class filter if enabled
    let energyClassRange: [string, string] | null = null;
    let exactEnergyClass: string | null = null;
    let selectedEnergyClasses: string[] | null = null;
    
    if (this.useEnergyFilter) {
      if (this.energyExactClass) {
        exactEnergyClass = this.energyExactClass;
      } else if (this.energyClassRange) {
        energyClassRange = this.energyClassRange;
      } else if (this.energyClasses.length > 0) {
        selectedEnergyClasses = this.energyClasses;
      }
    }
    
    // Use the DvfService instead of direct HTTP call with all filter parameters
    this.dvfService.getDvfProperties(
      topLeft, 
      bottomRight, 
      priceRange, 
      dateRange,
      exactDate,
      surfaceRange,
      exactSurface,
      energyClassRange,
      exactEnergyClass,
      selectedEnergyClasses
    ).subscribe({
      next: (properties: DvfProperty[]) => {
        console.log('Received DVF data successfully:', properties.length, 'properties');
        
        // The service already returns parsed DvfProperty objects, no need for manual parsing
        
        console.log(`🟢 ${properties.length} propriétés DVF filtrées`);
        this.clearMarkers();
        
        // Use the properties directly (already the correct type)
        this.visibleDvfProperties = properties;
        
        properties.forEach((property: DvfProperty) => {
          this.addDvfMarker(property);
        });
        
        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
        
        // Fit map to markers if there are any
        if (this.markers.length > 0) {
          const group = new (L as any).LatLngBounds();
          this.markers.forEach((marker) => {
            group.extend(marker.getLatLng());
          });
          this.map.fitBounds(group);
        }
      },
      error: (error: any) => {
        console.error('Error fetching DVF data:', error);
        if (error && error.status === 200) {
          console.warn('Received status 200 but treated as error. Response:', error);
        }
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  private loadDpeData(): void {
    if (!this.useEnergyFilter) {
      this.clearMarkers()
      this.visibleDpeProperties = []
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
      return
    }

    // Get current map bounds to limit the geographic area
    const bounds = this.map.getBounds();
    const topLeft: [number, number] = [bounds.getNorth(), bounds.getWest()];
    const bottomRight: [number, number] = [bounds.getSouth(), bounds.getEast()];

    // Log selected energy classes for debugging
    console.log('Energy classes selected:', this.energyClasses);
    console.log('Geographic bounds:', { topLeft, bottomRight });
    
    // Use the DpeService to fetch DPE data with proper filtering
    this.dpeService.getDpeProperties(
      topLeft,
      bottomRight,
      this.useEnergyFilter && this.energyClasses.length > 0 ? this.energyClasses : null,
      'class' // Using class mode for filtering
    ).subscribe({
      next: (properties: DpeProperty[]) => {
        console.log('Received DPE data successfully:', properties.length, 'properties');
        
        console.log(`🟢 ${properties.length} propriétés DPE filtrées`);
        this.clearMarkers();
        
        this.visibleDpeProperties = properties;
        
        properties.forEach((property: DpeProperty) => {
          this.addDpeMarker(property);
        });
        
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
        
        // Fit map to markers if there are any
        if (this.markers.length > 0) {
          const group = new (L as any).LatLngBounds();
          this.markers.forEach((marker) => {
            group.extend(marker.getLatLng());
          });
          this.map.fitBounds(group);
        }
      },
      error: (error) => {
        console.error('Error fetching DPE data:', error);
        if (error.status === 200) {
          console.warn('Received status 200 but treated as error. Response:', error);
        }
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  private loadParcelleData(): void {
    if (!this.useSurfaceFilter) {
      this.clearMarkers()
      this.visibleParcelleProperties = []
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
      return
    }

    // Use HTTP service to fetch Parcelle data
    // Construct params object for type safety
    const params: {[key: string]: string} = {};
    
    // Add surface filter parameters if enabled
    if (this.useSurfaceFilter) {
      params['minSurface'] = this.minSurface.toString();
      params['maxSurface'] = this.maxSurface.toString();
    }
    
    // Log request parameters for debugging
    console.log('Parcelle Request parameters:', params);
    
    // Use text response type to handle any response format
    this.http.get('/geolocdpe/api/v0/parcelles', { params, responseType: 'text' }).subscribe({
      next: (textResponse) => {
        let data;
        try {
          // Try to parse the response as JSON
          data = JSON.parse(textResponse);
          console.log('Parsed Parcelle data successfully:', typeof data);
        } catch (e) {
          console.error('Error parsing Parcelle response as JSON:', e);
          console.log('Raw response:', textResponse);
          setTimeout(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          }, 0);
          return;
        }
        
        // Verify that data is an array
        if (!Array.isArray(data)) {
          console.error('Parcelle data is not an array:', data);
          setTimeout(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          }, 0);
          return;
        }
        
        console.log(`🟢 ${data.length} parcelles filtrées`)
        this.clearMarkers()
        
        // Cast parsed data to the expected type
        const typedData = data as ParcelleProperty[];
        this.visibleParcelleProperties = typedData;
        
        typedData.forEach((property: ParcelleProperty) => {
          this.addParcelleMarker(property)
        })
        
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
        
        // Fit map to markers if there are any
        if (this.markers.length > 0) {
          const group = new (L as any).LatLngBounds()
          this.markers.forEach((marker) => {
            group.extend(marker.getLatLng())
          })
          this.map.fitBounds(group)
        }
      },
      error: (error) => {
        console.error('Error fetching parcelle data:', error)
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  private clearMarkers(): void {
    // Only clear layers if the feature group has been initialized
    if (this.featureGroup) {
      this.featureGroup.clearLayers()
    }
    this.markers = []
  }

  private addDvfMarker(property: DvfProperty): void {
    // Skip if required properties are missing
    if (!property.latitude || !property.longitude || !property.valeur_fonciere) {
      console.warn('Skipping DVF marker - missing required properties', property)
      return
    }
    
    const lat = property.latitude
    const lng = property.longitude
    const price = property.valeur_fonciere.toLocaleString()
    
    // Construire le contenu du marqueur en fonction des filtres actifs
    let markerContent = '';
    
    // Ajouter le prix uniquement si le filtre prix est activé
    if (this.usePriceFilter) {
      markerContent += `<span class="price">${price} €</span>`;
    }
    
    // Ajouter la date si le filtre date est activé
    if (this.useDateFilter && property.date_mutation) {
      markerContent += `${markerContent ? '<br>' : ''}<span class="date">${property.date_mutation}</span>`;
    }
    
    // Ajouter la surface si le filtre surface est activé
    if (this.useSurfaceFilter && property.surface) {
      markerContent += `${markerContent ? '<br>' : ''}<span class="surface">${property.surface} m²</span>`;
    }
    
    // S'il n'y a pas de contenu basé sur les filtres, afficher un message par défaut
    if (!markerContent) {
      markerContent = `<span class="default">Propriété DVF</span>`;
    }

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "custom-marker",
        html: `
          <div class="marker-label red-x">
            ${markerContent}
          </div>
        `,
        iconSize: [120, 80], // Taille augmentée pour accueillir plus d'informations
        iconAnchor: [60, 40],
      }),
    }).addTo(this.featureGroup)

    // Popup plus détaillé avec toutes les informations disponibles
    marker.bindPopup(`
      <div class="property-popup">
        <h3>${price} €</h3>
        <p><strong>Date:</strong> ${property.date_mutation || 'Non spécifiée'}</p>
        ${property.surface ? `<p><strong>Surface:</strong> ${property.surface} m²</p>` : ''}
        ${property.surface_terrain ? `<p><strong>Surface terrain:</strong> ${property.surface_terrain} m²</p>` : ''}
        <p><strong>Adresse:</strong> ${property.adresse_numero || ''} ${property.adresse_nom_voie || 'Non spécifiée'}</p>
        <p><strong>Code postal:</strong> ${property.code_postal || 'Non spécifié'}</p>
        <p><strong>Commune:</strong> ${property.nom_commune || 'Non spécifiée'}</p>
  </div>
  `)

    this.markers.push(marker)
  }

  private addDpeMarker(property: DpeProperty): void {
    // Skip if required properties are missing
    if (!property.latitude || !property.longitude) {
      console.warn('Skipping DPE marker - missing required properties', property)
      return
    }
    
    const lat = property.latitude
    const lng = property.longitude
    const energyClass = property.energyClass

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "custom-marker",
        html: `
          <div class="marker-label rating-${energyClass.toLowerCase()}">
            <span>${energyClass}</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    }).addTo(this.featureGroup)

    marker.bindPopup(`
      <div class="property-popup">
        <h3>DPE ${energyClass}</h3>
        <p><strong>Adresse:</strong> ${property.address}</p>
        <p><strong>Classe énergie:</strong> ${property.energyClass}</p>
        <p><strong>Classe GES:</strong> ${property.gesClass}</p>
        <p><strong>Année:</strong> ${property.year}</p>
      </div>
    `)

    this.markers.push(marker)
  }

  private addParcelleMarker(property: ParcelleProperty): void {
    // Skip if required properties are missing
    if (!property.latitude || !property.longitude) {
      console.warn('Skipping Parcelle marker - missing required properties', property)
      return
    }
    
    const lat = property.latitude
    const lng = property.longitude
    const surface = property.surface.toLocaleString()

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "custom-marker",
        html: `
          <div class="marker-label">
            <span class="number">${property.number}</span>
          </div>
        `,
        iconSize: [60, 40],
        iconAnchor: [30, 20],
      }),
    }).addTo(this.featureGroup)

    marker.bindPopup(`
      <div class="property-popup">
        <h3>Parcelle ${property.number}</h3>
        <p><strong>Surface:</strong> ${surface} m²</p>
        <p><strong>Adresse:</strong> ${property.address}</p>
        <p><strong>Commune:</strong> ${property.city}</p>
      </div>
    `)

    this.markers.push(marker)
  }

  toggleTable(): void {
    this.tableCollapsed = !this.tableCollapsed

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize()
      }
    }, 300)
  }

  selectProperty(index: number, property: any): void {
    this.selectedPropertyIndex = index

    if (this.tableCollapsed) {
      this.tableCollapsed = false
    }

    const lat = property.latitude || property.lat
    const lng = property.longitude || property.lng

    if (lat && lng) {
      this.map.setView([lat, lng], 16)
    }

    setTimeout(() => {
      const selectedRow = document.querySelector(".property-table tr.selected")
      if (selectedRow) {
        selectedRow.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  // Export functionality
  toggleExportDropdown(event: Event): void {
    event.stopPropagation() // Prevent click from closing immediately
    this.exportDropdownOpen = !this.exportDropdownOpen
  }

  exportData(format: "csv" | "json" | "pdf"): void {
    this.exportDropdownOpen = false // Close dropdown after selection

    let currentResults: any[] = []
    if (this.currentDataSource === "dvf") {
      currentResults = this.visibleDvfProperties
    } else if (this.currentDataSource === "dpe") {
      currentResults = this.visibleDpeProperties
    } else if (this.currentDataSource === "parcelles") {
      currentResults = this.visibleParcelleProperties
    }

    if (currentResults.length === 0) {
      alert("Aucune donnée à exporter. Veuillez effectuer une recherche d'abord.")
      return
    }

    this.isLoading = true

    setTimeout(() => {
      try {
        switch (format) {
          case "csv":
            this.exportToCSV(currentResults)
            break
          case "json":
            this.exportToJSON(currentResults)
            break
          case "pdf":
            this.exportToPDF(currentResults)
            break
        }
      } catch (error) {
        console.error("Export error:", error)
        alert("Erreur lors de l'exportation des données.")
      } finally {
        this.isLoading = false
      }
    }, 500)
  }

  private getTableHeaders(dataSource: string): string[] {
    if (dataSource === "dvf") {
      return ["Type", "ID", "Adresse", "Prix", "Date", "Commune"]
    } else if (dataSource === "dpe") {
      return ["Type", "ID", "Adresse", "Classe énergie", "Classe GES", "Commune"]
    } else if (dataSource === "parcelles") {
      return ["Type", "ID", "Adresse", "Numéro", "Surface", "Commune"]
    }
    return []
  }

  private getValueForHeader(item: any, header: string, dataSource: string): string {
    switch (header) {
      case "Type":
        return dataSource === "dvf" ? "DVF" : dataSource === "dpe" ? "DPE" : "Parcelle"
      case "ID":
        return item.id_mutation || item.id || "-"
      case "Adresse":
        return item.adresse_nom_voie || item.address || "-"
      case "Prix":
        return item.valeur_fonciere ? `${item.valeur_fonciere.toLocaleString()} €` : "-"
      case "Date":
        return item.date_mutation || "-"
      case "Numéro":
        return item.number || "-"
      case "Surface":
        return item.surface ? `${item.surface} m²` : "-"
      case "Classe énergie":
        return item.energyClass || "-"
      case "Classe GES":
        return item.gesClass || "-"
      case "Commune":
        return item.nom_commune || item.city || "-"
      default:
        return "-"
    }
  }

  private exportToCSV(data: any[]): void {
    const headers = this.getTableHeaders(this.currentDataSource)
    const csvContent = [
      headers.join(","),
      ...data.map((item) => {
        return headers
          .map((header) => {
            const value = this.getValueForHeader(item, header, this.currentDataSource)
            return `"${String(value).replace(/"/g, '""')}"` // Escape double quotes
          })
          .join(",")
      }),
    ].join("\n")

    this.downloadFile(csvContent, "map-explorer-results.csv", "text/csv")
  }

  private exportToJSON(data: any[]): void {
    const jsonContent = JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        totalResults: data.length,
        data: data,
      },
      null,
      2,
    )

    this.downloadFile(jsonContent, "map-explorer-results.json", "application/json")
  }

  private exportToPDF(data: any[]): void {
    // NOTE: For PDF export, you would typically need a library like jsPDF.
    // This example provides a placeholder. You would need to install jsPDF:
    // npm install jspdf
    // Then import it: import { jsPDF } from 'jspdf';
    alert(
      "PDF export functionality requires the 'jspdf' library. Please install it and implement the PDF generation logic.",
    )
    console.warn("PDF export not fully implemented without jsPDF library.")


  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Real data will be fetched from API services
}
