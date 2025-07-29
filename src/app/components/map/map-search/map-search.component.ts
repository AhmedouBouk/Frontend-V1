import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  boundingbox: string[]
}

@Component({
  selector: 'app-map-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-search.component.html',
  styleUrls: ['./map-search.component.scss']
})
export class MapSearchComponent {
  @Input() sidebarOpen: boolean = false
  @Output() locationSelected = new EventEmitter<{lat: number, lon: number, name: string}>()
  @Output() userLocationRequested = new EventEmitter<void>()

  isSearchOpen = false
  searchQuery = ''
  isSearching = false
  searchResults: NominatimResult[] = []
  showResults = false

  constructor(private readonly http: HttpClient) {}

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
    console.log('Search input:', this.searchQuery) // Debug
    
    if (this.searchQuery.length < 2) { // Réduit le minimum à 2 caractères
      this.searchResults = []
      this.showResults = false
      return
    }

    this.isSearching = true
    this.searchCity(this.searchQuery)
  }

  onSearchFocus(): void {
    // Affiche les résultats si on a déjà une recherche
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
    console.log('Searching for:', query) // Debug
    
    // Utiliser l'API Nominatim d'OpenStreetMap pour la recherche de villes françaises
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=fr&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
    
    this.http.get<NominatimResult[]>(url).subscribe({
      next: (results) => {
        console.log('Search results:', results) // Debug
        
        this.searchResults = results.filter(result => 
          result.display_name && result.lat && result.lon
        )
        
        this.showResults = this.searchResults.length > 0
        this.isSearching = false
        
        console.log('Filtered results:', this.searchResults) // Debug
        console.log('Show results:', this.showResults) // Debug
      },
      error: (error) => {
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
    
    console.log('Location selected:', { lat, lon, name: result.display_name }) // Debug
    
    this.locationSelected.emit({
      lat,
      lon,
      name: result.display_name
    })
    
    this.clearSearch()
  }

  requestUserLocation(): void {
    this.userLocationRequested.emit()
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
}