/* ==========================================================================
   VITALVISTA - ENTERPRISE HEALTHCARE SAAS APPLICATION LOGIC
   Positioning: Intelligent Healthcare Risk Assessment
   ========================================================================== */

const API_BASE = 'http://127.0.0.1:5000/api';
window.lastPredictionResult = null;
window.currentAnalyticsKey = 'diabetes';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Sidebar & Top-Header Navigation
  initNavigation();
  
  // Initialize Predictor Engine Form
  initPredictor();

  // Initialize Patients Workspace Module (Step 13)
  initPatientsModule();

  // Initialize Search & Filter Listeners for Assessment History
  initHistoryFilters();

  // Initialize Step 10 Analytics Controls
  initAnalyticsControls();

  // Load Initial Dashboard Metrics, Patients & History
  fetchDashboardData();
  renderPatientsWorkspace();
  fetchAssessmentHistory();

  // Fetch Dataset Info & Model Metrics for standard tabs
  fetchRealDatasetInfo();
  fetchRealModelMetrics('heart');
});

function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else if (hour >= 17 && hour < 21) {
    return 'Good evening';
  } else {
    return 'Good night';
  }
}

function updateHeaderGreeting(targetId = 'dashboard') {
  const hTitle = document.getElementById('headerTitle');
  const hSub = document.getElementById('headerSubtitle');
  if (!hTitle) return;

  if (targetId === 'dashboard') {
    hTitle.textContent = getTimeBasedGreeting();
    if (hSub) hSub.textContent = 'Healthcare Intelligence Dashboard';
  }
}

/* --------------------------------------------------------------------------
   1. NAVIGATION & TAB SWITCHING SYSTEM
   -------------------------------------------------------------------------- */
function initNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  const sections = document.querySelectorAll('.page-section');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const appSidebar = document.getElementById('appSidebar');

  const headerTitles = {
    'dashboard': { sub: 'Healthcare Intelligence Dashboard' },
    'patients': { title: 'Patients Management', sub: 'Clinical patient records & longitudinal history' },
    'predict': { title: 'Patient Risk Assessment', sub: 'Compute real-time machine learning risk inference' },
    'history': { title: 'Assessment History', sub: 'Persisted clinical assessment records' },
    'analytics': { title: 'Health Analytics', sub: 'Explore dataset distributions & correlations' },
    'insights': { title: 'Disease Insights', sub: 'Active clinical disease risk assessment modules' },
    'models': { title: 'Model Intelligence', sub: 'Evaluated Scikit-Learn estimator metrics' },
    'data': { title: 'Integrated Datasets', sub: 'Public clinical data repositories' },
    'settings': { title: 'System Settings', sub: 'Platform configuration & database status' }
  };

  // Set initial header greeting on load
  updateHeaderGreeting('dashboard');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('data-target');
      if (!targetId) return;

      // Update Active Sidebar Link
      navItems.forEach(i => {
        if (i.getAttribute('data-target') === targetId) {
          i.classList.add('active');
        } else {
          i.classList.remove('active');
        }
      });

      // Update Active Section
      sections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });

      // Update Header Greeting
      const hTitle = document.getElementById('headerTitle');
      const hSub = document.getElementById('headerSubtitle');

      if (targetId === 'dashboard') {
        if (hTitle) hTitle.textContent = getTimeBasedGreeting();
        if (hSub) hSub.textContent = 'Healthcare Intelligence Dashboard';
      } else {
        const hInfo = headerTitles[targetId];
        if (hInfo) {
          if (hTitle && hInfo.title) hTitle.textContent = hInfo.title;
          if (hSub && hInfo.sub) hSub.textContent = hInfo.sub;
        }
      }

      // Tab specific data refresh
      if (targetId === 'dashboard') {
        fetchDashboardData();
      } else if (targetId === 'patients') {
        renderPatientsWorkspace();
      } else if (targetId === 'history') {
        fetchAssessmentHistory();
      } else if (targetId === 'analytics') {
        fetchStep10Analytics(window.currentAnalyticsKey);
      } else if (targetId === 'models') {
        const select = document.getElementById('metricsDiseaseSelect');
        const selectedKey = select ? select.value : 'heart';
        fetchRealModelMetrics(selectedKey);
      } else if (targetId === 'data') {
        fetchRealDatasetInfo();
      }

      if (appSidebar) appSidebar.classList.remove('mobile-open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  if (sidebarToggle && appSidebar) {
    sidebarToggle.addEventListener('click', () => {
      appSidebar.classList.toggle('mobile-open');
    });
  }

  const metricsSelect = document.getElementById('metricsDiseaseSelect');
  if (metricsSelect) {
    metricsSelect.addEventListener('change', (e) => {
      fetchRealModelMetrics(e.target.value);
    });
  }
}

window.navigateToTab = function(tabId) {
  const targetItem = document.querySelector(`.sidebar-nav-item[data-target="${tabId}"]`);
  if (targetItem) {
    targetItem.click();
  }
};

