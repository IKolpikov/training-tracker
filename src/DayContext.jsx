import { createContext, useContext } from "react";

export const DayContext = createContext(null);
export const useDay = () => useContext(DayContext);
