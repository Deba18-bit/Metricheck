import React, { useState, useEffect, useRef } from "react";
import "./HomePage.css";
import Icon from "../components/Icon";

// Math Helpers
const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
const mapRange = (val, inMin, inMax, outMin, outMax) => {
  if (val <= inMin) return outMin;
  if (val >= inMax) return outMax;
  return outMin + (outMax - outMin) * ((val - inMin) / (inMax - inMin));
};
const easeOut = (t) => t * (2 - t);
const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

const ramp = (val, start, end) => {
  return easeInOut(clamp((val - start) / (end - start), 0, 1));
};
const bell = (val, start, peak, end) => {
  if (val < start || val > end) return 0;
  if (val < peak) return ramp(val, start, peak);
  return 1 - ramp(val, peak, end);
};
const plateau = (val, inS, inE, outS, outE) => {
  if (val < inS || val > outE) return 0;
  if (val < inE) return ramp(val, inS, inE);
  if (val > outS) return 1 - ramp(val, outS, outE);
  return 1;
};

import MobileHomePage from "./MobileHomePage";

function DesktopHomePage({ onStart }) {
  const [progress, setProgress] = useState(0);
  const trackRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0); // Always start from the top when Homepage mounts
    let frame;
    let targetProgress = 0;
    let currentProgress = 0;

    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      targetProgress = maxScroll > 0 ? clamp(window.scrollY / maxScroll, 0, 1) : 0;
    };

    const loop = () => {
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) > 0.0001) {
        currentProgress += diff * 0.15;
        setProgress(currentProgress);
      }
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    loop();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Compute overall background and text color based on progress
  let bgColor = "var(--c-offwhite)";
  let textColor = "var(--c-ink)";
  
  if ((progress > 0.17 && progress < 0.20) || (progress > 0.42 && progress < 0.49) || (progress > 0.63 && progress < 0.70) || (progress > 0.77 && progress < 0.91)) {
    bgColor = "var(--c-ink)";
    textColor = "var(--c-offwhite)";
  } else if (progress >= 0.35 && progress < 0.42) {
    bgColor = "var(--c-softblue)";
    textColor = "var(--c-ink)";
  } else if (progress >= 0.91) {
    bgColor = "var(--c-blue)";
    textColor = "#ffffff";
  }

  return (
    <div className="cine-track" ref={trackRef}>
      <button onClick={onStart} className="cine-nav-cta">START INSPECTION</button>

      <div className="cine-stage" style={{ backgroundColor: bgColor, color: textColor }}>
        
        <Particles />

        {/* =========================================================
            THE HERO 3D PACKAGE (Persistent Object)
            ========================================================= */}
        <PackageObject progress={progress} />

        {/* =========================================================
            SCENE TEXT / UI LAYERS
            ========================================================= */}
        <Scene00Hero progress={progress} />
        <Scene01Capture progress={progress} />
        <Scene02Perception progress={progress} />
        <Scene03Classification progress={progress} />
        <Scene04Evidence progress={progress} />
        <Scene05Fusion progress={progress} />
        <Scene06SelectiveAI progress={progress} />
        <Scene07Learning progress={progress} />
        <Scene08Law progress={progress} />
        <Scene09Physical progress={progress} />
        <Scene10Depth progress={progress} />
        <Scene11Offline progress={progress} />
        <Scene12Command progress={progress} />
        <Scene13Final progress={progress} onStart={onStart} />

      </div>
    </div>
  );
}

/* =========================================================
   SUBTLE PARTICLES LAYER
   ========================================================= */
function Particles() {
  return (
    <div className="cine-particles">
      {/* Several particles scattered with varied sizes and animation durations */}
      <div className="particle" style={{ width: 12, height: 12, left: '10%', top: '20%', animationDuration: '20s' }}></div>
      <div className="particle" style={{ width: 24, height: 24, left: '80%', top: '15%', animationDuration: '35s', animationDelay: '-5s' }}></div>
      <div className="particle" style={{ width: 16, height: 16, left: '70%', top: '70%', animationDuration: '28s', animationDelay: '-12s' }}></div>
      <div className="particle" style={{ width: 8, height: 8, left: '20%', top: '80%', animationDuration: '18s', animationDelay: '-3s' }}></div>
      <div className="particle" style={{ width: 32, height: 32, left: '40%', top: '60%', animationDuration: '40s', animationDelay: '-20s' }}></div>
      <div className="particle" style={{ width: 18, height: 18, left: '90%', top: '40%', animationDuration: '25s', animationDelay: '-10s' }}></div>
    </div>
  );
}

/* =========================================================
   PERSISTENT 3D PACKAGE COMPONENT
   ========================================================= */
