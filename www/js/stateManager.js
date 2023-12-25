const appState = {
  fromAirport: null,
  toAirport: null,
  numTravelers: 1,
  flightPathToggle: 'from',
  // ... other state properties
};

function updateState(key, value) {
  appState[key] = value;
  handleStateChange(key, value);
  document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
}

function handleStateChange(key, value) {
  switch (key) {
    case 'selectedAirport':
      console.log('STATE Selected Airport Changed:', value);
      break;
      case 'fromAirport':
          console.log('STATE From Airport Changed:', value);
          break;
      case 'toAirport':
          console.log('STATE To Airport Changed:', value);
          break;
      case 'numTravelers':
          console.log('STATE Number of Travelers Changed:', value);
          break;
      case 'flightPathToggle':
          console.log('STATE Flight Path Toggle Changed:', value);
          break;
      // ... handle other state changes
  }
}

export { appState, updateState, handleStateChange };
