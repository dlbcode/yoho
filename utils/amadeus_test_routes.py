import os
import csv
import requests
import time
from pymongo import MongoClient
from datetime import datetime

mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')

# MongoDB setup
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']
routes_collection = db['routes']  # Use 'routes' collection

# Get the API key and secret from environment variables
api_key = os.getenv('AMADEUS_TEST_API_KEY')
api_secret = os.getenv('AMADEUS_TEST_API_SECRET')

# Function to get access token
def get_access_token():
    try:
        url = "https://test.api.amadeus.com/v1/security/oauth2/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": api_key,
            "client_secret": api_secret
        }
        response = requests.post(url, data=payload)

        if response.status_code == 200:
            return response.json().get('access_token')
        else:
            print("Error obtaining access token:")
            print("Status Code:", response.status_code)
            print("Response:", response.text)
            return None
    except requests.RequestException as e:
        print(f"Request Exception: {e}")
        return None

# Function to query the Amadeus API using the new endpoint
def query_amadeus_api(iata_code, access_token):
    max_retries = 3
    try_count = 0

    while try_count < max_retries:
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            url = f'https://test.api.amadeus.com/v1/airport/direct-destinations?departureAirportCode={iata_code}'
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"Rate limit exceeded for {iata_code}, retrying... (Attempt {try_count + 1})")
                time.sleep(0.3)
                try_count += 1
            else:
                print(f"Error querying Amadeus API for {iata_code}:")
                print("Status Code:", response.status_code)
                print("Response Body:", response.text)
                return None
        except requests.RequestException as e:
            print(f"Request Exception for {iata_code}: {e}")
            return None

    print(f"Max retries reached for {iata_code}. Moving on.")
    return None

# Function to process each airport
def process_airport(iata_code, access_token):
    print(f"Processing airport: {iata_code}")
    api_response = query_amadeus_api(iata_code, access_token)
    if api_response:
        for item in api_response.get('data', []):
            destination = item.get('iataCode')
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')

            try:
                # Update or insert in MongoDB
                query = {'origin': iata_code, 'destination': destination}
                new_values = {'$set': {'origin': iata_code, 'destination': destination, 'timestamp': timestamp}}
                routes_collection.update_one(query, new_values, upsert=True)
                print(f"Updated data for route from {iata_code} to {destination}")
            except Exception as e:
                print(f"Error updating data for route {iata_code}-{destination}: {e}")
    time.sleep(0.2)

# Main script
try:
    access_token = get_access_token()
    if not access_token:
        raise Exception("Failed to obtain access token")

    with open('airports.csv', mode='r') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            iata_code = row['iata_code']
            if iata_code:
                process_airport(iata_code, access_token)
except FileNotFoundError:
    print("airports.csv file not found.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
