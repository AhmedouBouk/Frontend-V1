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
   * Convertit des coordonnees lat/lon (WGS84) en coordonnees Lambert 93 approximatives
   * Utilise la meme formule que ParcelleService pour la coherence
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
    
    console.log(`DPE Conversion detaillee: [${lat}, ${lon}] vers Lambert93 approx: [${y_projected}, ${x_projected}]`);
    
    return [y_projected, x_projected];
  }

  /**
   * Convertit des coordonnees Lambert 93 approximatives vers lat/lon (WGS84)
   * Fonction inverse de convertLatLonToProjected
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
    
    console.log('DPE Coordinate conversion:');
    console.log(`  Original topLeft: ${topLeft} -> Projected: ${topConverted}`);
    console.log(`  Original bottomRight: ${bottomRight} -> Projected: ${bottomConverted}`);
    
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
    
    console.log('Parametres envoyes au backend DPE:', {
      topLeft: topLeftParam,
      bottomRight: bottomRightParam,
      filterMode: filterMode,
      energyFilter: energyFilter,
      coordonnees_projetees: { lat_min, lat_max, lon_min, lon_max }
    });

    const apiUrl = `${environment.apiUrl}/dpe`;
    console.log('API DPE URL:', `${apiUrl}?${new URLSearchParams(params).toString()}`);

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
