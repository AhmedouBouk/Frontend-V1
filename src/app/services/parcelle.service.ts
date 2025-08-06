// src/app/services/parcelle.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ParcelleProperty } from '../models/parcelle.model';
import { environment } from '../../environments/environment';
import { CoordinateConversionService } from './coordinate-conversion.service';

@Injectable({ providedIn: 'root' })
export class ParcelleService {
  constructor(
    private readonly http: HttpClient,
    private readonly coordService: CoordinateConversionService
  ) {}

  /**
   * Convertit des coordonnees lat/lon (WGS84) en coordonnees Lambert 93 avec haute precision
   * Utilise la transformation officielle IGN pour la base de donnees parcelles francaises
   * @param latLon [latitude, longitude] en degres
   * @returns [y_projected, x_projected] coordonnees Lambert 93 en metres
   */
  private convertLatLonToProjected(latLon: [number, number]): [number, number] {
    const [lat, lon] = latLon;
    
    // Validation des coordonnees pour la France (incluant DOM-TOM)
    if (!this.coordService.isValidFrenchCoordinates(lat, lon)) {
      console.warn(`⚠️ Parcelles - Coordonnees potentiellement hors France metropolitaine: [${lat}, ${lon}]`);
    }
    
    // Conversion precise WGS84 → Lambert93
    const [x_projected, y_projected] = this.coordService.wgs84ToLambert93(lat, lon);
    
    console.log(`🎯 Parcelles Conversion precise: [${lat}, ${lon}] → Lambert93: [${y_projected.toFixed(2)}, ${x_projected.toFixed(2)}]`);
    
    return [y_projected, x_projected];
  }

  /**
   * Convertit des coordonnees Lambert 93 vers lat/lon (WGS84) avec haute precision
   * Utilise la transformation inverse officielle IGN
   * @param projected [y_projected, x_projected] coordonnees Lambert 93 en metres
   * @returns [latitude, longitude] en degres
   */
  private convertProjectedToLatLon(projected: [number, number]): [number, number] {
    const [y_projected, x_projected] = projected;
    
    // Conversion precise Lambert93 → WGS84
    const [lat, lon] = this.coordService.lambert93ToWgs84(x_projected, y_projected);
    
    console.log(`🎯 Parcelles Conversion inverse precise: Lambert93 [${x_projected.toFixed(2)}, ${y_projected.toFixed(2)}] → WGS84: [${lat}, ${lon}]`);
    
    return [lat, lon];
  }

  /**
   * Recupere les donnees Parcelle depuis le backend
   * @param topLeft       [lat, lng] coin haut-gauche
   * @param bottomRight   [lat, lng] coin bas-droit
   * @param surfaceRange  [min, max] ou null si desactive
   * @param filterMode    'exact' | 'interval'
   */
  getParcelleProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    surfaceRange: [number, number] | null = null,
    filterMode: 'exact' | 'interval' = 'interval'
  ): Observable<ParcelleProperty[]> {

    // -- 1. Conversion des coordonnees lat/lon vers coordonnees projetees ----
    // Le backend s'attend a recevoir des coordonnees projetees (Lambert 93)
    // Conversion approximative: multiplier par 111320 pour convertir degres en metres
    const projectedTopLeft = this.convertLatLonToProjected(topLeft);
    const projectedBottomRight = this.convertLatLonToProjected(bottomRight);
    
    console.log('Coordinate conversion:');
    console.log('  Original topLeft:', topLeft, '-> Projected:', projectedTopLeft);
    console.log('  Original bottomRight:', bottomRight, '-> Projected:', projectedBottomRight);

    // -- 2. Construire les parametres selon le format attendu par le backend ------------
    // Le backend getParcelles attend topLeft et bottomRight au format "lat,lon"
    
    // Calculer les coordonnees min/max pour les parametres
    const lat_min = Math.min(projectedBottomRight[0], projectedTopLeft[0]);
    const lat_max = Math.max(projectedBottomRight[0], projectedTopLeft[0]);
    const lon_min = Math.min(projectedTopLeft[1], projectedBottomRight[1]);
    const lon_max = Math.max(projectedTopLeft[1], projectedBottomRight[1]);
    
    // Format topLeft/bottomRight attendu par le backend (format: "lat,lon")
    const topLeftParam = `${lat_max},${lon_min}`; // Top-left: lat_max, lon_min
    const bottomRightParam = `${lat_min},${lon_max}`; // Bottom-right: lat_min, lon_max
    
    let params = new HttpParams()
      .set('topLeft', topLeftParam)
      .set('bottomRight', bottomRightParam);

    // Format surface selon le format attendu par le backend ("min,max")
    if (surfaceRange) {
      const surfaceParam = `${surfaceRange[0]},${surfaceRange[1]}`;
      params = params.set('surface', surfaceParam);
    } 
    
    console.log('Parametres envoyes au backend:', {
      topLeft: topLeftParam,
      bottomRight: bottomRightParam,
      surface: params.get('surface'),
      coordonnees_projetees: { lat_min, lat_max, lon_min, lon_max }
    });

    // Construction de l'URL de l'API pour les parcelles
    const apiUrl = `${environment.apiUrl}/parcelles`;
    console.log('API Parcelle URL:', `${apiUrl}?${params.toString()}`);

    // -- 2. Appel HTTP et mapping -------------------------------------------
    console.log('Tentative d\'appel API avec URL:', apiUrl);
    console.log('Parametres complets:', params.toString());
    
    // Appel HTTP vers le backend
    return this.http.get(apiUrl, { params }).pipe(
      map((data: any) => Array.isArray(data) ? data : []),
      map(rows => rows.map(item => {
        // Convertir les coordonnees projetees (x, y) vers lat/lon pour l'affichage
        let lat: number;
        let lon: number;
        
        if (item.x && item.y) {
          // Parcelle coordinates are in Lambert93 projection with Y,X order
          // Use a single conversion call for consistency with DPE service
          const converted = this.convertProjectedToLatLon([item.y, item.x]);
          lat = converted[0];
          lon = converted[1];
          
          // Validate coordinates are within reasonable bounds for France
          if (lat >= 41 && lat <= 51 && lon >= -5 && lon <= 10) {
            console.log(`🎯 Parcelle Lambert93 conversion: x=${item.x}, y=${item.y} → lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);
          } else {
            console.warn(`⚠️ Parcelle coordinates outside France bounds: x=${item.x}, y=${item.y} → lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);
            // Keep coordinates anyway - might be overseas territories or edge cases
          }
        } else {
          // Fallback to 0,0 if no coordinates
          lat = 0;
          lon = 0;
          console.warn(`⚠️ Parcelle Missing coordinates for item:`, item.id);
        }
        
        return {
          id:          item.id              ?? '',
          latitude:    lat,                    // Converti depuis y (coordonnee projetee)
          longitude:   lon,                    // Converti depuis x (coordonnee projetee)
          number:      item.numero          ?? item.numero_complet ?? '',
          surface:     Number(item.contenance) || 0,  // contenance = surface en m²
          address:     item.nom_voie        ?? '',
          city:        item.code_commune   ?? '',
          postalCode:  item.code_commune   ?? ''   // Utiliser code_commune comme postal code temporaire
        } as ParcelleProperty;
      })),
      catchError(err => {
        console.error('ERROR: Erreur API Parcelle:', err);
        console.error('Details de l\'erreur:', {
          status: err.status,
          statusText: err.statusText,
          url: err.url,
          message: err.message
        });
        return of([]);
      })
    );
  }
}
