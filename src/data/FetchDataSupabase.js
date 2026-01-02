// src/data/FetchDataSupabase.js
import { useEffect, useState } from "react";
import { useLanguage } from "../Contexts/LanguageContext";
import { dataService } from "../services/dataService";

export default function useFetchCRGData() {
  // Get language from context
  const { language } = useLanguage();

  const [records, setRecords] = useState([]);
  const [zips, setZips] = useState([]);
  const [assistanceTypes, setAssistanceTypes] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [neighborhoodData, setNeighborhoodData] = useState([]);

  const [selectedZip, setSelectedZip] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    // Debug logging
    console.log(`FetchDataSupabase: Current language is: "${language}"`);
    console.log('FetchDataSupabase: Current sessionStorage:', {
      sessionLanguage: sessionStorage.getItem('sessionLanguage')
    });

    // Async function to fetch all data
    const fetchAllData = async () => {
      try {
        // Fetch resources based on language
        if (language === "Español") {
          console.log("Fetching Spanish resources from Supabase");
          const data = await dataService.getResourcesEs();
          console.log(`Loaded Spanish data from Supabase, record count:`, data.length);
          setRecords(data);
        } else {
          console.log("Fetching English resources from Supabase");
          const data = await dataService.getResourcesEn();
          console.log(`Loaded English data from Supabase, record count:`, data.length);
          setRecords(data);
        }

        // Fetch zip codes
        const zipData = await dataService.getZipCodes();
        setZips(zipData);

        // Fetch organizations
        const orgData = await dataService.getOrganizations();
        setOrganizations(orgData);

        // Fetch assistance types based on language
        if (language === "Español") {
          console.log("Fetching Spanish assistance types from Supabase");
          const assistData = await dataService.getAssistanceTypesEs();
          console.log("Loaded Spanish assistance types:", assistData);
          setAssistanceTypes(assistData);
        } else {
          console.log("Fetching English assistance types from Supabase");
          const assistData = await dataService.getAssistanceTypesEn();
          console.log("Loaded English assistance types:", assistData);
          setAssistanceTypes(assistData);
        }

        // Fetch neighborhood data
        const neighborData = await dataService.getNeighborhoods();
        console.log("LOADED NEIGHBORHOOD DATA:", neighborData);
        setNeighborhoodData(neighborData);
      } catch (error) {
        console.error("Error fetching data from Supabase:", error);
      }
    };

    // Call the fetch function
    fetchAllData();
  }, [language]); // Keep language as a dependency

  return {
    records,
    zips,
    organizations,
    assistanceTypes,
    neighborhoodData,
    selectedZip,
    setSelectedZip,
    selectedOrg,
    setSelectedOrg,
    expandedRows,
    setExpandedRows,
  };
}