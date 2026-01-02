// src/Utility/Translate.js
import { useLanguage } from '../Contexts/LanguageContext';

// All UI translations in one place
const uiTranslations = {
  "tTitle": {
    "english": "Community Resources Guide Houston",
    "spanish": "Guía de Recursos Comunitarios de Houston"
  },
  "tZipCode": {
    "english": "Zip Code",
    "spanish": "Código Postal"
  },
  "tOrganization": {
    "english": "Organization",
    "spanish": "Organización"
  },
  "tSearch": {
    "english": "Search",
    "spanish": "Buscar"
  },
  "tMenuSendEmail": {
    "english": "Send Email",
    "spanish": "Enviar Correo Electrónico"
  },
  "tMoreAssistance": {
    "english": "More Assistance",
    "spanish": "Más Asistencia"
  },
  "tClearAll": {
    "english": "Clear All",
    "spanish": "Borrar Todo"
  },
  "tMoreOptions": {
    "english": "More options",
    "spanish": "Más opciones"
  },
  "tAddress": {
    "english": "Address",
    "spanish": "Dirección"
  },
  "tTelephone": {
    "english": "Telephone",
    "spanish": "Teléfono"
  },
  "tHours": {
    "english": "Hours",
    "spanish": "Horario"
  },
  "tAssistance": {
    "english": "Assistance",
    "spanish": "Asistencia"
  },
  "tStatus": {
    "english": "Status",
    "spanish": "Estado"
  },
  "tRequirements": {
    "english": "Requirements",
    "spanish": "Requisitos"
  },
  "tSelectZipCode": {
  "english": "Select a Zip Code",
  "spanish": "Códigos Postales"
},
"tPleaseSelectZipCode": {
  "english": "Please Select a Zip Code to Initiate a Search",
  "spanish": "Seleccione un código postal para iniciar una búsqueda"
},
"tResultsWillAppearAfterSelection": {
  "english": "Results will appear here after you select a zip code.",
  "spanish": "Los resultados aparecerán aquí después de seleccionar un código postal."
},
"tPleaseSelectOrganization": {
  "english": "Please Select an Organization",
  "spanish": "Por favor seleccione una organización"
},
"tResultsWillAppearAfterSelectionOrg": {
  "english": "Results will appear here after you select an organization.",
  "spanish": "Los resultados aparecerán aquí después de seleccionar una organización."
},
"tPleaseSelectSearchCriteria": {
  "english": "Please Enter at Least One Search Criteria",
  "spanish": "Por favor ingrese al menos un criterio de búsqueda"
},
"tResultsWillAppearAfterSelectionGeneral": {
  "english": "Results will appear here after you make at least one search criteria.",
  "spanish": "Los resultados aparecerán aquí después de realizar al menos un criterio de búsqueda."
},
"tAllZipCodes": {
  "english": "All Zip Codes",
  "spanish": "Todos los Códigos Postales"
},
"tAllOrganizations": {
  "english": "All Organizations",
  "spanish": "Todas las Organizaciones"
},
"tSearchAnyField": {
  "english": "Search any field...",
  "spanish": "Buscar en cualquier campo..."
},
"tFilters": {
  "english": "Filters",
  "spanish": "Filtros"
},
"tAllAssistance": {
  "english": "All Assistance",
  "spanish": "Toda la Asistencia"
},
"tDayOfOperation": {
  "english": "Day of Operation",
  "spanish": "Día de Operación"
},
"tAllDays": {
  "english": "All Days",
  "spanish": "Todos los Días"
},
"tNoAdditionalAssistance": {
  "english": "No additional assistance types available",
  "spanish": "No hay tipos de asistencia adicionales disponibles"
},
"tNote": {
  "english": "Note",
  "spanish": "Nota"
},
"tDoNotReply": {
  "english": "DO NOT REPLY",
  "spanish": "NO RESPONDA"
},
"tEmailNotMonitored": {
  "english": "Email is not monitored.",
  "spanish": "El correo electrónico no está supervisado."
},
"tGreetings": {
  "english": "Greetings",
  "spanish": "Saludos"
},
"tEmailIntroduction": {
  "english": "The following organizations may be able to provide the assistance you are seeking. Please contact them directly to confirm availability and requirements.",
  "spanish": "Las siguientes organizaciones pueden proporcionar la asistencia que está buscando. Por favor contáctelos directamente para confirmar disponibilidad y requisitos."
},
"tHopeThisHelps": {
  "english": "Hope this helps.",
  "spanish": "Espero que esto ayude."
},
"tUnknownOrganization": {
  "english": "Unknown Organization",
  "spanish": "Organización Desconocida"
},
"tSelectOrganization": {
  "english": "Select Organization",
  "spanish": "Seleccionar Organización"
},
"tEnterPassCode": {
  "english": "Enter PassCode",
  "spanish": "Ingrese el Código de Acceso"
},
"tLogin": {
  "english": "Log in",
  "spanish": "Acceso"
},
"tCommunityResources": {
  "english": "Community Resources",
  "spanish": "Recursos Comunitarios"
},
"tPreviewEmailConfirm": {
  "english": "Preview email instead of sending?",
  "spanish": "¿Ver vista previa del correo en lugar de enviar?"
},
"tEmailFailedToSend": {
  "english": "❌ Email failed to send.",
  "spanish": "❌ El correo electrónico no se pudo enviar."
},
"tErrorSendingEmail": {
  "english": "🚨 Error sending email",
  "spanish": "🚨 Error al enviar el correo electrónico"
},
"tLimitedInactiveResources": {
  "english": "Inactive Resources",
  "spanish": "Recursos Inactivos"
},
"tLimitedInactiveWarning": {
  "english": "You have selected an organization listed as Inactive. Please Return and correct.",
  "spanish": "Ha seleccionado una organización que figura como inactiva. Por favor, devuélvala y corríjala."
},
"tContinue": {
  "english": "Continue",
  "spanish": "Continuar"
},
"tReturn": {
  "english": "Return",
  "spanish": "Regresar"
},
"tSendSelectedResources": {
  "english": "Send Selected Resources",
  "spanish": "Enviar Recursos Seleccionados"
},
"tRecipientEmail": {
  "english": "Recipient Email",
  "spanish": "Correo del Destinatario"
},
"tCancel": {
  "english": "Cancel",
  "spanish": "Cancelar"
},
"tSending": {
  "english": "Sending ...",
  "spanish": "Enviando ..."
},
"tSend": {
  "english": "Send",
  "spanish": "Enviar"
},
"tSelectRecordsForEmail": {
  "english": "Please select at least one record to send email.",
  "spanish": "Por favor, seleccione al menos un registro para enviar el correo electrónico."
},
"tEmailSentSuccessfully": {
  "english": "Email sent successfully.",
  "spanish": "Correo electrónico enviado con éxito."
},
"tCreatePdf": {
  "english": "Create PDF",
  "spanish": "Crear PDF"
},
"tCreatingPdf": {
  "english": "Creating ...",
  "spanish": "Creando ..."
},
"tCreate": {
  "english": "Create",
  "spanish": "Crear"
},
"tSelectRecordsForPdf": {
  "english": "Please select at least one record to create a PDF.",
  "spanish": "Seleccione al menos un registro para crear un PDF."
},
"tPdfCreatedSuccessfully": {
  "english": "PDF created successfully in your Download Folder.",
  "spanish": "PDF creado exitosamente en su carpeta de descargas."
},
"tSearchCriteria": {
  "english": "Selection",
  "spanish": "Selección"
},
"tGenerated": {
  "english": "Generated",
  "spanish": "Generado"
},
"tBy": {
  "english": "By",
  "spanish": "Por"
},
"tPdfWarning": {
  "english": "IMPORTANT: This information was current as of the generated date listed above. For the most up-to-date resources, hours, and contact information, please visit the online Community Resources Guide website.",
  "spanish": "IMPORTANTE: Esta información estaba vigente a la fecha de generación indicada anteriormente. Para consultar los recursos, horarios e información de contacto más actualizados, visite el sitio web de la Guía de Recursos Comunitarios."
},
"tPage": {
  "english": "Page",
  "spanish": "Página"
},
"tEmailNotAuthorized": {
  "english": "Authorization required to send an email.  Please contact Support.",
  "spanish": "Se requiere autorización para enviar un correo electrónico. Contacte con el equipo de soporte."
},
"tEmailLimitReached": {
  "english": "Monthly email limits reached.  Please contact Support.",
  "spanish": "Se alcanzó el límite mensual de correos electrónicos. Contacte con el soporte técnico."
},
"tPdfNotAuthorized": {
  "english": "Authorization required to create a PDF.  Please contact Support.",
  "spanish": "Se requiere autorización para crear un PDF. Contacte con el equipo de soporte."
},
"tPdfLimitReached": {
  "english": "Monthly PDF limits reached.  Please contact Support.",
  "spanish": "Se alcanzó el límite mensual de PDF. Contacte con el soporte técnico."
},
"tSearchRequirements": {
  "english": "Search Requirements",
  "spanish": "Buscar Requisitos"
},
"tExcludeMatchingRecords": {
  "english": "Exclude matching records",
  "spanish": "Excluir registros coincidentes"
},
"tSearchByRquirementsPlaceholder": {
  "english": "FreeForm search of the Requirements Column",
  "spanish": "Búsqueda de formato libre en la Columna Requisitos"
},
"tSearchByOrgLocation": {
  "english": "Search By Organization Location",
  "spanish": "Buscar por Ubicación de Organización"
},
"tSearchByOrgLocationPlaceholder": {
  "english": "Search By Org Location (Zip Code, City or Neighborhood)",
  "spanish": "Buscar por Ubicación de Org (Código Postal, Ciudad o Vecindario)"
},
"tRightsReservedPdf": {
  "english": "All Rights Reserved.  crghouston.org",
  "spanish": "Reservados Todos los Derechoses.  crghouston.org"
},
"tRightsReserved": {
  "english": "All Rights Reserved.",
  "spanish": "Reservados Todos los Derechoses."
},
"tReports": {
  "english": "Reports",
  "spanish": "Informes"
},
"tManual": {
  "english": "Instruction Manual",
  "spanish": "Manual de Instrucciones"
},
"tPrivacyPolicy": {
  "english": "Privacy Policy",
  "spanish": "Política de Pivacidad"
},
"tTermsOfService": {
  "english": "Terms of Service",
  "spanish": "Términos de Servicio"
},
"tSupport": {
  "english": "Contact Support",
  "spanish": "Contactar con Soporte"
},
"tMonday": {
  "english": "Monday",
  "spanish": "Lunes"
},
"tTuesday": {
  "english": "Tuesday",
  "spanish": "Martes"
},
"tWednesday": {
  "english": "Wednesday",
  "spanish": "Miércoles"
},
"tThursday": {
  "english": "Thursday",
  "spanish": "Jueves"
},
"tFriday": {
  "english": "Friday",
  "spanish": "Viernes"
},
"tSaturday": {
  "english": "Saturday",
  "spanish": "Sábado"
},
"tSunday": {
  "english": "Sunday",
  "spanish": "Domingo"
},
"tNext": {
  "english": "Next",
  "spanish": "Próximo"
},
"tPrevious": {
  "english": "Previous",
  "spanish": "Previo"
},
"tDone": {
  "english": "Done",
  "spanish": "Hecho"
},
"tClose": {
  "english": "Close",
  "spanish": "Cerrado"
},
"tHelp": {
  "english": "Help",
  "spanish": "Ayuda"
},
"tMessages": {
  "english": "Messages",
  "spanish": "Mensajes"
},
"tNoMessages": {
  "english": "No messages available",
  "spanish": "No hay mensajes disponibles"
},
"tReadMore": {
  "english": "Read More",
  "spanish": "Leer más"
},
"tShowLess": {
  "english": "Show Less",
  "spanish": "Mostrar menos"
},
"tActive": {
  "english": "Active",
  "spanish": "Activo"
},
"tInactive": {
  "english": "Inactive",
  "spanish": "Inactivo"
},
"tExpired": {
  "english": "Expired",
  "spanish": "Vencido"
},
"tScheduled": {
  "english": "Scheduled",
  "spanish": "Programado"
},
"tOK": {
  "english": "OK",
  "spanish": "OK"
},
"tourDescriptionZipCode": {
  "english": "Click inside the box and select from the dropdown.  You can either scroll to your zip code or start entering the zip code and it will start scrolling to it.",
  "spanish": "Haga clic dentro del cuadro y seleccione en el menú desplegable.  Puede desplazarse hasta su código postal o comenzar a ingresar el código postal y comenzará a desplazarse hacia él."
},
"tourDescriptionAssistance": {
  "english": "Click to select and click again to deselect.  Click on More options for a sidebar with additional assistance options.  Sidebar will open on the right.",
  "spanish": "Haga clic para seleccionar y haga clic nuevamente para anular la selección.  Haga clic en Más opciones para ver una barra lateral con opciones de asistencia adicionales.  La barra lateral se abrirá a la derecha."
},
"tourDescriptionResults": {
  "english": "Total number of records displayed.  Will change as you filter the results.  When you start selecting records to email, a second circle, blue this time, will popup next to the orange one, showing the number of records selected.",
  "spanish": "Número total de registros mostrados.  Cambiará a medida que filtre los resultados.  Cuando comience a seleccionar registros para enviar por correo electrónico, aparecerá un segundo círculo, esta vez azul, junto al naranja, que muestra la cantidad de registros seleccionados."
},
"tourDescriptionRecord": {
  "english": "In this column, check all the records you want to send in an email then click the gold Send Email button in the menu bar; above, right side.",
  "spanish": "En esta columna, marque todos los registros que desea enviar en un correo electrónico y luego haga clic en el botón dorado Enviar correo electrónico en la barra de menú; arriba, lado derecho."
},
"tourDescriptionStatus": {
  "english": "I periodically review the status of an organization to determine if they are still active and the results of this determination are posted here.  Limited means Active but with limitations which are documented in comments.  If there are any comments about the status, a chevron will be displayed in the button.  Click on the chevron to see the comments,  Click again to close.  The date in the comment indicates the last time the organization was verified.  A blank, gray status means a determination could not be made one way or the other.  No organization is excluded from a search.  The results are prioritized with Active on top, Limited next and Inactive on the bottom.",
  "spanish": "Reviso periódicamente el estado de una organización para determinar si todavía está activa y los resultados de esta determinación se publican aquí.  Limitado significa Activo pero con limitaciones que están documentadas en los comentarios.  Si hay algún comentario sobre el estado, se mostrará un galón en el botón.  Haga clic en el galón para ver los comentarios. Haga clic nuevamente para cerrar.  La fecha en el comentario indica la última vez que se verificó la organización.  Un estado gris y en blanco significa que no se pudo tomar una determinación en un sentido u otro.  Ninguna organización queda excluida de una búsqueda.  Los resultados se priorizan con Activo en la parte superior, Limitado a continuación e Inactivo en la parte inferior."
},
"tourDescriptionRequirements": {
  "english": "Only a certain amount of information is displayed automatically in the Requirements column.  If there is additional information, it is indicated by an orange chevron.  Click on it to expand the row and display the rest of the information.  The same is true for the Zip Code column which is next to Requirements.",
  "spanish": "Solo una cierta cantidad de información se muestra automáticamente en la columna Requisitos.  Si hay información adicional, se indica con un galón naranja.  Haga clic en él para expandir la fila y mostrar el resto de la información.  Lo mismo ocurre con la columna Código postal que está al lado de Requisitos."
},
"tourDescriptionLanguageToggle": {
  "english": "Each organization has a default language that can be set to English or Spanish.  The default language is activated when you log in.  After logging in, you can toggle languages at any time by clicking on this button.  If you are in Spanish content, any emails sent out will also be in Spanish.",
  "spanish": "Cada organización tiene un idioma predeterminado que se puede configurar en inglés o español.  El idioma predeterminado se activa cuando inicia sesión. Después de iniciar sesión, puede alternar idiomas en cualquier momento haciendo clic en este botón.  Si tiene contenido en español, todos los correos electrónicos enviados también estarán en español."
},
"tourDescriptionFooterLinks": {
  "english": "Links to other pages.  Reports are various graphical and tabular reports of usage data.  Privacy Policy documents the site's policy on collecting, storing and disclosing data.  Terms of Service are standard terms for use of this website.  The Instruction Manual is a PDF document with screen snapshots of the application and how to navigate it.  Click on Contact Support to send me an email.  Periodically, I will have a message pop up for a set number of days, right after log in.  All current and prior messages are available from this link.",
  "spanish": "Enlaces a otras páginas.  Los informes son varios informes gráficos y tabulares de datos de uso.  La Política de privacidad documenta la política del sitio sobre la recopilación, el almacenamiento y la divulgación de datos.  Los Términos de servicio son términos estándar para el uso de este sitio web.  El manual de instrucciones es un documento PDF con capturas de pantalla de la aplicación y cómo navegar por ella.  Haga clic en Contactar con soporte para enviarme un correo electrónico.  Periódicamente, aparecerá un mensaje emergente durante un número determinado de días, justo después de iniciar sesión. Todos los mensajes actuales y anteriores están disponibles en este enlace."
}

  // Add all other UI text here
};

// Hook for components to use
export const useTranslate = () => {
  const { language } = useLanguage();
  
  const translate = (key) => {
    if (!key) return "";
    
    // Check if it's a UI text key
    if (uiTranslations[key]) {
      return language === "Español" ? uiTranslations[key].spanish : uiTranslations[key].english;
    }
    
    // If no translation found, warn and return the key
    console.warn(`Translation not found for key: ${key}`);
    return key;
  };
  
  return { translate };
};