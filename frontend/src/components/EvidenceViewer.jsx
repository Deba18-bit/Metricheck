import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
function EvidenceViewer({ image, selected, checks, rawOcrBoxes = [], onSelect }) {
  const [showWhy, setShowWhy] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [imgSize, setImgSize] = useState(null);
  const [containerSize, setContainerSize] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    setImgSize(null);
  }, [image]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [selected]);

  const updateImgSize = (img) => {
    if (!img) return;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleImageLoad = (e) => {
    updateImgSize(e.target);
  };

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      updateImgSize(imgRef.current);
    }
  }, [image, selected]);

  let renderedW = 0, renderedH = 0, offsetX = 0, offsetY = 0;
  if (imgSize && containerSize) {
    const scaleX = containerSize.w / imgSize.w;
    const scaleY = containerSize.h / imgSize.h;
    
    // objectFit is 'contain'
    const scale = Math.min(scaleX, scaleY);

    renderedW = imgSize.w * scale;
    renderedH = imgSize.h * scale;
    offsetX = (containerSize.w - renderedW) / 2;
    offsetY = (containerSize.h - renderedH) / 2;
  }

  if (!selected) {
    return <div className="evidenceWrap">
      <div className="sectionTitle evidenceTitle">
        <span>No Results Found</span>
      </div>
    </div>;
  }

  return <div className="evidenceWrap">
    <div className="sectionTitle evidenceTitle">
      <span>Evidence Viewer</span>
      <small>Click a rule to highlight its OCR evidence</small>
    </div>
    <div className="viewer">
      <div className="viewerToolbar">
        <span><span className="greenDot" /> OCR BOUNDING BOXES</span>
        <button 
          onClick={() => setIsFullscreen(true)} 
          style={{ background: 'transparent', border: 'none', color: '#697589', cursor: 'pointer', padding: '4px', display: 'flex' }} 
          title="View full image size"
        >
          <Icon name="expand" size={16} />
        </button>
      </div>
      <div className="imageStage" ref={containerRef} style={{ position: 'relative' }}>
        {image ? (
          <div style={{ width: '100%', height: '100%', overflow: isFullscreen && zoom > 1 ? 'auto' : 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: '100%', height: '100%', position: 'relative', flex: '0 0 auto', transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}>
              <img 
                ref={imgRef}
                src={image} 
                alt="Package evidence" 
                onLoad={handleImageLoad}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            {imgSize && containerSize && (
              <div className="boxesLayer" style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                left: offsetX,
                top: offsetY,
                width: renderedW,
                height: renderedH,
                right: 'auto',
                bottom: 'auto',
                transition: 'transform 0.2s ease'
              }}>
                {/* Render raw OCR boxes behind compliance checks */}
                {rawOcrBoxes.map(box => <div key={box.id}
                  style={{
                    left: box.box.x + "%",
                    top: box.box.y + "%",
                    width: box.box.w + "%",
                    height: box.box.h + "%",
                    position: "absolute",
                    border: "1px dashed rgba(255, 255, 255, 0.25)",
                    pointerEvents: "none"
                  }}
                  title={box.text}
                />)}

                {checks.map(c => <button key={c.id} className={"ocrBox " + (selected && c.id === selected.id ? "focus " : "") + (c.status === "review" ? "reviewBox" : "")}
                  style={{ left: c.box.x + "%", top: c.box.y + "%", width: c.box.w + "%", height: c.box.h + "%" }}
                  onClick={() => onSelect(c.id)} title={c.evidence}>
                  <span>{selected && c.id === selected.id ? c.evidence : ""}</span>
                </button>)}
              </div>
            )}
            </div>
          </div>
        ) : <div className="imagePlaceholder"><Icon name="file" size={42} /></div>}
      </div>
    </div>

    <div className="evidenceDetail">
      <div className="detailTop"><div><span className={"miniStatus " + selected.status}>{selected.status === "verified" ? "✓" : "!"}</span><strong>{selected.label}</strong></div><button onClick={() => setShowWhy(v => !v)}><Icon name="info" size={16} /> Why was this result produced?</button></div>
      <div className="evidenceQuote">“{selected.evidence}”</div>
      <div className="detailGrid">
        <div><label>CONFIDENCE</label><strong>{selected.confidence}%</strong></div>
        <div>
          <label>PROVENANCE</label>
          <strong style={{ color: selected.confidence > 90 ? '#166534' : '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {selected.confidence > 90 ? 'LOCAL YOLO11n' : 'GEMINI RECOVERY'}
          </strong>
        </div>
        <div><label>RULE</label><strong>{selected.rule}</strong></div>
        <div><label>DECISION</label><strong className={selected.status}>{selected.backendStatus}</strong></div>
      </div>
      {showWhy && <div className="whyBox">
        <div className="whyTitle"><Icon name="info" size={17} /> Explainability</div>
        <div className="whyRows">
          <div><span>Rule</span><b>{selected.rule}</b></div>
          <div><span>Requirement</span><b>{selected.requirement}</b></div>
          <div><span>Detected evidence</span><b>“{selected.evidence}”</b></div>
          <div><span>OCR confidence</span><b>{selected.confidence}%</b></div>
          <div><span>Evidence location</span><b>[{Math.round(selected.box.x)}, {Math.round(selected.box.y)}, {Math.round(selected.box.w)}, {Math.round(selected.box.h)}]</b></div>
          <div><span>Decision</span><b className={selected.status}>{selected.backendStatus}</b></div>
        </div>
      </div>}
    </div>

    {isFullscreen && (
      <div className="floatingLightbox" onClick={() => setIsFullscreen(false)}>
        <div className="floatingLightboxContent" onClick={e => e.stopPropagation()}>
          <button className="floatingLightboxClose" onClick={() => setIsFullscreen(false)}>
            <Icon name="x" size={32} />
          </button>
          {image && (
            <div style={{ 
              position: 'relative', 
              width: (window.Capacitor && window.Capacitor.isNativePlatform() && imgSize?.w) ? Math.min(imgSize.w, window.innerWidth * 2.5) : (imgSize?.w || 'auto'), 
              height: 'auto' 
            }}>
              <img 
                src={image} 
                style={{ display: 'block', width: '100%', height: 'auto' }} 
                alt="Full size evidence" 
              />
              {imgSize && (
                <div className="boxesLayer" style={{ left: 0, top: 0, width: '100%', height: '100%', right: 'auto', bottom: 'auto' }}>
                  {rawOcrBoxes.map(box => <div key={box.id}
                    style={{
                      left: box.box.x + "%",
                      top: box.box.y + "%",
                      width: box.box.w + "%",
                      height: box.box.h + "%",
                      position: "absolute",
                      border: "1px dashed rgba(255, 255, 255, 0.4)",
                      pointerEvents: "none"
                    }}
                    title={box.text}
                  />)}

                  {checks.map(c => <button key={c.id} className={"ocrBox " + (selected && c.id === selected.id ? "focus " : "") + (c.status === "review" ? "reviewBox" : "")}
                    style={{ left: c.box.x + "%", top: c.box.y + "%", width: c.box.w + "%", height: c.box.h + "%" }}
                    onClick={() => { onSelect(c.id); setIsFullscreen(false); }} title={c.evidence}>
                    <span>{selected && c.id === selected.id ? c.evidence : ""}</span>
                  </button>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
}
export default EvidenceViewer;
