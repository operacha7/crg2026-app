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
};

// Helper function to get icon component by name
export function getIconByName(iconName) {
  return iconMap[iconName] || null;
}
