"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type RegionItem,
  type ProvinceItem,
  type MunicipalityItem,
  type Scope,
  useMunicipalitiesByProvince,
  useProvincesByRegion,
  useRegions,
} from "@/lib/hooks/use-location-catalog";

export type LocationLevel = "region" | "province" | "municipality";

export type LocationValue = {
  regionId?: string | null;
  provinceId?: string | null;
  municipalityId?: string | null;
};

export type LocationFullValue = {
  region: RegionItem | null;
  province: ProvinceItem | null;
  municipality: MunicipalityItem | null;
};

export type LocationPickerProps = {
  /** Valor controlado (ids). */
  value: LocationValue;
  /** Disparado al cambiar cualquier nivel — siempre devuelve la cadena completa. */
  onChange: (value: LocationValue, full: LocationFullValue) => void;
  /**
   * Niveles a mostrar. Por defecto los 3.
   * Para "Crear municipalidad" usa ["region","province"].
   */
  levels?: LocationLevel[];
  /** Catálogo público (registro) o admin (scope completo). */
  scope?: Scope;
  /** Deshabilita los 3 dropdowns. */
  disabled?: boolean;
  /**
   * Nombres opcionales para mostrar mientras se carga el catálogo —
   * evita el "flicker" de mostrar el id crudo entre el mount y el fetch.
   */
  initialNames?: {
    regionName?: string | null;
    provinceName?: string | null;
    municipalityName?: string | null;
  };
};

/**
 * Selector geográfico jerárquico Departamento → Provincia → Municipio
 * con búsqueda incremental (cmdk) en cada nivel.
 *
 * Cascada: cambiar región limpia provincia y municipio. Cambiar provincia
 * limpia municipio. El backend (hooks pre-save de User) deriva regionId
 * desde provinceId al persistir, pero el componente envía los 3 ids
 * para que cualquier endpoint pueda consumirlos.
 */
