import {
  Component,
  EventEmitter,
  Input,
  Output,
  type OnInit,
  type OnChanges,
  type OnDestroy,
  SimpleChanges,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { MapService } from "../../../services/map.service";
import { TutorialService } from "../../../services/tutorial.service";
import { KeycloakAuthService } from "../../../services/keycloak-auth.service";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

@Component({
  selector: "app-map-controls",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./map-controls.component.html",
  styleUrls: ["./map-controls.component.scss"],
})
export class MapControlsComponent implements OnInit, OnChanges, OnDestroy {
  // Original map-controls inputs
  @Input() isLoading = false;

  // Map-search inputs
  @Input() sidebarOpen = false;
  @Input() resultsOpen = false;

  // Map-alert inputs
  @Input() resultCount = 0;
  @Input() maxResults = 500;
  @Input() activeFilters: string[] = [];

  // Map type inputs
  @Input() mapType: "street" | "satellite" | "cadastre" = "street";

  // NEW: Add zoom level input to detect zoom changes
  @Input() currentZoom?: number;

  // Tutorial control
  @Input() showTutorialButton = true;

  // Original map-controls outputs
  @Output() locateUser = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();

  // Map-search outputs
  @Output() locationSelected = new EventEmitter<{ lat: number; lon: number; name: string }>();
  @Output() userLocationRequested = new EventEmitter<void>();

  // Map type outputs
  @Output() mapTypeChanged = new EventEmitter<"street" | "satellite" | "cadastre">();

  // Tutorial output
  @Output() tutorialCompleted = new EventEmitter<void>();

  // Search component properties
  isSearchOpen = false;
  searchQuery = "";
  isSearching = false;
  searchResults: NominatimResult[] = [];
  showResults = false;

  // Alert component properties - using same logic as your map-alert
  isManuallyHidden = false;

  // Track previous states to detect real changes
  private previousFilters: string[] = [];
  private previousZoom?: number;

  // Services injection
  private readonly http = inject(HttpClient);
  private readonly mapService = inject(MapService);
  private readonly tutorialService = inject(TutorialService);
  private readonly kcAuth = inject(KeycloakAuthService);

  // Auth panel state
  authExpanded = false;

  ngOnInit() {
    // Store initial states
    this.previousFilters = [...this.activeFilters];
    this.previousZoom = this.currentZoom;
    
    // Optionnel : Démarrer automatiquement le tutoriel pour les nouveaux utilisateurs
    this.checkForFirstVisit();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reset manual hide when result count drops below threshold
    if (changes["resultCount"]) {
      const currentValue = changes["resultCount"].currentValue;
      const previousValue = changes["resultCount"].previousValue;
      
      // Only reset when going from >= 500 to < 500
      if (currentValue < this.maxResults && this.isManuallyHidden) {
        this.isManuallyHidden = false;
      }
    }
    
    // Check for REAL filter changes (not just array reference changes)
    if (changes["activeFilters"]) {
      const reallyChanged = this.hasFiltersReallyChanged();
      
      if (reallyChanged) {
        this.isManuallyHidden = false;
      } 
      
      // Update previous filters
      this.previousFilters = [...this.activeFilters];
    }

    // NEW: Check for zoom changes
    if (changes["currentZoom"]) {
      const currentZoom = changes["currentZoom"].currentValue;
      const previousZoom = changes["currentZoom"].previousValue;
      
      // Reset manual hide when zoom changes AND we still have >= maxResults
      if (currentZoom !== previousZoom && 
          this.isManuallyHidden && 
          this.resultCount >= this.maxResults) {
        this.isManuallyHidden = false;
      }
      
      // Update previous zoom
      this.previousZoom = currentZoom;
    }
  }

  ngOnDestroy() {
    // Nettoyer le tutoriel si le component est détruit
    this.tutorialService.stopTutorial();
  }

  private hasFiltersReallyChanged(): boolean {
    // Check if arrays are different in length
    if (this.activeFilters.length !== this.previousFilters.length) {
      return true;
    }
    
    // Check if arrays have different content (regardless of order)
    const current = [...this.activeFilters].sort();
    const previous = [...this.previousFilters].sort();
    
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== previous[i]) {
        return true;
      }
    }
    
    return false;
  }

  // -------- Alert methods --------
  closeAlert(): void {
    this.isManuallyHidden = true;
  }

  // NEW: Method to manually trigger alert reset (for testing or manual triggers)
  resetAlert(): void {
    this.isManuallyHidden = false;
  }

  // -------- Original map-controls methods --------
  onLocateUser(): void {
    this.locateUser.emit();
  }

  onToggleSidebar(): void {
    if (!this.isLoading) {
      this.toggleSidebar.emit();
    }
  }

  // -------- Map type control methods --------
  setMapType(type: "street" | "satellite" | "cadastre"): void {
    this.mapType = type;
    this.mapService.setMapType(type);
    this.mapTypeChanged.emit(type);
  }

  // -------- Tutorial methods --------
  startTutorial(): void {
    this.tutorialService.startMapControlsTutorial();
  }

  startQuickTour(): void {
    this.tutorialService.startQuickTour();
  }

  private checkForFirstVisit(): void {
    const hasSeenTutorial = localStorage.getItem('hasSeenMapControlsTutorial');
    
    if (!hasSeenTutorial) {
      // Attendre un peu que l'interface soit prête
      setTimeout(() => {
        this.startQuickTour();
        localStorage.setItem('hasSeenMapControlsTutorial', 'true');
        this.tutorialCompleted.emit();
      }, 1000);
    }
  }

  resetTutorialFlag(): void {
    localStorage.removeItem('hasSeenMapControlsTutorial');
  }

  // Méthode pour déclencher le tutoriel depuis le parent
  triggerTutorial(type: 'quick' | 'full' = 'full'): void {
    if (type === 'quick') {
      this.startQuickTour();
    } else {
      this.startTutorial();
    }
  }

  // -------- Map-search methods --------
  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    if (this.isSearchOpen) {
      setTimeout(() => {
        const input = document.querySelector(".search-input") as HTMLInputElement | null;
        if (input) input.focus();
      }, 300);
    } else {
      this.clearSearch();
    }
  }

  onSearchInput(): void {
    if (this.searchQuery.length < 2) {
      this.searchResults = [];
      this.showResults = false;
      return;
    }

    this.isSearching = true;
    this.searchAddress(this.searchQuery);
  }

  onSearchFocus(): void {
    if (this.searchQuery.length >= 2 && this.searchResults.length > 0) {
      this.showResults = true;
    }
  }

  onSearchSubmit(): void {
    if (this.searchQuery.trim() && this.searchResults.length > 0) {
      this.selectLocation(this.searchResults[0]);
    } else if (this.searchQuery.trim()) {
      this.searchAddress(this.searchQuery);
    }
  }

  private searchAddress(query: string): void {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&countrycodes=fr&addressdetails=1&limit=10&accept-language=fr`;

    this.http.get<any[]>(url).subscribe({
      next: (results) => {
        const validResults = results
          .filter((result) => {
            if (!result.display_name || !result.lat || !result.lon) return false;

            const relevantTypes = ["city", "town", "village", "municipality", "administrative"];
            const isRelevantType =
              !result.type ||
              relevantTypes.some(
                (type: string) =>
                  result.type.toLowerCase().includes(type) ||
                  result.class === "place" ||
                  result.class === "boundary"
              );

            const hasGoodImportance = !result.importance || result.importance > 0.3;

            return isRelevantType && hasGoodImportance;
          })
          .map((result) => ({
            display_name: result.display_name,
            lat: result.lat,
            lon: result.lon,
            type: result.type || "unknown",
            importance: result.importance || 0,
          }))
          .sort((a: NominatimResult, b: NominatimResult) => b.importance - a.importance);

        this.searchResults = validResults;
        this.removeDuplicateResults();

        this.showResults = this.searchResults.length > 0;
        this.isSearching = false;
      },
      error: () => {
        this.isSearching = false;
        this.searchResults = [];
        this.showResults = false;
      },
    });
  }

  private removeDuplicateResults(): void {
    const seen = new Set<string>();
    const uniqueResults: NominatimResult[] = [];

    for (const result of this.searchResults) {
      const lat = Math.round(Number.parseFloat(result.lat) * 10000) / 10000;
      const lon = Math.round(Number.parseFloat(result.lon) * 10000) / 10000;
      const uniqueKey = `${result.display_name.toLowerCase().trim()}_${lat}_${lon}`;

      const cityName = result.display_name.split(",")[0].toLowerCase().trim();
      const cityKey = `city_${cityName}`;

      if (!seen.has(uniqueKey) && !seen.has(cityKey)) {
        seen.add(uniqueKey);
        seen.add(cityKey);
        uniqueResults.push(result);
      }
    }

    this.searchResults = uniqueResults.slice(0, 3);
  }

  
  requestUserLocation(): void {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas prise en charge par votre navigateur.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.mapService.setUserLocation(latitude, longitude, position.coords.accuracy);
        this.userLocationRequested.emit();
      },
      (error) => {
        console.error("Erreur de géolocalisation:", error);
        let errorMessage = "Impossible de déterminer votre position.";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Vous avez refusé l'accès à votre position.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Les informations de localisation ne sont pas disponibles.";
            break;
          case error.TIMEOUT:
            errorMessage = "La demande de localisation a expiré.";
            break;
        }

        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }


 

selectLocation(result: NominatimResult): void {
this.locationSelected.emit({
  lat: Number.parseFloat(result.lat),
  lon: Number.parseFloat(result.lon),
  name: result.display_name,
});

this.clearSearch();
}



trackByResult(index: number, result: NominatimResult): string {
return result.display_name;
}

private clearSearch(): void {
this.searchQuery = "";
this.searchResults = [];
this.showResults = false;
this.isSearching = false;
this.isSearchOpen = false;
}

// ===== Auth helpers & actions =====
get isAuthenticated(): boolean {
try {
  return this.kcAuth.isAuthenticated();
} catch {
  return false;
}
}

get userName(): string {
try {
  const u = this.kcAuth.user();
  return (u?.name || u?.preferred_username || 'Utilisateur') ?? 'Utilisateur';
} catch {
  return 'Utilisateur';
}
}

toggleAuthPanel(): void {
this.authExpanded = !this.authExpanded;
}

login(): void {
this.kcAuth.login();
}

logout(): void {
this.kcAuth.logout();
}
}

