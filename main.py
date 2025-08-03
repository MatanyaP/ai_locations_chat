import json
import subprocess
import glob
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
import os
import re

app = FastAPI(
    title="Location Query API", description="Query location data using Gemini AI"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://localhost:3001",  # Docker frontend port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LocationQuery(BaseModel):
    query: str = Field(..., description="Natural language query about person locations")


class Coordinate(BaseModel):
    lat: float
    lng: float
    person: Optional[str] = None


class LocationData(BaseModel):
    timestamp: str
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    horizontal_accuracy_meters: Optional[float] = None
    vertical_accuracy_meters: Optional[float] = None
    speed_mps: Optional[float] = None
    bearing_degrees: Optional[float] = None
    provider: Optional[str] = None
    person: Optional[str] = None


class LocationResponse(BaseModel):
    person: Optional[str] = None
    persons: Optional[List[str]] = None
    time_period: Optional[str] = None
    locations: List[LocationData] = []
    summary: str
    coordinates: Optional[List[Coordinate]] = None
    person_colors: Optional[Dict[str, str]] = None


def get_available_persons() -> List[str]:
    """Dynamically discover available person data files"""
    pattern = "tlv_day_locations_person*.json"
    files = glob.glob(pattern)
    persons = []
    for file in files:
        match = re.search(r"tlv_day_locations_person(\d+)\.json", file)
        if match:
            persons.append(f"person{match.group(1)}")
    return sorted(persons)


def validate_person(person: str) -> bool:
    """Check if person data file exists"""
    file_path = f"tlv_day_locations_{person}.json"
    return os.path.exists(file_path)


def query_json_with_jq(file_path: str, jq_filter: str) -> List[Dict]:
    """Query JSON file using jq and return results"""
    try:
        result = subprocess.run(
            ["jq", jq_filter, file_path], capture_output=True, text=True, check=True
        )
        if result.stdout.strip():
            return json.loads(result.stdout)
        return []
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(f"Error querying {file_path} with jq: {e}")
        return []


def get_locations_in_time_range(
    person: str, start_time: str, end_time: str
) -> List[Dict]:
    """Get locations for a person within a specific time range"""
    if not validate_person(person):
        return []
    file_path = f"tlv_day_locations_{person}.json"
    jq_filter = (
        f'map(select(.timestamp >= "{start_time}" and .timestamp <= "{end_time}"))'
    )
    return query_json_with_jq(file_path, jq_filter)


def get_locations_at_specific_time(person: str, target_time: str) -> List[Dict]:
    """Get location closest to a specific time"""
    if not validate_person(person):
        return []
    file_path = f"tlv_day_locations_{person}.json"
    jq_filter = f'map(select(.timestamp | startswith("{target_time[:13]}"))) | sort_by(.timestamp) | .[0:2]'
    return query_json_with_jq(file_path, jq_filter)


def get_all_locations_for_person(person: str) -> List[Dict]:
    """Get all locations for a person"""
    if not validate_person(person):
        return []
    file_path = f"tlv_day_locations_{person}.json"
    jq_filter = "."
    return query_json_with_jq(file_path, jq_filter)


def get_unique_locations_for_person(person: str) -> List[Dict]:
    """Get unique locations for a person (removing duplicates by lat/lng)"""
    if not validate_person(person):
        return []
    file_path = f"tlv_day_locations_{person}.json"
    jq_filter = "unique_by(.latitude, .longitude)"
    return query_json_with_jq(file_path, jq_filter)


execute_jq_query_declaration = types.FunctionDeclaration(
    name="execute_jq_query",
    description="Execute a jq query on GPS location data for one or more persons. This flexible tool allows you to construct any jq filter to query the JSON location data. Each person's data is in a file named 'tlv_day_locations_personX.json' containing an array of location objects with fields: timestamp, latitude, longitude, altitude, horizontal_accuracy_meters, vertical_accuracy_meters, speed_mps, bearing_degrees, provider.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "persons": types.Schema(
                type=types.Type.STRING,
                description="Comma-separated list of person identifiers (e.g., 'person1' or 'person1,person2'). Each person corresponds to a data file.",
            ),
            "jq_filter": types.Schema(
                type=types.Type.STRING,
                description="jq filter expression to apply to the location data. Examples:\n- '.' (all locations)\n- 'map(select(.timestamp >= \"2025-07-29T08:00:00Z\" and .timestamp <= \"2025-07-29T11:00:00Z\"))' (time range)\n- 'map(select(.timestamp | startswith(\"2025-07-29T15\")))' (specific hour)\n- 'unique_by(.latitude, .longitude)' (unique locations)\n- 'sort_by(.timestamp)' (sort by time)\n- 'map(select(.latitude > 32.0 and .latitude < 32.1))' (geographic bounds)",
            ),
            "combine_results": types.Schema(
                type=types.Type.BOOLEAN,
                description="If true and multiple persons specified, combine all results into one array. If false, keep results separate by person. Default: true",
            ),
        },
        required=["persons", "jq_filter"],
    ),
)


