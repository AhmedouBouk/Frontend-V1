import {
  Component,
  type AfterViewInit,
  type OnDestroy,
  ViewChild,
  type ElementRef,
  Input,
  Output,
  EventEmitter,
  inject,
  type OnInit,
  ChangeDetectorRef,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import * as L from "leaflet"
import type { Subscription } from "rxjs"
import type { DvfProperty } from "../../../models/dvf-property.model"
import type { DpeProperty } from "../../../models/dpe.model"
import type { ParcelleProperty } from "../../../models/parcelle.model"
import { MapService } from "../../../services/map.service"
import { FormService } from "../../../services/form.service"
import { MapStateService, type MapState } from "../../../services/map-state.service"

// Create a default icon for Leaflet markers
const defaultIcon = L.icon({
  iconUrl: "assets/marker-icon.png",
  iconRetinaUrl: "assets/marker-icon-2x.png",
  shadowUrl: "assets/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  tooltipAnchor: [16, -28],
})

@Component({
  selector: "app-map-display",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./map-display.component.html",
  styleUrls: ["./map-display.component.scss"],
})
export class MapDisplayComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild("map") private readonly mapContainer!: ElementRef

  @Input() currentDataSource = "dvf"
  @Input() activeDataSources: string[] = []
  @Input() usePriceFilter = false
  @Input() useDateFilter = false
  @Input() useSurfaceFilter = false
  @Input() useEnergyFilter = false
  @Input() useConsumptionFilter = false
  @Input() markersVisible = true
  @Input() tableCollapsed = false // Track sidebar state for bounds calculation
  @Input() visibleDvfProperties: DvfProperty[] = []
  @Input() visibleDpeProperties: DpeProperty[] = []
  @Input() visibleParcelleProperties: ParcelleProperty[] = []

  @Output() mapMoved = new EventEmitter<void>()
  @Output() propertySelected = new EventEmitter<{ index: number; property: any }>()

  private map: any
  private markers: L.Marker[] = []
  private featureGroup: any
  private baseLayers: any = {}
  private currentLayer: any

  private readonly mapService = inject(MapService)
  private readonly formService = inject(FormService)
  private readonly cdr = inject(ChangeDetectorRef)
  private readonly subscriptions: Subscription[] = []
  private readonly mapStateService = inject(MapStateService)
  private saveStateTimeout: any

  ngOnInit(): void {
    // Subscribe to map type changes
    this.subscriptions.push(
      this.mapService.getMapTypeObservable().subscribe((type) => {
        if (this.map && this.baseLayers) {
          if (this.currentLayer) {
            this.map.removeLayer(this.currentLayer)
          }
          if (this.baseLayers[type]) {
            this.currentLayer = this.baseLayers[type].addTo(this.map)
          } else {
            this.currentLayer = this.baseLayers.street.addTo(this.map)
          }
        }
      }),
    )
  }

  ngAfterViewInit(): void {
    this.initMap()
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    if (this.map) this.map.remove()
  }

  private initMap(): void {
    setTimeout(() => {
      if (!this.mapContainer) {
        console.error("Map container not found")
        return
      }

      // Récupérer l'état sauvegardé ou utiliser l'état par défaut
      const savedState = this.mapStateService.getMapState()
      const defaultState = this.mapStateService.getDefaultMapState()
      const mapState = savedState || defaultState

      // Create the map with restored state
      this.map = L.map(this.mapContainer.nativeElement, {
        center: mapState.center,
        zoom: mapState.zoom,
        zoomControl: false,
        attributionControl: false,
      })

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

      // Create feature group for markers
      this.featureGroup = (L as any).layerGroup().addTo(this.map)

      // Add the restored layer type to the map
      const layerType = mapState.mapType || 'street'
      this.currentLayer = this.baseLayers[layerType].addTo(this.map)

      // Force a map resize to ensure it displays correctly
      this.map.invalidateSize(true)

      // Set up event listeners for map movement and zoom with state saving
      this.map.on("moveend", () => {
        this.mapMoved.emit()
        this.saveMapStateDebounced()
      })

      this.map.on("zoomend", () => {
        this.mapMoved.emit()
        this.saveMapStateDebounced()
      })

      // Additional timeout to ensure map is properly sized
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize()
        }
      }, 300)
    }, 100)
  }

  

  // Method to get map bounds - accounting for both bottom and left sidebar coverage
  getMapBounds(): any {
    if (!this.map) return null
    
    // Get the full map bounds
    const fullBounds = this.map.getBounds()
    
    // Get map container dimensions
    const mapContainer = this.map.getContainer()
    const containerRect = mapContainer.getBoundingClientRect()
    const mapWidth = containerRect.width
    const mapHeight = containerRect.height
    
    // Initialize adjusted bounds with full bounds
    let north = fullBounds.getNorth()
    let south = fullBounds.getSouth()
    let east = fullBounds.getEast()
    let west = fullBounds.getWest()
    
    // Track if any adjustments were made
    let adjustmentsMade = false
    
    // 1. Check for the results header bar (always visible, even when collapsed)
    // This accounts for the "Résultats (212)" bar with export button shown in the screenshot
    const resultsHeaderElement = document.querySelector('.property-list-header')
    if (resultsHeaderElement) {
      adjustmentsMade = true
      const headerRect = resultsHeaderElement.getBoundingClientRect()
      const headerHeight = headerRect.height
      
      // Almost no adjustment - only 5% of header height
      const headerCoverageRatio = Math.max(0, (mapHeight - headerHeight * 0.05) / mapHeight)
      
      // Calculate the adjusted south boundary for header
      const latRange = north - south
      south = south + (latRange * (1 - headerCoverageRatio))
    }
    
    // 2. Check for expanded bottom sidebar (property-list-container when not collapsed)
    const bottomSidebarElement = document.querySelector('.property-list-container:not(.collapsed)')
    if (bottomSidebarElement) {
      adjustmentsMade = true
      const sidebarRect = bottomSidebarElement.getBoundingClientRect()
      const sidebarHeight = sidebarRect.height
      
      // Since we already adjusted for the header, we need to calculate additional adjustment
      // for the expanded content area (total height minus header height)
      const resultsHeaderElement = document.querySelector('.property-list-header')
      const headerHeight = resultsHeaderElement ? resultsHeaderElement.getBoundingClientRect().height : 0
      const contentHeight = sidebarHeight - headerHeight
      
      // Almost no adjustment - only 5% of content height
      const adjustedContentHeight = contentHeight * 0.05
      const totalAdjustedHeight = headerHeight * 0.05 + adjustedContentHeight
      const contentCoverageRatio = Math.max(0, (mapHeight - totalAdjustedHeight) / mapHeight)
      
      // Calculate the adjusted south boundary including content area
      const latRange = north - south
      south = fullBounds.getSouth() + (latRange * (1 - contentCoverageRatio))
    }
    
    // Note: Left sidebar doesn't overlay the map - it pushes the map to the right
    // The map bounds change is handled by triggering new requests when sidebar state changes
    // This is implemented in the parent component's ngOnChanges method
    
    if (!adjustmentsMade) {
      
      return fullBounds;
    }
    
    // Ensure we don't over-adjust and create gaps
    const minVisibleRatio = 0.95; // Always keep at least 95% of map visible
    const currentVisibleRatio = (south - fullBounds.getSouth()) / (fullBounds.getNorth() - fullBounds.getSouth());
    if (currentVisibleRatio > (1 - minVisibleRatio)) {
      const latRange = fullBounds.getNorth() - fullBounds.getSouth();
      south = fullBounds.getSouth() + (latRange * (1 - minVisibleRatio));
    }
    
    // Create adjusted bounds object that mimics Leaflet LatLngBounds
    const adjustedBounds = {
      getNorth: () => north,
      getSouth: () => south,
      getEast: () => east,
      getWest: () => west,
      _northEast: { lat: north, lng: east },
      _southWest: { lat: south, lng: west }
    }
    
    return adjustedBounds
  }

  // Method to fit map to markers
  fitToMarkers(): void {
    if (this.markers.length > 0) {
      const group = new (L as any).LatLngBounds()
      this.markers.forEach((marker) => {
        group.extend(marker.getLatLng())
      })
      this.map.fitBounds(group)
    }
  }

  // Method to set map view
  setMapView(lat: number, lng: number, zoom = 16): void {
    if (this.map) {
      this.map.setView([lat, lng], zoom)
    }
  }

  // Method to invalidate map size
  invalidateSize(): void {
    if (this.map) {
      this.map.invalidateSize()
    }
  }

  // Method to add user location marker
  addUserLocationMarker(lat: number, lng: number, accuracy: number): void {
    if (!this.map) return

    // Add user marker
    const userMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "compact-marker user-marker",
        html: `<div class="compact-marker user-marker">📍 Vous</div>`,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      }),
    }).addTo(this.map)

    // Add accuracy circle
    const accuracyRadius = Math.min(accuracy / 2, 1000)
    const accuracyMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "accuracy-circle",
        html: `<div class="accuracy-circle-inner" style="width: ${Math.max(accuracyRadius / 25, 40)}px; height: ${Math.max(accuracyRadius / 25, 40)}px;"></div>`,
        iconSize: [Math.max(accuracyRadius / 25, 40), Math.max(accuracyRadius / 25, 40)],
        iconAnchor: [Math.max(accuracyRadius / 50, 20), Math.max(accuracyRadius / 50, 20)],
      }),
    }).addTo(this.map)
  }

  // Update markers when properties change
  ngOnChanges(): void {
    if (this.map) {
      this.updateMarkers()
    }
  }

  private updateMarkers(): void {
    this.clearMarkers()

    // Déterminer quelles sources afficher
    const sourcesToShow = this.activeDataSources.length > 0 ? this.activeDataSources : [this.currentDataSource]
    
    

    // Afficher les marqueurs DVF si la source est active
    if (sourcesToShow.includes('dvf') && this.visibleDvfProperties.length > 0) {
      this.visibleDvfProperties.forEach((property) => {
        this.addDvfMarker(property)
      })
    }

    // Afficher les marqueurs DPE si la source est active
    if (sourcesToShow.includes('dpe') && this.visibleDpeProperties.length > 0) {
      this.visibleDpeProperties.forEach((property) => {
        this.addDpeMarker(property)
      })
    }

    // Afficher les marqueurs Parcelles si la source est active
    if (sourcesToShow.includes('parcelles') && this.visibleParcelleProperties.length > 0) {
      this.visibleParcelleProperties.forEach((property) => {
        this.addParcelleMarker(property)
      })
    }

  }

  private clearMarkers(): void {
    if (this.featureGroup) {
      this.featureGroup.clearLayers()
    }
    this.markers = []
  }

  private addDvfMarker(property: DvfProperty): void {
    if (!property.latitude || !property.longitude || !property.valeur_fonciere) {
      return
    }
  
    const lat = property.latitude
    const lng = property.longitude
    
    // Determine what emoji to display on the marker based on active filters
    let markerIcon: string
    let popupTitle: string
    
    // Handle different filter combinations with appropriate markers
    if (this.useDateFilter && this.usePriceFilter) {
      // Both filters active - use a combined marker
      markerIcon = "🔍"
      popupTitle = `🔍 ${property.date_mutation || "Non spécifiée"} - ${property.valeur_fonciere.toLocaleString()} €`
    } else if (this.useDateFilter) {
      // Only date filter is active
      const date = property.date_mutation || "Non spécifiée"
      markerIcon = "📅"
      popupTitle = `📅 ${date}`
    } else if (this.usePriceFilter) {
      // Only price filter is active
      markerIcon = "💰"
      popupTitle = `💰 ${property.valeur_fonciere.toLocaleString()} €`
    } else {
      // No filters active - use default marker
      markerIcon = "📍"
      popupTitle = `📍 Propriété`
    }
  

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "emoji-marker dvf-marker",
        html: `<div class="emoji-marker dvf-marker">${markerIcon}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(this.featureGroup)
  
    marker.bindPopup(`
      <div class="property-popup">
        <h3>${popupTitle}</h3>
        <p><strong>Prix:</strong> ${property.valeur_fonciere.toLocaleString()} €</p>
        <p><strong>Date:</strong> ${property.date_mutation || "Non spécifiée"}</p>
        ${property.surface ? `<p><strong>Surface:</strong> ${property.surface} m²</p>` : ""}
        ${property.surface_terrain ? `<p><strong>Surface terrain:</strong> ${property.surface_terrain} m²</p>` : ""}
        <p><strong>Adresse:</strong> ${property.adresse_numero || ""} ${property.adresse_nom_voie || "Non spécifiée"}</p>
        <p><strong>Code postal:</strong> ${property.code_postal || "Non spécifié"}</p>
        <p><strong>Commune:</strong> ${property.nom_commune || "Non spécifiée"}</p>
      </div>
    `)
  
    this.markers.push(marker)
  }

  private addDpeMarker(property: DpeProperty): void {
    if (!property.latitude || !property.longitude) return;
  
    const lat = property.latitude;
    const lng = property.longitude;
    const energyClass = (property.energyClass || 'G').toUpperCase();
  
    const isConsumption = this.useConsumptionFilter;
    const iconChar = isConsumption ? '⚡' : energyClass;
  
    // pick gradient for A..G
    const { bg } = this.getEnergyPalette(energyClass);
  
    // inline-styled chip (24x24), no blue halo, white text
    const html = `
      <div style="
        width:24px;height:24px;border-radius:6px;
        display:grid;place-items:center;
        font-weight:800;letter-spacing:.02em;line-height:1;
        border:1px solid rgba(0,0,0,.15);
        box-shadow:
          0 1px 3px rgba(0,0,0,.35),
          inset 0 1px 0 rgba(255,255,255,.25);
        background:${bg};
        color:#ffffff;
        user-select:none;
      ">
        <span style="font-size:${isConsumption ? '13px' : '12px'};transform:translateY(.5px)">${iconChar}</span>
      </div>`;
  
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: `leaflet-dpe-chip energy-${energyClass.toLowerCase()} ${isConsumption ? 'is-consumption' : ''}`,
        html,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    }).addTo(this.featureGroup);
  
    const consumptionText = property.ep_conso_5_usages
      ? `${property.ep_conso_5_usages} kWh/m²`
      : 'Non disponible';
  
    const periodText = property.periode_construction || 'Non spécifiée';
  
    marker.bindPopup(`
      <div class="property-popup">
        <h3>${isConsumption ? '⚡ Consommation' : 'Classe Énergie ' + energyClass}</h3>
        <p><strong>Adresse:</strong> ${property.address}</p>
        <p><strong>Classe énergie:</strong> ${property.energyClass}</p>
        <p><strong>Consommation:</strong> ${consumptionText}</p>
        <p><strong>Année:</strong> ${property.year}</p>
        <p><strong>Période:</strong> ${periodText}</p>
      </div>
    `);
  
    this.markers.push(marker);
  }
  
  private getEnergyPalette(letter: string): { bg: string } {
    switch (letter) {
      case 'A':
        return { bg: 'linear-gradient(145deg,#11c26a 0%,#0ea85f 60%,#0a8f54 100%)' };
      case 'B':
        return { bg: 'linear-gradient(145deg,#3dc375 0%,#31ac65 60%,#2b985b 100%)' };
      case 'C':
        return { bg: 'linear-gradient(145deg,#a0c63a 0%,#91b431 60%,#7a9b29 100%)' };
      case 'D':
        return { bg: 'linear-gradient(145deg,#ffe23d 0%,#ffd21f 60%,#f2c212 100%)' };
      case 'E':
        return { bg: 'linear-gradient(145deg,#ffb63d 0%,#ffa41f 60%,#f29012 100%)' };
      case 'F':
        return { bg: 'linear-gradient(145deg,#ff7a38 0%,#ff6a1f 60%,#ef5a15 100%)' };
      case 'G':
      default:
        return { bg: 'linear-gradient(145deg,#ff4747 0%,#ff2d2d 60%,#e51f1f 100%)' };
    }
  }
  
  

  private addParcelleMarker(property: ParcelleProperty): void {
    if (!property.latitude || !property.longitude) {
      return
    }

    const lat = property.latitude
    const lng = property.longitude

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "emoji-marker parcelle-marker",
        html: `<div class="emoji-marker parcelle-marker">📐</div>`,
        iconSize: [20, 20], // Fixed small size for emoji only
        iconAnchor: [10, 10], // Center the emoji exactly on the position
      }),
    }).addTo(this.featureGroup)

    marker.bindPopup(`
      <div class="property-popup">
        <h3>📐 Parcelle ${property.number}</h3>
        <p><strong>Surface:</strong> ${property.surface.toLocaleString()} m²</p>
        <p><strong>Adresse:</strong> ${property.address}</p>
        <p><strong>Commune:</strong> ${property.city}</p>
      </div>
    `)

    this.markers.push(marker)
  }

  /**
   * Sauvegarde l'état de la carte avec debouncing pour éviter trop d'appels
   */
  private saveMapStateDebounced(): void {
    // Clear existing timeout
    if (this.saveStateTimeout) {
      clearTimeout(this.saveStateTimeout)
    }
    
    // Set new timeout to save state after 1 second of inactivity
    this.saveStateTimeout = setTimeout(() => {
      this.saveMapState()
    }, 1000)
  }

  /**
   * Sauvegarde l'état actuel de la carte
   */
  private saveMapState(): void {
    if (!this.map) return
    
    // Determine current map type based on the active layer
    let mapType: 'street' | 'satellite' | 'cadastre' = 'street'
    if (this.currentLayer === this.baseLayers.satellite) {
      mapType = 'satellite'
    } else if (this.currentLayer === this.baseLayers.cadastre) {
      mapType = 'cadastre'
    }
    
    const center = this.map.getCenter()
    const mapState: MapState = {
      center: [center.lat, center.lng],
      zoom: this.map.getZoom(),
      mapType: mapType
    }
    
    this.mapStateService.saveMapState(mapState)
  }
}