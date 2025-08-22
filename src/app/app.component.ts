import { Component, inject, OnInit, OnDestroy } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { HttpClient } from "@angular/common/http"
import { Subscription } from "rxjs"
import { FormComponent } from "./components/form/form.component"
import { MapService } from "./services/map.service"
import { FormService } from "./services/form.service"
import { MapComponent } from "./components/map/map/map.component"
import { KeycloakAuthService } from "./services/keycloak-auth.service"

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  boundingbox: string[]
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule, FormComponent, MapComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit, OnDestroy {
  sidebarOpen = true // Valeur par défaut, sera écrasée par FormService
  mapType: "street" | "satellite" | "cadastre" = "street"
  darkMode = false

  // Search functionality
  isSearchOpen = false
  searchQuery = ''
  isSearching = false
  searchResults: NominatimResult[] = []
  showResults = false
  isLoading = false

  private readonly mapService = inject(MapService)
  private readonly formService = inject(FormService)
  private readonly http = inject(HttpClient)
  private readonly subscriptions: Subscription[] = []
  private readonly kcAuth = inject(KeycloakAuthService)

  ngOnInit(): void {
    // Initialize Keycloak auth (direct integration)
    this.kcAuth.init()
    setTimeout(() => {
      window.location.reload();
    }, 300000);

    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      this.darkMode = true
      this.applyTheme(true)
    }

    // Restaurer l'état des filtres et synchroniser le sidebar
    this.formService.restoreFilterState()
    
    // Instead of getGlobalLoadingObservable, subscribe to each one
this.subscriptions.push(
  this.formService.getPriceLoadingObservable().subscribe((loading: boolean) => {
    this.isLoading = loading && !this.sidebarOpen
  })
)

this.subscriptions.push(
  this.formService.getDateLoadingObservable().subscribe((loading: boolean) => {
    this.isLoading = loading && !this.sidebarOpen
  })
)

this.subscriptions.push(
  this.formService.getSurfaceLoadingObservable().subscribe((loading: boolean) => {
    this.isLoading = loading && !this.sidebarOpen
  })
)

this.subscriptions.push(
  this.formService.getEnergyLoadingObservable().subscribe((loading: boolean) => {
    this.isLoading = loading && !this.sidebarOpen
  })
)

this.subscriptions.push(
  this.formService.getConsumptionLoadingObservable().subscribe((loading: boolean) => {
    this.isLoading = loading && !this.sidebarOpen
  })
)

this.subscriptions.push(
  this.formService.getTypeLocaleLoadingObservable().subscribe((loading: boolean) => {
    this.isLoading = loading && !this.sidebarOpen
  })
)

  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe())
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen
    this.formService.setLeftSidebarOpen(this.sidebarOpen)
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode
    this.applyTheme(this.darkMode)
    // Save preference to localStorage
    localStorage.setItem('theme', this.darkMode ? 'dark' : 'light')
  }

  private applyTheme(isDark: boolean): void {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }

  setMapType(type: "street" | "satellite" | "cadastre"): void {
    this.mapType = type
    this.mapService.setMapType(type)
  }

  centerMap(): void {
    this.mapService.centerMap()
  }

  // Search functionality methods
  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen
    if (this.isSearchOpen) {
      setTimeout(() => {
        const input = document.querySelector('.search-input') as HTMLInputElement
        if (input) input.focus()
      }, 300)
    } else {
      this.clearSearch()
    }
  }

  onSearchInput(): void {
    if (this.searchQuery.length < 2) {
      this.searchResults = []
      this.showResults = false
      return
    }

    this.isSearching = true
    this.searchCity(this.searchQuery)
  }

  onSearchFocus(): void {
    if (this.searchQuery.length >= 2 && this.searchResults.length > 0) {
      this.showResults = true
    }
  }

  onSearchSubmit(): void {
    if (this.searchQuery.trim() && this.searchResults.length > 0) {
      this.selectLocation(this.searchResults[0])
    }
  }

  private searchCity(query: string): void {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=fr&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
    
    this.http.get<NominatimResult[]>(url).subscribe({
      next: (results: NominatimResult[]) => {
        this.searchResults = results.filter(result => 
          result.display_name && result.lat && result.lon
        )
        this.showResults = this.searchResults.length > 0
        this.isSearching = false
      },
      error: (error: any) => {
        console.error('Erreur de recherche:', error)
        this.isSearching = false
        this.searchResults = []
        this.showResults = false
      }
    })
  }

  selectLocation(result: NominatimResult): void {
    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)
    
    // Emit location to map service or handle as needed
    this.mapService.setLocation(lat, lon, result.display_name)
    
    this.clearSearch()
  }

  requestUserLocation(): void {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas prise en charge par votre navigateur.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        this.mapService.setUserLocation(latitude, longitude, position.coords.accuracy)
      },
      (error) => {
        console.error("Erreur de géolocalisation:", error)
        let errorMessage = "Impossible de déterminer votre position."

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Vous avez refusé l'accès à votre position."
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
      }
    )
  }

  trackByResult(index: number, result: NominatimResult): string {
    return result.display_name + result.lat + result.lon
  }

  private clearSearch(): void {
    this.searchQuery = ''
    this.searchResults = []
    this.showResults = false
    this.isSearching = false
    this.isSearchOpen = false
  }

  // Auth bindings for template (Keycloak)
  get isAuthenticated(): boolean {
    return this.kcAuth.isAuthenticated()
  }

  get userName(): string {
    const u = this.kcAuth.user()
    return u?.name || u?.preferred_username || 'Utilisateur'
  }

  logout(): void {
    this.kcAuth.logout()
  }
}
