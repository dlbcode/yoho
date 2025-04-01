import { blueDotIcon, magentaDotIcon, map } from './map.js';
import { appState } from './stateManager.js';
import { flightMap } from './flightMap.js';

const mapHandling = {
    updateMarkerIcons: function () {
        // Get all IATA codes from valid routes
        const routeIataCodes = new Set();
        
        // Add all origin and destination IATAs from valid routes in routeData
        appState.routeData.forEach(route => {
            if (route && !route.isEmpty) {
                if (route.origin?.iata_code) {
                    routeIataCodes.add(route.origin.iata_code);
                }
                if (route.destination?.iata_code) {
                    routeIataCodes.add(route.destination.iata_code);
                }
            }
        });

        // Update markers based on the collected IATA codes
        Object.entries(flightMap.markers).forEach(([iata, marker]) => {
            const icon = routeIataCodes.has(iata) ? magentaDotIcon : blueDotIcon;
            marker.setIcon(icon);
            this.updateMarkerTag(marker, routeIataCodes.has(iata));
        });
    },

    updateMarkerTag: function (marker, isWaypoint) {
        if (!marker.tags) {
            marker.tags = new Set();
        }
        marker.tags.forEach(tag => {
            if (tag.startsWith('marker-type:')) {
                marker.tags.delete(tag);
            }
        });
        if (isWaypoint) {
            marker.tags.add('marker-type:waypoint');
        }
    },

    initMapContainer: function (map) {
        document.addEventListener('stateChange', function (e) {
            if (e.detail.key === 'selectedAirport') {
                if (appState.selectedAirport) {
                    map.dragging.disable();
                } else {
                    map.dragging.enable();
                    map.touchZoom.enable();
                }
            }
        });
    },
}

var mc = new Hammer(document.getElementById('map'));
mc.get('pan').set({ direction: Hammer.DIRECTION_ALL });

let lastElement = null;

mc.on('pan', function (ev) {
    if (appState.selectedAirport) {
        let element = document.elementFromPoint(ev.center.x, ev.center.y);

        // Simulate mouseover if moving to a new element
        if (element !== lastElement) {
            if (lastElement) {
                simulateMouseEvent('mouseout', ev.center, lastElement);
            }
            simulateMouseEvent('mouseover', ev.center, element);
            lastElement = element;
        }

        simulateMouseEvent("mousemove", ev.center, element);
    }
});

function simulateMouseEvent(eventType, center, target) {
    let simulatedEvent = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: center.x,
        clientY: center.y
    });
    target.dispatchEvent(simulatedEvent);
}

export { mapHandling };