## Features

- **Natural Language Queries**: Ask questions like "Where was person1 between 8am and 11am?"
- **Gemini AI Integration**: Uses the latest `google-genai` library with Gemini 2.5 Flash model
- **Function Calling**: Gemini can call predefined functions to query JSON data using `jq`
- **Structured Output**: Responses are formatted using Gemini's structured output feature
- **Location Data**: Supports querying GPS location data for multiple people over a full day
- **Docker Support**: Fully containerized with Docker and Docker Compose

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed on your system
- A valid Google Gemini API key

### 1. Clone and Setup
```bash
git clone https://github.com/MatanyaP/ai_locations_chat
cd locations_chat
```

### 2. Set up Environment Variables
Create a `.env` file in the root directory:
```bash
GEMINI_API_KEY=your-gemini-api-key-here
# or alternatively use:
# GOOGLE_API_KEY=your-gemini-api-key-here
```

**Note**: You can copy `.env.example` to `.env` and update it with your API key:
```bash
cp .env.example .env
# Then edit .env with your actual API key
```

### 3. Run with Docker Compose

**Full Stack (API + Frontend):**
```bash
# Start both API and frontend
docker-compose up --build
```

**API Only:**
```bash
# Start just the API server
docker-compose up api --build
```

**Production Mode:**
```bash
# Use production configuration
docker-compose -f docker-compose.prod.yml up --build
```

The services will be available at:
- **Frontend**: http://localhost:3001
- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 4. Stop the Services
```bash
docker-compose down
```

## Alternative Setup Methods

### Method 1: Docker (Manual)

1. **Build the Docker image**:
   ```bash
   docker build -t location-query-api .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name location-api \
     -p 8000:8000 \
     -e GEMINI_API_KEY="your-gemini-api-key" \
     location-query-api
   ```

### Method 2: Local Development

**API Server:**
1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Install jq** (required for JSON querying):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq
   
   # macOS
   brew install jq
   
   # Windows (using chocolatey)
   choco install jq
   ```

3. **Set up Google API Key**:
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key"
   # or alternatively:
   export GOOGLE_API_KEY="your-gemini-api-key"
   ```

4. **Run the server**:
   ```bash
   python main.py
   ```
   
   Or using uvicorn directly:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

**Frontend Client:**
1. **Navigate to client directory**:
   ```bash
   cd client
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Usage

### API Endpoints

- `GET /` - API information and examples
- `POST /query` - Submit location queries
- `GET /docs` - Interactive API documentation (Swagger UI)

### Example Queries

Send POST requests to `/query` with a JSON body:

```json
{
  "query": "Where was person1 between 8am and 11am?"
}
```

**Example queries you can try:**
- "Where was person1 between 8am and 11am?"
- "What locations did person2 visit throughout the day?"
- "Where was person1 at 3pm?"
- "Show me person2's movement pattern in the afternoon"
- "Which person moved more during the day?"
- "Where were both people at noon?"

### Response Format

The API returns structured responses with:
- `person`: The person being queried about
- `time_period`: The time period of the query
- `locations`: Detailed location data matching the query
- `summary`: Human-readable summary of the results
- `coordinates`: Simplified coordinate list for mapping

## Data Format

The server expects JSON files with location data in the following format:
- `tlv_day_locations_person1.json`
- `tlv_day_locations_person2.json`

Each location entry contains:
- `timestamp`: ISO format timestamp
- `latitude`, `longitude`: GPS coordinates
- `altitude`: Elevation in meters
- `horizontal_accuracy_meters`, `vertical_accuracy_meters`: GPS accuracy
- `speed_mps`: Speed in meters per second
- `bearing_degrees`: Direction of movement
- `provider`: GPS provider

## Architecture

### Backend (FastAPI Server)
- **FastAPI**: Modern, fast web framework for building APIs
- **Google Gemini AI**: For natural language understanding and structured responses
- **Function Calling**: Allows Gemini to call specific functions to query data
- **jq**: Command-line JSON processor for efficient data querying
- **Pydantic**: Data validation and serialization

### Frontend (Next.js Client)
- **Next.js 15**: React framework with App Router
- **React 19**: Modern React with latest features
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React Leaflet**: Interactive maps for location visualization
- **Axios**: HTTP client for API communication
- **React Markdown**: Render AI responses with formatting

## Available Functions for Gemini

1. `get_locations_in_time_range`: Get locations within a time range
2. `get_locations_at_specific_time`: Get location at/near a specific time
3. `get_all_locations_for_person`: Get all locations for a person
4. `get_unique_locations_for_person`: Get unique locations (deduplicated)

## Docker Configuration

### Environment Variables
The following environment variables are supported:
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`: Your Google Gemini API key (required)
- `NEXT_PUBLIC_API_URL`: Frontend API endpoint (default: http://localhost:8000)

### Docker Compose Services
- **api**: FastAPI backend server (port 8000)
- **frontend**: Next.js client application (port 3000)
- **app-network**: Bridge network connecting both services

### Health Checks
Both containers include health checks:
- API: Verifies FastAPI is responding on port 8000
- Frontend: Verifies Next.js is responding on port 3000

### Volume Mounts (Development)
In development mode, the following files are mounted as volumes for live editing:
- `main.py`: Main application file  
- `tlv_day_locations_person*.json`: Location data files

### Production vs Development
- **Development**: `docker-compose.yml` - includes volume mounts for live editing
- **Production**: `docker-compose.prod.yml` - optimized builds with resource limits

## Troubleshooting

### Common Issues

1. **API Key Not Found**: Ensure your `.env` file contains `GEMINI_API_KEY=your-key-here`
2. **Port Already in Use**: Change the port mapping in docker-compose.yml from `8000:8000` to `8001:8000` or `3001:3000` to `3002:3000`  
3. **CORS Errors**: The frontend is configured to connect to `http://localhost:8000`. If you change API port, update `NEXT_PUBLIC_API_URL` in docker-compose.yml
4. **jq Command Not Found**: The Docker image includes jq, but for local development ensure it's installed
5. **Docker Build Fails**: Ensure Docker has sufficient resources allocated
6. **Frontend Can't Connect to API**: Verify both services are running and API is healthy with `docker-compose ps`

### Logs
View container logs:
```bash
docker-compose logs -f api
```

### Development Mode
For development with live reloading:
```bash
# This mounts the source code as volumes for live editing
docker-compose up --build
```
