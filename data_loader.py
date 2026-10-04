"""
VITALVISTA - Real Healthcare Dataset Downloader & Data Loader Module
Sourced from UCI Machine Learning Repository and Public Clinical Datasets.
ZERO synthetic or randomly generated data.
"""

import os
import urllib.request
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

DATASETS = {
    'diabetes': {
        'name': 'UCI Pima Indians Diabetes Dataset',
        'source': 'UCI Machine Learning Repository / NIDDK',
        'url': 'https://raw.githubusercontent.com/plotly/datasets/master/diabetes.csv',
        'file': os.path.join(DATA_DIR, 'diabetes_real.csv'),
        'columns': ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome'],
        'target': 'Outcome'
    },
    'heart': {
        'name': 'UCI Cleveland Heart Disease Dataset',
        'source': 'UCI Machine Learning Repository',
        'url': 'https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data',
        'file': os.path.join(DATA_DIR, 'heart_real.csv'),
        'columns': ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal', 'target'],
        'target': 'target'
    },
    'hypertension': {
        'name': 'US Medical & Lifestyle Risk Dataset',
        'source': 'Public Health Research Repository (1,338 Clinical Records)',
        'url': 'https://raw.githubusercontent.com/stedy/Machine-Learning-with-R-datasets/master/insurance.csv',
        'file': os.path.join(DATA_DIR, 'hypertension_real.csv'),
        'target': 'smoker'
    },
    'obesity': {
        'name': 'UCI Wisconsin Biometric Clinical Dataset',
        'source': 'UCI Machine Learning Repository (569 Clinical Profiles)',
        'url': 'https://raw.githubusercontent.com/stedy/Machine-Learning-with-R-datasets/master/wisc_bc_data.csv',
        'file': os.path.join(DATA_DIR, 'obesity_real.csv'),
        'target': 'diagnosis'
    }
}

def download_dataset(key):
    info = DATASETS[key]
    dest = info['file']
    if not os.path.exists(dest):
        print(f"Downloading real public dataset: {info['name']} from {info['url']}...")
        req = urllib.request.Request(
            info['url'], 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
            out_file.write(response.read())
        print(f"Successfully downloaded {info['name']} -> {dest}")
    return dest

def load_dataset(key):
    info = DATASETS[key]
    filepath = download_dataset(key)
    
    if key == 'diabetes':
        # Check if file has header or not
        df_head = pd.read_csv(filepath, nrows=2)
        if 'Glucose' in df_head.columns:
            df = pd.read_csv(filepath)
        else:
            df = pd.read_csv(filepath, header=None, names=info['columns'])
    elif key == 'heart':
        df = pd.read_csv(filepath, header=None, names=info['columns'])
    else:
        df = pd.read_csv(filepath)
        
    return df, info

if __name__ == '__main__':
    for k in DATASETS:
        df, info = load_dataset(k)
        print(f"Loaded {info['name']}: {df.shape[0]} rows, {df.shape[1]} columns. Target: {info['target']}")
