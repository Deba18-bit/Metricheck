import React, { useState } from "react";
import { officialRulesTable } from "../rulesData";
function OfficialRulesPage() {
  return (
    <section className="officialRulesPage">
      <div className="heroBadge"><Icon name="book" size={15} /> LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011</div>
      <h1 style={{ fontSize: '32px', marginBottom: '12px', marginTop: '16px' }}>Official Rules Reference</h1>
      <p className="heroCopy" style={{ maxWidth: '800px', marginBottom: '40px' }}>
        This table maps the official legal rules to our system's current and future AI capabilities.
        It explicitly outlines what the scanner checks, what is planned, and what is fundamentally out of scope for image-based verification.
      </p>

      <div className="rulesTableWrapper">
        <table className="rulesTable">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Rule</th>
              <th style={{ width: '35%' }}>Official Description</th>
              <th style={{ width: '20%' }}>System Status</th>
              <th style={{ width: '30%' }}>System Handling / Notes</th>
            </tr>
          </thead>
          <tbody>
            {officialRulesTable.map((rule, idx) => (
              <tr key={idx}>
                <td>
                  <span className="rtRuleId">{rule.rule}</span>
                  <div className="rtTitle">{rule.title}</div>
                </td>
                <td><div className="rtDesc">{rule.description}</div></td>
                <td>
                  <span className={"statusBadge " + rule.status}>
                    {rule.status === "implemented" ? "Implemented" :
                      rule.status === "partial" ? "Partial / Future" :
                        rule.status === "coming_soon" ? "Coming Soon" : "Out of Scope"}
                  </span>
                </td>
                <td><div className="rtNotes">{rule.notes}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export default OfficialRulesPage;
