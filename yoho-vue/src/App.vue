<template>
  <div>
    <!-- Other components and HTML -->
    <MapComponent />
  </div>
</template>

<script>
import MapComponent from './components/MapComponent.vue';

export default {
  name: 'App',
  components: {
    MapComponent,
  },
  methods: {
    setupUIEventListeners() {
      // Logic for UI event listeners
    },
    drawPaths() {
      this.$refs.mapComponent.drawAllFlightPaths();
    },
     // Methods to interact with MapComponent
  },
  mounted() {
    this.setupUIEventListeners();
  },
};
</script>