function PackageObject({ progress }) {
  let x = 0, y = 0, s = 1, rotY = 0, rotX = 0, opacity = 1;
  let annotationOpa = 0;

  if (progress < 0.03) {
    // 0.00 - 0.03: Package enters (0-15% of opening)
    x = mapRange(progress, 0, 0.03, 25, 10); // vw
    s = mapRange(progress, 0, 0.03, 0.8, 1);
    rotY = mapRange(progress, 0, 0.03, 30, 15);
    rotX = 5;
  } else if (progress < 0.07) {
    // 0.03 - 0.07: Package rotates (15-35% of opening)
    x = mapRange(progress, 0.03, 0.07, 10, 0);
    s = mapRange(progress, 0.03, 0.07, 1, 1.2);
    rotY = mapRange(progress, 0.03, 0.07, 15, -70); // rotate to show right panel
    rotX = mapRange(progress, 0.03, 0.07, 5, 0);
  } else if (progress < 0.10) {
    // 0.07 - 0.10: Declarations come into view (35-50%)
    x = 0; s = 1.2; rotY = -70; rotX = 0;
    annotationOpa = mapRange(progress, 0.07, 0.09, 0, 1);
  } else if (progress < 0.13) {
    // 0.10 - 0.13: Phone enters (50-65%)
    x = 0; s = 1.2; rotY = -70; rotX = 0;
    annotationOpa = mapRange(progress, 0.10, 0.12, 1, 0); // fade out annotation before capture
  } else if (progress < 0.15) {
    // 0.13 - 0.15: Camera aligns (65-75%)
    x = 0; rotY = -70; rotX = 0;
    s = mapRange(progress, 0.13, 0.15, 1.2, 1.25);
  } else if (progress < 0.175) {
    // 0.15 - 0.175: Focus Lock & Capture (75-88%)
    x = 0; s = 1.25; rotY = -70; rotX = 0;
  } else if (progress < 0.20) {
    // 0.175 - 0.20: CV Transition (Flattens out and moves left to make room)
    x = mapRange(progress, 0.175, 0.20, 0, -20);
    s = mapRange(progress, 0.175, 0.20, 1.25, 1.2);
    rotY = mapRange(progress, 0.175, 0.20, -70, -90);
    rotX = 0;
  } else if (progress < 0.35) {
    // Scene 2/3/4: Stays left. Smoothly scales down from 1.2 to 1.0 between 0.25 and 0.30
    x = -20;
    s = mapRange(progress, 0.25, 0.30, 1.2, 1.0);
    rotY = -90; rotX = 0;
  } else if (progress < 0.42) {
    // Scene 5 Fusion: Fade out to let the diagram take over
    x = -20;
    y = 0;
    opacity = mapRange(progress, 0.35, 0.38, 1, 0);
    s = 1.0; rotY = -90; rotX = 0;
  } else if (progress < 0.49) {
    // Scene 6 Selective AI: Fade back in on the left
    x = -20;
    opacity = mapRange(progress, 0.42, 0.45, 0, 1);
    s = 1.0; rotY = -90; rotX = 0;
  } else if (progress < 0.56) {
    // Scene 7 Learning: Fade out for the loop diagram
    x = -20;
    opacity = mapRange(progress, 0.49, 0.51, 1, 0);
    s = 1.0; rotY = -90; rotX = 0;
  } else if (progress < 0.63) {
    // Scene 8 Law: Fade back in
    x = -20;
    opacity = mapRange(progress, 0.56, 0.58, 0, 1);
    s = 1.0; rotY = -90; rotX = 0;
  } else if (progress < 0.70) {
    // Scene 9 Physical: Stays left
    x = -20;
    s = 1.0; rotY = -90; rotX = 0;
  } else if (progress < 0.77) {
    // Scene 10 Depth: Wireframe scale up
    x = -20;
    s = mapRange(progress, 0.70, 0.73, 1.0, 1.2);
    rotY = -90; rotX = 0;
  } else if (progress < 0.84) {
    // Scene 11 Offline: Scale down
    x = -20;
    s = mapRange(progress, 0.77, 0.80, 1.2, 0.8);
    rotY = -90; rotX = 0;
  } else if (progress < 0.91) {
    // Scene 12 Command: Fade out
    x = -20;
    opacity = mapRange(progress, 0.84, 0.86, 1, 0);
    s = 0.8; rotY = -90; rotX = 0;
  } else {
    opacity = 0;
  }

  // Bounding Boxes logic (Scene 2 & 3: 0.18 - 0.30)
  const showBbox = progress > 0.18 && progress < 0.30;
  const bboxOpa = (start) => clamp(mapRange(progress, start, start + 0.02, 0, 1), 0, 1);

  // Calculate camP for highlights during the camera sequence
  const camP = clamp(mapRange(progress, 0.08, 0.175, 0, 1), 0, 1);
  const hMrp = bell(camP, 0.68, 0.70, 0.74);
  const hQty = bell(camP, 0.70, 0.72, 0.76);
  const hDate = bell(camP, 0.72, 0.74, 0.78);
  const hCare = bell(camP, 0.74, 0.76, 0.80);
  const hBar = bell(camP, 0.76, 0.78, 0.82);

  // Wireframe logic (Scene 9: 0.63 - 0.70)
  const isWireframe = progress > 0.70 && progress < 0.77;
  const wfOpa = mapRange(progress, 0.63, 0.65, 0, 1) - mapRange(progress, 0.68, 0.70, 0, 1);
  
  return (
    <div className="pkg-3d-scene" style={{
      transform: `translate3d(${x}vw, ${y}vh, 0) scale(${s})`,
      opacity: opacity
    }}>
      <div className={`pkg-3d-object ${isWireframe ? 'wireframe' : ''}`} style={{ transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}>
        
        <div className="pkg-face pkg-front">
          <div className="pkg-f-brand">NATURE'S BEST</div>
          <div className="pkg-f-title">PREMIUM<br/>NUTRITION MIX</div>
          <div className="pkg-f-weight">500g</div>
          {/* Main PDP BBox */}
          {showBbox && <div className="pkg-bbox" style={{ position: 'absolute', inset: '10px', opacity: bboxOpa(0.19) }}>PDP_FRONT</div>}
        </div>

        <div className="pkg-face pkg-right">
          <div className="pkg-r-title">NUTRITIONAL INFO</div>
          <div className="pkg-r-row"><span>Energy</span><span>350 kcal</span></div>
          <div className="pkg-r-row"><span>Protein</span><span>12 g</span></div>
          <div className="pkg-r-divider"></div>

          <div className="pkg-r-mrp" style={{position:'relative'}}>
            MRP ₹450
            {hMrp > 0 && <div className="pkg-cam-highlight" style={{ opacity: hMrp }}></div>}
            {showBbox && <div className="pkg-bbox pkg-bbox-mrp" style={{ opacity: bboxOpa(0.18) }}>MRP_BLOCK</div>}
          </div>
          
          <div className="pkg-r-qty" style={{position:'relative'}}>
            Net Qty 100 g
            {hQty > 0 && <div className="pkg-cam-highlight" style={{ opacity: hQty }}></div>}
            {showBbox && <div className="pkg-bbox" style={{ opacity: bboxOpa(0.19) }}>NET_QTY_BLOCK</div>}
          </div>
          
          <div className="pkg-r-date" style={{position:'relative'}}>
            Mfg. Date <span className="empty-field">______</span>
            {annotationOpa > 0 && <div className="pkg-annotation" style={{ opacity: annotationOpa }}>DECLARATION NOT CONFIRMED</div>}
            {hDate > 0 && <div className="pkg-cam-highlight" style={{ opacity: hDate }}></div>}
            {showBbox && <div className="pkg-bbox" style={{ opacity: bboxOpa(0.20) }}>DATE_BLOCK</div>}
          </div>
          
          <div className="pkg-r-batch">Batch No. BX992</div>
          
          <div className="pkg-r-care" style={{position:'relative'}}>
            Care: 1800-123<br/>care@naturesbest.in
            {hCare > 0 && <div className="pkg-cam-highlight" style={{ opacity: hCare }}></div>}
            {showBbox && <div className="pkg-bbox" style={{ opacity: bboxOpa(0.21) }}>CARE_BLOCK</div>}
          </div>
          
          <div className="pkg-r-barcode" style={{position:'relative'}}>
            <span style={{height:'80%'}}/><span style={{height:'100%'}}/><span style={{height:'60%'}}/>
            <span style={{height:'90%'}}/><span style={{height:'70%'}}/><span style={{height:'100%'}}/>
            <span style={{height:'80%'}}/><span style={{height:'100%'}}/><span style={{height:'60%'}}/>
            <span style={{height:'90%'}}/><span style={{height:'70%'}}/><span style={{height:'100%'}}/>
            {hBar > 0 && <div className="pkg-cam-highlight" style={{ opacity: hBar }}></div>}
            {showBbox && <div className="pkg-bbox pkg-bbox-barcode" style={{ opacity: bboxOpa(0.22) }}>BARCODE</div>}
          </div>

          {/* Depth/AR Wireframe measurement */}
          {isWireframe && (
            <div className="pkg-depth-grid" style={{ opacity: plateau(progress, 0.70, 0.71, 0.76, 0.77) }}>
              <div className="grid-h"></div><div className="grid-v"></div>
              <div className="depth-measure">FONT HEIGHT: 2.1mm</div>
            </div>
          )}
        </div>

        <div className="pkg-face pkg-left"></div>
        <div className="pkg-face pkg-top"></div>
        <div className="pkg-face pkg-bottom"></div>
        
      </div>
    </div>
  );
}

/* =========================================================
   SCENES
   ========================================================= */

function Scene00Hero({ progress }) {
  const o = 1 - ramp(progress, 0.05, 0.10);
  return (
    <div className="cine-scene" style={{ opacity: o, pointerEvents: o > 0.5 ? 'auto' : 'none' }}>
      
      <div className="hero-watermark">METRICHECK</div>
      
      <div className="hero-side-scroll-container">
        <div className="hero-side-scroll">
          <span><strong>SCROLL TO SEE</strong> HOW IT WORKS</span>
          <div className="hero-side-line"></div>
        </div>
      </div>

      <div className="cine-text-block" style={{ transform: `translateY(${(1-o)*20}px)` }}>
        <div className="cine-eyebrow">Metricheck Engine</div>
        <h1 className="cine-h1">LEGAL METROLOGY,<br/><span className="c-blue">IN YOUR POCKET.</span></h1>
        <p className="cine-sub" style={{ fontSize: '18px', maxWidth: '600px', lineHeight: '1.5' }}>CROSS-PLATFORM EDGE AI. A LIGHTWEIGHT YOLO11N MODEL RUNNING DIRECTLY ON YOUR DEVICE TO PERCEIVE, MEASURE, AND ENFORCE COMPLIANCE, EVEN OFFLINE.</p>
      </div>
    </div>
  );
}

function Scene01Capture({ progress }) {
  // camP maps progress 0.08 -> 0.175 into 0.0 -> 1.0 for the camera story
  const camP = clamp(mapRange(progress, 0.08, 0.175, 0, 1), 0, 1);
  
  let phoneY = 100;
  let phoneScale = 1;
  let phoneOpa = 0;
  let flashOpa = 0;
  let instruction = "";

  if (camP >= 0.2 && camP < 0.4) {
    phoneOpa = mapRange(camP, 0.2, 0.3, 0, 1);
    phoneY = mapRange(camP, 0.2, 0.4, 30, 0); // comes up from bottom
  } else if (camP >= 0.4 && camP < 0.78) {
    phoneOpa = 1; phoneY = 0;
    phoneScale = mapRange(camP, 0.4, 0.78, 1.0, 1.05);
  } else if (camP >= 0.78 && camP < 0.95) {
    phoneOpa = 1; phoneY = 0; phoneScale = 1.05;
    flashOpa = mapRange(camP, 0.88, 0.90, 0, 1) - mapRange(camP, 0.90, 0.95, 0, 1);
  } else if (camP >= 0.95 && camP <= 1.0) {
    phoneOpa = mapRange(camP, 0.95, 1.0, 1, 0);
    phoneScale = mapRange(camP, 0.95, 1.0, 1.05, 1.2);
  }

  if (camP >= 0.2 && camP < 0.35) instruction = "PACKAGE DETECTED";
  else if (camP >= 0.35 && camP < 0.5) instruction = "QUALITY CHECK";
  else if (camP >= 0.5 && camP < 0.55) instruction = "MOVE CLOSER";
  else if (camP >= 0.55 && camP < 0.6) instruction = "REDUCE GLARE";
  else if (camP >= 0.6 && camP < 0.78) instruction = "HOLD STEADY";
  else if (camP >= 0.78 && camP < 0.88) instruction = "FRAME LOCKED";
  else if (camP >= 0.88 && camP < 0.95) instruction = "READY";

  const locked = camP >= 0.78;

  return (
    <div className="cine-scene" style={{ opacity: camP > 0 && progress < 0.20 ? 1 : 0, pointerEvents: 'none' }}>
      
      {/* Smart Camera HUD */}
      <div className="cam-telemetry">
         {camP > 0 && (
           <div className="cam-t-label" style={{ opacity: ramp(camP, 0.0, 0.1) }}>
              SMART CAMERA <br/><span>REAL-TIME CAPTURE ASSISTANCE</span>
           </div>
         )}
         
         {camP > 0.2 && (
           <div className="cam-t-block" style={{ opacity: ramp(camP, 0.2, 0.25) }}>
              <div className="cam-t-row"><span>PACKAGE DETECTED</span></div>
              <div className="cam-t-row c-green"><span>SUBJECT LOCKED</span></div>
           </div>
         )}

         {camP > 0.35 && (
           <div className="cam-t-block" style={{ opacity: ramp(camP, 0.35, 0.4) }}>
              <div className="cam-t-header">IMAGE QUALITY</div>
              <div className="cam-t-row"><span>BLUR</span> <span>{camP > 0.41 ? '✓' : (camP > 0.38 ? 'CHECKING...' : '')}</span></div>
              <div className="cam-t-row"><span>GLARE</span> <span>{camP > 0.44 ? '✓' : (camP > 0.41 ? 'CHECKING...' : '')}</span></div>
              <div className="cam-t-row"><span>POSE</span> <span>{camP > 0.47 ? '✓' : (camP > 0.44 ? 'CHECKING...' : '')}</span></div>
              <div className="cam-t-row"><span>FRAMING</span> <span>{camP > 0.50 ? '✓' : (camP > 0.47 ? 'CHECKING...' : '')}</span></div>
           </div>
         )}

         {camP > 0.65 && (
           <div className="cam-t-block" style={{ opacity: ramp(camP, 0.65, 0.7) }}>
              <div className="cam-t-header">INSPECTION COVERAGE</div>
              <div className="cam-t-row"><span>FRONT PANEL</span> <span>{camP > 0.67 ? '✓' : ''}</span></div>
              <div className="cam-t-row"><span>MRP AREA</span> <span>{camP > 0.69 ? '✓' : ''}</span></div>
              <div className="cam-t-row"><span>NET QUANTITY</span> <span>{camP > 0.71 ? '✓' : ''}</span></div>
              <div className="cam-t-row"><span>DATE AREA</span> <span>{camP > 0.73 ? '✓' : ''}</span></div>
              <div className="cam-t-row"><span>CONTACT DETAILS</span> <span>{camP > 0.75 ? '✓' : ''}</span></div>
              <div className="cam-t-row"><span>BARCODE</span> <span>{camP > 0.77 ? '✓' : ''}</span></div>
           </div>
         )}
      </div>

      <div className="cine-phone-overlay" style={{ opacity: phoneOpa, transform: `translate3d(0, ${phoneY}vh, 0) scale(${phoneScale})` }}>
        <div className="cine-phone-frame">
          <div className="cine-phone-notch"></div>
          <div className="cine-phone-viewfinder">
            <div className={`cam-bracket cam-tl ${locked ? 'locked' : ''}`}></div>
            <div className={`cam-bracket cam-tr ${locked ? 'locked' : ''}`}></div>
            <div className={`cam-bracket cam-bl ${locked ? 'locked' : ''}`}></div>
            <div className={`cam-bracket cam-br ${locked ? 'locked' : ''}`}></div>
            {instruction && <div className="cam-instruction">{instruction}</div>}
          </div>
        </div>
      </div>

      <div className="cine-flash" style={{ opacity: flashOpa, background: '#fff', position: 'absolute', inset: 0, zIndex: 9999 }}></div>
    </div>
  );
}

function Scene02Perception({ progress }) {
  const o = plateau(progress, 0.20, 0.21, 0.24, 0.25);
  // OCR Tokens floating out from the flattened package
  const t1 = ramp(progress, 0.20, 0.21);
  const t2 = ramp(progress, 0.21, 0.22);
  const t3 = ramp(progress, 0.22, 0.23);
  
  return (
    <div className="cine-scene" style={{ opacity: o, pointerEvents: 'none' }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2">LOCAL PERCEPTION</h2>
        <p className="cine-sub">The machine sees structure before reading text.</p>
        <div className="tech-tags" style={{ justifyContent: 'flex-start' }}><span>YOLO11n</span><span>PaddleOCR</span><span>Google ML Kit</span></div>
        
        <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '400px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>PDP</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>MRP_BLOCK</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>NET_QTY_BLOCK</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>DATE_BLOCK</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>MFG_BLOCK</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>CONSUMER_CARE</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>ORIGIN_BLOCK</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>LOGOS</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', border: '1px solid #3b82f6', padding: '4px 6px', borderRadius: '4px' }}>BARCODE</span>
        </div>
      </div>
      
      {/* Floating OCR Tokens mapping to the CV bounding boxes, sliding from left package to center right */}
      <div className="ocr-token" style={{ top: '35%', left: '35%', opacity: t1, transform: `translateX(${t1*40}px)` }}>"MRP ₹450"</div>
      <div className="ocr-token" style={{ top: '45%', left: '35%', opacity: t2, transform: `translateX(${t2*40}px)` }}>"100 g"</div>
      {/* Intentional empty field detection */}
      <div className="ocr-token" style={{ top: '55%', left: '35%', opacity: t3, transform: `translateX(${t3*40}px)`, color: 'var(--c-amber)' }}>"[ EMPTY ]"</div>
    </div>
  );
}

