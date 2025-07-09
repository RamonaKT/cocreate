import { jest } from '@jest/globals';


// backend/tests/unit/script-core.test.js
// ACHTUNG: Datei-Endung MUSS .test.js oder .test.mjs sein!
// Du testest hier die Verwendung / Integration, nicht die interne Logik. (Fazit ChatGPT)


describe('script-core mock functions', () => {
  let highlightNode, drawLine;

  beforeAll(async () => {
    jest.unstable_mockModule('../../../frontend/src/scripts/script-core.js', () => ({
      highlightNode: jest.fn(),
      unhighlightNode: jest.fn(),
      removeNode: jest.fn(),
      drawLine: jest.fn(),
      deleteLine: jest.fn()
    }));

    // Dynamisch importieren – nach Mock
    const module = await import('../../../frontend/src/scripts/script-core.js');
    highlightNode = module.highlightNode;
    drawLine = module.drawLine;
  });

  test('highlightNode should be called with an element', () => {
    const el = document.createElement('div');
    highlightNode(el);
    expect(highlightNode).toHaveBeenCalledWith(el);
  });

  test('drawLine should be called with correct arguments', () => {
    drawLine('map1', 'node1', 'node2');
    expect(drawLine).toHaveBeenCalledWith('map1', 'node1', 'node2');
  });
});
