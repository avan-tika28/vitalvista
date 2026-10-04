"""
VITALVISTA - Enterprise Healthcare Data & Machine Learning Backend Web Server
Powered by Flask, SQLite, Pandas, NumPy, Scikit-learn
"""

import os
import sqlite3
import json
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from ml_engine import ml_engine
from analytics_engine import analytics_engine

app = Flask(__name__, static_folder=None)
CORS(app)

# --------------------------------------------------------------------------
# SQLITE PERSISTENCE LAYER FOR REAL CLINICAL RISK ASSESSMENTS
# --------------------------------------------------------------------------
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)
DB_FILE = os.path.join(DATA_DIR, 'vitalvista_assessments.db')

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assessments (
            id TEXT PRIMARY KEY,
            disease TEXT NOT NULL,
            disease_name TEXT NOT NULL,
            prediction_label TEXT NOT NULL,
            probability REAL,
            risk_level TEXT NOT NULL,
            risk_score REAL NOT NULL,
            model TEXT NOT NULL,
            dataset TEXT NOT NULL,
            input_data TEXT NOT NULL,
            full_result TEXT NOT NULL,
            created_at TEXT NOT NULL,
            patient_id TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            contact TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    # Ensure patient_id column exists if upgrading existing DB
    cursor.execute("PRAGMA table_info(assessments)")
    cols = [c[1] for c in cursor.fetchall()]
    if 'patient_id' not in cols:
        cursor.execute("ALTER TABLE assessments ADD COLUMN patient_id TEXT")

    conn.commit()
    conn.close()

init_db()

def generate_assessment_id():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM assessments")
    count = cursor.fetchone()[0]
    conn.close()
    return f"VV-{(count + 1):03d}"

def generate_patient_id():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM patients")
    count = cursor.fetchone()[0]
    conn.close()
    return f"PAT-{(count + 1):03d}"

# Initialize Real ML Pipeline on Server Startup
print("Initializing VitalVista Real Machine Learning Server Engine...")
ml_engine.train_all_pipelines()

# Serve Frontend Web App Index
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# --------------------------------------------------------------------------
# API ENDPOINTS (PROGRAMMATICALLY CALCULATED FROM REAL DATA & MODELS)
# --------------------------------------------------------------------------

@app.route('/api/dataset-info', methods=['GET'])
def get_dataset_info():
    """Returns programmatic metadata from actual public healthcare datasets."""
    return jsonify({
        'status': 'success',
        'datasets': ml_engine.dataset_metadata
    })

@app.route('/api/model-metrics', methods=['GET'])
def get_model_metrics():
    """Returns actual calculated test-set performance metrics from trained estimators."""
    return jsonify({
        'status': 'success',
        'metrics': ml_engine.metrics
    })

@app.route('/api/eda-data', methods=['GET'])
def get_eda_data():
    """Returns dataset summary statistics and feature rankings programmatically."""
    rf_diab = ml_engine.models['diabetes']['Random Forest']
    feat_names = ml_engine.dataset_metadata['diabetes']['feature_names']
    importances = [round(float(imp), 4) for imp in rf_diab.feature_importances_]

    return jsonify({
        'status': 'success',
        'feature_importance': {
            'features': feat_names,
            'scores': importances
        },
        'disease_counts': {
            'Diabetes': ml_engine.dataset_metadata['diabetes']['total_records'],
            'Heart Disease': ml_engine.dataset_metadata['heart']['total_records'],
            'Hypertension': ml_engine.dataset_metadata['hypertension']['total_records'],
            'Obesity': ml_engine.dataset_metadata['obesity']['total_records']
        }
    })

@app.route('/api/predict', methods=['POST'])
def run_prediction():
    """Performs real-time machine learning inference using trained estimators and stores assessment record in SQLite."""
    try:
        data = request.json
        params = {
            'age': float(data.get('age', 45)),
            'gender': data.get('gender', 'Male'),
            'height': float(data.get('height', 172)),
            'weight': float(data.get('weight', 78)),
            'systolic': float(data.get('systolic', 128)),
            'diastolic': float(data.get('diastolic', 82)),
            'glucose': float(data.get('glucose', 105)),
            'hba1c': float(data.get('hba1c', 5.7)),
            'cholesterol': float(data.get('cholesterol', 210)),
            'heartRate': float(data.get('heartRate', 74)),
            'activity': float(data.get('activity', 3)),
            'smoking': data.get('smoking', 'Never'),
            'alcohol': data.get('alcohol', 'None')
        }
        algorithm = data.get('algorithm', 'Random Forest')
        disease = data.get('disease', 'all')
        patient_id = data.get('patient_id')

        prediction_result = ml_engine.predict_patient_risk(params, target_disease=disease, selected_algorithm=algorithm)

        # Save Assessment Record to SQLite Database
        assessment_id = generate_assessment_id()
        now_iso = datetime.now().strftime("%b %d, %Y - %I:%M %p")
        
        prediction_result['assessment_id'] = assessment_id
        prediction_result['created_at'] = now_iso
        prediction_result['patient_id'] = patient_id

        overall_score = prediction_result['overall_risk_index']
        risk_lvl = 'HIGH RISK' if overall_score >= 70 else ('MODERATE RISK' if overall_score >= 45 else 'LOW RISK')

        target_key = disease if disease != 'all' else 'diabetes'
        d_res = prediction_result['results'].get(target_key, prediction_result['results']['diabetes'])

        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO assessments (id, disease, disease_name, prediction_label, probability, risk_level, risk_score, model, dataset, input_data, full_result, created_at, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            assessment_id,
            disease,
            d_res['disease_name'],
            d_res['prediction_label'],
            d_res['probability'],
            risk_lvl,
            overall_score,
            algorithm,
            d_res['dataset_source'],
            json.dumps(prediction_result['submitted_inputs']),
            json.dumps(prediction_result),
            now_iso,
            patient_id
        ))
        conn.commit()
        conn.close()

        return jsonify({
            'status': 'success',
            'result': prediction_result
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/assessments', methods=['GET'])
def get_assessments():
    """Returns stored assessment records from SQLite with optional filtering and search."""
    disease = request.args.get('disease')
    risk_level = request.args.get('risk_level')
    q = request.args.get('q')
    sort = request.args.get('sort', 'newest')

    query = "SELECT id, disease, disease_name, prediction_label, probability, risk_level, risk_score, model, dataset, input_data, created_at FROM assessments WHERE 1=1"
    params = []

    if disease and disease != 'all':
        query += " AND (disease = ? OR disease = 'all')"
        params.append(disease)
    if risk_level and risk_level != 'all':
        query += " AND risk_level = ?"
        params.append(risk_level)
    if q:
        query += " AND (id LIKE ? OR disease_name LIKE ? OR model LIKE ? OR input_data LIKE ?)"
        q_wild = f"%{q}%"
        params.extend([q_wild, q_wild, q_wild, q_wild])

    if sort == 'oldest':
        query += " ORDER BY ROWID ASC"
    else:
        query += " ORDER BY ROWID DESC"

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    records = []
    for r in rows:
        try:
            inp = json.loads(r[9])
        except Exception:
            inp = r[9]

        records.append({
            'id': r[0],
            'disease': r[1],
            'disease_name': r[2],
            'prediction_label': r[3],
            'probability': r[4],
            'risk_level': r[5],
            'risk_score': r[6],
            'model': r[7],
            'dataset': r[8],
            'input_data': inp,
            'created_at': r[10]
        })

    return jsonify({'status': 'success', 'assessments': records})

@app.route('/api/assessments/<assessment_id>', methods=['GET'])
def get_assessment_by_id(assessment_id):
    """Fetches full assessment details by ID from SQLite."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT id, disease, disease_name, prediction_label, probability, risk_level, risk_score, model, dataset, input_data, full_result, created_at FROM assessments WHERE id = ?", (assessment_id,))
    r = cursor.fetchone()
    conn.close()

    if not r:
        return jsonify({'status': 'error', 'message': 'Assessment not found'}), 404

    try:
        inp = json.loads(r[9])
    except Exception:
        inp = r[9]

    try:
        full_res = json.loads(r[10])
    except Exception:
        full_res = r[10]

    return jsonify({
        'status': 'success',
        'assessment': {
            'id': r[0],
            'disease': r[1],
            'disease_name': r[2],
            'prediction_label': r[3],
            'probability': r[4],
            'risk_level': r[5],
            'risk_score': r[6],
            'model': r[7],
            'dataset': r[8],
            'input_data': inp,
            'full_result': full_res,
            'created_at': r[11]
        }
    })

@app.route('/api/assessment-stats', methods=['GET'])
def get_assessment_stats():
    """Returns dynamic statistics calculated directly from SQLite assessment records."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM assessments")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM patients")
    total_patients = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM assessments WHERE risk_level = 'LOW RISK'")
    low_cnt = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM assessments WHERE risk_level = 'MODERATE RISK'")
    mod_cnt = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM assessments WHERE risk_level = 'HIGH RISK'")
    high_cnt = cursor.fetchone()[0]

    cursor.execute("SELECT disease, COUNT(*) FROM assessments GROUP BY disease")
    disease_rows = cursor.fetchall()
    disease_breakdown = {r[0]: r[1] for r in disease_rows}

    cursor.execute("SELECT id, created_at, risk_score, disease_name FROM assessments ORDER BY ROWID ASC LIMIT 20")
    trend_rows = cursor.fetchall()
    trend = [{'id': r[0], 'date': r[1], 'score': r[2], 'disease': r[3]} for r in trend_rows]

    conn.close()

    return jsonify({
        'status': 'success',
        'stats': {
            'total_assessments': total,
            'total_patients': total_patients,
            'low_risk_count': low_cnt,
            'moderate_risk_count': mod_cnt,
            'high_risk_count': high_cnt,
            'disease_breakdown': disease_breakdown,
            'risk_trend': trend
        }
    })

# --------------------------------------------------------------------------
# STEP 13: PATIENT MANAGEMENT REST API ENDPOINTS
# --------------------------------------------------------------------------

@app.route('/api/patients', methods=['GET'])
def get_patients():
    """Returns registered patients with their assessment counts and latest risk status."""
    q = request.args.get('q')
    risk = request.args.get('risk_level')
    sort = request.args.get('sort', 'newest')

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    query = """
        SELECT p.id, p.name, p.age, p.gender, p.contact, p.notes, p.created_at,
               COUNT(a.id) as assessment_count,
               (SELECT risk_level FROM assessments WHERE patient_id = p.id ORDER BY ROWID DESC LIMIT 1) as latest_risk,
               (SELECT created_at FROM assessments WHERE patient_id = p.id ORDER BY ROWID DESC LIMIT 1) as latest_date,
               (SELECT disease_name FROM assessments WHERE patient_id = p.id ORDER BY ROWID DESC LIMIT 1) as latest_disease
        FROM patients p
        LEFT JOIN assessments a ON p.id = a.patient_id
        WHERE 1=1
    """
    params = []

    if q:
        query += " AND (p.id LIKE ? OR p.name LIKE ? OR p.contact LIKE ?)"
        q_wild = f"%{q}%"
        params.extend([q_wild, q_wild, q_wild])

    query += " GROUP BY p.id"

    if risk and risk != 'all':
        query += " HAVING latest_risk = ?"
        params.append(risk)

    if sort == 'oldest':
        query += " ORDER BY p.ROWID ASC"
    elif sort == 'name':
        query += " ORDER BY p.name ASC"
    else:
        query += " ORDER BY p.ROWID DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    patients_list = []
    for r in rows:
        patients_list.append({
            'id': r[0],
            'name': r[1],
            'age': r[2],
            'gender': r[3],
            'contact': r[4] or 'N/A',
            'notes': r[5] or '',
            'created_at': r[6],
            'assessment_count': r[7],
            'latest_risk': r[8] or 'No Assessments',
            'latest_date': r[9] or 'N/A',
            'latest_disease': r[10] or 'N/A'
        })

    return jsonify({'status': 'success', 'patients': patients_list})

@app.route('/api/patients', methods=['POST'])
def register_patient():
    """Registers a new clinical patient in SQLite database."""
    try:
        data = request.json or {}
        name = data.get('name', '').strip()
        age = int(data.get('age', 45))
        gender = data.get('gender', 'Male')
        contact = data.get('contact', '').strip()
        notes = data.get('notes', '').strip()
        patient_id = data.get('id') or generate_patient_id()

        if not name:
            return jsonify({'status': 'error', 'message': 'Patient name is required'}), 400

        now_iso = datetime.now().strftime("%b %d, %Y - %I:%M %p")

        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()

        # Check unique constraint
        cursor.execute("SELECT id FROM patients WHERE id = ?", (patient_id,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'status': 'error', 'message': f'Patient ID {patient_id} already exists.'}), 400

        cursor.execute('''
            INSERT INTO patients (id, name, age, gender, contact, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (patient_id, name, age, gender, contact, notes, now_iso))
        conn.commit()
        conn.close()

        return jsonify({
            'status': 'success',
            'message': f'Patient profile {name} ({patient_id}) successfully registered.',
            'patient': {
                'id': patient_id,
                'name': name,
                'age': age,
                'gender': gender,
                'contact': contact,
                'notes': notes,
                'created_at': now_iso
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/patients/<patient_id>', methods=['GET'])
def get_patient_profile(patient_id):
    """Fetches patient profile details and linked assessment history from SQLite."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, age, gender, contact, notes, created_at FROM patients WHERE id = ?", (patient_id,))
    p_row = cursor.fetchone()

    if not p_row:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Patient profile not found'}), 404

    cursor.execute("""
        SELECT id, disease, disease_name, prediction_label, probability, risk_level, risk_score, model, dataset, input_data, created_at
        FROM assessments
        WHERE patient_id = ? OR id IN (SELECT id FROM assessments WHERE input_data LIKE ?)
        ORDER BY ROWID DESC
    """, (patient_id, f"%{patient_id}%"))
    a_rows = cursor.fetchall()
    conn.close()

    assessments = []
    for r in a_rows:
        try:
            inp = json.loads(r[9])
        except Exception:
            inp = r[9]
        assessments.append({
            'id': r[0],
            'disease': r[1],
            'disease_name': r[2],
            'prediction_label': r[3],
            'probability': r[4],
            'risk_level': r[5],
            'risk_score': r[6],
            'model': r[7],
            'dataset': r[8],
            'input_data': inp,
            'created_at': r[10]
        })

    patient_data = {
        'id': p_row[0],
        'name': p_row[1],
        'age': p_row[2],
        'gender': p_row[3],
        'contact': p_row[4] or 'N/A',
        'notes': p_row[5] or '',
        'created_at': p_row[6],
        'assessments': assessments
    }

    return jsonify({'status': 'success', 'patient': patient_data})

@app.route('/api/patients/<patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    """Safely deletes patient profile and disassociates linked records."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
    cursor.execute("UPDATE assessments SET patient_id = NULL WHERE patient_id = ?", (patient_id,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'message': f'Patient {patient_id} successfully deleted.'})

# --------------------------------------------------------------------------
# STEP 10: REAL HEALTH ANALYTICS API ENDPOINTS
# --------------------------------------------------------------------------

@app.route('/api/datasets', methods=['GET'])
def get_available_datasets():
    """Lists available healthcare datasets."""
    datasets_list = [
        {'key': 'diabetes', 'name': 'UCI Pima Indians Diabetes Dataset'},
        {'key': 'heart', 'name': 'UCI Cleveland Heart Disease Dataset'},
        {'key': 'hypertension', 'name': 'US Medical Risk Dataset'},
        {'key': 'obesity', 'name': 'UCI Biometric Clinical Dataset'}
    ]
    return jsonify({'status': 'success', 'datasets': datasets_list})

@app.route('/api/datasets/<key>/summary', methods=['GET'])
def get_dataset_analytics_summary(key):
    """Returns dynamic overview, records, missing values, quality card, and pipeline status."""
    summary = analytics_engine.get_dataset_summary(key)
    return jsonify({'status': 'success', 'summary': summary})

@app.route('/api/datasets/<key>/distribution', methods=['GET'])
def get_dataset_analytics_distribution(key):
    """Returns target, age, BMI, and selected feature distributions from real dataset."""
    feature = request.args.get('feature')
    age_min = request.args.get('age_min')
    age_max = request.args.get('age_max')
    gender = request.args.get('gender')
    target_val = request.args.get('target')

    dist = analytics_engine.get_dataset_distributions(key, feature_name=feature, age_min=age_min, age_max=age_max, gender=gender, target_val=target_val)
    return jsonify({'status': 'success', 'distributions': dist})

@app.route('/api/datasets/<key>/correlation', methods=['GET'])
def get_dataset_analytics_correlation(key):
    """Returns Pearson correlation matrix calculated from numeric dataset features."""
    corr = analytics_engine.get_dataset_correlation(key)
    return jsonify({'status': 'success', 'correlation': corr})

@app.route('/api/datasets/<key>/feature-vs-target', methods=['GET'])
def get_dataset_feature_vs_target(key):
    """Returns feature vs target aggregated stats from real dataset."""
    feature = request.args.get('feature')
    res = analytics_engine.get_feature_vs_target(key, feature)
    return jsonify({'status': 'success', 'analysis': res})

@app.route('/api/datasets/<key>/missing-analysis', methods=['GET'])
def get_dataset_missing_analysis(key):
    """Returns missing values breakdown per feature column."""
    missing = analytics_engine.get_missing_analysis(key)
    return jsonify({'status': 'success', 'missing_analysis': missing})

@app.route('/api/datasets/<key>/feature-stats', methods=['GET'])
def get_dataset_feature_stats(key):
    """Returns statistics for selected feature (Mean, Median, Min, Max, Std Dev / Categorical freq)."""
    feature = request.args.get('feature')
    explorer = analytics_engine.get_feature_explorer(key, feature)
    return jsonify({'status': 'success', 'feature_explorer': explorer})

@app.route('/<path:path>', methods=['GET', 'POST', 'DELETE'])
def serve_static(path):
    rpath = request.path.rstrip('/')
    print(f"SERVE_STATIC DISPATCH: rpath={repr(rpath)}, method={request.method}", flush=True)
    if rpath.startswith('/api/patients'):
        print(" -> DISPATCHING TO PATIENTS API", flush=True)
        if rpath == '/api/patients':
            if request.method == 'POST':
                return register_patient()
            return get_patients()
        else:
            pid = rpath.replace('/api/patients/', '').strip('/')
            if request.method == 'DELETE':
                return delete_patient(pid)
            return get_patient_profile(pid)
    elif rpath.startswith('/api/assessments'):
        if rpath == '/api/assessments':
            return get_assessments()
        pid = rpath.replace('/api/assessments/', '').strip('/')
        return get_assessment_by_id(pid)
    elif rpath == '/api/assessment-stats':
        return get_assessment_stats()

    if path.startswith('api/'):
        print(f" -> UNMATCHED API ENDPOINT: {path}", flush=True)
        return jsonify({'status': 'error', 'message': f'API endpoint /{path} not found'}), 404

    if os.path.exists(path):
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting VitalVista ML Server on http://localhost:{port}...")
    print("URL MAP:\n", app.url_map)
    app.run(host='0.0.0.0', port=port, debug=False)
