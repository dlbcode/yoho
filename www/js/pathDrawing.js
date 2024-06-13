import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { showRoutePopup } from './routePopup.js';

// Utility function to throttle events
function throttle(fn, wait) {
    let time = Date.now();
    return function (...args) {
        if ((time + wait - Date.now()) < 0) {
            fn(...args);
            time = Date.now();
        }
    };
}

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
        this.currentPopup = null; // Track the current popup
        this.hoveredLine = null; // Track the current hovered line
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
            }).addTo(this.map); // Ensure line is added to the map

            const invisibleLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 10,
                opacity: 0.1,
                wrap: false,
                isTableRoute: this.isTableRoute
            }).addTo(this.map); // Ensure line is added to the map

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
                }).addTo(this.map); // Ensure line is added to the map
            }

            visibleLine.routeData = this.routeData;
            invisibleLine.routeData = this.routeData;
            visibleLine.originalColor = lineColor; // Store the original color
    
            const onClickHandler = (e, line) => this.onClick(e, line);
    
            visibleLine.on('click', (e) => onClickHandler(e, visibleLine));
            invisibleLine.on('click', (e) => onClickHandler(e, invisibleLine));
    
            const onMouseOver = throttle((e) => {
                if (!pathDrawing.popupFromClick) {
                    if (this.hoveredLine && this.hoveredLine !== visibleLine) {
                        this.hoveredLine.setStyle({ color: this.hoveredLine.originalColor });
                        this.map.closePopup(this.currentPopup);
                    }
    
                    this.hoveredLine = visibleLine;
                    visibleLine.setStyle({ color: 'white' });
    
                    let displayPrice = Math.round(this.routeData.price);
                    let content = `<div style="line-height: 1.2; margin: 0;">${this.destination.city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>`;
                    if (this.routeData.date) {
                        let lowestDate = new Date(this.routeData.date).toLocaleDateString("en-US", {
                            year: 'numeric', month: 'long', day: 'numeric'
                        });
                        content += `<br><span style="line-height: 1; display: block; color: #666">on ${lowestDate}</span>`;
                    }
                    content += `</div>`;
    
                    this.currentPopup = L.popup({ autoClose: false, closeOnClick: true })
                        .setLatLng(e.latlng)
                        .setContent(content)
                        .openOn(this.map);
                }
            }, 100);
    
            const onMouseOut = throttle(() => {
                if (!pathDrawing.popupFromClick && this.hoveredLine === visibleLine) {
                    visibleLine.setStyle({ color: visibleLine.originalColor });
                    this.map.closePopup(this.currentPopup);
                    this.hoveredLine = null;
                    this.currentPopup = null;
                }
            }, 100);
    
            invisibleLine.on('mouseover', onMouseOver);
            invisibleLine.on('mouseout', onMouseOut);
    
            // Add event listeners for decorated line
            if (decoratedLine) {
                decoratedLine.on('click', (e) => invisibleLine.fire('click', e)); // Simulate click on invisible line
                decoratedLine.on('mouseover', onMouseOver);
                decoratedLine.on('mouseout', onMouseOut);
            }
    
            lines.push({ visibleLine, invisibleLine, decoratedLine });
        });
        return lines;
    }

    highlightLine(line) {
        line.setStyle({ color: 'white' });
    }

    resetLine(line) {
        line.setStyle({ color: line.originalColor }); // Reset to the original color
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

    async createRoutePath(origin, destination, route, lineColor = null, isTableRoute = false) {
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
        let shouldDecorate = appState.routes.some(r =>
            r.origin === route.originAirport.iata_code &&
            r.destination === route.destinationAirport.iata_code
        );

        let newlineSet = new lineSet(map, origin, destination, routeData, this.onClick, isTableRoute);
        newlineSet.lines = newlineSet.createLines(shouldDecorate);

        this.routePathCache[routeId] = this.routePathCache[routeId] || [];
        this.routePathCache[routeId].push(newlineSet);

        if (shouldDecorate) {
            this.currentLines.push(newlineSet);
        }
    },

    clearLines(all = false) {
        console.log('Clearing lines all:', all);
        Object.values(this.routePathCache).forEach(lineSetArray => {
            lineSetArray.forEach(lineSet => {
                lineSet.removeAllLines();
            });
        });

        if (all) {
            this.routePathCache = {};
            this.dashedRoutePathCache = {};
        }

        map.closePopup();
    },

    drawLines: async function() {
        this.clearLines(false); // Ensure all lines are cleared properly except for table lines

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

        // First, determine the min and max prices
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

        // Function to determine color based on price
        const getColorForPrice = (price) => {
            const relativePrice = price - minPrice;
            if (relativePrice <= quartile) return 'green';
            if (relativePrice <= quartile * 2) return 'yellow';
            if (relativePrice <= quartile * 3) return 'orange';
            return 'red';
        };

        for (const row of rows) {
            if (row.style.display === 'none') continue;

            const routeLineId = row.getAttribute('data-route-id'); // Get the routeLineId from the row
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

                    // Pass the routeLineId to createRoutePath
                    this.createRoutePath(originAirportData, destinationAirportData, {
                        originAirport: originAirportData,
                        destinationAirport: destinationAirportData,
                        price: price, // Pass the parsed numeric price
                    }, color, routeLineId); // Pass the determined color and routeLineId
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

    onClick(e, geodesicLine) {
        this.popupFromClick = true;
        if (geodesicLine.routeData) {
            showRoutePopup(e, geodesicLine.routeData, geodesicLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    pathDrawing.drawRouteLines();
});

export { pathDrawing };