function Scene03Classification({ progress }) {
  const o = plateau(progress, 0.25, 0.26, 0.29, 0.30);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2">PRODUCT<br/>CLASSIFICATION</h2>
        <p className="cine-sub">Fusing signals to determine product identity.</p>
        
        <div className="classification-matrix mt-6" style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--c-blue)', marginBottom: '12px', fontWeight: 'bold' }}>YOLO11n-cls MACRO CLASSES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#166534', background: 'rgba(34, 197, 94, 0.15)', padding: '4px 8px', borderRadius: '4px', borderLeft: '3px solid #22c55e', fontWeight: 'bold' }}>
              <span>FOOD_BEVERAGE</span><span>98.4%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(0,0,0,0.4)', padding: '2px 8px', fontWeight: 600 }}>
              <span>COSMETICS</span><span>1.2%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(0,0,0,0.4)', padding: '2px 8px', fontWeight: 600 }}>
              <span>PHARMACEUTICAL_OTC</span><span>0.3%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(0,0,0,0.4)', padding: '2px 8px', fontWeight: 600 }}>
              <span>FAST_MOVING_CONSUMER_GOODS</span><span>0.1%</span>
            </div>
          </div>
        </div>

        <div className="flow-diagram mt-6">
          <div className="flow-inputs">
            <div className="flow-node" style={{ padding: '8px 12px', fontSize: '11px' }}>YOLO11n-cls</div>
            <div className="flow-node" style={{ padding: '8px 12px', fontSize: '11px' }}>GTIN DB</div>
          </div>
          <Icon name="arrow" size={20} className="my-2" />
          <div className="flow-node flow-node--blue" style={{ width: '100%' }}>MULTI-SIGNAL FUSION</div>
          <Icon name="arrow" size={20} className="my-2" />
          <div className="flow-node flow-node--green" style={{ width: '100%' }}>APPLY LMPC FOOD RULES ✓</div>
        </div>
      </div>
    </div>
  );
}

