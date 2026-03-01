document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const previewCanvas = document.getElementById("preview-canvas");
  const ctx = previewCanvas.getContext("2d");
  const generateBtn = document.getElementById("generate-btn");
  const downloadBtn = document.getElementById("download-btn");
  const statsDisplay = document.getElementById("stats-display");
  const tooltip = document.getElementById("tooltip");
  const loadingOverlay = document.getElementById("loading-overlay");
  const rotationInput = document.getElementById("rotation");
  const showTravelCheckbox = document.getElementById("show-travel");

  // Inputs
  const inputZDown = document.getElementById("z-down");
  const inputZUp = document.getElementById("z-up");
  const inputFeedRate = document.getElementById("feed-rate");
  const inputTravelRate = document.getElementById("travel-rate");
  const inputScale = document.getElementById("scale");
  const inputOffsetX = document.getElementById("x-offset");
  const inputOffsetY = document.getElementById("y-offset");
  const startGcodeArea = document.getElementById("start-gcode");
  const endGcodeArea = document.getElementById("end-gcode");

  // --- State ---
  let svgPolylines = []; // Array of arrays of points {x, y}
  let scaledPolylines = [];
  let generatedGCode = "";
  let svgDimensions = { width: 0, height: 0 };
  let bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  // --- Event Listeners ---

  // File Upload
  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
  });

  // Generation
  generateBtn.addEventListener("click", generateGCode);
  downloadBtn.addEventListener("click", downloadGCode);

  // Live Preview Update on Settings Change
  [inputScale, rotationInput].forEach((input) => {
    input.addEventListener("input", updatePreview);
  });

  showTravelCheckbox.addEventListener("change", drawPreview);

  [inputOffsetX, inputOffsetY].forEach(input => {
    input.addEventListener("input", drawPreview);
  });

  // Drag and Drop Logic
  let isDragging = false;
  let dragStartX, dragStartY;
  let offsetXStart, offsetYStart;

  previewCanvas.addEventListener("mousedown", (e) => {
    if (svgPolylines.length === 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    offsetXStart = parseFloat(inputOffsetX.value) || 0;
    offsetYStart = parseFloat(inputOffsetY.value) || 0;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    const BED_W = 235;
    const BED_H = 235;
    const margin = 20;

    const canvasObjWidth = previewCanvas.offsetWidth;
    const canvasObjHeight = previewCanvas.offsetHeight;

    const usableW = canvasObjWidth - 2 * margin;
    const usableH = canvasObjHeight - 2 * margin;
    
    const scaleX = usableW / BED_W;
    const scaleY = usableH / BED_H;
    
    const dxMm = dx / scaleX;
    const dyMm = dy / scaleY;
    
    const newOffsetX = offsetXStart + dxMm;
    const newOffsetY = offsetYStart - dyMm;
    
    inputOffsetX.value = newOffsetX.toFixed(1);
    inputOffsetY.value = newOffsetY.toFixed(1);
    
    drawPreview();
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // Tooltips
  document.querySelectorAll(".tooltip-icon").forEach((icon) => {
    icon.addEventListener("mouseenter", (e) => {
      const text = e.currentTarget.getAttribute("data-tooltip");
      tooltip.innerText = text;
      tooltip.style.opacity = "1";
      positionTooltip(e, tooltip);
    });
    icon.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
    });
  });

  function positionTooltip(e, tooltipElement) {
    const rect = e.currentTarget.getBoundingClientRect();
    tooltipElement.style.top = rect.top - 40 + "px";
    tooltipElement.style.left = rect.left + 20 + "px";
  }

  // --- Core Logic ---

  function handleFile(file) {
    // Relaxed check: accepts svg type OR extension
    if (
      file.type.indexOf("svg") === -1 &&
      !file.name.toLowerCase().endsWith(".svg")
    ) {
      alert("Dateityp wird nicht erkannt. Bitte eine .svg Datei verwenden.");
      return;
    }

    const reader = new FileReader();
    loadingOverlay.style.display = "flex";
    reader.onload = (e) => {
      try {
        parseSVG(e.target.result);
        loadingOverlay.style.display = "none";
        // Reset input so same file can be selected again
        fileInput.value = "";
      } catch (err) {
        loadingOverlay.style.display = "none";
        alert("Fehler beim Lesen der SVG: " + err.message);
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  function parseSVG(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) {
      alert("Datei enthält keinen gültigen SVG-Code.");
      return;
    }

    // Check for parser errors
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      alert("Die SVG-Datei ist beschädigt oder fehlerhaft.");
      return;
    }

    // Create a hidden container to append SVG so we can use getCTM and getPointAtLength
    const hiddenContainer = document.createElement("div");
    // DO NOT use visibility: hidden here, as it inherits to children and breaks our check below
    hiddenContainer.style.position = "absolute";
    hiddenContainer.style.left = "-9999px";
    hiddenContainer.style.top = "-9999px";
    hiddenContainer.style.width = "1px";
    hiddenContainer.style.height = "1px";
    hiddenContainer.style.overflow = "hidden";
    document.body.appendChild(hiddenContainer);
    hiddenContainer.appendChild(svgElement);

    // Get dimensions
    let width =
      svgElement.viewBox.baseVal.width ||
      parseFloat(svgElement.getAttribute("width")) ||
      100;
    let height =
      svgElement.viewBox.baseVal.height ||
      parseFloat(svgElement.getAttribute("height")) ||
      100;
    svgDimensions = { width, height };

    // Process all shape elements
    svgPolylines = [];
    const selector = "path, rect, circle, ellipse, line, polyline, polygon";
    const elements = svgElement.querySelectorAll(selector);

    // Diagnostic checks - Define them here so they are available for error reporting
    const textElements = svgElement.querySelectorAll('text, tspan');
    const imageElements = svgElement.querySelectorAll('image');
    const useElements = svgElement.querySelectorAll('use');

    console.log(`Gefundene Elemente: ${elements.length}`);

    elements.forEach((el) => {
      // Check if element is inside <defs>, <symbol>, or <clipPath> - we should ignore these
      if (el.closest('defs') || el.closest('symbol') || el.closest('clipPath')) return;

      // Check visibility style
      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      )
        return;

      const length = el.getTotalLength();
      if (length === 0) return;

      const points = [];
      // Sampling resolution
      const step = 0.5;
      for (let i = 0; i <= length; i += step) {
        points.push(getTransformedPoint(el, i));
      }
      points.push(getTransformedPoint(el, length));

      svgPolylines.push(points);
    });

    // Cleanup
    document.body.removeChild(hiddenContainer);

    if (svgPolylines.length === 0) {
      let msg = "Keine zeichenbaren Pfade gefunden.\n\nDiagnose:\n";
      
      if (textElements.length > 0) {
          msg += `- ⚠️ ${textElements.length} Text-Elemente gefunden (Nicht unterstützt!)\n  -> Bitte in deinem Zeichenprogramm "Text in Pfad umwandeln" nutzen.\n`;
      }
      if (imageElements.length > 0) {
          msg += `- ⚠️ ${imageElements.length} Bilder gefunden (Nicht unterstützt!)\n  -> Nur Vektoren können geplottet werden.\n`;
      }
      if (useElements.length > 0) {
        msg += `- ⚠️ ${useElements.length} 'Use'-Elemente gefunden (Kopien/Klone)\n  -> Bitte im Zeichenprogramm "Klone lösen" oder "Gruppen aufheben".\n`;
      }
      
      
      // Detailed diagnostics: List ALL tags found
      const allTags = new Set();
      svgElement.querySelectorAll('*').forEach(node => allTags.add(node.tagName));
      const tagList = Array.from(allTags).join(', ');

      if (textElements.length === 0 && imageElements.length === 0) {
          msg += `- Keine bekannten Formen (Pfad, Rechteck, Kreis...) gefunden.\n`;
          msg += `- Gefundene Elemente in der Datei: [${tagList}]\n`;
          msg += `\nHINWEIS: Wenn du Text siehst, muss dieser in "Pfade" umgewandelt werden (Strg+Shift+C in Inkscape).`;
      }

      alert(msg);
      return;
    }

    calculateBounds();
    generateBtn.disabled = false;

    // Show success feedback
    const dropZoneText = dropZone.querySelector("p");
    if (dropZoneText) dropZoneText.innerText = "Datei geladen! ✓";

    updatePreview();
  }

  function getTransformedPoint(element, distance) {
    let pt = element.getPointAtLength(distance);

    // Apply CTM (Current Transformation Matrix) to get coordinates in SVG root space
    // Note: We want the matrix relative to the SVG root, not screen.
    // However, element.getCTM() usually returns matrix relative to viewport.
    // If we extracted paths nicely, this works.

    const ctm = element.getCTM();
    if (ctm) {
      return {
        x: pt.x * ctm.a + pt.y * ctm.c + ctm.e,
        y: pt.x * ctm.b + pt.y * ctm.d + ctm.f,
      };
    }
    return { x: pt.x, y: pt.y };
  }

  function calculateBounds() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    if (svgPolylines.length === 0) {
      bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      return;
    }

    svgPolylines.forEach((poly) => {
      poly.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    bounds = { minX, minY, maxX, maxY };
  }

  function updatePreview() {
    if (svgPolylines.length === 0) return;
    
    loadingOverlay.style.display = "flex";

    setTimeout(() => {
        const scalePercent = parseFloat(inputScale.value) || 100;
        const scaleFactor = scalePercent / 100;

        scaledPolylines = svgPolylines.map((poly) => {
          return poly.map((p) => ({
            x: (p.x - bounds.minX) * scaleFactor, // Shift to 0,0 locally then scale
            y: (p.y - bounds.minY) * scaleFactor,
          }));
        });

        // --- APPLY ROTATION ---
        const rotationDeg = parseFloat(rotationInput.value) || 0;
        if (rotationDeg !== 0) {
            const angle = (rotationDeg * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            // Scaled bounds for center calculation
            const sWidth = (bounds.maxX - bounds.minX) * scaleFactor;
            const sHeight = (bounds.maxY - bounds.minY) * scaleFactor;
            const cx = sWidth / 2;
            const cy = sHeight / 2;

            scaledPolylines = scaledPolylines.map(poly => {
                return poly.map(p => {
                    const dx = p.x - cx;
                    const dy = p.y - cy;
                    return {
                        x: cx + dx * cos - dy * sin,
                        y: cy + dx * sin + dy * cos
                    };
                });
            });
        }

        drawPreview();
        loadingOverlay.style.display = "none";
    }, 10);
  }

  function drawPreview() {
    if (!previewCanvas) return;

    const container = previewCanvas.parentElement;
    
    // Square Canvas for 235x235mm bed
    const size = Math.min(container.clientWidth, 600);
    previewCanvas.width = size;
    previewCanvas.height = size;

    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    const BED_W = 235;
    const BED_H = 235;
    const margin = 20;
    
    const usableW = previewCanvas.width - 2 * margin;
    const usableH = previewCanvas.height - 2 * margin;
    
    // Draw Bed Grid (every 50mm)
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const scaleX = usableW / BED_W;
    const scaleY = usableH / BED_H;

    for (let i = 0; i <= BED_W; i += 50) {
      const x = margin + i * scaleX;
      ctx.moveTo(x, margin);
      ctx.lineTo(x, previewCanvas.height - margin);
    }
    for (let j = 0; j <= BED_H; j += 50) {
      const y = previewCanvas.height - margin - j * scaleY;
      ctx.moveTo(margin, y);
      ctx.lineTo(previewCanvas.width - margin, y);
    }
    ctx.stroke();
    
    ctx.fillStyle = "#666";
    ctx.font = "14px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Vorne (Ender 3)", previewCanvas.width / 2, previewCanvas.height - 5);

    if (scaledPolylines.length === 0) return;

    const offsetX = parseFloat(inputOffsetX.value) || 0;
    const offsetY = parseFloat(inputOffsetY.value) || 0;

    function bedToCanvas(pX, pY) {
        return {
            x: margin + (pX + offsetX) * scaleX,
            y: previewCanvas.height - margin - (pY + offsetY) * scaleY
        };
    }

    // Draw Travel Moves (Red)
    if (showTravelCheckbox.checked) {
        ctx.beginPath();
        ctx.strokeStyle = "#cf6679";
        ctx.lineWidth = 1;

        let currentPos = { x: 0, y: 0 };
        scaledPolylines.forEach((poly) => {
          if (poly.length === 0) return;
          const canvasFrom = bedToCanvas(currentPos.x - offsetX, currentPos.y - offsetY);
          const canvasTo = bedToCanvas(poly[0].x, poly[0].y);
          ctx.moveTo(canvasFrom.x, canvasFrom.y);
          ctx.lineTo(canvasTo.x, canvasTo.y);
          currentPos = { x: poly[poly.length - 1].x + offsetX, y: poly[poly.length - 1].y + offsetY };
        });
        ctx.stroke();
    }

    // Draw Print Moves (Cyan)
    ctx.beginPath();
    ctx.strokeStyle = "#03dac6";
    ctx.lineWidth = 2;

    scaledPolylines.forEach((poly) => {
      if (poly.length === 0) return;
      const start = bedToCanvas(poly[0].x, poly[0].y);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < poly.length; i++) {
        const pt = bedToCanvas(poly[i].x, poly[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
    });
    ctx.stroke();

    statsDisplay.style.display = "flex";
  }

  function generateGCode() {
    if (scaledPolylines.length === 0) return;

    const zDown = inputZDown.value;
    const zUp = inputZUp.value;
    const feedRate = inputFeedRate.value;
    const travelRate = inputTravelRate.value;
    const offsetX = parseFloat(inputOffsetX.value) || 0;
    const offsetY = parseFloat(inputOffsetY.value) || 0;
    const startCode = startGcodeArea.value;
    const endCode = endGcodeArea.value;

    let code = [];
    code.push("; Generated by SVG to G-Code Converter");
    code.push("; Scale: " + inputScale.value + "%");
    code.push(startCode);
    code.push(`G0 F${travelRate} ; Set travel speed`);

    // Ensure pen is up initially
    code.push(`G0 Z${zUp}`);

    scaledPolylines.forEach((poly) => {
      if (poly.length === 0) return;

      // 1. Move to start point (Pen Up)
      const start = poly[0];
      code.push(`G0 X${(start.x + offsetX).toFixed(3)} Y${(start.y + offsetY).toFixed(3)}`);

      // 2. Lower Pen
      code.push(`G1 Z${zDown} F300`); // Lowering z slowly

      // 3. Draw Path
      code.push(`G1 F${feedRate} ; Set print speed`);
      for (let i = 1; i < poly.length; i++) {
        const p = poly[i];
        code.push(`G1 X${(p.x + offsetX).toFixed(3)} Y${(p.y + offsetY).toFixed(3)}`);
      }

      // 4. Raise Pen
      code.push(`G0 Z${zUp} F${travelRate}`);
    });

    code.push(endCode);
    generatedGCode = code.join("\n");

    downloadBtn.disabled = false;

    // Simple visual feedback
    generateBtn.innerHTML = '<i class="fas fa-check"></i> Generiert!';
    setTimeout(() => {
      generateBtn.innerHTML = '<i class="fas fa-cogs"></i> G-Code Generieren';
    }, 2000);
  }

  function downloadGCode() {
    if (!generatedGCode) return;

    const blob = new Blob([generatedGCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawing.gcode";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});
