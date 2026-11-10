import { NextResponse } from "next/server";
import type { AppLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server-locale";

/**
 * Spanish versions of the messages the API sends back to the app. The API is
 * written in English; responses are translated on the way out so every error
 * and confirmation follows the language the user picked.
 */
const spanishMessages: Record<string, string> = {
  "Access revoked.": "Acceso revocado.",
  "Add a business name before saving settings.": "Añade un nombre de negocio antes de guardar los ajustes.",
  "Add a little more detail so we can help properly.": "Añade un poco más de detalle para que podamos ayudarte bien.",
  "An account with that email already exists.": "Ya existe una cuenta con ese email.",
  "Attach a valid Airbnb, Booking.com, or GoHostlyx file first.": "Adjunta primero un archivo válido de Airbnb, Booking.com o GoHostlyx.",
  "Booking deleted successfully.": "Reserva eliminada.",
  "Booking marked as reviewed.": "Reserva marcada como revisada.",
  "Booking moved back to review.": "La reserva vuelve a estar pendiente de revisión.",
  "Booking not found.": "No se encontró la reserva.",
  "Checkout must be after check-in.": "El check-out debe ser posterior al check-in.",
  "Choose Starter, Pro, or Portfolio.": "Elige Starter, Pro o Portfolio.",
  "Choose a paid plan to continue.": "Elige un plan de pago para continuar.",
  "Choose a property before saving the booking.": "Elige una propiedad antes de guardar la reserva.",
  "Choose a property before saving the expense.": "Elige una propiedad antes de guardar el gasto.",
  "Choose a property first.": "Elige primero una propiedad.",
  "Choose a user first.": "Elige primero un usuario.",
  "Choose a valid property for this import.": "Elige una propiedad válida para esta importación.",
  "Contact email is not configured yet. Please write directly to hello@gohostlyx.com for now.":
    "El email de contacto aún no está configurado. Por ahora escribe directamente a hello@gohostlyx.com.",
  "Contact form delivery failed": "No se pudo enviar el formulario de contacto",
  "Could not find the expected header row in the worksheet.": "No se encontró la fila de encabezados esperada en la hoja.",
  "Create your first property before adding bookings.": "Crea tu primera propiedad antes de añadir reservas.",
  "Create your first property before adding expenses.": "Crea tu primera propiedad antes de añadir gastos.",
  "Create your first property before importing data.": "Crea tu primera propiedad antes de importar datos.",
  "Email sign-up is not available right now. Please continue with Google.":
    "El registro por email no está disponible ahora mismo. Continúa con Google.",
  "Email verified. Signing you in now.": "Email verificado. Iniciando sesión.",
  "Enter a property name.": "Escribe un nombre de propiedad.",
  "Enter a unit name.": "Escribe un nombre de listing.",
  "Enter a valid email address.": "Escribe un email válido.",
  "Enter an expense amount greater than zero.": "Escribe un importe de gasto mayor que cero.",
  "Enter the 6-digit verification code.": "Escribe el código de verificación de 6 dígitos.",
  "Enter your full name to create the account.": "Escribe tu nombre completo para crear la cuenta.",
  "Everything in this file is blocked, duplicated, canceled, or still missing key data. Fix the source file or use Bookings to review imported rows after the next attempt.":
    "Todo lo de este archivo está bloqueado, duplicado, cancelado o le faltan datos clave. Corrige el archivo de origen o revisa las filas importadas en Reservas tras el próximo intento.",
  "Expense deleted successfully.": "Gasto eliminado.",
  "Expense not found.": "No se encontró el gasto.",
  "Feed disconnected.": "Calendario desconectado.",
  "Generic imports require both Bookings and Expenses sheets.": "Las importaciones genéricas necesitan las hojas Bookings y Expenses.",
  "GoHostlyx could not fetch that iCal feed right now.": "GoHostlyx no pudo descargar ese calendario iCal ahora mismo.",
  "GoHostlyx could not find recognizable Airbnb columns in this file.": "GoHostlyx no encontró columnas de Airbnb reconocibles en este archivo.",
  "GoHostlyx could not find recognizable Booking.com columns in this file.":
    "GoHostlyx no encontró columnas de Booking.com reconocibles en este archivo.",
  "GoHostlyx could not find the Bookings header row.": "GoHostlyx no encontró la fila de encabezados de Bookings.",
  "GoHostlyx could not find the Expenses header row.": "GoHostlyx no encontró la fila de encabezados de Expenses.",
  "GoHostlyx could not find the selected header row for manual mapping.":
    "GoHostlyx no encontró la fila de encabezados elegida para el mapeo manual.",
  "GoHostlyx could not find the selected sheet for manual mapping.": "GoHostlyx no encontró la hoja elegida para el mapeo manual.",
  "GoHostlyx could not read the manual column mapping.": "GoHostlyx no pudo leer el mapeo manual de columnas.",
  "GoHostlyx could not read the row fixes from this import review.": "GoHostlyx no pudo leer las correcciones de filas de esta revisión.",
  "GoHostlyx could not resolve that iCal host.": "GoHostlyx no pudo encontrar el servidor de ese iCal.",
  "GoHostlyx could not send the verification email right now.": "GoHostlyx no pudo enviar el email de verificación ahora mismo.",
  "GoHostlyx could not send your message right now. Please try again or email hello@gohostlyx.com directly.":
    "GoHostlyx no pudo enviar tu mensaje ahora mismo. Inténtalo de nuevo o escribe a hello@gohostlyx.com.",
  "Import not found.": "No se encontró la importación.",
  "Invalid booking id.": "Identificador de reserva no válido.",
  "Invalid expense id.": "Identificador de gasto no válido.",
  "Invalid feed id.": "Identificador de calendario no válido.",
  "Invalid property id.": "Identificador de propiedad no válido.",
  "Invalid request body.": "Solicitud no válida.",
  "Name, email, and message are required.": "Nombre, email y mensaje son obligatorios.",
  "No valid rows were found in the workbook.": "No se encontraron filas válidas en el archivo.",
  "Only CSV or Excel files are supported for import preview.": "Solo se admiten archivos CSV o Excel para la vista previa.",
  "Paste the public iCal URL first.": "Pega primero la URL pública del iCal.",
  "Primary listing": "Listing principal",
  "Property deleted successfully.": "Propiedad eliminada.",
  "Property not found.": "No se encontró la propiedad.",
  "Stripe billing is not configured yet.": "La facturación con Stripe aún no está configurada.",
  "Stripe checkout could not be created.": "No se pudo abrir el pago con Stripe.",
  "That file is too large. Imports are limited to 4 MB. Export a shorter date range and try again.":
    "El archivo es demasiado grande. El límite es de 4 MB. Exporta un rango de fechas más corto e inténtalo de nuevo.",
  "That iCal URL points to a non-public address.": "Esa URL de iCal apunta a una dirección no pública.",
  "That iCal feed is too large to import.": "Ese calendario iCal es demasiado grande para importarlo.",
  "That iCal feed took too long to respond. Try again in a moment.": "Ese calendario iCal tardó demasiado en responder. Inténtalo de nuevo en un momento.",
  "That listing no longer exists on the property.": "Ese listing ya no existe en la propiedad.",
  "That property already exists.": "Esa propiedad ya existe.",
  "That property no longer exists.": "Esa propiedad ya no existe.",
  "That unit already exists for this property.": "Ese listing ya existe en esta propiedad.",
  "That verification code has expired. Request a new one.": "Ese código de verificación ha caducado. Pide uno nuevo.",
  "That verification code is incorrect.": "Ese código de verificación no es correcto.",
  "The Bookings sheet is empty.": "La hoja Bookings está vacía.",
  "The Expenses sheet is empty.": "La hoja Expenses está vacía.",
  "The account could not be created.": "No se pudo crear la cuenta.",
  "The admin action could not be completed.": "No se pudo completar la acción de administración.",
  "The billing portal could not be opened.": "No se pudo abrir el portal de facturación.",
  "The booking could not be deleted.": "No se pudo eliminar la reserva.",
  "The booking could not be saved.": "No se pudo guardar la reserva.",
  "The booking could not be updated.": "No se pudo actualizar la reserva.",
  "The booking review state could not be updated.": "No se pudo actualizar el estado de revisión de la reserva.",
  "The business settings could not be saved.": "No se pudieron guardar los ajustes del negocio.",
  "The duplicate check could not be completed.": "No se pudo completar la comprobación de duplicados.",
  "The expense could not be deleted.": "No se pudo eliminar el gasto.",
  "The expense could not be saved.": "No se pudo guardar el gasto.",
  "The expense could not be updated.": "No se pudo actualizar el gasto.",
  "The file could not be processed.": "No se pudo procesar el archivo.",
  "The iCal URL is not valid.": "La URL de iCal no es válida.",
  "The iCal feed could not be disconnected.": "No se pudo desconectar el calendario iCal.",
  "The iCal feed could not be imported.": "No se pudo importar el calendario iCal.",
  "The iCal feed could not be synced.": "No se pudo sincronizar el calendario iCal.",
  "The iCal feed is missing its id.": "Al calendario iCal le falta su identificador.",
  "The import could not be deleted.": "No se pudo eliminar la importación.",
  "The onboarding preview could not be loaded.": "No se pudo cargar la vista previa.",
  "The primary admin account cannot be deleted.": "La cuenta de administración principal no se puede eliminar.",
  "The primary admin account cannot lose access.": "La cuenta de administración principal no puede perder el acceso.",
  "The property could not be created.": "No se pudo crear la propiedad.",
  "The property could not be deleted.": "No se pudo eliminar la propiedad.",
  "The property could not be updated.": "No se pudo actualizar la propiedad.",
  "The saved iCal feeds could not be refreshed.": "No se pudieron actualizar los calendarios iCal guardados.",
  "The subscription checkout could not be created.": "No se pudo abrir el pago de la suscripción.",
  "The tax estimation settings could not be saved.": "No se pudieron guardar los ajustes de impuestos.",
  "The unit could not be created.": "No se pudo crear el listing.",
  "The user could not be deleted.": "No se pudo eliminar el usuario.",
  "The verification could not be completed.": "No se pudo completar la verificación.",
  "There is no billing account for this workspace yet.": "Este espacio de trabajo aún no tiene cuenta de facturación.",
  "This account does not have an active verification code.": "Esta cuenta no tiene un código de verificación activo.",
  "This email is not approved for this GoHostlyx workspace.": "Este email no está aprobado para este espacio de GoHostlyx.",
  "This file needs attention before GoHostlyx can import it.": "Este archivo necesita revisión antes de que GoHostlyx pueda importarlo.",
  "This iCal feed is no longer active.": "Este calendario iCal ya no está activo.",
  "This payout statement still needs one more review before GoHostlyx can import it.":
    "Este extracto de payout necesita una revisión más antes de que GoHostlyx pueda importarlo.",
  "This property still has linked imports, bookings, closed days, calendar feeds, or expenses. Confirm destructive delete to remove everything tied to it.":
    "Esta propiedad todavía tiene importaciones, reservas, días cerrados, calendarios o gastos vinculados. Confirma el borrado para eliminar todo lo que depende de ella.",
  "Too many attempts. Wait a few minutes and try again.": "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
  "Too many messages. Please try again later.": "Demasiados mensajes. Inténtalo más tarde.",
  "Too many sign-in attempts. Please wait a few minutes.": "Demasiados intentos de inicio de sesión. Espera unos minutos.",
  "Too many sign-up attempts. Please try again later.": "Demasiados intentos de registro. Inténtalo más tarde.",
  Unauthorized: "No autorizado",
  "Use a password with at least 8 characters.": "Usa una contraseña de al menos 8 caracteres.",
  "Use an http or https iCal URL.": "Usa una URL de iCal que empiece por http o https.",
  "User deleted.": "Usuario eliminado.",
  "We could not find a pending account for that email.": "No encontramos una cuenta pendiente con ese email.",
  "We couldn’t fully recognize your file. Map your columns in a few seconds to continue.":
    "No pudimos reconocer del todo tu archivo. Asigna tus columnas en unos segundos para continuar.",
  "We sent a verification code to your email. Enter it to finish creating your account.":
    "Te enviamos un código de verificación por email. Escríbelo para terminar de crear tu cuenta.",
  "Your email is already verified. You can sign in now.": "Tu email ya está verificado. Ya puedes iniciar sesión.",
  "That item is no longer in Recently deleted.": "Ese elemento ya no está en Eliminado recientemente.",
  "The item could not be restored.": "No se pudo recuperar el elemento.",
  "The export could not be created.": "No se pudo crear la exportación.",
  "Your trial has ended. Choose a plan to keep using GoHostlyx.": "Tu prueba ha terminado. Elige un plan para seguir usando GoHostlyx.",
  "Something went wrong. Please try again.": "Algo salió mal. Inténtalo de nuevo.",
  "The database is not reachable right now. Please try again in a moment.":
    "La base de datos no responde ahora mismo. Inténtalo de nuevo en un momento.",
};

const plural = (count: string, singular: string, pluralForm: string) => (count === "1" ? singular : pluralForm);

/** Messages with values inside them. */
const spanishPatterns: Array<[RegExp, (...groups: string[]) => string]> = [
  [/^(.*) Review it before relying on the calendar link\.$/, (rest) => `${localizeMessage(rest, "es")} Revísalo antes de fiarte del enlace del calendario.`],
  [/^Booking for (.+) added successfully\.$/, (guest) => `Reserva de ${guest} añadida.`],
  [/^Booking for (.+) updated successfully\.$/, (guest) => `Reserva de ${guest} actualizada.`],
  [
    /^Deleted (.+) from (.+)\. Removed the data linked to that import batch\.$/,
    (file, property) => `Se eliminó ${file} de ${property}, junto con los datos de esa importación.`,
  ],
  [/^Expense "(.+)" added successfully\.$/, (description) => `Gasto "${description}" añadido.`],
  [/^Expense "(.+)" updated successfully\.$/, (description) => `Gasto "${description}" actualizado.`],
  [/^GoHostlyx could not read these financial values clearly: (.+)\.$/, (fields) => `GoHostlyx no pudo leer bien estos importes: ${fields}.`],
  [
    /^GoHostlyx skipped (\d+) rows? because the dates were missing or incomplete\.$/,
    (count) => `GoHostlyx omitió ${count} ${plural(count, "fila", "filas")} porque faltaban fechas o estaban incompletas.`,
  ],
  [
    /^Imported (\d+) bookings and (\d+) expenses into (.+)\.$/,
    (bookings, expenses, property) => `Se importaron ${bookings} reservas y ${expenses} gastos en ${property}.`,
  ],
  [/^Imported 1 payout statement into (.+)\.$/, (property) => `Se importó 1 extracto de payout en ${property}.`],
  [/^Listing "(.+)" created successfully\.$/, (name) => `Listing "${name}" creado.`],
  [/^Property "(.+)" created successfully\.$/, (name) => `Propiedad "${name}" creada.`],
  [/^Property renamed to "(.+)"\.$/, (name) => `Propiedad renombrada a "${name}".`],
  [
    /^Saved (.+)\. GoHostlyx will now use (.+) as the default reporting market when all countries are selected\.$/,
    (business, country) => `${business} guardado. GoHostlyx usará ${country} como mercado por defecto cuando veas todos los países.`,
  ],
  [
    /^Saved feed and synced (\d+) iCal events? for (.+)\.$/,
    (count, listing) =>
      `Calendario guardado: ${count} ${plural(count, "evento sincronizado", "eventos sincronizados")} para ${
        listing === "Primary listing" ? "Listing principal" : listing
      }.`,
  ],
  [/^Saved tax defaults for (.+)\.$/, (country) => `Impuestos por defecto guardados para ${country}.`],
  [/^Some dates could not be read cleanly: (.+)\.$/, (fields) => `Algunas fechas no se pudieron leer bien: ${fields}.`],
  [/^Some dates may be ambiguous: (.+)\.$/, (fields) => `Algunas fechas pueden ser ambiguas: ${fields}.`],
  [/^Some optional values looked inconsistent: (.+)\.$/, (fields) => `Algunos valores opcionales parecían incoherentes: ${fields}.`],
  [/^Synced (\d+) events? just now\.$/, (count) => `${count} ${plural(count, "evento sincronizado", "eventos sincronizados")} ahora mismo.`],
  [/^Restored (.+)\.$/, (label) => `Se recuperó ${label}.`],
  [
    /^A property called "(.+)" already exists\. Rename it, then restore again\.$/,
    (name) => `Ya existe una propiedad llamada "${name}". Cámbiale el nombre y vuelve a recuperar.`,
  ],
  [/^Updated subscription to (.+)\.$/, (plan) => `Suscripción cambiada a ${plan}.`],
  [
    /^Deleted (.+) and removed (\d+) imports, (\d+) bookings, and (\d+) expenses\. No properties remain in this workspace\.$/,
    (property, imports, bookings, expenses) =>
      `Se eliminó ${property} con ${imports} importaciones, ${bookings} reservas y ${expenses} gastos. Ya no quedan propiedades en este espacio.`,
  ],
  [
    /^Deleted (.+) and removed (\d+) imports, (\d+) bookings, and (\d+) expenses linked to it\.$/,
    (property, imports, bookings, expenses) =>
      `Se eliminó ${property} con ${imports} importaciones, ${bookings} reservas y ${expenses} gastos vinculados.`,
  ],
];

export function localizeMessage(text: string, locale: AppLocale): string {
  if (locale !== "es" || !text) {
    return text;
  }

  const exact = spanishMessages[text];
  if (exact) {
    return exact;
  }

  for (const [pattern, translate] of spanishPatterns) {
    const match = text.match(pattern);
    if (match) {
      return translate(...match.slice(1));
    }
  }

  return text;
}

/** NextResponse.json, with the `error` and `message` fields in the user's language. */
export async function localizedJson(body: unknown, init?: ResponseInit) {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const locale = await getRequestLocale();
    const record = body as Record<string, unknown>;
    const translated: Record<string, unknown> = { ...record };

    for (const key of ["error", "message"]) {
      if (typeof record[key] === "string") {
        translated[key] = localizeMessage(record[key] as string, locale);
      }
    }

    return NextResponse.json(translated, init);
  }

  return NextResponse.json(body, init);
}
