import os
import requests
from pymongo import MongoClient
from datetime import datetime

# Environment variables
mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')
api_key = os.getenv('AMADEUS_TEST_API_KEY')
api_secret = os.getenv('AMADEUS_TEST_API_SECRET')

# MongoDB setup
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']
airports_collection = db['airports']  # Assuming 'airports' is your collection name

# Function to get access token
def get_access_token():
    url = "https://test.api.amadeus.com/v1/security/oauth2/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": api_key,
        "client_secret": api_secret
    }
    try:
        response = requests.post(url, data=payload)
        response.raise_for_status()
        return response.json().get('access_token')
    except requests.RequestException as e:
        print(f"Request Exception: {e}")
        return None

# Function to fetch airport data
def fetch_airport_data(access_token):
    url = "https://test.api.amadeus.com/v1/reference-data/locations/airports"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json().get('data', [])
    except requests.RequestException as e:
        print(f"Request Exception: {e}")
        return []

# Function to process and update airport data in MongoDB
def update_airports_in_db(airports_data):
    for airport in airports_data:
        airport_doc = {
            "country": airport.get("address", {}).get("countryName"),
            "city": airport.get("address", {}).get("cityName"),
            "IATA": airport.get("iataCode"),
            "type": airport.get("locationType"),
            "weight": 1,  # Modify as needed to calculate weight
            "geocode": {
                "lat": airport.get("geoCode", {}).get("latitude"),
                "lon": airport.get("geoCode", {}).get("longitude")
            },
            "timestamp": datetime.now().strftime("%Y%m%d%H%M%S")
        }
        airports_collection.update_one(
            {"IATA": airport_doc["IATA"]},
            {"$set": airport_doc},
            upsert=True
        )

# Main execution
access_token = get_access_token()
if access_token:
    airports_data = fetch_airport_data(access_token)
    if airports_data:
        update_airports_in_db(airports_data)
    else:
        print("No airport data found.")
else:
    print("Failed to obtain access token.")
