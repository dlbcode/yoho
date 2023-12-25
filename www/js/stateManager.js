const appState = {
  fromAirport: null,
  toAirport: null,
  // ... other state properties
};

function updateState(key, value) {
  appState[key] = value;
  handleStateChange(key, value);
}

function handleStateChange(key, value) {
  switch (key) {
      case 'fromAirport':
          console.log(value);
          break;
      case 'toAirport':
          console.log(value);
          break;
      // ... handle other state changes
  }
}


export { appState, updateState, handleStateChange };
