import { Component, inject, OnDestroy, type OnInit } from "@angular/core"
import { FormBuilder, type FormGroup, ReactiveFormsModule } from "@angular/forms"
import { CommonModule } from "@angular/common"
import { FormService } from "../../services/form.service"
import { MapService } from "../../services/map.service"
import { Subject, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';


type FilterMode = "exact" | "range"

@Component({
  selector: "app-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./form.component.html",
  styleUrls: ["./form.component.scss"],
})
export class FormComponent implements OnInit , OnDestroy {
  filterForm: FormGroup
  private readonly fb = inject(FormBuilder)
  private readonly formService = inject(FormService)
  private readonly mapService = inject(MapService)

  // Filter toggle states
  allPriceSelected = false
  allDateSelected = false
  allSurfaceSelected = false
  allEnergySelected = false
  allConsumptionSelected = false
  allTypeLocaleSelected = false

  // Section visibility states for chevrons (all start as false = closed)
  priceExpanded = false
  dateExpanded = false
  surfaceExpanded = false
  energyExpanded = false
  consumptionExpanded = false
  typeLocaleExpanded = false

  // Marker visibility state
  markersVisible = false

  // Loading states for each filter
  priceLoading = false
  dateLoading = false
  surfaceLoading = false
  energyLoading = false
  consumptionLoading = false
  typeLocaleLoading = false

  // Type de locale options
  typeLocaleOptions = [
    { value: 'Appartement', label: 'Appartement', icon: '🏠' },
    { value: 'Maison', label: 'Maison', icon: '🏡' },
    { value: 'Dépendance', label: 'Dépendance', icon: '🏘️' },
    { value: 'Local industriel, commercial ou assimilé', label: 'Local industriel, commercial ou assimilé', icon: '🏢' }
  ]
  selectedTypeLocales: string[] = []

  constructor() {
    this.filterForm = this.fb.group({
     

      // Prix (DVF)
      usePriceFilter: [false],
      priceMode: ["range"],
      price: [null],
      minPrice: [null],
      maxPrice: [null],

      // Date (DVF)
      useDateFilter: [false],
      dateMode: ["range"],
      exactDate: [null],
      startDate: [null],
      endDate: [null],

      // Surface (Parcelle)
      useSurfaceFilter: [false],
      surfaceMode: ["range"],
      surface: [null],
      minSurface: [null],
      maxSurface: [null],

      // Classe énergie (DPE) - Seulement les classes A-G
      useEnergyFilter: [false],
      energyClassA: [false],
      energyClassB: [false],
      energyClassC: [false],
      energyClassD: [false],
      energyClassE: [false],
      energyClassF: [false],
      energyClassG: [false],

      // Consommation énergétique (DPE) - Valeurs kWh/m²/an
      useConsumptionFilter: [false],
      consumptionMode: ["range"],
      exactConsumption: [null],
      minConsumption: [null],
      maxConsumption: [null],

      // Type de local
      useTypeLocaleFilter: [false],
      typeLocale: [null],

    })
  }

  ngOnInit(): void {
    // Restaurer l'état des filtres depuis localStorage
    this.formService.restoreFilterState()
    
    this.mapService.refreshMap()
    // Synchroniser les propriétés locales avec FormService
    this.setupFormServiceSubscriptions()
    
    // Configurer les listeners pour les changements de mode
    this.setupModeChangeListeners()
    
    // Restaurer l'état du formulaire depuis FormService
    this.restoreFormState()
    
    // Forçage de l'état des boutons radio après le chargement du DOM
    setTimeout(() => {
      this.forceRadioButtonsState()
    }, 500)
    setTimeout(() => {
      this.mapService.refreshMap()
    }, 1000) // this is 

    // Auto-trigger search when filters are enabled/disabled
    this.filterForm.get("usePriceFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setPriceToggle(enabled)
      
      if (!enabled) {
        this.formService.clearPriceFilter()
        // Trigger map refresh to remove markers for this filter
        
      } else {
        // Set markers visible and apply only price filter
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Apply only the price filter using current form values
        setTimeout(() => this.applyPriceFilter(this.filterForm.value), 100)
      }
    })

    this.filterForm.get("useDateFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setDateToggle(enabled)
      
      if (!enabled) {
        this.formService.clearDateFilter()
        // Trigger map refresh to remove markers for this filter
        
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Apply only the date filter
        setTimeout(() => this.applyDateFilter(this.filterForm.value), 100)
      }
    })

    this.filterForm.get("useSurfaceFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setSurfaceToggle(enabled)
      
      if (!enabled) {
        this.formService.clearSurfaceFilter()
        
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        // Apply only the surface filter
        setTimeout(() => this.applySurfaceFilter(this.filterForm.value), 100)
      }
    })

    this.filterForm.get("useEnergyFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setEnergyToggle(enabled)
      
      if (!enabled) {
        this.formService.clearEnergyClassFilter()
        
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        setTimeout(() => this.applyEnergyFilter(this.filterForm.value), 100)
      }
    })

    this.filterForm.get("useConsumptionFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setConsumptionToggle(enabled)
      
      if (!enabled) {
        this.formService.clearConsumptionFilter()
        
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        setTimeout(() => this.applyConsumptionFilter(this.filterForm.value), 100)
      }
    })

    this.filterForm.get("useTypeLocaleFilter")?.valueChanges.subscribe((enabled: boolean) => {
      // Update toggle state in FormService
      this.formService.setTypeLocaleToggle(enabled)
      
      if (!enabled) {
        this.formService.clearTypeLocaleFilter()
        
      } else {
        this.markersVisible = true
        this.formService.setMarkersVisible(true)
        setTimeout(() => this.applyTypeLocaleFilter(this.filterForm.value), 100)
      }
    })

    
    // Listen for value changes in input fields to trigger automatic search
    this.setupValueChangeListeners()
    this.setupAutoToggleActivation()
  }
  private destroy$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  
