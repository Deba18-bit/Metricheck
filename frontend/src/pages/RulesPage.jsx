import React from "react";
import { rulesData } from "../rulesData";

export default function RulesPage() {
  return (
    <div className="rulesPage">
      <div className="histHeader">
        <div>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--blue)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>
            Deterministic Rules
          </div>
          <h1>Legal Metrology Rule Engine</h1>
          <p>The rules actively enforced by the METRICHECK compliance engine.</p>
        </div>
      </div>
      <div className="rulesGrid">
        {rulesData.map(rule => (
          <div key={rule.rule_id} className="ruleCard">
            <div className="ruleTop">
              <span className="ruleId">{rule.rule_id || "LMPC"}</span>
              <span className="ruleStatus"><span className="liveDot" /> {rule.implementation_status === "implemented" ? "ENGINE ACTIVE" : "PLANNED"}</span>
            </div>
            <div className="ruleTitle">{rule.title}</div>
            <div className="ruleProp">
              <label>WHAT WE CHECK</label>
              <span>{rule.short_description}</span>
            </div>
            <div className="ruleProp">
              <label>SYSTEM VALIDATION</label>
              <span>{rule.system_check_description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
