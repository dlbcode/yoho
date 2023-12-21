<template>
    <div>
      <!-- Your template code goes here -->
    </div>
  </template>
  
  <script>
  import L from 'leaflet'; // Import Leaflet
  import { flightList } from './flightList.vue';
  
  export default {
    name: 'flightMap',
    data() {
      return {
        map: null,
        markers: {},
        flightsByDestination: {},
        currentLines: [],
        selectedMarker: null,
        toggleState: 'from',
        flightPathCache: {},
        clearMultiHopPaths: true,
        cachedFlights: null,
        lastFetchTime: null,
        cacheDuration: 60000,
      };
    },
    methods: {
      flightMap() {
        // Assuming these properties exist in your component's data
        this.markers = {};
        this.flightsByDestination = {};
        this.currentLines = [];
        this.selectedMarker = null;
        this.toggleState = 'from';
        this.flightPathCache = {};
        this.clearMultiHopPaths = true;
      },
      plotFlightPaths() {
          const currentTime = new Date().getTime();
          if (this.cachedFlights && this.lastFetchTime && currentTime - this.lastFetchTime < this.cacheDuration) {
              this.processFlightData(this.cachedFlights);
          } else {
              fetch('http://localhost:3000/flights')
                  .then(response => response.json())
                  .then(data => {
                      this.cachedFlights = data;
                      this.lastFetchTime = currentTime;
                      this.processFlightData(data);
                  })
                  .catch(error => console.error('Error:', error));
          }
      },
  
      processFlightData(data) {
          data.forEach(flight => {
              if (!flight.originAirport || !flight.destinationAirport) {
                  console.info('Incomplete flight data:', flight);
                  return;
              }
  
              this.addMarker(flight.originAirport);
              this.addMarker(flight.destinationAirport);
  
              let destIata = flight.destinationAirport.iata_code;
              this.flightsByDestination[destIata] = this.flightsByDestination[destIata] || [];
              this.flightsByDestination[destIata].push(flight);
          });
      },
  
      addMarker(airport) {
          if (!airport || !airport.iata_code || !airport.weight) {
              console.error('Incomplete airport data:', airport);
              return;
          }
  
          let iata = airport.iata_code;
          if (this.markers[iata]) return;
  
          if (airport.weight <= this.map.getZoom()) {
              const latLng = L.latLng(airport.latitude, airport.longitude);
              const marker = L.marker(latLng, {icon: this.blueDotIcon}).addTo(this.map)
              .bindPopup(`<b>${airport.name}</b><br>${airport.city}, ${airport.country}`);
  
              this.markers[iata] = marker;
          }
      },
  
      handleMarkerClick(airport, clickedMarker) {
          const airportInfo = `${airport.city} (${airport.iata_code})`;
          console.log('handleMarkerClick airportInfo:', airportInfo, 'toggleState:', this.toggleState);
          const toggleState = document.getElementById('flightPathToggle').value;
          const fromAirportElem = document.getElementById('fromAirport');
          const toAirportElem = document.getElementById('toAirport');
  
          clickedMarker.setIcon(this.magentaDotIcon);
          this.selectedMarker = airport.iata_code;
  
          if ((toggleState === 'from' && fromAirportElem.value !== '') || 
              (toggleState === 'to' && toAirportElem.value !== '')) {
              this.findAndAddFlightToList(
                  toggleState === 'from' ? fromAirportElem.value : airportInfo, 
                  toggleState === 'from' ? airportInfo : toAirportElem.value
              );
  
              fromAirportElem.value = airportInfo;
              toAirportElem.value = '';
          } else {
              if (toggleState === 'from') {
                  fromAirportElem.value = airportInfo;
              } else {
                  toAirportElem.value = airportInfo;
              }
          }
      },
  
      findAndAddFlightToList(fromAirport, toAirport) {
          const fromIata = fromAirport.split('(')[1].slice(0, -1);
          const toIata = toAirport.split('(')[1].slice(0, -1);
          const flight = this.findFlight(fromIata, toIata);
          if (flight) {
              flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
          }
      },
  
      findFlight(fromIata, toIata) {
          for (const flights of Object.values(this.flightsByDestination)) {
              for (const flight of flights) {
                  if (flight.originAirport.iata_code === fromIata && flight.destinationAirport.iata_code === toIata) {
                      return flight;
                  }
              }
          }
          return null;
      },

      drawFlightPaths(iata) {
        this.clearFlightPaths();
        let cacheKey = this.toggleState + '_' + iata;
        if (this.flightPathCache[cacheKey]) {
            this.flightPathCache[cacheKey].forEach(path => {
                if (!this.map.hasLayer(path)) {
                    path.addTo(this.map);
                }
                if (!this.currentLines.includes(path)) {
                    this.currentLines.push(path);
                }
            });
        } else {
            this.toggleState === 'to' ? this.drawFlightPathsToDestination(iata) : this.drawFlightPathsFromOrigin(iata);
        }
    },

    drawFlightPathsFromOrigin(originIata) {
        Object.values(this.flightsByDestination).forEach(flights =>
            flights.forEach(flight => {
                if (flight.originAirport.iata_code === originIata) {
                    this.drawPaths(flight, originIata);
                }
            })
        );
    },

    drawFlightPathsToDestination(destinationIata) {
        const destinationFlights = this.flightsByDestination[destinationIata] || [];
        destinationFlights.forEach(flight => this.drawPaths(flight, destinationIata));
    },

    drawPaths(flight, iata) {
        this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
        for (let offset = -720; offset <= 720; offset += 360) {
            if (offset !== 0) {
                this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, offset);
            }
        }
    },

    createFlightPath(origin, destination, flight, lngOffset) {
        var adjustedOrigin = [origin.latitude, origin.longitude + lngOffset];
        var adjustedDestination = [destination.latitude, destination.longitude + lngOffset];

        var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: 1,
            opacity: 1,
            color: this.getColorBasedOnPrice(flight.price),
            wrap: false
        }).addTo(this.map);

        geodesicLine.flight = flight;

        geodesicLine.on('click', () => {
            if (flightList.isFlightListed(flight)) {
                flightList.removeFlightFromList(flight);
                this.clearFlightPaths();
            } else {
                flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
            }
        });

        geodesicLine.on('mouseover', (e) => {
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`Price: $${flight.price}`)
                .openOn(this.map);
        });

        geodesicLine.on('mouseout', () => {
            this.map.closePopup();
        });

        // Load the plane icon
        var planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
            iconSize: [16, 16],
            iconAnchor: [8, 12]
        });

        // Replace arrow symbol with plane icon
        var planeSymbol = L.Symbol.marker({
            rotate: true,
            markerOptions: {
                icon: planeIcon
            }
        });

        // Update polylineDecorator with planeSymbol
        var decoratedLine = L.polylineDecorator(geodesicLine, {
            patterns: [
                {offset: '50%', repeat: 0, symbol: planeSymbol}
            ]
        }).addTo(this.map);

        this.currentLines.push(geodesicLine, decoratedLine);

        let destinationIata = flight.destinationAirport.iata_code;
        let originIata = flight.originAirport.iata_code;
        let cacheKey = this.toggleState + '_' + (this.toggleState === 'to' ? destinationIata : originIata);

        this.flightPathCache[cacheKey] = this.flightPathCache[cacheKey] || [];
        this.flightPathCache[cacheKey].push(geodesicLine, decoratedLine);

        decoratedLine.on('mouseover', (e) => {
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`Price: $${flight.price}`)
                .openOn(this.map);
        });

        decoratedLine.on('mouseout', () => {
            this.map.closePopup();
        });

        decoratedLine.on('click', () => {
            flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
            this.clearFlightPaths();
        });

        geodesicLine.flight = flight;
        decoratedLine.flight = flight;

        return decoratedLine;
    },

    clearFlightPaths(exceptIata = null) {
        this.currentLines = this.currentLines.filter(line => {
            if (flightList.isFlightListed(line.flight)) {
                return true;
            } else {
                if (this.map.hasLayer(line)) {
                    this.map.removeLayer(line);
                }
                return false;
            }
        });

        if (exceptIata) {
            this.drawFlightPaths(exceptIata);
        }
    },

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey'; // Return grey for flights without price data
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    redrawMarkers() {
        Object.values(this.markers).forEach(marker => {
            var newLatLng = this.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    adjustLatLng(latLng) {
        var currentBounds = this.map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },

    updateMarkersForZoom() {
        Object.values(this.markers).forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = {};
        this.plotFlightPaths();
    },

    updateVisibleMarkers() {
      Object.keys(this.markers).forEach(iata => {
          const marker = this.markers[iata];
          if (!this.map.getBounds().contains(marker.getLatLng())) {
              this.map.removeLayer(marker);
              delete this.markers[iata];
          }
      });

      Object.values(this.flightsByDestination).forEach(flights => {
        flights.forEach(flight => {
            if (flight.originAirport) {
                this.addMarker(flight.originAirport);
            }
            if (flight.destinationAirport) {
                this.addMarker(flight.destinationAirport);
            }
        });
      });
    },
  },
};
</script>

  