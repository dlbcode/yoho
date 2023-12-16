const flightList = {

  addFlightDetailsToList: function(flight, clearFlightPaths) {
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
        clearFlightPaths();
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

}

export { flightList };