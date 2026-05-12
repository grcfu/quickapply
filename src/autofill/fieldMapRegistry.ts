import { greenhouseFieldMap } from "./greenhouseFields";
import { leverFields } from "./leverFields";
import type { GreenhouseFieldDef } from "./greenhouseFields";

export type FieldMap = Record<string, GreenhouseFieldDef>;

type Adapter = {
  hostSuffix: string;
  fieldMap: FieldMap;
};

const adapters: Adapter[] = [
  { hostSuffix: "greenhouse.io", fieldMap: greenhouseFieldMap },
  { hostSuffix: "lever.co", fieldMap: leverFields },
];

export function getFieldMapForHost(hostname: string): FieldMap | null {
  for (const a of adapters) {
    if (hostname === a.hostSuffix || hostname.endsWith(`.${a.hostSuffix}`)) {
      return a.fieldMap;
    }
  }
  return null;
}
