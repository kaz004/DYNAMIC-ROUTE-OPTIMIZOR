from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import logging
import json
import traceback
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app)

# Logging configuration
logging.basicConfig(level=logging.INFO)

class RouteOptimizer:
    def __init__(self):
        # API keys are loaded from environment variables for security
        self.google_maps_api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        self.aqicn_api_key = os.getenv("AQICN_API_KEY")
        self.openweathermap_api_key = os.getenv("OPENWEATHERMAP_API_KEY")

        if not all([self.google_maps_api_key, self.aqicn_api_key, self.openweathermap_api_key]):
            raise ValueError("Missing one or more required API keys. Please set environment variables.")

    def get_routes(self, start, end):
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": start,
            "destination": end,
            "alternatives": "true",
            "key": self.google_maps_api_key
        }
        response = requests.get(url, params=params)
        data = response.json()
        if 'routes' not in data:
            raise ValueError("No routes found in Google Maps API response")
        return [self.parse_route(route) for route in data['routes']]

    def parse_route(self, route):
        return {
            "distance": route['legs'][0]['distance']['value'],
            "duration": route['legs'][0]['duration']['value'],
            "polyline": route['overview_polyline']['points'],
            "steps": route['legs'][0]['steps']
        }

    def compare_routes(self, routes):
        def heuristic(route):
            return route['duration'] + route['distance'] / 100
        scored_routes = [(route, heuristic(route)) for route in routes]
        best_route = min(scored_routes, key=lambda x: x[1])
        other_routes = [
            {
                "route": route,
                "reason": f"Score: {score:.2f} (Best: {best_route[1]:.2f})"
            }
            for route, score in scored_routes if route != best_route[0]
        ]
        return {
            "best_route": best_route[0],
            "other_routes": other_routes
        }

    def get_route(self, start, end, vehicleType, package_weight):
        routes = self.get_routes(start, end)
        compared_routes = self.compare_routes(routes)
        best_route = compared_routes['best_route']

        start_coords = self.get_coordinates(start)
        end_coords = self.get_coordinates(end)

        weather_data = self.get_weather_data(start_coords)
        air_quality = self.get_air_quality(start_coords)

        best_route_emissions = self.calculate_emissions(best_route, vehicleType, weather_data, air_quality, package_weight)

        alternative_routes = []
        for alt_route_data in compared_routes['other_routes']:
            alt_route = alt_route_data['route']
            alt_emissions = self.calculate_emissions(alt_route, vehicleType, weather_data, air_quality, package_weight)
            alternative_routes.append({
                'route': alt_route,
                'emissions': alt_emissions
            })

        return {
            "route": compared_routes,
            "emissions": best_route_emissions,
            "alternative_routes": alternative_routes,
            "weather": weather_data,
            "air_quality": air_quality,
        }

    def get_coordinates(self, place):
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": place,
            "key": self.google_maps_api_key
        }
        response = requests.get(url, params=params)
        data = response.json()
        if data['results']:
            location = data['results'][0]['geometry']['location']
            return location['lat'], location['lng']
        return None

    def get_weather_data(self, location):
        url = f"https://api.openweathermap.org/data/2.5/weather"
        params = {
            "lat": location[0],
            "lon": location[1],
            "appid": self.openweathermap_api_key,
            "units": "metric"
        }
        response = requests.get(url, params=params)
        data = response.json()
        return {
            "temperature": data['main']['temp'],
            "humidity": data['main']['humidity'],
            "wind_speed": data['wind']['speed'],
            "precipitation": data.get('rain', {}).get('1h', 0)
        }

    def get_air_quality(self, location):
        url = f"https://api.waqi.info/feed/geo:{location[0]};{location[1]}/"
        params = {"token": self.aqicn_api_key}
        response = requests.get(url, params=params)
        data = response.json()
        return data['data']['aqi']

    def calculate_emissions(self, route, vehicle_type, weather, air_quality, package_weight):
        base_emission_rate = {
            "car": 120,
            "truck": 300,
            "van": 200,
            "electric": 0,
        }
        distance_km = route['distance'] / 1000
        base_emissions = base_emission_rate.get(vehicle_type, 150) * distance_km

        weight_factor = 1 + (package_weight * 0.01)
        weather_factor = 1 + (weather['temperature'] - 20) * 0.02 + weather['humidity'] * 0.0015 + weather['wind_speed'] * 0.005
        aqi_factor = 1 + (air_quality - 50) * 0.003
        total_emissions = base_emissions * weather_factor * aqi_factor * weight_factor

        return total_emissions

route_optimizer = RouteOptimizer()

@app.route('/optimize_route', methods=['POST', 'OPTIONS'])
def optimize_route():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        if not request.is_json:
            raise ValueError("Invalid JSON data")
        data = request.get_json()
        if data is None:
            raise ValueError("No JSON data received")
        start = data['start']
        end = data['end']
        vehicle_type = data['vehicle_type']
        package_weight = data['package_weight']

        result = route_optimizer.get_route(start, end, vehicle_type, package_weight)
        return jsonify(result)
    except ValueError as e:
        app.logger.error(f"ValueError in optimize_route: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        app.logger.error(f"Error in optimize_route: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected error occurred. Please try again later."}), 500

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
