import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { API_BASE_URL } from "../offlineSync";

export default function DashboardPage({ onStartScan, onFileSelect, onHistoryClick }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const statsRes = await fetch(`${API_BASE_URL}/api/scans/stats`);
        if (statsRes.ok) setStats(await statsRes.json());
        
        const histRes = await fetch(`${API_BASE_URL}/api/scans/history?limit=3`);
        if (histRes.ok) {
          const histData = await histRes.json();
          setRecent(histData.items || []);
        }
      } catch (e) {
        console.warn("Could not load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const total = stats?.total_scans || 0;
  const compliant = stats?.status_breakdown?.COMPLIANT || 0;
  const violation = stats?.status_breakdown?.VIOLATION || 0;
  const review = stats?.status_breakdown?.MANUAL_REVIEW_REQUIRED || 0;

  return (
    <div className="dashboardPage">
      <div className="dashHeader">
        <h1>Inspection Command Center</h1>
        <p>AI-assisted forensic metrology and compliance analysis.</p>
      </div>

      <div className="heroAction">
        <button className="primaryScanBtn" onClick={onStartScan}>
          <Icon name="camera" size={32} />
          <span>START NEW INSPECTION</span>
          <small>Capture or Upload Package Image</small>
        </button>
        <div className="heroAlt">
          <span>or select from device</span>
          <input type="file" accept="image/*" onChange={e => { if(e.target.files[0]) onFileSelect(e.target.files[0]) }} />
        </div>
      </div>

      <div className="dashMetrics">
        <div className="metricCard">
          <div className="metricLabel">TOTAL INSPECTIONS</div>
          <div className="metricValue">{total}</div>
        </div>
        <div className="metricCard green">
          <div className="metricLabel">COMPLIANT</div>
          <div className="metricValue">{compliant}</div>
        </div>
        <div className="metricCard amber">
          <div className="metricLabel">REVIEW REQ</div>
          <div className="metricValue">{review}</div>
        </div>
        <div className="metricCard red">
          <div className="metricLabel">VIOLATIONS</div>
          <div className="metricValue">{violation}</div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="recentSection">
          <div className="sectionHead">
            <h3>Recent Inspections</h3>
            <button className="ghostLink" onClick={onHistoryClick}>View All</button>
          </div>
          <div className="recentList">
            {recent.map(r => {
              const date = new Date(r.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={r.scan_id} className="recentRow">
                  <div className="recentInfo">
                    <strong>{r.product_context?.brand_name || "Unknown Brand"}</strong>
                    <span>{r.product_context?.product_name || "Unknown Product"}</span>
                    <small>{date} • {r.sync_source === 'offline_sync' ? 'Offline' : 'Online'}</small>
                  </div>
                  <div className={"statusBadge " + (r.status === 'COMPLIANT' ? 'verified' : r.status === 'VIOLATION' ? 'violation' : 'review')}>
                    {r.status.replace(/_/g, ' ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="sysCaps">
        <h3>System Active Modules</h3>
        <div className="capsGrid">
          <div className="capItem"><Icon name="cpu" size={18} /><span>Local Edge Perception</span></div>
          <div className="capItem"><Icon name="search" size={18} /><span>Spatial OCR Engine</span></div>
          <div className="capItem"><Icon name="shield" size={18} /><span>LMPC Rule Engine</span></div>
          <div className="capItem"><Icon name="database" size={18} /><span>Offline Sync</span></div>
        </div>
      </div>
    </div>
  );
}
