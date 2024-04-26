import { map, magentaDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { pathDrawing } from './pathDrawing.js';
import { drawAllRoutePaths } from './allPaths.js';
import { appState, updateState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';
import { uiHandling } from './uiHandling.js';
import { mapHandling } from './mapHandling.js';

function handleStateChange(event) {
    const { key, value } = event.detail;

    if (key === 'addWaypoint' || key === 'removeWaypoint' || key === 'updateWaypoint') {
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';

        console.log('handleStateChange: ', key, value);

        // Ensure at least one route div is present
        const routeCount = Math.max(1, Math.ceil(appState.waypoints.length / 2));
        for (let i = 0; i < routeCount; i++) {
            routeHandling.buildRouteDivs(i + 1);
        }

        mapHandling.updateMarkerIcons();
        routeHandling.updateRoutesArray();
        appState.currentView = 'trip';
    }

    if (key === 'changeView') {
        if (value != 'routeTable') {
            pathDrawing.clearLines(true);
        }
    }

    if (key === 'clearData') {
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';
        routeHandling.buildRouteDivs(1);
    }
    uiHandling.setFocusToNextUnsetInput();
}

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupUIEventListeners();
        this.setupAllPathsButtonEventListener();
        document.addEventListener('stateChange', handleStateChange);
        window.onpopstate = function(event) {
            const params = new URLSearchParams(window.location.search);
        
            // Update app state based on URL parameters
            appState.waypoints = params.get('waypoints') ? params.get('waypoints').split(',').map(iata => ({ iata_code: iata })) : [];
            console.log('eventManager.js: appState.waypoints: ', appState.waypoints);
            appState.routeDates = {};

            console.log('ONPOPSTATE: appState.routeDates 1: ', appState.routeDates);

            // Parse the 'dates' parameter
            if (params.has('dates')) {
                let datesParam = params.get('dates').split(',');
                datesParam.forEach(pair => {
                    let [routeNumber, dateRange] = pair.split(':');
                    appState.routeDates[routeNumber] = dateRange;
                });
            }
                        
            console.log('appState.routeDates 2: ', appState.routeDates);

            const container = document.querySelector('.airport-selection');
            container.innerHTML = '';

            // Ensure at least one route div is present
            const routeCount = Math.max(1, Math.ceil(appState.waypoints.length / 2));
            for (let i = 0; i < routeCount; i++) {
                routeHandling.buildRouteDivs(i + 1);
            }

            mapHandling.updateMarkerIcons();
            routeHandling.updateRoutesArray();
            appState.currentView = 'trip';
            uiHandling.setFocusToNextUnsetInput();
        };
        document.addEventListener('routeAdded', function(event) {
            routeHandling.buildRouteDivs(event.detail.newRoute);
        });
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
            //appState.selectedAirport = null;
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

    setupUIEventListeners: function () {
        document.querySelector('.airport-selection').addEventListener('click', function(event) {
            if (event.target.classList.contains('remove-route-button')) {
                const routeNumber = event.target.closest('.route-container').dataset.routeNumber;
            }
        });

        document.addEventListener('click', function (event) {
            if (event.target.id === 'increaseTravelers') {
                updateState('numTravelers', appState.numTravelers + 1);
                routeList.updateEstPrice();
            } else if (event.target.id === 'decreaseTravelers' && appState.numTravelers > 1) {
                updateState('numTravelers', appState.numTravelers - 1);
                routeList.updateEstPrice();
            } else if (event.target.id === 'clearBtn') {
                updateState('routeDirection', 'from');
                updateState('clearData', null);
                //appState.selectedAirport = null;
                updateState('selectedAirport', null);
                routeList.updateEstPrice();
                pathDrawing.clearLines(true);
                mapHandling.updateMarkerIcons();
                routeHandling.updateRoutesArray();
                uiHandling.toggleTripButtonsVisibility(false);
                appState.currentView = 'trip';
            }            
        });
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

//document.addEventListener('stateChange', function(e) {
//    console.log('stateChange event:', e.detail);
//    if (e.detail.key === 'selectedAirport') {
//        if (appState.selectedAirport) {
//            console.log('Disable dragging');
//            map.dragging.disable(); // Disable dragging if an airport is selected
//        } else {
//            console.log('Enable dragging');
//            map.dragging.enable(); // Enable dragging if no airport is selected
//        }
//    }
//});

// document.addEventListener('waypointsLoadedFromURL', function() {
//    console.log('waypointsLoadedFromURL initial loading');
//    const container = document.querySelector('.airport-selection');
//        // Ensure at least one route div is present
//        const routeCount = Math.max(1, Math.ceil(appState.waypoints.length / 2));
//        for (let i = 0; i < routeCount; i++) {
//            routeHandling.buildRouteDivs(i + 1);
//        }
//});

document.addEventListener('DOMContentLoaded', function () {
    flightMap.fetchAndDisplayAirports();
    eventManager.setupEventListeners();
});

export { eventManager };
