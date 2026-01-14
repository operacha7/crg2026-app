// src/components/GeneralSearchPage.js
import React, { useState, useMemo } from "react";
import PageLayout from "../layout/PageLayout";
import SearchResults from "../components/SearchResults";
import useFetchData from "../data/FetchData";

export default function GeneralSearchPage() {
  const { records, expandedRows, setExpandedRows } = useFetchData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);

  const normalized = (str) => (str || "").toLowerCase();

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = normalized(searchTerm);
    return records.filter((rec) => {
      return (
        normalized(rec.organization).includes(term) ||
        normalized(rec.requirements).includes(term) ||
        normalized(rec.assistance).includes(term) ||
        normalized(rec.zip_codes?.join(", ")).includes(term) ||
        normalized(rec.org_county_city_zip_neighborhood).includes(term) ||
        normalized(rec.hours).includes(term)
      );
    });
  }, [searchTerm, records]);

  const toggleExpand = (i) =>
    setExpandedRows((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <PageLayout onSendEmail={null}>
      <div className="p-6 max-w-4xl mx-auto">
        <input
          type="text"
          placeholder="Search any field..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded shadow-md text-lg"
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <SearchResults
          filtered={filtered}
          expandedRows={expandedRows}
          rowRefs={{}}
          toggleExpand={toggleExpand}
          selectedRows={selectedRows}
          setSelectedRows={setSelectedRows}
        />
      </div>
    </PageLayout>
  );
}
