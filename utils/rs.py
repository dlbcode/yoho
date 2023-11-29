import os
import requests
from datetime import datetime

api_key = os.getenv('AMADEUS_TEST_API_KEY')
api_secret = os.getenv('AMADEUS_TEST_API_SECRET')

# Function to get access token
def get_access_token(api_key, api_secret):
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

# Get the access token
access_token = get_access_token(api_key, api_secret)

if access_token:
    # Make the API call to Flight Destinations
    headers = {
        'Authorization': f'Bearer {access_token}',
    }

    params = {
        'origin': 'SFO',
        'oneWay': 'true'
    }

    response = requests.get('https://test.api.amadeus.com/v1/shopping/flight-destinations', headers=headers, params=params)

    # Processing the response
    if response.status_code == 200:
        data = response.json().get('data', [])
        for destination in data:
            origin = destination.get('origin')
            destination_code = destination.get('destination')
            price = destination.get('price', {}).get('total')
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')

            print(f"Origin: {origin}, Destination: {destination_code}, Price: {price}, Timestamp: {timestamp}")
    else:
        print("Error in Flight Destinations API request")
        print("Status Code:", response.status_code)
        print("Response Body:", response.text)
else:
    print("Failed to obtain access token")
