import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { lineManager } from './lineManager.js';

class Line {
    constructor(originAirport, destinationAirport, routeId, type, options = {}) {
        this.iata = options.iata;
        this.origin = originAirport;
        this.destination = destinationAirport;
        this.routeId = routeId;
        this.type = type;
        this.map = map;
        this.defaultWeight = 1;
        this.defaultColor = this.getColorBasedOnPrice(options.price);
        this.color = options.color || this.defaultColor;
        this.weight = options.weight || this.defaultWeight;
        this.visibleLine = this.createVisibleLine();
        this.invisibleLine = this.createInvisibleLine();
        this.decoratedLine = options.showPlane ? this.createDecoratedLine() : null;
        this.bindEvents();
        this.tags = new Set();
        this.addTags(options);
        this.routeData = options.routeData; // Store routeData

        // Create the visible and invisible lines
        const coordinates = [[originAirport.latitude, originAirport.longitude], 
                           [destinationAirport.latitude, destinationAirport.longitude]];
        
        this.visibleLine = L.geodesic([coordinates], {
            weight: 1,
            opacity: 0.7,
            color: options.color || flightMap.getColorBasedOnPrice(options.price),
            wrap: false
        }).on('mouseover', (e) => lineManager.onMouseOver(e, this))
          .on('mouseout', () => lineManager.onMouseOut(this))
          .on('click', (e) => lineManager.onClickHandler(e, this));
    }

    addTag(tag) {
        this.tags.add(tag);
    }

    addTags(options) {
        this.addTag(`route:${this.routeId}`);
        this.addTag(`routeId:${this.routeId}`);
        this.addTag(`type:${this.type}`);
        // Add type:route tag for both direct and dashed lines
        if (this.type === 'route' || this.type === 'dashed') {
            this.addTag('type:route');
        }
        if (options.isTableRoute) this.addTag('type:table');
        if (options.group) this.addTag(`group:${options.group}`);
        if (options.price !== undefined && options.price !== null) {
            this.addTag(`price:${options.price}`);
            this.addTag(`price-range:${this.getPriceRange(options.price)}`);
        }
        if (options.departureTime !== undefined) {
            this.addTag(`departure-range:${this.getTimeRange(options.departureTime)}`);
        }
        if (options.arrivalTime !== undefined) {
            this.addTag(`arrival-range:${this.getTimeRange(options.arrivalTime)}`);
        }
        this.addTag(`direct:${options.isDirect ? 'true' : 'false'}`);
        this.addTag(`group:${options.groupNumber}`); // Add group tag
    }

    getPriceRange(price) {
        if (price < 100) return '0-100';
        if (price < 200) return '100-200';
        if (price < 300) return '200-300';
        if (price < 400) return '300-400';
        if (price < 500) return '400-500';
        return '500+';
    }

    getTimeRange(time) {
        if (time < 6) return '00-06';
        if (time < 12) return '06-12';
        if (time < 18) return '12-18';
        return '18-24';
    }

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) return 'grey';
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
        this.visibleLine.on('click', (e) => lineManager.onClickHandler(e, this));
        this.invisibleLine.on('click', (e) => lineManager.onClickHandler(e, this));
        this.invisibleLine.on('mouseover', (e) => lineManager.onMouseOver(e, this, this.map));
        this.invisibleLine.on('mouseout', () => lineManager.onMouseOut(this));
        if (this.decoratedLine) {
            this.decoratedLine.on('click', (e) => this.invisibleLine.fire('click', e));
            this.decoratedLine.on('mouseover', (e) => lineManager.onMouseOver(e, this, this.map));
            this.decoratedLine.on('mouseout', () => lineManager.onMouseOut(this));
        }
    }

    highlight() {
        this.visibleLine.setStyle({ color: 'white' });
    }

    reset() {
        this.visibleLine.setStyle({
            color: this.color,
            weight: this.weight,
            opacity: 1
        });
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
    hoverLines: [],

    drawLine: function (routeId, type, options) {
        const [originIata, destinationIata] = routeId.split('-');
        if (!originIata || destinationIata === 'Any') return;

        flightMap.getAirportDataByIata(originIata).then(originAirport => {
            if (!originAirport) return console.error('Origin airport data not found:', originIata);
            if (destinationIata !== 'Any') {
                flightMap.getAirportDataByIata(destinationIata).then(destinationAirport => {
                    if (!destinationAirport) return console.error('Destination airport data not found:', destinationIata);
                    
                    // Create route data object
                    const routeData = {
                        originAirport,
                        destinationAirport,
                        price: options.price,
                        date: options.date
                    };

                    const line = new Line(originAirport, destinationAirport, routeId, type, {
                        ...options,
                        routeData // Pass routeData to Line constructor
                    });
                    this.cacheLine(routeId, type, line);
                });
            }
        });
    },

    cacheLine(routeId, type, line) {
        if (type === 'route') {
            this.routePathCache[routeId] = this.routePathCache[routeId] || [];
            this.routePathCache[routeId].push(line);
        } else if (type === 'dashed') {
            this.dashedRoutePathCache[routeId] = this.dashedRoutePathCache[routeId] || [];
            this.dashedRoutePathCache[routeId].push(line);
        } else if (type === 'hover') {
            this.hoverLines.push(line);
        }
    },

    drawRoutePaths(iata, directRoutes, type = 'route') {
        directRoutes[iata]?.forEach(route => {
            const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
            if (!route.originAirport || !route.destinationAirport) return console.error('Invalid route data:', route);
            this.drawLine(routeId, type, {
                price: route.price,
                iata: iata,
                isTableRoute: type === 'route'
            });
        });
    },

    drawDashedLine(origin, destination) {
        if (!origin || !destination) return console.error('Invalid airport data for dashed line:', origin, destination);
        this.drawLine(`${origin}-${destination}`, 'dashed', {});
    },

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;
        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;
        return L.latLng(latLng.lat, newLng);
    },

    drawLines: async function () {
        lineManager.clearLines('route');
        const drawPromises = appState.routes.map((route, index) => {
            const routeId = `${route.origin}-${route.destination}`;
            if (route.isDirect) {
                return this.drawLine(routeId, 'route', {
                    price: route.price,
                    // Only set group if route is selected
                    ...(appState.selectedRoutes[index] && {
                        group: appState.selectedRoutes[index].group
                    })
                });
            } else {
                return this.drawDashedLine(route.origin, route.destination);
            }
        });
        await Promise.all(drawPromises);
        if (appState.selectedAirport) {
            this.drawRoutePaths(appState.selectedAirport.iata_code, appState.directRoutes, appState.routeDirection);
        }
    },

    onClick(e, visibleLine, invisibleLine) {
        this.popupFromClick = true;
        if (visibleLine.routeData) {
            lineManager.showRoutePopup(e, visibleLine.routeData, visibleLine, invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    pathDrawing.drawLines();
});

export { pathDrawing, Line };