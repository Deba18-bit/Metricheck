import React, { useEffect, useRef } from 'react';
import './MobileHomePage.css';

// IntersectionObserver hook for triggering fade-in animations
function useScrollReveal() {
  const ref = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.15,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return ref;
}

// Reusable Section Component
function Section({ children, className = '' }) {
  const ref = useScrollReveal();
  return (
    <section ref={ref} className={`mh-section ${className}`}>
      {children}
    </section>
  );
}

export default function MobileHomePage({ onStart }) {
  useEffect(() => {
    // Ensure mobile body scrolling is enabled when this mounts
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="mobile-home-page">
      
      {/* 00 - HERO */}
      <Section>
        <div style={{ alignSelf: 'flex-start', width: '100%' }}>
          <div className="mh-eyebrow" style={{ color: 'var(--c-ink)', textAlign: 'left', marginBottom: '24px' }}>METRICHECK ENGINE</div>
          <h1 className="mh-title" style={{ fontSize: '13vw', textAlign: 'left', lineHeight: 1.05, textTransform: 'uppercase', marginBottom: '24px' }}>
            LEGAL<br/>METROLOGY,<br/>
            <span style={{ color: 'var(--c-blue)' }}>IN YOUR<br/>POCKET.</span>
          </h1>
          <p className="mh-subtitle" style={{ textAlign: 'left', opacity: 0.8, fontSize: '14px', lineHeight: 1.6, maxWidth: '100%', textTransform: 'uppercase', marginBottom: '40px' }}>
            CROSS-PLATFORM EDGE AI. A LIGHTWEIGHT YOLO11N MODEL RUNNING DIRECTLY ON YOUR DEVICE TO PERCEIVE, MEASURE, AND ENFORCE COMPLIANCE, EVEN OFFLINE.
          </p>
          <button className="mh-cta-btn" onClick={onStart}>START INSPECTION</button>
        </div>
      </Section>

      {/* 01 - SMART CAMERA */}
      <Section>
        <div className="mh-eyebrow">01 — SMART CAMERA</div>
        <h2 className="mh-title">Guided Capture</h2>
        <p className="mh-subtitle" style={{ maxWidth: '340px' }}>
          OpenCV preprocessing ensures only high-quality frames enter the pipeline.
        </p>
        
        <div className="mh-package-container">
          <div className="mh-phone-frame">
            <div className="mh-phone-viewfinder"></div>
          </div>
          <div className="mh-package-static">
            <div className="front">
              <h3 style={{ color: '#4ade80', fontSize: '9px', margin: 0, textTransform: 'uppercase' }}>Nature's Best</h3>
              <h2 style={{ fontSize: '13px', margin: '4px 0 0', lineHeight: 1.1, textTransform: 'uppercase' }}>Premium<br/>Nutrition Mix</h2>
              <div style={{ position: 'absolute', bottom: '10px', fontSize: '8px', opacity: 0.6 }}>500g</div>
            </div>
            <div className="side">
              <h4 style={{ fontSize: '9px', borderBottom: '1px solid #111', paddingBottom: '2px', marginBottom: '4px' }}>NUTRITIONAL INFO</h4>
              <p style={{ fontSize: '7px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}><span>Energy</span> <span>350 kcal</span></p>
              <p style={{ fontSize: '7px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}><span>Protein</span> <span>12 g</span></p>
              <div style={{ background: '#e0e7ff', border: '1px solid #6366f1', padding: '2px 4px', fontSize: '8px', fontWeight: 'bold', margin: '6px 0 2px' }}>MRP ₹450</div>
              <div style={{ background: '#e0e7ff', border: '1px solid #6366f1', padding: '2px 4px', fontSize: '8px', fontWeight: 'bold', margin: '2px 0' }}>Net Qty 100 g</div>
              <p style={{ fontSize: '7px', margin: '4px 0 0' }}>Mfg. Date ____</p>
              <p style={{ fontSize: '7px', margin: '2px 0' }}>Batch No. BX992</p>
              
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', fontSize: '6px', opacity: 0.6 }}>
                Care: 1800-123<br/>
                care@naturesbest.in
                <div style={{ marginTop: '4px', borderLeft: '1px solid #111', borderRight: '1px solid #111', width: '30px', height: '10px', background: 'repeating-linear-gradient(90deg, #111, #111 1px, transparent 1px, transparent 3px)' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mh-cam-cues">
          <span>Blur detection</span>
          <span>Glare gates</span>
          <span>Pose verification</span>
        </div>
        <div className="mh-cam-cues" style={{ marginTop: '8px' }}>
          <span className="active" style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}>TILT TO REDUCE GLARE</span>
          <span className="active">HOLD STEADY</span>
        </div>
        <div style={{ fontSize: '12px', textAlign: 'center', opacity: 0.6, marginTop: '24px', maxWidth: '280px', lineHeight: 1.5 }}>
          Poor frames are automatically rejected and guided in real-time before becoming downstream evidence.
        </div>
      </Section>

      {/* 02 - LOCAL PERCEPTION */}
      <Section className="blue">
        <div className="mh-eyebrow">02 — LOCAL PERCEPTION</div>
        <h2 className="mh-title">On-Device AI</h2>
        <p className="mh-subtitle" style={{ maxWidth: '340px' }}>
          YOLO11n Nano Detector performs local semantic-region detection and bounding-box generation.
        </p>

        <div className="mh-tags" style={{ marginBottom: '24px' }}>
          <span>PDP</span>
          <span>MRP_BLOCK</span>
          <span>NET_QTY</span>
          <span>DATE_BLOCK</span>
          <span>REGULATORY_LOGOS</span>
          <span>BARCODE</span>
        </div>

        <div className="mh-flow-diagram" style={{ gap: '12px' }}>
          <div className="mh-flow-node">
            <span style={{ fontWeight: 800 }}>OCR</span><br/>
            PaddleOCR / Google ML Kit
          </div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">
            <span style={{ fontWeight: 800 }}>BARCODE</span><br/>
            PyZBar / ZXing-Cpp (GTIN)
          </div>
        </div>

        <div style={{ fontSize: '12px', textAlign: 'center', opacity: 0.8, marginTop: '32px', maxWidth: '320px', lineHeight: 1.5, background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px' }}>
          Perception preserves raw text, confidence, source image and original-image coordinates for <strong>evidence provenance</strong>.
        </div>
      </Section>

      {/* 03 - CLASSIFICATION */}
      <Section className="dark">
        <div className="mh-eyebrow">03 — CLASSIFICATION</div>
        <h2 className="mh-title">Product Classification</h2>
        <p className="mh-subtitle" style={{ maxWidth: '340px' }}>
          Classification selects the regulatory profile; it does not itself make the legal decision.
        </p>

        <div className="mh-flow-diagram" style={{ gap: '10px' }}>
          <div className="mh-flow-node">
            <span style={{ opacity: 0.6, fontSize: '10px' }}>TIER 1</span><br/>
            GTIN/Master-data lookup
          </div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">
            <span style={{ opacity: 0.6, fontSize: '10px' }}>TIER 2</span><br/>
            YOLO11n-cls
          </div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ borderColor: 'var(--c-blue)', color: 'var(--c-blue)' }}>
            <span style={{ opacity: 0.6, fontSize: '10px', color: '#fff' }}>TIER 3</span><br/>
            Gemini Teacher Escalation
            <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8, color: '#fff' }}>
              (When local confidence is insufficient; validated outputs enter the learning queue)
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '1px', opacity: 0.6, marginBottom: '12px' }}>EIGHT MACRO CLASSES:</div>
          <div className="mh-tags" style={{ justifyContent: 'center' }}>
            <span>FOOD_BEVERAGE</span>
            <span>COSMETICS_PERSONAL_CARE</span>
            <span>ELECTRONICS_APPLIANCES</span>
            <span>PHARMACEUTICALS_MEDICAL</span>
            <span>APPAREL_TEXTILES_FOOTWEAR</span>
            <span>HOUSEHOLD_CLEANING_FMCG</span>
            <span>HARDWARE_AUTOMOTIVE</span>
            <span>GENERAL_PACKAGED_GOODS</span>
          </div>
        </div>
      </Section>

      {/* 04 - EVIDENCE */}
      <Section>
        <div className="mh-eyebrow">04 — EVIDENCE</div>
        <h2 className="mh-title">Central Evidence Bridge</h2>
        <p className="mh-subtitle" style={{ maxWidth: '340px' }}>
          Entity parsing and structured field extraction with preserved original OCR.
        </p>
        
        <div className="mh-evidence-box">
          <div className="mh-evidence-row">
            <span>Raw OCR</span>
            <span>"Rs. 450.00"</span>
          </div>
          <div className="mh-flow-arrow" style={{ textAlign: 'center', margin: '4px 0' }}>↓</div>
          <div className="mh-evidence-row">
            <span>Character Correction</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>(Context-aware safe fixes)</span>
          </div>
          <div className="mh-flow-arrow" style={{ textAlign: 'center', margin: '4px 0' }}>↓</div>
          <div className="mh-evidence-row">
            <span>Normalization</span>
            <span>MRP, Qty (g/kg/ml/L), Date</span>
          </div>
          <div className="mh-flow-arrow" style={{ textAlign: 'center', margin: '4px 0' }}>↓</div>
          <div className="mh-evidence-row highlight">
            <span>Evidence</span>
            <span>₹450 / 100g</span>
          </div>
        </div>

        <div style={{ marginTop: '24px', fontSize: '12px', lineHeight: 1.5, opacity: 0.8, maxWidth: '320px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px' }}>• <strong>Derived Unit Sale Price</strong> calculated automatically.</p>
          <p style={{ margin: '0 0 8px' }}>• Multi-frame voting, spatial consistency, & GTIN cross-checks.</p>
          <p style={{ margin: 0 }}>• Hard conflicts <strong>cannot</strong> be overridden by high scores.</p>
        </div>
      </Section>

      {/* 05 - SUFFICIENCY GATE */}
      <Section className="blue">
        <div className="mh-eyebrow">05 — SUFFICIENCY GATE</div>
        <h2 className="mh-title">Are we certain?</h2>
        <p className="mh-subtitle">The deterministic gatekeeper.</p>

        <div className="mh-split-diagram" style={{ margin: '24px 0' }}>
          <div className="mh-split-col">
            <div className="mh-flow-node" style={{ borderColor: '#16a34a', color: '#16a34a' }}>SUFFICIENT</div>
            <div className="mh-flow-arrow" style={{ color: '#16a34a' }}>↓</div>
            <div className="mh-flow-node">Deterministic<br/>Rule Engine</div>
          </div>
          <div className="mh-split-col">
            <div className="mh-flow-node" style={{ borderColor: '#f59e0b', color: '#f59e0b', fontSize: '9px' }}>MISSING / DEGRADED</div>
            <div className="mh-flow-arrow" style={{ color: '#f59e0b' }}>↓</div>
            <div className="mh-flow-node">Escalate to<br/>Gemini Vision</div>
          </div>
        </div>
      </Section>

      {/* 06 - SELECTIVE GEMINI */}
      <Section className="dark">
        <div className="mh-eyebrow">06 — SELECTIVE GEMINI</div>
        <h2 className="mh-title">AI for Hard Cases</h2>
        <p className="mh-subtitle" style={{ maxWidth: '340px' }}>
          Gemini acts as the recovery engine and teacher—not the permanent processing layer.
        </p>

        <div style={{ marginTop: '24px', fontSize: '12px', lineHeight: 1.6, textAlign: 'center', opacity: 0.8, maxWidth: '300px' }}>
          <p style={{ margin: '0 0 12px' }}>• Receives the full image or targeted crops to recover ambiguous text.</p>
          <p style={{ margin: '0 0 12px' }}>• Validated hard cases automatically enter a curated training queue.</p>
          <p style={{ margin: 0 }}>• <strong>Goal:</strong> Improve local models over time and decrease API dependency.</p>
        </div>
      </Section>

      {/* 07 - CONTINUOUS LEARNING */}
      <Section>
        <div className="mh-eyebrow">07 — CONTINUOUS LEARNING</div>
        <h2 className="mh-title">The Learning Flywheel</h2>
        <p className="mh-subtitle" style={{ maxWidth: '340px' }}>
          Gemini doesn't retrain models directly. It supplies teacher examples for our Human-in-the-Loop pipeline.
        </p>

        <div className="mh-flow-diagram" style={{ gap: '8px' }}>
          <div className="mh-flow-node" style={{ opacity: 0.8 }}>HARD / UNCERTAIN CASES</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ borderColor: 'var(--c-blue)', color: 'var(--c-blue)' }}>GEMINI TEACHER RECOVERY</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ background: '#f59e0b', color: '#111', fontWeight: 600, border: 'none' }}>
            HUMAN QUALITY CONTROL<br/>
            <span style={{ fontSize: '9px', opacity: 0.8 }}>(Bbox / Label Corrections)</span>
          </div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">CURATED DATASET</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">TRAINING & BENCHMARKING</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ background: '#16a34a', color: '#fff', border: 'none' }}>VERSIONED RELEASE</div>
        </div>

        <div style={{ marginTop: '32px', fontSize: '12px', lineHeight: 1.6, textAlign: 'center', opacity: 0.8, maxWidth: '320px', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <p style={{ margin: '0 0 12px' }}>• Humans do <strong>not</strong> manually inspect every product. Intervention is targeted.</p>
          <p style={{ margin: '0 0 12px' }}>• Improves YOLO11n, YOLO11n-cls, and OCR models.</p>
          <p style={{ margin: 0 }}>• <strong>Cost-Decay Objective:</strong> Stronger local models solve harder cases, reducing future Gemini API costs.</p>
        </div>
      </Section>

      {/* 08 - LEGAL INTELLIGENCE */}
      <Section className="blue">
        <div className="mh-eyebrow">08 — LEGAL INTELLIGENCE</div>
        <h2 className="mh-title">Deterministic Validation</h2>
        <p className="mh-subtitle">Mapping evidence to versioned LMPC requirements.</p>

        <div className="mh-flow-diagram">
          <div className="mh-flow-node">Evidence</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">Applicability Engine</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">Versioned LMPC Rules</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ background: 'var(--c-blue)', color: '#fff' }}>Automated Assessment</div>
        </div>
      </Section>

      {/* 09 - PHYSICAL MEASUREMENT */}
      <Section className="dark">
        <div className="mh-eyebrow">09 — PHYSICAL MEASUREMENT</div>
        <h2 className="mh-title">Digital & Physical</h2>
        
        <div className="mh-flow-diagram">
          <div className="mh-flow-node">DECLARED QUANTITY + ACTUAL MEASUREMENT</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">APPLICABLE TOLERANCE</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ borderColor: '#16a34a', color: '#16a34a' }}>AUTOMATED RESULT</div>
        </div>

        <div className="mh-tags">
          <span>Scale Integration</span>
          <span>Digital Caliper</span>
          <span>Depth/AR + OCR</span>
        </div>
      </Section>

      {/* 10 - OFFLINE-FIRST */}
      <Section>
        <div className="mh-eyebrow">10 — OFFLINE-FIRST</div>
        <h2 className="mh-title">Always Ready</h2>

        <div className="mh-flow-diagram">
          <div className="mh-flow-node">NETWORK LOST</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ background: '#f59e0b', color: '#fff', borderColor: 'transparent' }}>LOCAL QUEUE</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node">NETWORK RETURNS</div>
          <div className="mh-flow-arrow">↓</div>
          <div className="mh-flow-node" style={{ background: 'var(--c-blue)', color: '#fff', borderColor: 'transparent' }}>SYNC TO POSTGRESQL</div>
        </div>
      </Section>

      {/* 11 - INSPECTOR COMMAND CENTER */}
      <Section className="deep-blue">
        <div className="mh-eyebrow" style={{ color: '#93c5fd' }}>11 — COMMAND CENTER</div>
        <h2 className="mh-title">The Inspector<br/>Retains Authority</h2>

        <div className="mh-app-ui">
          <div className="mh-app-header">Inspection Report</div>
          <div className="mh-app-body">
            <div className="mh-evidence-row">
              <span style={{ color: '#111' }}>System Assessment</span>
              <span style={{ color: '#16a34a' }}>PASS</span>
            </div>
            <div className="mh-evidence-row">
              <span style={{ color: '#111' }}>Rule Details</span>
              <span style={{ color: '#111' }}>Rule 7 Evaluated</span>
            </div>
            <div className="mh-app-btn">APPROVE & RECORD</div>
          </div>
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section>
        <h2 className="mh-title">METRICHECK</h2>
        <p className="mh-subtitle" style={{ fontWeight: 800, letterSpacing: '0.1em' }}>
          SEE. VERIFY. DECIDE.
        </p>
        <button className="mh-cta-btn" onClick={onStart}>START INSPECTION</button>
      </Section>

    </div>
  );
}
