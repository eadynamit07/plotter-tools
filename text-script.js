document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const textInput = document.getElementById("text-input");
  const fontSelect = document.getElementById("font-select");
  const fontSizeInput = document.getElementById("font-size");
  const lineSpacingInput = document.getElementById("line-spacing");
  const lineWidthInput = document.getElementById("line-width");
  const previewCanvas = document.getElementById("preview-canvas");
  const ctx = previewCanvas.getContext("2d");
  const generateBtn = document.getElementById("generate-btn");
  const downloadBtn = document.getElementById("download-btn");
  const statsDisplay = document.getElementById("stats-display");
  const tooltip = document.getElementById("tooltip");

  // G-Code inputs
  const inputZDown = document.getElementById("z-down");
  const inputZUp = document.getElementById("z-up");
  const inputFeedRate = document.getElementById("feed-rate");
  const inputTravelRate = document.getElementById("travel-rate");

  // --- State ---
  let generatedGCode = "";
  let textPolylines = []; // Array of polylines for the text

  // --- Multiple Font Definitions ---
  // SIMPLEX - Simple, clean font
  const fontSimplex = {
    'A': [[0,1, 0.5,0, 1,1], [0.25,0.6, 0.75,0.6]],
    'B': [[0,0, 0,1], [0,0, 0.7,0, 0.7,0.45], [0,0.45, 0.7,0.45, 0.7,1, 0,1]],
    'C': [[1,0.2, 0.8,0, 0.2,0, 0,0.2, 0,0.8, 0.2,1, 0.8,1, 1,0.8]],
    'D': [[0,0, 0,1], [0,0, 0.6,0.1, 0.7,0.3, 0.7,0.7, 0.6,0.9, 0,1]],
    'E': [[1,0, 0,0, 0,1, 1,1], [0,0.5, 0.6,0.5]],
    'F': [[1,0, 0,0, 0,1], [0,0.5, 0.6,0.5]],
    'G': [[1,0.2, 0.8,0, 0.2,0, 0,0.2, 0,0.8, 0.2,1, 0.8,1, 1,0.8, 1,0.5, 0.5,0.5]],
    'H': [[0,0, 0,1], [1,0, 1,1], [0,0.5, 1,0.5]],
    'I': [[0.3,0, 0.7,0], [0.5,0, 0.5,1], [0.3,1, 0.7,1]],
    'J': [[0.7,0, 0.7,0.8, 0.5,1, 0.2,0.9, 0.1,0.7]],
    'K': [[0,0, 0,1], [0.8,0, 0,0.5], [0.4,0.6, 1,1]],
    'L': [[0,0, 0,1, 1,1]],
    'M': [[0,1, 0,0, 0.5,0.4, 1,0, 1,1]],
    'N': [[0,1, 0,0, 1,1, 1,0]],
    'O': [[0.2,0, 0.8,0, 1,0.2, 1,0.8, 0.8,1, 0.2,1, 0,0.8, 0,0.2, 0.2,0]],
    'P': [[0,1, 0,0, 0.7,0, 0.8,0.1, 0.8,0.4, 0.7,0.5, 0,0.5]],
    'Q': [[0.2,0, 0.8,0, 1,0.2, 1,0.8, 0.8,1, 0.2,1, 0,0.8, 0,0.2, 0.2,0], [0.6,0.7, 1.1,1.1]],
    'R': [[0,1, 0,0, 0.7,0, 0.8,0.1, 0.8,0.4, 0.7,0.5, 0,0.5], [0.5,0.5, 1,1]],
    'S': [[0.9,0.2, 0.7,0, 0.3,0, 0.1,0.2, 0.2,0.4, 0.8,0.5, 0.9,0.6, 0.9,0.8, 0.7,1, 0.3,1, 0.1,0.8]],
    'T': [[0,0, 1,0], [0.5,0, 0.5,1]],
    'U': [[0,0, 0,0.8, 0.2,1, 0.8,1, 1,0.8, 1,0]],
    'V': [[0,0, 0.5,1, 1,0]],
    'W': [[0,0, 0.2,1, 0.5,0.6, 0.8,1, 1,0]],
    'X': [[0,0, 1,1], [1,0, 0,1]],
    'Y': [[0,0, 0.5,0.5], [1,0, 0.5,0.5], [0.5,0.5, 0.5,1]],
    'Z': [[0,0, 1,0, 0,1, 1,1]],
    'Ä': [[0,1, 0.5,0, 1,1], [0.25,0.6, 0.75,0.6], [0.3,-0.2, 0.3,-0.15], [0.7,-0.2, 0.7,-0.15]],
    'Ö': [[0.2,0, 0.8,0, 1,0.2, 1,0.8, 0.8,1, 0.2,1, 0,0.8, 0,0.2, 0.2,0], [0.3,-0.2, 0.3,-0.15], [0.7,-0.2, 0.7,-0.15]],
    'Ü': [[0,0, 0,0.8, 0.2,1, 0.8,1, 1,0.8, 1,0], [0.3,-0.2, 0.3,-0.15], [0.7,-0.2, 0.7,-0.15]],
    'ß': [[0,0, 0,0.7, 0.1,0.85, 0.3,0.9, 0.5,0.85, 0.6,0.7, 0.6,0.5, 0.5,0.4, 0.7,0.3, 0.8,0.5, 0.7,0.7, 0.5,1, 0.3,0.9]],
    ' ': [],
    '!': [[0.5,0, 0.5,0.6], [0.5,0.75, 0.5,0.8]],
    '?': [[0.2,0.2, 0.3,0, 0.7,0, 0.8,0.2, 0.8,0.4, 0.5,0.6], [0.5,0.75, 0.5,0.8]],
    '.': [[0.5,0.85, 0.5,0.9]],
    ',': [[0.5,0.85, 0.45,1]],
    ':': [[0.5,0.3, 0.5,0.35], [0.5,0.65, 0.5,0.7]],
    ';': [[0.5,0.3, 0.5,0.35], [0.5,0.65, 0.45,0.75]],
    '-': [[0.2,0.5, 0.8,0.5]],
    '_': [[0,1, 1,1]],
    '+': [[0.5,0.2, 0.5,0.8], [0.2,0.5, 0.8,0.5]],
    '=': [[0.2,0.4, 0.8,0.4], [0.2,0.6, 0.8,0.6]],
    '0': [[0.2,0, 0.8,0, 1,0.2, 1,0.8, 0.8,1, 0.2,1, 0,0.8, 0,0.2, 0.2,0]],
    '1': [[0.3,0.2, 0.5,0, 0.5,1], [0.3,1, 0.7,1]],
    '2': [[0.1,0.2, 0.2,0, 0.8,0, 0.9,0.2, 0.9,0.4, 0.1,1, 1,1]],
    '3': [[0.1,0, 0.8,0, 0.9,0.2, 0.9,0.4, 0.5,0.5], [0.5,0.5, 0.9,0.6, 0.9,0.8, 0.8,1, 0.1,1]],
    '4': [[0.7,1, 0.7,0], [0.7,0.7, 0,0.7, 0.1,0]],
    '5': [[0.9,0, 0.1,0, 0.1,0.45, 0.8,0.45, 0.9,0.6, 0.9,0.8, 0.8,1, 0.2,1, 0.1,0.8]],
    '6': [[0.8,0.1, 0.6,0, 0.3,0, 0.1,0.2, 0.1,0.8, 0.3,1, 0.7,1, 0.9,0.8, 0.9,0.6, 0.7,0.5, 0.3,0.5, 0.1,0.6]],
    '7': [[0.1,0, 1,0, 0.5,1]],
    '8': [[0.3,0, 0.7,0, 0.9,0.2, 0.9,0.3, 0.7,0.5, 0.3,0.5, 0.1,0.3, 0.1,0.2, 0.3,0], [0.3,0.5, 0.1,0.7, 0.1,0.8, 0.3,1, 0.7,1, 0.9,0.8, 0.9,0.7, 0.7,0.5]],
    '9': [[0.9,0.8, 0.7,1, 0.3,1, 0.1,0.8, 0.1,0.6, 0.3,0.5, 0.7,0.5, 0.9,0.6, 0.9,0.2, 0.7,0, 0.4,0, 0.2,0.1]]
  };

  // COMPLEX - Decorative font with serifs
  const fontComplex = {
    'A': [[0,1, 0.5,0, 1,1], [0.2,0.65, 0.8,0.65], [0,1, 0.15,1], [1,1, 0.85,1]],
    'B': [[0,0, 0,1, 0.1,1, 0.1,0], [0.1,0, 0.65,0, 0.75,0.05, 0.75,0.4, 0.65,0.45, 0.1,0.45], [0.1,0.45, 0.7,0.45, 0.8,0.5, 0.8,0.95, 0.7,1, 0.1,1]],
    'C': [[0.9,0.25, 0.75,0.05, 0.3,0, 0.1,0.15, 0.05,0.35, 0.05,0.65, 0.1,0.85, 0.3,1, 0.75,0.95, 0.9,0.75]],
    'D': [[0,0, 0,1, 0.1,1, 0.1,0], [0.1,0.05, 0.6,0, 0.8,0.15, 0.85,0.35, 0.85,0.65, 0.8,0.85, 0.6,1, 0.1,0.95]],
    'E': [[0.9,0, 0,0, 0,1, 0.9,1], [0.1,0, 0.1,1], [0.1,0.5, 0.6,0.5]],
    'F': [[0.9,0, 0,0, 0,1], [0.1,0, 0.1,1], [0.1,0.5, 0.6,0.5]],
    'G': [[0.9,0.25, 0.75,0.05, 0.3,0, 0.1,0.15, 0.05,0.35, 0.05,0.65, 0.1,0.85, 0.3,1, 0.75,0.95, 0.95,0.75, 0.95,0.5, 0.55,0.5]],
    'H': [[0,0, 0,1], [0.1,0, 0.1,1], [1,0, 1,1], [0.9,0, 0.9,1], [0.1,0.5, 0.9,0.5]],
    'I': [[0.25,0, 0.75,0], [0.5,0, 0.5,1], [0.25,1, 0.75,1]],
    'J': [[0.7,0, 0.7,0.75, 0.6,0.95, 0.4,1, 0.2,0.95, 0.15,0.8]],
    'K': [[0,0, 0,1], [0.1,0, 0.1,1], [0.9,0, 0.1,0.5], [0.2,0.55, 1,1]],
    'L': [[0,0, 0,1, 0.9,1], [0.1,0, 0.1,1]],
    'M': [[0,1, 0,0], [0.1,1, 0.1,0.1], [0.1,0.1, 0.5,0.5], [0.5,0.5, 0.9,0.1], [0.9,0.1, 0.9,1], [1,0, 1,1]],
    'N': [[0,1, 0,0], [0.1,1, 0.1,0.15], [0.1,0.15, 0.9,1], [0.9,1, 0.9,0], [1,0, 1,1]],
    'O': [[0.25,0, 0.75,0, 0.95,0.2, 0.95,0.8, 0.75,1, 0.25,1, 0.05,0.8, 0.05,0.2, 0.25,0]],
    'P': [[0,1, 0,0], [0.1,0, 0.1,1], [0.1,0, 0.7,0, 0.8,0.1, 0.8,0.45, 0.7,0.55, 0.1,0.55]],
    'Q': [[0.25,0, 0.75,0, 0.95,0.2, 0.95,0.8, 0.75,1, 0.25,1, 0.05,0.8, 0.05,0.2, 0.25,0], [0.65,0.7, 1.05,1.1]],
    'R': [[0,1, 0,0], [0.1,0, 0.1,1], [0.1,0, 0.7,0, 0.8,0.1, 0.8,0.45, 0.7,0.55, 0.1,0.55], [0.55,0.55, 1,1]],
    'S': [[0.85,0.25, 0.7,0.05, 0.3,0, 0.15,0.15, 0.2,0.35, 0.8,0.45, 0.85,0.65, 0.8,0.85, 0.7,0.95, 0.3,1, 0.15,0.75]],
    'T': [[0,0, 1,0], [0.5,0, 0.5,1]],
    'U': [[0,0, 0,0.75, 0.15,0.95, 0.4,1, 0.6,1, 0.85,0.95, 1,0.75, 1,0]],
    'V': [[0,0, 0.5,1], [1,0, 0.5,1]],
    'W': [[0,0, 0.2,1], [0.3,0.6, 0.5,1], [0.7,0.6, 0.5,1], [1,0, 0.8,1]],
    'X': [[0,0, 1,1], [1,0, 0,1]],
    'Y': [[0,0, 0.5,0.5], [1,0, 0.5,0.5], [0.5,0.5, 0.5,1]],
    'Z': [[0,0, 1,0, 0.05,0.95, 1,1]],
    ' ': [],
    '!': [[0.5,0, 0.5,0.6], [0.5,0.75, 0.5,0.8]],
    '?': [[0.25,0.15, 0.35,0, 0.65,0, 0.75,0.15, 0.75,0.35 , 0.5,0.55, 0.5,0.65], [0.5,0.75, 0.5,0.8]],
    '.': [[0.5,0.85, 0.5,0.95]],
    ',': [[0.5,0.85, 0.45,1]],
    '-': [[0.2,0.5, 0.8,0.5]],
    '0': [[0.25,0, 0.75,0, 0.95,0.2, 0.95,0.8, 0.75,1, 0.25,1, 0.05,0.8, 0.05,0.2, 0.25,0]],
    '1': [[0.3,0.2, 0.5,0, 0.5,1], [0.3,1, 0.7,1]],
    '2': [[0.15,0.2, 0.25,0, 0.75,0, 0.85,0.2, 0.85,0.4, 0.15,0.95, 0.85,1]],
    '3': [[0.15,0, 0.75,0, 0.85,0.15, 0.85,0.35, 0.55,0.5], [0.55,0.5, 0.85,0.65, 0.85,0.85, 0.75,1, 0.15,1]],
    '4': [[0.65,1, 0.7,0], [0.7,0.65, 0.05,0.65, 0.15,0.05]],
    '5': [[0.85,0, 0.15,0, 0.15,0.45, 0.75,0.45, 0.85,0.6, 0.85,0.85, 0.75,1, 0.25,1, 0.15,0.85]],
    '6': [[0.75,0.15, 0.6,0, 0.3,0, 0.15,0.2, 0.15,0.75, 0.3,1, 0.7,1, 0.85,0.8, 0.85,0.6, 0.7,0.5, 0.3,0.5, 0.15,0.6]],
    '7': [[0.15,0, 0.85,0, 0.5,1]],
    '8': [[0.3,0, 0.7,0, 0.85,0.15, 0.85,0.3, 0.7,0.5, 0.3,0.5, 0.15,0.3, 0.15,0.15, 0.3,0], [0.3,0.5, 0.15,0.7, 0.15,0.85, 0.3,1, 0.7,1, 0.85,0.85, 0.85,0.7, 0.7,0.5]],
    '9': [[0.85,0.8, 0.7,1, 0.3,1, 0.15,0.8, 0.15,0.6, 0.3,0.5, 0.7,0.5, 0.85,0.6, 0.85,0.25, 0.7,0, 0.4,0, 0.25,0.15]]
  };

  // SCRIPT - Cursive style
  const fontScript = {
    'A': [[0.1,0.9, 0.4,0, 0.6,0.5, 0.7,0.85, 0.8,1], [0.25,0.6, 0.55,0.6]],
    'B': [[0.05,0.1, 0.1,0, 0.15,0.05, 0.15,0.95, 0.25,1], [0.15,0.4, 0.5,0.3, 0.65,0.35, 0.7,0.5, 0.6,0.6, 0.4,0.65], [0.4,0.65, 0.65,0.7, 0.75,0.85, 0.7,0.95, 0.5,1]],
    'C': [[0.8,0.3, 0.65,0.1, 0.4,0.05, 0.2,0.15, 0.1,0.35, 0.1,0.65, 0.2,0.85, 0.4,0.95, 0.65,0.9, 0.8,0.75]],
    'D': [[0.05,0.1, 0.1,0, 0.15,0.05, 0.15,0.95, 0.25,1], [0.15,0.15, 0.5,0.05, 0.7,0.2, 0.75,0.45, 0.75,0.75, 0.65,0.9, 0.45,0.98, 0.25,1]],
    'E': [[0.75,0.4, 0.65,0.15, 0.45,0.05, 0.25,0.1, 0.15,0.25, 0.1,0.45, 0.15,0.6, 0.35,0.7, 0.6,0.7], [0.15,0.65, 0.15,0.85, 0.25,0.95, 0.45,1, 0.7,0.95, 0.85,0.8]],
    'F': [[0.05,0.1, 0.1,0, 0.35,0, 0.45,0.05, 0.5,0.15], [0.15,0.15, 0.15,0.95, 0.25,1], [0.1,0.5, 0.5,0.5]],
    'G': [[0.8,0.3, 0.65,0.1, 0.4,0.05, 0.2,0.15, 0.1,0.35, 0.1,0.65, 0.2,0.85, 0.45,0.95, 0.7,0.9, 0.85,0.75, 0.85,0.55, 0.55,0.55]],
    'H': [[0.05,0.1, 0.1,0, 0.15,0.05, 0.15,0.95, 0.25,1], [0.15,0.5, 0.55,0.45, 0.7,0.5], [0.7,0.5, 0.75,0.75, 0.8,0.9, 0.85,1]],
    'I': [[0.4,0.05, 0.45,0, 0.5,0.05, 0.5,0.9, 0.6,1]],
    'J': [[0.5,0.05, 0.55,0, 0.6,0.05, 0.6,0.75, 0.5,0.95, 0.35,1, 0.2,0.95, 0.15,0.8]],
    'K': [[0.05,0.1, 0.1,0, 0.15,0.05, 0.15,0.95, 0.25,1], [0.7,0.1, 0.2,0.5], [0.35,0.55, 0.75,0.95, 0.85,1]],
    'L': [[0.05,0.1, 0.1,0, 0.15,0.05, 0.15,0.85, 0.25,0.95, 0.45,1, 0.7,0.95, 0.85,0.85]],
    'M': [[0.05,0.95, 0.1,1], [0.1,1, 0.1,0.1, 0.15,0], [0.15,0, 0.35,0.45, 0.45,0.65], [0.45,0.65, 0.6,0.45, 0.75,0], [0.75,0, 0.8,0.05, 0.8,0.95, 0.9,1]],
    'N': [[0.05,0.95, 0.1,1], [0.1,1, 0.1,0.1, 0.15,0], [0.15,0, 0.7,0.85, 0.75,0.95], [0.75,0.95, 0.75,0.1, 0.8,0, 0.85,0.05]],
    'O': [[0.3,0.05, 0.7,0.05, 0.85,0.2, 0.9,0.45, 0.9,0.65, 0.85,0.85, 0.7,0.95, 0.3,0.95, 0.15,0.85, 0.1,0.65, 0.1,0.45, 0.15,0.2, 0.3,0.05]],
    'P': [[0.05,0.1, 0.1,0, 0.15,0.05, 0.15,0.95, 0.25,1], [0.15,0.1, 0.55,0.05, 0.7,0.15, 0.75,0.35, 0.7,0.5, 0.55,0.6, 0.25,0.6]],
    'Q': [[0.3,0.05, 0.7,0.05, 0.85,0.2, 0.9,0.45, 0.9,0.65, 0.85,0.85, 0.7,0.95, 0.3,0.95, 0.15,0.85, 0.1,0.65, 0.1,0.45, 0.15,0.2, 0.3,0.05], [0.65,0.75, 0.9,1.05, 1,1.1]],
    'R': [[0.05,0.1, 0.1,0, 0.15,0.05, 0.15,0.95, 0.25,1], [0.15,0.1, 0.55,0.05, 0.7,0.15, 0.75,0.35, 0.7,0.5, 0.55,0.6, 0.25,0.6], [0.45,0.6, 0.75,0.95, 0.9,1.05]],
    'S': [[0.8,0.25, 0.7,0.1, 0.45,0.05, 0.25,0.15, 0.2,0.3, 0.35,0.45, 0.65,0.5, 0.8,0.65, 0.8,0.8, 0.65,0.92, 0.4,0.97, 0.2,0.85]],
    'T': [[0.5,0.05, 0.55,0, 0.6,0.05, 0.6,0.9, 0.7,1], [0.25,0.15, 0.85,0.05]],
    'U': [[0.1,0.05, 0.15,0, 0.2,0.05, 0.2,0.75, 0.3,0.92, 0.5,0.98, 0.7,0.92, 0.75,0.75], [0.75,0.75, 0.8,0.9, 0.85,1]],
    'V': [[0.1,0.05, 0.15,0, 0.2,0.05, 0.5,0.95, 0.6,1], [0.7,0.05, 0.75,0, 0.8,0.05, 0.6,1]],
    'W': [[0.05,0.05, 0.1,0, 0.15,0.05, 0.3,0.95, 0.35,1], [0.45,0.05, 0.5,0, 0.55,0.05, 0.35,1], [0.65,0.05, 0.7,0, 0.75,0.05, 0.55,1], [0.85,0.05, 0.9,0, 0.95,0.05, 0.75,1]],
    'X': [[0.1,0.05, 0.15,0, 0.7,0.92, 0.8,1], [0.75,0.05, 0.8,0, 0.25,0.92, 0.15,1]],
    'Y': [[0.1,0.05, 0.15,0, 0.2,0.05, 0.45,0.55], [0.7,0.05, 0.75,0, 0.8,0.05, 0.45,0.55], [0.45,0.55, 0.5,0.9, 0.6,1]],
    'Z': [[0.15,0.1, 0.75,0.05, 0.85,0.1, 0.25,0.9, 0.8,0.95, 0.9,1]],
    ' ': [],
    '!': [[0.5,0, 0.5,0.6], [0.5,0.75, 0.5,0.8]],
    '?': [[0.25,0.2, 0.35,0.05, 0.65,0, 0.75,0.15, 0.75,0.35, 0.5,0.55, 0.5,0.65], [0.5,0.75, 0.5,0.8]],
    '.': [[0.5,0.85, 0.5,0.95]],
    ',': [[0.5,0.85, 0.45,1]],
    '0': [[0.3,0.05, 0.7,0.05, 0.85,0.2, 0.9,0.45, 0.9,0.65, 0.85,0.85, 0.7,0.95, 0.3,0.95, 0.15,0.85, 0.1,0.65, 0.1,0.45, 0.15,0.2, 0.3,0.05]],
    '1': [[0.35,0.2, 0.5,0.05, 0.55,0.05, 0.55,0.95, 0.65,1]],
    '2': [[0.2,0.2, 0.3,0.05, 0.7,0, 0.85,0.15, 0.85,0.35, 0.2,0.9, 0.25,0.95, 0.8,0.98]],
    '3': [[0.2,0.05, 0.7,0, 0.85,0.15, 0.85,0.35, 0.55,0.5], [0.55,0.5, 0.85,0.65, 0.85,0.85, 0.7,0.98, 0.2,0.95]],
    '4': [[0.65,0.95, 0.7,0.05], [0.7,0.65, 0.1,0.65, 0.2,0.1]],
    '5': [[0.8,0.05, 0.2,0.02, 0.2,0.4, 0.7,0.45, 0.85,0.6, 0.85,0.82, 0.7,0.96, 0.3,0.98, 0.2,0.88]],
    '6': [[0.75,0.2, 0.6,0.05, 0.35,0.05, 0.2,0.2, 0.15,0.45, 0.15,0.75, 0.3,0.95, 0.65,0.98, 0.8,0.85, 0.85,0.65, 0.7,0.52, 0.35,0.5, 0.2,0.6]],
    '7': [[0.2,0.05, 0.85,0, 0.55,0.98, 0.6,1.05]],
    '8': [[0.35,0.05, 0.65,0.05, 0.8,0.18, 0.8,0.32, 0.65,0.48, 0.35,0.48, 0.2,0.32, 0.2,0.18, 0.35,0.05], [0.35,0.48, 0.2,0.65, 0.2,0.82, 0.35,0.95, 0.65,0.95, 0.8,0.82, 0.8,0.65, 0.65,0.48]],
    '9': [[0.8,0.8, 0.65,0.95, 0.35,0.95, 0.2,0.8, 0.15,0.55, 0.15,0.25, 0.3,0.08, 0.65,0.05, 0.8,0.2, 0.85,0.45, 0.7,0.52, 0.35,0.5, 0.2,0.35]]
  };

  const fonts = {
    'simplex': fontSimplex,
    'complex': fontComplex,
    'script': fontScript
  };

  // --- Event Listeners ---
  generateBtn.addEventListener("click", generateText);
  downloadBtn.addEventListener("click", downloadGCode);

  [textInput, fontSelect, fontSizeInput, lineSpacingInput, lineWidthInput].forEach(input => {
    input.addEventListener("input", updatePreview);
    input.addEventListener("change", updatePreview);
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

  function generateText() {
    updatePreview();
    generateGCode();
  }

  function updatePreview() {
    const text = textInput.value;
    const fontSize = parseFloat(fontSizeInput.value) || 10;
    const lineSpacing = parseFloat(lineSpacingInput.value) || 1.5;
    const maxLineWidth = parseFloat(lineWidthInput.value) || 100;
    const selectedFont = fonts[fontSelect.value] || fontSimplex;

    textPolylines = [];
    
    // Word wrapping logic
    const inputLines = text.split('\n');
    const wrappedLines = [];
    
    inputLines.forEach(inputLine => {
      const words = inputLine.split(' ');
      let currentLine = '';
      let currentWidth = 0;

      words.forEach(word => {
        const wordWidth = calculateWordWidth(word, fontSize, selectedFont);
        const spaceWidth = fontSize * 0.5;

        if (currentWidth + wordWidth <= maxLineWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
          currentWidth += (currentLine ? spaceWidth : 0) + wordWidth;
        } else {
          if (currentLine) {
            wrappedLines.push(currentLine);
          }
          currentLine = word;
          currentWidth = wordWidth;
        }
      });

      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    });

    // Render wrapped lines
    let yOffset = 0;

    wrappedLines.forEach(line => {
      let xOffset = 0;
      const chars = line.split('');

      chars.forEach(char => {
        const upperChar = char.toUpperCase();
        const charData = selectedFont[upperChar] || selectedFont['?'] || [];
        const charWidth = char === ' ' ? fontSize * 0.5 : fontSize * 0.7;

        charData.forEach(stroke => {
          const points = [];
          for (let i = 0; i < stroke.length; i += 2) {
            points.push({
              x: xOffset + stroke[i] * charWidth,
              y: yOffset + stroke[i + 1] * fontSize
            });
          }
          if (points.length > 0) {
            textPolylines.push(points);
          }
        });

        xOffset += charWidth + fontSize * 0.2; // Letter spacing
      });

      yOffset += fontSize * lineSpacing;
    });

    drawPreview();
  }

  function calculateWordWidth(word, fontSize, font) {
    let width = 0;
    for (let char of word) {
      const charWidth = char === ' ' ? fontSize * 0.5 : fontSize * 0.7;
      width += charWidth + fontSize * 0.2;
    }
    return width;
  }

  function drawPreview() {
    if (!previewCanvas) return;

    const container = previewCanvas.parentElement;
    previewCanvas.width = container.clientWidth;
    previewCanvas.height = 500;

    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (textPolylines.length === 0) return;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    textPolylines.forEach(poly => {
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

    // Draw travel moves (red)
    ctx.strokeStyle = "#cf6679";
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    let currentPos = { x: 0, y: 0 };
    textPolylines.forEach(poly => {
      if (poly.length > 0) {
        ctx.moveTo(currentPos.x, currentPos.y);
        ctx.lineTo(poly[0].x, poly[0].y);
        currentPos = poly[poly.length - 1];
      }
    });
    ctx.stroke();

    // Draw write moves (cyan)
    ctx.strokeStyle = "#03dac6";
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    textPolylines.forEach(poly => {
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
  }

  function generateGCode() {
    if (textPolylines.length === 0) {
      alert("Kein Text vorhanden!");
      return;
    }

    const zDown = inputZDown.value;
    const zUp = inputZUp.value;
    const feedRate = inputFeedRate.value;
    const travelRate = inputTravelRate.value;

    let code = [];
    code.push("; Generated by Text to G-Code Converter");
    code.push("G28 ; Home all axes");
    code.push("G90 ; Absolute positioning");
    code.push("G21 ; Millimeter units");
    code.push(`G0 F${travelRate} ; Set travel speed`);
    code.push(`G0 Z${zUp}`);

    textPolylines.forEach((poly) => {
      if (poly.length === 0) return;

      const start = poly[0];
      code.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);
      code.push(`G1 Z${zDown} F300`); // Lower pen slowly
      code.push(`G1 F${feedRate} ; Set print speed`);
      
      for (let i = 1; i < poly.length; i++) {
        const p = poly[i];
        code.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`);
      }

      code.push(`G0 Z${zUp} F${travelRate}`);
    });

    code.push("G0 Z10 ; Raise pen");
    code.push("G28 X0 Y0 ; Home X Y");
    code.push("M84 ; Disable motors");

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
    a.download = "text-drawing.gcode";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Initial preview
  updatePreview();
});
