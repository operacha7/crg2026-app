// src/Contexts/LanguageContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { dataService } from '../services/dataService';

// Create context
const LanguageContext = createContext({
  language: null,
  setLanguage: () => {},
  toggleLanguage: () => {},
  isLanguageLoaded: false
});

// Provider component
export function LanguageProvider({ children, loggedInUser }) {
  const [language, setLanguage] = useState(null);
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);
  
  // Set language based on session preference or user's organization
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // If no logged in user, use English and clear any stale sessionStorage
        if (!loggedInUser) {
          sessionStorage.removeItem('sessionLanguage');
          sessionStorage.removeItem('loginLanguageChoice');
          setLanguage("English");
          setIsLanguageLoaded(true);
          return;
        }
        
        // Check for login page language choice stored temporarily
        const loginLanguageChoice = sessionStorage.getItem('loginLanguageChoice');
        if (loginLanguageChoice) {
          setLanguage(loginLanguageChoice);
          sessionStorage.setItem('sessionLanguage', loginLanguageChoice);
          sessionStorage.removeItem('loginLanguageChoice');
          setIsLanguageLoaded(true);
          return;
        }
        
        // Check if user has already toggled language in this session
        const sessionLanguage = sessionStorage.getItem('sessionLanguage');
        if (sessionLanguage) {
          setLanguage(sessionLanguage);
          setIsLanguageLoaded(true);
          return;
        }
        
        // No session preference found, determine from user organization
        if (loggedInUser?.registered_organization) {
          // Try to get organization data from localStorage (set during login)
          const orgDataString = localStorage.getItem('orgData');
          
          if (orgDataString) {
            try {
              const orgData = JSON.parse(orgDataString);
              const userOrg = orgData.find(
                org => org.registered_organization === loggedInUser.registered_organization
              );
              
              if (userOrg?.org_default_language) {
                setLanguage(userOrg.org_default_language);
                sessionStorage.setItem('sessionLanguage', userOrg.org_default_language);
                setIsLanguageLoaded(true);
                return;
              }
            } catch (parseError) {
              console.error('Error parsing orgData from localStorage:', parseError);
            }
          }
          
          // If localStorage approach failed, fetch from Supabase as backup
          try {
            const data = await dataService.getRegisteredOrganizations();
            const orgRecord = data.find(
              record => record.registered_organization === loggedInUser.registered_organization
            );
            
            if (orgRecord?.org_default_language) {
              setLanguage(orgRecord.org_default_language);
              sessionStorage.setItem('sessionLanguage', orgRecord.org_default_language);
              setIsLanguageLoaded(true);
              return;
            }
          } catch (fetchError) {
            console.error('Error fetching from Supabase:', fetchError);
          }
        }
        
        // If all else fails, default to English
        setLanguage("English");
        setIsLanguageLoaded(true);
      } catch (error) {
        console.error('Error initializing language:', error);
        setLanguage("English");
        setIsLanguageLoaded(true);
      }
    };
    
    initializeLanguage();
  }, [loggedInUser]);
  
  // Toggle function - saves to sessionStorage appropriately
  const toggleLanguage = () => {
    if (!language) return;
    
    const newLanguage = language === "English" ? "Español" : "English";
    setLanguage(newLanguage);
    
    if (loggedInUser) {
      sessionStorage.setItem('sessionLanguage', newLanguage);
    } else {
      sessionStorage.setItem('loginLanguageChoice', newLanguage);
    }
  };
  
  // If language is still null (during initial load), render nothing
  if (language === null) {
    return null;
  }
  
  const value = {
    language,
    setLanguage,
    toggleLanguage,
    isLanguageLoaded
  };
  
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Custom hook to access the language context
export function useLanguage() {
  return useContext(LanguageContext);
}