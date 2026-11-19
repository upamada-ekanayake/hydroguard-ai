# backend/ml/train_model.py
import os

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, mean_absolute_error
from sklearn.model_selection import train_test_split

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Generate Synthetic Hydrological Data (5,000 scenarios)
print("Generating synthetic hydrological data...")
np.random.seed(42)
n_samples = 5000

# Realistic ranges for Victoria Dam catchment
rainfall_mm = np.random.uniform(0, 300, n_samples)
water_level_ft = np.random.uniform(1100, 1160, n_samples)
inflow_rate = np.random.uniform(1000, 15000, n_samples)

# Create logical rules for synthetic labels (to teach the model realistic patterns)
# Risk: 0 = Normal, 1 = Warning, 2 = Critical
risk_level = np.where(
    (rainfall_mm > 100) & (water_level_ft > 1140),
    2,  # Critical
    np.where(
        (rainfall_mm > 50) & (water_level_ft > 1120),
        1,  # Warning
        0,  # Normal
    ),
)

# Add 5% random noise to simulate real-world sensor variance (prevents perfect data leakage)
noise_mask = np.random.rand(n_samples) < 0.05
risk_level = np.where(noise_mask, np.random.randint(0, 3, n_samples), risk_level)

# Estimated cusecs based on risk and inflow (simplified hydrological logic)
estimated_cusecs = np.where(
    risk_level == 2,
    inflow_rate * 3.5 + np.random.normal(5000, 1000, n_samples),
    np.where(
        risk_level == 1,
        inflow_rate * 1.5 + np.random.normal(1000, 500, n_samples),
        np.random.normal(500, 200, n_samples),  # Normal baseline
    ),
)
estimated_cusecs = np.clip(estimated_cusecs, 0, 80000)  # Cap at max spillway capacity

# Create DataFrame
df = pd.DataFrame(
    {
        "rainfall_mm": rainfall_mm,
        "water_level_ft": water_level_ft,
        "inflow_rate": inflow_rate,
        "risk_level": risk_level,
        "estimated_cusecs": estimated_cusecs,
    }
)

# 2. Train the XGBoost Models
print("Training XGBoost models...")
X = df[["rainfall_mm", "water_level_ft", "inflow_rate"]]
y_risk = df["risk_level"]
y_cusecs = df["estimated_cusecs"]

X_train, X_test, y_risk_train, y_risk_test, y_cusecs_train, y_cusecs_test = train_test_split(
    X, y_risk, y_cusecs, test_size=0.2, random_state=42
)

# Train Risk Classifier
risk_model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
risk_model.fit(X_train, y_risk_train)

# Train Cusecs Regressor
cusecs_model = xgb.XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
cusecs_model.fit(X_train, y_cusecs_train)

# Evaluate
risk_pred = risk_model.predict(X_test)
cusecs_pred = cusecs_model.predict(X_test)
print(f"Risk Model Accuracy: {accuracy_score(y_risk_test, risk_pred):.3f}")
print(f"Cusecs Model MAE: {mean_absolute_error(y_cusecs_test, cusecs_pred):.0f} cusecs")

# 3. Save Models
joblib.dump(risk_model, os.path.join(MODEL_DIR, "risk_model.pkl"))
joblib.dump(cusecs_model, os.path.join(MODEL_DIR, "cusecs_model.pkl"))
print("Models saved to", MODEL_DIR)
