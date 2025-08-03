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
   * Convertit des coordonnees lat/lon (WGS84) en coordonnees Lambert 93 approximatives
   * Cette conversion est adaptee pour la base de donnees parcelles francaises
   * @param latLon [latitude, longitude] en degres
   * @returns [y_projected, x_projected] coordonnees Lambert 93 en metres
   */
  private convertLatLonToProjected(latLon: [number, number]): [number, number] {
    const [lat, lon] = latLon;
    
    // Clamp des coordonnees pour la France metropolitaine
    const clampedLat = Math.max(41, Math.min(52, lat));
    const clampedLon = Math.max(-5, Math.min(10, lon));
    
    // Formule calibree pour la conversion WGS84 vers Lambert93 realiste
    // Basee sur les vraies donnees de la base parcelles et les specifications Lambert93
    
    // Parametres officiels Lambert93 (RGF93)
    const lon0 = 3.0; // Meridien central Lambert93
    const lat0 = 46.5; // Latitude de reference
    
    // Facteurs d'echelle et offsets calibres pour la France
    // Lambert93: X0=700000, Y0=6600000 (specifications officielles)
    const X0 = 700000; // False Easting (offset X)
    const Y0 = 6600000; // False Northing (offset Y)
    
    // Facteurs d'echelle ajustes pour correspondre aux donnees reelles
    // 1 degre ≈ 111320m, mais ajuste pour la projection conique
    const scaleX = 111320 * Math.cos(lat * Math.PI / 180); // Ajuste selon la latitude
    const scaleY = 111320; // metres par degre de latitude
    
    // Calcul des coordonnees Lambert93 approximatives
    const x_projected = X0 + (clampedLon - lon0) * scaleX;
    const y_projected = Y0 + (clampedLat - lat0) * scaleY;
    
    console.log(`Conversion detaillee: [${lat}, ${lon}] vers Lambert93 approx: [${y_projected}, ${x_projected}]`);
    
    return [y_projected, x_projected];
  }

  /**
   * Convertit des coordonnees Lambert 93 approximatives vers lat/lon (WGS84)
   * Fonction inverse de convertLatLonToProjected
   * @param projected [y_projected, x_projected] coordonnees Lambert 93 en metres
   * @returns [latitude, longitude] en degres
   */
  private convertProjectedToLatLon(projected: [number, number]): [number, number] {
    const [y_projected, x_projected] = projected;
    
    // Constantes de la projection inverse (coherentes avec convertLatLonToProjected)
    const lon0 = 3.0; // Meridien central Lambert93
    const lat0 = 46.5; // Latitude de reference
    const X0 = 700000; // False Easting
    const Y0 = 6600000; // False Northing
    
    // Estimation de la latitude pour le calcul du facteur d'echelle
    const lat_approx = lat0 + (y_projected - Y0) / 111320;
    const scaleX = 111320 * Math.cos(lat_approx * Math.PI / 180);
    const scaleY = 111320;
    
    // Calcul inverse
    const lon = lon0 + (x_projected - X0) / scaleX;
    const lat = lat0 + (y_projected - Y0) / scaleY;
    
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
        const lat = this.convertProjectedToLatLon([item.y || 0, item.x || 0])[0];
        const lon = this.convertProjectedToLatLon([item.y || 0, item.x || 0])[1];
        
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
