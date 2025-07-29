import { Component, EventEmitter, Output } from '@angular/core'
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
  @Output() locationSelected = new EventEmitter<{lat: number, lon: number, name: string}>()
  @Output() userLocationRequested = new EventEmitter<void>()

  isSearchOpen = false
  searchQuery = ''
  isSearching = false
  searchResults: NominatimResult[] = []
  showResults = false

  constructor(private http: HttpClient) {}

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
    if (this.searchQuery.length < 3) {
      this.searchResults = []
      this.showResults = false
      return
    }

    this.isSearching = true
    this.searchCity(this.searchQuery)
  }

  onSearchSubmit(): void {
    if (this.searchQuery.trim() && this.searchResults.length > 0) {
      this.selectLocation(this.searchResults[0])
    }
  }

  private searchCity(query: string): void {
    // Utiliser l'API Nominatim d'OpenStreetMap pour la recherche de villes françaises
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=fr&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
    
    this.http.get<NominatimResult[]>(url).subscribe({
      next: (results) => {
        this.searchResults = results.filter(result => 
          result.display_name.toLowerCase().includes('france') ||
          result.boundingbox // Filtrer les résultats valides
        )
        this.showResults = this.searchResults.length > 0
        this.isSearching = false
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

  private clearSearch(): void {
    this.searchQuery = ''
    this.searchResults = []
    this.showResults = false
    this.isSearching = false
    this.isSearchOpen = false
  }
}
