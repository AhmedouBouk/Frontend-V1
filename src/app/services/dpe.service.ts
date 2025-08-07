import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DpeProperty } from '../models/dpe.model';
import { environment } from '../../environments/environment';
import { CoordinateConversionService } from './coordinate-conversion.service';

@Injectable({
  providedIn: 'root'
})
export class DpeService {
  constructor(
    private readonly http: HttpClient,
    private readonly coordService: CoordinateConversionService
  ) {}

  /**
   * Convertit des coordonnees lat/lon (WGS84) en coordonnees Lambert 93 avec haute precision
   * Utilise la transformation officielle IGN
   */
  private convertLatLonToProjected(latLon: [number, number]): [number, number] {
    const [lat, lon] = latLon;
    
    // Validation des coordonnees pour la France
    if (!this.coordService.isValidFrenchCoordinates(lat, lon)) {
      console.warn(`⚠️ Coordonnees hors France: [${lat}, ${lon}]`);
    }
    
    // Conversion precise WGS84 → Lambert93
    const [x_projected, y_projected] = this.coordService.wgs84ToLambert93(lat, lon);
    
    
    return [y_projected, x_projected];
  }

  /**
   * Convertit des coordonnees Lambert 93 vers lat/lon (WGS84) avec haute precision
   * Utilise la transformation inverse officielle IGN
   */
  private convertProjectedToLatLon(projected: [number, number]): [number, number] {
    const [y_projected, x_projected] = projected;
    
    // Conversion precise Lambert93 → WGS84
    const [lat, lon] = this.coordService.lambert93ToWgs84(x_projected, y_projected);
    
    
    return [lat, lon];
  }

  /**
   * Récupère les données DPE depuis le backend
   * @param topLeft Coordonnées du coin haut-gauche [lat, lng]
   * @param bottomRight Coordonnées du coin bas-droit [lat, lng]
   * @param energyFilter Filtre énergétique selon le mode:
   *                     - Pour 'class': tableau de classes (ex: ['A', 'B'])
   *                     - Pour 'exact': valeur exacte (ex: 3742.6)
   *                     - Pour 'interval': tableau de deux valeurs [min, max] (ex: [2000, 4000])
   * @param filterMode Mode de filtre: 'exact', 'interval', ou 'class'
   * @param surfaceRange Plage de surface [min, max] en m²
   * @param exactDate Date exacte pour le filtre de période (format YYYY-MM-DD)
   * @param dateRange Plage de dates [min, max] pour le filtre de période (format [YYYY-MM-DD, YYYY-MM-DD])
   */
  getDpeProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    energyFilter: string[] | number | [number, number] | null = null,
    filterMode: 'exact' | 'interval' | 'class' = 'class',
    surfaceRange: [number, number] = [0, 10000],
    exactDate: string | null = null,
    dateRange: [string, string] | null = null
  ): Observable<DpeProperty[]> {
    
    // -- 1. Conversion des coordonnees -------------------------------------------
    const topConverted = this.convertLatLonToProjected(topLeft);
    const bottomConverted = this.convertLatLonToProjected(bottomRight);
  
    // Calculate the area covered by these bounds
    const latRange = Math.abs(topLeft[0] - bottomRight[0]);
    const lonRange = Math.abs(topLeft[1] - bottomRight[1]);
    
    // -- 2. Construction des parametres selon le format attendu par le backend ---
    // Le backend getPointsInZone attend topLeft et bottomRight au format "lat,lon"
    
    // Calculer les coordonnees min/max pour les parametres
    const lat_min = Math.min(topConverted[0], bottomConverted[0]);
    const lat_max = Math.max(topConverted[0], bottomConverted[0]);
    const lon_min = Math.min(topConverted[1], bottomConverted[1]);
    const lon_max = Math.max(topConverted[1], bottomConverted[1]);
    
    // Format topLeft/bottomRight attendu par le backend (format: "lat,lon")
    const topLeftParam = `${lat_max},${lon_min}`; // Top-left: lat_max, lon_min
    const bottomRightParam = `${lat_min},${lon_max}`; // Bottom-right: lat_min, lon_max
    
    const params: any = {
      topLeft: topLeftParam,
      bottomRight: bottomRightParam
    };
    
    // Ajout des filtres de date si présents
    if (exactDate) {
      params.date_exacte = exactDate;
    } else if (dateRange && dateRange.length === 2) {
      params.date_min = dateRange[0];
      params.date_max = dateRange[1];
    }

    // Gestion des differents modes de filtre selon le backend
    if (filterMode === 'class' && Array.isArray(energyFilter) && energyFilter.length > 0) {
      params.classe = energyFilter.join(','); // Le backend attend 'classe'
    } else if (filterMode === 'exact' && typeof energyFilter === 'number') {
      params.valeur_dpe_exact = energyFilter; // Le backend attend 'valeur_dpe_exact'
    } else if (filterMode === 'interval' && Array.isArray(energyFilter) && energyFilter.length === 2) {
      params.valeur_dpe_min = energyFilter[0]; // Le backend attend 'valeur_dpe_min'
      params.valeur_dpe_max = energyFilter[1]; // Le backend attend 'valeur_dpe_max'
    }
    
    const apiUrl = `${environment.apiUrl}/dpe`;
    
    // Log the complete API request
    console.log('🚀 DPE API Request:', {
      url: apiUrl,
      params: params,
      dateParams: {
        exactDate,
        dateRange,
        useDateFilter: exactDate !== null || dateRange !== null
      }
    });

    // -- 3. Appel HTTP et mapping -------------------------------------------
    return this.http.get<any[]>(apiUrl, { params }).pipe(
      map((response: any[]) => {
        console.log('🔍 DPE API Response sample (first item):', response[0]);
        console.log('🔍 ep_conso_5_usages field check:', response[0]?.ep_conso_5_usages);
        return response.map((item: any) => {
          let lat: number;
          let lon: number;

          if (item.ban_x && item.ban_y) {
            // DPE coordinates are confirmed to be in Lambert93 projection with Y,X order
            // Based on testing, this method consistently produces valid coordinates
            const converted = this.convertProjectedToLatLon([item.ban_y, item.ban_x]);
            lat = converted[0];
            lon = converted[1];

            // Validate coordinates are within reasonable bounds for France
            if (lat < 41 || lat > 51 || lon < -5 || lon > 10) {
              console.warn(`⚠️ DPE coordinates outside France bounds: ban_x=${item.ban_x}, ban_y=${item.ban_y} → lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);
              // Keep coordinates anyway - might be overseas territories or edge cases
            }
          } else {
            // Fallback to 0,0 if no coordinates
            lat = 0;
            lon = 0;
            console.warn(`⚠️ DPE Missing coordinates for item:`, item.id);
          }

          return {
            id: item.id?.toString() ?? '',
            latitude: lat,
            longitude: lon,
            address: item.ban_street ?? item.adresse_brut ?? '',
            energyClass: item.classe_conso_energie ?? 'G',
            gesClass: item.classe_emission_ges ?? 'G',
            year: item.annee_construction ?? new Date().getFullYear(),
            city: item.ban_city ?? item.nom_commune_brut ?? '',
            postalCode: item.ban_postcode ?? item.code_postal_brut ?? '',
            ep_conso_5_usages: item.ep_conso_5_usages ?? undefined
          } as DpeProperty;
        });
      }),
      catchError(error => {
        console.error('❌ Erreur API DPE:', error);
        return of([]);
      })
    );
  }
}