function Scene04Evidence({ progress }) {
  const o = plateau(progress, 0.30, 0.31, 0.34, 0.35);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2">WE DON'T JUST READ.<br/><span className="c-blue">WE TRACE.</span></h2>
        
        <div className="evidence-pipeline mt-8">
          <div className="ep-flow">
            <span>RAW IMAGE</span> → <span>OCR TOKENS</span> → <span>ENTITY PARSING</span> → <span>STRUCTURED EVIDENCE</span>
          </div>
          <div className="ep-example mt-4">
            <div className="ep-raw">"MRP: ₹450/-"</div>
            <Icon name="arrow" size={16} className="my-2" />
            <div className="ep-structured">
              <div><label>FIELD</label><strong>MRP</strong></div>
              <div><label>VALUE</label><strong>450</strong></div>
              <div><label>SOURCE</label><strong>OCR</strong></div>
              <div><label>CONFIDENCE</label><strong>0.96</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene05Fusion({ progress }) {
  const o = plateau(progress, 0.35, 0.36, 0.41, 0.42);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--center">
        <h2 className="cine-h2">THREE-WAY EVIDENCE FUSION</h2>
        
        <div className="fusion-diagram mt-8">
          <div className="fusion-sources">
            <div className="fusion-card">
              <label>PHYSICAL LABEL</label>
              <strong>OCR MRP ₹250</strong>
            </div>
            <div className="fusion-card">
              <label>TRUSTED DATA</label>
              <strong>GTIN MRP ₹180</strong>
            </div>
          </div>
          <Icon name="arrow" size={20} className="my-3" />
          <div className="fusion-result fusion-alert">DISCREPANCY DETECTED</div>
          
          <div className="fusion-sources mt-6">
            <div className="fusion-card"><label>OCR</label><strong>500 g</strong></div>
            <div className="fusion-card"><label>MASTER DATA</label><strong>500 g</strong></div>
            <div className="fusion-card"><label>SCALE</label><strong>455 g</strong></div>
          </div>
          <Icon name="arrow" size={20} className="my-3" />
          <div className="fusion-result">QUANTITY COMPARISON</div>
        </div>
      </div>
    </div>
  );
}

