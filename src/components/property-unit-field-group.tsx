"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import type { PropertyDefinition } from "@/lib/types";
import { WorkspaceSelect } from "@/components/workspace-select";

function findProperty(
  properties: PropertyDefinition[],
  propertyName: string,
) {
  return properties.find(
    (property) => property.name.toLowerCase() === propertyName.trim().toLowerCase(),
  );
}

export function PropertyUnitFieldGroup({
  properties,
  initialPropertyName = "",
  initialUnitName = "",
  propertyInputName = "propertyName",
  unitInputName = "unitName",
}: {
  properties: PropertyDefinition[];
  initialPropertyName?: string;
  initialUnitName?: string;
  propertyInputName?: string;
  unitInputName?: string;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const [propertyName, setPropertyName] = useState(
    initialPropertyName || (properties.length === 1 ? properties[0].name : ""),
  );
  const [unitName, setUnitName] = useState(initialUnitName);

  const selectedProperty = useMemo(
    () => findProperty(properties, propertyName),
    [properties, propertyName],
  );
  const units = selectedProperty?.units ?? [];
  const propertyOptions = properties.map((property) => ({
    value: property.name,
    label: property.name,
    description:
      property.units.length > 0
        ? isSpanish
          ? `${property.units.length} listing${property.units.length === 1 ? "" : "s"} guardado${property.units.length === 1 ? "" : "s"}`
          : `${property.units.length} saved listing${property.units.length === 1 ? "" : "s"}`
        : isSpanish
          ? "Propiedad de vivienda única"
          : "Single-home property",
  }));
  const unitOptions = [
    {
      value: "",
      label: isSpanish ? "Listing principal" : "Primary listing",
      description: isSpanish
        ? "Úsalo cuando toda la propiedad sea un solo listing."
        : "Use this when the whole property is just one listing.",
    },
    ...units.map((unit) => ({
      value: unit.name,
      label: unit.name,
    })),
  ];

  return (
    <>
      <WorkspaceSelect
        className="sm:col-span-2"
        label={isSpanish ? "Propiedad" : "Property"}
        name={propertyInputName}
        required
        disabled={properties.length === 0}
        value={propertyName}
        onChange={(nextProperty) => {
          setPropertyName(nextProperty);

          const nextSelectedProperty = findProperty(properties, nextProperty);
          if (
            nextSelectedProperty &&
            unitName &&
            !nextSelectedProperty.units.some(
              (unit) => unit.name.toLowerCase() === unitName.trim().toLowerCase(),
            )
          ) {
            setUnitName("");
          }
        }}
        options={propertyOptions}
        placeholder={
          properties.length > 0
            ? isSpanish
              ? "Selecciona una propiedad"
              : "Select a property"
            : isSpanish
              ? "Crea primero una propiedad"
              : "Create a property first"
        }
      />

      <WorkspaceSelect
        className="sm:col-span-2"
        label="Listing"
        name={unitInputName}
        value={unitName}
        onChange={setUnitName}
        options={unitOptions}
        placeholder={
          units.length > 0
            ? isSpanish
              ? "Selecciona un listing"
              : "Select a listing"
            : isSpanish
              ? "Listing principal"
              : "Primary listing"
        }
        helper={
          selectedProperty
            ? units.length > 0
              ? isSpanish
                ? "Esta propiedad ya tiene listings guardados que puedes reutilizar."
                : "This property already has saved listings you can reuse."
              : isSpanish
                ? "Esta propiedad todavía no tiene listings extra. Mantén `Listing principal` para el flujo de vivienda completa."
                : "This property has no extra listings yet. Keep `Primary listing` for the full-home flow."
            : properties.length > 0
              ? isSpanish
                ? "Los listings son opcionales. Mantén `Listing principal` para propiedades de vivienda única."
                : "Listings are optional. Keep `Primary listing` for single-home properties."
              : isSpanish
                ? "Crea tu primera propiedad antes de añadir reservas o gastos."
                : "Create your first property before adding bookings or expenses."
        }
      />
    </>
  );
}
