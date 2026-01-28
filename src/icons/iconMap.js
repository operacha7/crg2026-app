// src/icons/iconMap.js
// Maps icon names from Supabase to actual icon components
// This allows dynamic icon loading based on the 'icon' field in the assistance table

import {
  RentIcon,
  UtilitiesIcon,
  FoodPantriesIcon,
  ClothingIcon,
  HomelessSheltersIcon,
  HomelessDayCentersIcon,
  HomelessOtherIcon,
  HousingIcon,
  MedicalPrimaryCareIcon,
  MedicalEquipmentIcon,
  MedicalMentalHealthIcon,
  MedicalAddictionRecoveryIcon,
  MedicalProgramEnrollmentIcon,
  MedicalBillPaymentIcon,
  MedicalHousingIcon,
  DomesticAbuseSheltersIcon,
  DomesticAbuseOtherIcon,
  EducationAdultsIcon,
  EducationChildrenIcon,
  ChildcareIcon,
  JobsIcon,
  TransportationIcon,
  ImmigrationIcon,
  LegalIcon,
  SeniorsIcon,
  HandymanIcon,
  AnimalsIcon,
  ChristmasIcon,
  OtherIcon,
  DentalVisionIcon,
  MedicalDentalIcon,
  MedicalVisionIcon,
} from './index';

// Map icon names (as stored in Supabase) to actual components
export const iconMap = {
  RentIcon,
  UtilitiesIcon,
  FoodPantriesIcon,
  ClothingIcon,
  HomelessSheltersIcon,
  HomelessDayCentersIcon,
  HomelessOtherIcon,
  HousingIcon,
  MedicalPrimaryCareIcon,
  MedicalEquipmentIcon,
  MedicalMentalHealthIcon,
  MedicalAddictionRecoveryIcon,
  MedicalProgramEnrollmentIcon,
  MedicalBillPaymentIcon,
  MedicalHousingIcon,
  DomesticAbuseSheltersIcon,
  DomesticAbuseOtherIcon,
  EducationAdultsIcon,
  EducationChildrenIcon,
  ChildcareIcon,
  JobsIcon,
  TransportationIcon,
  ImmigrationIcon,
  LegalIcon,
  SeniorsIcon,
  HandymanIcon,
  AnimalsIcon,
  ChristmasIcon,
  OtherIcon,
  DentalVisionIcon,
  MedicalDentalIcon,
  MedicalVisionIcon,
};

// Helper function to get icon component by name
// Supports comma-separated icon names (e.g., "MedicalDentalIcon,MedicalVisionIcon")
// Returns single component for single icon, or array of components for multiple icons
export function getIconByName(iconName) {
  if (!iconName) return null;

  // Check if multiple icons are specified (comma-separated)
  if (iconName.includes(',')) {
    const iconNames = iconName.split(',').map(name => name.trim());
    const components = iconNames
      .map(name => iconMap[name])
      .filter(Boolean);
    return components.length > 0 ? components : null;
  }

  return iconMap[iconName] || null;
}

// Helper to get icon names as an array (for tooltip display)
export function getIconNames(iconName) {
  if (!iconName) return [];
  if (iconName.includes(',')) {
    return iconName.split(',').map(name => name.trim());
  }
  return [iconName];
}
