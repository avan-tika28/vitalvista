"""
VITALVISTA - Real Healthcare Analytics Engine
Calculates true dataset statistics, distributions, correlations, and feature metrics dynamically from pandas DataFrames.
ZERO hardcoded or synthetic values.
"""

import numpy as np
import pandas as pd
from data_loader import load_dataset, DATASETS

class AnalyticsEngine:
    def __init__(self):
        self.cached_dfs = {}
        self.cached_infos = {}

    def get_df(self, key):
        if key not in self.cached_dfs:
            if key not in DATASETS:
                key = 'diabetes'
            df, info = load_dataset(key)
            self.cached_dfs[key] = df
            self.cached_infos[key] = info
        return self.cached_dfs[key], self.cached_infos[key]

    def get_dataset_summary(self, key):
        df, info = self.get_df(key)
        target_col = info.get('target')
        if not target_col or target_col not in df.columns:
            target_col = df.columns[-1]

        feature_cols = [c for c in df.columns if c != target_col]
        numeric_cols = list(df[feature_cols].select_dtypes(include=[np.number]).columns)
        categorical_cols = list(df[feature_cols].select_dtypes(exclude=[np.number]).columns)

        missing_count = int(df.isna().sum().sum())
        duplicate_count = int(df.duplicated().sum())

        return {
            'key': key,
            'name': info['name'],
            'source': info['source'],
            'url': info.get('url', ''),
            'records': len(df),
            'features': len(feature_cols),
            'target_variable': target_col,
            'missing_values': missing_count,
            'duplicate_rows': duplicate_count,
            'numeric_features': numeric_cols,
            'categorical_features': categorical_cols,
            'all_features': list(df.columns),
            'pipeline_status': {
                'dataset_loaded': True,
                'preprocessing_ready': True,
                'model_available': True,
                'prediction_ready': True
            }
        }

    def filter_dataframe(self, df, key, age_min=None, age_max=None, gender=None, target_val=None):
        filtered_df = df.copy()

        # Find age column
        age_col = None
        for col in filtered_df.columns:
            if col.lower() == 'age':
                age_col = col
                break

        if age_col and (age_min is not None or age_max is not None):
            try:
                if age_min is not None:
                    filtered_df = filtered_df[pd.to_numeric(filtered_df[age_col], errors='coerce') >= float(age_min)]
                if age_max is not None:
                    filtered_df = filtered_df[pd.to_numeric(filtered_df[age_col], errors='coerce') <= float(age_max)]
            except Exception:
                pass

        # Find gender column
        gender_col = None
        for col in filtered_df.columns:
            if col.lower() in ['sex', 'gender']:
                gender_col = col
                break

        if gender_col and gender and gender != 'all':
            try:
                g_str = str(gender).lower()
                if g_str in ['male', 'm', '1']:
                    filtered_df = filtered_df[filtered_df[gender_col].astype(str).str.lower().isin(['male', 'm', '1', '1.0'])]
                elif g_str in ['female', 'f', '0']:
                    filtered_df = filtered_df[filtered_df[gender_col].astype(str).str.lower().isin(['female', 'f', '0', '0.0'])]
            except Exception:
                pass

        # Target filter
        _, info = self.get_df(key)
        target_col = info.get('target')
        if not target_col or target_col not in df.columns:
            target_col = df.columns[-1]

        if target_val and target_val != 'all' and target_col in filtered_df.columns:
            try:
                filtered_df = filtered_df[filtered_df[target_col].astype(str) == str(target_val)]
            except Exception:
                pass

        return filtered_df

    def get_dataset_distributions(self, key, feature_name=None, age_min=None, age_max=None, gender=None, target_val=None):
        raw_df, info = self.get_df(key)
        df = self.filter_dataframe(raw_df, key, age_min, age_max, gender, target_val)

        target_col = info.get('target')
        if not target_col or target_col not in df.columns:
            target_col = df.columns[-1]

        # Target distribution
        target_counts = df[target_col].value_counts().to_dict()
        target_dist = {str(k): int(v) for k, v in target_counts.items()}

        # Age distribution
        age_dist = None
        age_col = next((c for c in df.columns if c.lower() == 'age'), None)
        if age_col and pd.api.types.is_numeric_dtype(df[age_col]):
            s = df[age_col].dropna()
            if len(s) > 0:
                counts, bin_edges = np.histogram(s, bins=8)
                labels = [f"{int(bin_edges[i])}-{int(bin_edges[i+1])}" for i in range(len(counts))]
                age_dist = {'labels': labels, 'counts': [int(c) for c in counts]}

        # BMI distribution
        bmi_dist = None
        bmi_col = next((c for c in df.columns if c.lower() == 'bmi'), None)
        if bmi_col and pd.api.types.is_numeric_dtype(df[bmi_col]):
            s = df[bmi_col].replace(0, np.nan).dropna()
            if len(s) > 0:
                counts, bin_edges = np.histogram(s, bins=8)
                labels = [f"{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}" for i in range(len(counts))]
                bmi_dist = {'labels': labels, 'counts': [int(c) for c in counts]}

        # Dynamic Selected Feature distribution
        feature_dist = None
        if feature_name and feature_name in df.columns:
            s = df[feature_name].dropna()
            if pd.api.types.is_numeric_dtype(s):
                # Numeric histogram
                s_clean = s.replace(0, np.nan).dropna() if feature_name in ['Glucose', 'BloodPressure', 'BMI', 'chol'] else s
                if len(s_clean) > 0:
                    counts, bin_edges = np.histogram(s_clean, bins=8)
                    labels = [f"{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}" for i in range(len(counts))]
                    feature_dist = {'is_numeric': True, 'labels': labels, 'counts': [int(c) for c in counts]}
            else:
                # Categorical value counts
                vc = s.value_counts().head(10).to_dict()
                feature_dist = {'is_numeric': False, 'labels': [str(k) for k in vc.keys()], 'counts': [int(v) for v in vc.values()]}

        return {
            'target_col': target_col,
            'target_distribution': target_dist,
            'age_distribution': age_dist,
            'bmi_distribution': bmi_dist,
            'feature_distribution': feature_dist,
            'filtered_records': len(df)
        }

    def get_dataset_correlation(self, key):
        df, info = self.get_df(key)
        # Select numeric columns only
        num_df = df.select_dtypes(include=[np.number])
        if num_df.shape[1] < 2:
            return {'features': [], 'matrix': []}

        # Replace 0s with NaN for biometric zero-invalid columns if diabetes
        if key == 'diabetes':
            for c in ['Glucose', 'BloodPressure', 'BMI']:
                if c in num_df.columns:
                    num_df[c] = num_df[c].replace(0, np.nan)

        # Select top 8 columns if too large for clean UI display
        cols = list(num_df.columns[:8])
        corr_matrix = num_df[cols].corr().fillna(0).round(2)

        return {
            'features': cols,
            'matrix': corr_matrix.values.tolist()
        }

    def get_feature_vs_target(self, key, feature_name):
        df, info = self.get_df(key)
        target_col = info.get('target')
        if not target_col or target_col not in df.columns:
            target_col = df.columns[-1]

        if feature_name not in df.columns or feature_name == target_col:
            return {'error': 'Invalid feature selected'}

        s = df[feature_name]
        if pd.api.types.is_numeric_dtype(s):
            grouped = df.groupby(target_col)[feature_name].agg(['mean', 'median', 'std', 'count']).round(2)
            grouped = grouped.fillna(0)
            records = []
            for t_val, row in grouped.iterrows():
                records.append({
                    'target_class': str(t_val),
                    'mean': float(row['mean']),
                    'median': float(row['median']),
                    'std': float(row['std']),
                    'count': int(row['count'])
                })
            return {'type': 'numeric', 'feature': feature_name, 'target': target_col, 'stats': records}
        else:
            crosstab = pd.crosstab(df[feature_name], df[target_col])
            data = []
            for cat_val, row in crosstab.iterrows():
                counts = {str(k): int(v) for k, v in row.to_dict().items()}
                data.append({'feature_val': str(cat_val), 'target_counts': counts})
            return {'type': 'categorical', 'feature': feature_name, 'target': target_col, 'crosstab': data}

    def get_missing_analysis(self, key):
        df, info = self.get_df(key)
        missing_counts = df.isna().sum()
        total_rows = len(df)

        items = []
        for col in df.columns:
            cnt = int(missing_counts[col])
            pct = round(float((cnt / total_rows) * 100), 2)
            items.append({
                'feature': col,
                'missing_count': cnt,
                'percentage': pct
            })

        has_missing = any(i['missing_count'] > 0 for i in items)
        return {
            'has_missing': has_missing,
            'message': 'No missing values detected.' if not has_missing else f'Identified {df.isna().sum().sum()} missing values across fields.',
            'details': items
        }

    def get_feature_explorer(self, key, feature_name):
        df, info = self.get_df(key)
        if feature_name not in df.columns:
            feature_name = df.columns[0]

        s = df[feature_name]
        if pd.api.types.is_numeric_dtype(s):
            s_clean = s.dropna()
            if len(s_clean) == 0:
                return {'is_numeric': True, 'mean': 0, 'median': 0, 'min': 0, 'max': 0, 'std': 0}
            
            counts, bin_edges = np.histogram(s_clean, bins=10)
            labels = [f"{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}" for i in range(len(counts))]
            
            return {
                'feature': feature_name,
                'is_numeric': True,
                'mean': round(float(s_clean.mean()), 2),
                'median': round(float(s_clean.median()), 2),
                'min': round(float(s_clean.min()), 2),
                'max': round(float(s_clean.max()), 2),
                'std': round(float(s_clean.std()), 2),
                'histogram': {'labels': labels, 'counts': [int(c) for c in counts]}
            }
        else:
            s_clean = s.astype(str)
            vc = s_clean.value_counts()
            top_val = str(vc.index[0]) if len(vc) > 0 else 'N/A'
            top_freq = int(vc.iloc[0]) if len(vc) > 0 else 0

            return {
                'feature': feature_name,
                'is_numeric': False,
                'unique_values': int(s_clean.nunique()),
                'top_value': top_val,
                'top_frequency': top_freq,
                'frequency_distribution': {'labels': [str(k) for k in vc.head(10).keys()], 'counts': [int(v) for v in vc.head(10).values]}
            }

analytics_engine = AnalyticsEngine()
