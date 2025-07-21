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
   * @param dateRange Plage de dates [début, fin] ou null si désactivé
   * @param exactDate Date exacte ou null si désactivé
   * @param surfaceRange Plage de surface [min, max] ou null si désactivé
   * @param exactSurface Surface exacte ou null si désactivé
   * @param energyClassRange Plage de classes énergétiques [min, max] ou null si désactivé
   * @param exactEnergyClass Classe énergétique exacte ou null si désactivé
   * @param selectedEnergyClasses Liste des classes énergétiques sélectionnées ou null si désactivé
   */
  getDvfProperties(
    topLeft: [number, number],
    bottomRight: [number, number],
    priceRange: [number, number] | null,
    dateRange: [string, string] | null,
    exactDate: string | null = null,
    surfaceRange: [number, number] | null = null,
    exactSurface: number | null = null,
    energyClassRange: [string, string] | null = null,
    exactEnergyClass: string | null = null,
    selectedEnergyClasses: string[] | null = null,
    limit: number = 500 // Add pagination limit with default of 500 results
  ): Observable<DvfProperty[]> {
    const params: any = {
      lat_min: bottomRight[0],
      lat_max: topLeft[0],
      lon_min: topLeft[1],
      lon_max: bottomRight[1],
      limit: limit // Add pagination limit parameter
    };

    if (priceRange) {
      params.prix_min = priceRange[0];
      params.prix_max = priceRange[1];
    }

    if (exactDate) {
      // Si une date exacte est fournie, l'utiliser pour le filtrage
      params.date_exacte = exactDate;
    } else if (dateRange) {
      // Sinon, utiliser l'intervalle de dates
      params.date_min = dateRange[0];
      params.date_max = dateRange[1];
    }
    
    // Gestion du filtre de surface
    if (exactSurface) {
      params.surface_exacte = exactSurface;
    } else if (surfaceRange) {
      params.surface_min = surfaceRange[0];
      params.surface_max = surfaceRange[1];
    }
    
    // Gestion du filtre de classe énergétique
    if (exactEnergyClass) {
      params.energy_classe_exacte = exactEnergyClass;
    } else if (energyClassRange) {
      params.energy_classe_min = energyClassRange[0];
      params.energy_classe_max = energyClassRange[1];
    } else if (selectedEnergyClasses && selectedEnergyClasses.length > 0) {
      params.energy_classes = selectedEnergyClasses;
    }

    const apiUrl = `${environment.apiUrl}/dvf/filtrer`;
    console.log('📡 API URL:', `${apiUrl}?${new URLSearchParams(params).toString()}`);

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
          console.log('Raw response:', response);
          return [];
        }
        
        // Handle both array responses and object responses with a message
        if (!data) return [];
        if (!Array.isArray(data)) {
          // If it's an object with a message property, log it and return empty array
          if (data.message) {
            console.log('API message:', data.message);
          } else {
            console.warn('API response is not an array:', data);
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
            type_local: 'Maison',
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
