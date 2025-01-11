import { map, blueDotIcon, magentaDotIcon, greenDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';
import { lineManager } from './lineManager.js';

const linePool = {
    pool: [],
    
    init(size = 100) {
        this.pool = Array.from({ length: size }, () => L.polyline([], {
            color: '#666',
            weight: 1,
            opacity: 0
        }));
    },

    acquire() {
        return this.pool.pop() || this.createNewLine();
    },

    release(line) {
        line.setLatLngs([]).setStyle({ opacity: 0 });
        this.pool.push(line);
    },

    createNewLine() {
        return L.polyline([], { color: '#666', weight: 1, opacity: 0 });
    }
};

const flightMap = {
    markers: {},
    airportDataCache: {},
    cacheDuration: 600000, // 10 minutes in milliseconds 
    hoverDisabled: false,
    preservedMarker: null,
    linePool: linePool,
    routeCache: new Map(),
    pendingRoutes: new Map(),

    init() {
        if (!map) {
            console.error('Map is not defined');
            return;
        }

        this.updateVisibleMarkers = this.updateVisibleMarkers.bind(this);
        map.on('zoomend moveend', this.updateVisibleMarkers);

        this.fetchAndDisplayAirports();
        this.linePool.init();
        this.initViewportLoading();
    },

    addMarker(airport) {
        if (!airport?.iata_code || !airport.weight) {
            console.error('Incomplete airport data:', airport);
            return;
        }

        const iata = airport.iata_code;
        if (this.markers[iata]) return;

        const icon = this.getMarkerIcon(iata, airport.type);
        const latLng = L.latLng(airport.latitude, airport.longitude);
        const marker = L.marker(latLng, { icon }).addTo(map);
        marker.airportWeight = airport.weight;
        marker.iata_code = iata;

        const popupContent = `<div style="text-align: center; color: #bababa;"><b>${airport.city}</b>${airport.type === 'airport' ? `<div>${airport.name}</div>` : ''}</div>`;
        marker.bindPopup(popupContent, { maxWidth: 'auto' });

        eventManager.attachMarkerEventListeners(iata, marker, airport);
        this.markers[iata] = marker;
    },

    getMarkerIcon(iata, type) {
        if (type === 'city') return greenDotIcon;
        return appState.waypoints.some(wp => wp.iata_code === iata) ? magentaDotIcon : blueDotIcon;
    },

    handleMarkerClick(airport, clickedMarker) {
        Object.values(this.markers).forEach(marker => marker.closePopup());
        this.preservedMarker = clickedMarker;
        this.hoverDisabled = true;
        updateState('selectedAirport', airport);

        const popupContent = document.createElement('div');
        const cityName = document.createElement('p');
        cityName.textContent = airport.city;
        popupContent.appendChild(cityName);

        const waypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
        const button = document.createElement('button');
        button.className = 'tooltip-button';
        button.textContent = waypointIndex === -1 ? '+' : '-';

        button.addEventListener('click', () => {
            const currentWaypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
            if (currentWaypointIndex === -1) {
                const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
                if (appState.waypoints.length >= 2 && appState.waypoints.length % 2 === 0) {
                    updateState('addWaypoint', lastWaypoint);
                    updateState('addWaypoint', airport);
                } else {
                    updateState('addWaypoint', airport);
                }
                clickedMarker.setIcon(magentaDotIcon);
                button.textContent = '-';
            } else {
                if (currentWaypointIndex === appState.waypoints.length - 1 && currentWaypointIndex > 1) {
                    updateState('removeWaypoint', currentWaypointIndex);
                    updateState('removeWaypoint', currentWaypointIndex - 1);
                } else {
                    updateState('removeWaypoint', currentWaypointIndex + 1);
                    updateState('removeWaypoint', currentWaypointIndex);
                }
                lineManager.clearLines('hover');
                clickedMarker.setIcon(blueDotIcon);
                this.hoverDisabled = false;
                button.textContent = '+';
            }
            updateState('selectedAirport', null);
        });

        popupContent.appendChild(button);
        clickedMarker.bindPopup(popupContent, { autoClose: false, closeOnClick: true }).openPopup();

        this.fetchAndCacheRoutes(airport.iata_code).then(() => {
            if (!appState.directRoutes[airport.iata_code]) {
                console.error('Direct routes not found for IATA:', airport.iata_code);
                return;
            }
            lineManager.clearLines('hover');
            pathDrawing.drawRoutePaths(airport.iata_code, appState.directRoutes, 'hover');
            clickedMarker.openPopup(); // Re-open popup after drawing lines
        });
    },

    async fetchAndDisplayAirports() {
        const currentZoom = map?.getZoom();
        if (currentZoom === undefined) {
            console.error('Map is not ready');
            return;
        }

        try {
            await this.fetchAndCacheAirports(currentZoom);
            this.updateVisibleMarkers();
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
        if (this.airportDataCache[iata]) {
            return Promise.resolve(this.airportDataCache[iata]);
        }

        return this.fetchAndCacheAirports(map?.getZoom()).then(cache => cache[iata] || null);
    },

    getColorBasedOnPrice(price) {
        if (price == null || isNaN(parseFloat(price))) return 'grey';
        price = parseFloat(price);
        if (price < 100) return '#0099ff';
        if (price < 200) return 'green';
        if (price < 300) return '#abb740';
        if (price < 400) return 'orange';
        if (price < 500) return '#da4500';
        return '#c32929';
    },

    redrawMarkers() {
        Object.values(this.markers).forEach(marker => {
            const newLatLng = pathDrawing.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    markerHoverHandler(iata, event) {
        if (this.preservedMarker && this.markers[iata] !== this.preservedMarker) return;

        const marker = this.markers[iata];
        const airport = this.airportDataCache[iata];
        if (!marker || !airport) return;

        if (event === 'mouseover') {
            this.fetchAndCacheRoutes(iata).then(() => {
                if (!appState.directRoutes[iata]) {
                    console.error('Direct routes not found for IATA:', iata);
                    return;
                }
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

        if (appState.selectedAirport?.iata_code === iata) {
            marker.openPopup();
        }
    },

    async fetchAndCacheRoutes(iata) {
        if (!iata) {
            console.error('IATA code is empty');
            return;
        }
        if (appState.directRoutes[iata]) return;

        try {
            const direction = appState.routeDirection;
            const response = await fetch(`https://yonderhop.com/api/directRoutes?origin=${iata}&direction=${direction}`);
            const routes = await response.json();
            if (!routes?.length) {
                console.error('No routes found for IATA:', iata);
                return;
            }
            appState.directRoutes[iata] = routes;
        } catch (error) {
            console.error('Error fetching routes:', error);
        }
    },

    shouldDisplayAirport(airportWeight, currentZoom) {
        return airportWeight <= currentZoom - 1;
    },

    updateVisibleMarkers() {
        const currentZoom = map.getZoom();
        const currentBounds = map.getBounds();

        Object.values(this.airportDataCache).forEach(airport => {
            const shouldDisplay = this.shouldDisplayAirport(airport.weight, currentZoom);
            const isInBounds = currentBounds.contains(L.latLng(airport.latitude, airport.longitude));
            const markerExists = !!this.markers[airport.iata_code];

            if (shouldDisplay && isInBounds && !markerExists) {
                this.addMarker(airport);
            } else if (markerExists && (!shouldDisplay || !isInBounds)) {
                map.removeLayer(this.markers[airport.iata_code]);
                delete this.markers[airport.iata_code];
            }
        });

        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            const isWaypoint = appState.waypoints.some(wp => wp.iata_code === iata);
            const shouldDisplay = isWaypoint || this.shouldDisplayAirport(marker.airportWeight, currentZoom);
            const isInBounds = currentBounds.contains(marker.getLatLng());

            if (shouldDisplay && isInBounds) {
                if (!map.hasLayer(marker)) marker.addTo(map);
            } else if (!isWaypoint && map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
    },

    async getRouteData(iata) {
        if (this.routeCache.has(iata)) return this.routeCache.get(iata);
        if (this.pendingRoutes.has(iata)) return this.pendingRoutes.get(iata);

        const routePromise = fetch(`/api/routes/${iata}`)
            .then(res => res.json())
            .then(data => {
                this.routeCache.set(iata, data);
                this.pendingRoutes.delete(iata);
                return data;
            });

        this.pendingRoutes.set(iata, routePromise);
        return routePromise;
    },

    drawRouteLines(iata, routes) {
        const batchSize = 20;
        let currentIndex = 0;

        const drawBatch = () => {
            const batch = routes.slice(currentIndex, currentIndex + batchSize);
            
            batch.forEach(route => {
                const line = this.linePool.acquire();
                const coords = this.calculateRouteCoordinates(route);
                line.setLatLngs(coords).setStyle({opacity: 1});
            });

            currentIndex += batchSize;
            if (currentIndex < routes.length) {
                requestAnimationFrame(drawBatch);
            }
        };

        requestAnimationFrame(drawBatch);
    },

    initViewportLoading() {
        const loadVisibleRoutes = () => {
            const bounds = map.getBounds();
            const visibleMarkers = Object.values(this.markers)
                .filter(marker => bounds.contains(marker.getLatLng()));

            visibleMarkers.slice(0, 10).forEach(marker => {
                this.getRouteData(marker.iata_code);
            });
        };

        map.on('moveend zoomend', () => {
            requestAnimationFrame(loadVisibleRoutes);
        });
    },

    handleMarkerHover: debounce(function(iata, type) {
        if (type === 'mouseover' && !this.hoverDisabled) {
            this.getRouteData(iata).then(routes => {
                this.drawRouteLines(iata, routes);
            });
        }
    }, 50)
};

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export { flightMap };