window.selectDiseaseAndAssess = function(diseaseKey) {
  const diseaseSelect = document.getElementById('diseaseTargetSelect');
  if (diseaseSelect) {
    diseaseSelect.value = diseaseKey;
  }
  if (typeof updateClinicalFormFields === 'function') {
    updateClinicalFormFields();
  }
  window.navigateToTab('predict');
  const formEl = document.getElementById('predictForm');
  if (formEl) {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

/* --------------------------------------------------------------------------
   2. DASHBOARD METRICS, RISK TREND & RECENT ASSESSMENTS
   -------------------------------------------------------------------------- */
async function fetchDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/assessment-stats`);
    const data = await res.json();

    if (data.status === 'success' && data.stats) {
      const stats = data.stats;
      
      // Update Summary Cards with Live Database Numbers
      document.getElementById('kpiTotalAssessments').textContent = stats.total_assessments || 0;
      document.getElementById('kpiPatientCount').textContent = stats.total_patients || 0;

      // Render Risk Trend Chart
      renderRiskTrendChart(stats.risk_trend || []);
    }

    // Fetch recent assessments (limit 5)
    fetchRecentAssessmentsForDashboard();
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

async function fetchRecentAssessmentsForDashboard() {
  const container = document.getElementById('recentAssessmentsContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/assessments?sort=newest`);
    const data = await res.json();

    if (data.status === 'success' && data.assessments) {
      const records = data.assessments.slice(0, 5);

      if (records.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">📋</div>
            <h3 style="font-size: 1.05rem; color: var(--primary); margin-bottom: 6px;">No assessments yet</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Run your first patient risk assessment to build clinical history.</p>
            <button class="btn btn-main" onclick="navigateToTab('predict')">Start Risk Assessment ⚡</button>
          </div>
        `;
        return;
      }

      const rowsHtml = records.map(r => {
        const riskClass = r.risk_level === 'HIGH RISK' ? 'status-tag elevated' : (r.risk_level === 'MODERATE RISK' ? 'status-tag' : 'status-tag normal');
        return `
          <tr onclick="viewAssessmentDetailsModal('${r.id}')" style="cursor: pointer;">
            <td><strong style="color: var(--accent-teal);">${r.id}</strong></td>
            <td><strong>${r.disease_name || r.disease.toUpperCase()}</strong></td>
            <td><span class="${riskClass}">${r.risk_level}</span></td>
            <td>${r.model}</td>
            <td>${r.created_at}</td>
            <td><span class="status-tag normal">Completed</span></td>
            <td><button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;">Inspect 🔍</button></td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; box-shadow: var(--shadow-sm); overflow-x: auto;">
          <table class="health-indicators-table">
            <thead>
              <tr>
                <th>Patient / Assessment ID</th>
                <th>Condition</th>
                <th>Risk</th>
                <th>Model</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching recent assessments:', err);
  }
}

function renderRiskTrendChart(trendData) {
  const container = document.getElementById('riskTrendContainer');
  if (!container) return;

  if (trendData.length < 2) {
    container.innerHTML = `
      <div class="empty-state-message" style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 0.88rem;">
        Risk trends will appear after assessments are completed.
      </div>
    `;
    return;
  }

  container.innerHTML = `<canvas id="riskTrendCanvas"></canvas>`;
  const canvas = document.getElementById('riskTrendCanvas');

  const labels = trendData.map(t => t.id);
  const scores = trendData.map(t => t.score);

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Risk Score (%)',
        data: scores,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#0d9488',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Risk Score (%)' } },
        x: { title: { display: true, text: 'Assessment ID Sequence' } }
      }
    }
  });
}

/* --------------------------------------------------------------------------
   3. PATIENTS WORKSPACE MODULE (STEP 13 REAL DATABASE PERSISTENCE)
   -------------------------------------------------------------------------- */
function initPatientsModule() {
  const searchInput = document.getElementById('patientSearchInput');
  const riskSelect = document.getElementById('filterPatientRisk');
  const sortSelect = document.getElementById('sortPatientsOrder');
  const addPatientForm = document.getElementById('addPatientForm');
  const patientSelectorSelect = document.getElementById('patientSelectorSelect');

  const triggerFetch = () => renderPatientsWorkspace();

  if (searchInput) searchInput.addEventListener('input', triggerFetch);
  if (riskSelect) riskSelect.addEventListener('change', triggerFetch);
  if (sortSelect) sortSelect.addEventListener('change', triggerFetch);

  if (addPatientForm) {
    addPatientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitAddPatientForm();
    });
  }

  if (patientSelectorSelect) {
    patientSelectorSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (selectedId && window.patientsCacheMap && window.patientsCacheMap[selectedId]) {
        const p = window.patientsCacheMap[selectedId];
        setInputValue('ageInput', p.age);
        setInputValue('genderSelect', p.gender);
      }
    });
  }
}

