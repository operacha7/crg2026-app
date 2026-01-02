// src/components/LanguageSwitcher.js
import React from "react";
import { useLanguage } from "../Contexts/LanguageContext";

const LanguageSwitcher = ({ className }) => {
  const { language, toggleLanguage } = useLanguage();
  

  return (
    <button
      onClick={toggleLanguage}
      className={className || "language-switcher"}
    >
      {language === "English" ? "Español" : "English"}
    </button>
  );
};

export default LanguageSwitcher;