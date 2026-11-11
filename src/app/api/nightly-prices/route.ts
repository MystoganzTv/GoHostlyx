import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { getPropertyDefinitions, saveNightlyPrices } from "@/lib/db";
import { parseNightlyPriceFile } from "@/lib/nightly-prices";

export const runtime = "nodejs";

const MAX_PRICE_FILE_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB.
const CHANNELS = new Set(["Airbnb", "Booking.com", "Direct", "Vrbo"]);

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const propertyName = String(formData.get("propertyName") ?? "").trim();
    const channelValue = String(formData.get("channel") ?? "Airbnb").trim();
    const channel = CHANNELS.has(channelValue) ? channelValue : "Airbnb";

    const properties = await getPropertyDefinitions(ownerEmail);
    const property = properties.find(
      (item) => item.name.trim().toLowerCase() === propertyName.toLowerCase(),
    );

    if (!property) {
      return await localizedJson({ error: "Choose a property first." }, { status: 400 });
    }

    if (!(fileValue instanceof File) || fileValue.size <= 0) {
      return await localizedJson({ error: "Attach a price file first." }, { status: 400 });
    }

    if (fileValue.size > MAX_PRICE_FILE_BYTES) {
      return await localizedJson(
        { error: "That file is too large. Price files are limited to 4 MB." },
        { status: 400 },
      );
    }

    const prices = parseNightlyPriceFile(await fileValue.arrayBuffer(), fileValue.name);

    if (prices.length === 0) {
      return await localizedJson(
        { error: "GoHostlyx could not find a date column and a price column in this file." },
        { status: 400 },
      );
    }

    const saved = await saveNightlyPrices({
      ownerEmail,
      propertyName: property.name,
      channel,
      prices,
    });

    return await localizedJson({
      message: `Saved ${saved} nightly prices for ${property.name}, from ${prices[0].date} to ${prices.at(-1)?.date}.`,
      saved,
    });
  } catch (error) {
    return await localizedJson(
      { error: clientErrorMessage(error, "The prices could not be saved.") },
      { status: 400 },
    );
  }
}
