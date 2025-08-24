import { Injectable } from '@angular/core';
import Shepherd from 'shepherd.js';

@Injectable({
  providedIn: 'root'
})
export class TutorialService {
  private tour?: any;
  
  constructor() {}

  // Méthode principale pour démarrer le tutoriel complet
  startCompleteTutorial(): void {
    if (this.tour) {
      this.tour.complete();
    }

    this.tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shepherd-theme-arrows',
        scrollTo: true,
        highlightClass: 'tour-highlight',
        cancelIcon: {
          enabled: true,
        },
        // Garde: si la cible n'existe pas ou est invisible, sauter automatiquement l'étape
        when: {
          show: function (this: any) {
            try {
              const step = this; // Shepherd Step instance
              const tour = step?.tour || step?.getTour?.();
              const attach = step?.options?.attachTo;
              const selector: string | undefined = attach?.element;
              const on = attach?.on;
              if (selector && selector !== 'body') {
                const el = document.querySelector(selector) as HTMLElement | null;
                const visible = !!el && (() => {
                  const style = window.getComputedStyle(el!);
                  const rect = el!.getBoundingClientRect();
                  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
                })();
                if (!visible) {
                  console.debug('[Shepherd] Skip step (target missing/hidden):', step?.id || step?.options?.id, 'selector:', selector, 'on:', on);
                  // Skip asynchronously to avoid interfering with internal show logic
                  setTimeout(() => tour?.next?.(), 0);
                  return;
                }
              }
              console.debug('[Shepherd] Showing step:', step?.id || step?.options?.id);
            } catch (e) {
              // En cas d'erreur, continuer normalement
              console.warn('[Shepherd] when.show handler error:', e);
            }
          }
        }
      },
    });

    // Responsive handling
    const isMobile = window.innerWidth <= 768;

    // Journaux simples du cycle de vie du tour
    try {
      this.tour.on?.('start', () => console.debug('[Shepherd] Tour started'));
      this.tour.on?.('complete', () => console.debug('[Shepherd] Tour completed'));
      this.tour.on?.('cancel', () => console.debug('[Shepherd] Tour cancelled'));
      this.tour.on?.('inactive', () => console.debug('[Shepherd] Tour inactive'));
    } catch {}

    // Étape 1: Introduction générale
    this.tour.addStep({
      id: 'step-intro',
      title: '🏠 Bienvenue dans votre assistant immobilier',
      classes: 'centered-step',
      text: `
        <div style="text-align: left;">
          <p>Cette visite guidée complète vous expliquera comment utiliser tous les outils de recherche et de visualisation disponibles.</p>
          <p><strong>🎯 Vous apprendrez à :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Configurer vos filtres de recherche</li>
            <li>Comprendre les marqueurs sur la carte</li>
            <li>Naviguer dans les résultats</li>
            <li>Utiliser les contrôles de la carte</li>
            <li>Gérer l'affichage des données</li>
          </ul>
          <p><strong>⏱️ Durée estimée :</strong> 3-5 minutes</p>
        </div>
      `,
      attachTo: {
        element: 'body',
        on: 'center'
      },
      buttons: [
        {
          text: 'Commencer la visite complète',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        },
        {
          text: 'Annuler',
          action: () => this.tour.complete(),
          classes: 'btn btn-secondary'
        }
      ]
    });

    // Étape 2: Logo et menu
    this.tour.addStep({
      id: 'step-menu',
      title: '📱 Menu principal',
      text: `
        <div style="text-align: left;">
          <p>Cliquez sur le logo <img src="assets/icons/logo.png" alt="logo" style="width: 20px; height: 20px; vertical-align: middle;"> pour ouvrir/fermer le panneau de filtres à gauche.</p>
          <p><strong>💡 Astuce :</strong> C'est votre point de départ pour toute recherche !</p>
        </div>
      `,
      attachTo: {
        element: '.fixed-logo',
        on: isMobile ? 'bottom' : 'right'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 3: Panneau de filtres - Vue d'ensemble
    this.tour.addStep({
      id: 'step-filters-overview',
      title: '🎛️ Panneau de filtres - Vue d\'ensemble',
      text: `
        <div style="text-align: left;">
          <p><strong>Ce panneau contient tous vos outils de recherche :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>🏠 Type de logement</strong> : Appartement, maison, etc.</li>
            <li><strong>💰 Prix de vente</strong> : Fourchette des transactions</li>
            <li><strong>📏 Surface</strong> : Superficie des biens</li>
            <li><strong>⚡ Performance énergétique</strong> : Classes DPE</li>
            <li><strong>📅 Période</strong> : Dates des transactions</li>
          </ul>
          <p><strong>🔄 Principe :</strong> Chaque filtre a un toggle ON/OFF pour l'activer</p>
        </div>
      `,
      attachTo: {
        element: '.sidebar',
        on: isMobile ? 'bottom' : 'right'
      },
      when: {
        show: () => {
          // S'assurer que la sidebar est ouverte
          const sidebar = document.querySelector('.sidebar');
          if (sidebar && !sidebar.classList.contains('open')) {
            const logoBtn = document.querySelector('.fixed-logo') as HTMLElement;
            logoBtn?.click();
          }
        }
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Découvrir les filtres',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 4: Type de logement
    this.tour.addStep({
      id: 'step-type-logement',
      title: '🏘️ Type de Logement - Filtre de base',
      text: `
        <div style="text-align: left;">
          <p><strong>Premier filtre essentiel :</strong> Choisissez le type de logement avec l'icône <img src="assets/icons/type_locale.png" alt="Type de logement" style="width: 16px; height: 16px; vertical-align: middle;">.</p>
          <p>📋 <strong>Fonctionnement :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Ce filtre est <strong>inclus</strong> dans les recherches des autres filtres</li>
            <li>Vous pouvez sélectionner plusieurs types simultanément</li>
            <li>Activez le toggle <span style="color: #3b82f6;">🔘</span> pour l'utiliser</li>
          </ul>
          <p>💡 <strong>Astuce :</strong> Commencez toujours par définir le type de logement avant les autres critères.</p>
        </div>
      `,
      attachTo: {
        element: '#section-type .section-header',
        on: isMobile ? 'bottom' : 'right'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 5: Ventes (Prix)
    this.tour.addStep({
      id: 'step-ventes',
      title: '💰 Ventes passées - Filtre Prix',
      text: `
        <div style="text-align: left;">
          <p><strong>Filtrez par prix de vente</strong> avec l'icône <img src="assets/icons/house-plus.png" alt="Ventes" style="width: 16px; height: 16px; vertical-align: middle;"> :</p>
          <p>🎯 <strong>Ce filtre affiche des marqueurs verts sur la carte</strong></p>
          <p>⚙️ <strong>Options disponibles :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>🔍 Exact :</strong> Recherche un prix précis</li>
            <li><strong>📊 Intervalle :</strong> Définit une fourchette min/max</li>
          </ul>
          <p>🔄 <strong>Toggle activé sans paramètres :</strong> Équivaut à un "SELECT *" (toutes les ventes)</p>
          <p>❌ <strong>Toggle désactivé :</strong> Aucun marqueur de vente n'apparaîtra sur la carte</p>
          <p>💡 <strong>Cliquez sur le chevron</strong> <img src="assets/icons/down.png" alt="Chevron" style="width: 12px; height: 12px; vertical-align: middle;"> <strong>pour voir les options Exact/Intervalle</strong></p>
        </div>
      `,
      attachTo: {
        element: '#section-ventes .section-header',
        on: isMobile ? 'bottom' : 'right'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 6: Surface
    this.tour.addStep({
      id: 'step-surface',
      title: '📏 Taille du terrain - Filtre Surface',
      text: `
        <div style="text-align: left;">
          <p><strong>Filtrez par surface</strong> avec l'icône <img src="assets/icons/m2-icon.png" alt="Surface" style="width: 16px; height: 16px; vertical-align: middle;"> :</p>
          <p>🎯 <strong>Ce filtre affiche ses propres marqueurs sur la carte</strong></p>
          <p>⚙️ <strong>Même principe que les ventes :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Toggle activé :</strong> Toutes les surfaces si pas de valeur</li>
            <li><strong>Toggle désactivé :</strong> Aucun marqueur de surface</li>
            <li><strong>Options :</strong> Valeur exacte ou intervalle</li>
          </ul>
        </div>
      `,
      attachTo: {
        element: '#section-surface .section-header',
        on: isMobile ? 'bottom' : 'right'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 7: Classe Énergétique
    this.tour.addStep({
      id: 'step-dpe',
      title: '⚡ Classe énergétique - Filtre DPE',
      text: `
        <div style="text-align: left;">
          <p><strong>Filtrez par performance énergétique</strong> avec l'icône <img src="assets/icons/energy-class-icon.png" alt="DPE" style="width: 16px; height: 16px; vertical-align: middle;"> :</p>
          <p>🎯 <strong>Ce filtre affiche ses propres marqueurs sur la carte</strong></p>
          <p>🎯 <strong>Classes disponibles :</strong></p>
          <div style="display: flex; gap: 5px; margin: 10px 0; flex-wrap: wrap;">
            <span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">A</span>
            <span style="background: #84cc16; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">B</span>
            <span style="background: #eab308; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">C</span>
            <span style="background: #f97316; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">D</span>
            <span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">E</span>
            <span style="background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">F</span>
            <span style="background: #991b1b; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">G</span>
          </div>
        </div>
      `,
      attachTo: {
        element: '#section-dpe .section-header',
        on: isMobile ? 'bottom' : 'right'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 7.5: Consommation (kWh/m²/an)
    this.tour.addStep({
      id: 'step-consommation',
      title: '⚡ Consommation - Filtre énergie',
      text: `
        <div style="text-align: left;">
          <p><strong>Filtrez par consommation énergétique</strong> avec l'icône <img src="assets/icons/kwh-icon.png" alt="Consommation" style="width: 16px; height: 16px; vertical-align: middle;"> :</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Exact</strong> ou <strong>Intervalle</strong> (kWh/m²/an)</li>
            <li><strong>Toggle activé</strong> sans valeurs = toutes les consommations</li>
            <li><strong>Toggle désactivé</strong> = aucun marqueur de consommation</li>
          </ul>
        </div>
      `,
      attachTo: {
        element: '#section-consumption .section-header',
        on: isMobile ? 'bottom' : 'right'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 8: Période
    this.tour.addStep({
      id: 'step-periode',
      title: '📅 Période - Paramètre de requête',
      text: `
        <div style="text-align: left;">
          <p><strong>Définissez une période temporelle</strong> avec l'icône <img src="assets/icons/calendar-icon.png" alt="Période" style="width: 16px; height: 16px; vertical-align: middle;"> :</p>
          <p><strong>⚠️ Important :</strong> La période n'est <strong>PAS un filtre visuel</strong>.</p>
          <p>🔍 <strong>Rôle de la période :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Inclut une période dans la <strong>requête</strong> des autres filtres</li>
            <li>Limite les données récupérées dans le temps</li>
            <li><strong>Aucun marqueur</strong> ne s'affiche sur la carte pour ce paramètre</li>
            <li>Influence les résultats de TOUS les autres filtres actifs</li>
          </ul>
          <p>💡 <strong>Utilisation :</strong> Définissez d'abord votre période, puis configurez vos autres filtres.</p>
        </div>
      `,
      attachTo: {
        element: '#section-periode .section-header',
        on: isMobile ? 'bottom' : 'right'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant - Contrôles carte',
          action: () => {
            // Close sidebar before moving to map controls
            try {
              const sidebar = document.querySelector('.sidebar');
              if (sidebar && sidebar.classList.contains('open')) {
                // Prefer clicking the overlay which sits above and closes the sidebar
                const overlay = document.querySelector('.sidebar-overlay') as HTMLElement | null;
                if (overlay) {
                  overlay.click();
                } else {
                  // Fallback: click the in-sidebar close button
                  const closeBtn = document.querySelector('.site-logo-btn') as HTMLElement | null;
                  closeBtn?.click();
                }
              }
            } catch {}
            // Wait a short time for the close animation/state to settle before advancing
            setTimeout(() => this.tour.next(), 300);
          },
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 9: Contrôles de la carte
    this.tour.addStep({
      id: 'step-map-controls',
      title: '🗺️ Contrôles de la carte',
      text: `
        <div style="text-align: left;">
          <p><strong>Personnalisez votre vue :</strong></p>
          <p>🎛️ <strong>Types de vue disponibles :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>🛣️ Rue :</strong> Vue classique OpenStreetMap</li>
            <li><strong>🛰️ Satellite :</strong> Images aériennes</li>
            <li><strong>📋 Cadastre :</strong> Parcelles et limites officielles</li>
          </ul>
          <p>❓ <strong>Bouton d'aide :</strong> Accès rapide à cette visite guidée</p>
        </div>
      `,
      attachTo: {
        element: '.map-controls',
        on: isMobile ? 'bottom' : 'left'
      },
      when: {
        show: () => {
          // Ensure sidebar is closed when entering map controls step
          try {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
              // Prefer clicking the overlay which sits above and closes the sidebar
              const overlay = document.querySelector('.sidebar-overlay') as HTMLElement | null;
              if (overlay) {
                overlay.click();
              } else {
                // Fallback: click the in-sidebar close button
                const closeBtn = document.querySelector('.site-logo-btn') as HTMLElement | null;
                closeBtn?.click();
              }
              // Give the DOM a moment to update the state
              setTimeout(() => {}, 200);
            }
          } catch {}
        }
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 10: Recherche et géolocalisation
    this.tour.addStep({
      id: 'step-search-geo',
      title: '🔍 Recherche et géolocalisation',
      text: `
        <div style="text-align: left;">
          <p><strong>Naviguez rapidement :</strong></p>
          <p>🎯 <strong>Outils disponibles :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>🔍 Barre de recherche :</strong> Tapez une adresse, ville ou code postal</li>
            <li><strong>📍 Géolocalisation :</strong> Centre automatiquement sur votre position</li>
          </ul>
          <p>💡 <strong>Astuce :</strong> Utilisez la recherche pour vous positionner avant d'appliquer vos filtres.</p>
          <p><strong>🔄 Démonstration :</strong> Cliquez sur "Tester la recherche" pour voir comment ça fonctionne.</p>
        </div>
      `,
      attachTo: {
        element: '.search-controls',
        on: isMobile ? 'bottom' : 'top'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Tester la recherche',
          action: () => {
            const searchBtn = document.querySelector('.search-toggle-btn') as HTMLElement;
            searchBtn?.click();
            this.tour?.next();
          },
          classes: 'btn btn-success'
        },
        {
          text: 'Passer',
          action: () => {
            // Skips the input test step and goes directly to the chevron/results step
            this.tour?.show('step-chevron-results');
          },
          classes: 'btn btn-outline-secondary'
        }
      ]
    });

    // Étape 11: Test de recherche (conditionnelle)
    this.tour.addStep({
      id: 'step-search-test',
      title: '✍️ Tapez votre recherche',
      text: `
        <div style="text-align: left;">
          <p><strong>Essayez maintenant :</strong></p>
          <p>Commencez à taper le nom d'une ville française. Les suggestions apparaîtront automatiquement.</p>
          <p><strong>💡 Exemples :</strong> "Paris", "Lyon", "Marseille", "Toulouse"...</p>
          <p>Sélectionnez une suggestion pour y naviguer instantanément !</p>
        </div>
      `,
      attachTo: {
        element: '.search-input',
        on: isMobile ? 'bottom' : 'top'
      },
      when: {
        show: () => {
          // Attendre que l'animation d'ouverture se termine
          setTimeout(() => {
            const input = document.querySelector('.search-input') as HTMLInputElement;
            if (input) {
              input.focus();
              input.placeholder = 'Essayez "Paris" par exemple...';
            }
          }, 350);
        }
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Compris !',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 12: Chevron des résultats
    this.tour.addStep({
      id: 'step-chevron-results',
      title: '📊 Chevron - Affichage des résultats',
      text: `
        <div style="text-align: left;">
          <p><strong>Contrôlez l'affichage du tableau avec le petit chevron :</strong></p>
          <p>📽 <strong>Chevron vers le bas :</strong> Cliquez pour <strong>ouvrir</strong> la liste des résultats</p>
          <p>📼 <strong>Chevron vers le haut :</strong> Cliquez pour <strong>fermer</strong> la liste des résultats</p>
          <p>💡 <strong>Utilité :</strong> Masquez les résultats pour avoir plus d'espace sur la carte, ou affichez-les pour voir les détails.</p>
          <p>📍 <strong>Localisation :</strong> Le chevron se trouve dans le coin droit du header des résultats</p>
        </div>
      `,
      attachTo: {
        element: '.toggle-icon',
        on: isMobile ? 'bottom' : 'top'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 13: Tableau des résultats - Sources
    this.tour.addStep({
      id: 'step-sources',
      title: '📊 Sources de données',
      text: `
        <div style="text-align: left;">
          <p><strong>Basculez entre les différentes sources :</strong></p>
          <p>📊 <strong>Sources disponibles :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>🏠 DVF :</strong> Demandes de Valeurs Foncières (ventes immobilières)</li>
            <li><strong>⚡ DPE :</strong> Diagnostics de Performance Énergétique</li>
            <li><strong>📍 Parcelles :</strong> Données cadastrales et informations de propriété</li>
          </ul>
          <p><strong>🔢 Compteurs :</strong> Le nombre entre parenthèses indique combien de résultats sont disponibles pour chaque source.</p>
        </div>
      `,
      attachTo: {
        element: '.header-center',
        on: isMobile ? 'bottom' : 'top'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 14: Tableau des résultats - Navigation
    this.tour.addStep({
      id: 'step-results-navigation',
      title: '📋 Navigation dans les résultats',
      text: `
        <div style="text-align: left;">
          <p><strong>Explorez vos résultats efficacement :</strong></p>
          <p>🖱️ <strong>Interactions disponibles :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Cliquez sur une ligne</strong> pour centrer la carte sur la propriété correspondante</li>
            <li><strong>Scrollez dans le tableau</strong> pour voir plus de résultats</li>
            <li><strong>Basculez entre les onglets</strong> pour changer de source de données</li>
          </ul>
          <p>🎯 <strong>Astuce :</strong> Les résultats affichés correspondent exactement aux marqueurs visibles sur la carte.</p>
        </div>
      `,
      attachTo: {
        element: '.property-table',
        on: isMobile ? 'bottom' : 'top'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 15: Gestion des résultats nombreux
    this.tour.addStep({
      id: 'step-many-results',
      title: '⚠️ Gestion des résultats nombreux',
      text: `
        <div style="text-align: left;">
          <p><strong>Quand il y a plus de 500 résultats, une alerte apparaîtra en haut :</strong></p>
          <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); 
                      border: 1px solid #f59e0b; border-radius: 6px; 
                      padding: 8px; margin: 10px 0; font-size: 0.85rem;">
            ⚠️ Il y a plus de 500 emplacements répondant à votre recherche
          </div>
          <p><strong>💡 Solutions :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>🔍 Zoomez</strong> sur une zone plus restreinte de la carte</li>
            <li><strong>🎛️ Affinez vos critères</strong> de filtre pour être plus précis</li>
            <li><strong>📅 Limitez la période</strong> de recherche</li>
          </ul>
        </div>
      `,
      attachTo: {
        element: 'body',
        on: 'center'
      },
      buttons: [
        {
          text: 'Précédent',
          action: () => this.tour.back(),
          classes: 'btn btn-secondary'
        },
        {
          text: 'Suivant',
          action: () => this.tour.next(),
          classes: 'btn btn-primary'
        }
      ]
    });

    // Étape 16: Finalisation
    this.tour.addStep({
      id: 'step-finish',
      title: '🎉 Félicitations !',
      classes: 'centered-step',
      text: `
        <div style="text-align: left;">
          <p><strong>Vous maîtrisez maintenant votre assistant immobilier !</strong></p>
          <p>📝 <strong>Récapitulatif de votre apprentissage :</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>✅ Configuration des filtres de recherche</li>
            <li>✅ Compréhension des marqueurs sur la carte</li>
            <li>✅ Navigation dans les résultats</li>
            <li>✅ Utilisation des contrôles de carte</li>
            <li>✅ Gestion de l'affichage des données</li>
          </ul>
          <p><strong>💡 Conseil :</strong> N'hésitez pas à relancer ce tutoriel via le bouton d'aide sur la carte !</p>
          <p><strong>🚀 Bonne recherche immobilière !</strong></p>
        </div>
      `,
      attachTo: {
        element: 'body',
        on: 'center'
      },
      buttons: [
        {
          text: 'Refaire le tutoriel',
          action: () => {
            this.tour?.complete();
            setTimeout(() => this.startCompleteTutorial(), 500);
          },
          classes: 'btn btn-outline-primary'
        },
        {
          text: 'Commencer à utiliser l\'app',
          action: () => this.tour.complete(),
          classes: 'btn btn-success'
        }
      ]
    });

    this.tour.start();
  }

  // Helper de visibilité générique
  private isElementVisible(selector: string): boolean {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  // Méthode pour arrêter le tutoriel
  stopTutorial(): void {
    if (this.tour) {
      this.tour.complete();
      this.tour = undefined;
    }
  }

  // Méthodes existantes conservées pour la compatibilité
  startFullApplicationTutorial(): void {
    this.startCompleteTutorial();
  }

  startFormTutorial(): void {
    this.startCompleteTutorial();
  }

  startResultsTutorial(): void {
    this.startCompleteTutorial();
  }

  startMapControlsTutorial(): void {
    this.startCompleteTutorial();
  }

  startQuickTour(): void {
    this.startCompleteTutorial();
  }
}