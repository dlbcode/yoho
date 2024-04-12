import { blueDotIcon, magentaDotIcon, map } from './map.js';
import { appState } from './stateManager.js';
import { flightMap } from './flightMap.js';

const mapHandling = {
  updateMarkerIcons: function() {
    const waypointIataCodes = new Set(appState.waypoints.map(waypoint => waypoint.iata_code));
    Object.entries(flightMap.markers).forEach(([iata, marker]) => {
        marker.setIcon(waypointIataCodes.has(iata) ? magentaDotIcon : blueDotIcon);
    });
  },

  initMapContainer: function(map) {
    document.addEventListener('stateChange', function(e) {
        if (e.detail.key === 'selectedAirport') {
            if (appState.selectedAirport) {
                console.log('Activate touch-to-mouse emulation and disable dragging');
                map.dragging.disable();
            } else {
                console.log('Deactivate touch-to-mouse emulation and enable dragging');
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

mc.on('pan', function(ev) {
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
