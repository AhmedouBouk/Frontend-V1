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
    
    console.log(`🎯 DPE Conversion precise: [${lat}, ${lon}] → Lambert93: [${y_projected.toFixed(2)}, ${x_projected.toFixed(2)}]`);
    
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
    
    console.log(`🎯 DPE Conversion inverse precise: Lambert93 [${x_projected.toFixed(2)}, ${y_projected.toFixed(2)}] → WGS84: [${lat}, ${lon}]`);
    
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
   */
  getDpeProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    energyFilter: string[] | number | [number, number] | null = null,
    filterMode: 'exact' | 'interval' | 'class' = 'class',
    surfaceRange: [number, number] = [0, 10000]
  ): Observable<DpeProperty[]> {
    
    // -- 1. Conversion des coordonnees -------------------------------------------
    const topConverted = this.convertLatLonToProjected(topLeft);
    const bottomConverted = this.convertLatLonToProjected(bottomRight);
  
    console.log('🌍 DPE Frontend→Backend coordinate conversion:');
    console.log(`  📍 Original topLeft: [${topLeft[0].toFixed(6)}, ${topLeft[1].toFixed(6)}] → Lambert93: [${topConverted[0].toFixed(2)}, ${topConverted[1].toFixed(2)}]`);
    console.log(`  📍 Original bottomRight: [${bottomRight[0].toFixed(6)}, ${bottomRight[1].toFixed(6)}] → Lambert93: [${bottomConverted[0].toFixed(2)}, ${bottomConverted[1].toFixed(2)}]`);
  
    // Calculate the area covered by these bounds
    const latRange = Math.abs(topLeft[0] - bottomRight[0]);
    const lonRange = Math.abs(topLeft[1] - bottomRight[1]);
    console.log(`  📏 Query area: ${latRange.toFixed(6)}° lat × ${lonRange.toFixed(6)}° lon`);
    
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

    // Gestion des differents modes de filtre selon le backend
    if (filterMode === 'class' && Array.isArray(energyFilter) && energyFilter.length > 0) {
      params.classe = energyFilter.join(','); // Le backend attend 'classe'
    } else if (filterMode === 'exact' && typeof energyFilter === 'number') {
      params.valeur_dpe_exact = energyFilter; // Le backend attend 'valeur_dpe_exact'
    } else if (filterMode === 'interval' && Array.isArray(energyFilter) && energyFilter.length === 2) {
      params.valeur_dpe_min = energyFilter[0]; // Le backend attend 'valeur_dpe_min'
      params.valeur_dpe_max = energyFilter[1]; // Le backend attend 'valeur_dpe_max'
    }
    
    console.log('🚀 DPE Backend API parameters:', {
      topLeft: topLeftParam,
      bottomRight: bottomRightParam,
      filterMode: filterMode,
      energyFilter: energyFilter,
      lambert93_bounds: { lat_min, lat_max, lon_min, lon_max }
    });

    const apiUrl = `${environment.apiUrl}/dpe`;
    console.log('API DPE URL:', `${apiUrl}?${new URLSearchParams(params).toString()}`);

    // -- 3. Appel HTTP et mapping -------------------------------------------
    return this.http.get(apiUrl, { params }).pipe(
      map((data: any) => {
        console.log(`📊 DPE Backend response: ${Array.isArray(data) ? data.length : 0} items received`);
        return Array.isArray(data) ? data : [];
      }),
      map(rows => rows.map(item => {
        // DPE coordinates handling: ban_x/ban_y appear to be in a different coordinate system
        // Based on sample data analysis, they seem to be encoded WGS84 coordinates
        let lat: number;
        let lon: number;
        
        if (item.ban_x && item.ban_y) {
          // DPE coordinates are confirmed to be in Lambert93 projection with Y,X order
          // Based on testing, this method consistently produces valid coordinates
          const converted = this.convertProjectedToLatLon([item.ban_y, item.ban_x]);
          lat = converted[0];
          lon = converted[1];
          
          // Validate coordinates are within reasonable bounds for France
          if (lat >= 41 && lat <= 51 && lon >= -5 && lon <= 10) {
            console.log(`🎯 DPE Lambert93 conversion: ban_x=${item.ban_x}, ban_y=${item.ban_y} → lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);
          } else {
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
          postalCode: item.ban_postcode ?? item.code_postal_brut ?? ''
        } as DpeProperty;
      })),
      catchError(error => {
        console.error('❌ Erreur API DPE:', error);
        return of([]);
      })
    );
  }
}