// Date picker properties
isExactDatePickerOpen = false;
isStartDatePickerOpen = false;
isEndDatePickerOpen = false;

exactDateView: 'year' | 'month' | 'day' = 'year';
startDateView: 'year' | 'month' | 'day' = 'year';
endDateView: 'year' | 'month' | 'day' = 'year';

exactDateSelectedYear: number | null = null;
exactDateSelectedMonth: number = 0;
exactDateSelectedDay: number | null = null;
exactDateFormattedDate = '';

startDateSelectedYear: number | null = null;
startDateSelectedMonth: number = 0;
startDateSelectedDay: number | null = null;
startDateFormattedDate = '';

endDateSelectedYear: number | null = null;
endDateSelectedMonth: number = 0;
endDateSelectedDay: number | null = null;
endDateFormattedDate = '';

years = [2020, 2021, 2022, 2023, 2024, 2025];
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
dows = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // French days of week

exactDateFirstDayOfMonth = 0;
exactDateDaysInMonth: number[] = [];

startDateFirstDayOfMonth = 0;
startDateDaysInMonth: number[] = [];

endDateFirstDayOfMonth = 0;
endDateDaysInMonth: number[] = [];

// Add these methods to your FormComponent class:

// Exact Date Picker Methods
openExactDatePicker() {
  this.isExactDatePickerOpen = true;
  this.exactDateView = 'year';
}

selectExactDateYear(y: number) {
  this.exactDateSelectedYear = y;
  this.exactDateView = 'month';
}

selectExactDateMonth(m: number) {
  this.exactDateSelectedMonth = m;
  this.updateExactDateDays();
  this.exactDateView = 'day';
}

selectExactDateDay(d: number) {
  this.exactDateSelectedDay = d;
  const dateValue = this.formatDateForInput(
    this.exactDateSelectedYear!,
    this.exactDateSelectedMonth!,
    this.exactDateSelectedDay!
  );
  this.exactDateFormattedDate = this.formatDateForDisplay(
    this.exactDateSelectedYear!,
    this.exactDateSelectedMonth!,
    this.exactDateSelectedDay!
  );
  
  // Update form control
  this.filterForm.patchValue({ exactDate: dateValue });
  this.isExactDatePickerOpen = false;
}

updateExactDateDays() {
  if (this.exactDateSelectedYear === null || this.exactDateSelectedMonth === null) return;
  const first = new Date(this.exactDateSelectedYear, this.exactDateSelectedMonth, 1);
  this.exactDateFirstDayOfMonth = first.getDay();
  const days = new Date(this.exactDateSelectedYear, this.exactDateSelectedMonth + 1, 0).getDate();
  this.exactDateDaysInMonth = Array.from({ length: days }, (_, i) => i + 1);
}

// Start Date Picker Methods
openStartDatePicker() {
  this.isStartDatePickerOpen = true;
  this.startDateView = 'year';
}

selectStartDateYear(y: number) {
  this.startDateSelectedYear = y;
  this.startDateView = 'month';
}

selectStartDateMonth(m: number) {
  this.startDateSelectedMonth = m;
  this.updateStartDateDays();
  this.startDateView = 'day';
}

selectStartDateDay(d: number) {
  this.startDateSelectedDay = d;
  const dateValue = this.formatDateForInput(
    this.startDateSelectedYear!,
    this.startDateSelectedMonth!,
    this.startDateSelectedDay!
  );
  this.startDateFormattedDate = this.formatDateForDisplay(
    this.startDateSelectedYear!,
    this.startDateSelectedMonth!,
    this.startDateSelectedDay!
  );
  
  // Update form control
  this.filterForm.patchValue({ startDate: dateValue });
  this.isStartDatePickerOpen = false;
}

updateStartDateDays() {
  if (this.startDateSelectedYear === null || this.startDateSelectedMonth === null) return;
  const first = new Date(this.startDateSelectedYear, this.startDateSelectedMonth, 1);
  this.startDateFirstDayOfMonth = first.getDay();
  const days = new Date(this.startDateSelectedYear, this.startDateSelectedMonth + 1, 0).getDate();
  this.startDateDaysInMonth = Array.from({ length: days }, (_, i) => i + 1);
}

// End Date Picker Methods
openEndDatePicker() {
  this.isEndDatePickerOpen = true;
  this.endDateView = 'year';
}

selectEndDateYear(y: number) {
  this.endDateSelectedYear = y;
  this.endDateView = 'month';
}

selectEndDateMonth(m: number) {
  this.endDateSelectedMonth = m;
  this.updateEndDateDays();
  this.endDateView = 'day';
}

selectEndDateDay(d: number) {
  this.endDateSelectedDay = d;
  const dateValue = this.formatDateForInput(
    this.endDateSelectedYear!,
    this.endDateSelectedMonth!,
    this.endDateSelectedDay!
  );
  this.endDateFormattedDate = this.formatDateForDisplay(
    this.endDateSelectedYear!,
    this.endDateSelectedMonth!,
    this.endDateSelectedDay!
  );
  
  // Update form control
  this.filterForm.patchValue({ endDate: dateValue });
  this.isEndDatePickerOpen = false;
}

updateEndDateDays() {
  if (this.endDateSelectedYear === null || this.endDateSelectedMonth === null) return;
  const first = new Date(this.endDateSelectedYear, this.endDateSelectedMonth, 1);
  this.endDateFirstDayOfMonth = first.getDay();
  const days = new Date(this.endDateSelectedYear, this.endDateSelectedMonth + 1, 0).getDate();
  this.endDateDaysInMonth = Array.from({ length: days }, (_, i) => i + 1);
}

