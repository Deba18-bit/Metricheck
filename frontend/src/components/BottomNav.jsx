import React from 'react';
import Icon from './Icon';

export default function BottomNav({ screen, reset, stopCamera, setScreen }) {
  return (
    <nav className="bottomNav">
      <button className={screen !== "rules" && screen !== "official" && screen !== "history" ? "active" : ""} onClick={reset}>
        <Icon name="camera" size={20} />
        <span>Scan</span>
      </button>
      <button className={screen === "history" ? "active" : ""} onClick={() => { stopCamera(); setScreen("history"); }}>
        <Icon name="clock" size={20} />
        <span>History</span>
      </button>
      <button className={screen === "rules" || screen === "official" ? "active" : ""} onClick={() => { stopCamera(); setScreen("rules"); }}>
        <Icon name="book" size={20} />
        <span>Rules</span>
      </button>
    </nav>
  );
}
