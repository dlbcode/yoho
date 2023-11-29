import os
import csv
import requests
import time
from pymongo import MongoClient
from datetime import datetime

mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')

# MongoDB setup
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']  # Replace with your database name
collection = db['flights']  # Replace with your collection name

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

# Function to query the Amadeus API
def query_amadeus_api(iata_code, access_token):
    max_retries = 3
    try_count = 0

    while try_count < max_retries:
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            params = {'origin': iata_code, 'oneWay': 'true'}
            response = requests.get('https://test.api.amadeus.com/v1/shopping/flight-destinations', headers=headers, params=params)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"Rate limit exceeded for {iata_code}, retrying... (Attempt {try_count + 1})")
                time.sleep(0.3)  # Wait for 300 milliseconds
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
    print(f"Processing airport: {iata_code}")  # Print the airport being processed
    api_response = query_amadeus_api(iata_code, access_token)
    if api_response:
        for item in api_response.get('data', []):
            origin = item.get('origin')
            destination = item.get('destination')
            price = item.get('price', {}).get('total')
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')

            try:
                # Store in MongoDB
                collection.insert_one({'origin': origin, 'destination': destination, 'price': price, 'timestamp': timestamp})
                print(f"Inserted data for flight from {origin} to {destination}")  # Confirm insertion
            except Exception as e:
                print(f"Error inserting data for {origin}-{destination}: {e}")

    time.sleep(0.2)  # Wait for 200 milliseconds

# Main script
try:
    access_token = get_access_token()  # Retrieve your access token
    if not access_token:
        raise Exception("Failed to obtain access token")

    with open('airports.csv', mode='r') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            iata_code = row['iata_code']
            if iata_code:  # Ensure the IATA code is not empty
                process_airport(iata_code, access_token)
except FileNotFoundError:
    print("airports.csv file not found.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
