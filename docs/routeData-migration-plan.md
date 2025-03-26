# Migration Plan: Transitioning from Legacy Waypoints to RouteData

This document outlines the plan for completely migrating from the legacy waypoints array-based structure to the new routeData object structure. The migration is already partially complete, but some legacy code remains.

## Current Status

- `appState.routeData` is now the primary source of truth for routes
- Most components have been updated to use routeData
- Legacy structures are still maintained for backward compatibility:
  - `appState.waypoints`: Array of waypoints (origins and destinations alternating)
  - `appState.routes`: Array of route objects 
  - `appState.routeDates`: Object mapping route numbers to departure/return dates

## Migration Steps

### Phase 1: Already Completed
- Created `routeData` structure
- Updated core route handling functions to operate on `routeData`
- Added sync function to keep legacy structures updated

### Phase 2: Current Phase
- Remove direct usage of legacy structures in app logic
- Clean up instances where both structures are being maintained
- Simplify `updateRoutesArray()` by removing legacy code

### Phase 3: Final Phase
1. Remove all code that updates the legacy structures
2. Remove the `syncRouteDataWithWaypoints` function
3. Remove legacy structures from the appState object
4. Update any remaining imports/references

## Files Requiring Updates

1. `routeHandling.js`: Eliminate legacy waypoints processing
2. `stateManager.js`: Remove legacy structure updates
3. `infoPane.js`: Ensure all route access uses routeData
4. `eventManager.js`: Only track changes in routeData

## Testing

After each phase:
1. Test all route creation flows
2. Test "Any" origin and destination handling 
3. Test multi-segment routes
4. Test URL parsing and generation
5. Verify map displays correctly

## Timeline

- Phase 2: Complete by end of Q3
- Phase 3: Complete by end of Q4

## Notes

- The `waypoints` array structure relies on even indices for origins and odd indices for destinations
- The `routeData` structure maintains a clear separation between origin and destination
- RouteData also includes trip type, travelers, and dates, consolidating data that was previously spread across multiple structures
