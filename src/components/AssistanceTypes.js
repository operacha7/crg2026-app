// src/components/AssistanceTypes.js

// Function to extract main assistance types from the array
export function getMainAssistance(assistanceTypes) {
  if (!assistanceTypes || !Array.isArray(assistanceTypes)) return [];
  
  // Filter the assistance types that have main set to true
  return assistanceTypes
    .filter(type => type.main === true)
    .map(type => type.assistance);
}

// Function to get translated assistance type
export function getTranslatedAssistance(assistanceTypes, item, currentLanguage) {
  if (!assistanceTypes || !Array.isArray(assistanceTypes)) return item;
  
  // With the new structure, we don't need translation logic here
  // as the assistanceTypes will already be in the correct language
  // Just return the item (it's already in the correct language)
  return item;
}