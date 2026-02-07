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

  // Inputs
  const inputZDown = document.getElementById("z-down");
  const inputZUp = document.getElementById("z-up");
  const inputFeedRate = document.getElementById("feed-rate");
  const inputTravelRate = document.getElementById("travel-rate");
  const inputScale = document.getElementById("scale");
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
  [inputScale].forEach((input) => {
    input.addEventListener("input", updatePreview);
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
    reader.onload = (e) => {
      try {
        parseSVG(e.target.result);
        // Reset input so same file can be selected again
        fileInput.value = "";
      } catch (err) {
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

    const scalePercent = parseFloat(inputScale.value) || 100;
    const scaleFactor = scalePercent / 100;

    // Apply Scaling to create display polylines
    // We also want to center it or keep it at origin?
    // Usually, 3D printers expect (0,0) at bottom-leading corner.
    // SVGs often have (0,0) at top-left.
    // We will flip Y axis if needed? No, standard 2D plotters usually work in 2D plane X,Y.
    // BUT, if we want to visualize it on screen (Y down) vs printer (Y up usually?).
    // Actually Ender 3 treats Y+ as back, X+ as right. (0,0) is front-left.
    // Screen (0,0) is top-left.
    // Let's keep screen coordinates for preview for simplicity, assuming user drawing is "upright".

    // Prepare scaled paths for G-Code generation AND preview
    scaledPolylines = svgPolylines.map((poly) => {
      return poly.map((p) => ({
        x: (p.x - bounds.minX) * scaleFactor, // Shift to 0,0 locally then scale
        y: (p.y - bounds.minY) * scaleFactor,
      }));
    });

    drawPreview();
  }

  function drawPreview() {
    if (!previewCanvas) return;

    // Resize canvas to fit container but keep aspect ratio of bounding box
    const container = previewCanvas.parentElement;
    const margin = 20;

    // Calculate aspect ratios
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const aspect = width / height || 1;

    // Set canvas resolution
    previewCanvas.width = container.clientWidth;
    previewCanvas.height = container.clientWidth / aspect;
    if (previewCanvas.height > 500) previewCanvas.height = 500; // Cap height

    // Fit scaledPolylines into canvas view
    // Create a transform to fit the [0, maxW] x [0, maxH] into canvas with padding
    const ctxW = previewCanvas.width;
    const ctxH = previewCanvas.height;

    // Find max dimension in scaled data
    let maxPolyX = -Infinity,
      maxPolyY = -Infinity;
    scaledPolylines.forEach((poly) => {
      poly.forEach((p) => {
        if (p.x > maxPolyX) maxPolyX = p.x;
        if (p.y > maxPolyY) maxPolyY = p.y;
      });
    });

    const scaleX = (ctxW - margin * 2) / (maxPolyX || 1);
    const scaleY = (ctxH - margin * 2) / (maxPolyY || 1);
    const viewScale = Math.min(scaleX, scaleY);

    ctx.clearRect(0, 0, ctxW, ctxH);

    // Draw Origin Indicator
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, ctxW, ctxH);

    // Grid
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 0.5;
    // ... simple grid ...

    // Translate to center/margin
    ctx.save();
    ctx.translate(margin, margin);
    ctx.scale(viewScale, viewScale);

    // Draw Travel Moves (Red) - From End of prev path to Start of next
    ctx.beginPath();
    ctx.strokeStyle = "#cf6679"; // Travel color
    ctx.lineWidth = 1 / viewScale; // Keep line constant width

    // Assume starting at 0,0
    let currentPos = { x: 0, y: 0 };

    scaledPolylines.forEach((poly, index) => {
      if (poly.length === 0) return;
      // Travel to start
      ctx.moveTo(currentPos.x, currentPos.y);
      ctx.lineTo(poly[0].x, poly[0].y);
      currentPos = poly[poly.length - 1];
    });
    ctx.stroke();

    // Draw Print Moves (Blue/Cyan)
    ctx.beginPath();
    ctx.strokeStyle = "#03dac6"; // Write color
    ctx.lineWidth = 2 / viewScale;

    scaledPolylines.forEach((poly) => {
      if (poly.length === 0) return;
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
    });
    ctx.stroke();

    ctx.restore();

    // Update stats
    statsDisplay.style.display = "flex";
  }

  function generateGCode() {
    if (scaledPolylines.length === 0) return;

    const zDown = inputZDown.value;
    const zUp = inputZUp.value;
    const feedRate = inputFeedRate.value;
    const travelRate = inputTravelRate.value;
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
      code.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);

      // 2. Lower Pen
      code.push(`G1 Z${zDown} F300`); // Lowering z slowly

      // 3. Draw Path
      code.push(`G1 F${feedRate} ; Set print speed`);
      for (let i = 1; i < poly.length; i++) {
        const p = poly[i];
        code.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`);
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
