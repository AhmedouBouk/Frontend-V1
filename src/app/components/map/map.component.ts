import { Component, type AfterViewInit, type OnDestroy, ViewChild, type ElementRef, inject, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import * as L from "leaflet"
import { HttpClient } from "@angular/common/http"
import type { Subscription } from "rxjs"
import type { DvfProperty } from "../../models/dvf-property.model"
import { MapService } from "../../services/map.service"
import { DvfService } from "../../services/dvf.service"
import { FormService } from "../../services/form.service"
import { environment } from "../../../environments/environment"
// Add this at the top of your file
import "leaflet.wms";


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
  private fetchDataTimeout: any
  private baseLayers: any = {}
  private currentLayer: any = null

  public showProperties = true
  public usePriceFilter = false
  public useDateFilter = false
  public minPrice = 0
  public maxPrice = 2000000
  public startDate = "2020-01-01"
  public endDate = "2023-12-31"
  public visibleProperties: DvfProperty[] = []
  public selectedPropertyIndex: number | null = null
  public tableCollapsed = false
  public isLoading = false
  public mapType = "street" // Type de carte par défaut
  public dateMode = 'exact'
  public exactDate = ''

  private readonly mapService = inject(MapService)
  private readonly dvfService = inject(DvfService)
  private readonly formService = inject(FormService)
  private readonly http = inject(HttpClient)
  private readonly subscriptions: Subscription[] = []

  get isFilterActive(): boolean {
    return this.usePriceFilter || this.useDateFilter
  }
  private checkAndFetchIfNeeded(): void {
    if (this.usePriceFilter || this.useDateFilter) {
      this.fetchDvfData()
    } else {
      this.clearMarkers()
      this.visibleProperties = []
      console.log("✅ Tous les filtres désactivés — pas de requête API")
    }
  }
  

  ngAfterViewInit(): void {
    this.initMap()

    this.subscriptions.push(
      this.mapService.getRefreshObservable().subscribe(() => this.fetchDvfData()),

      this.formService.getPriceFilterObservable().subscribe((filter) => {
        if (filter) {
          const [min, max] = filter
          this.minPrice = min
          this.maxPrice = max
          this.usePriceFilter = true
          this.fetchDvfData()
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
          this.fetchDvfData()
        } else {
          this.useDateFilter = false
          this.startDate = ''
          this.endDate = ''
          this.exactDate = ''
          this.checkAndFetchIfNeeded()
        }
      }),
      

      // S'abonner aux changements de type de carte
      this.mapService
        .getMapTypeObservable()
        .subscribe((type) => {
          this.setMapType(type)
        }),
    )
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe())
    if (this.map) this.map.remove()
    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout)
  }

  ngOnInit(): void {
    // Make sure Leaflet CSS is loaded
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  private initMap(): void {
    // Make sure the map container is properly sized before initializing
    setTimeout(() => {
      if (!this.mapContainer) {
        console.error('Map container not found');
        return;
      }

      // Create the map
      this.map = L.map(this.mapContainer.nativeElement, {
        center: [47.2184, -1.5536],
        zoom: 11,
      });
    
      // Define base layers
      this.baseLayers = {
        street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }),
        satellite: L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "&copy; ArcGIS",
            maxZoom: 19,
          }
        ),
        cadastre: (L as any).tileLayer.wms("https://data.geopf.fr/wms-r/wm", {
          layers: "CADASTRALPARCELS.PARCELS",
          format: "image/png",
          transparent: true,
          attribution: "&copy; Géoportail France",
          version: "1.3.0",
          crs: (L as any).CRS.EPSG3857

        }),
        
      }
    
      // Add the default layer to the map
      this.currentLayer = this.baseLayers.street.addTo(this.map);
      
      // Force a map resize to ensure it displays correctly
      this.map.invalidateSize(true);
      
      // Set up event listeners for map movement and zoom
      this.map.on("moveend", () => {
        if (this.usePriceFilter || this.useDateFilter) {
          this.fetchDvfData();
        } else {
          this.clearMarkers();
          this.visibleProperties = [];
          console.log("❌ Mouvement carte ignoré — aucun filtre actif");
        }
      });
    
      this.map.on("zoomend", () => {
        if (this.usePriceFilter || this.useDateFilter) {
          this.fetchDvfData();
        } else {
          this.clearMarkers();
          this.visibleProperties = [];
          console.log("❌ Zoom ignoré — aucun filtre actif");
        }
      });
    
      this.fetchDvfData();
    
      // Additional timeout to ensure map is properly sized
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 300);
    }, 100);
  }
  

  // Méthode pour changer le type de carte
  setMapType(type: string): void {
    if (!this.map || !this.baseLayers) return;

    this.mapType = type;

    // Retirer la couche actuelle
    if (this.currentLayer) {
      this.map.removeLayer(this.currentLayer);
    }

    // Ajouter la nouvelle couche
    if (type === "satellite" && this.baseLayers.satellite) {
      this.currentLayer = this.baseLayers.satellite.addTo(this.map);
    } else if (type === "cadastre" && this.baseLayers.cadastre) {
      this.currentLayer = this.baseLayers.cadastre.addTo(this.map);
    } else {
      this.currentLayer = this.baseLayers.street.addTo(this.map);
    }
  }

  private fetchDvfData(): void {
    // Ne pas rafraîchir si aucun filtre n'est activé
    if (!this.usePriceFilter && !this.useDateFilter) {
      console.log("⛔ Aucun filtre activé - skip refresh");
      return;
    }

    this.clearMarkers();
    this.visibleProperties = [];

    if (this.fetchDataTimeout) clearTimeout(this.fetchDataTimeout);
    this.fetchDataTimeout = setTimeout(() => this.loadDvfData(), 300);
  }

  private loadDvfData(): void {
    if (!this.map) return

    this.isLoading = true
    const bounds = this.map.getBounds()
    const topLeft: [number, number] = [bounds.getNorth(), bounds.getWest()]
    const bottomRight: [number, number] = [bounds.getSouth(), bounds.getEast()]

    const price: [number, number] | null = this.usePriceFilter ? [this.minPrice, this.maxPrice] : null;
    const date: [string, string] | null = this.useDateFilter ? [this.startDate, this.endDate] : null;
    const exactDate: string | null = this.useDateFilter && this.dateMode === 'exact' ? this.exactDate : null;

    // Log request parameters for debugging
    console.log('DVF Request Parameters:', {
      topLeft,
      bottomRight,
      price,
      date,
      exactDate
    });
    
    // Log the actual API URL that will be called
    const params: any = {
      lat_min: bottomRight[0],
      lat_max: topLeft[0],
      lon_min: topLeft[1],
      lon_max: bottomRight[1]
    };
    if (price) {
      params.prix_min = price[0];
      params.prix_max = price[1];
    }
    if (exactDate) {
      params.date_exacte = exactDate;
    } else if (date) {
      params.date_min = date[0];
      params.date_max = date[1];
    }
    
    console.log('API URL (constructed manually for debugging):', 
      `${environment.apiUrl}/dvf/filtrer?${new URLSearchParams(params).toString()}`);

    this.dvfService.getDvfProperties(topLeft, bottomRight, price, date, exactDate).subscribe({
      next: (properties: DvfProperty[]) => {
        console.log(`🟢 ${properties.length} propriétés reçues`)
        this.clearMarkers()
        this.visibleProperties = properties
        properties.forEach((property) => {
          if (property.latitude && property.longitude) {
            this.addMarker(property)
          }
        })
        this.isLoading = false

        // Forcer un redimensionnement de la carte après le chargement des données
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize()
          }
        }, 300)
      },
      error: (err) => {
        console.error("❌ Erreur chargement DVF:", err)
        // Display more detailed error information
        if (err.error) {
          console.error('Error details:', err.error)
        }
        if (err.message) {
          console.error('Error message:', err.message)
        }
        // Continue with empty results to avoid breaking the UI
        this.clearMarkers()
        this.visibleProperties = []
        this.isLoading = false
      },
    })
  }

  private clearMarkers(): void {
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];
  }

  private addMarker(property: DvfProperty): void {
    const lat = Number(property.latitude)
    const lng = Number(property.longitude)
    const price = Math.round(Number(property.valeur_fonciere)).toLocaleString()
    const date = property.date_mutation?.toString().split("-")
    const formattedDate =
      date && date.length === 3 ? `${date[2]}/${date[1]}/${date[0].slice(2)}` : property.date_mutation

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "custom-marker",
        html: `
          <div class="marker-label red-x">
            <span class="price">${price} €</span>
          </div>
        `,
        iconSize: [90, 50],
        iconAnchor: [45, 25],
      }),
    }).addTo(this.map)

    marker.bindPopup(`
      <div class="property-popup">
        <h3>${price} €</h3>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Adresse:</strong> ${property.adresse_numero ?? ""} ${property.adresse_nom_voie ?? ""}</p>
        <p><strong>Code postal:</strong> ${property.code_postal ?? ""}</p>
        <p><strong>Commune:</strong> ${property.nom_commune ?? ""}</p>
      </div>
    `)

    this.markers.push(marker)
  }

  toggleTable(): void {
    this.tableCollapsed = !this.tableCollapsed;

    // Forcer un redimensionnement de la carte après avoir basculé le tableau
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 300);
  }

  selectProperty(index: number, property: DvfProperty): void {
    this.selectedPropertyIndex = index;

    // S'assurer que le tableau est déplié
    if (this.tableCollapsed) {
      this.tableCollapsed = false;
    }

    // Centrer la carte sur la propriété sélectionnée
    this.map.setView([property.latitude, property.longitude], 16);

    // Donner un peu de temps pour que le DOM se mette à jour
    setTimeout(() => {
      // Faire défiler jusqu'à la ligne sélectionnée si nécessaire
      const selectedRow = document.querySelector(".property-table tr.selected");
      if (selectedRow) {
        selectedRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
  }
}
