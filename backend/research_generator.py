import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def generate_research(city, temp, humidity, rainfall, wind, risk):
    prompt = f"""
Create a concise, professional AI Climate Report for the Satellite-Based El Niño Heat Monitoring System.

Selected Location: {city}
Temperature: {temp}°C
Humidity: {humidity}%
Rainfall: {rainfall} mm
Wind Speed: {wind} m/s
Heat Risk: {risk}

Use clear, practical language and include these sections:
1. Current Weather Summary
2. Heat Risk Analysis
3. El Niño Analysis
4. Climate Insights
5. Safety Recommendations
6. Conclusion

Keep the response under 500 words.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text
