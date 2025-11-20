export const preloadHandlebarsTemplates = async function() {
  // Define template paths to load
  // Note: You likely won't need sheet-attributes.html if you hardcode the essence grid
  // But we keep them for Item Sheets.
  const templatePaths = [
    "systems/narequenta/templates/parts/sheet-attributes.html", 
    "systems/narequenta/templates/parts/sheet-groups.html"
  ];

  return loadTemplates(templatePaths);
};