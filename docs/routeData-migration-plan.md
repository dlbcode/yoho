# Migration Plan: Transitioning from Legacy Waypoints to RouteData

This document outlines the plan for completely migrating from the legacy waypoints array-based structure to the new routeData object structure. The migration is already partially complete, but some legacy code remains.

## Current Status

- `appState.routeData` is now the primary source of truth for routes
- Most components have been updated to use routeData
- Legacy structures are still maintained for backward compatibility:
  - `appState.waypoints`: Array of waypoints (origins and destinations alternating)
  - `appState.routes`: Array of route objects 
  - `appState.routeDates`: Object mapping route numbers to departure/return dates

## Migration Progress

### Phase 1: Completed
- Created `routeData` structure
- Updated core route handling functions to operate on `routeData`
- Added sync function to keep legacy structures updated

### Phase 2: In Progress (80% Complete)
- ✅ Removed direct usage of legacy structures in app logic
- ✅ Simplified `updateTravelers` case by removing legacy structure update
- ✅ Simplified `removeWaypoint` and `removeWaypoints` to emphasize routeData
- ✅ Improved `updateRoutesArray()` to focus on routeData processing
- ⬜ Remove remaining direct updates to waypoints array

### Phase 3: Final Phase (Upcoming)
1. Remove all code that updates the legacy structures
2. Remove the `syncRouteDataWithWaypoints` function
3. Remove legacy structures from the appState object
4. Update any remaining imports/references

## Completed Changes

- Made `routeData` the single source of truth in most files
- Simplified traveler update logic to only update routeData
- Improved URL parameter handling to use routeData structure
- Simplified route removal process
- Improved documentation with clear comments about legacy code

## Files Updated

1. `stateManager.js`: Simplified `updateTravelers`, `removeWaypoint`, and `removeWaypoints`
2. `routeHandling.js`: Streamlined `updateRoutesArray()` to focus on routeData
3. `routeBox/removeRoute.js`: Clarified routeData as source of truth
4. `infoPane.js`: Updated to prioritize routeData over waypoints
5. `eventManager.js`: Added handler for fixing waypoint order issues

## Files Still Requiring Updates

1. `eventManager.js`: Remove remaining references to waypoints array structure
2. `stateManager.js`: Remove all code that updates the legacy structures in Phase 3

## Testing

After each update:
1. Test all route creation flows ✅
2. Test "Any" origin and destination handling ✅
3. Test multi-segment routes ✅
4. Test URL parsing and generation ✅
5. Verify map displays correctly ✅

## Timeline

- Phase 2: Complete by end of Q3 (80% complete)
- Phase 3: Complete by end of Q4

## Notes

- The `waypoints` array structure relies on even indices for origins and odd indices for destinations
- The `routeData` structure maintains a clear separation between origin and destination
- RouteData also includes trip type, travelers, and dates, consolidating data that was previously spread across multiple structures