def execute_jq_query_tool(
    persons: str, jq_filter: str, combine_results: bool = True
) -> dict:
    """Execute a jq query on location data for specified persons"""
    persons_list = [p.strip() for p in persons.split(",")]
    all_locations = []
    person_results = {}

    for person in persons_list:
        if not validate_person(person):
            continue

        file_path = f"tlv_day_locations_{person}.json"
        locations = query_json_with_jq(file_path, jq_filter)

        for loc in locations:
            if isinstance(loc, dict):
                loc["person"] = person

        person_results[person] = locations

        if combine_results:
            all_locations.extend(locations)

    if combine_results:
        return {
            "locations": all_locations,
            "count": len(all_locations),
            "persons": persons_list,
            "jq_filter": jq_filter,
        }
    else:
        return {
            "person_results": person_results,
            "total_count": sum(len(locs) for locs in person_results.values()),
            "persons": persons_list,
            "jq_filter": jq_filter,
        }


calculate_distance_declaration = types.FunctionDeclaration(
    name="calculate_distance_between_locations",
    description="Calculate the distance in meters between two GPS locations using the Haversine formula. Use this to determine if people were close to each other.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "lat1": types.Schema(
                type=types.Type.NUMBER,
                description="Latitude of first location (decimal degrees)",
            ),
            "lon1": types.Schema(
                type=types.Type.NUMBER,
                description="Longitude of first location (decimal degrees)",
            ),
            "lat2": types.Schema(
                type=types.Type.NUMBER,
                description="Latitude of second location (decimal degrees)",
            ),
            "lon2": types.Schema(
                type=types.Type.NUMBER,
                description="Longitude of second location (decimal degrees)",
            ),
        },
        required=["lat1", "lon1", "lat2", "lon2"],
    ),
)