export function LocationPicker({
  value,
  onChange,
  levels = ["region", "province", "municipality"],
  scope = "admin",
  disabled = false,
  initialNames,
}: LocationPickerProps) {
  const showRegion = levels.includes("region");
  const showProvince = levels.includes("province");
  const showMunicipality = levels.includes("municipality");

  // Selección "ad-hoc" mientras el usuario navega (override del value pasado
  // por el padre — útil para que la cascada responda inmediato sin esperar a
  // que el componente padre nos vuelva a pasar value tras el onChange).
  const [pickedRegion, setPickedRegion] = useState<RegionItem | null>(null);
  const [pickedProvince, setPickedProvince] = useState<ProvinceItem | null>(
    null,
  );
  const [pickedMunicipality, setPickedMunicipality] =
    useState<MunicipalityItem | null>(null);

  // Catálogos
  const { regions, loading: loadingRegions, error: regionsError } =
    useRegions(scope);

  // Resuelve la región a usar: prioriza la elección local, luego el value
  // del padre comparado contra el catálogo cargado.
  const region = useMemo<RegionItem | null>(() => {
    if (pickedRegion) return pickedRegion;
    if (!value.regionId) return null;
    return regions.find((r) => r.id === value.regionId) ?? null;
  }, [pickedRegion, regions, value.regionId]);

  // Carga de provincias dependiente de la región
  const { provinces, loading: loadingProvinces } = useProvincesByRegion(
    region,
    scope,
  );

  const province = useMemo<ProvinceItem | null>(() => {
    if (pickedProvince) return pickedProvince;
    if (!value.provinceId) return null;
    return provinces.find((p) => p.id === value.provinceId) ?? null;
  }, [pickedProvince, provinces, value.provinceId]);

  // Carga de municipalidades dependiente de la provincia
  const { municipalities, loading: loadingMunis } =
    useMunicipalitiesByProvince(province, scope);

  const municipality = useMemo<MunicipalityItem | null>(() => {
    if (pickedMunicipality) return pickedMunicipality;
    if (!value.municipalityId) return null;
    return municipalities.find((m) => m.id === value.municipalityId) ?? null;
  }, [pickedMunicipality, municipalities, value.municipalityId]);

  // Etiquetas a mostrar en el botón (combina catálogo cargado + initialNames).
  const regionLabel = useMemo(
    () =>
      region?.name ??
      (value.regionId ? initialNames?.regionName ?? null : null),
    [region, value.regionId, initialNames?.regionName],
  );
  const provinceLabel = useMemo(
    () =>
      province?.name ??
      (value.provinceId ? initialNames?.provinceName ?? null : null),
    [province, value.provinceId, initialNames?.provinceName],
  );
  const municipalityLabel = useMemo(
    () =>
      municipality?.name ??
      (value.municipalityId
        ? initialNames?.municipalityName ?? null
        : null),
    [municipality, value.municipalityId, initialNames?.municipalityName],
  );

  function emit(next: LocationFullValue) {
    onChange(
      {
        regionId: next.region?.id ?? null,
        provinceId: next.province?.id ?? null,
        municipalityId: next.municipality?.id ?? null,
      },
      next,
    );
  }

  function handleRegionSelect(r: RegionItem | null) {
    setPickedRegion(r);
    setPickedProvince(null);
    setPickedMunicipality(null);
    emit({ region: r, province: null, municipality: null });
  }

  function handleProvinceSelect(p: ProvinceItem | null) {
    setPickedProvince(p);
    setPickedMunicipality(null);
    emit({ region, province: p, municipality: null });
  }

  function handleMunicipalitySelect(m: MunicipalityItem | null) {
    setPickedMunicipality(m);
    emit({ region, province, municipality: m });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {showRegion && (
        <ComboField
          label="Región"
          placeholder={
            loadingRegions ? "Cargando…" : "— Sin región —"
          }
          searchPlaceholder="Buscar región…"
          value={region}
          fallbackLabel={regionLabel}
          options={regions.map((r) => ({
            id: r.id,
            label: r.name,
            payload: r,
          }))}
          onSelect={(opt) =>
            handleRegionSelect((opt?.payload as RegionItem | undefined) ?? null)
          }
          disabled={disabled || loadingRegions}
          emptyMessage={
            regionsError ? `Error: ${regionsError}` : "Sin resultados"
          }
        />
      )}

      {showProvince && (
        <ComboField
          label="Provincia"
          placeholder={
            !region
              ? "Elige una región"
              : loadingProvinces
                ? "Cargando…"
                : "— Sin provincia —"
          }
          searchPlaceholder="Buscar provincia…"
          value={province}
          fallbackLabel={provinceLabel}
          options={provinces.map((p) => ({
            id: p.id,
            label: p.name,
            payload: p,
          }))}
          onSelect={(opt) =>
            handleProvinceSelect(
              (opt?.payload as ProvinceItem | undefined) ?? null,
            )
          }
          disabled={disabled || !region || loadingProvinces}
          emptyMessage="Sin resultados"
        />
      )}

      {showMunicipality && (
        <ComboField
          label="Municipalidad"
          placeholder={
            !province
              ? "Elige una provincia"
              : loadingMunis
                ? "Cargando…"
                : "— Sin municipalidad —"
          }
          searchPlaceholder="Buscar municipalidad…"
          value={municipality}
          fallbackLabel={municipalityLabel}
          options={municipalities.map((m) => ({
            id: m.id,
            label: m.name + (m.active === false ? " (inactiva)" : ""),
            payload: m,
          }))}
          onSelect={(opt) =>
            handleMunicipalitySelect(
              (opt?.payload as MunicipalityItem | undefined) ?? null,
            )
          }
          disabled={disabled || !province || loadingMunis}
          emptyMessage="Sin resultados"
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ComboField — combobox individual con búsqueda; estilo coherente con el
// design system (light-only, INK tokens). Usa shadcn Popover + cmdk Command.
// ──────────────────────────────────────────────────────────────────────────

type ComboOption = {
  id: string;
  label: string;
  payload: unknown;
};

function ComboField({
  label,
  placeholder,
  searchPlaceholder,
  value,
  fallbackLabel,
  options,
  onSelect,
  disabled,
  emptyMessage,
}: {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  value: { id: string; name: string } | null;
  fallbackLabel: string | null;
  options: ComboOption[];
  onSelect: (option: ComboOption | null) => void;
  disabled: boolean;
  emptyMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const display = value?.name ?? fallbackLabel ?? placeholder;
  const isEmpty = !value && !fallbackLabel;

  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
        {label}
      </label>
      <Popover open={open} onOpenChange={(o: boolean) => !disabled && setOpen(o)}>
        <PopoverTrigger
          disabled={disabled}
          className="flex h-[42px] w-full items-center justify-between gap-2 rounded-lg border border-[#E4E4E7] bg-white px-3 text-left text-[13.5px] outline-none transition focus:border-[#0A1628] focus:ring-2 focus:ring-[#0A1628]/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#A1A1AA]" />
            <span
              className={
                "truncate " +
                (isEmpty
                  ? "text-[#A1A1AA]"
                  : "font-medium text-[#0A1628]")
              }
            >
              {display}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#71717A]" />
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--anchor-width,280px)] min-w-[260px] p-0"
          align="start"
          sideOffset={6}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {options.length > 0 && (
                <>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                  >
                    <span className="text-[#A1A1AA]">— Sin selección —</span>
                  </CommandItem>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={`${opt.label} ${opt.id}`}
                      onSelect={() => {
                        onSelect(opt);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </CommandItem>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
