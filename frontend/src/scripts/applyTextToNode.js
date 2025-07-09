
/**
 * Splits a long text into multiple <tspan> lines, even in the middle of words if necessary.
 * Inserts the result into an SVG <text> element.
 *
 * @param {SVGTextElement} textElement - The SVG <text> element to update
 * @param {string} rawText - The raw input text
 * @param {number} maxLength - Maximum total characters (default: 24)
 * @param {number} chunkSize - Characters per line (default: 12)
 * @returns {string} - The final, possibly trimmed text value
 */
export function applyTextToNode(textElement, rawText, maxLength = 24, chunkSize = 12) {
    const clean = rawText?.trim() || "...";
    const value = clean.length ? clean.slice(0, maxLength) : "...";
    // Split text into fixed-length chunks
    const lines = [];
    for (let i = 0; i < value.length; i += chunkSize) {
        lines.push(value.slice(i, i + chunkSize));
    }
    // Remove any existing child nodes
    while (textElement.firstChild) {
        textElement.removeChild(textElement.firstChild);
    }
    // Add new lines as <tspan> elements
    lines.forEach((line, i) => {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", "0");
        tspan.setAttribute("dy", i === 0 ? "0" : "1.2em");
        tspan.textContent = line;
        textElement.appendChild(tspan);
    });
    return value;
}


