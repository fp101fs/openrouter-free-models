import requests

def get_free_openrouter_models():
    url = "https://openrouter.ai/api/v1/models"
    response = requests.get(url)
    
    if response.status_code == 200:
        all_models = response.json().get('data', [])
        # Filter for models where both prompt and completion costs are "0"
        free_models = [
            {
                "id": m['id'],
                "name": m['name'],
                "context_length": m['context_length']
            }
            for m in all_models 
            if float(m.get('pricing', {}).get('prompt', 1)) == 0 
            and float(m.get('pricing', {}).get('completion', 1)) == 0
        ]
        return free_models
    else:
        return f"Error: {response.status_code}"

# Print the results
free_list = get_free_openrouter_models()
for model in free_list:
    print(f"{model['id']} - {model['name']} (Context: {model['context_length']})")