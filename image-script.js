document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const modeSelect = document.getElementById("mode-select");
  const imageWidthInput = document.getElementById("image-width");
  const previewCanvas = document.getElementById("preview-canvas");
  const ctx = previewCanvas.getContext("2d");
  const generateBtn = document.getElementById("generate-btn");
  const downloadBtn = document.getElementById("download-btn");
  const statsDisplay = document.getElementById("stats-display");
  const pathCount = document.getElementById("path-count");
  const tooltip = document.getElementById("tooltip");

  // Mode-specific settings elements
  const edgeSettings = document.getElementById("edges-settings");
  const hatchingSettings = document.getElementById("hatching-settings");
  const stipplingSettings = document.getElementById("stippling-settings");
  
  const edgeThreshold = document.getElementById("edge-threshold");
  const edgeThresholdValue = document.getElementById("edge-threshold-value");
  const hatchSpacing = document.getElementById("hatch-spacing");
  const hatchAngle = document.getElementById("hatch-angle");
  const stippleDensity = document.getElementById("stipple-density");
  const stippleDensityValue = document.getElementById("stipple-density-value");
  const stippleSize = document.getElementById("stipple-size");

  // G-Code inputs
  const inputZDown = document.getElementById("z-down");
  const inputZUp = document.getElementById("z-up");
  const inputFeedRate = document.getElementById("feed-rate");
  const inputTravelRate = document.getElementById("travel-rate");

  // --- State ---
  let generatedGCode = "";
  let imagePolylines = [];
  let uploadedImage = null;

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

  // Mode selection
  modeSelect.addEventListener("change", () => {
    updateModeSettings();
    if (uploadedImage) processImage();
  });

  // Settings changes
  [edgeThreshold, imageWidthInput, hatchSpacing, hatchAngle, stippleDensity, stippleSize].forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        if (input === edgeThreshold) edgeThresholdValue.textContent = input.value;
        if (input === stippleDensity) stippleDensityValue.textContent = input.value;
        if (uploadedImage) processImage();
      });
    }
  });

  generateBtn.addEventListener("click", generateGCode);
  downloadBtn.addEventListener("click", downloadGCode);

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

  function updateModeSettings() {
    edgeSettings.style.display = "none";
    hatchingSettings.style.display = "none";
    stipplingSettings.style.display = "none";

    const mode = modeSelect.value;
    if (mode === "edges") edgeSettings.style.display = "block";
    else if (mode === "hatching") hatchingSettings.style.display = "block";
    else if (mode === "stippling") stipplingSettings.style.display = "block";
  }

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Bitte nur Bilddateien hochladen (JPG, PNG, etc.)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        uploadedImage = img;
        processImage();
        const dropZoneText = dropZone.querySelector("p");
        if (dropZoneText) dropZoneText.innerText = "Bild geladen! ✓";
        generateBtn.disabled = false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function processImage() {
    if (!uploadedImage) return;

    const mode = modeSelect.value;
    const targetWidth = parseFloat(imageWidthInput.value) || 100;

    // Create a temporary canvas to process the image
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    // Scale image to reasonable size for processing
    const maxDim = 400;
    const scale = Math.min(maxDim / uploadedImage.width, maxDim / uploadedImage.height);
    tempCanvas.width = uploadedImage.width * scale;
    tempCanvas.height = uploadedImage.height * scale;
    tempCtx.drawImage(uploadedImage, 0, 0, tempCanvas.width, tempCanvas.height);

    // Get image data
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    // Process based on mode
    if (mode === "edges") {
      imagePolylines = processEdges(imageData, targetWidth);
    } else if (mode === "hatching") {
      imagePolylines = processHatching(imageData, targetWidth);
    } else if (mode === "stippling") {
      imagePolylines = processStippling(imageData, targetWidth);
    }

    drawPreview();
  }

  function processEdges(imageData, targetWidth) {
    const threshold = parseFloat(edgeThreshold.value) || 50;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Convert to grayscale
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Sobel edge detection
    const edges = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Sobel kernels
        const gx = 
          -gray[(y-1)*width + (x-1)] - 2*gray[y*width + (x-1)] - gray[(y+1)*width + (x-1)] +
           gray[(y-1)*width + (x+1)] + 2*gray[y*width + (x+1)] + gray[(y+1)*width + (x+1)];
        
        const gy = 
          -gray[(y-1)*width + (x-1)] - 2*gray[(y-1)*width + x] - gray[(y-1)*width + (x+1)] +
           gray[(y+1)*width + (x-1)] + 2*gray[(y+1)*width + x] + gray[(y+1)*width + (x+1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = magnitude > threshold ? 255 : 0;
      }
    }

    // Convert edges to polylines
    const polylines = [];
    const scale = targetWidth / width;

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const idx = y * width + x;
        if (edges[idx] > 0) {
          // Create a small line segment for each edge pixel
          polylines.push([
            { x: x * scale, y: y * scale },
            { x: (x + 1) * scale, y: (y + 1) * scale }
          ]);
        }
      }
    }

    return polylines;
  }

  function processHatching(imageData, targetWidth) {
    const spacing = parseFloat(hatchSpacing.value) || 2;
    const angle = (parseFloat(hatchAngle.value) || 45) * Math.PI / 180;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Convert to grayscale
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const polylines = [];
    const scale = targetWidth / width;
    const scaledSpacing = spacing / scale;

    // Draw hatching lines
    for (let offset = 0; offset < width + height; offset += scaledSpacing) {
      const line = [];
      
      for (let d = 0; d < width + height; d++) {
        const x = Math.round(offset + d * Math.cos(angle));
        const y = Math.round(d * Math.sin(angle));
        
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = y * width + x;
          const brightness = gray[idx];
          
          // Only draw in dark areas
          if (brightness < 128) {
            line.push({ x: x * scale, y: y * scale });
          } else if (line.length > 0) {
            if (line.length > 2) polylines.push([...line]);
            line.length = 0;
          }
        }
      }
      
      if (line.length > 2) polylines.push(line);
    }

    return polylines;
  }

  function processStippling(imageData, targetWidth) {
    const density = parseFloat(stippleDensity.value) || 5;
    const dotSize = parseFloat(stippleSize.value) || 0.5;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Convert to grayscale
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const polylines = [];
    const scale = targetWidth / width;
    const gridSize = Math.max(2, Math.floor(10 / density));

    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        const idx = y * width + x;
        const brightness = gray[idx];
        
        // Probability of placing a dot based on darkness
        const prob = (255 - brightness) / 255;
        if (Math.random() < prob * (density / 5)) {
          // Create a small circle (approximated by 4 line segments)
          const cx = x * scale;
          const cy = y * scale;
          const r = dotSize / 2;
          
          polylines.push([
            { x: cx + r, y: cy },
            { x: cx, y: cy + r },
            { x: cx - r, y: cy },
            { x: cx, y: cy - r },
            { x: cx + r, y: cy }
          ]);
        }
      }
    }

    return polylines;
  }

  function drawPreview() {
    if (!previewCanvas) return;

    const container = previewCanvas.parentElement;
    previewCanvas.width = container.clientWidth;
    previewCanvas.height = 500;

    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (imagePolylines.length === 0) return;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    imagePolylines.forEach(poly => {
      poly.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    const margin = 20;
    const width = maxX - minX;
    const height = maxY - minY;
    const scaleX = (previewCanvas.width - margin * 2) / (width || 1);
    const scaleY = (previewCanvas.height - margin * 2) / (height || 1);
    const scale = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.translate(margin, margin);
    ctx.scale(scale, scale);
    ctx.translate(-minX, -minY);

    // Draw all paths
    ctx.strokeStyle = "#03dac6";
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    
    imagePolylines.forEach(poly => {
      if (poly.length > 0) {
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x, poly[i].y);
        }
      }
    });
    
    ctx.stroke();
    ctx.restore();

    statsDisplay.style.display = "flex";
    pathCount.textContent = `${imagePolylines.length} Pfade`;
  }

  function generateGCode() {
    if (imagePolylines.length === 0) {
      alert("Kein Bild verarbeitet!");
      return;
    }

    const zDown = inputZDown.value;
    const zUp = inputZUp.value;
    const feedRate = inputFeedRate.value;
    const travelRate = inputTravelRate.value;

    let code = [];
    code.push("; Generated by Image to G-Code Converter");
    code.push(`; Mode: ${modeSelect.options[modeSelect.selectedIndex].text}`);
    code.push("G28 ; Home all axes");
    code.push("G90 ; Absolute positioning");
    code.push("G21 ; Millimeter units");
    code.push(`G0 F${travelRate} ; Set travel speed`);
    code.push(`G0 Z${zUp}`);

    imagePolylines.forEach((poly) => {
      if (poly.length === 0) return;

      const start = poly[0];
      code.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);
      code.push(`G1 Z${zDown} F300`);
      code.push(`G1 F${feedRate}`);
      
      for (let i = 1; i < poly.length; i++) {
        const p = poly[i];
        code.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`);
      }

      code.push(`G0 Z${zUp} F${travelRate}`);
    });

    code.push("G0 Z10");
    code.push("G28 X0 Y0");
    code.push("M84");

    generatedGCode = code.join("\n");
    downloadBtn.disabled = false;

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
    a.download = "image-drawing.gcode";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Initialize
  updateModeSettings();
});
