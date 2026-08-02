import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def generate_research(city, temp, humidity, rainfall, wind, risk):

    prompt = f"""
Generate an IEEE-style research abstract.

Title:
Satellite-Based El Niño Heat Monitoring System

City: {city}

Temperature: {temp}°C

Humidity: {humidity}%

Rainfall: {rainfall} mm

Wind Speed: {wind} m/s

Heat Risk: {risk}

Generate:

1. Title
2. Abstract
3. Keywords
4. Conclusion
5. Government Policy Recommendation

Limit to 500 words.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text