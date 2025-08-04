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
import "leaflet/dist/leaflet.css"
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
  @Input() markersVisible = true
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

      console.log('🗺️ Carte initialisée avec l\'état:', mapState)
    }, 100)
  }

  // Method to center the map (called by MapService)
  centerMap(): void {
    if (this.map) {
      this.map.setView([46.603354, 1.888334], 6)
    }
  }

  // Method to get map bounds
  getMapBounds(): any {
    return this.map ? this.map.getBounds() : null
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
    
    console.log('🎯 Updating markers for sources:', sourcesToShow)
    console.log('📊 Data counts:', {
      dvf: this.visibleDvfProperties.length,
      dpe: this.visibleDpeProperties.length,
      parcelles: this.visibleParcelleProperties.length
    })

    // Afficher les marqueurs DVF si la source est active
    if (sourcesToShow.includes('dvf') && this.visibleDvfProperties.length > 0) {
      console.log('🏠 Adding', this.visibleDvfProperties.length, 'DVF markers')
      this.visibleDvfProperties.forEach((property) => {
        this.addDvfMarker(property)
      })
    }

    // Afficher les marqueurs DPE si la source est active
    if (sourcesToShow.includes('dpe') && this.visibleDpeProperties.length > 0) {
      console.log('⚡ Adding', this.visibleDpeProperties.length, 'DPE markers')
      this.visibleDpeProperties.forEach((property) => {
        this.addDpeMarker(property)
      })
    }

    // Afficher les marqueurs Parcelles si la source est active
    if (sourcesToShow.includes('parcelles') && this.visibleParcelleProperties.length > 0) {
      console.log('📐 Adding', this.visibleParcelleProperties.length, 'Parcelle markers')
      this.visibleParcelleProperties.forEach((property) => {
        this.addParcelleMarker(property)
      })
    }

    console.log('✅ Total markers added:', this.markers.length)
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
    
    if (this.useDateFilter && !this.usePriceFilter) {
      // Date filter is active, price filter is not - show date emoji
      const date = property.date_mutation || "Non spécifiée"
      markerIcon = "📅"
      popupTitle = `📅 ${date}`
    } else {
      // Price filter is active or both filters active or neither active - show price emoji (default)
      markerIcon = "💰"
      popupTitle = `💰 ${property.valeur_fonciere.toLocaleString()} €`
    }

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "emoji-marker dvf-marker",
        html: `<div class="emoji-marker dvf-marker">${markerIcon}</div>`,
        iconSize: [20, 20], // Fixed small size for emoji only
        iconAnchor: [10, 10], // Center the emoji exactly on the position
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
    if (!property.latitude || !property.longitude) {
      return
    }

    const lat = property.latitude
    const lng = property.longitude
    const gesClass = property.gesClass

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: `emoji-marker dpe-marker rating-${gesClass.toLowerCase()}`,
        html: `<div class="emoji-marker dpe-marker rating-${gesClass.toLowerCase()}">⚡</div>`,
        iconSize: [20, 20], // Fixed small size for emoji only
        iconAnchor: [10, 10], // Center the emoji exactly on the position
      }),
    }).addTo(this.featureGroup)

    marker.bindPopup(`
      <div class="property-popup">
        <h3>⚡ DPE - Classe GES ${gesClass}</h3>
        <p><strong>Adresse:</strong> ${property.address}</p>
        <p><strong>Classe énergie:</strong> ${property.energyClass}</p>
        <p><strong>Classe GES:</strong> ${property.gesClass}</p>
        <p><strong>Année:</strong> ${property.year}</p>
      </div>
    `)

    this.markers.push(marker)
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

  private formatPrice(price: number): string {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M€`
    } else if (price >= 1000) {
      return `${(price / 1000).toFixed(0)}k€`
    }
    return `${price}€`
  }

  private formatSurface(surface: number): string {
    if (surface >= 10000) {
      return `${(surface / 10000).toFixed(1)}ha`
    } else if (surface >= 1000) {
      return `${(surface / 1000).toFixed(1)}k m²`
    }
    return `${surface}m²`
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