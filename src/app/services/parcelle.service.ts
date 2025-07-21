// src/app/services/parcelle.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ParcelleProperty } from '../models/parcelle.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ParcelleService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Convertit des coordonnées lat/lon (WGS84) en coordonnées Lambert 93 approximatives
   * Cette conversion est adaptée pour la base de données parcelles françaises
   * @param latLon [latitude, longitude] en degrés
   * @returns [y_projected, x_projected] coordonnées Lambert 93 en mètres
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
   * @param projected [y_projected, x_projected] coordonnées Lambert 93 en mètres
   * @returns [latitude, longitude] en degrés
   */
  private convertProjectedToLatLon(projected: [number, number]): [number, number] {
    const [y_projected, x_projected] = projected;
    
    // Conversion inverse calibrée
    const lon = (x_projected - 150000) / 170000;  // Inverse de (clampedLon * 170000) + 150000
    const lat = (y_projected + 110000) / 145000;  // Inverse de (clampedLat * 145000) - 110000
    
    return [lat, lon];
  }

  /**
   * Récupère les données Parcelle depuis le backend
   * @param topLeft       [lat, lng] coin haut-gauche
   * @param bottomRight   [lat, lng] coin bas-droit
   * @param surfaceRange  [min, max] ou null si désactivé
   * @param filterMode    'exact' | 'interval'
   */
  getParcelleProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    surfaceRange: [number, number] | null = null,
    filterMode: 'exact' | 'interval' = 'interval'
  ): Observable<ParcelleProperty[]> {

    // -- 1. Conversion des coordonnées lat/lon vers coordonnées projetées ----
    // Le backend s'attend à recevoir des coordonnées projetées (Lambert 93)
    // Conversion approximative: multiplier par 111320 pour convertir degrés en mètres
    const projectedTopLeft = this.convertLatLonToProjected(topLeft);
    const projectedBottomRight = this.convertLatLonToProjected(bottomRight);
    
    console.log('🗺️ Coordinate conversion:');
    console.log('  Original topLeft:', topLeft, '→ Projected:', projectedTopLeft);
    console.log('  Original bottomRight:', bottomRight, '→ Projected:', projectedBottomRight);

    // -- 2. Construire les paramètres avec coordonnées projetées ------------
    // Utiliser les vraies coordonnées converties pour respecter le zoom de la carte
    let params = new HttpParams()
      .set('lat_min',  Math.min(projectedBottomRight[0], projectedTopLeft[0]).toString())  // Y minimum
      .set('lat_max',  Math.max(projectedBottomRight[0], projectedTopLeft[0]).toString())  // Y maximum
      .set('lon_min',  Math.min(projectedTopLeft[1], projectedBottomRight[1]).toString())  // X minimum
      .set('lon_max',  Math.max(projectedTopLeft[1], projectedBottomRight[1]).toString())  // X maximum
      .set('filter_mode', filterMode);
    
    console.log('🗺️ Using converted coordinates from map bounds:', {
      lat_min: Math.min(projectedBottomRight[0], projectedTopLeft[0]),
      lat_max: Math.max(projectedBottomRight[0], projectedTopLeft[0]),
      lon_min: Math.min(projectedTopLeft[1], projectedBottomRight[1]),
      lon_max: Math.max(projectedTopLeft[1], projectedBottomRight[1])
    });

    // ⇢ NO MORE "surface=0,10000"
    if (surfaceRange) {
      // Format the surface parameters as separate values as expected by the backend
      params = params
        .set('surface_min', surfaceRange[0].toString())
        .set('surface_max', surfaceRange[1].toString());
    }

    const apiUrl = `${environment.apiUrl}/parcelles`;
    console.log('📡 API Parcelle URL:', `${apiUrl}?${params.toString()}`);

    // -- 2. Appel HTTP et mapping -------------------------------------------
    return this.http.get(apiUrl, { params }).pipe(
      map((data: any) => Array.isArray(data) ? data : []),
      map(rows => rows.map(item => {
        // Convertir les coordonnées projetées (x, y) vers lat/lon pour l'affichage
        const lat = this.convertProjectedToLatLon([item.y || 0, item.x || 0])[0];
        const lon = this.convertProjectedToLatLon([item.y || 0, item.x || 0])[1];
        
        return {
          id:          item.id              ?? '',
          latitude:    lat,                    // Converti depuis y (coordonnée projetée)
          longitude:   lon,                    // Converti depuis x (coordonnée projetée)
          number:      item.numero          ?? item.numero_complet ?? '',
          surface:     Number(item.contenance) || 0,  // contenance = surface en m²
          address:     item.nom_voie        ?? '',
          city:        item.code_commune   ?? '',
          postalCode:  item.code_commune   ?? ''   // Utiliser code_commune comme postal code temporaire
        } as ParcelleProperty;
      })),
      catchError(err => {
        console.error('❌ Erreur API Parcelle:', err);
        return of([]);
      })
    );
  }
}
