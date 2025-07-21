import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DpeProperty } from '../models/dpe.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DpeService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Convertit des coordonnées lat/lon vers des coordonnées projetées (Lambert93-like)
   * Même logique que ParcelleService pour la cohérence
   */
  private convertLatLonToProjected(latLon: [number, number]): [number, number] {
    const [lat, lon] = latLon;
    // Conversion calibrée pour correspondre aux vraies coordonnées de la base de données
    // Basée sur l'analyse des données réelles de Lyon
    
    // Clamp des coordonnées pour la France métropolitaine
    const clampedLat = Math.max(41, Math.min(52, lat));
    const clampedLon = Math.max(-5, Math.min(10, lon));
    
    // Conversion calibrée pour correspondre aux coordonnées réelles
    // Lyon: lat ~45.75, lon ~4.83 doit donner X ~850000, Y ~6520000
    const x_projected = (clampedLon * 170000) + 150000;  // Calibré pour Lyon
    const y_projected = (clampedLat * 145000) - 110000;  // Calibré pour Lyon
    
    return [y_projected, x_projected];
  }

  /**
   * Convertit des coordonnées Lambert 93 approximatives vers lat/lon (WGS84)
   * Fonction inverse de convertLatLonToProjected
   */
  private convertProjectedToLatLon(projected: [number, number]): [number, number] {
    const [y_projected, x_projected] = projected;
    
    // Conversion inverse calibrée
    const lon = (x_projected - 150000) / 170000;  // Inverse de (clampedLon * 170000) + 150000
    const lat = (y_projected + 110000) / 145000;  // Inverse de (clampedLat * 145000) - 110000
    
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
    
    // -- 1. Conversion des coordonnées -------------------------------------------
    const topConverted = this.convertLatLonToProjected(topLeft);
    const bottomConverted = this.convertLatLonToProjected(bottomRight);
    
    console.log('🗺️ DPE Coordinate conversion:');
    console.log(`  Original topLeft: ${topLeft} → Projected: ${topConverted}`);
    console.log(`  Original bottomRight: ${bottomRight} → Projected: ${bottomConverted}`);
    
    // Calculer les limites min/max
    const lat_min = Math.min(topConverted[0], bottomConverted[0]);
    const lat_max = Math.max(topConverted[0], bottomConverted[0]);
    const lon_min = Math.min(topConverted[1], bottomConverted[1]);
    const lon_max = Math.max(topConverted[1], bottomConverted[1]);
    
    console.log('🗺️ Using converted coordinates for DPE:', {lat_min, lat_max, lon_min, lon_max});

    // -- 2. Paramètres de la requête -------------------------------------------
    const params: any = {
      lat_min: lat_min,
      lat_max: lat_max,
      lon_min: lon_min,
      lon_max: lon_max,
      filter_mode: filterMode,
      surface_min: surfaceRange[0],
      surface_max: surfaceRange[1]
    };

    // Gestion des différents modes de filtre
    if (filterMode === 'class' && Array.isArray(energyFilter) && energyFilter.length > 0) {
      params.energy_classes = energyFilter.join(',');
    } else if (filterMode === 'exact' && typeof energyFilter === 'number') {
      params.energy_exact = energyFilter;
    } else if (filterMode === 'interval' && Array.isArray(energyFilter) && energyFilter.length === 2) {
      params.energy_min = energyFilter[0];
      params.energy_max = energyFilter[1];
    }

    const apiUrl = `${environment.apiUrl}/dpe`;
    console.log('📡 API DPE URL:', `${apiUrl}?${new URLSearchParams(params).toString()}`);

    // -- 3. Appel HTTP et mapping -------------------------------------------
    return this.http.get(apiUrl, { params }).pipe(
      map((data: any) => Array.isArray(data) ? data : []),
      map(rows => rows.map(item => {
        // Convertir les coordonnées projetées (ban_x, ban_y) vers lat/lon pour l'affichage
        const lat = this.convertProjectedToLatLon([item.ban_y || 0, item.ban_x || 0])[0];
        const lon = this.convertProjectedToLatLon([item.ban_y || 0, item.ban_x || 0])[1];
        
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
