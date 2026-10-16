export type ReportItem = { reportSize?: number; reportCount?: number };
export type Report = {
  reportId: number | null;
  bitLength: number | null;
  byteLength: number | null;
  items: ReportItem[];
};
export type Collection = {
  usagePage: number | null;
  usage: number | null;
  type: number | null;
  inputReports: Report[];
  outputReports: Report[];
  featureReports: Report[];
  children: Collection[];
};
export type DeviceSnapshot = {
  productName: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  error: string | null;
  collections: Collection[];
};

export const hex = (value: number | null) => value === null ? 'Desconhecido' : `0x${value.toString(16).padStart(4, '0').toUpperCase()}`;

export function flattenCollections(collections: Collection[]): Collection[] {
  return collections.flatMap(collection => [collection, ...flattenCollections(collection.children)]);
}

export function summarizeCollections(collections: Collection[]) {
  const all = flattenCollections(collections);
  return {
    collections: all.length,
    vendorCollections: all.filter(c => c.usagePage !== null && c.usagePage >= 0xff00).length,
    inputReports: all.flatMap(c => c.inputReports).length,
    outputReports: all.flatMap(c => c.outputReports).length,
    featureReports: all.flatMap(c => c.featureReports).length,
  };
}
