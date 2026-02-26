#!/bin/bash
# DocOc Setup and Run Script

echo "Checking Ollama..."
if ! command -v ollama &> /dev/null
then
    echo "Ollama not found. Please install it from https://ollama.com"
    exit
fi

echo "Pulling Phi-3-mini..."
ollama pull phi3

echo "Starting Backend..."
cd backend
python -m uvicorn main:app --reload &
BACKEND_PID=$!

echo "Starting Frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "DocOc is running!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
