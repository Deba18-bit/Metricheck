import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../offlineSync";
import Icon from "../components/Icon";
function HistoryPage({ onSelectScan, offlineQueueCount = 0, onSync, isSyncing = false, onClearQueue }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [identifyingIds, setIdentifyingIds] = useState([]);
  const [decidingIds, setDecidingIds] = useState([]);

  const handleIdentify = async (scanId) => {
    setIdentifyingIds((prev) => [...prev, scanId]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scans/${scanId}/identify`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.message || errData.detail || "Identification failed");
      }
      const updatedItem = await res.json();
      setHistory((prev) =>
        prev.map((s) => (s.scan_id === updatedItem.scan_id ? updatedItem : s))
      );
    } catch (err) {
      console.error("Brand identification error:", err);
      alert(`Identification Error: ${err.message}`);
    } finally {
      setIdentifyingIds((prev) => prev.filter((id) => id !== scanId));
    }
  };

  const handleDecision = async (scanId, decision) => {
    const confirmMsg = decision === "compliant"
      ? "Confirm this package is fully COMPLIANT with Legal Metrology (Packaged Commodities) Rules, 2011?"
      : "Confirm this package is in VIOLATION of Legal Metrology (Packaged Commodities) Rules, 2011?";
    if (!window.confirm(confirmMsg)) return;

    setDecidingIds((prev) => [...prev, scanId]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scans/${scanId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decision,
          officer_id: "OFFICER-DEFAULT",
          notes: `Confirmed ${decision} by officer in audit review`,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to record inspector decision");
      }

      setHistory((prev) =>
        prev.map((s) => {
          if (s.scan_id === scanId) {
            const addedRules = s.review_rules_count || 0;
            return {
              ...s,
              status: decision,
              inspector_decision: decision,
              inspector_id: "OFFICER-DEFAULT",
              compliant_rules_count: decision === "compliant" ? (s.compliant_rules_count + addedRules) : s.compliant_rules_count,
              violation_rules_count: decision === "violation" ? (s.violation_rules_count + addedRules) : s.violation_rules_count,
              review_rules_count: 0,
            };
          }
          return s;
        })
      );

      const statsRes = await fetch(`${API_BASE_URL}/api/scans/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Decision error:", err);
      alert(`Decision Error: ${err.message}`);
    } finally {
      setDecidingIds((prev) => prev.filter((id) => id !== scanId));
    }
  };


  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRes = await fetch(`${API_BASE_URL}/api/scans/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      let url = `${API_BASE_URL}/api/scans/history?limit=50`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const historyRes = await fetch(url);
      if (!historyRes.ok) throw new Error(`Failed to load history (${historyRes.status})`);
      const historyData = await historyRes.json();
      setHistory(historyData.items || []);
    } catch (err) {
      console.error("History fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className="historyPage">
      <div className="histHeader">
        <div>
          <h1>Inspection Operations</h1>
          <p>Audit registry and historical scan data.</p>
        </div>
        <button className="ghostBtn" onClick={fetchData}><Icon name="refresh" size={16} /> Refresh</button>
      </div>

      <div className="dashMetrics">
        <div className="metricCard">
          <div className="metricLabel">TOTAL INSPECTIONS</div>
          <div className="metricValue">{stats?.total_scans || 0}</div>
        </div>
        <div className="metricCard green">
          <div className="metricLabel">COMPLIANT</div>
          <div className="metricValue">{stats?.status_breakdown?.COMPLIANT || 0}</div>
        </div>
        <div className="metricCard amber">
          <div className="metricLabel">REVIEW REQ</div>
          <div className="metricValue">{stats?.status_breakdown?.MANUAL_REVIEW_REQUIRED || 0}</div>
        </div>
        <div className="metricCard red">
          <div className="metricLabel">VIOLATIONS</div>
          <div className="metricValue">{stats?.status_breakdown?.VIOLATION || 0}</div>
        </div>
        <div className="metricCard" style={{ background: '#f8fafc' }}>
          <div className="metricLabel">OFFLINE QUEUED</div>
          <div className="metricValue">{offlineQueueCount}</div>
        </div>
      </div>

      {offlineQueueCount > 0 && (
        <div className="offlineBanner">
          <div><strong>⚡ Offline Queue Active</strong><span>{offlineQueueCount} scan(s) captured offline waiting for server sync.</span></div>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="darkBtn" onClick={onSync} disabled={isSyncing}>{isSyncing ? "Syncing..." : "Sync Now"}</button>
            <button className="ghostBtn red" onClick={onClearQueue}>Discard</button>
          </div>
        </div>
      )}

      <div className="histControls">
        <form onSubmit={handleSearchSubmit} className="histSearch">
          <Icon name="search" size={16} />
          <input type="text" placeholder="Search brands, products, or scan IDs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <button type="submit">Search</button>
        </form>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="COMPLIANT">Compliant</option>
          <option value="MANUAL_REVIEW_REQUIRED">Review Required</option>
          <option value="VIOLATION">Violations</option>
        </select>
      </div>

      <div className="histTable">
        {loading ? (
           <div style={{padding:'40px', textAlign:'center', color:'var(--muted)'}}>Loading history...</div>
        ) : error ? (
           <div style={{padding:'40px', textAlign:'center', color:'var(--red)'}}>{error}</div>
        ) : history.length === 0 ? (
           <div style={{padding:'40px', textAlign:'center', color:'var(--muted)'}}>No inspections found.</div>
        ) : (
           history.map(s => {
             const date = new Date(s.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
             const isCompliant = s.status === 'COMPLIANT';
             const isViolation = s.status === 'VIOLATION';
             
             return (
               <div key={s.scan_id} className="histRow">
                 <div className="histIdent">
                   <strong>{s.product_context?.brand_name || "Unknown Brand"}</strong>
                   <span>{s.product_context?.product_name || "Unknown Product"}</span>
                   <small>{date} • {s.sync_source === 'offline_sync' ? 'Mobile (Offline)' : 'Web (Online)'}</small>
                 </div>
                 <div className="histStates">
                   <div className="histSys">
                     <label>System Assessment</label>
                     <div className={"statusBadge " + (isCompliant ? 'verified' : isViolation ? 'violation' : 'review')}>{s.status.replace(/_/g, ' ')}</div>
                   </div>
                   <div className="histOfficer">
                     <label>Inspector Decision</label>
                     {s.inspector_decision ? (
                       <div className={"statusBadge " + (s.inspector_decision === 'compliant' ? 'verified' : 'violation')}>CONFIRMED {s.inspector_decision.toUpperCase()}</div>
                     ) : (
                       <span style={{color:'var(--muted)', fontSize:'12px', fontWeight:600}}>PENDING</span>
                     )}
                   </div>
                 </div>
                 <div className="histActs">
                   {!s.product_context?.brand_name && (
                     <button className="ghostBtn" onClick={() => handleIdentify(s.scan_id)} disabled={identifyingIds.includes(s.scan_id)}>
                       {identifyingIds.includes(s.scan_id) ? "Identifying..." : "Auto-Identify"}
                     </button>
                   )}
                   <button className="darkBtn" onClick={() => onSelectScan(s.scan_id)}>Inspect Report</button>
                 </div>
               </div>
             )
           })
        )}
      </div>
    </div>
  );
}
export default HistoryPage;
