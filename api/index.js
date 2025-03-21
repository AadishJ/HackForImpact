const express = require( 'express' );
const { spawn } = require( 'child_process' );
const fs = require( 'fs' );
const path = require( 'path' );
const cors = require( 'cors' );
const bodyParser = require( 'body-parser' );

const app = express();
app.use( cors() );
const PORT = process.env.PORT || 5000;
app.use( bodyParser.json( { limit: '50mb' } ) );
app.use( bodyParser.urlencoded( { limit: '50mb', extended: true } ) );

// Create the Python script file that contains the ML model logic
const pythonScriptPath = path.join( __dirname, 'route_classifier.py' );
const pythonScript = `
import sys
import json
import pickle
import pandas as pd
import numpy as np
import os
from datetime import datetime
from sklearn.preprocessing import StandardScaler

class FloatEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, float):
            return float(obj)  # Explicitly convert to float
        return super().default(obj)

def classify_routes(routes_json):
    try:
        # Parse routes data from input
        routes = json.loads(routes_json)
        
        # Get current date and time
        now = datetime.now()
        time_data = [now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S")]
        
        # Get the directory of the script for absolute paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Load the model and scaler using absolute paths
        model_path = os.path.join(script_dir, "model.pkl")
        data_path = os.path.join(script_dir, "Processed_crime.csv")
        
        # Initialize empty results list
        results = []
        
        try:
            with open(model_path, "rb") as f:
                xgb_clf = pickle.load(f)
                
            # Load the dataset to fit the scaler
            df = pd.read_csv(data_path)
            train = df.iloc[:,:-1]
            if 'Unnamed: 0' in train.columns:
                train.drop(columns=['Unnamed: 0'], inplace=True)
            
            scaler = StandardScaler()
            scaler.fit_transform(train)
            
            # Process each route
            for route in routes:
                location_list = []
                for point in route:
                    l = [float(point['lat']), float(point['lng'])]
                    location_list.append(l)
                    
                # Create DataFrame with proper column names
                new_df = pd.DataFrame(location_list, columns=[0, 1])
                new_df['Date'] = time_data[0]
                new_df['Time'] = time_data[1]
                new_df['Date'] = pd.to_datetime(new_df['Date'])
                new_df['Time'] = pd.to_datetime(new_df['Time'])
                
                new_df['YEAR'] = new_df['Date'].dt.year
                new_df[2] = new_df['Date'].dt.month
                new_df['DAY'] = new_df['Date'].dt.day
                
                new_df[3] = new_df['Time'].apply(lambda x: x.hour)
                new_df[4] = new_df['Time'].apply(lambda x: x.minute)
                new_df.drop(columns=['Date', 'Time', 'YEAR', 'DAY'], inplace=True)
                
                # Make sure columns match what the model was trained on
                new_df = new_df[[0, 1, 2, 3, 4]]  # Ensure column order
                
                new_df_values = scaler.transform(new_df)
                y_pred = xgb_clf.predict(new_df_values)
                
                sum_val = float(np.sum(y_pred))
                div = float(len(y_pred) * 10)
                # Explicitly calculate as float with decimal precision
                score = float(sum_val / div)
                
                # Force the value to be a string with 4 decimal places, then convert back to float
                # This ensures we preserve the decimal precision
                score_str = f"{score:.4f}"
                score = float(score_str)
                
                # Print the raw score for debugging
                print(f"Debug - Raw score type: {type(score)}, value: {score}", file=sys.stderr)
                
                results.append(score)
                
        except Exception as inner_error:
            # Log the specific error and re-raise
            print(f"Error in model processing: {str(inner_error)}", file=sys.stderr)
            raise inner_error
            
        # Match the Flask behavior - return a single value if there's only one route
        if len(results) == 1:
            # Use the custom encoder to ensure floats are preserved
            return json.dumps(results[0], cls=FloatEncoder)
        else:
            # Use the custom encoder to ensure floats are preserved
            return json.dumps(results, cls=FloatEncoder)
            
    except Exception as e:
        print(f"Error in classify_routes: {str(e)}", file=sys.stderr)
        return json.dumps({"error": str(e)})

# Read input from Node.js
if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        result = classify_routes(input_data)
        print(result)
    except Exception as e:
        print(json.dumps({"error": f"Top level exception: {str(e)}"}))
`;

// Write the Python script to a file
fs.writeFileSync( pythonScriptPath, pythonScript );

// API route to classify routes
app.post( '/classify_route', ( req, res ) => {
    const routes = req.body;

    // Log the incoming request for debugging
    console.log( `Received request with ${ routes.length } routes` );

    // Validate request data
    if ( !Array.isArray( routes ) ) {
        return res.status( 400 ).json( { error: 'Request body must be an array of routes' } );
    }

    // Spawn a Python process
    const pythonProcess = spawn( 'python', [ pythonScriptPath ] );

    let result = '';
    let error = '';

    // Handle data from Python script
    pythonProcess.stdout.on( 'data', ( data ) => {
        result += data.toString();
    } );

    // Handle errors
    pythonProcess.stderr.on( 'data', ( data ) => {
        error += data.toString();
        console.error( `Python Error: ${ data }` );
    } );

    // Set timeout for Python process
    const timeout = setTimeout( () => {
        console.error( 'Python process timed out' );
        pythonProcess.kill();
        res.status( 500 ).json( { error: 'Processing timed out' } );
    }, 30000 ); // 30 second timeout

    // When the Python process exits - SINGLE event handler
    pythonProcess.on( 'close', ( code ) => {
        clearTimeout( timeout );

        if ( code !== 0 ) {
            console.error( `Python process exited with code ${ code }` );
            return res.status( 500 ).json( {
                error: 'Failed to process routes',
                details: error || 'Unknown error'
            } );
        }

        try {
            // Handle empty results
            if ( !result || result.trim() === '' ) {
                return res.status( 500 ).json( { error: 'No result returned from model' } );
            }

            const parsedResult = JSON.parse( result );
            console.log( 'Parsed result type:', typeof parsedResult );
            console.log( 'Parsed result value:', parsedResult );

            // For arrays, check the first element's type
            if ( Array.isArray( parsedResult ) && parsedResult.length > 0 ) {
                console.log( 'First element type:', typeof parsedResult[ 0 ] );
                console.log( 'First element value:', parsedResult[ 0 ] );
            }

            // Send the parsed result as-is, without converting
            res.json( parsedResult );
        } catch ( e ) {
            console.error( 'Failed to parse Python output:', e );
            res.status( 500 ).json( {
                error: 'Invalid output from model',
                details: e.message,
                raw: result
            } );
        }
    } );

    // Send the routes data to the Python script
    pythonProcess.stdin.write( JSON.stringify( routes ) );
    pythonProcess.stdin.end();
} );

// Health check endpoint
app.get( '/health', ( req, res ) => {
    res.json( { status: 'up', timestamp: new Date() } );
} );

// Start the server
app.listen( PORT, () => {
    console.log( `Server running on port ${ PORT }` );
    console.log( `API endpoint: http://localhost:${ PORT }/classify_route` );
} );

// Handle graceful shutdown
process.on( 'SIGINT', () => {
    console.log( 'Shutting down server...' );
    // Clean up the temporary Python script file
    try {
        fs.unlinkSync( pythonScriptPath );
    } catch ( err ) {
        console.error( 'Error removing Python script:', err );
    }
    process.exit( 0 );
} );