async function renderPatientsWorkspace() {
  const container = document.getElementById('patientsListContainer');
  if (!container) return;

  const searchVal = document.getElementById('patientSearchInput')?.value || '';
  const riskVal = document.getElementById('filterPatientRisk')?.value || 'all';
  const sortVal = document.getElementById('sortPatientsOrder')?.value || 'newest';

  let url = `${API_BASE}/patients?risk_level=${riskVal}&sort=${sortVal}`;
  if (searchVal.trim()) {
    url += `&q=${encodeURIComponent(searchVal.trim())}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'success' && data.patients) {
      const patients = data.patients;

      // Populate predictor dropdown cache map
      window.patientsCacheMap = {};
      patients.forEach(p => window.patientsCacheMap[p.id] = p);
      populatePatientSelectorDropdown(patients);

      if (patients.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">👥</div>
            <h3 style="font-size: 1.05rem; color: var(--primary); margin-bottom: 6px;">No patients registered</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Register a patient profile to begin managing longitudinal clinical records.</p>
            <button class="btn btn-main" onclick="openAddPatientModal()">+ Register Patient Profile</button>
          </div>
        `;
        return;
      }

      const rowsHtml = patients.map(p => {
        const riskClass = p.latest_risk === 'HIGH RISK' ? 'status-tag elevated' : (p.latest_risk === 'MODERATE RISK' ? 'status-tag' : (p.latest_risk === 'LOW RISK' ? 'status-tag normal' : 'status-tag'));
        const riskLabel = p.latest_risk !== 'No Assessments' ? p.latest_risk : 'Unassessed';

        return `
          <tr>
            <td><strong style="color: var(--accent-teal); cursor: pointer;" onclick="viewPatientProfileModal('${p.id}')">${p.id}</strong></td>
            <td><strong style="color: var(--primary); cursor: pointer;" onclick="viewPatientProfileModal('${p.id}')">${p.name}</strong></td>
            <td>${p.age} Years</td>
            <td>${p.gender}</td>
            <td>${p.latest_date !== 'N/A' ? p.latest_date : '<span style="color: var(--text-muted);">No assessments</span>'}</td>
            <td><span class="${riskClass}">${riskLabel}</span></td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary" onclick="viewPatientProfileModal('${p.id}')" style="padding: 4px 10px; font-size: 0.78rem;">Profile 👤</button>
                <button class="btn btn-main" onclick="startAssessmentForPatient('${p.id}', ${p.age}, '${p.gender}')" style="padding: 4px 10px; font-size: 0.78rem;">Assess ⚡</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; box-shadow: var(--shadow-sm); overflow-x: auto;">
          <table class="health-indicators-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Patient Name</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Last Assessment</th>
                <th>Current Risk Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error rendering patients workspace:', err);
  }
}

function populatePatientSelectorDropdown(patientsList) {
  const select = document.getElementById('patientSelectorSelect');
  if (!select) return;

  const currentVal = select.value;
  let optionsHtml = `<option value="">-- Anonymous / New Patient Assessment --</option>`;

  optionsHtml += patientsList.map(p => `
    <option value="${p.id}">${p.id} - ${p.name} (${p.age}y, ${p.gender})</option>
  `).join('');

  select.innerHTML = optionsHtml;
  if (currentVal) select.value = currentVal;
}

window.openAddPatientModal = function() {
  const modal = document.getElementById('addPatientModal');
  const form = document.getElementById('addPatientForm');
  const feedback = document.getElementById('patientRegFeedback');
  if (form) form.reset();
  if (feedback) feedback.style.display = 'none';

  // Set sequence preview
  const regId = document.getElementById('regPatientId');
  if (regId) {
    const randomCount = Math.floor(1 + Math.random() * 99);
    regId.value = `PAT-${randomCount.toString().padStart(3, '0')}`;
  }

  if (modal) modal.style.display = 'flex';
};

window.closeAddPatientModal = function() {
  const modal = document.getElementById('addPatientModal');
  if (modal) modal.style.display = 'none';
};

async function submitAddPatientForm() {
  const btnSubmit = document.getElementById('btnSubmitAddPatient');
  const feedback = document.getElementById('patientRegFeedback');
  if (feedback) feedback.style.display = 'none';

  const name = document.getElementById('regPatientName').value.trim();
  const age = parseInt(document.getElementById('regPatientAge').value) || 45;
  const gender = document.getElementById('regPatientGender').value;
  const patientId = document.getElementById('regPatientId').value.trim();
  const contact = document.getElementById('regPatientContact').value.trim();
  const notes = document.getElementById('regPatientNotes').value.trim();

  if (!name) {
    if (feedback) {
      feedback.textContent = 'Please provide a valid patient name.';
      feedback.style.display = 'block';
    }
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Registering Profile...';

  try {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: patientId,
        name: name,
        age: age,
        gender: gender,
        contact: contact,
        notes: notes
      })
    });
    const data = await res.json();

    if (data.status === 'success') {
      closeAddPatientModal();
      renderPatientsWorkspace();
      fetchDashboardData();
      alert(`Patient profile ${name} (${data.patient.id}) successfully registered.`);
    } else {
      throw new Error(data.message || 'Error registering patient.');
    }
  } catch (err) {
    if (feedback) {
      feedback.textContent = err.message;
      feedback.style.display = 'block';
    }
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'REGISTER PATIENT';
  }
}

window.viewPatientProfileModal = async function(patientId) {
  const modal = document.getElementById('patientProfileModal');
  const content = document.getElementById('patientProfileContent');
  if (!modal || !content) return;

  modal.style.display = 'flex';
  content.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Fetching clinical profile for ${patientId}...</div>`;

  try {
    const res = await fetch(`${API_BASE}/patients/${patientId}`);
    const data = await res.json();

    if (data.status === 'success' && data.patient) {
      const p = data.patient;
      const assessments = p.assessments || [];

      let latestRisk = 'Unassessed';
      let riskClass = 'status-tag';
      if (assessments.length > 0) {
        latestRisk = assessments[0].risk_level;
        riskClass = latestRisk === 'HIGH RISK' ? 'status-tag elevated' : (latestRisk === 'MODERATE RISK' ? 'status-tag' : 'status-tag normal');
      }

      let assessmentRowsHtml = '';
      if (assessments.length === 0) {
        assessmentRowsHtml = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
              No assessments recorded for this patient.<br>
              <button class="btn btn-main" onclick="startAssessmentForPatient('${p.id}', ${p.age}, '${p.gender}')" style="margin-top: 10px; font-size: 0.8rem;">+ Start Risk Assessment</button>
            </td>
          </tr>
        `;
      } else {
        assessmentRowsHtml = assessments.map(a => {
          const aRiskClass = a.risk_level === 'HIGH RISK' ? 'status-tag elevated' : (a.risk_level === 'MODERATE RISK' ? 'status-tag' : 'status-tag normal');
          const probStr = a.probability !== null ? `${a.probability}%` : 'N/A';
          return `
            <tr>
              <td><strong style="color: var(--accent-teal);">${a.id}</strong></td>
              <td><strong>${a.disease_name}</strong></td>
              <td><span class="${aRiskClass}">${a.risk_level}</span></td>
              <td>${probStr}</td>
              <td>${a.model}</td>
              <td>${a.created_at}</td>
              <td><button class="btn btn-secondary" onclick="viewAssessmentDetailsModal('${a.id}')" style="padding: 4px 8px; font-size: 0.75rem;">Inspect 🔍</button></td>
            </tr>
          `;
        }).join('');
      }

      content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
          <div>
            <span style="font-size: 0.75rem; font-weight: 800; color: var(--accent-teal); text-transform: uppercase;">CLINICAL PATIENT PROFILE</span>
            <h1 style="font-size: 1.4rem; font-weight: 800; color: var(--primary); margin: 2px 0;">${p.name}</h1>
            <div style="font-size: 0.82rem; color: var(--text-muted);">ID: <strong>${p.id}</strong> | Registered: ${p.created_at}</div>
          </div>
          <button class="btn btn-main" onclick="startAssessmentForPatient('${p.id}', ${p.age}, '${p.gender}')" style="font-size: 0.85rem; padding: 8px 14px;">+ Start Assessment ⚡</button>
        </div>

        <!-- DEMOGRAPHICS & OVERVIEW GRID -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; background: rgba(15, 23, 42, 0.03); padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid var(--border-color); font-size: 0.85rem;">
          <div><span style="color: var(--text-muted); display: block;">Age / Demographics:</span> <strong>${p.age} Years (${p.gender})</strong></div>
          <div><span style="color: var(--text-muted); display: block;">Contact:</span> <strong>${p.contact}</strong></div>
          <div><span style="color: var(--text-muted); display: block;">Primary Risk Status:</span> <span class="${riskClass}">${latestRisk}</span></div>
          <div><span style="color: var(--text-muted); display: block;">Total Assessments:</span> <strong>${assessments.length} Records</strong></div>
        </div>

        ${p.notes ? `
          <div style="background: rgba(13, 148, 136, 0.04); border-left: 3px solid var(--accent-teal); padding: 10px 14px; font-size: 0.82rem; color: var(--primary); margin-bottom: 24px; border-radius: 4px;">
            <strong>Clinical Notes:</strong> ${p.notes}
          </div>
        ` : ''}

        <!-- PATIENT ASSESSMENT HISTORY -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="font-size: 1rem; font-weight: 800; color: var(--primary);">📋 PATIENT ASSESSMENT HISTORY</h3>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">${assessments.length} Stored Records</span>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
              <thead>
                <tr style="background: #f8fafc; text-align: left; border-bottom: 1px solid var(--border-color);">
                  <th style="padding: 8px 12px;">ID</th>
                  <th style="padding: 8px 12px;">Condition</th>
                  <th style="padding: 8px 12px;">Risk Result</th>
                  <th style="padding: 8px 12px;">Probability</th>
                  <th style="padding: 8px 12px;">Model</th>
                  <th style="padding: 8px 12px;">Date</th>
                  <th style="padding: 8px 12px;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${assessmentRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 16px;">
          <button class="btn btn-secondary" onclick="deletePatientProfile('${p.id}')" style="color: #ef4444; font-size: 0.8rem;">🗑️ Delete Patient Profile</button>
          <button class="btn btn-secondary" onclick="closePatientProfileModal()">Close Profile</button>
        </div>
      `;
    }
  } catch (err) {
    content.innerHTML = `<div style="color: #ef4444; padding: 20px;">Error loading patient profile: ${err.message}</div>`;
  }
};

window.closePatientProfileModal = function() {
  const modal = document.getElementById('patientProfileModal');
  if (modal) modal.style.display = 'none';
};

window.startAssessmentForPatient = function(patientId, age, gender) {
  closePatientProfileModal();
  window.navigateToTab('predict');

  const select = document.getElementById('patientSelectorSelect');
  if (select) {
    select.value = patientId;
  }

  setInputValue('ageInput', age);
  setInputValue('genderSelect', gender);

  const formEl = document.getElementById('predictForm');
  if (formEl) {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

window.deletePatientProfile = async function(patientId) {
  if (!confirm(`Are you sure you want to delete patient profile ${patientId}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/patients/${patientId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      closePatientProfileModal();
      renderPatientsWorkspace();
      fetchDashboardData();
      alert(`Patient ${patientId} deleted.`);
    }
  } catch (err) {
    alert(`Error deleting patient: ${err.message}`);
  }
};

/* --------------------------------------------------------------------------
   4. ASSESSMENTS HISTORY WORKSPACE
   -------------------------------------------------------------------------- */
function initHistoryFilters() {
  const searchInput = document.getElementById('searchAssessmentId');
  const diseaseSelect = document.getElementById('filterDisease');
  const riskSelect = document.getElementById('filterRiskLevel');
  const sortSelect = document.getElementById('sortOrder');

  const triggerFetch = () => fetchAssessmentHistory();

  if (searchInput) searchInput.addEventListener('input', triggerFetch);
  if (diseaseSelect) diseaseSelect.addEventListener('change', triggerFetch);
  if (riskSelect) riskSelect.addEventListener('change', triggerFetch);
  if (sortSelect) sortSelect.addEventListener('change', triggerFetch);
}

async function fetchAssessmentHistory() {
  const container = document.getElementById('assessmentHistoryContainer');
  if (!container) return;

  const searchVal = document.getElementById('searchAssessmentId')?.value || '';
  const diseaseVal = document.getElementById('filterDisease')?.value || 'all';
  const riskVal = document.getElementById('filterRiskLevel')?.value || 'all';
  const sortVal = document.getElementById('sortOrder')?.value || 'newest';

  let url = `${API_BASE}/assessments?disease=${diseaseVal}&risk_level=${riskVal}&sort=${sortVal}`;
  if (searchVal.trim()) {
    url += `&q=${encodeURIComponent(searchVal.trim())}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'success' && data.assessments) {
      const records = data.assessments;

      if (records.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">📋</div>
            <h3 style="font-size: 1.05rem; color: var(--primary); margin-bottom: 6px;">No assessments yet</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Run your first patient risk assessment to begin building assessment history.</p>
            <button class="btn btn-main" onclick="navigateToTab('predict')">Start Risk Assessment ⚡</button>
          </div>
        `;
        return;
      }

      const rowsHtml = records.map(r => {
        const riskClass = r.risk_level === 'HIGH RISK' ? 'status-tag elevated' : (r.risk_level === 'MODERATE RISK' ? 'status-tag' : 'status-tag normal');
        const probStr = r.probability ? `${r.probability}%` : 'N/A';

        return `
          <tr>
            <td><strong style="color: var(--accent-teal);">${r.id}</strong></td>
            <td><strong>${r.disease_name || r.disease.toUpperCase()}</strong></td>
            <td><span class="${riskClass}">${r.risk_level}</span></td>
            <td><strong>${probStr}</strong></td>
            <td>${r.model}</td>
            <td>${r.created_at}</td>
            <td>
              <button class="btn btn-secondary" onclick="viewAssessmentDetailsModal('${r.id}')" style="padding: 4px 10px; font-size: 0.78rem;">Inspect Details 🔍</button>
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; box-shadow: var(--shadow-sm); overflow-x: auto;">
          <table class="health-indicators-table">
            <thead>
              <tr>
                <th>Assessment ID</th>
                <th>Condition</th>
                <th>Risk Level</th>
                <th>Probability</th>
                <th>Model</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching assessment history:', err);
  }
}

/* --------------------------------------------------------------------------
   5. ASSESSMENT DETAILS MODAL
   -------------------------------------------------------------------------- */
window.viewAssessmentDetailsModal = async function(assessmentId) {
  const modal = document.getElementById('assessmentDetailsModal');
  const content = document.getElementById('modalDetailsContent');
  if (!modal || !content) return;

  modal.style.display = 'flex';
  content.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Fetching assessment details for ${assessmentId}...</div>`;

  try {
    const res = await fetch(`${API_BASE}/assessments/${assessmentId}`);
    const data = await res.json();

    if (data.status === 'success' && data.assessment) {
      const a = data.assessment;
      const inputs = a.input_data || {};
      const fullRes = a.full_result || {};

      const riskClass = a.risk_level === 'HIGH RISK' ? 'status-tag elevated' : (a.risk_level === 'MODERATE RISK' ? 'status-tag' : 'status-tag normal');
      const probStr = a.probability ? `${a.probability}%` : 'N/A';

      const inputRows = Object.keys(inputs).map(k => `
        <tr>
          <td style="padding: 6px 12px; font-weight: 600; color: var(--text-muted); width: 40%;">${k}</td>
          <td style="padding: 6px 12px; font-weight: 700; color: var(--primary);">${inputs[k]}</td>
        </tr>
      `).join('');

      content.innerHTML = `
        <div style="margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-teal); text-transform: uppercase;">CLINICAL RISK ASSESSMENT</span>
          <h2 style="font-size: 1.3rem; color: var(--primary); margin: 4px 0;">Assessment ID: ${a.id}</h2>
          <div style="font-size: 0.82rem; color: var(--text-muted);">Date Recorded: ${a.created_at}</div>
        </div>

        <!-- SUMMARY GRID -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px; background: rgba(15, 23, 42, 0.03); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.82rem;">
          <div><span style="color: var(--text-muted); display: block;">Condition:</span> <strong>${a.disease_name || a.disease.toUpperCase()}</strong></div>
          <div><span style="color: var(--text-muted); display: block;">Risk Level:</span> <span class="${riskClass}">${a.risk_level}</span></div>
          <div><span style="color: var(--text-muted); display: block;">Probability:</span> <strong>${probStr}</strong></div>
          <div><span style="color: var(--text-muted); display: block;">Model:</span> <strong>${a.model}</strong></div>
          <div><span style="color: var(--text-muted); display: block;">Dataset:</span> <strong>${a.dataset}</strong></div>
        </div>

        <!-- PATIENT HEALTH INDICATORS -->
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--primary); margin-bottom: 10px;">📋 SUBMITTED HEALTH INDICATORS</h3>
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
              <tbody>
                ${inputRows}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESTRAINED CLINICAL NOTICE -->
        <div style="background: rgba(15, 23, 42, 0.03); border-left: 4px solid var(--accent-teal); padding: 12px 14px; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 20px; border-radius: 4px;">
          This assessment provides a machine-learning-based risk indication. Discuss relevant results with a qualified healthcare professional.
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="window.print()">🖨️ Print Record</button>
          <button class="btn btn-main" onclick="closeAssessmentDetailsModal()">Close</button>
        </div>
      `;
    }
  } catch (err) {
    content.innerHTML = `<div style="color: #ef4444; padding: 20px;">Error loading assessment details: ${err.message}</div>`;
  }
};

window.closeAssessmentDetailsModal = function() {
  const modal = document.getElementById('assessmentDetailsModal');
  if (modal) modal.style.display = 'none';
};

/* --------------------------------------------------------------------------
   6. RISK ASSESSMENT PREDICTION WORKFLOW (REAL ML BACKEND)
   -------------------------------------------------------------------------- */
function initPredictor() {
  const heightInput = document.getElementById('heightInput');
  const weightInput = document.getElementById('weightInput');
  const bmiDisplay = document.getElementById('bmiDisplay');
  const bmiCategory = document.getElementById('bmiCategory');
  const predictForm = document.getElementById('predictForm');

  const rangeInputs = document.querySelectorAll('.range-slider');
  rangeInputs.forEach(input => {
    const previewId = input.id + 'Val';
    const previewEl = document.getElementById(previewId);
    if (previewEl) {
      input.addEventListener('input', (e) => {
        previewEl.textContent = e.target.value;
        if (input.id === 'heightInput' || input.id === 'weightInput') {
          calculateBMI();
        }
      });
    }
  });

  function calculateBMI() {
    const h = parseFloat(heightInput.value) / 100;
    const w = parseFloat(weightInput.value);
    if (h > 0 && w > 0) {
      const bmi = (w / (h * h)).toFixed(1);
      bmiDisplay.textContent = bmi;

      let cat = 'Normal Weight';
      let catColor = '#10b981';
      if (bmi < 18.5) {
        cat = 'Underweight';
        catColor = '#3b82f6';
      } else if (bmi >= 25 && bmi < 29.9) {
        cat = 'Overweight';
        catColor = '#f59e0b';
      } else if (bmi >= 30) {
        cat = 'Obese';
        catColor = '#ef4444';
      }
      bmiCategory.textContent = cat;
      bmiCategory.style.color = catColor;
    }
  }

  if (predictForm) {
    predictForm.addEventListener('submit', (e) => {
      e.preventDefault();
      runRealBackendPrediction();
    });
  }

  calculateBMI();
}

window.loadPreset = function(type) {
  const presets = {
    healthy: { age: 28, gender: 'Female', height: 168, weight: 60, systolic: 115, diastolic: 75, glucose: 88, hba1c: 5.1, cholesterol: 170, heartRate: 68, activity: 5, smoking: 'Never' },
    prediabetic: { age: 46, gender: 'Male', height: 175, weight: 88, systolic: 132, diastolic: 84, glucose: 118, hba1c: 6.2, cholesterol: 215, heartRate: 76, activity: 2, smoking: 'Former' },
    highMetabolic: { age: 54, gender: 'Male', height: 170, weight: 96, systolic: 148, diastolic: 92, glucose: 165, hba1c: 7.8, cholesterol: 248, heartRate: 84, activity: 1, smoking: 'Active' },
    cardiacRisk: { age: 62, gender: 'Male', height: 172, weight: 85, systolic: 160, diastolic: 98, glucose: 130, hba1c: 6.4, cholesterol: 275, heartRate: 88, activity: 1, smoking: 'Active' }
  };

  const p = presets[type];
  if (!p) return;

  setInputValue('ageInput', p.age);
  setInputValue('genderSelect', p.gender);
  setInputValue('heightInput', p.height);
  setInputValue('weightInput', p.weight);
  setInputValue('sysInput', p.systolic);
  setInputValue('diaInput', p.diastolic);
  setInputValue('glucoseInput', p.glucose);
  setInputValue('hba1cInput', p.hba1c);
  setInputValue('cholInput', p.cholesterol);
  setInputValue('hrInput', p.heartRate);
  setInputValue('actInput', p.activity);
  setInputValue('smokeSelect', p.smoking);

  const heightInput = document.getElementById('heightInput');
  if (heightInput) heightInput.dispatchEvent(new Event('input'));

  runRealBackendPrediction();
};

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.value = val;
    const previewEl = document.getElementById(id + 'Val');
    if (previewEl) previewEl.textContent = val;
  }
}

async function runRealBackendPrediction() {
  const resultCardContainer = document.getElementById('resultCardContainer');
  const btnSubmit = document.getElementById('btnSubmitPredict');

  const diseaseSelect = document.getElementById('diseaseTargetSelect');
  const algorithmSelect = document.getElementById('algorithmSelect');
  const patientSelect = document.getElementById('patientSelectorSelect');

  const payload = {
    disease: diseaseSelect ? diseaseSelect.value : 'all',
    algorithm: algorithmSelect ? algorithmSelect.value : 'Random Forest',
    patient_id: patientSelect ? patientSelect.value : null,
    age: parseFloat(document.getElementById('ageInput').value) || 45,
    gender: document.getElementById('genderSelect').value,
    height: parseFloat(document.getElementById('heightInput').value) || 172,
    weight: parseFloat(document.getElementById('weightInput').value) || 78,
    systolic: parseFloat(document.getElementById('sysInput').value) || 128,
    diastolic: parseFloat(document.getElementById('diaInput').value) || 82,
    glucose: parseFloat(document.getElementById('glucoseInput').value) || 105,
    hba1c: parseFloat(document.getElementById('hba1cInput').value) || 5.7,
    cholesterol: parseFloat(document.getElementById('cholInput').value) || 210,
    heartRate: parseFloat(document.getElementById('hrInput').value) || 74,
    activity: parseFloat(document.getElementById('actInput').value) || 3,
    smoking: document.getElementById('smokeSelect').value
  };

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `Analyzing health risk...`;

  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success' && data.result) {
      window.lastPredictionResult = data.result;
      renderRealPredictionResult(data.result);

      // Refresh Dashboard & History
      fetchDashboardData();
      renderPatientsWorkspace();
      fetchAssessmentHistory();
    } else {
      throw new Error(data.message || 'Error executing ML inference.');
    }
  } catch (err) {
    console.error('Backend prediction failure:', err);
    resultCardContainer.innerHTML = `
      <div class="glass-card" style="border-color: #ef4444;">
        <div style="font-weight: 700; color: #ef4444; margin-bottom: 8px;">⚠️ Server Connection Error</div>
        <p style="font-size: 0.85rem; color: var(--text-main);">Unable to communicate with the ML engine backend.</p>
      </div>
    `;
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `ANALYZE HEALTH RISK`;
  }
}

function renderRealPredictionResult(result) {
  const resultCardContainer = document.getElementById('resultCardContainer');
  const timestampStr = result.created_at || (new Date().toLocaleDateString());
  const assessmentId = result.assessment_id || ('VV-' + Math.floor(100 + Math.random() * 900));

  const overallRiskScore = result.overall_risk_index;
  let riskLevel = 'Low Risk';
  let riskBadgeClass = 'status-tag normal';

  if (overallRiskScore >= 70) {
    riskLevel = 'Elevated Risk';
    riskBadgeClass = 'status-tag elevated';
  } else if (overallRiskScore >= 45) {
    riskLevel = 'Moderate Risk';
    riskBadgeClass = 'status-tag';
  }

  const resultsMap = result.results || {};
  const submittedInputs = result.submitted_inputs || {};
  const selectedDisease = result.target_disease || 'all';

  let diseaseCardsHtml = '';
  const diseaseKeysToDisplay = (selectedDisease === 'all') ? Object.keys(resultsMap) : [selectedDisease];

  diseaseKeysToDisplay.forEach(key => {
    const dRes = resultsMap[key];
    if (!dRes) return;

    const probStr = dRes.probability_available ? `${dRes.probability}%` : 'N/A';

    diseaseCardsHtml += `
      <div style="background: rgba(15, 23, 42, 0.02); padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.9rem; color: var(--primary);">${dRes.disease_name}</strong>
          <span style="font-weight: 800; font-size: 0.95rem; color: ${dRes.prediction === 1 ? '#ef4444' : '#10b981'};">
            ${dRes.prediction_label} (${probStr})
          </span>
        </div>
      </div>
    `;
  });

  // Submitted Health Indicators table (only fields belonging to selected model)
  const healthIndicatorsHtml = `
    <table class="health-indicators-table" style="margin-top: 10px;">
      <thead>
        <tr><th>Health Indicator</th><th>Submitted Value</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Fasting Glucose</strong></td><td>${submittedInputs['Glucose'] || 'N/A'}</td></tr>
        <tr><td><strong>BMI Index</strong></td><td>${submittedInputs['BMI'] || 'N/A'}</td></tr>
        <tr><td><strong>Blood Pressure</strong></td><td>${submittedInputs['Systolic BP'] || '128'} / ${submittedInputs['Diastolic BP'] || '82'} mmHg</td></tr>
        <tr><td><strong>Total Cholesterol</strong></td><td>${submittedInputs['Cholesterol'] || 'N/A'}</td></tr>
      </tbody>
    </table>
  `;

  resultCardContainer.innerHTML = `
    <div class="glass-card" style="border-top: 4px solid var(--accent-teal);">
      <div style="font-size: 0.75rem; font-weight: 800; color: var(--accent-teal); text-transform: uppercase; letter-spacing: 0.5px;">RISK ASSESSMENT RESULT</div>
      <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--primary); margin: 4px 0 12px 0;">${result.target_disease === 'all' ? 'Multi-Disease Health Profile' : result.target_disease.toUpperCase()}</h2>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: rgba(15, 23, 42, 0.03); padding: 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color); font-size: 0.85rem;">
        <div><span style="color: var(--text-muted); display: block;">Risk Level:</span> <span class="${riskBadgeClass}">${riskLevel}</span></div>
        <div><span style="color: var(--text-muted); display: block;">Probability:</span> <strong>${overallRiskScore}%</strong></div>
        <div><span style="color: var(--text-muted); display: block;">Model:</span> <strong>${result.selected_algorithm}</strong></div>
        <div><span style="color: var(--text-muted); display: block;">Assessment ID:</span> <strong>${assessmentId}</strong></div>
        <div><span style="color: var(--text-muted); display: block;">Date:</span> <strong>${timestampStr}</strong></div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--primary); margin-bottom: 8px;">TRAINED MODEL PREDICTIONS</div>
        ${diseaseCardsHtml}
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--primary); margin-bottom: 6px;">SUBMITTED HEALTH INDICATORS</div>
        ${healthIndicatorsHtml}
      </div>

      <div style="background: rgba(15, 23, 42, 0.03); border-left: 3px solid var(--accent-teal); padding: 10px 12px; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 16px;">
        This assessment provides a machine-learning-based risk indication. Discuss relevant results with a qualified healthcare professional.
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-main" onclick="navigateToTab('history')" style="flex: 1; padding: 8px;">View History ➔</button>
        <button class="btn btn-secondary" onclick="viewAssessmentDetailsModal('${assessmentId}')" style="flex: 1; padding: 8px;">Save / Inspect Record</button>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   7. STEP 10: REAL HEALTH ANALYTICS MODULE LOGIC
   -------------------------------------------------------------------------- */
function initAnalyticsControls() {
  const datasetSelect = document.getElementById('analyticsDatasetSelect');

  if (datasetSelect) {
    datasetSelect.addEventListener('change', (e) => {
      window.currentAnalyticsKey = e.target.value;
      fetchStep10Analytics(e.target.value);
    });
  }
}

async function fetchStep10Analytics(key = 'diabetes') {
  try {
    const sumRes = await fetch(`${API_BASE}/datasets/${key}/summary`);
    const sumData = await sumRes.json();
    if (sumData.status === 'success') {
      const s = sumData.summary;
      document.getElementById('anRecords').textContent = s.records.toLocaleString();
      document.getElementById('anFeatures').textContent = s.features;
      document.getElementById('anTarget').textContent = s.target_variable;
      document.getElementById('anMissing').textContent = s.missing_values;
    }

    // Target & Age Distributions
    const distRes = await fetch(`${API_BASE}/datasets/${key}/distribution`);
    const distData = await distRes.json();
    if (distData.status === 'success' && distData.distributions) {
      const d = distData.distributions;
      
      const tCanvas = document.getElementById('analyticsTargetChart');
      if (tCanvas) {
        const existing = Chart.getChart(tCanvas);
        if (existing) existing.destroy();

        new Chart(tCanvas.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: Object.keys(d.target_distribution),
            datasets: [{ data: Object.values(d.target_distribution), backgroundColor: ['#0d9488', '#ef4444', '#2563eb', '#f59e0b'] }]
          },
          options: { responsive: true }
        });
      }

      const aCanvas = document.getElementById('analyticsAgeChart');
      if (aCanvas) {
        const existing = Chart.getChart(aCanvas);
        if (existing) existing.destroy();

        const distObj = d.age_distribution || d.bmi_distribution;
        if (distObj) {
          new Chart(aCanvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: distObj.labels,
              datasets: [{ label: 'Population Count', data: distObj.counts, backgroundColor: '#06b6d4', borderRadius: 6 }]
            },
            options: { responsive: true }
          });
        }
      }
    }

    // Correlation
    const corrRes = await fetch(`${API_BASE}/datasets/${key}/correlation`);
    const corrData = await corrRes.json();
    if (corrData.status === 'success' && corrData.correlation) {
      const container = document.getElementById('analyticsCorrelationContainer');
      const { features, matrix } = corrData.correlation;
      if (container && features.length > 0) {
        let headHtml = `<th></th>` + features.map(f => `<th style="padding: 6px; font-size: 0.75rem;">${f}</th>`).join('');
        let rowsHtml = matrix.map((row, i) => {
          let cells = row.map(val => `<td style="padding: 6px; text-align: center; font-weight: 700; font-size: 0.78rem;">${val}</td>`).join('');
          return `<tr><td style="padding: 6px; font-weight: 700; font-size: 0.75rem;">${features[i]}</td>${cells}</tr>`;
        }).join('');
        container.innerHTML = `<table class="health-indicators-table"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
      }
    }
  } catch (err) {
    console.error('Error fetching analytics:', err);
  }
}

/* --------------------------------------------------------------------------
   8. DATASETS & MODEL METRICS FETCHERS
   -------------------------------------------------------------------------- */
async function fetchRealDatasetInfo() {
  try {
    const res = await fetch(`${API_BASE}/dataset-info`);
    const data = await res.json();
    if (data.status === 'success' && data.datasets) {
      renderDatasetCards(data.datasets);
    }
  } catch (e) {
    console.log('Dataset info loading:', e);
  }
}

function renderDatasetCards(dsMap) {
  const container = document.getElementById('datasetCardsContainer');
  if (!container) return;

  const cardsHtml = Object.keys(dsMap).map(key => {
    const ds = dsMap[key];
    return `
      <div class="glass-card">
        <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--primary); margin-bottom: 4px;">📁 ${ds.name}</h4>
        <div style="font-size: 0.8rem; color: var(--accent-teal); font-weight: 700; margin-bottom: 8px;">Source: ${ds.source}</div>
        <ul style="font-size: 0.8rem; color: var(--text-main); padding-left: 16px; line-height: 1.6;">
          <li><strong>Records:</strong> ${ds.total_records} Patient Profiles</li>
          <li><strong>Features (${ds.num_features}):</strong> ${ds.feature_names.slice(0, 5).join(', ')}...</li>
          <li><strong>Target Variable:</strong> ${ds.target_variable}</li>
        </ul>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
}

async function fetchRealModelMetrics(diseaseKey = 'heart') {
  try {
    const res = await fetch(`${API_BASE}/model-metrics`);
    const data = await res.json();

    if (data.status === 'success' && data.metrics && data.metrics[diseaseKey]) {
      renderMetricsTable(diseaseKey, data.metrics[diseaseKey]);
    }
  } catch (e) {
    console.log('Metrics loading:', e);
  }
}

function renderMetricsTable(diseaseKey, metricsMap) {
  const container = document.getElementById('metricsContainer');
  if (!container) return;

  const rowsHtml = Object.keys(metricsMap).map(mName => {
    const m = metricsMap[mName];
    return `
      <tr>
        <td><strong>${mName}</strong></td>
        <td>${m.accuracy}%</td>
        <td>${m.precision}%</td>
        <td>${m.recall}%</td>
        <td>${m.f1}%</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="glass-card">
      <h4 style="font-size: 1rem; font-weight: 800; color: var(--primary); margin-bottom: 12px;">Calculated Estimator Metrics (${diseaseKey.toUpperCase()})</h4>
      <table class="health-indicators-table">
        <thead>
          <tr>
            <th>Algorithm</th>
            <th>Accuracy</th>
            <th>Precision</th>
            <th>Recall</th>
            <th>F1 Score</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}
