import { map } from './mapInit.js';
import { blueDotIcon } from './markers.js';

const FlightMap = {
    markers: {},
    flightsByDestination: {},
    currentLines: [],
    selectedMarker: null,
    toggleState: 'to',

    drawFlightPaths(iata) {
        this.toggleState === 'to' ? this.drawFlightPathsToDestination(iata) : this.drawFlightPathsFromOrigin(iata);
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

    plotFlightPaths() {
        fetch('http://localhost:3000/flights')
            .then(response => response.json())
            .then(data => {
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
            })
            .catch(error => console.error('Error:', error));
    },

    addMarker(airport) {
      if (!airport || !airport.iata_code || !airport.weight) {
          console.error('Incomplete airport data:', airport);
          return;
      }

      let iata = airport.iata_code;
      if (this.markers[iata]) return;

      // Check if the airport's weight is less than or equal to the current zoom level
      if (airport.weight <= map.getZoom()) {
          const latLng = L.latLng(airport.latitude, airport.longitude);
          const marker = L.marker(latLng, {icon: blueDotIcon}).addTo(map)
              .bindPopup(`<b>${airport.name}</b><br>${airport.city}, ${airport.country}`);

          marker.on('click', () => this.markerClickHandler(iata));
          marker.on('mouseover', () => this.markerHoverHandler(iata, 'mouseover'));
          marker.on('mouseout', () => this.markerHoverHandler(iata, 'mouseout'));

          this.markers[iata] = marker;
      }
    },

    drawFlightPathsToDestination(destinationIata) {
        const destinationFlights = this.flightsByDestination[destinationIata] || [];
        destinationFlights.forEach(flight => this.drawPaths(flight, destinationIata));
    },

    createFlightPath: function(origin, destination, flight, lngOffset) {
      var adjustedOrigin = [origin.latitude, origin.longitude + lngOffset];
      var adjustedDestination = [destination.latitude, destination.longitude + lngOffset];
  
      var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
          weight: 6,
          opacity: .7,
          color: this.getColorBasedOnPrice(flight.price),
          wrap: false
      }).addTo(map);
  
      geodesicLine.flight = flight; // Attach flight data to the line
  
      // Event listener for path click
      geodesicLine.on('click', () => {
          if (this.isFlightListed(flight)) {
              this.removeFlightFromList(flight);
              this.clearFlightPaths();
          } else {
              this.addFlightDetailsToList(flight);
          }
      });
  
      // Attach event listeners to the geodesic line
      geodesicLine.on('mouseover', (e) => {
          L.popup()
              .setLatLng(e.latlng)
              .setContent(`Price: $${flight.price}`)
              .openOn(map);
      });
  
      geodesicLine.on('mouseout', () => {
          map.closePopup();
      });
  
      var directionSymbol = L.Symbol.arrowHead({
          pixelSize: 5,
          polygon: false,
          pathOptions: {
              stroke: true,
              color: '#fff',
              opacity: .7,
              weight: 2
          }
      });
      
      var decoratedLine = L.polylineDecorator(geodesicLine, {
          patterns: [
              {offset: '25px', repeat: '50px', symbol: directionSymbol}
          ]
      }).addTo(map);
  
      // Store both the geodesic line and the decorated line
      this.currentLines.push(geodesicLine, decoratedLine);
  
      // Attach event listeners to the decorated line
      decoratedLine.on('mouseover', (e) => {
          L.popup()
              .setLatLng(e.latlng)
              .setContent(`Price: $${flight.price}`)
              .openOn(map);
      });
  
      decoratedLine.on('mouseout', () => {
          map.closePopup();
      });
  
      decoratedLine.on('click', () => {
          this.addFlightDetailsToList(flight);
      });

      geodesicLine.flight = flight;
      decoratedLine.flight = flight;
  
      return decoratedLine;
    },

    clearFlightPaths(exceptIata = null) {
        this.currentLines = this.currentLines.filter(decoratedLine => {
            if (!this.isFlightListed(decoratedLine.flight)) {
                map.removeLayer(decoratedLine);
                return false;
            }
            return true;
        });
    
        if (exceptIata) {
            this.drawFlightPathsToDestination(exceptIata);
        }
    },

    getColorBasedOnPrice: function(price) {
      if (price === null || price === undefined || isNaN(parseFloat(price))) {
          return 'grey'; // Return grey for flights without price data
      }
      price = parseFloat(price);
      return price < 200 ? 'green' : price < 500 ? '#3B74D5' : '#c32929';
    },

    redrawMarkers: function() {
        Object.values(this.markers).forEach(marker => {
            var newLatLng = this.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    adjustLatLng: function(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },

    addFlightDetailsToList: function(flight) {
      var list = document.getElementById('flightDetailsList');
      var listItem = document.createElement('li');
      listItem.innerHTML = `${flight.originAirport.iata_code} to ${flight.destinationAirport.iata_code} - $${flight.price}`;
  
      // Create the 'X' button
      var removeButton = document.createElement('button');
      removeButton.innerHTML = 'X';
      removeButton.style.marginLeft = '10px';
      removeButton.onclick = () => {
          list.removeChild(listItem);
          this.updateTotalCost();
          this.clearFlightPaths(); // Call clearFlightPaths function
      };
  
      // Prevent tooltip from showing when hovering over the remove button
      removeButton.onmouseover = (e) => {
          e.stopPropagation(); // Stop the mouseover event from bubbling up to the list item
      };

      listItem.setAttribute('data-price', flight.price);
  
      listItem.appendChild(removeButton);
  
      var details = `${flight.originAirport.city}, ${flight.originAirport.country} - ${flight.destinationAirport.city}, ${flight.destinationAirport.country} - Price: $${flight.price}`;
      
      listItem.onmouseover = function(e) {
          var tooltip = document.createElement('div');
          tooltip.className = 'tooltip';
          tooltip.innerHTML = details;
          tooltip.style.left = e.pageX + 'px';
          tooltip.style.top = e.pageY + 'px';
          document.body.appendChild(tooltip);
      };
  
      listItem.onmouseout = function() {
          var tooltips = document.getElementsByClassName('tooltip');
          while (tooltips.length > 0) {
              tooltips[0].parentNode.removeChild(tooltips[0]);
          }
      };
  
      list.appendChild(listItem);
      this.updateTotalCost();
    },

    isFlightListed: function(flight) {
      var listItems = document.getElementById('flightDetailsList').children;
      for (let i = 0; i < listItems.length; i++) {
          if (listItems[i].innerHTML.includes(`${flight.originAirport.iata_code} to ${flight.destinationAirport.iata_code}`)) {
              return true;
          }
      }
      return false;
    },

    removeFlightFromList: function(flight) {
      var list = document.getElementById('flightDetailsList');
      var listItems = list.children;
      for (let i = 0; i < listItems.length; i++) {
          if (listItems[i].innerHTML.includes(`${flight.originAirport.iata_code} to ${flight.destinationAirport.iata_code}`)) {
              list.removeChild(listItems[i]);
              break;
          }
      }
      this.updateTotalCost();
    },

    numTravelers: 1,

    initTravelerControls() {
        ['increaseTravelers', 'decreaseTravelers'].forEach(id =>
            document.getElementById(id).addEventListener('click', () => this.updateTravelers(id)));
    },

    updateTotalCost: function() {
      var totalCost = 0;
      var listItems = document.getElementById('flightDetailsList').children;
      for (let i = 0; i < listItems.length; i++) {
          var cost = parseFloat(listItems[i].getAttribute('data-price'));
          if (!isNaN(cost)) {
              totalCost += cost;
          }
      }
      totalCost *= this.numTravelers;
      document.getElementById('totalCost').textContent = `Total Trip Cost: $${totalCost.toFixed(2)}`;
      document.getElementById('numTravelers').value = this.numTravelers;
    },

    updateTravelers(id) {
        if (id === 'increaseTravelers') {
            this.numTravelers++;
        } else if (this.numTravelers > 1) {
            this.numTravelers--;
        }
        this.updateTotalCost();
    },

    drawPaths(flight, iata) {
        this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
        for (let offset = -720; offset <= 720; offset += 360) {
            if (offset !== 0) {
                this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, offset);
            }
        }
    },

    markerClickHandler(iata) {
        if (this.selectedMarker) {
            this.clearFlightPaths(this.selectedMarker);
        }
        this.clearFlightPaths();
        this.selectedMarker = iata;
        this.drawFlightPaths(iata);
    },

    markerHoverHandler(iata, event) {
        if (this.selectedMarker !== iata) {
            this.clearFlightPaths();
            if (event === 'mouseover') {
                this.drawFlightPaths(iata);
            } else if (this.selectedMarker) {
                this.drawFlightPaths(this.selectedMarker);
            }
        }
    },

    updateMarkersForZoom() {
      Object.values(this.markers).forEach(marker => {
          map.removeLayer(marker);
      });
      this.markers = {};
      // Re-fetch and re-plot the airports based on the new zoom level
      this.plotFlightPaths();
  },
};

export { FlightMap };
