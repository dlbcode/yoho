import { map, blueDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { appState, updateState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';
import { mapHandling } from './mapHandling.js';
import { lineManager } from './lineManager.js';

const clearLinesForView = (view) => 
    view === 'routeDeck' 
        ? lineManager.clearLinesByTags(['type:deck'])
        : lineManager.clearLines(true);

const handleWaypointChange = () => {
    mapHandling.updateMarkerIcons();
    routeHandling.updateRoutesArray();
    clearLinesForView('routeDeck');
    if (appState.currentView !== 'trip') appState.currentView = 'trip';
};

const stateHandlers = {
    changeView: clearLinesForView,
    addWaypoint: handleWaypointChange,
    removeWaypoint: handleWaypointChange,
    updateWaypoint: handleWaypointChange,
    updateRoutes: () => {
        if (!appState.waypoints.length || !appState.selectedRoutes[0]) {
            appState.currentView = 'trip';
        }
    }
};

const handleStateChange = (event) => {
    const { key, value } = event.detail;
    stateHandlers[key]?.(value);
};

const eventManager = {
    init() {
        this.allPathsBtn = document.getElementById('allPathsBtn');
        this.setupEventListeners();
    },

    setupEventListeners() {
        this.setupMapEventListeners();
        this.setupAllPathsButtonEventListener();
        this.setupDocumentEventListeners();
        document.addEventListener('stateChange', handleStateChange);
        window.onpopstate = this.handlePopState;
    },

    handlePopState(event) {
        const params = new URLSearchParams(window.location.search);
        appState.waypoints = params.get('waypoints') ? params.get('waypoints').split(',').map(iata => ({ iata_code: iata })) : [];
        appState.routeDates = {};
        if (params.has('dates')) {
            params.get('dates').split(',').forEach(pair => {
                let [routeNumber, type, date] = pair.split(':');
                if (!appState.routeDates[routeNumber]) {
                    appState.routeDates[routeNumber] = { depart: null, return: null };
                }
                appState.routeDates[routeNumber][type] = date;
            });
        }
        document.querySelector('.airport-selection').innerHTML = '';
        mapHandling.updateMarkerIcons();
        routeHandling.updateRoutesArray();
        appState.currentView = 'trip';
    },

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    setupMapEventListeners() {
        const mapEvents = {
            'moveend': () => {
                flightMap.redrawMarkers();
                flightMap.updateVisibleMarkers();
            },
            'zoomend': () => flightMap.updateVisibleMarkers()
        };

        Object.entries(mapEvents).forEach(([event, handler]) => {
            map.on(event, this.debounce(handler, 250));
        });

        map.on('click', () => this.handleMapClick());
    },

    handleMapClick() {
        const selectedAirportIata = appState.selectedAirport?.iata_code;
        if (selectedAirportIata) {
            const marker = flightMap.markers[selectedAirportIata];
            const isWaypoint = appState.waypoints.some(wp => wp.iata_code === selectedAirportIata);
            if (!isWaypoint) {
                marker?.setIcon(blueDotIcon);
            }
        }
        
        // Reset all state properly
        flightMap.selectedMarker = null;
        flightMap.preservedMarker = null;
        flightMap.hoverDisabled = false; // Ensure hover is enabled
        updateState('selectedAirport', null, 'eventManager.handleMapClick');
        lineManager.clearLines('hover');
        lineManager.clearLines('all');
        
        // Ensure lines can be drawn on subsequent hovers and clicks
        flightMap.hoverDisabled = false;
    },

    setupAllPathsButtonEventListener() {
        this.allPathsBtn?.addEventListener('click', drawAllRoutePaths);
    },

    setupDocumentEventListeners() {
        document.addEventListener('click', ({ target }) => {
            if (target.id === 'allPathsBtn') drawAllRoutePaths();
        });
    },

    attachMarkerEventListeners(iata, marker, airport) {
        const events = {
            mouseover: () => flightMap.markerHoverHandler(iata, 'mouseover'),
            mouseout: () => flightMap.markerHoverHandler(iata, 'mouseout'),
            click: () => flightMap.handleMarkerClick(airport, marker)
        };

        Object.entries(events).forEach(([event, handler]) => {
            marker.on(event, handler);
        });
    },

    emitCustomEvent(eventName, data) {
        if (eventName === 'markerCreated') {
            this.attachMarkerEventListeners(data.iata, data.marker, data.airport);
        }
    }
};

window.addEventListener('resize', () => {
    document.getElementById('map').style.height = `${window.innerHeight}px`;
});

document.addEventListener('DOMContentLoaded', () => {
    flightMap.fetchAndDisplayAirports();
    eventManager.init();
});

export { eventManager };