// Utility methods
formatDateForDisplay(y: number, m: number, d: number): string {
  const jj = String(d).padStart(2, '0');
  const mm = String(m + 1).padStart(2, '0');
  return `${jj}/${mm}/${y}`;
}

formatDateForInput(y: number, m: number, d: number): string {
  const jj = String(d).padStart(2, '0');
  const mm = String(m + 1).padStart(2, '0');
  return `${y}-${mm}-${jj}`;
}
  /**
   * Setup listeners for mode changes to ensure they're correctly synced with FormService
   */
  private setupModeChangeListeners(): void {
    // Suivre les changements de mode pour les persister dans FormService
    this.filterForm.get('priceMode')?.valueChanges.subscribe((mode: string) => {
            this.formService.setPriceMode(mode as FilterMode)
      // If price filter is active, apply only the price filter
      if (this.filterForm.get('usePriceFilter')?.value) {
        setTimeout(() => this.applyPriceFilter(this.filterForm.value), 100)
      }
    })
    
    this.filterForm.get('dateMode')?.valueChanges.subscribe((mode: string) => {
            this.formService.setDateMode(mode as FilterMode)
      // If date filter is active, apply only the date filter
      if (this.filterForm.get('useDateFilter')?.value) {
        setTimeout(() => this.applyDateFilter(this.filterForm.value), 100)
      }
    })
    
    this.filterForm.get('surfaceMode')?.valueChanges.subscribe((mode: string) => {
            this.formService.setSurfaceMode(mode as FilterMode)
      
      // If surface filter is active, apply only the surface filter
      if (this.filterForm.get('useSurfaceFilter')?.value) {
        setTimeout(() => this.applySurfaceFilter(this.filterForm.value), 100)
      }
    })
    
    this.filterForm.get('consumptionMode')?.valueChanges.subscribe((mode: string) => {
            this.formService.setConsumptionMode(mode as FilterMode)
      // If consumption filter is active, apply only the consumption filter
      if (this.filterForm.get('useConsumptionFilter')?.value) {
        setTimeout(() => this.applyConsumptionFilter(this.filterForm.value), 100)
      }
    })
  }

  private setupValueChangeListeners(): void {
    // ---------- PRICE ----------
    this.filterForm.get('price')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('usePriceFilter')?.value &&
            this.filterForm.get('priceMode')?.value === 'exact' &&
            v !== null && v !== '') {
          this.applyPriceFilter(this.filterForm.value);
        }
      });
  
    this.filterForm.get('minPrice')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('usePriceFilter')?.value &&
            this.filterForm.get('priceMode')?.value === 'range' &&
            v !== null && v !== '' &&
            this.filterForm.get('maxPrice')?.value !== null &&
            this.filterForm.get('maxPrice')?.value !== '') {
          this.applyPriceFilter(this.filterForm.value);
        }
      });
  
    this.filterForm.get('maxSurface')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useSurfaceFilter')?.value &&
            this.filterForm.get('surfaceMode')?.value === 'range' &&
            v !== null && v !== '' &&
            this.filterForm.get('minSurface')?.value !== null &&
            this.filterForm.get('minSurface')?.value !== '') {
          this.applySurfaceFilter(this.filterForm.value);
        }
      });
  
    // ---------- DATE ----------
    this.filterForm.get('exactDate')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useDateFilter')?.value &&
            this.filterForm.get('dateMode')?.value === 'exact' &&
            v) {
          this.applyDateFilter(this.filterForm.value);
        }
      });
  
    this.filterForm.get('startDate')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.filterForm.get('useDateFilter')?.value &&
            this.filterForm.get('dateMode')?.value === 'range' &&
            this.filterForm.get('startDate')?.value &&
            this.filterForm.get('endDate')?.value) {
          this.applyDateFilter(this.filterForm.value);
        }
      });
  
    this.filterForm.get('endDate')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.filterForm.get('useDateFilter')?.value &&
            this.filterForm.get('dateMode')?.value === 'range' &&
            this.filterForm.get('startDate')?.value &&
            this.filterForm.get('endDate')?.value) {
          this.applyDateFilter(this.filterForm.value);
        }
      });
  
    // ---------- SURFACE ----------
    this.filterForm.get('surface')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useSurfaceFilter')?.value &&
            this.filterForm.get('surfaceMode')?.value === 'exact' &&
            v !== null && v !== '') {
          this.applySurfaceFilter(this.filterForm.value);
        }
      });
  
    this.filterForm.get('minSurface')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useSurfaceFilter')?.value &&
            this.filterForm.get('surfaceMode')?.value === 'range' &&
            v !== null && v !== '' &&
            this.filterForm.get('maxSurface')?.value !== null &&
            this.filterForm.get('maxSurface')?.value !== '') {
          this.applySurfaceFilter(this.filterForm.value);
        }
      });
  
    // ---------- CONSUMPTION ----------
    this.filterForm.get('exactConsumption')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useConsumptionFilter')?.value &&
            this.filterForm.get('consumptionMode')?.value === 'exact' &&
            v !== null && v !== '') {
          this.applyConsumptionFilter(this.filterForm.value);
        }
      });
  
    this.filterForm.get('minConsumption')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useConsumptionFilter')?.value &&
            this.filterForm.get('consumptionMode')?.value === 'range') {
          this.applyConsumptionFilter(this.filterForm.value);
        }
      });
  
    this.filterForm.get('maxConsumption')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useConsumptionFilter')?.value &&
            this.filterForm.get('consumptionMode')?.value === 'range') {
          this.applyConsumptionFilter(this.filterForm.value);
        }
      });
  
    // ---------- ENERGY CLASSES (batch updates into one call) ----------
    const energyCtrls = [
      'energyClassA','energyClassB','energyClassC',
      'energyClassD','energyClassE','energyClassF','energyClassG'
    ].map(k => this.filterForm.get(k)!.valueChanges);
  
    merge(...energyCtrls)
      .pipe(debounceTime(150), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.filterForm.get('useEnergyFilter')?.value) {
          this.applyEnergyFilter(this.filterForm.value);
        }
      });

    // ---------- TYPE LOCALE ----------
    this.filterForm.get('typeLocale')?.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        if (this.filterForm.get('useTypeLocaleFilter')?.value) {
          this.applyTypeLocaleFilter(this.filterForm.value);
        }
      });
  }
  



  /**
   * Handle price filter application
   */
  private applyPriceFilter(values: any): void {
    if (!values.usePriceFilter) {
      this.formService.clearPriceFilter()
      return
    }

    if (values.priceMode === "exact") {
      // Only apply if user provided a value
      if (values.price && values.price !== '' && values.price !== null) {
        const val = Number(values.price)
        this.formService.setExactPrice(val)
              } else {
        // No value provided - clear filter to enable SELECT * behavior
        this.formService.clearPriceFilter()
              }
    } else {
      // Only apply if user provided values
      const hasMin = values.minPrice && values.minPrice !== '' && values.minPrice !== null
      const hasMax = values.maxPrice && values.maxPrice !== '' && values.maxPrice !== null
      
      if (hasMin || hasMax) {
        const min = hasMin ? Number(values.minPrice) : undefined
        const max = hasMax ? Number(values.maxPrice) : undefined
        // Only set filter if we have actual values, not defaults
        if (min !== undefined && max !== undefined) {
          this.formService.setPriceFilter(min, max)
        } else if (min !== undefined) {
          this.formService.setPriceFilter(min, 2000000) // Use reasonable upper bound only when min is set
        } else if (max !== undefined) {
          this.formService.setPriceFilter(0, max) // Use 0 as lower bound only when max is set
        }
      } else {
        // No values provided - clear filter to enable SELECT * behavior
        this.formService.clearPriceFilter()
      }
    }
  }

  /**
   * Handle date filter application
   */
  private applyDateFilter(values: any): void {
        
    if (!values.useDateFilter) {
      this.formService.clearDateFilter()
      return
    }

    if (values.dateMode === "exact") {
      // Only apply if user provided a value
      if (values.exactDate && values.exactDate !== '' && values.exactDate !== null) {
                this.formService.setExactDate(values.exactDate)
                      } else {
        // No value provided - clear filter to enable SELECT * behavior
        this.formService.clearDateFilter()
              }
    } else {
      // Only apply if user provided values
      const hasStart = values.startDate && values.startDate !== '' && values.startDate !== null
      const hasEnd = values.endDate && values.endDate !== '' && values.endDate !== null
      
      if (hasStart && hasEnd) {
        this.formService.setDateFilter(values.startDate, values.endDate)
              } else {
        // No complete range provided - clear filter to enable SELECT * behavior
        this.formService.clearDateFilter()
              }
    }
  }

  // ALSO ENSURE - The applySurfaceFilter method is correctly implemented