function Scene06SelectiveAI({ progress }) {
  const o = plateau(progress, 0.42, 0.43, 0.48, 0.49);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2">LOCAL FIRST.<br/><span className="c-blue">AI WHEN NEEDED.</span></h2>
        
        <div className="ai-paths mt-8">
          <div className="ai-path ai-path--green">
            <label>DETERMINISTIC PATH</label>
            <div>LOCAL OCR ✓</div>
            <div>EXTRACTION ✓</div>
          </div>
          <div className="ai-path ai-path--amber mt-4">
            <label>SELECTIVE AI RECOVERY</label>
            <div className="c-amber">MFG DATE ???? (LOW CONF)</div>
            <div className="ai-gemini">GEMINI VISION</div>
            <div className="c-green">RECOVERED: 08.08.26</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene08Law({ progress }) {
  const o = plateau(progress, 0.56, 0.57, 0.62, 0.63);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2">FROM TEXT<br/><span className="c-blue">TO LAW.</span></h2>
        <p className="cine-sub">Extracted evidence is evaluated against a deterministic legal rule engine.</p>
        
        <div className="law-rules mt-8">
          <div className="law-rule">
            <div className="lr-evidence">MRP ₹450</div>
            <Icon name="arrow" size={16} />
            <div className="lr-code">LMPC-6-1-e</div>
            <Icon name="arrow" size={16} />
            <div className="lr-result">✓ VERIFIED</div>
          </div>
          <div className="law-rule">
            <div className="lr-evidence">NET QTY 100g</div>
            <Icon name="arrow" size={16} />
            <div className="lr-code">LMPC-6-1-c</div>
            <Icon name="arrow" size={16} />
            <div className="lr-result">✓ VERIFIED</div>
          </div>
          <div className="law-rule">
            <div className="lr-evidence">MFG DATE [EMPTY]</div>
            <Icon name="arrow" size={16} />
            <div className="lr-code">LMPC-6-1-d</div>
            <Icon name="arrow" size={16} />
            <div className="lr-result lr-result--fail">VIOLATION</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene09Physical({ progress }) {
  const o = plateau(progress, 0.63, 0.64, 0.69, 0.70);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2" style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}>AUTOMATED PHYSICAL<br/><span className="c-blue">MEASUREMENT.</span></h2>
        <div className="tech-tags" style={{ justifyContent: 'flex-start', marginBottom: '16px' }}><span>Bluetooth Scale</span><span>Digital Caliper</span></div>
        <p className="cine-sub" style={{ fontSize: '14px', lineHeight: '1.6' }}>Quantifying measurement uncertainty to automate valid PASS/FAIL results without inspector intervention.</p>
        
        <div className="scale-readout mt-6" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', color: '#0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '1px' }}>ACTUAL MASS</div>
              <div className="scale-display" style={{ fontSize: '36px', fontWeight: 800, color: '#dc2626' }}>455 <span style={{ fontSize: '16px', color: '#64748b' }}>g</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '1px' }}>DECLARED</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>500 <span style={{ fontSize: '14px', color: '#64748b' }}>g</span></div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Tolerance Margin: <strong style={{ color: '#0f172a' }}>± 15g</strong></div>
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>OUT OF TOLERANCE</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene10Depth({ progress }) {
  const o = plateau(progress, 0.70, 0.71, 0.76, 0.77);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2" style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}>CAN WE MEASURE<br/>WHAT THE CAMERA SEES?</h2>
        <div className="hp-research mb-4">RESEARCH & DEVELOPMENT</div>
        <p className="cine-sub" style={{ fontSize: '14px', lineHeight: '1.6' }}>Combining OCR with AR Depth APIs to estimate physical text dimensions. Incorporates calibration and measurement uncertainty to evaluate Rule 7 compliance.</p>
        
        <div className="depth-readout mt-6" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', color: '#0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>DETECTED FONT HEIGHT</span>
            <strong style={{ fontSize: '16px' }}>2.1 mm</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>MEASUREMENT UNCERTAINTY</span>
            <strong style={{ fontSize: '14px', color: '#f59e0b' }}>± 0.15 mm</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>RULE 7 MINIMUM</span>
            <strong style={{ fontSize: '14px' }}>2.0 mm</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Only genuinely invalid scans cause recapture.</span>
            <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>AUTOMATED PASS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene11Offline({ progress }) {
  const o = plateau(progress, 0.77, 0.78, 0.83, 0.84);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--right">
        <h2 className="cine-h2">INSPECTION DOESN'T STOP<br/>WHEN THE NETWORK DOES.</h2>
        <div className="tech-tags" style={{ justifyContent: 'flex-start' }}><span>Local PostgreSQL</span><span>Offline Queue</span></div>
        
        <div className="offline-status mt-8">
          <div className="os-badge">OFFLINE MODE ACTIVE</div>
          <div className="os-log mt-4">
            <div>✓ LOCAL OCR COMPLETE</div>
            <div>✓ EVIDENCE EXTRACTED</div>
            <div>✓ SAVED TO SECURE STORAGE</div>
            <div className="c-blue mt-2">WAITING FOR SYNC...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene12Command({ progress }) {
  const o = plateau(progress, 0.84, 0.85, 0.90, 0.91);
  return (
    <div className="cine-scene" style={{ opacity: o }}>
      <div className="cine-text-block cine-text-block--center">
        <h2 className="cine-h2">FROM DETECTION<br/><span className="c-blue">TO DECISION.</span></h2>
        
        <div className="command-center mt-8">
          <div className="cc-summary">
            <div>✓ MRP</div><div>✓ NET QTY</div><div>✓ DATE</div>
          </div>
          <div className="cc-split mt-6">
            <div>
              <label>SYSTEM ASSESSMENT</label>
              <div className="cc-badge cc-badge--amber">REVIEW REQUIRED</div>
            </div>
            <div>
              <label>INSPECTOR DECISION</label>
              <div className="cc-btn cc-btn--green">CONFIRM COMPLIANT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene07Learning({ progress }) {
  const o = plateau(progress, 0.49, 0.50, 0.55, 0.56);
  
  // Animation timings for the flywheel steps
  const s1 = ramp(progress, 0.49, 0.50);
  const s2 = ramp(progress, 0.50, 0.51);
  const s3 = ramp(progress, 0.51, 0.52);
  const s4 = ramp(progress, 0.52, 0.53);
  const s5 = ramp(progress, 0.53, 0.54);

  return (
    <div className="cine-scene" style={{ opacity: o, pointerEvents: 'none' }}>
      
      {/* LEFT SIDE: Text and Cost-Decay Graph */}
      <div className="cine-text-block cine-text-block--left" style={{ width: '45%' }}>
        <h2 className="cine-h2" style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}>THE SYSTEM<br/><span className="c-blue">GETS SMARTER.</span></h2>
        <p className="cine-sub" style={{ marginBottom: '32px' }}>Gemini Teacher & Local Learning Flywheel.</p>
        
        <div style={{ background: 'rgba(255,255,255,0.8)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--c-ink)', letterSpacing: '1px', marginBottom: '16px' }}>COST-DECAY OBJECTIVE</h4>
          
          <div style={{ position: 'relative', height: '120px', borderLeft: '2px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', display: 'flex', alignItems: 'flex-end', paddingTop: '10px' }}>
            {/* Local Accuracy Line (Goes up) */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
              <path d="M 0 100 Q 100 80, 150 40 T 300 10" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray="300" strokeDashoffset={300 - (300 * s5)} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
              <path d="M 0 20 Q 100 20, 150 60 T 300 90" fill="none" stroke="#4f46e5" strokeWidth="4" strokeDasharray="300" strokeDashoffset={300 - (300 * s5)} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
            </svg>
            <div style={{ position: 'absolute', top: '0', right: '0', fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>↑ Local Accuracy</div>
            <div style={{ position: 'absolute', bottom: '0', right: '0', fontSize: '11px', fontWeight: 700, color: '#4f46e5' }}>↓ API Costs</div>
          </div>
          
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '16px', lineHeight: 1.5 }}>
            Stronger local models solve difficult cases locally, dramatically reducing future Gemini API calls.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: The Flywheel Diagram */}
      <div className="cine-text-block cine-text-block--right" style={{ width: '50%', paddingRight: '5%' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
          
          {/* Step 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', opacity: s1, transform: `translateX(${(1-s1)*20}px)` }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--c-ink)' }}>Hard Case / Uncertainty</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Local YOLO11n lacks confidence on a degraded label.</div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', opacity: s2, transform: `translateX(${(1-s2)*20}px)` }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>2</div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--c-ink)' }}>Gemini Recovery (Teacher)</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Cloud Vision recovers the text and maps evidence.</div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', opacity: s3, transform: `translateX(${(1-s3)*20}px)` }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ec4899', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>3</div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '2px dashed #ec4899', flex: 1, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#be185d' }}>Human-in-the-Loop</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Inspector validates data & adjusts bounding boxes.</div>
            </div>
          </div>

          {/* Step 4 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', opacity: s4, transform: `translateX(${(1-s4)*20}px)` }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>4</div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--c-ink)' }}>Curated Annotation Queue</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Quality controlled dataset ready for training.</div>
            </div>
          </div>

          {/* Step 5 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', opacity: s5, transform: `translateX(${(1-s5)*20}px)` }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>5</div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '2px solid #22c55e', flex: 1, boxShadow: '0 4px 20px rgba(34,197,94,0.1)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#166534' }}>Versioned YOLO11n Release</div>
              <div style={{ fontSize: '12px', color: '#166534' }}>Periodic fine-tuning creates stronger local perception!</div>
            </div>
          </div>
          
          {/* Loop Back Line (Visual only) */}
          <div style={{ position: 'absolute', left: '15px', top: '16px', bottom: '16px', width: '2px', background: '#e2e8f0', zIndex: -1 }}></div>

        </div>
      </div>
    </div>
  );
}

function Scene13Final({ progress, onStart }) {
  const o = ramp(progress, 0.91, 0.95);
  return (
    <div className="cine-scene" style={{ opacity: o, pointerEvents: o > 0.5 ? 'auto' : 'none' }}>
      <div className="cine-text-block cine-text-block--center">
        <div className="final-pipeline mb-6">
          <span>PACKAGE</span> → <span>PERCEIVE</span> → <span>VERIFY</span> → <span>DECIDE</span>
        </div>
        <h1 className="cine-h1" style={{ fontSize: 'clamp(40px, 8vw, 100px)' }}>SEE.<br/>VERIFY.<br/>DECIDE.</h1>
        <p className="cine-sub mb-8" style={{ color: '#fff', opacity: 1 }}>AI-powered Legal Metrology inspection, built for the field.</p>
        <button className="cine-nav-cta cine-nav-cta--large" onClick={onStart}>START INSPECTION</button>
      </div>
    </div>
  );
}

export default function HomePage({ onStart }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isMobile) {
    return <MobileHomePage onStart={onStart} />;
  }

  return <DesktopHomePage onStart={onStart} />;
}
