import { map, blueDotIcon, magentaDotIcon, greenDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';
import { lineManager } from './lineManager.js';

const flightMap = {
    markers: {},
    airportDataCache: {},
    cacheDuration: 600000, // 10 minutes in milliseconds 
    hoverDisabled: false, // Add this flag
    preservedMarker: null,  // Add tracking for preserved marker

    init() {
        if (typeof map !== 'undefined') {
            this.getAirportDataByIata = this.getAirportDataByIata.bind(this);
            this.updateVisibleMarkers = this.updateVisibleMarkers.bind(this);

            map.on('zoomend', this.updateVisibleMarkers);
            map.on('moveend', this.updateVisibleMarkers);

            this.fetchAndDisplayAirports();
        } else {
            console.error('Map is not defined');
        }
    },

    addMarker(airport) {
        if (!airport || !airport.iata_code || !airport.weight) {
            console.error('Incomplete airport data:', airport);
            return;
        }

        const iata = airport.iata_code;
        if (this.markers[iata]) return;

        const icon = this.getMarkerIcon(iata, airport.type);
        const latLng = L.latLng(airport.latitude, airport.longitude);
        const marker = L.marker(latLng, { icon });
        marker.airportWeight = airport.weight;
        marker.iata_code = iata;

        const popupContent = `<div style="text-align: center; color: #bababa;"><b>${airport.city}</b>${airport.type === 'airport' ? `<div>${airport.name}</div>` : ''}</div>`;
        marker.bindPopup(popupContent, { maxWidth: 'auto' });

        eventManager.attachMarkerEventListeners(iata, marker, airport);
        this.markers[iata] = marker;

        if (this.shouldDisplayAirport(marker.airportWeight, map.getZoom())) {
            marker.addTo(map);
        }
    },

    getMarkerIcon(iata, type) {
        if (type === 'city') return greenDotIcon;
        return appState.waypoints.some(wp => wp.iata_code === iata) ? magentaDotIcon : blueDotIcon;
    },

    handleMarkerClick(airport, clickedMarker) {
        Object.values(this.markers).forEach(marker => marker.closePopup());

        // Set hover disabled when selecting a waypoint
        this.preservedMarker = clickedMarker;  // Track preserved marker
        this.hoverDisabled = true;
        updateState('selectedAirport', airport);

        const createButton = (text, handler) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'tooltip-button';
            button.addEventListener('click', handler);
            return button;
        };

        const handleAddButtonClick = () => {
            const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
            if (appState.waypoints.length >= 2 && appState.waypoints.length % 2 === 0) {
                updateState('addWaypoint', lastWaypoint, 'flightMap.handleMarkerClick1');
                updateState('addWaypoint', airport, 'flightMap.handleMarkerClick2');
            } else {
                updateState('addWaypoint', airport, 'flightMap.handleMarkerClick3');
            }
            clickedMarker.setIcon(magentaDotIcon);
            updateState('selectedAirport', null, 'flightMap.handleMarkerClick4');
        };

        const handleRemoveButtonClick = () => {
            const waypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
            if (appState.selectedAirport && appState.selectedAirport.iata_code === airport.iata_code) {
                if (waypointIndex === appState.waypoints.length - 1 && waypointIndex > 1) {
                    updateState('removeWaypoint', waypointIndex, 'flightMap.handleRemoveButtonClick1');
                    updateState('removeWaypoint', waypointIndex - 1, 'flightMap.handleRemoveButtonClick2');
                } else {
                    updateState('removeWaypoint', waypointIndex + 1, 'flightMap.handleRemoveButtonClick1'); 
                    updateState('removeWaypoint', waypointIndex, 'flightMap.handleRemoveButtonClick2');
                }
                // Add this line to clear hover lines
                lineManager.clearLines('hover');
                
                clickedMarker.setIcon(blueDotIcon);
                this.hoverDisabled = false; // Re-enable hovering
                updateState('selectedAirport', null, 'flightMap.handleRemoveButtonClick3');
            }
        };

        const popupContent = document.createElement('div');
        const cityName = document.createElement('p');
        cityName.textContent = airport.city;
        popupContent.appendChild(cityName);

        const waypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
        if (waypointIndex === -1) {
            popupContent.appendChild(createButton('+', handleAddButtonClick));
        } else {
            popupContent.appendChild(createButton('-', handleRemoveButtonClick));
        }

        clickedMarker.bindPopup(popupContent, { autoClose: false, closeOnClick: true }).openPopup();
    },

    findRoute(fromIata, toIata) {
        try {
            for (const routes of Object.values(appState.directRoutes)) {
                for (const route of routes) {
                    if (route.originAirport.iata_code === fromIata && route.destinationAirport.iata_code === toIata) {
                        return route;
                    }
                }
            }
        } catch (error) {
            console.error(`Error finding route from ${fromIata} to ${toIata}:`, error);
        }
        return null;
    },

    async fetchAndDisplayAirports() {
        try {
            const currentZoom = map?.getZoom();
            if (currentZoom !== undefined) {
                await this.fetchAndCacheAirports(currentZoom);
                this.updateVisibleMarkers();
            } else {
                console.error('Map is not ready');
            }
        } catch (error) {
            console.error('Error fetching airports:', error);
        }
    },

    async fetchAndCacheAirports(currentZoom) {
        try {
            const response = await fetch(`https://yonderhop.com/api/airports?zoom=${currentZoom}`);
            const data = await response.json();
            this.airportDataCache = data.reduce((acc, airport) => {
                acc[airport.iata_code] = airport;
                return acc;
            }, {});
            return this.airportDataCache;
        } catch (error) {
            console.error('Error fetching airports:', error);
            return {};
        }
    },

    getAirportDataByIata(iata) {
        if (this.airportDataCache && this.airportDataCache[iata]) {
            return Promise.resolve(this.airportDataCache[iata]);
        }

        return this.fetchAndCacheAirports(map?.getZoom()).then(cache => cache[iata] || null);
    },

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    redrawMarkers() {
        Object.values(this.markers).forEach(marker => {
            const newLatLng = pathDrawing.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    markerHoverHandler(iata, event) {
        // Skip hover effects if there's a preserved marker and this isn't it
        if (this.preservedMarker && this.markers[iata] !== this.preservedMarker) {
            return;
        }

        const marker = this.markers[iata];
        if (!marker) return;
        const airport = this.airportDataCache[iata];
        if (!airport) return;

        if (event === 'mouseover') {
            this.fetchAndCacheRoutes(iata).then(() => {
                if (!appState.directRoutes[iata]) {
                    console.error('Direct routes not found for IATA:', iata);
                    return;
                }
                // Only draw hover paths if no marker is preserved
                if (!this.preservedMarker) {
                    pathDrawing.drawRoutePaths(iata, appState.directRoutes, 'hover');
                }
                marker.openPopup();
                marker.hovered = true;
            });
        } else if (event === 'mouseout' && !this.preservedMarker) {
            setTimeout(() => {
                lineManager.clearLines('hover');
                marker.closePopup();
            }, 200);
        }

        if (appState.selectedAirport && appState.selectedAirport.iata_code === iata) {
            marker.openPopup();
        }
    },

    async fetchAndCacheRoutes(iata) {
        if (!iata) {
            console.error('IATA code is empty');
            return;
        }
        if (!appState.directRoutes[iata]) {
            try {
                const direction = appState.routeDirection; // 'to' or 'from'
                const response = await fetch(`https://yonderhop.com/api/directRoutes?origin=${iata}&direction=${direction}`);
                const routes = await response.json();
                if (!routes || !routes.length) {
                    console.error('No routes found for IATA:', iata);
                    return;
                }
                appState.directRoutes[iata] = routes;
            } catch (error) {
                console.error('Error fetching routes:', error);
            }
        }
    },

    shouldDisplayAirport(airportWeight, currentZoom) {
        return airportWeight <= currentZoom - 1;
    },

    updateVisibleMarkers() {
        const currentZoom = map.getZoom();
        const currentBounds = map.getBounds();

        Object.values(this.airportDataCache).forEach(airport => {
            if (this.shouldDisplayAirport(airport.weight, currentZoom) &&
                currentBounds.contains(L.latLng(airport.latitude, airport.longitude)) &&
                !this.markers[airport.iata_code]) {
                this.addMarker(airport);
                if (this.markers[airport.iata_code]) {
                    this.markers[airport.iata_code].addTo(map);
                }
            }
        });

        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            const isWaypoint = appState.waypoints.some(wp => wp.iata_code === iata);
            if (isWaypoint || this.shouldDisplayAirport(marker.airportWeight, currentZoom)) {
                if (currentBounds.contains(marker.getLatLng())) {
                    if (!map.hasLayer(marker)) {
                        marker.addTo(map);
                    }
                } else if (!isWaypoint) {
                    map.removeLayer(marker);
                }
            } else if (!isWaypoint) {
                map.removeLayer(marker);
            }
        });
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
        flightMap.hoverDisabled = false;
        updateState('selectedAirport', null, 'eventManager.handleMapClick');
        lineManager.clearLines('hover');
        lineManager.clearLines('all');
    }
};

export { flightMap };