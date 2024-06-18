import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { lineEvents } from './lineEvents.js';

class Line {
    constructor(origin, destination, price, map, routeId, tags = {}) {
        this.origin = origin;
        this.destination = destination;
        this.price = price;
        this.map = map;
        this.routeId = routeId;
        this.tags = tags;

        this.defaultWeight = 1;
        this.defaultColor = this.getColorBasedOnPrice(price);

        this.visibleLine = this.createVisibleLine();
        this.invisibleLine = this.createInvisibleLine();
        this.decoratedLine = this.tags.showPlane ? this.createDecoratedLine() : null;

        this.bindEvents();
    }

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    }

    createVisibleLine() {
        const adjustedOrigin = L.latLng(this.origin.latitude, this.origin.longitude);
        const adjustedDestination = L.latLng(this.destination.latitude, this.destination.longitude);
        return new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: this.defaultWeight,
            opacity: 1,
            color: this.defaultColor,
            wrap: false,
            zIndex: -1
        }).addTo(this.map);
    }

    createInvisibleLine() {
        const adjustedOrigin = L.latLng(this.origin.latitude, this.origin.longitude);
        const adjustedDestination = L.latLng(this.destination.latitude, this.destination.longitude);
        return new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: 10,
            opacity: 0.1,
            wrap: false
        }).addTo(this.map);
    }

    createDecoratedLine() {
        const planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
            iconSize: [16, 16],
            iconAnchor: [8, 12]
        });

        const planeSymbol = L.Symbol.marker({
            rotate: true,
            markerOptions: {
                icon: planeIcon
            }
        });

        return L.polylineDecorator(this.visibleLine, {
            patterns: [
                { offset: '50%', repeat: 0, symbol: planeSymbol }
            ]
        }).addTo(this.map);
    }

    bindEvents() {
        this.visibleLine.on('click', (e) => lineEvents.onClickHandler(e, this.visibleLine, this.invisibleLine, this.routeId));
        this.invisibleLine.on('click', (e) => lineEvents.onClickHandler(e, this.visibleLine, this.invisibleLine, this.routeId));
        
        this.invisibleLine.on('mouseover', (e) => lineEvents.onMouseOver(e, this.visibleLine, this.map));
        this.invisibleLine.on('mouseout', () => lineEvents.onMouseOut(this.visibleLine, this.map));

        if (this.decoratedLine) {
            this.decoratedLine.on('click', (e) => this.invisibleLine.fire('click', e));
            this.decoratedLine.on('mouseover', (e) => lineEvents.onMouseOver(e, this.visibleLine, this.map));
            this.decoratedLine.on('mouseout', () => lineEvents.onMouseOut(this.visibleLine, this.map));
        }
    }

    highlight() {
        this.visibleLine.setStyle({ color: 'white' });
    }

    reset() {
        this.visibleLine.setStyle({ color: this.defaultColor });
    }

    remove() {
        if (this.map.hasLayer(this.visibleLine)) this.map.removeLayer(this.visibleLine);
        if (this.map.hasLayer(this.invisibleLine)) this.map.removeLayer(this.invisibleLine);
        if (this.decoratedLine && this.map.hasLayer(this.decoratedLine)) this.map.removeLayer(this.decoratedLine);
    }
}

