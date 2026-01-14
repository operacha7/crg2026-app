// src/data/FetchDataSupabase.js
import { useEffect, useState } from "react";
import { dataService } from "../services/dataService";

export default function useFetchCRGData() {
  const [records, setRecords] = useState([]);
  const [zips, setZips] = useState([]);
  const [assistanceTypes, setAssistanceTypes] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [neighborhoodData, setNeighborhoodData] = useState([]);

  const [selectedZip, setSelectedZip] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    // Async function to fetch all data
    const fetchAllData = async () => {
      try {
        // Fetch resources
        const data = await dataService.getResources();
        console.log(`Loaded data from Supabase, record count:`, data.length);
        setRecords(data);

        // Fetch zip codes
        const zipData = await dataService.getZipCodes();
        setZips(zipData);

        // Fetch organizations
        const orgData = await dataService.getOrganizations();
        setOrganizations(orgData);

        // Fetch assistance types
        const assistData = await dataService.getAssistanceTypes();
        console.log("Loaded assistance types:", assistData);
        setAssistanceTypes(assistData);

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
  }, []);

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
