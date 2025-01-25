import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useMediaQuery } from "react-responsive";
import PropTypes from "prop-types";

const MapComponent = ({ routeData, start, end, index }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 28.6139, lng: 77.209 },
      zoom: 7,
    });

    const decodedPath = window.google.maps.geometry.encoding.decodePath(routeData.polyline);

    const routePath = new window.google.maps.Polyline({
      path: decodedPath,
      geodesic: true,
      strokeColor: index === null ? "#FF0000" : "#0000FF",
      strokeOpacity: 1.0,
      strokeWeight: 2,
    });

    routePath.setMap(map);

    const bounds = new window.google.maps.LatLngBounds();
    decodedPath.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds);

    new window.google.maps.Marker({
      position: decodedPath[0],
      map: map,
      title: "Start",
    });

    new window.google.maps.Marker({
      position: decodedPath[decodedPath.length - 1],
      map: map,
      title: "End",
    });
  }, [routeData, index]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-100 mb-2">
        {index === null ? "Best Route" : `Alternative Route ${index + 1}`}
      </h3>
      <div ref={mapRef} style={{ height: "300px", width: "100%" }} className="rounded-md shadow-lg" />
    </div>
  );
};

MapComponent.propTypes = {
  routeData: PropTypes.shape({
    distance: PropTypes.number.isRequired,
    duration: PropTypes.number.isRequired,
    polyline: PropTypes.string.isRequired,
  }).isRequired,
  start: PropTypes.string.isRequired,
  end: PropTypes.string.isRequired,
  index: PropTypes.number,
};

const RouteInfo = ({ routeData, emissions, weather, airQuality, start, end, index, packageWeight }) => (
  <div className="bg-gray-800 bg-opacity-70 backdrop-blur-md p-6 rounded-md shadow-lg mt-4">
    <h2 className="text-2xl font-semibold text-gray-100 mb-4">
      {index === null ? "Best Route" : `Alternative Route ${index + 1}`} from {start} to {end}
    </h2>
    <div className="space-y-2 text-lg text-gray-300">
      <p><strong>Distance:</strong> {(routeData.distance / 1000).toFixed(2)} km</p>
      <p><strong>Duration:</strong> {(routeData.duration / 60).toFixed(2)} minutes</p>
      <p><strong>Emissions:</strong> {emissions.toFixed(2)} g CO2</p>
      <p><strong>Weather:</strong> {weather.temperature.toFixed(2)}°C, Wind: {weather.wind_speed.toFixed(2)} km/h, Humidity: {weather.humidity}%</p>
      <p><strong>Air Quality Index:</strong> {airQuality}</p>
      <p><strong>Package Weight:</strong> {packageWeight} kg</p>
    </div>
  </div>
);

RouteInfo.propTypes = {
  routeData: PropTypes.shape({
    distance: PropTypes.number.isRequired,
    duration: PropTypes.number.isRequired,
    polyline: PropTypes.string.isRequired,
  }).isRequired,
  emissions: PropTypes.number.isRequired,
  weather: PropTypes.shape({
    temperature: PropTypes.number.isRequired,
    humidity: PropTypes.number.isRequired,
    wind_speed: PropTypes.number.isRequired,
  }).isRequired,
  airQuality: PropTypes.number.isRequired,
  start: PropTypes.string.isRequired,
  end: PropTypes.string.isRequired,
  index: PropTypes.number,
  packageWeight: PropTypes.number.isRequired,
};

const App = () => {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showBestRoute, setShowBestRoute] = useState(true);
  const [packageWeight, setPackageWeight] = useState(0);

  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    const loadGoogleMapsScript = () => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places,geometry`;
      script.async = true;
      document.body.appendChild(script);
    };

    if (!window.google) {
      loadGoogleMapsScript();
    }
  }, []);

  const handleOptimizeRoute = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post("http://localhost:5000/optimize_route", {
        start,
        end,
        vehicle_type: vehicleType,
        package_weight: packageWeight,
      });

      setRoute(response.data);
    } catch (error) {
      setError(
        axios.isAxiosError(error)
          ? error.response?.data?.error || error.message || "An error occurred while optimizing the route."
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-5xl font-bold text-center text-gray-100 mb-8">FedEx Smart Route Optimizer</h1>
      <div className="max-w-6xl mx-auto p-6 bg-gray-800 bg-opacity-70 backdrop-blur-md rounded-xl shadow-lg space-y-8">
        <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-8`}>
          <div>
            <label className="block text-lg font-medium text-gray-300">Start Location</label>
            <input
              type="text"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-2 block w-full border border-gray-600 rounded-md p-4 text-lg text-gray-100 bg-gray-700 focus:ring-teal-600 focus:border-teal-600 hover:bg-gray-600 transition duration-200"
              placeholder="Enter start location"
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-300">End Location</label>
            <input
              type="text"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-2 block w-full border border-gray-600 rounded-md p-4 text-lg text-gray-100 bg-gray-700 focus:ring-teal-600 focus:border-teal-600 hover:bg-gray-600 transition duration-200"
              placeholder="Enter end location"
            />
          </div>
        </div>
        <div>
          <label className="block text-lg font-medium text-gray-300">Vehicle Type</label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="mt-2 block w-full border border-gray-600 rounded-md p-4 text-lg text-gray-100 bg-gray-700 focus:ring-teal-600 focus:border-teal-600 hover:bg-gray-600 transition duration-200"
          >
            <option value="car">Car</option>
            <option value="truck">Truck</option>
            <option value="van">Van</option>
            <option value="electric">Electric Vehicle</option>
          </select>
        </div>
        <div>
          <label className="block text-lg font-medium text-gray-300">Package Weight (kg)</label>
          <input
            type="number"
            value={packageWeight}
            onChange={(e) => setPackageWeight(Number(e.target.value))}
            className="mt-2 block w-full border border-gray-600 rounded-md p-4 text-lg text-gray-100 bg-gray-700 focus:ring-teal-600 focus:border-teal-600 hover:bg-gray-600 transition duration-200"
            placeholder="Enter package weight in kg"
          />
        </div>
        <button
          onClick={handleOptimizeRoute}
          disabled={loading}
          className="w-full bg-teal-600 text-white py-3 rounded-md text-lg hover:bg-teal-700 transition duration-300"
        >
          {loading ? "Optimizing..." : "Optimize Route"}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {route && (
          <div className="space-y-8">
            <button
              onClick={() => setShowBestRoute(!showBestRoute)}
              className="w-full bg-blue-600 text-white py-3 rounded-md text-lg hover:bg-blue-700 transition duration-300"
            >
              {showBestRoute ? "Show Alternative Routes" : "Show Best Route"}
            </button>

            {showBestRoute ? (
              <div>
                <MapComponent routeData={route.route.best_route} start={start} end={end} index={null} />
                <RouteInfo
                  routeData={route.route.best_route}
                  emissions={route.emissions}
                  weather={route.weather}
                  airQuality={route.air_quality}
                  start={start}
                  end={end}
                  index={null}
                  packageWeight={packageWeight}
                />
              </div>
            ) : (
              route.route.other_routes.map((otherRoute, index) => (
                <div key={index}>
                  <MapComponent routeData={otherRoute.route} start={start} end={end} index={index} />
                  <RouteInfo
                    routeData={otherRoute.route}
                    emissions={route.alternative_routes[index].emissions}
                    weather={route.weather}
                    airQuality={route.air_quality}
                    start={start}
                    end={end}
                    index={index}
                    packageWeight={packageWeight}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