private applySurfaceFilter(values: any): void {
  
  if (!values.useSurfaceFilter) {
        this.formService.clearSurfaceFilter();
    return;
  }

  if (values.surfaceMode === "exact") {
    // Only apply if user provided a value
    if (values.surface && values.surface !== '' && values.surface !== null) {
      const val = Number(values.surface);
            this.formService.setExactSurface(val);
    } else {
      // No value provided - clear filter to enable SELECT * behavior
            this.formService.clearSurfaceFilter();
    }
  } else {
    // Range mode
    const hasMin = values.minSurface && values.minSurface !== '' && values.minSurface !== null;
    const hasMax = values.maxSurface && values.maxSurface !== '' && values.maxSurface !== null;
    
    if (hasMin && hasMax) {
      const min = Number(values.minSurface);
      const max = Number(values.maxSurface);
            this.formService.setSurfaceFilter(min, max);
    } else if (hasMin || hasMax) {
      // Partial range - use defaults for missing values
      const min = hasMin ? Number(values.minSurface) : 0;
      const max = hasMax ? Number(values.maxSurface) : 10000;
            this.formService.setSurfaceFilter(min, max);
    } else {
      // No values provided - clear filter to enable SELECT * behavior
            this.formService.clearSurfaceFilter();
    }
  }
}

  /**
   * Handle energy class filter application
   */
  private applyEnergyFilter(values: any): void {
    if (!values.useEnergyFilter) {
      this.formService.clearEnergyClassFilter()
      return
    }

    const selectedClasses = [
      values.energyClassA ? "A" : null,
      values.energyClassB ? "B" : null,
      values.energyClassC ? "C" : null,
      values.energyClassD ? "D" : null,
      values.energyClassE ? "E" : null,
      values.energyClassF ? "F" : null,
      values.energyClassG ? "G" : null,
    ].filter((c): c is string => c !== null)

    this.formService.setSelectedEnergyClasses(selectedClasses)
  }

  /**
   * Handle consumption filter application
   */
  private applyConsumptionFilter(values: any): void {
    if (!values.useConsumptionFilter) {
      this.formService.clearConsumptionFilter()
      return
    }

    if (values.consumptionMode === "exact") {
      // Only apply if user provided a value
      if (values.exactConsumption && values.exactConsumption !== '' && values.exactConsumption !== null) {
        const val = Number(values.exactConsumption)
        this.formService.setExactConsumption(val)
              } else {
        // No value provided - clear filter to enable SELECT * behavior
        this.formService.clearConsumptionFilter()
              }
    } else {
      // Only apply if user provided values (including zero)
      const hasMin = values.minConsumption !== null && values.minConsumption !== '' && values.minConsumption !== undefined
      const hasMax = values.maxConsumption !== null && values.maxConsumption !== '' && values.maxConsumption !== undefined
      
      if (hasMin || hasMax) {
        const min = hasMin ? Number(values.minConsumption) : 0
        const max = hasMax ? Number(values.maxConsumption) : 1000
        this.formService.setConsumptionFilter(min, max)
              } else {
        // No values provided - clear filter to enable SELECT * behavior
        this.formService.clearConsumptionFilter()
              }
    }
  }

  /**
   * Handle type locale filter application
   */
  private applyTypeLocaleFilter(values: any): void {
    if (!values.useTypeLocaleFilter) {
      this.formService.clearTypeLocaleFilter()
      this.selectedTypeLocales = []
      this.allTypeLocaleSelected = false
      return
    }

    const selectedTypeLocales = values.typeLocale || []
    
    // Update the selectedTypeLocales array for UI binding
    this.selectedTypeLocales = Array.isArray(selectedTypeLocales) ? [...selectedTypeLocales] : []
    
    // Update the "Tous les types" checkbox state
    this.allTypeLocaleSelected = this.selectedTypeLocales.length === this.typeLocaleOptions.length
    
    // Apply the filter
    if (this.selectedTypeLocales.length > 0) {
      this.formService.setSelectedTypeLocales(this.selectedTypeLocales)
    } else {
      // No locales selected - clear filter to enable SELECT * behavior
      this.formService.clearTypeLocaleFilter()
    }
  }

  /**
   * Toggle all price filter options
   */
  toggleAllPriceOptions(): void {
    this.allPriceSelected = !this.allPriceSelected

    if (this.allPriceSelected) {
      this.filterForm.patchValue({
        usePriceFilter: true,
        priceMode: "range",
        // Don't set default values - let user enter their own
        minPrice: null,
        maxPrice: null,
      })
      // Apply the filter - will trigger SELECT * behavior since no values provided
      this.applyPriceFilter(this.filterForm.value)
          } else {
      this.filterForm.patchValue({
        usePriceFilter: false,
        minPrice: null,
        maxPrice: null,
      })
      // Clear the filter immediately
      this.formService.clearPriceFilter()
          }
  }

  /**
   * Toggle all date filter options
   */
  toggleAllDateOptions(): void {
    this.allDateSelected = !this.allDateSelected

    if (this.allDateSelected) {
      this.filterForm.patchValue({
        useDateFilter: true,
        dateMode: "exact", // Changed from "range" to "exact" as default
        // Don't set default values - let user enter their own
        exactDate: null,
        startDate: null,
        endDate: null,
      })
      // Apply the filter - will trigger SELECT * behavior since no values provided
      this.applyDateFilter(this.filterForm.value)
          } else {
      this.filterForm.patchValue({
        useDateFilter: false,
        startDate: null,
        endDate: null,
      })
      // Clear the filter immediately
      this.formService.clearDateFilter()
          }
  }

  /**
   * Toggle all surface filter options
   */
  toggleAllSurfaceOptions(): void {
    this.allSurfaceSelected = !this.allSurfaceSelected

    if (this.allSurfaceSelected) {
      this.filterForm.patchValue({
        useSurfaceFilter: true,
        surfaceMode: "range",
        // Don't set default values - let user enter their own
        minSurface: null,
        maxSurface: null,
      })
      // Activate markers and sync with FormService
      this.markersVisible = true
      this.formService.setMarkersVisible(true)
      this.formService.setSurfaceToggle(true)
      this.formService.setSurfaceMode("range")
      
      // Apply only the surface filter - SELECT * behavior since no values provided
      this.applySurfaceFilter(this.filterForm.value)
      
          } else {
      this.filterForm.patchValue({
        useSurfaceFilter: false,
        minSurface: null,
        maxSurface: null,
      })
      // Clear the filter immediately
      this.formService.clearSurfaceFilter()
      this.formService.setSurfaceToggle(false)
          }
  }

  /**
   * Toggle all energy class filter options
   */
  toggleAllEnergyOptions(): void {
    this.allEnergySelected = !this.allEnergySelected

    this.filterForm.patchValue({
      useEnergyFilter: this.allEnergySelected,
      energyClassA: this.allEnergySelected,
      energyClassB: this.allEnergySelected,
      energyClassC: this.allEnergySelected,
      energyClassD: this.allEnergySelected,
      energyClassE: this.allEnergySelected,
      energyClassF: this.allEnergySelected,
      energyClassG: this.allEnergySelected,
    })

    if (this.allEnergySelected) {
      // Apply the filter with all classes selected immediately
      this.applyEnergyFilter(this.filterForm.value)
    } else {
      // Clear the filter immediately
      this.formService.clearEnergyClassFilter()
    }
  }

  /**
   * Toggle all consumption filter options
   */
  toggleAllConsumptionOptions(): void {
    this.allConsumptionSelected = !this.allConsumptionSelected

    if (this.allConsumptionSelected) {
      this.filterForm.patchValue({
        useConsumptionFilter: true,
        consumptionMode: "range",
        minConsumption: 0,
        maxConsumption: 10000000,
      })
      // Apply the filter with default values immediately
      this.applyConsumptionFilter(this.filterForm.value)
    } else {
      this.filterForm.patchValue({
        useConsumptionFilter: false,
        minConsumption: null,
        maxConsumption: null,
      })
      // Clear the filter immediately
      this.formService.clearConsumptionFilter()
    }
  }

  /**
   * Toggle all type locale filter options
   */
  toggleAllTypeLocaleOptions(): void {
    this.allTypeLocaleSelected = !this.allTypeLocaleSelected

    if (this.allTypeLocaleSelected) {
      // Select all type locales
      const allValues = this.typeLocaleOptions.map(option => option.value)
      this.selectedTypeLocales = [...allValues]
      this.filterForm.patchValue({
        useTypeLocaleFilter: true,
        typeLocale: allValues,
      })
      // Apply the filter with all type locales selected immediately
      this.applyTypeLocaleFilter(this.filterForm.value)
    } else {
      // Deselect all type locales but keep the filter active
      this.selectedTypeLocales = []
      this.filterForm.patchValue({
        typeLocale: [],
      })
      // Apply the empty filter (will trigger SELECT * behavior)
      this.applyTypeLocaleFilter(this.filterForm.value)
    }
  }

  /**
   * Handle individual type locale checkbox change
   * @param event The checkbox change event
   * @param localeValue The locale value that was changed
   */
  onTypeLocaleCheckboxChange(event: Event, localeValue: string): void {
    const checkbox = event.target as HTMLInputElement
    const checked = checkbox.checked
    
    // Update the selectedTypeLocales array
    if (checked && !this.selectedTypeLocales.includes(localeValue)) {
      this.selectedTypeLocales.push(localeValue)
    } else if (!checked && this.selectedTypeLocales.includes(localeValue)) {
      this.selectedTypeLocales = this.selectedTypeLocales.filter(value => value !== localeValue)
    }
    
    // Update the form control value
    this.filterForm.patchValue({
      typeLocale: [...this.selectedTypeLocales]
    })
    
    // Update the "Tous les types" checkbox state
    this.allTypeLocaleSelected = this.selectedTypeLocales.length === this.typeLocaleOptions.length
    
    // Activate the filter if it's not already active
    if (this.selectedTypeLocales.length > 0 && !this.filterForm.get('useTypeLocaleFilter')?.value) {
      this.filterForm.patchValue({
        useTypeLocaleFilter: true
      })
    }
    
    // Apply the filter
    this.applyTypeLocaleFilter(this.filterForm.value)
  }

  /**
   * Check if any filters are currently active
   */
  hasActiveFilters(): boolean {
    return this.filterForm.get('usePriceFilter')?.value ||
           this.filterForm.get('useDateFilter')?.value ||
           this.filterForm.get('useSurfaceFilter')?.value ||
           this.filterForm.get('useEnergyFilter')?.value ||
           this.filterForm.get('useConsumptionFilter')?.value ||
           this.filterForm.get('useTypeLocaleFilter')?.value
  }

 
  

  

  /**
   * Configure toutes les souscriptions aux observables du FormService
   */
  private setupFormServiceSubscriptions(): void {
    // Souscriptions aux états d'expansion des chevrons
    this.formService.getPriceExpandedObservable().subscribe(expanded => {
      this.priceExpanded = expanded
    })

    this.formService.getDateExpandedObservable().subscribe(expanded => {
      this.dateExpanded = expanded
    })

    this.formService.getSurfaceExpandedObservable().subscribe(expanded => {
      this.surfaceExpanded = expanded
    })

    this.formService.getEnergyExpandedObservable().subscribe(expanded => {
      this.energyExpanded = expanded
    })

    this.formService.getConsumptionExpandedObservable().subscribe(expanded => {
      this.consumptionExpanded = expanded
    })

    this.formService.getTypeLocaleExpandedObservable().subscribe(expanded => {
      this.typeLocaleExpanded = expanded
    })

    // Souscriptions aux états des toggles
    this.formService.getPriceToggleObservable().subscribe(active => {
      this.allPriceSelected = active
      this.filterForm.patchValue({ usePriceFilter: active }, { emitEvent: false })
    })

    this.formService.getDateToggleObservable().subscribe(active => {
      this.allDateSelected = active
      this.filterForm.patchValue({ useDateFilter: active }, { emitEvent: false })
    })

    this.formService.getSurfaceToggleObservable().subscribe(active => {
      this.allSurfaceSelected = active
      this.filterForm.patchValue({ useSurfaceFilter: active }, { emitEvent: false })
    })


    this.formService.getEnergyToggleObservable().subscribe(active => {
      this.allEnergySelected = active
      this.filterForm.patchValue({ useEnergyFilter: active }, { emitEvent: false })
    })

    this.formService.getConsumptionToggleObservable().subscribe(active => {
      this.allConsumptionSelected = active
      this.filterForm.patchValue({ useConsumptionFilter: active }, { emitEvent: false })
    })

    this.formService.getTypeLocaleToggleObservable().subscribe(active => {
      this.allTypeLocaleSelected = active
      this.filterForm.patchValue({ useTypeLocaleFilter: active }, { emitEvent: false })
    })

    // Souscriptions aux états de chargement
    this.formService.getPriceLoadingObservable().subscribe(loading => {
      this.priceLoading = loading
    })

    this.formService.getDateLoadingObservable().subscribe(loading => {
      this.dateLoading = loading
    })

    this.formService.getSurfaceLoadingObservable().subscribe(loading => {
      this.surfaceLoading = loading
    })

    this.formService.getEnergyLoadingObservable().subscribe(loading => {
      this.energyLoading = loading
    })

    this.formService.getConsumptionLoadingObservable().subscribe(loading => {
      this.consumptionLoading = loading
    })

    this.formService.getTypeLocaleLoadingObservable().subscribe(loading => {
      this.typeLocaleLoading = loading
    })

    // Souscription à l'état de visibilité des marqueurs
    this.formService.getMarkersVisibleObservable().subscribe(visible => {
      this.markersVisible = visible
    })

    // Souscriptions aux modes des filtres pour synchroniser les form controls
    this.formService.getPriceModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ priceMode: mode }, { emitEvent: false })
    })

    this.formService.getDateModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ dateMode: mode }, { emitEvent: false })
    })

    this.formService.getSurfaceModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ surfaceMode: mode }, { emitEvent: false })
    })

    this.formService.getConsumptionModeObservable().subscribe(mode => {
      this.filterForm.patchValue({ consumptionMode: mode }, { emitEvent: false })
    })

    // Type Locale filter subscriptions
    this.formService.getTypeLocaleToggleObservable().subscribe(enabled => {
      this.filterForm.get('useTypeLocaleFilter')?.setValue(enabled, { emitEvent: false })
      this.typeLocaleExpanded = enabled ? true : this.typeLocaleExpanded
    })

    this.formService.getTypeLocaleExpandedObservable().subscribe(expanded => {
      this.typeLocaleExpanded = expanded
    })

    this.formService.getSelectedTypeLocalesObservable().subscribe(typeLocales => {
      if (typeLocales !== null) {
        this.selectedTypeLocales = [...typeLocales]
        this.allTypeLocaleSelected = this.selectedTypeLocales.length === this.typeLocaleOptions.length
        this.filterForm.patchValue({ typeLocale: typeLocales }, { emitEvent: false })
      } else {
        this.selectedTypeLocales = []
        this.allTypeLocaleSelected = false
        this.filterForm.patchValue({ typeLocale: [] }, { emitEvent: false })
      }
    })

    this.formService.getTypeLocaleLoadingObservable().subscribe(loading => {
      this.typeLocaleLoading = loading
    })
  }

  
  
  private forceRadioButtonsState(): void {
    
    // Obtenir les valeurs actuelles des modes
    let priceMode: string = 'range'
    let dateMode: string = 'range'
    let surfaceMode: string = 'range'
    let consumptionMode: string = 'range'
    
    this.formService.getPriceModeObservable().pipe().subscribe(mode => {
      if (mode) priceMode = mode
    }).unsubscribe()
    
    this.formService.getDateModeObservable().pipe().subscribe(mode => {
      if (mode) dateMode = mode
    }).unsubscribe()
    
    this.formService.getSurfaceModeObservable().pipe().subscribe(mode => {
      if (mode) surfaceMode = mode
    }).unsubscribe()
    
    this.formService.getConsumptionModeObservable().pipe().subscribe(mode => {
      if (mode) consumptionMode = mode
    }).unsubscribe()
    
    // Utiliser setTimeout pour s'assurer que le DOM est prêt
    setTimeout(() => {
      
      // Mettre à jour le formulaire avec les valeurs
      this.filterForm.patchValue({
        priceMode,
        dateMode, 
        surfaceMode,
        consumptionMode
      }, { emitEvent: false })
      
      // Rafraîchir manuellement tous les boutons radio pour contourner le problème Angular
      try {
        const radioInputs = document.querySelectorAll('input[type="radio"]')
        radioInputs.forEach((radio: any) => {
          const formName = radio.getAttribute('formcontrolname')
          const value = radio.value
          
          // Déterminer si ce bouton radio devrait être sélectionné
          let shouldBeChecked = false
          
          if (formName === 'priceMode') shouldBeChecked = value === priceMode
          else if (formName === 'dateMode') shouldBeChecked = value === dateMode
          else if (formName === 'surfaceMode') shouldBeChecked = value === surfaceMode
          else if (formName === 'consumptionMode') shouldBeChecked = value === consumptionMode
          
          // Forcer l'état checked
          if (shouldBeChecked && !radio.checked) {
            radio.checked = true
                      }
        })
      } catch (e) {
        console.error('Erreur lors de la manipulation du DOM:', e)
      }
    }, 300)
  }

  private restoreFormState(): void {

    // Utiliser un délai pour s'assurer que les souscriptions sont établies
    setTimeout(() => {
      
      // Restaurer directement depuis les BehaviorSubjects actuels
      const formUpdates: any = {}

      // FORCER des valeurs par défaut pour les modes (même s'ils sont null dans FormService)
      // Utiliser 'interval' comme valeur par défaut sécuritaire
      formUpdates.priceMode = 'range'
      formUpdates.dateMode = 'range'
      formUpdates.surfaceMode = 'range'
      formUpdates.consumptionMode = 'range'
      
      // Puis, essayer de restaurer les vraies valeurs des modes depuis FormService
      this.formService.getPriceModeObservable().pipe().subscribe(mode => {
        if (mode) {
          formUpdates.priceMode = mode
        }
      }).unsubscribe()

      this.formService.getDateModeObservable().pipe().subscribe(mode => {
        if (mode) {
          formUpdates.dateMode = mode
        }
      }).unsubscribe()

      this.formService.getSurfaceModeObservable().pipe().subscribe(mode => {
        if (mode) {
          formUpdates.surfaceMode = mode
        }
      }).unsubscribe()

      this.formService.getConsumptionModeObservable().pipe().subscribe(mode => {
        if (mode) {
          formUpdates.consumptionMode = mode
        }
      }).unsubscribe()
      
      // Restaurer les valeurs des filtres
      // Prix
      this.formService.getPriceFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.minPrice = value[0]
          formUpdates.maxPrice = value[1]
        }
      }).unsubscribe()

      this.formService.getExactPriceObservable().pipe().subscribe(value => {
        if (value !== null) {
          formUpdates.price = value
        }
      }).unsubscribe()

      // Date
      this.formService.getDateFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.startDate = value[0]
          formUpdates.endDate = value[1]
        }
      }).unsubscribe()

      this.formService.getExactDateObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.exactDate = value
        }
      }).unsubscribe()

      // Surface
      this.formService.getSurfaceFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.minSurface = value[0]
          formUpdates.maxSurface = value[1]
        }
      }).unsubscribe()

      this.formService.getExactSurfaceObservable().pipe().subscribe(value => {
        if (value !== null) {
          formUpdates.surface = value
        }
      }).unsubscribe()

      // Consommation
      this.formService.getConsumptionFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.minConsumption = value[0]
          formUpdates.maxConsumption = value[1]
        }
      }).unsubscribe()

      this.formService.getExactConsumptionObservable().pipe().subscribe(value => {
        if (value !== null) {
          formUpdates.exactConsumption = value
        }
      }).unsubscribe()

      // Type de local
      this.formService.getTypeLocaleFilterObservable().pipe().subscribe(value => {
        if (value) {
          formUpdates.typeLocale = value
        }
      }).unsubscribe()

      // Appliquer toutes les mises à jour en une fois
      if (Object.keys(formUpdates).length > 0) {
        this.filterForm.patchValue(formUpdates, { emitEvent: false })
      }
    }, 200)
  }

  /**
   * Méthodes pour gérer les chevrons (expansion/contraction des sections)
   */
  togglePriceExpanded(): void {
    this.priceExpanded = !this.priceExpanded
    this.formService.setPriceExpanded(this.priceExpanded)
  }

  toggleDateExpanded(): void {
    this.dateExpanded = !this.dateExpanded
    this.formService.setDateExpanded(this.dateExpanded)
  }

  toggleSurfaceExpanded(): void {
    this.surfaceExpanded = !this.surfaceExpanded
    this.formService.setSurfaceExpanded(this.surfaceExpanded)
  }

  toggleEnergyExpanded(): void {
    this.energyExpanded = !this.energyExpanded
    this.formService.setEnergyExpanded(this.energyExpanded)
  }

  toggleConsumptionExpanded(): void {
    this.consumptionExpanded = !this.consumptionExpanded
    this.formService.setConsumptionExpanded(this.consumptionExpanded)
  }

  toggleTypeLocaleExpanded(): void {
    this.typeLocaleExpanded = !this.typeLocaleExpanded
    this.formService.setTypeLocaleExpanded(this.typeLocaleExpanded)
  }


