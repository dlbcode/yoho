import { map, magentaDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { appState, updateState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';
import { mapHandling } from './mapHandling.js';
import { lineManager } from './lineManager.js';

const stateHandlers = {
    changeView: (value) => {
        if (value === 'routeTable') {
            lineManager.clearLinesByTags(['type:table']);
        } else {
            lineManager.clearLines(true);
        }
    },

    addWaypoint: handleWaypointChange,
    removeWaypoint: handleWaypointChange,
    updateWaypoint: handleWaypointChange,

    updateRoutes: () => {
        if (appState.waypoints.length === 0 || !appState.selectedRoutes[0]) {
            appState.currentView = 'trip';
        }
    }
};

function handleWaypointChange() {
    mapHandling.updateMarkerIcons();
    routeHandling.updateRoutesArray();
    lineManager.clearLinesByTags(['type:table']);
    
    if (appState.currentView !== 'trip') {
        appState.currentView = 'trip';
    }
}

function handleStateChange(event) {
    const { key, value } = event.detail;
    if (stateHandlers[key]) {
        stateHandlers[key](value);
    }
}

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupAllPathsButtonEventListener();
        document.addEventListener('stateChange', handleStateChange);
        window.onpopstate = function(event) {
            const params = new URLSearchParams(window.location.search);
            appState.waypoints = params.get('waypoints') ? params.get('waypoints').split(',').map(iata => ({ iata_code: iata })) : [];
            appState.routeDates = {};
            if (params.has('dates')) {
                let datesParam = params.get('dates').split(',');
                datesParam.forEach(pair => {
                    let [routeNumber, type, date] = pair.split(':');
                    if (!appState.routeDates[routeNumber]) {
                        appState.routeDates[routeNumber] = { depart: null, return: null };
                    }
                    if (type === 'depart') {
                        appState.routeDates[routeNumber].depart = date;
                    } else if (type === 'return') {
                        appState.routeDates[routeNumber].return = date;
                    }
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

    setupMapEventListeners: function() {
        map.on('click', () => {
            Object.values(flightMap.markers).forEach(marker => marker.closePopup());
            const selectedAirportIata = appState.selectedAirport ? appState.selectedAirport.iata_code : null;
            const waypoint = appState.waypoints.find(wp => wp.iata_code === selectedAirportIata);
            if (waypoint) {
                const selectedMarker = flightMap.markers[waypoint.iata_code];
                if (selectedMarker) {
                    selectedMarker.setIcon(magentaDotIcon);
                }
            }
            flightMap.selectedMarker = null;
            updateState('selectedAirport', null, 'eventManager.setupEventListeners');
            
            // Instead of manually clearing lines, use lineManager.clearLines()
            lineManager.clearLines('all'); // This will preserve both table and selected routes
            
            console.log('map click - preserved table routes');
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
