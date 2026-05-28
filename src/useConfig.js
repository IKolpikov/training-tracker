// React hook over the configStore. Re-renders the component whenever setConfig() fires.

import { useEffect, useState } from "react";
import { getConfig, subscribeConfig } from "./data/configStore.js";

export function useConfig() {
  const [cfg, setCfg] = useState(getConfig);
  useEffect(() => subscribeConfig(setCfg), []);
  return cfg;
}
