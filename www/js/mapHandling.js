import { blueDotIcon, magentaDotIcon } from './map.js';
import { appState } from './stateManager.js';
import { flightMap } from './flightMap.js';

const mapHandling = {
  updateMarkerIcons: function() {
    const waypointIataCodes = new Set(appState.waypoints.map(waypoint => waypoint.iata_code));
    Object.entries(flightMap.markers).forEach(([iata, marker]) => {
        marker.setIcon(waypointIataCodes.has(iata) ? magentaDotIcon : blueDotIcon);
    });
  }
}

export { mapHandling };