import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { lineEvents } from './lineEvents.js';

class Line {
    constructor(origin, destination, routeId, type, options = {}) {
        this.origin = origin;
        this.destination = destination;
        this.routeId = routeId;
        this.type = type;
        this.map = map;

        this.defaultWeight = 1;
        this.defaultColor = this.getColorBasedOnPrice(options.price);

        this.color = options.color || this.defaultColor;
        this.weight = options.weight || this.defaultWeight;
        this.highlight = options.highlight || false;
        this.showPlane = options.showPlane || false;

        this.visibleLine = this.createVisibleLine();
        this.invisibleLine = this.createInvisibleLine();
        this.decoratedLine = this.showPlane ? this.createDecoratedLine() : null;

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
            weight: this.weight,
            opacity: 1,
            color: this.color,
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
        this.visibleLine.setStyle({ color: this.color });
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

    drawLine: function(routeId, type, options) {
        const [originIata, destinationIata] = routeId.split('-');
        if (!originIata || !destinationIata) {
            console.error('Invalid routeId format:', routeId);
            return;
        }
        flightMap.getAirportDataByIata(originIata).then(originAirport => {
            flightMap.getAirportDataByIata(destinationIata).then(destinationAirport => {
                if (!originAirport || !destinationAirport) {
                    console.error('Airport data not found for one or both IATAs:', originIata, destinationIata);
                    return;
                }
                const line = new Line(originAirport, destinationAirport, routeId, type, options);
                this.currentLines.push(line);
                if (!this.routePathCache[routeId]) {
                    this.routePathCache[routeId] = [];
                }
                this.routePathCache[routeId].push(line);
            });
        });
    },

    drawRoutePaths(iata, directRoutes) {
        directRoutes[iata]?.forEach(route => {
            const routeId = `${route.origin}-${route.destination}`;
            if (!route.origin || !route.destination) {
                console.error('Invalid route data:', route);
                return;
            }
            this.drawLine(routeId, 'route', { price: route.price });
        });
    },

    drawDashedLine(originAirport, destinationAirport) {
        if (!originAirport.iata_code || !destinationAirport.iata_code) {
            console.error('Invalid airport data for dashed line:', originAirport, destinationAirport);
            return;
        }
        this.drawLine(`${originAirport.iata_code}-${destinationAirport.iata_code}`, 'dashed', {});
    },

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },

    drawLines: function() {
        this.currentLines.forEach(line => {
            line.visibleLine.addTo(map);
            line.invisibleLine.addTo(map);
            if (line.decoratedLine) {
                line.decoratedLine.addTo(map);
            }
        });
    },

    drawRouteLines: function() {
        this.currentLines.forEach(line => {
            line.visibleLine.addTo(map);
            line.invisibleLine.addTo(map);
            if (line.decoratedLine) {
                line.decoratedLine.addTo(map);
            }
        });
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

export { pathDrawing, Line };