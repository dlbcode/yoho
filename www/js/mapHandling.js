import { blueDotIcon, magentaDotIcon, map } from './map.js';
import { appState } from './stateManager.js';
import { flightMap } from './flightMap.js';

const mapHandling = {
    updateMarkerIcons: function () {
        // Get all IATA codes from valid routes in routeData
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

        // No need to check legacy waypoints anymore
        
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
let lastMouseOutElement = null;

function getElementsFromPoint(x, y) {
    return document.elementsFromPoint(x, y).filter(el => 
        el.classList.contains('leaflet-interactive') || 
        el.closest('.leaflet-interactive')
    );
}

function simulateMouseEvent(eventType, center, target, bubbles = true) {
    if (!target) return;
    
    const simulatedEvent = new MouseEvent(eventType, {
        view: window,
        bubbles,
        cancelable: true,
        clientX: center.x,
        clientY: center.y,
        screenX: center.x,
        screenY: center.y
    });
    
    target.dispatchEvent(simulatedEvent);
}

mc.on('panstart', function(ev) {
    if (appState.selectedAirport) {
        lastElement = null;
        lastMouseOutElement = null;
    }
});

mc.on('pan', function(ev) {
    if (appState.selectedAirport) {
        const elements = getElementsFromPoint(ev.center.x, ev.center.y);
        const currentElement = elements[0];

        if (lastElement && currentElement !== lastElement) {
            simulateMouseEvent('mouseout', ev.center, lastElement);
            lastMouseOutElement = lastElement;
        }

        if (currentElement && currentElement !== lastElement) {
            simulateMouseEvent('mouseover', ev.center, currentElement);
            simulateMouseEvent('mousemove', ev.center, currentElement);
        }

        lastElement = currentElement;
    }
});

mc.on('panend', function(ev) {
    if (appState.selectedAirport) {
        lastElement = null;
        lastMouseOutElement = null;
    }
});

export { mapHandling };