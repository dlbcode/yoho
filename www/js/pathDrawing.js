import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { showRoutePopup } from './routePopup.js';

class LineSet {
    constructor(map, origin, destination, routeData, onClick, isTableRoute = false) {
        this.map = map;
        this.origin = origin;
        this.destination = destination;
        this.routeData = routeData;
        this.onClick = onClick;
        this.isTableRoute = isTableRoute;
        this.lines = this.createLines();
        this.decoratedLine = null;
    }

    createLines() {
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

            visibleLine.routeData = this.routeData;
            invisibleLine.routeData = this.routeData;
            visibleLine.originalColor = lineColor; // Store the original color

            visibleLine.on('click', (e) => this.onClick(e, visibleLine));
            invisibleLine.on('click', (e) => this.onClick(e, invisibleLine));

            const onMouseOver = (e) => {
                if (!pathDrawing.popupFromClick) {
                  visibleLine.originalColor = visibleLine.options.color;
                  visibleLine.setStyle({ color: 'white' });
        
                  let displayPrice = Math.round(this.routeData.price);
                  let content = `<div style=\"line-height: 1.2; margin: 0;\">${this.destination.city}<br><span><strong><span style=\"color: #ccc; font-size: 14px;\">$${displayPrice}</span></strong></span>`;
                  if (this.routeData.date) {
                    let lowestDate = new Date(this.routeData.date).toLocaleDateString("en-US", {
                      year: 'numeric', month: 'long', day: 'numeric'
                    });
                    content += `<br><span style=\"line-height: 1; display: block; color: #666\">on ${lowestDate}</span>`;
                  }
                  content += `</div>`;
        
                  const mouseoverPopup = L.popup({ autoClose: false, closeOnClick: true })
                    .setLatLng(e.latlng)
                    .setContent(content)
                    .openOn(this.map);
                }
              };
        
              const onMouseOut = () => {
                if (!pathDrawing.popupFromClick) {
                  visibleLine.setStyle({ color: visibleLine.originalColor });
                  this.map.closePopup();
                }
              };
        
              invisibleLine.on('mouseover', onMouseOver);
              invisibleLine.on('mouseout', onMouseOut);
        
            lines.push({ visibleLine, invisibleLine });
        });
        return lines;
    }

    highlightLine(line) {
        line.setStyle({ color: 'white' });
    }

    resetLine(line) {
        line.setStyle({ color: line.originalColor }); // Reset to the original color
    }

    addDecoratedLine() {
        var planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
            iconSize: [16, 16],
            iconAnchor: [8, 12]
        });

        var planeSymbol = L.Symbol.marker({
            rotate: true,
            markerOptions: {
                icon: planeIcon
            }
        });

        this.decoratedLine = L.polylineDecorator(this.lines[0].visibleLine, {
            patterns: [
                { offset: '50%', repeat: 0, symbol: planeSymbol }
            ]
        }).addTo(this.map);
    }

    removeAllLines() {
        this.lines.forEach(linePair => {
            if (this.map.hasLayer(linePair.visibleLine)) this.map.removeLayer(linePair.visibleLine);
            if (this.map.hasLayer(linePair.invisibleLine)) this.map.removeLayer(linePair.invisibleLine);
        });
        if (this.decoratedLine && this.map.hasLayer(this.decoratedLine)) this.map.removeLayer(this.decoratedLine);
    }
}

const pathDrawing = {
    currentLines: [],
    hoverLines: [],
    hoverLinePairs: [],
    invisibleLines: [],
    decoratedLines: [],
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
                });
                if (lineSet.decoratedLine) lineSet.decoratedLine.addTo(map);
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
            const adjustedDestination = L.latLng(destinationAirport.latitude, destinationAirport.longitude + offset);
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
        let newLineSet = new LineSet(map, origin, destination, routeData, this.onClick, isTableRoute);

        this.routePathCache[routeId] = this.routePathCache[routeId] || [];
        this.routePathCache[routeId].push(newLineSet);

        const routeExists = appState.routes.some(r =>
            r.origin === route.originAirport.iata_code &&
            r.destination === route.destinationAirport.iata_code
        );

        if (routeExists) {
            newLineSet.addDecoratedLine();
            this.currentLines.push(newLineSet);
        }
    },

    clearLines(all = false) {
        Object.values(this.routePathCache).forEach(lineSetArray => {
            lineSetArray.forEach(lineSet => lineSet.removeAllLines());
        });

        if (all) {
            this.routePathCache = {};
            this.dashedRoutePathCache = {};
        }

        map.closePopup();

        this.hoverLinePairs = [];
        this.hoverLines = [];
        this.invisibleLines = [];
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
            console.log('Route line clicked', geodesicLine.routeData);
            showRoutePopup(e, geodesicLine.routeData, geodesicLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    }
};

export { pathDrawing };
