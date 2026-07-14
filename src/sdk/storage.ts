import { METADATA_KEY, EssenceData } from "../data/schema";
import { migrateData } from "../data/migrations";
import { OBR } from "./owlbear";

export type DataUpdater = (data: EssenceData) => EssenceData | Promise<EssenceData>;

export async function readData(): Promise<EssenceData> {
  const metadata = await OBR.room.getMetadata();
  return migrateData(metadata[METADATA_KEY]);
}

export async function writeData(data: EssenceData): Promise<void> {
  await OBR.room.setMetadata({ [METADATA_KEY]: data });
}

export async function updateData(updater: DataUpdater): Promise<EssenceData> {
  const latest = await readData();
  const next = await updater(latest);
  await writeData(next);
  return next;
}

export function onDataChange(callback: (data: EssenceData) => void): () => void {
  return OBR.room.onMetadataChange((metadata) => {
    callback(migrateData(metadata[METADATA_KEY]));
  });
}
