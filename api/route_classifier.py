
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
