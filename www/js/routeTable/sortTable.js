export function sortTableByColumn(table, columnIndex, asc = true) {
  const dirModifier = asc ? 1 : -1;
  const tBody = table.tBodies[0];
  const rows = Array.from(tBody.querySelectorAll("tr"));

  const sortedRows = rows.sort((a, b) => {
      let aColText = a.cells[columnIndex].textContent.trim();
      let bColText = b.cells[columnIndex].textContent.trim();

      // Detect and convert data types for comparison
      let aValue = convertData(aColText, columnIndex);
      let bValue = convertData(bColText, columnIndex);

      if (typeof aValue === "number" && typeof bValue === "number") {
          return (aValue - bValue) * dirModifier;
      } else if (typeof aValue === "boolean" && typeof bValue === "boolean") {
          return (aValue === bValue ? 0 : aValue ? -1 : 1) * dirModifier;
      } else if (aValue instanceof Date && bValue instanceof Date) {
          return (aValue - bValue) * dirModifier;
      } else {
          return aValue.localeCompare(bValue, undefined, { numeric: true }) * dirModifier;
      }
  });

  while (tBody.firstChild) {
      tBody.removeChild(tBody.firstChild);
  }
  tBody.append(...sortedRows);
  table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
  if (asc) {
      table.querySelector(`th:nth-child(${columnIndex + 1})`).classList.add("th-sort-asc");
  } else {
      table.querySelector(`th:nth-child(${columnIndex + 1})`).classList.add("th-sort-desc");
  }
}

function convertData(data, columnIndex) {
    switch (columnIndex) {
        case 0:
            return new Date(data);
        case 1:
            return new Date(data);
        case 2: // Price (Numeric)
            return parseFloat(data.replace(/[^0-9.]/g, ''));
        case 4: // Direct (Boolean)
            return data === '✓';
        case 5: // Stops (Numeric)
            return parseInt(data);
        case 7: // Duration (hh mm)
            const [hours, minutes] = data.split('h ');
            return parseInt(hours) * 60 + parseInt(minutes.replace('m', ''));
        case 3: // Airlines, Layovers, Route (Text)
        case 6:
        case 8:
        default:
            return data;
    }
}