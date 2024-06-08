import { map } from './map.js';
import { pathDrawing } from './pathDrawing.js'; // Import pathDrawing

function showRoutePopup(event, routeData, line) {
    const { originAirport, destinationAirport, price, date } = routeData;

    let content = `<div style="line-height: 1.5;">
        <strong>Route Information</strong><br>
        <strong>From:</strong> ${originAirport.name} (${originAirport.iata_code})<br>
        <strong>To:</strong> ${destinationAirport.name} (${destinationAirport.iata_code})<br>
        <strong>Price:</strong> $${price}<br>`;

    if (date) {
        let formattedDate = new Date(date).toLocaleDateString("en-US", {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        content += `<strong>Date:</strong> ${formattedDate}<br>`;
    }

    content += `</div>`;

    console.log('Creating popup at', event.latlng, 'with content', content);
    console.log('Map instance:', map);

    // Ensure no other popups are open before creating a new one
    map.closePopup();

    // Create the popup and add event listeners after initialization
    const popup = L.popup({ autoClose: false, closeOnClick: true })
        .setLatLng(event.latlng)
        .setContent(content)
        .on('remove', function () {
            console.log('Popup removed');
            if (line) {
                map.removeLayer(line);
            }
            pathDrawing.popupFromClick = false; // Reset flag on popup removal
        })
        .on('add', function () {
            console.log('Popup added');
            // Ensure the line remains visible when the popup is added
            if (line && !map.hasLayer(line)) {
                line.addTo(map);
            }
        });

    // Open the popup on the map
    setTimeout(() => {
        popup.openOn(map);
        console.log('Popup created and added to map');
    }, 100); // Delay to avoid immediate closure by other events

    console.log('Map after adding popup:', map);
}

export { showRoutePopup };