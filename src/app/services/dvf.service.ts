import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DvfProperty } from '../models/dvf-property.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DvfService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Récupère les données DVF depuis le backend
   * @param topLeft Coordonnées du coin haut-gauche [lat, lng]
   * @param bottomRight Coordonnées du coin bas-droit [lat, lng]
   * @param priceRange Plage de prix [min, max] ou null si désactivé
   * @param exactPrice Prix exact ou null si désactivé
   * @param dateRange Plage de dates [début, fin] ou null si désactivé
   * @param typeLocaleFilter Liste des types de locaux sélectionnés ou null si désactivé
   * @param exactDate Date exacte ou null si désactivé
   */
  getDvfProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    priceRange: [number, number] | null,
    exactPrice: number | null = null,
    dateRange: [string, string] | null = null,
    typeLocaleFilter: string[] | null = null,
    exactDate: string | null = null
  ): Observable<DvfProperty[]> {
    const params: any = {
      lat_min: bottomRight[0],
      lat_max: topLeft[0],
      lon_min: topLeft[1],
      lon_max: bottomRight[1],
      limit: 500 // Add pagination limit with default of 500 results
    };

    // 💰 Price filter handling - exact price takes priority
    if (exactPrice !== null && exactPrice !== undefined) {
      params.prix_exact = exactPrice;
          } else if (priceRange) {
      params.prix_min = priceRange[0];
      params.prix_max = priceRange[1];
          } else {
          } 

    // 📅 Date filter handling - exact date takes priority
    if (exactDate !== null && exactDate !== undefined) {
      params.date_exacte = exactDate;
          } else if (dateRange) {
      params.date_min = dateRange[0];
      params.date_max = dateRange[1];
          } else {
          }
    
    // 🏠 Type locale filter handling
    if (typeLocaleFilter && typeLocaleFilter.length > 0) {
      params.type_local = typeLocaleFilter.join(',');
      
    } else {
      
    }

    const apiUrl = `${environment.apiUrl}/dvf/filtrer`;
    

    // Use responseType 'text' to avoid automatic JSON parsing which might fail
    return this.http.get(apiUrl, { 
      params, 
      responseType: 'text' 
    }).pipe(
      map(response => {
        // Try to parse the response manually
        let data;
        try {
          data = response ? JSON.parse(response) : [];
        } catch (e) {
          console.error('Failed to parse response:', e);
          
          return [];
        }
        
        // Handle both array responses and object responses with a message
        if (!data) return [];
        if (!Array.isArray(data)) {
          // If it's an object with a message property, log it and return empty array
          if (data.message) {
            
          } else {
            
          }
          return [];
        }

        return data.map(item => {
          const latitude = parseFloat(item.latitude);
          const longitude = parseFloat(item.longitude);
          const valeur = parseFloat(item.valeur_fonciere);

          return {
            id_mutation: item.id_mutation ?? '',
            date_mutation: item.date_mutation ?? '',
            valeur_fonciere: isNaN(valeur) ? 0 : valeur,
            type_local: item.type_local ?? 'Non spécifié',
            latitude: isNaN(latitude) ? 0 : latitude,
            longitude: isNaN(longitude) ? 0 : longitude,
            adresse_numero: item.adresse_numero ?? '',
            adresse_nom_voie: item.adresse_nom_voie ?? '',
            code_postal: item.code_postal ?? '',
            nom_commune: item.nom_commune ?? '',
            id_parcelle: item.id_parcelle ?? '',

            surface_terrain: item.surface_terrain ?? undefined,
            surface: item.surface_reelle_bati ?? undefined
          } as DvfProperty;
        });
      }),
      catchError(error => {
        console.error('❌ Erreur API DVF:', error);
        return of([]);
      })
    );
  }
}
