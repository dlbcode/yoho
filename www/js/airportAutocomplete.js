document.addEventListener('DOMContentLoaded', (event) => {
  // Function to fetch airports from your endpoint
  async function fetchAirports(query) {
      try {
          const response = await fetch(`http://localhost:3000/airports?query=${query}`);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const airports = await response.json();
          return airports;
      } catch (error) {
          console.error('Fetch error:', error);
          return [];
      }
  }

  // Function to update suggestion dropdown
  function updateSuggestions(inputId, airports) {
      const suggestionBox = document.getElementById(inputId + 'Suggestions');
      suggestionBox.innerHTML = '';
      airports.forEach(airport => {
          const div = document.createElement('div');
          div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
          div.addEventListener('click', () => {
              // Set input value to 'city (iata_code)'
              document.getElementById(inputId).value = `${airport.city} (${airport.iata_code})`;
              suggestionBox.innerHTML = '';
          });
          suggestionBox.appendChild(div);
      });
  }

  // Event listeners for 'from' and 'to' inputs
  document.getElementById('fromAirport').addEventListener('input', async (e) => {
      const airports = await fetchAirports(e.target.value);
      updateSuggestions('fromAirport', airports);
  });

  document.getElementById('toAirport').addEventListener('input', async (e) => {
      const airports = await fetchAirports(e.target.value);
      updateSuggestions('toAirport', airports);
  });
});

function getIataFromField(inputId) {
  const fieldValue = document.getElementById(inputId).value;
  const iataCodeMatch = fieldValue.match(/\(([^)]+)\)/);
  return iataCodeMatch ? iataCodeMatch[1] : null;
}

export { getIataFromField };
