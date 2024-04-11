import { map, blueDotIcon, magentaDotIcon, greenDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';

const flightMap = {
    markers: {},
    currentLines: [],
    selectedMarker: null,
    routePathCache: {},
    airportDataCache: {},
    clearMultiHopPaths: true,
    cachedRoutes: [],
    lastFetchTime: null,
    cacheDuration: 600000, // 10 minutes in milliseconds 
    
    init: function() {
        this.getAirportDataByIata = this.getAirportDataByIata.bind(this);
    },

    addMarker(airport) {
        if (!airport || !airport.iata_code || !airport.weight) {
            console.error('Incomplete airport data:', airport);
            return;
        }
    
        // Do not add a marker if the airport type is 'country'
        if (airport.type === 'country') {
            return;
        }
    
        let iata = airport.iata_code;
        if (this.markers[iata]) return;
    
        let icon = airport.type === 'city' ? greenDotIcon : 
                   appState.waypoints.some(wp => wp.iata_code === iata) ? magentaDotIcon : blueDotIcon;
    
        const latLng = L.latLng(airport.latitude, airport.longitude);
        const marker = L.marker(latLng, { icon: icon }).addTo(map);
        marker.airportWeight = airport.weight;
        marker.iata_code = iata;
        marker.hovered = false;
    
        let popupContent = `<div style="text-align: center; color: #bababa;"><b>${airport.city}</b>`;
        if (airport.type === 'airport') {
            popupContent += `<div>${airport.name}</div>`; 
        }
        popupContent += '</div>';
        
        marker.bindPopup(popupContent, { maxWidth: 'auto' });
    
        let self = this;
        marker.on('mouseover', function(e) {
            Object.values(self.markers).forEach(marker => marker.closePopup());
            this.openPopup();
        });
    
        eventManager.attachMarkerEventListeners(iata, marker, airport);
        this.markers[iata] = marker;
    
        // Ensure waypoints are always visible
        this.updateVisibleMarkersForWaypoints(iata);
    },
    
    updateVisibleMarkersForWaypoints(iata) {
        const isWaypoint = appState.waypoints.some(wp => wp.iata_code === iata);
        if (isWaypoint && this.markers[iata]) {
            this.markers[iata].addTo(map);
        }
    },                        

    handleMarkerClick(airport, clickedMarker) {
        Object.values(this.markers).forEach(marker => marker.closePopup());

        appState.selectedAirport = airport;

        const createButton = (text, handler) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'tooltip-button';
            button.addEventListener('click', handler);
            return button;
        };

        const handleAddButtonClick = () => {
            const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
            if (appState.waypoints.length >= 2 && appState.waypoints.length % 2 === 0){
                updateState('addWaypoint', lastWaypoint);
                updateState('addWaypoint', airport);
            } else {
                updateState('addWaypoint', airport);
            }
            clickedMarker.setIcon(magentaDotIcon);
            appState.selectedAirport = null;
            popupContent.removeChild(addButton);
            clickedMarker.closePopup();
        };

        const handleRemoveButtonClick = () => {
            console.table(appState.waypoints);
            const waypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
            if (appState.selectedAirport && appState.selectedAirport.iata_code === airport.iata_code) {
                updateState('removeWaypoint', waypointIndex + 1);
                updateState('removeWaypoint', waypointIndex);
                clickedMarker.setIcon(blueDotIcon);
                appState.selectedAirport = null;
                popupContent.removeChild(removeButton);
                clickedMarker.closePopup();
            }
        };

        const addButton = createButton('+', handleAddButtonClick);
        const removeButton = createButton('-', handleRemoveButtonClick);

        const popupContent = document.createElement('div');
        const cityName = document.createElement('p');
        cityName.textContent = airport.city;
        popupContent.appendChild(cityName);

        const waypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
        if (waypointIndex === -1) {
            popupContent.appendChild(addButton);
        } else {
            popupContent.appendChild(removeButton);
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
            const airports = await this.fetchAndCacheAirports();
            Object.values(airports).forEach(airport => {
                this.addMarker(airport);
            });
        } catch (error) {
            console.error('Error fetching airports:', error);
        }
    },

    async fetchAndCacheAirports() {
        if (this.airportDataCache && Object.keys(this.airportDataCache).length > 0) {
            return Promise.resolve(this.airportDataCache);
        }
    
        try {
            const response = await fetch('https://yonderhop.com/api/airports');
            const data = await response.json();
            this.airportDataCache = data.reduce((acc, airport) => {
                acc[airport.iata_code] = airport;
                return acc;
            }, {});
            this.updateVisibleMarkers(); // Call updateVisibleMarkers after data is fetched
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

        return this.fetchAndCacheAirports().then(cache => cache[iata] || null);
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
            var newLatLng = pathDrawing.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    markerHoverHandler(iata, event) {
//        console.log('markerHoverHandler', iata, event);
//        console.log('markerHoverHandler appState.selectedAirport', appState.selectedAirport);

        const marker = this.markers[iata];
        if (!marker) return;
        const airport = this.airportDataCache[iata];// Replace this with your actual function to get airport data
        if (!airport) return;

        if (event === 'mouseover') {
            this.fetchAndCacheRoutes(iata).then(() => {
                pathDrawing.drawRoutePaths(iata, appState.directRoutes, appState.routeDirection);
            });
        } else if (event === 'mouseout') {
            if (!marker.hovered) {  // Delay only for the first hover
                setTimeout(() => {
                    pathDrawing.clearLines();
                    pathDrawing.drawLines();
                }, 200);
                marker.hovered = true; // Set the flag to true after the first hover
            } else {
                pathDrawing.clearLines();
                pathDrawing.drawLines();
            }
        }

        if (appState.selectedAirport && appState.selectedAirport.iata_code === iata) {
//            console.log('markerHoverHandler appState.selectedAirport.iata_code === iata', appState.selectedAirport.iata_code === iata);
//            console.log('markerHoverHandler opening popup');
            marker.openPopup();
        }
    },
    
    async fetchAndCacheRoutes(iata) {
        if (!appState.directRoutes[iata]) {
            try {
                const direction = appState.routeDirection // 'to' or 'from'
                const response = await fetch(`https://yonderhop.com/api/directRoutes?origin=${iata}&direction=${direction}`);
                const routes = await response.json();
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
    
        // Check and add markers for airports that should be visible at the current zoom level
        Object.values(this.airportDataCache).forEach(airport => {
            if (this.shouldDisplayAirport(airport.weight, currentZoom) &&
                currentBounds.contains(L.latLng(airport.latitude, airport.longitude)) &&
                !this.markers[airport.iata_code]) {
                this.addMarker(airport);
            }
        });

        // Update visibility of existing markers
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
};

flightMap.init();

export { flightMap };