const pathDrawing = {
    currentLines: [],
    routePathCache: {},
    dashedRoutePathCache: {},
    popupFromClick: false,

    drawRoutePaths(iata, directRoutes) {
        let cacheKey = appState.routeDirection + '_' + iata;
        if (this.routePathCache[cacheKey]) {
            this.routePathCache[cacheKey].forEach(line => {
                line.visibleLine.addTo(map);
                line.invisibleLine.addTo(map);
                if (line.decoratedLine) line.decoratedLine.addTo(map);
            });
        } else {
            this.drawRoutePathsGeneric(iata, directRoutes, appState.routeDirection);
        }
    },

    drawRoutePathsGeneric(iata, directRoutes, direction) {
        const routes = directRoutes[iata] || [];
        routes.forEach(route => {
            this.drawPaths(route);
        });
    },

    async drawPathBetweenAirports(originIata, destinationIata) {
        try {
            const [originAirportData, destinationAirportData] = await Promise.all([
                flightMap.getAirportDataByIata(originIata),
                flightMap.getAirportDataByIata(destinationIata)
            ]);

            if (!originAirportData || !destinationAirportData) {
                console.error('Airport data not found for one or both IATAs:', originIata, destinationIata);
                return;
            }

            this.createRoutePath(originAirportData, destinationAirportData, {
                originAirport: originAirportData,
                destinationAirport: destinationAirportData,
            }, 'white', false);
        } catch (error) {
            console.error('Error drawing path between airports:', error);
        }
    },

    drawDashedLine(originAirport, destinationAirport) {
        if (!originAirport || !destinationAirport) {
            return;
        }
        const worldCopies = [-720, -360, 0, 360, 720];
        worldCopies.forEach(offset => {
            const adjustedOrigin = L.latLng(originAirport.latitude, originAirport.longitude + offset);
            const adjustedDestination = L.latLng(destination.latitude, destination.longitude + offset);
            const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 2, opacity: 1.0, color: 'grey', dashArray: '5, 10', wrap: false
            }).addTo(map);

            const routeId = `${originAirport.iata_code}-${destinationAirport.iata_code}`;
            this.dashedRoutePathCache[routeId] = this.dashedRoutePathCache[routeId] || [];
            this.dashedRoutePathCache[routeId].push(geodesicLine);
        });
    },

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },

    async createRoutePath(origin, destination, route, lineColor = null, isTableRoute = false, tableRouteId = null) {
        let routeData = route;
        let selectedRoutesArray = Array.isArray(appState.selectedRoutes) ? appState.selectedRoutes : Object.values(appState.selectedRoutes);

        const selectedRoute = selectedRoutesArray.find(sr =>
            sr.fullData.flyFrom === route.originAirport.iata_code &&
            sr.fullData.flyTo === route.destinationAirport.iata_code
        );

        if (selectedRoute) {
            routeData = {
                ...route,
                originAirport: { iata_code: selectedRoute.fullData.flyFrom, ...route.originAirport },
                destinationAirport: { iata_code: selectedRoute.fullData.flyTo, ...route.destinationAirport },
                price: parseFloat(selectedRoute.displayData.price.replace('$', ''))
            };
        }

        if (!routeData || !routeData.originAirport || !routeData.destinationAirport ||
            typeof routeData.originAirport.iata_code === 'undefined' ||
            typeof routeData.destinationAirport.iata_code === 'undefined') {
            console.error('Invalid route data:', routeData);
            return;
        }

        let routeId = `${routeData.originAirport.iata_code}-${routeData.destinationAirport.iata_code}`;
        if (this.routePathCache[routeId] && isTableRoute) {
            this.routePathCache[routeId].forEach(line => {
                if (!line.visibleLine.routeData.tableRouteId) {
                    line.visibleLine.routeData.tableRouteId = tableRouteId;
                }
            });
            return;
        }

        let shouldDecorate = appState.routes.some(r =>
            r.origin === route.originAirport.iata_code &&
            r.destination === route.destinationAirport.iata_code
        );

        const newLine = new Line(origin, destination, routeData.price, map, routeId, { showPlane: shouldDecorate });
        newLine.visibleLine.routeData = routeData;
        newLine.visibleLine.routeData.tableRouteId = tableRouteId;

        this.routePathCache[routeId] = this.routePathCache[routeId] || [];
        this.routePathCache[routeId].push(newLine);

        if (tableRouteId) {
            this.routePathCache[tableRouteId] = this.routePathCache[tableRouteId] || [];
            this.routePathCache[tableRouteId].push(newLine);
        }

        if (shouldDecorate) {
            this.currentLines.push(newLine);
        }
    },

    drawLines: async function() {
        lineEvents.clearLines('route');

        const drawPromises = appState.routes.map(route => {
            if (route.isDirect) {
                return this.createRoutePath(route.originAirport, route.destinationAirport, route);
            } else {
                return this.drawDashedLine(route.originAirport, route.destinationAirport);
            }
        });

        await Promise.all(drawPromises);

        if (appState.selectedAirport) {
            this.drawRoutePaths(appState.selectedAirport.iata_code, appState.directRoutes, appState.routeDirection);
        }
    },

    drawPaths(route) {
        this.createRoutePath(route.originAirport, route.destinationAirport, route, 0, false);
    },

    drawRouteLines: async function() {
        const rows = document.querySelectorAll('.route-info-table tbody tr');
        let minPrice = Infinity, maxPrice = -Infinity;

        rows.forEach(row => {
            if (row.style.display !== 'none') {
                const priceText = row.cells[2].textContent.trim();
                const price = parseFloat(priceText.replace('$', ''));
                if (price < minPrice) minPrice = price;
                if (price > maxPrice) maxPrice = price;
            }
        });

        const priceRange = maxPrice - minPrice;
        const quartile = priceRange / 4;

        const getColorForPrice = (price) => {
            const relativePrice = price - minPrice;
            if (relativePrice <= quartile) return 'green';
            if (relativePrice <= quartile * 2) return 'yellow';
            if (relativePrice <= quartile * 3) return 'orange';
            return 'red';
        };

        for (const row of rows) {
            if (row.style.display === 'none') continue;

            const routeLineId = row.getAttribute('data-route-id');
            const routeString = row.cells[row.cells.length - 1].textContent.trim();
            const iataCodes = routeString.split(' > ');
            if (iataCodes.length < 2) continue;

            const priceText = row.cells[2].textContent.trim();
            const price = parseFloat(priceText.replace('$', ''));
            const color = getColorForPrice(price);

            for (let i = 0; i < iataCodes.length - 1; i++) {
                const originIata = iataCodes[i];
                const destinationIata = iataCodes[i + 1];

                try {
                    const originAirportData = await flightMap.getAirportDataByIata(originIata);
                    const destinationAirportData = await flightMap.getAirportDataByIata(destinationIata);
                    if (!originAirportData || !destinationAirportData) continue;

                    this.createRoutePath(originAirportData, destinationAirportData, {
                        originAirport: originAirportData,
                        destinationAirport: destinationAirportData,
                        price: price,
                    }, color, routeLineId);
                } catch (error) {
                    console.error('Error fetching airport data for segment:', error);
                }
            }
        }
    },

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    onClick(e, visibleLine, invisibleLine) {
        this.popupFromClick = true;
        if (visibleLine.routeData) {
            lineEvents.showRoutePopup(e, visibleLine.routeData, visibleLine, invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    pathDrawing.drawRouteLines();
});

export { pathDrawing };
