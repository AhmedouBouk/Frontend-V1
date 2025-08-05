import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  type: string
  importance: number
}

@Component({
  selector: 'app-map-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-search.component.html',
  styleUrls: ['./map-search.component.scss']
})
export class MapSearchComponent implements OnInit {
  @Input() sidebarOpen: boolean = false
  @Output() locationSelected = new EventEmitter<{lat: number, lon: number, name: string}>()
  @Output() userLocationRequested = new EventEmitter<void>()

  isSearchOpen = false
  searchQuery = ''
  isSearching = false
  searchResults: NominatimResult[] = []
  showResults = false

  constructor(private readonly http: HttpClient) {}

  ngOnInit() {
    // No initialization needed for Nominatim API
  }

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
    
    if (this.searchQuery.length < 2) { // Minimum 2 characters
      this.searchResults = []
      this.showResults = false
      return
    }

    this.isSearching = true
    this.searchAddress(this.searchQuery)
  }

  onSearchFocus(): void {
    // Affiche les résultats si on a déjà une recherche
    if (this.searchQuery.length >= 2 && this.searchResults.length > 0) {
      this.showResults = true
    }
  }

  onSearchSubmit(): void {
    if (this.searchQuery.trim() && this.searchResults.length > 0) {
      this.selectLocation(this.searchResults[0]);
    } else if (this.searchQuery.trim()) {
      // If no results yet but query exists, try to search
      this.searchAddress(this.searchQuery);
    }
  }

  private searchAddress(query: string): void {
    console.log('Searching for:', query) // Debug
    
    // Use Nominatim API for French cities search
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=fr&addressdetails=1&limit=10&accept-language=fr`;
    
    this.http.get<any[]>(url).subscribe({
      next: (results) => {
        console.log('Raw API results:', results);
        
        // Filter and transform results with better relevance filtering
        const validResults = results
          .filter(result => {
            // Basic validation
            if (!result.display_name || !result.lat || !result.lon) return false;
            
            // Filter out less relevant results
            // Prioritize cities, towns, villages over other types
            const relevantTypes = ['city', 'town', 'village', 'municipality', 'administrative'];
            const isRelevantType = !result.type || relevantTypes.some(type => 
              result.type.toLowerCase().includes(type) || 
              result.class === 'place' ||
              result.class === 'boundary'
            );
            
            // Filter by importance (higher is better)
            const hasGoodImportance = !result.importance || result.importance > 0.3;
            
            return isRelevantType && hasGoodImportance;
          })
          .map(result => ({
            display_name: result.display_name,
            lat: result.lat,
            lon: result.lon,
            type: result.type || 'unknown',
            importance: result.importance || 0
          }))
          // Sort by importance (descending) to get most relevant first
          .sort((a, b) => b.importance - a.importance);
        
        this.searchResults = validResults;
        
        // Remove duplicates
        this.removeDuplicateResults();
        
        this.showResults = this.searchResults.length > 0;
        this.isSearching = false;
        
        console.log('Unique filtered results:', this.searchResults);
        console.log('Show results:', this.showResults);
      },
      error: (error) => {
        console.error('Search error:', error);
        this.isSearching = false;
        this.searchResults = [];
        this.showResults = false;
      }
    });
  }
  
  private removeDuplicateResults(): void {
    const seen = new Set<string>();
    const uniqueResults: NominatimResult[] = [];
    
    for (const result of this.searchResults) {
      // Create a unique key based on display_name and rounded coordinates
      // Round coordinates to 4 decimal places to catch near-duplicates
      const lat = Math.round(parseFloat(result.lat) * 10000) / 10000;
      const lon = Math.round(parseFloat(result.lon) * 10000) / 10000;
      const uniqueKey = `${result.display_name.toLowerCase().trim()}_${lat}_${lon}`;
      
      // Also check for similar names (same city name but different administrative details)
      const cityName = result.display_name.split(',')[0].toLowerCase().trim();
      const cityKey = `city_${cityName}`;
      
      if (!seen.has(uniqueKey) && !seen.has(cityKey)) {
        seen.add(uniqueKey);
        seen.add(cityKey);
        uniqueResults.push(result);
      } else {
        console.log('Duplicate result filtered out:', result.display_name);
      }
    }
    
    this.searchResults = uniqueResults.slice(0, 3); // Limit to 3 most relevant results
  }

  selectLocation(result: NominatimResult): void {
    console.log('Location selected:', result) // Debug
    
    this.locationSelected.emit({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      name: result.display_name
    });
    
    this.clearSearch();
  }

  requestUserLocation(): void {
    this.userLocationRequested.emit()
  }

  trackByResult(index: number, result: NominatimResult): string {
    return result.display_name;
  }

  private clearSearch(): void {
    this.searchQuery = ''
    this.searchResults = []
    this.showResults = false
    this.isSearching = false
    this.isSearchOpen = false
  }
}