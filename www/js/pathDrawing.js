import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { lineEvents } from './lineEvents.js';

class lineSet {
    constructor(map, origin, destination, routeData, onClick, isTableRoute = false) {
        this.map = map;
        this.origin = origin;
        this.destination = destination;
        this.routeData = routeData;
        this.onClick = onClick;
        this.isTableRoute = isTableRoute;
        this.lines = [];
        this.decoratedLine = null;
        this.hoverPopup = null;
        this.hoveredLine = null;
    }

    createLines(shouldDecorate) {
        const lines = [];
        const worldCopies = [-720, -360, 0, 360, 720];
        worldCopies.forEach(offset => {
            const adjustedOrigin = L.latLng(this.origin.latitude, this.origin.longitude + offset);
            const adjustedDestination = L.latLng(this.destination.latitude, this.destination.longitude + offset);
            const lineColor = pathDrawing.getColorBasedOnPrice(this.routeData.price);

            const visibleLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 1,
                opacity: 1,
                color: lineColor,
                wrap: false,
                zIndex: -1,
                isTableRoute: this.isTableRoute
            }).addTo(this.map);

            const invisibleLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 10,
                opacity: 0.1,
                wrap: false,
                isTableRoute: this.isTableRoute
            }).addTo(this.map);

            let decoratedLine = null;
            if (shouldDecorate) {
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

                decoratedLine = L.polylineDecorator(visibleLine, {
                    patterns: [
                        { offset: '50%', repeat: 0, symbol: planeSymbol }
                    ]
                }).addTo(this.map);
            }

            visibleLine.routeData = this.routeData;
            invisibleLine.routeData = this.routeData;
            visibleLine.originalColor = lineColor;

            visibleLine.on('click', (e) => lineEvents.onClickHandler(e, visibleLine, invisibleLine, this.onClick.bind(this)));
            invisibleLine.on('click', (e) => lineEvents.onClickHandler(e, visibleLine, invisibleLine, this.onClick.bind(this)));

            invisibleLine.on('mouseover', (e) => lineEvents.onMouseOver(e, visibleLine, this.map, this.hoveredLine, this.hoverPopup, this.routeData, pathDrawing));
            invisibleLine.on('mouseout', () => lineEvents.onMouseOut(visibleLine, this.map, this.hoveredLine, this.hoverPopup, pathDrawing));

            if (decoratedLine) {
                decoratedLine.on('click', (e) => invisibleLine.fire('click', e));
                decoratedLine.on('mouseover', (e) => lineEvents.onMouseOver(e, visibleLine, this.map, this.hoveredLine, this.hoverPopup, this.routeData, pathDrawing));
                decoratedLine.on('mouseout', () => lineEvents.onMouseOut(visibleLine, this.map, this.hoveredLine, this.hoverPopup, pathDrawing));
            }

            lines.push({ visibleLine, invisibleLine, decoratedLine });
        });
        return lines;
    }

    highlightLine(line) {
        line.setStyle({ color: 'white' });
    }

    resetLine(line) {
        line.setStyle({ color: line.originalColor });
    }

    removeAllLines() {
        this.lines.forEach(linePair => {
            if (this.map.hasLayer(linePair.visibleLine)) this.map.removeLayer(linePair.visibleLine);
            if (this.map.hasLayer(linePair.invisibleLine)) this.map.removeLayer(linePair.invisibleLine);
            if (linePair.decoratedLine && this.map.hasLayer(linePair.decoratedLine)) this.map.removeLayer(linePair.decoratedLine);
        });
    }
}

export { lineSet };

const pathDrawing = {
    currentLines: [],
    routePathCache: {},
    dashedRoutePathCache: {},
    popupFromClick: false,

    drawRoutePaths(iata, directRoutes) {
        let cacheKey = appState.routeDirection + '_' + iata;
        if (this.routePathCache[cacheKey]) {
            this.routePathCache[cacheKey].forEach(lineSet => {
                lineSet.lines.forEach(linePair => {
                    linePair.visibleLine.addTo(map);
                    linePair.invisibleLine.addTo(map);
                    if (linePair.decoratedLine) linePair.decoratedLine.addTo(map);
                });
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
        if (this.routePathCache[routeId]) {
            console.log(`Route ${routeId} already exists. Skipping creation.`);
            return;
        }
    
        let shouldDecorate = appState.routes.some(r =>
            r.origin === route.originAirport.iata_code &&
            r.destination === route.destinationAirport.iata_code
        );
    
        let newlineSet = new lineSet(map, origin, destination, routeData, this.onClick.bind(this), isTableRoute);
        newlineSet.lines = newlineSet.createLines(shouldDecorate);
    
        newlineSet.lines.forEach(line => {
            line.visibleLine.routeData = routeData; // Ensure routeData is set
            line.visibleLine.routeData.tableRouteId = tableRouteId; // Set tableRouteId
        });
    
        this.routePathCache[routeId] = this.routePathCache[routeId] || [];
        this.routePathCache[routeId].push(newlineSet);
    
        if (tableRouteId) {
            this.routePathCache[tableRouteId] = this.routePathCache[tableRouteId] || [];
            this.routePathCache[tableRouteId].push(newlineSet);
        }
    
        if (shouldDecorate) {
            this.currentLines.push(newlineSet);
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
