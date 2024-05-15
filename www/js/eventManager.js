import { map, magentaDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { drawAllRoutePaths } from './allPaths.js';
import { appState, updateState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';
import { mapHandling } from './mapHandling.js';

function handleStateChange(event) {
    const { key, value } = event.detail;

    if (key === 'addWaypoint' || key === 'removeWaypoint' || key === 'updateWaypoint') {
        //const container = document.querySelector('.airport-selection');
        //container.innerHTML = '';

        mapHandling.updateMarkerIcons();
        routeHandling.updateRoutesArray();
        appState.currentView = 'trip';
    }

    if (key === 'changeView') {
        if (value != 'routeTable') {
            pathDrawing.clearLines(true);
        }
    }
}

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupAllPathsButtonEventListener();
        document.addEventListener('stateChange', handleStateChange);
        window.onpopstate = function(event) {
            const params = new URLSearchParams(window.location.search);
        
            // Update app state based on URL parameters
            appState.waypoints = params.get('waypoints') ? params.get('waypoints').split(',').map(iata => ({ iata_code: iata })) : [];
            appState.routeDates = {};

            // Parse the 'dates' parameter
            if (params.has('dates')) {
                let datesParam = params.get('dates').split(',');
                datesParam.forEach(pair => {
                    let [routeNumber, dateRange] = pair.split(':');
                    appState.routeDates[routeNumber] = dateRange;
                });
            }
                        
            const container = document.querySelector('.airport-selection');
            container.innerHTML = '';

            mapHandling.updateMarkerIcons();
            routeHandling.updateRoutesArray();
            appState.currentView = 'trip';
        };
    },

    debounce: function(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },

    // Use debounce for map 'moveend' and 'zoomend' events
    setupMapEventListeners: function() {
        map.on('click', () => {
            Object.values(flightMap.markers).forEach(marker => marker.closePopup());
            const selectedAirportIata = appState.selectedAirport ? appState.selectedAirport.iata_code : null;
            // Check if a waypoint in appState.waypoints has the IATA code
            const waypoint = appState.waypoints.find(wp => wp.iata_code === selectedAirportIata);
            if (waypoint) {
                const selectedMarker = flightMap.markers[waypoint.iata_code];
                if (selectedMarker) {
                    selectedMarker.setIcon(magentaDotIcon);
                }
            }
            flightMap.selectedMarker = null;
            updateState('selectedAirport', null);
            pathDrawing.clearLines();
            pathDrawing.drawLines();
        });

        map.on('moveend', this.debounce(() => {
            flightMap.redrawMarkers();
            flightMap.updateVisibleMarkers();
        }, 250));

        map.on('zoomend', this.debounce(() => {
            flightMap.updateVisibleMarkers();
        }, 250));
    },

    setupAllPathsButtonEventListener: function () {
        document.addEventListener('click', function (event) {
            if (event.target.id === 'allPathsBtn') {
                drawAllRoutePaths();
            }
        });
    },

    attachMarkerEventListeners: function (iata, marker, airport) {
        marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
        marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
        marker.on('click', () => { flightMap.handleMarkerClick(airport, marker); });
    },

    emitCustomEvent: function (eventName, data) {
        switch (eventName) {
            case 'markerCreated':
                this.attachMarkerEventListeners(data.iata, data.marker, data.airport);
                break;
        }
    }
};

window.addEventListener('resize', function () {
    const height = window.innerHeight;
    document.getElementById('map').style.height = height + 'px';
});

document.addEventListener('DOMContentLoaded', function () {
    flightMap.fetchAndDisplayAirports();
    eventManager.setupEventListeners();
});

export { eventManager };
