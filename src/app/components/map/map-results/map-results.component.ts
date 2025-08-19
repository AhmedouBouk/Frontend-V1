import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from "@angular/core"
import { CommonModule } from "@angular/common"
import type { DvfProperty } from "../../../models/dvf-property.model"
import type { DpeProperty } from "../../../models/dpe.model"
import type { ParcelleProperty } from "../../../models/parcelle.model"

@Component({
  selector: "app-map-results",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./map-results.component.html",
  styleUrls: ["./map-results.component.scss"],
})
export class MapResultsComponent {
  @Input() currentDataSource = ""
  @Input() visibleDvfProperties: DvfProperty[] = []
  @Input() visibleDpeProperties: DpeProperty[] = []
  @Input() visibleParcelleProperties: ParcelleProperty[] = []
  @Input() selectedPropertyIndex: number | null = null
  @Input() tableCollapsed = true
  @Input() isLoading = false

  @Output() propertySelected = new EventEmitter<{ index: number; property: any }>()
  @Output() tableToggled = new EventEmitter<boolean>()
  @Output() mapSizeInvalidated = new EventEmitter<void>()

  public exportDropdownOpen = false
  public selectedDataSource = ""

  private readonly cdr = inject(ChangeDetectorRef)

  toggleTable(): void {
    this.tableCollapsed = !this.tableCollapsed
    this.tableToggled.emit(this.tableCollapsed)

    // Force map resize after animation completes
    setTimeout(() => {
      this.mapSizeInvalidated.emit()
    }, 300)
  }

  selectProperty(index: number, property: any): void {
    this.selectedPropertyIndex = index
    this.propertySelected.emit({ index, property })

    if (this.tableCollapsed) {
      this.tableCollapsed = false
    }

    setTimeout(() => {
      const selectedRow = document.querySelector(".property-table tr.selected")
      if (selectedRow) {
        selectedRow.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  // Export functionality
  toggleExportDropdown(event: Event): void {
    event.stopPropagation()
    this.exportDropdownOpen = !this.exportDropdownOpen
  }

  exportData(format: "csv" | "json" | "pdf"): void {
    this.exportDropdownOpen = false
    let currentResults: any[] = []

    if (this.currentDataSource === "dvf") {
      currentResults = this.visibleDvfProperties
    } else if (this.currentDataSource === "dpe") {
      currentResults = this.visibleDpeProperties
    } else if (this.currentDataSource === "parcelles") {
      currentResults = this.visibleParcelleProperties
    }

    if (currentResults.length === 0) {
      alert("Aucune donnée à exporter. Veuillez effectuer une recherche d'abord.")
      return
    }

    setTimeout(() => {
      try {
        switch (format) {
          case "csv":
            this.exportToCSV(currentResults)
            break
          case "json":
            this.exportToJSON(currentResults)
            break
          case "pdf":
            this.exportToPDF(currentResults)
            break
        }
      } catch (error) {
        console.error("Export error:", error)
        alert("Erreur lors de l'exportation des données.")
      }
    }, 500)
  }

  private getTableHeaders(dataSource: string): string[] {
    if (dataSource === "dvf") {
      return ["Type", "ID", "Adresse", "Prix", "Date", "Commune"]
    } else if (dataSource === "dpe") {
      return ["Type", "ID", "Adresse", "Classe énergie", "Classe GES", "Commune"]
    } else if (dataSource === "parcelles") {
      return ["Type", "ID", "Adresse", "Numéro", "Surface", "Commune"]
    }
    return []
  }

  private getValueForHeader(item: any, header: string, dataSource: string): string {
    switch (header) {
      case "Type":
        return dataSource === "dvf" ? "DVF" : dataSource === "dpe" ? "DPE" : "Parcelle"
      case "ID":
        return item.id_mutation || item.id || "-"
      case "Adresse":
        return item.adresse_nom_voie || item.address || "-"
      case "Prix":
        return item.valeur_fonciere ? `${item.valeur_fonciere.toLocaleString()} €` : "-"
      case "Date":
        return item.date_mutation || "-"
      case "Numéro":
        return item.number || "-"
      case "Surface":
        return item.surface ? `${item.surface} m²` : "-"
      case "Classe énergie":
        return item.energyClass || "-"
      case "Classe GES":
        return item.gesClass || "-"
      case "Commune":
        return item.nom_commune || item.city || "-"
      default:
        return "-"
    }
  }

  private exportToCSV(data: any[]): void {
    const headers = this.getTableHeaders(this.currentDataSource)
    const csvContent = [
      headers.join(","),
      ...data.map((item) => {
        return headers
          .map((header) => {
            const value = this.getValueForHeader(item, header, this.currentDataSource)
            return `"${String(value).replace(/"/g, '""')}"`
          })
          .join(",")
      }),
    ].join("\n")

    this.downloadFile(csvContent, "map-explorer-results.csv", "text/csv")
  }

  private exportToJSON(data: any[]): void {
    const jsonContent = JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        totalResults: data.length,
        data: data,
      },
      null,
      2,
    )

    this.downloadFile(jsonContent, "map-explorer-results.json", "application/json")
  }

  private exportToPDF(data: any[]): void {
    alert(
      "PDF export functionality requires the 'jspdf' library. Please install it and implement the PDF generation logic.",
    )
    console.warn("PDF export not fully implemented without jsPDF library.")
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Nouvelles méthodes pour la gestion multi-sources
  getTotalResults(): number {
    return this.visibleDvfProperties.length + this.visibleDpeProperties.length + this.visibleParcelleProperties.length
  }

  hasMultipleSources(): boolean {
    const activeSources = [
      this.visibleDvfProperties.length > 0,
      this.visibleDpeProperties.length > 0,
      this.visibleParcelleProperties.length > 0,
    ].filter(Boolean)
    return activeSources.length > 1
  }

  selectDataSource(source: string): void {
    this.selectedDataSource = source
  }

  getSelectedDataSource(): string {
    // Si aucune source sélectionnée, choisir la première source disponible
    if (!this.selectedDataSource) {
      if (this.visibleDvfProperties.length > 0) {
        this.selectedDataSource = "dvf"
      } else if (this.visibleDpeProperties.length > 0) {
        this.selectedDataSource = "dpe"
      } else if (this.visibleParcelleProperties.length > 0) {
        this.selectedDataSource = "parcelles"
      } else {
        this.selectedDataSource = this.currentDataSource || "dvf"
      }
    }

    // Vérifier que la source sélectionnée a des données
    const hasData = {
      dvf: this.visibleDvfProperties.length > 0,
      dpe: this.visibleDpeProperties.length > 0,
      parcelles: this.visibleParcelleProperties.length > 0,
    }

    if (!hasData[this.selectedDataSource as keyof typeof hasData]) {
      // Basculer vers la première source disponible
      for (const [source, hasDataForSource] of Object.entries(hasData)) {
        if (hasDataForSource) {
          this.selectedDataSource = source
          break
        }
      }
    }

    return this.selectedDataSource
  }
}
