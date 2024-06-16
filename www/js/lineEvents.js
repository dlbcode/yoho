import { map } from './map.js';
import { pathDrawing } from './pathDrawing.js';

const lineEvents = {
    // Keep track of different types of popups
    routePopups: [],
    hoverPopups: [],

    clearPopups: (type) => {
        let popups;
        switch (type) {
            case 'route':
                popups = lineEvents.routePopups;
                break;
            case 'hover':
                popups = lineEvents.hoverPopups;
                break;
            case 'all':
                popups = [...lineEvents.routePopups, ...lineEvents.hoverPopups];
                break;
            default:
                popups = [];
        }
        popups.forEach(popup => map.closePopup(popup));
        if (type !== 'all') {
            lineEvents[type + 'Popups'] = [];
        } else {
            lineEvents.routePopups = [];
            lineEvents.hoverPopups = [];
        }
    },

    showRoutePopup: (event, routeData, line) => {
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

        // Ensure no other route popups are open before creating a new one
        lineEvents.clearPopups('route');

        // Create the popup and add event listeners after initialization
        const popup = L.popup({ autoClose: false, closeOnClick: true })
            .setLatLng(event.latlng)
            .setContent(content)
            .on('remove', function () {
                if (line) {
                    map.removeLayer(line);
                }
                pathDrawing.popupFromClick = false; // Reset flag on popup removal
            })
            .on('add', function () {
                // Ensure the line remains visible when the popup is added
                if (line && !map.hasLayer(line)) {
                    line.addTo(map);
                }
                pathDrawing.popupFromClick = true; // Set flag on popup addition
            });

        // Open the popup on the map
        setTimeout(() => {
            popup.openOn(map);
        }, 100); // Delay to avoid immediate closure by other events

        // Track this popup
        lineEvents.routePopups.push(popup);
    },

    onMouseOver: (e, visibleLine, map, hoveredLine, hoverPopup, routeData, pathDrawing) => {
        if (!pathDrawing.popupFromClick) {
            if (hoveredLine && hoveredLine !== visibleLine) {
                hoveredLine.setStyle({ color: hoveredLine.originalColor });
                map.closePopup(hoverPopup);
                // Remove hover popup from the list
                lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== hoverPopup);
            }

            hoveredLine = visibleLine;
            visibleLine.setStyle({ color: 'white' });

            let displayPrice = Math.round(routeData.price || 0); // Ensure price is valid
            let city = routeData.destinationAirport && routeData.destinationAirport.city ? routeData.destinationAirport.city : 'Unknown City'; // Ensure city is valid
            let content = `<div style="line-height: 1.2; margin: 0;">${city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>`;
            if (routeData.date) {
                let lowestDate = new Date(routeData.date).toLocaleDateString("en-US", {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                content += `<br><span style="line-height: 1; display: block; color: #666">on ${lowestDate}</span>`;
            }
            content += `</div>`;

            hoverPopup = L.popup({ autoClose: false, closeOnClick: true })
                .setLatLng(e.latlng)
                .setContent(content)
                .openOn(map);

            // Track this popup
            lineEvents.hoverPopups.push(hoverPopup);
        }
    },

    onMouseOut: (visibleLine, map, hoveredLine, hoverPopup, pathDrawing) => {
        console.log('onMouseOut');
        visibleLine.setStyle({ color: visibleLine.originalColor });
        map.closePopup(hoverPopup);
        // Remove hover popup from the list
        lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== hoverPopup);
        hoveredLine = null;
        hoverPopup = null;
    },

    onClickHandler: (e, line, onClick) => {
        onClick(e, line);
    }
};

export { lineEvents };
