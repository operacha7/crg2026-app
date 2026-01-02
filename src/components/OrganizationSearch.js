// src/components/OrganizationSearch.js
import React, { useMemo } from "react";
import { useTranslate } from "../Utility/Translate";

export default function OrganizationSearch({ organizations = [], selectedOrg = "", setSelectedOrg }) {
  const { translate } = useTranslate();

  // Ensure organizations is always an array and properly formatted
  const orgArray = useMemo(() => {
    if (!Array.isArray(organizations)) return [];
    return organizations;
  }, [organizations]);

  return (
    <div>
      <label className="block ml-10 mt-1 font-medium text-[0.9rem] md:text-base">
        {translate("tOrganization")}
      </label>
      <select
        value={selectedOrg}
        onChange={(e) => setSelectedOrg(e.target.value)}
        className={`w-full md:w-[56rem] border-2 px-2 py-2 md:py-1 rounded shadow-md text-left ml-10 text-[1.1rem] md:text-[1.2rem] tracking-widest ${
          selectedOrg
            ? "bg-[#efedd1] border-[#b5b270] font-medium shadow-md"
            : "bg-[#efefef] border-gray-300 shadow-sm"
        }`}
      >
        <option value="">{translate("tSelectOrganization")}</option>
        {orgArray.map((org, i) => (
          <option key={i} value={org.organization}>
            {org.organization}
          </option>
        ))}
      </select>
    </div>
  );
}