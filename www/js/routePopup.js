import { map } from './map.js';

function showRoutePopup(event, routeData) {
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

    L.popup()
        .setLatLng(event.latlng)
        .setContent(content)
        .openOn(map);
}

export { showRoutePopup };
