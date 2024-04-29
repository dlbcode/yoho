import { appState } from '../stateManager.js';

function logFilterState() {
    console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

export { logFilterState };
