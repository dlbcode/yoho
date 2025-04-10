import { map, blueDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { appState, updateState, parseUrlRoutes } from './stateManager.js';
import { routeHandling } from './routeHandling.js';
import { mapHandling } from './mapHandling.js';
import { lineManager } from './lineManager.js';
import { pathDrawing } from './pathDrawing.js';

const clearLinesForView = (view) => 
    view === 'routeDeck' 
        ? lineManager.clearLinesByTags(['type:deck'])
        : lineManager.clearLines(true);

const handleWaypointChange = () => {
    mapHandling.updateMarkerIcons();
    
    const isAnyDestinationChange = appState.routeData.some(r => r && !r.isEmpty && (
        (r.origin?.iata_code === 'Any') || 
        (r.destination?.iata_code === 'Any')
    ));
    
    if (!isAnyDestinationChange && !appState.isRouteSwitching) {
        routeHandling.updateRoutesArray();
        clearLinesForView('routeDeck');
    }
    
    if (appState.currentView !== 'trip') appState.currentView = 'trip';
};

const stateHandlers = {
    changeView: clearLinesForView,
    addWaypoint: handleWaypointChange,
    removeWaypoint: handleWaypointChange,
    updateRouteData: (value) => {
        if (value && typeof value.routeNumber === 'number') {
            lineManager.clearLinesByRouteNumber(value.routeNumber);
        }
        handleWaypointChange();
    },
    removeRoute: handleWaypointChange,
    updateRoutes: () => {
        const hasValidRoutes = appState.routeData.some(r => r && !r.isEmpty && 
            ((r.origin && r.origin.iata_code) || (r.destination && r.destination.iata_code)));
        
        if (!hasValidRoutes) {
            appState.currentView = 'trip';
        }
    }
};

const handleStateChange = (event) => {
    const { key, value } = event.detail;
    
    if (key === 'selectedAirport') {
        if (value) {
            map.dragging.disable();
        } else {
            map.dragging.enable();
            map.touchZoom.enable();
        }
    }
    
    if (key === 'updateWaypoint' || key === 'updateRoutes' || key === 'removeRoute') {
        eventManager.updateRoutes();
    } else if (key === 'updateRouteData') {
        stateHandlers[key]?.(value);
    } else {
        stateHandlers[key]?.(value);
    }
};

const eventManager = {
    isTouch: false,

    init() {
        document.addEventListener('stateChange', handleStateChange);
        
        // Add touch detection
        document.addEventListener('touchstart', () => this.isTouch = true, { passive: true });
        document.addEventListener('touchend', () => {
            setTimeout(() => this.isTouch = false, 100);
        }, { passive: true });
        
        map.addEventListener('popupclose', (e) => {
            // Prevent popup close from affecting selected airport during touch
            if (this.isTouch && appState.selectedAirport) {
                return;
            }
            
            flightMap.hoverDisabled = false;
            flightMap.preservedMarker = null;
            updateState('selectedAirport', null, 'eventManager.popupclose');
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                lineManager.clearLines('hover');
                flightMap.hoverDisabled = false;
                flightMap.preservedMarker = null;
                
                map.closePopup();
                
                if (appState.selectedAirport) {
                    updateState('selectedAirport', null, 'eventManager.escKey');
                }
            }
        });

        this.allPathsBtn = document.getElementById('allPathsBtn');
        this.setupEventListeners();
    },

    setupEventListeners() {
        this.setupMapEventListeners();
        this.setupAllPathsButtonEventListener();
        this.setupDocumentEventListeners();
        window.onpopstate = this.handlePopState;
    },

    handlePopState(event) {
        parseUrlRoutes();
        
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
        // Clear any stuck popups first
        lineManager.closeAllPopups();
        
        // Rest of existing code...
        if (pathDrawing.popupFromClick && lineManager.outsideClickListener) {
            return;
        }
        
        appState.preventMapViewChange = true;
        
        const selectedAirportIata = appState.selectedAirport?.iata_code;
        if (selectedAirportIata) {
            const marker = flightMap.markers[selectedAirportIata];
            const isWaypoint = appState.routeData.some(r => 
                r && !r.isEmpty && (
                    r.origin?.iata_code === selectedAirportIata || 
                    r.destination?.iata_code === selectedAirportIata
                )
            );
            if (!isWaypoint) {
                marker?.setIcon(blueDotIcon);
            }
            
            // Close any open popup on the marker
            marker?.closePopup();
        }
        
        // Clear hover timer if exists
        if (flightMap.markerHoverTimer) {
            clearTimeout(flightMap.markerHoverTimer);
            flightMap.markerHoverTimer = null;
        }
        
        // Rest of existing code...
        flightMap.selectedMarker = null;
        flightMap.preservedMarker = null;
        flightMap.hoverDisabled = false;
        
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();
        
        updateState('selectedAirport', null, 'eventManager.handleMapClick');
        
        lineManager.clearLines('hover');
        
        flightMap.hoverDisabled = false;
        
        if (appState.preventMapViewChange && 
            (!map.getCenter().equals(currentCenter) || map.getZoom() !== currentZoom)) {
            map.setView(currentCenter, currentZoom, { animate: false });
        }
        appState.preventMapViewChange = false;
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
    },

    updateRoutes() {
        const validRoutes = appState.routeData
            .filter(route => route && !route.isEmpty && 
                   route.origin && route.destination);
        
        validRoutes.forEach(route => {
            const origin = route.origin?.iata_code;
            const destination = route.destination?.iata_code;
            
            if (origin && destination) {
                flightMap.getAirportDataByIata(origin).then(originAirport => {
                    flightMap.getAirportDataByIata(destination).then(destAirport => {
                        if (originAirport && destAirport) {
                            const routeId = `${origin}-${destination}`;
                            pathDrawing.drawLine(routeId, 'route', {
                                price: route.price,
                                routeNumber: appState.routeData.indexOf(route),
                                isDirect: route.isDirect || false
                            });
                        }
                    });
                });
            }
        });
    },

    onMarkerMouseOver(iata, airport) {
        flightMap.markerHoverHandler(iata, 'mouseover');
    },

    onMarkerMouseOut(iata, airport) {
        flightMap.markerHoverHandler(iata, 'mouseout');
    },

    onMarkerClick(iata, marker, airport, e) {
        e.originalEvent.stopPropagation();
        flightMap.handleMarkerClick(airport, marker);
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