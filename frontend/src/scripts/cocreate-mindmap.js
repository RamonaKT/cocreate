import { setupMindmap } from './script-core.js';
import iconOverview from '../assets/icons/icon-overview.png';
import iconDownload from '../assets/icons/icon-download.png';
import iconSave from '../assets/icons/icon-save.png';
import iconManual from '../assets/icons/icon-manual.png';

export class CoCreateMindmap extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {

    const cocreateCss = new URL('../styles/cocreate-styles.css', import.meta.url);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cocreateCss;

    this.shadowRoot.append(link);

    const container = document.createElement('div');
    container.innerHTML = `
      <div id="toolbar">
        <div class="node-template" draggable="true" data-type="1">Bubble</div>
        <div class="node-template" draggable="true" data-type="2">Label</div>
        <div class="node-template" draggable="true" data-type="3">Note</div>
      </div>

      <div id="mindmap-container">
        <svg id="mindmap" width="1000" height="600"></svg>
      </div>

      <div id="sidebar-left" class="sidebar">
          <img src="${iconManual}" alt="Icon manual"
           draggable="false" 
      onclick="(() => {
        const root = this.getRootNode();
        const dialog = root.getElementById('dialogIconManual');
        const linkEl = root.getElementById('mindmapLink');
        const mindmapId = new URLSearchParams(window.location.search).get('id');
        if (mindmapId) {
          const fullUrl = \`\${window.location.origin}/?id=\${mindmapId}\`;
          linkEl.value = fullUrl;
        } else {
          linkEl.value = 'No ID found in URL.';
        }
        dialog.showModal();
      })()">

    <dialog id="dialogIconManual">
      <h2>Quick-Start manual</h2>
      <ul>
        <li>Save to create a new mindmap.</li>
        <li>Make sure everyone has access to the server.</li>
        <li>Share the map ID to collaborate.</li>
        <li>Most importantly, have fun working together!</li>
      </ul>
      <div>
        <input id="mindmapLink" type="text" readonly">
        <button onclick="(() => {
          const root = this.getRootNode();
          const input = root.getElementById('mindmapLink');
          input.select();
          document.execCommand('copy');
          this.textContent = 'copied';
          setTimeout(() => this.textContent = 'copy', 1500);
        })()" >copy</button>
      </div>
      <button class="close" draggable="false"
        onclick="this.closest('dialog').close()">close</button>
    </dialog>

         <img src="${iconOverview}" alt="Icon overview user"
            draggable="false" 
            onclick="this.getRootNode().getElementById('dialogIconOverviewUser').showModal(); window.loadUsersForCurrentMindmap(this.getRootNode());">

          <dialog id="dialogIconOverviewUser">
            <h2>User-Overview</h2>
            <div id="userListContainer"></div>
            <button class="close" 
              onclick="this.closest('dialog').close()">close</button>
          </dialog>

          <img src="${iconDownload}" alt="Icon Download pdf"
            class="pdfButton" id="downloadbtn" draggable="false">

          <img src="${iconSave}" alt="Icon save" id="saveButton"
            draggable="false">
        </div>

        <div id="ipLockOverlay">
          <div class="overlay-box">
            <p id="overlayMessage">Do you really want to block this IP?</p>
            <div class="overlay-buttons">
              <button id="confirmLockBtn">Yes, block it.</button>
              <button id="cancelLockBtn">Cancel</button>
            </div>
          </div>
        </div>    `;

    this.shadowRoot.appendChild(container);
    setupMindmap(this.shadowRoot);

  }
}

customElements.define('cocreate-mindmap', CoCreateMindmap);
