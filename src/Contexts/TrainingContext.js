// src/Contexts/TrainingContext.js
// Lightweight context + hook ONLY — deliberately imports nothing from the data
// layer. Components on the public homepage (notably Footer) read training state
// via useTraining(); keeping this module data-free means importing it does NOT
// pull Supabase/dataService into the marketing bundle.
//
// The Provider that actually fetches sessions lives in TrainingProvider.js and
// is imported only by MainApp (which is already lazy-loaded). On public pages
// there's no Provider, so useTraining() returns TRAINING_DEFAULT (inert), and
// the footer shows its plain "Training" link.

import { createContext, useContext } from "react";

export const TRAINING_DEFAULT = {
  todaySession: null,
  buttonState: "unavailable",
  now: 0,
  popupOpen: false,
  openPopup: () => {},
  closePopup: () => {},
  minimized: false,
  minimize: () => {},
  footerButtonRef: { current: null },
  getCount: () => 0,
  isAdded: () => false,
  trackCalendarAdd: () => {},
};

export const TrainingContext = createContext(TRAINING_DEFAULT);

export const useTraining = () => useContext(TrainingContext);