// Add this new method to automatically activate toggles when user starts typing
private setupAutoToggleActivation(): void {
  // Price filter inputs - activate toggle when user starts typing
  this.filterForm.get('price')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('usePriceFilter')?.value) {
      this.filterForm.patchValue({ usePriceFilter: true }, { emitEvent: false });
      this.formService.setPriceToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('minPrice')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('usePriceFilter')?.value) {
      this.filterForm.patchValue({ usePriceFilter: true }, { emitEvent: false });
      this.formService.setPriceToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('maxPrice')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('usePriceFilter')?.value) {
      this.filterForm.patchValue({ usePriceFilter: true }, { emitEvent: false });
      this.formService.setPriceToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  // Date filter inputs - activate toggle when user starts typing
  this.filterForm.get('exactDate')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useDateFilter')?.value) {
      this.filterForm.patchValue({ useDateFilter: true }, { emitEvent: false });
      this.formService.setDateToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('startDate')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useDateFilter')?.value) {
      this.filterForm.patchValue({ useDateFilter: true }, { emitEvent: false });
      this.formService.setDateToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('endDate')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useDateFilter')?.value) {
      this.filterForm.patchValue({ useDateFilter: true }, { emitEvent: false });
      this.formService.setDateToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  // Surface filter inputs - activate toggle when user starts typing
  this.filterForm.get('surface')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useSurfaceFilter')?.value) {
      this.filterForm.patchValue({ useSurfaceFilter: true }, { emitEvent: false });
      this.formService.setSurfaceToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('minSurface')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useSurfaceFilter')?.value) {
      this.filterForm.patchValue({ useSurfaceFilter: true }, { emitEvent: false });
      this.formService.setSurfaceToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('maxSurface')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useSurfaceFilter')?.value) {
      this.filterForm.patchValue({ useSurfaceFilter: true }, { emitEvent: false });
      this.formService.setSurfaceToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  // Consumption filter inputs - activate toggle when user starts typing
  this.filterForm.get('exactConsumption')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useConsumptionFilter')?.value) {
      this.filterForm.patchValue({ useConsumptionFilter: true }, { emitEvent: false });
      this.formService.setConsumptionToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('minConsumption')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useConsumptionFilter')?.value) {
      this.filterForm.patchValue({ useConsumptionFilter: true }, { emitEvent: false });
      this.formService.setConsumptionToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  this.filterForm.get('maxConsumption')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useConsumptionFilter')?.value) {
      this.filterForm.patchValue({ useConsumptionFilter: true }, { emitEvent: false });
      this.formService.setConsumptionToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  // Type locale filter inputs - activate toggle when user starts typing
  this.filterForm.get('typeLocale')?.valueChanges.subscribe((value) => {
    if (value !== null && value !== '' && !this.filterForm.get('useTypeLocaleFilter')?.value) {
      this.filterForm.patchValue({ useTypeLocaleFilter: true }, { emitEvent: false });
      this.formService.setTypeLocaleToggle(true);
      this.markersVisible = true;
      this.formService.setMarkersVisible(true);
    }
  });

  // Energy class checkboxes - activate toggle when user checks any checkbox
  const energyClasses = ['energyClassA', 'energyClassB', 'energyClassC', 'energyClassD', 'energyClassE', 'energyClassF', 'energyClassG'];
  energyClasses.forEach(className => {
    this.filterForm.get(className)?.valueChanges.subscribe((checked) => {
      if (checked && !this.filterForm.get('useEnergyFilter')?.value) {
        this.filterForm.patchValue({ useEnergyFilter: true }, { emitEvent: false });
        this.formService.setEnergyToggle(true);
        this.markersVisible = true;
        this.formService.setMarkersVisible(true);
      }
    });
  });
}

}