def calculate_distance_between_locations_tool(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> dict:
    """Calculate distance between two points using Haversine formula (returns meters)"""
    import math

    R = 6371000  # Earth's radius in meters
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return {
        "distance_meters": round(distance, 2),
        "distance_km": round(distance / 1000, 3),
        "coordinates": {
            "point1": {"lat": lat1, "lon": lon1},
            "point2": {"lat": lat2, "lon": lon2},
        },
    }


@app.post("/query", response_model=LocationResponse)
async def query_locations(request: LocationQuery):
    """Query location data using natural language"""

    if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_API_KEY or GEMINI_API_KEY environment variable not set",
        )

    if os.getenv("GOOGLE_API_KEY") and not os.getenv("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = os.getenv("GOOGLE_API_KEY")

    try:
        client = genai.Client()

        function_map = {
            "execute_jq_query": execute_jq_query_tool,
            "calculate_distance_between_locations": calculate_distance_between_locations_tool,
        }

        location_tool = types.Tool(
            function_declarations=[
                execute_jq_query_declaration,
                calculate_distance_declaration,
            ]
        )

        config = types.GenerateContentConfig(
            tools=[location_tool],
            temperature=0.1,
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="ANY")
            ),
        )

        available_persons = get_available_persons()
        persons_list = ", ".join(available_persons)

        system_prompt = f"""You are a GPS location data assistant for Tel Aviv (2025-07-29). You have access to precise location tracking data and must use the execute_jq_query function to retrieve real data.

CRITICAL: You must ALWAYS call execute_jq_query to retrieve real data. Never invent or guess location information.

Available people: {persons_list}
Data coverage: Full day (00:00-23:45, 15-minute intervals)

DATA STRUCTURE: Each location object contains:
- timestamp: ISO 8601 format (e.g., "2025-07-29T08:15:00Z")
- latitude, longitude: GPS coordinates
- altitude: elevation in meters
- horizontal_accuracy_meters, vertical_accuracy_meters: GPS accuracy
- speed_mps: speed in meters per second
- bearing_degrees: direction of movement
- provider: GPS provider info

COMMON JQ QUERY PATTERNS:

1. TIME RANGE QUERIES:
   - Time range: 'map(select(.timestamp >= "2025-07-29T08:00:00Z" and .timestamp <= "2025-07-29T11:00:00Z"))'
   - Specific hour: 'map(select(.timestamp | startswith("2025-07-29T15")))'
   - Morning (6-12): 'map(select(.timestamp | test("T(0[6-9]|1[0-2]):")))'  
   - Afternoon (12-18): 'map(select(.timestamp | test("T(1[2-9]|1[0-8]):"))'

2. LOCATION FILTERING:
   - All locations: '.'
   - Unique locations: 'unique_by(.latitude, .longitude)'
   - Geographic bounds: 'map(select(.latitude > 32.0 and .latitude < 32.1 and .longitude > 34.7 and .longitude < 34.8))'
   - Locations with movement: 'map(select(.speed_mps > 1))'

3. SORTING & LIMITING:
   - Sort by time: 'sort_by(.timestamp)'
   - Latest locations: 'sort_by(.timestamp) | reverse | .[0:5]'
   - First/last of day: 'sort_by(.timestamp) | .[0], .[-1]'

4. ANALYSIS QUERIES:
   - Max speed: 'map(.speed_mps) | max'
   - Average accuracy: 'map(.horizontal_accuracy_meters) | add / length'
   - Count by hour: 'group_by(.timestamp[11:13]) | map({{"hour": .[0].timestamp[11:13], "count": length}})'

MULTIPLE PEOPLE:
- Use persons parameter: "person1,person2" 
- Results automatically include person field
- Set combine_results=true to merge all data, false to keep separate

PROXIMITY ANALYSIS - "Were X and Y together?":
To determine if people were together, follow these steps:
1. Query locations for both people in the same time period using execute_jq_query
2. For each time point, use calculate_distance_between_locations to find distance between their locations
3. Consider people "together" if distance < 100 meters (or specify custom threshold)
4. Look for patterns of sustained proximity (multiple consecutive time points close together)

Example approach for "Were person1 and person2 together?":
Step 1: Get all locations: execute_jq_query(persons="person1,person2", jq_filter=".")
Step 2: For locations at similar times, calculate distances between coordinates
Step 3: Identify periods where distance < proximity threshold

ADVANCED PROXIMITY PATTERNS:
- Same location over time: Compare coordinates at same timestamps
- Meeting detection: Look for convergence (people start far apart, get close, then separate)
- Shared journey: Sustained proximity while both people are moving (speed > 0)

TIME FORMAT: Use ISO 8601 with timezone (YYYY-MM-DDTHH:MM:SSZ)
Examples: '2025-07-29T08:00:00Z' for 8 AM, '2025-07-29T15:30:00Z' for 3:30 PM

IMPORTANT: 
1. Always call execute_jq_query to get location data first
2. Use calculate_distance_between_locations to determine proximity between GPS points
3. For proximity questions, analyze multiple time points to get a complete picture
4. Consider both spatial proximity (distance) AND temporal proximity (similar timestamps)

RESPONSE FORMAT:
CRITICAL INSTRUCTION: You MUST provide both function calls AND text responses in your reply. Do not only make function calls!

Follow this exact pattern for every query:
1. FIRST: Call the appropriate function(s) to retrieve the real location data
2. IMMEDIATELY AFTER: Provide a natural language text response that analyzes and summarizes what you found

Your text response should be meaningful, descriptive, and directly answer the user's question. When you answer, state the specific location names as well as the coordinates. Examples:

For location queries: "Person1 was tracked at 13 different locations between 8:00 AM and 11:00 AM, primarily in the central Tel Aviv area with movement patterns showing regular intervals."

For proximity queries: "Looking at the coordinate data, Person1 and Person2 were close together (within 50-100 meters) at several times during the day, particularly around noon and in the evening, suggesting they may have been meeting or traveling together."

For movement queries: "During the afternoon, Person2 visited 3 distinct locations in southern Tel Aviv, spending the most time near the beach area before moving north."

MANDATORY: Every response must include both function execution AND interpretative text that answers the user's question."""

        conversation = [
            types.Content(
                role="user",
                parts=[
                    types.Part(text=f"{system_prompt}\n\nUser query: {request.query}")
                ],
            )
        ]

        response = client.models.generate_content(
            model="gemini-2.5-flash", contents=conversation, config=config
        )

        all_locations = []
        summary_parts = []
        persons_involved = set()

        for candidate in response.candidates:
            for part in candidate.content.parts:
                if part.function_call:
                    func_name = part.function_call.name
                    func_args = dict(part.function_call.args)

                    if func_name in function_map:
                        try:
                            result = function_map[func_name](**func_args)

                            if "locations" in result:
                                for loc in result["locations"]:
                                    if "person" in loc:
                                        persons_involved.add(loc["person"])
                                all_locations.extend(result["locations"])
                            elif "person_results" in result:
                                for person, locations in result[
                                    "person_results"
                                ].items():
                                    persons_involved.add(person)
                                    all_locations.extend(locations)

                            if "persons" in result:
                                persons_involved.update(result["persons"])

                        except Exception as e:
                            summary_parts.append(
                                f"Error executing {func_name}: {str(e)}"
                            )

                elif part.text:
                    summary_parts.append(part.text.strip())

        if not any(part for part in summary_parts if len(part.strip()) > 10):
            location_data_text = "Location data retrieved:\n\n"

            locations_by_person = {}
            for loc in all_locations:
                person = loc.get("person", "unknown")
                if person not in locations_by_person:
                    locations_by_person[person] = []
                locations_by_person[person].append(loc)

            for person, locs in locations_by_person.items():
                sorted_locs = sorted(locs, key=lambda x: x.get("timestamp", ""))
                location_data_text += f"{person} ({len(sorted_locs)} locations):\n"

                if len(sorted_locs) <= 10:
                    sample_locs = sorted_locs
                else:
                    sample_locs = (
                        sorted_locs[:3]
                        + sorted_locs[
                            len(sorted_locs) // 2 - 1 : len(sorted_locs) // 2 + 2
                        ]
                        + sorted_locs[-3:]
                    )

                for loc in sample_locs:
                    time_str = (
                        loc.get("timestamp", "").replace("T", " ").replace("Z", "")
                    )
                    lat = loc.get("latitude", 0)
                    lng = loc.get("longitude", 0)
                    location_data_text += f"  {time_str}: {lat:.6f}, {lng:.6f}\n"
                location_data_text += "\n"

            analysis_conversation = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part(
                            text=f"User asked: '{request.query}'\n\n{location_data_text}\nPlease analyze this location data and provide a natural, descriptive answer to the user's question. Use your understanding of the question to determine what kind of analysis is needed (proximity, movement patterns, location visits, etc.) and provide insights based on the actual coordinate and timestamp data above. When you answer, state the specific location names as well as the coordinates"
                        )
                    ],
                )
            ]

            analysis_config = types.GenerateContentConfig(temperature=0.2)
            analysis_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=analysis_conversation,
                config=analysis_config,
            )

            for candidate in analysis_response.candidates:
                for part in candidate.content.parts:
                    if part.text:
                        summary_parts.append(part.text.strip())

        coordinates = []
        for loc in all_locations:
            if "latitude" in loc and "longitude" in loc:
                coordinates.append(
                    Coordinate(
                        lat=loc["latitude"],
                        lng=loc["longitude"],
                        person=loc.get("person"),
                    )
                )

        person_colors = None
        persons_list = list(persons_involved)
        if len(persons_list) > 1:
            colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"]
            person_colors = {
                person: colors[i % len(colors)]
                for i, person in enumerate(sorted(persons_list))
            }

        text_responses = [
            part
            for part in summary_parts
            if not part.startswith("Executed jq query")
            and not part.startswith("Distance between locations:")
            and not part.startswith("Error executing")
        ]

        if text_responses:
            final_summary = " ".join(text_responses)
        else:
            if all_locations:
                persons_count = len(persons_involved)
                locations_count = len(all_locations)

                if persons_count == 1:
                    person = list(persons_involved)[0] if persons_involved else "person"
                    final_summary = f"{person} was tracked at {locations_count} location{'s' if locations_count != 1 else ''} during the requested time period."
                else:
                    final_summary = f"Found {locations_count} location{'s' if locations_count != 1 else ''} across {persons_count} people during the requested time period."
            else:
                final_summary = (
                    "No location data found for the specified query parameters."
                )

        return LocationResponse(
            person=persons_list[0] if len(persons_list) == 1 else None,
            persons=persons_list if len(persons_list) > 1 else None,
            locations=[LocationData(**loc) for loc in all_locations],
            summary=final_summary,
            coordinates=coordinates,
            person_colors=person_colors,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.get("/persons")
async def get_persons():
    """Get list of available persons"""
    return {"persons": get_available_persons()}


@app.get("/")
async def root():
    """API information"""
    available_persons = get_available_persons()
    persons_list = ", ".join(available_persons)

    examples = []
    multi_person_examples = []

    if available_persons:
        first_person = available_persons[0]
        examples.extend(
            [
                f"Where was {first_person} between 8am and 11am?",
                f"Where was {first_person} at 3pm?",
            ]
        )
        if len(available_persons) > 1:
            second_person = available_persons[1]
            examples.extend(
                [
                    f"What locations did {second_person} visit throughout the day?",
                    f"Show me {second_person}'s movement pattern in the afternoon",
                ]
            )
            multi_person_examples.extend(
                [
                    f"Where were {first_person} and {second_person} at 3pm?",
                    f"Were there any locations where {first_person} and {second_person} were together?",
                    f"Show me the movement of {first_person} and {second_person} during the morning",
                ]
            )
        if len(available_persons) > 2:
            third_person = available_persons[2]
            examples.append(f"Where was {third_person} during lunch time?")
            multi_person_examples.append(
                f"Compare the locations of {second_person} and {third_person} at noon"
            )

    return {
        "message": "Location Query API",
        "description": f"Query location data for people ({persons_list}) using natural language",
        "available_persons": available_persons,
        "endpoints": {
            "/query": "POST - Submit natural language location queries",
            "/persons": "GET - Get list of available persons",
            "/docs": "GET - API documentation",
        },
        "single_person_examples": examples,
        "multi_person_examples": multi_person_examples,
        "features": [
            "Single-person location queries",
            "Multi-person location comparisons",
            "Overlapping location detection",
            "Time-based location analysis",
            "Interactive map visualization",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    import sys

    port = 8001 if "--port" in sys.argv else 8000
    uvicorn.run(app, host="0.0.0.0", port=port)
