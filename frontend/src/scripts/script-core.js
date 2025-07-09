import { supabase } from '../../../backend/supabase/client.js';
import { io } from "socket.io-client";
import { getCreations, saveCreation } from '../../../backend/supabase/database.js';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { hashIp } from './hash';


const zoomStep = 0.025;
const minZoom = 0.1;
const maxZoom = 3;
const params = new URLSearchParams(window.location.search);
const mindmapId = params.get('id');
const initialViewBoxSize = 500;
const centerX = 250;
const centerY = 250;
const panStep = 20;
const getCSSColor = (level) =>
    getComputedStyle(document.documentElement).getPropertyValue(`--color-level-${level}`).trim();
const nodeStyles = {
    1: { r: 60, color: getCSSColor(1), label: 'Ebene 1', fontSize: 16 },
    2: { r: 50, color: getCSSColor(2), label: 'Ebene 2', fontSize: 14 },
    3: { r: 40, color: getCSSColor(3), label: 'Ebene 3', fontSize: 12 },
};


let initialSyncDone = false;
let dragLine = null;
let svg = null;
let socket = null;
let saveTimeout;
let userNickname = null;
let userToLock = null;
let zoom = 1;
let draggedType = null;
let dragTarget = null;
let offset = { x: 0, y: 0 };
let allNodes = [];
let allConnections = [];
let selectedNode = null;
let selectedConnection = null;
let viewBox = {
    x: centerX - initialViewBoxSize / 2,
    y: centerY - initialViewBoxSize / 2,
    w: initialViewBoxSize,
    h: initialViewBoxSize,
};
let mindmapTitle = "mindmap"; // Default

// Schedules saving the current SVG to the database after a delay (default: 1 second).
function scheduleSVGSave(delay = 1000) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveSVGToSupabase();
    }, delay);
}

// Saves the current SVG content to the Supabase database for the active mindmap.
async function saveSVGToSupabase() {
    if (!mindmapId) {
        return;
    }
    console.log("adding to supabase");
    const svgData = getSVGSource();
    const { data, error } = await supabase
        .from('creations')
        .update({ svg_code: svgData })
        .eq('creationid', mindmapId);
    if (error) {
        console.error('Error saving SVG:', error.message);
        throw new Error('Failed to save SVG in Supabase: ' + error.message);
    }
    console.log("added to supabase :)))")
    return data; 
}

// Updates all connection lines related to a moved node.
function updateConnections(movedId) {
    allConnections.forEach(conn => {
        if (conn.fromId === movedId || conn.toId === movedId) {
            const from = allNodes.find(n => n.id === conn.fromId);
            const to = allNodes.find(n => n.id === conn.toId);
            conn.line.setAttribute("x1", from.x);
            conn.line.setAttribute("y1", from.y);
            conn.line.setAttribute("x2", to.x);
            conn.line.setAttribute("y2", to.y);
        }
    });
}

// Visually and logically connects two nodes with a line, and emits events over the socket if applicable.
function connectNodes(fromId, toId, fromNetwork = false) {
    const from = allNodes.find(n => n.id === fromId);
    const to = allNodes.find(n => n.id === toId);
    if (!from || !to) return;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.dataset.from = fromId;
    line.dataset.to = toId;
    line.setAttribute("stroke", "#888");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("class", "connection-line");
    svg.appendChild(line);
    line.addEventListener("click", e => {
        e.stopPropagation();
        if (selectedNode !== null) {
            highlightNode(selectedNode, false);
            selectedNode = null;
        }
        if (selectedConnection) {
            selectedConnection.classList.remove("highlighted");
        }
        selectedConnection = line;
        selectedConnection.classList.add("highlighted");
    });
    line.addEventListener("contextmenu", e => {
        e.preventDefault();
        svg.removeChild(line);
        allConnections = allConnections.filter(conn => conn.line !== line);
        if (selectedConnection === line) selectedConnection = null;
        if (socket) {
            socket.emit("connection-deleted", {
                fromId: line.dataset.from,
                toId: line.dataset.to
            });
            scheduleSVGSave();
        }
    });
    svg.insertBefore(line, svg.firstChild);
    allConnections.push({ fromId, toId, line });
    if (socket) {
        socket.emit("connection-added", { fromId, toId });
        scheduleSVGSave();
    }
}

// Adds or removes highlight styling from a node by its ID.
export function highlightNode(id, on) {
    const node = allNodes.find(n => n.id === id);
    if (!node) return;
    const shape = node.group.querySelector('ellipse, rect');
    if (!shape) return;
    if (on) shape.classList.add('highlighted');
    else shape.classList.remove('highlighted');
}

// Creates and displays a modal asking the user to enter a nickname.
export function createNicknameModal(shadowRoot = document) {
    if (!shadowRoot || shadowRoot === document) {
        console.warn('Attention: createNicknameModal was called without ShadowRoot!');
        return;
    }
    if (shadowRoot.getElementById('nicknameModal')) return;
    const modal = document.createElement('div');
    modal.id = 'nicknameModal';
    modal.innerHTML = `
    <div class="modal-content">
      <h2>Choose nickname</h2>
      <input id="nicknameInput" type="text" placeholder="Your Nickname" />
      <button id="nicknameSubmitButton">Save</button>
    </div>
  `;
    shadowRoot.appendChild(modal);
    modal.querySelector('#nicknameSubmitButton')?.addEventListener('click', () => {
        submitNickname(shadowRoot);
    });  
    modal.querySelector('#nicknameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitNickname(shadowRoot);
        }
    });
}

// Adds pointer, click, and rename events to an SVG node group.
function addEventListenersToNode(group, id, r) {
    const node = allNodes.find(n => n.id === id);
    if (!node) return;
    const shape = group.querySelector('ellipse, rect');
    const text = group.querySelector('text');
    // Drag start
    group.addEventListener('pointerdown', e => {
        const isInputClick = e.target.tagName === 'INPUT' || e.target.closest('foreignObject');
        if (isInputClick) return;
        if (e.shiftKey) return;
        const point = getSVGPoint(e.clientX, e.clientY);
        dragTarget = group;
        offset.x = point.x - node.x;
        offset.y = point.y - node.y;
        shape.classList.add('dragging');
    });
    // Drag end on SVG (mouseup)
    svg.addEventListener('pointerup', (e) => {
        if (dragTarget) {
            const id = dragTarget.dataset.nodeId;
            const node = allNodes.find(n => n.id === id);
            if (!node) return;
            const shape = node.group.querySelector('ellipse, rect');
            if (!shape) return;
            shape.classList.remove('dragging');
            if (socket) {
                socket.emit("node-moved", { id: node.id, x: node.x, y: node.y });
                scheduleSVGSave();
            }
        }
        dragTarget = null;
    });
    svg.addEventListener('pointercancel', e => {
        if (dragTarget) {
            const id = dragTarget.dataset.nodeId;
            const node = allNodes.find(n => n.id === id);
            if (!node) return;
            const shape = node.group.querySelector('ellipse, rect');
            if (!shape) return;
            shape.classList.remove('dragging');
        }
        dragTarget = null;
    });
    // Click-connection
    group.addEventListener('click', e => {
        e.stopPropagation();
        if (selectedConnection) {
            selectedConnection.classList.remove('highlighted');
            selectedConnection = null;
        }
        if (selectedNode === null) {
            selectedNode = id;
            highlightNode(id, true);
        } else if (selectedNode !== id) {
            connectNodes(selectedNode, id);
            highlightNode(selectedNode, false);
            selectedNode = null;
        } else {
            highlightNode(selectedNode, false);
            selectedNode = null;
        }
    });
    // Double click to rename
    text?.addEventListener('dblclick', e => {
        e.stopPropagation();
        if (group.querySelector('foreignObject')) return;
        const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        fo.setAttribute("x", -r);
        fo.setAttribute("y", -10);
        fo.setAttribute("width", r * 2);
        fo.setAttribute("height", 20);
        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("value", text.textContent);
        fo.appendChild(input);
        fo.style.pointerEvents = 'all';
        group.appendChild(fo);
        input.focus();
        const save = async () => {
            const value = input.value.trim();
            if (value) {
                text.textContent = value;
            }
            if (group.contains(fo)) {
                group.removeChild(fo);
            }
            if (socket) {
                socket.emit("node-renamed", { id, text: value });
                try {
                    await saveSVGToSupabase(); // <- waiting here
                } catch (e) {
                    console.error("Fehler beim Speichern:", e);
                }
            }
        };
        input.addEventListener("blur", save);
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                input.blur();
            } else if (e.key === "Escape") {
                group.removeChild(fo);
            }
        });
    });
}

// Creates a new node at a given position with a specific type and adds it to the SVG.
function createDraggableNode(x, y, type, idOverride, fromNetwork = false) {
    const style = nodeStyles[type];
 if (!style) {
        console.warn("Unbekannter Typ:", type);
        return;
    }
    //const id = 'node' + allNodes.length;
    const id = idOverride || 'node' + createUUID();
    console.log('randomUUID exists?', !!window.crypto?.randomUUID);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "draggable");
    group.setAttribute("transform", `translate(${x}, ${y})`);
    group.dataset.nodeId = id;
    group.dataset.type = type;
    svg.appendChild(group);
    let shape;
    if (type === "1") {
        // Oval (Ellipse)
        shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        shape.setAttribute("cx", 0);
        shape.setAttribute("cy", 0);
        shape.setAttribute("rx", style.r);
        shape.setAttribute("ry", style.r * 0.6);
    } else if (type === "2") {
        // rounded edges
        shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        shape.setAttribute("x", -style.r);
        shape.setAttribute("y", -style.r * 0.6);
        shape.setAttribute("width", style.r * 2);
        shape.setAttribute("height", style.r * 1.2);
        shape.setAttribute("rx", 15);
        shape.setAttribute("ry", 15);
    } else {
        // rectangle
        shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        shape.setAttribute("x", -style.r);
        shape.setAttribute("y", -style.r * 0.6);
        shape.setAttribute("width", style.r * 2);
        shape.setAttribute("height", style.r * 1.2);
        shape.setAttribute("rx", 0);
        shape.setAttribute("ry", 0);
    }
    shape.setAttribute("fill", style.color);
    group.appendChild(shape);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", 0);
    text.setAttribute("y", 0);
    text.setAttribute("fill", "black");
    text.setAttribute("font-size", style.fontSize);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("alignment-baseline", "middle");
    text.textContent = "...";
    group.appendChild(text);
    allNodes.push({ id, group, x, y, r: style.r });
    addEventListenersToNode(group, id, style.r);
    if (socket) {
        if (!fromNetwork) {
            socket.emit("node-added", { id, x, y, type });
        }
        scheduleSVGSave();
    }
}

// Handles user access to the mindmap based on their IP and nickname, including admin detection.
async function initializeAccessControl(shadowRoot) {
    const mindmapId = new URLSearchParams(window.location.search).get('id');
    if (!mindmapId) return;
    createNicknameModal(shadowRoot); // prepare Modal
    let ip = 'unknown';
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip;
    } catch (err) {
        console.warn("Couldn't load IP", err);
        showNicknameModal(shadowRoot);
        return;
    }
    startIpLockWatcher(ip, mindmapId, shadowRoot);
    const storedNickname = localStorage.getItem("mindmap_nickname");
    if (storedNickname) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('nickname', storedNickname)
                .eq('ipadress', await hashIp(ip))
                .maybeSingle();
            if (!error && user && !user.locked && user.mindmap_id === mindmapId) {
                userNickname = storedNickname;
                console.log("automatic log-in:", userNickname);
                shadowRoot.getElementById('nicknameModal')?.remove();
                return;
            }
        } catch (e) {
            console.error("Error logging in with saved nickname", e);
        }
    }
    // Fallback: search for user with matching ip and mindmap
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('ipadress', await hashIp(ip))
            .eq('mindmap_id', mindmapId)
            .maybeSingle();
        if (!error && user && !user.locked) {
            userNickname = user.nickname;
            localStorage.setItem("mindmap_nickname", userNickname);
            console.log("Automatisch über IP eingeloggt:", userNickname);
            shadowRoot.getElementById('nicknameModal')?.remove();
            return;
        }
    } catch (err) {
        console.error("Fehler bei Login über IP:", err);
    }
    loadUsersForCurrentMindmap(shadowRoot);
    showNicknameModal(shadowRoot);
}

// Displays the nickname input modal to the user.
export function showNicknameModal(shadowRoot = document) {
    // create/attach or show Modal
    let modal = shadowRoot.getElementById('nicknameModal');
    if (!modal) {
        createNicknameModal(shadowRoot);
        modal = shadowRoot.getElementById('nicknameModal');
    }
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error("Couldn't show modal - missing");
    }
    sessionStorage.removeItem("mindmap_nickname");
    localStorage.removeItem("mindmap_nickname");
}

// Periodically checks if the user's IP is currently locked from editing the mindmap.
function startIpLockWatcher(ip, mindmapId, shadowRoot) {
    async function checkLock() {
        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('nickname, locked, locked_until')
                .eq('ipadress', await hashIp(ip))
                .eq('mindmap_id', mindmapId);
            if (error) {
                console.error("Error at Lock-Check:", error.message);
            } else {
                const now = new Date();
                for (const user of users) {
                    if (user.locked) {
                        const until = user.locked_until ? new Date(user.locked_until) : null;
                        if (until && now >= until) {
                            await supabase
                                .from('users')
                                .update({ locked: false, locked_until: null })
                                .eq('nickname', user.nickname)
                                .eq('mindmap_id', mindmapId);
                            console.log(`User ${user.nickname} automatically unblocked.`);
                        } else {
                            console.warn(`User ${user.nickname} is still blocked.`);
                            showNicknameModal(shadowRoot);
                            return;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error at Lock-Verification:", err);
        }
        setTimeout(checkLock, 5000); // periodical check up
    }
    checkLock();
}

// SOCKET IO:
if (mindmapId) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');
    const userId = `${Date.now()}-${Math.random()}`;
    socket.emit("join-map", { mapId: mindmapId, userId });
    socket.on("initial-sync", ({ nodes, users }) => {
        nodes.forEach(data => {
            const node = allNodes.find(n => n.id === data.id);
            if (node) {
                node.x = data.x;
                node.y = data.y;
                node.group.setAttribute("transform", `translate(${data.x},${data.y})`);
            }
        });
    });
    socket.on("node-moving", data => {
        console.log("node-moving received", data);
        const node = allNodes.find(n => n.id === data.id);
        if (node) {
            node.x = data.x;
            node.y = data.y;
            node.group.setAttribute("transform", `translate(${data.x}, ${data.y})`);
            updateConnections(data.id);
        }
    });

    socket.on("node-moved", data => {
        const node = allNodes.find(n => n.id === data.id);
        if (node) {
            node.x = data.x;
            node.y = data.y;
            node.group.setAttribute("transform", `translate(${data.x},${data.y})`);
            updateConnections(data.id);
        }
    });
    socket.on("node-added", data => {
        if (!allNodes.find(n => n.id === data.id)) {
            createDraggableNode(data.x, data.y, data.type, data.id, true);
        }
    });
    socket.on("node-deleted", ({ id }) => {
        const nodeIndex = allNodes.findIndex(n => n.id === id);
        if (nodeIndex === -1) return;
        const node = allNodes[nodeIndex];
        if (svg.contains(node.group)) {
            svg.removeChild(node.group);
        }
        allNodes.splice(nodeIndex, 1);
        // Delete Connections
        allConnections = allConnections.filter(conn => {
            if (conn.fromId === id || conn.toId === id) {
                if (svg.contains(conn.line)) {
                    svg.removeChild(conn.line);
                }
                return false;
            }
            return true;
        });
    });
    socket.on("connection-added", ({ fromId, toId }) => {
        // Prevent Duplicates
        if (allConnections.some(conn => conn.fromId === fromId && conn.toId === toId)) return;
        connectNodes(fromId, toId);
    });
    socket.on("connection-deleted", ({ fromId, toId }) => {
        const connIndex = allConnections.findIndex(conn => conn.fromId === fromId && conn.toId === toId);
        if (connIndex !== -1) {
            const conn = allConnections[connIndex];
            svg.removeChild(conn.line);
            allConnections.splice(connIndex, 1);
        }
    });
    socket.on("node-renamed", ({ id, text }) => {
        const node = allNodes.find(n => n.id === id);
        if (node) {
            const textEl = node.group.querySelector("text");
            if (textEl) {
                textEl.textContent = text;
            }
        }
    });
    socket.on("kicked", () => {
        alert("Du wurdest vom Admin entfernt.");
        window.location.href = "/";
    });
    socket.on("user-joined", ({ userId, isAdmin }) => {
        // update UI
    });
    socket.on("user-kicked", ({ userId }) => {
        // remove from UI
    });
    socket.on("user-left", ({ userId }) => {
        // remove from UI
    });
}

// Generates a unique UUID using crypto.randomUUID() or a fallback pattern.
function createUUID() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }
    // Fallback: simple and secure alternative UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// saving mindmaps
function getSVGSource() {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
}

// Prompts the user for a title and saves the current mindmap SVG to Supabase.
export async function saveCurrentMindmap() {
    const title = prompt("Titel eingeben:");
    if (!title) return;
    const svgData = getSVGSource();
    const ip = await fetch('https://api.ipify.org').then(res => res.text());
    try {
        const result = await saveCreation(svgData, title, ip);
        // Take the ID of the saved row from Supabase
        const id = result[0]?.creationid;
        if (id) {
            alert("Successfully saved! You will be redirected...");
            const link = `${location.origin}/?id=${id}`;
            window.location.href = link;
            console.log(link);
        } else {
            alert("Saved, but no ID returned.");
        }
    } catch (error) {
        console.error("Error at Saving:", error);
        alert("Error at Saving!");
    }
}

// Drag from Toolbar
document.querySelectorAll('.node-template').forEach(el => {
    el.addEventListener('dragstart', e => {
        draggedType = e.target.getAttribute('data-type');
    });
});

// Converts screen (client) coordinates to SVG coordinates.
function getSVGPoint(x, y) {
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// Exports the mindmap as a PDF file using jsPDF and svg2pdf.js.
export async function exportMindmapToPDF() {
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [svg.clientWidth, svg.clientHeight],
    });
    await svg2pdf(svg, pdf, {
        xOffset: 0,
        yOffset: 0,
        scale: 1
    });
    const safeTitle = mindmapTitle.replace(/[^\w\-]+/g, "_"); // ersetzt unsichere Zeichen
    pdf.save(`mindmap_${safeTitle}.pdf`);
}

window.exportMindmapToPDF = exportMindmapToPDF;
//start of ipaddress locking
// Handles nickname submission, IP validation, admin check, and user registration.
window.submitNickname = async function (shadowRoot = document) {
    const input = shadowRoot.getElementById('nicknameInput')?.value.trim();
    if (!input) {
        alert("Please enter nickname.");
        return;
    }
    const mindmapId = new URLSearchParams(window.location.search).get('id');
    if (!mindmapId) {
        alert("No valid mindmap ID in the URL.");
        return;
    }
    let ip = 'unknown';
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip;
    } catch (err) {
        console.warn("IP could not be determined:", err);
    }
    const { data: existingLocks, error: lockError } = await supabase
        .from('users')
        .select('locked, locked_until')
        .eq('ipadress', await hashIp(ip))
        .eq('mindmap_id', mindmapId);
    if (lockError) {
        alert("Error during lock check.");
        return;
    }
    const now = new Date();
    const anyLocked = existingLocks?.some(user =>
        user.locked && (!user.locked_until || new Date(user.locked_until) > now)
    );
    if (anyLocked) {
        alert("You are currently locked for this mind map.");
        return;
    }
    try {
        // try to have only one nickname per mindmap, but otherwise more often
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('nickname', input)
            .eq('mindmap_id', mindmapId)
            .maybeSingle();
        if (error) {
            alert("Error checking the nickname.");
            return;
        }
        if (existingUser) {
            if (existingUser.locked) {
                alert("This nickname is currently blocked.");
                return;
            }
            alert("This nickname is already taken for this mind map.");
            return;
        }
        // get admin_ip for this mindmap
        const { data: creationData, error: creationError } = await supabase
            .from('creations')
            .select('admin_ip')
            .eq('creationid', mindmapId)
            .single();
        if (creationError || !creationData) {
            alert("Mindmap info could not be loaded.");
            return;
        }
        const isAdmin = creationData.admin_ip === ip;
        //  try to have only one nickname per mindmap, but otherwise more often
        const { error: insertError } = await supabase
            .from('users')
            .insert([{
                nickname: input,
                ipadress: await hashIp(ip),
                locked: false,
                admin: isAdmin,
                mindmap_id: parseInt(mindmapId)
            }]);
        if (isAdmin) console.log("Admin rights assigned");
        if (insertError) {
            alert("Error Saving: " + insertError.message);
            return;
        }
        // User saved successfully
        userNickname = input;
        localStorage.setItem("mindmap_nickname", userNickname);
        shadowRoot.getElementById('nicknameModal')?.remove();
        startIpLockWatcher(ip);
        console.log("New user saved & access allowed:", userNickname);
    } catch (err) {
        console.error("Error with nickname saving", err);
        alert("Error at Saving.");
    }
};

window.addEventListener('load', async () => {
    const mindmapId = new URLSearchParams(window.location.search).get('id');
    if (!mindmapId) return;

    const host = document.querySelector('cocreate-mindmap');
    if (!host || !host.shadowRoot) {
        console.error("ShadowRoot not found!");
        return;
    }
    const shadowRoot = host.shadowRoot;
    createNicknameModal(shadowRoot);
    let ip = 'unknown';
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip;
    } catch (err) {
        console.warn("IP could not be determinedn:", err);
        showNicknameModal(shadowRoot);
        return;
    }
    // check instant block
    startIpLockWatcher(ip);
    // first: try nickname from localstorage
    const storedNickname = localStorage.getItem("mindmap_nickname");
    if (storedNickname) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('nickname', storedNickname)
                .eq('ipadress', await hashIp(ip))
                .maybeSingle();
            if (!error && user && !user.locked && user.mindmap_id == mindmapId) {
                userNickname = storedNickname;
                console.log("automatac log-in:", userNickname);
                document.getElementById('nicknameModal')?.remove();
                startIpLockWatcher(ip);
                return;
            }
        } catch (e) {
            console.error("Fehler bei Login mit gespeicherten Nickname:", e);
        }
    }
    // otherwise: search user per IP 
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('ipadress', await hashIp(ip))
            .eq('mindmap_id', mindmapId)
            .maybeSingle();
        if (!error && user && !user.locked) {
            userNickname = user.nickname;
            localStorage.setItem("mindmap_nickname", userNickname);
            console.log("Automatically logged in via IP:", userNickname);
            document.getElementById('nicknameModal')?.remove();
            startIpLockWatcher(ip);
            return;
        }
    } catch (err) {
        console.error("Error Logging in per IP:", err);
    }
    showNicknameModal(shadowRoot);
});

// Loads and displays a list of users currently associated with the mindmap.
async function loadUsersForCurrentMindmap(shadowRoot = document) {
    const mindmapId = new URLSearchParams(window.location.search).get('id');
    const container = shadowRoot.getElementById('userListContainer');
    container.innerHTML = ''; // vorher leeren
    if (!mindmapId) {
        container.textContent = "Keine gültige Mindmap-ID.";
        return;
    }
    const { data: users, error } = await supabase
        .from('users')
        .select('nickname, locked, admin, ipadress')
        .eq('mindmap_id', mindmapId);
    if (error) {
        container.textContent = "Fehler beim Laden der Nutzer.";
        console.error("Fehler beim Laden der User:", error.message);
        return;
    }
    if (!users || users.length === 0) {
        container.textContent = "Keine Nutzer gefunden.";
        return;
    }
    const currentUser = users.find(u => u.nickname === userNickname);
    const isAdmin = currentUser?.admin;
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-entry';
        if (user.locked) div.classList.add('locked');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user.nickname;
        div.appendChild(nameSpan);
        if (user.admin) {
            const badge = document.createElement('span');
            badge.className = 'badge admin';
            badge.textContent = 'Admin';
            div.appendChild(badge);
        }
        if (isAdmin && user.nickname !== userNickname) {
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                userToLock = user.nickname;
                shadowRoot.getElementById('dialogIconOverviewUser').close();
                shadowRoot.getElementById('ipLockOverlay').style.display = 'flex';
                shadowRoot.getElementById('overlayMessage').textContent =
                    `Do you want to lock IP from "${user.nickname}" ?`;
            });
        }
        container.appendChild(div);
    });
}

async function lockUserByNickname(nickname) {
    const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 Minuten
    const { error } = await supabase
        .from('users')
        .update({ locked: true, locked_until: lockUntil })
        .eq('nickname', nickname);
    if (error) {
        alert("Fehler beim Sperren: " + error.message);
        return;
    }
    console.log(`User "${nickname}" wurde bis ${lockUntil} gesperrt.`);
}

window.loadUsersForCurrentMindmap = loadUsersForCurrentMindmap;

async function loadMindmapFromDB(id) {
    const { data, error } = await supabase
        .from('creations')
        .select('svg_code, title, admin_ip')
        .eq('creationid', id)
        .single();
    if (error || !data) {
        alert("Mindmap nicht gefunden.");
        return;
    }
    mindmapTitle = data.title || "mindmap";
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(data.svg_code, "image/svg+xml");
    const loadedSVG = svgDoc.documentElement;
    svg.innerHTML = loadedSVG.innerHTML; // Inhalte übernehmen
    svg.setAttribute("viewBox", loadedSVG.getAttribute("viewBox") || "0 0 1000 600");
    // Initialisiere geladene Knoten
    svg.querySelectorAll('g.draggable').forEach(group => {
        const id = group.dataset.nodeId || 'node' + allNodes.length;
        const transform = group.getAttribute("transform");
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        const x = parseFloat(match?.[1] || 0);
        const y = parseFloat(match?.[2] || 0);
        const type = group.dataset.type;
        const style = nodeStyles[type];
        const r = style?.r || 40;
        allNodes.push({ id, group, x, y, r: parseFloat(r) });
        // EventListener hinzufügen wie in createDraggableNode()
        addEventListenersToNode(group, id, parseFloat(r));
    });
    svg.querySelectorAll('line.connection-line').forEach(line => {
        const fromId = line.dataset.from;
        const toId = line.dataset.to;
        if (fromId && toId) {
            // Event-Handling hinzufügen
            line.addEventListener("click", e => {
                e.stopPropagation();
                if (selectedNode !== null) {
                    highlightNode(selectedNode, false);
                    selectedNode = null;
                }
                if (selectedConnection) {
                    selectedConnection.classList.remove("highlighted");
                }
                selectedConnection = line;
                selectedConnection.classList.add("highlighted");
            });
            line.addEventListener("contextmenu", e => {
                e.preventDefault();
                if (svg.contains(line)) {
                    svg.removeChild(line);
                }
                if (socket) {
                    socket.emit("connection-deleted", {
                        fromId: line.dataset.from,
                        toId: line.dataset.to
                    });
                    scheduleSVGSave();
                }
                allConnections = allConnections.filter(conn => conn.line !== line);
                if (selectedConnection === line) selectedConnection = null;
            })
            allConnections.push({ fromId, toId, line });
            if (socket) {
                socket.emit("connection-added", { fromId, toId });
                scheduleSVGSave();
            }
        }
    });
}

export function setupMindmap(shadowRoot) {
    shadowRoot.host.tabIndex = 0; // macht den Host "fokusierbar"
    shadowRoot.host.focus();      // setzt direkt den Fokus
    svg = shadowRoot.getElementById('mindmap');
    if (!svg) {
        console.error("SVG nicht im Shadow DOM gefunden!");
        return;
    }
    svg.style.touchAction = 'none';
    const saveBtn = shadowRoot.getElementById('saveButton');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentMindmap);
    }
    shadowRoot.querySelectorAll('.node-template').forEach(el => {
        el.addEventListener('dragstart', e => {
            draggedType = e.target.getAttribute('data-type');
        });
    });
    svg.addEventListener('dragover', e => e.preventDefault());
    svg.addEventListener('drop', e => {
        e.preventDefault();
        const svgPoint = getSVGPoint(e.clientX, e.clientY);
        createDraggableNode(svgPoint.x, svgPoint.y, draggedType);
    });
    svg.addEventListener('pointermove', e => {
        if (dragLine) {
            const svgPoint = getSVGPoint(e.clientX, e.clientY);
            dragLine.setAttribute("x2", svgPoint.x);
            dragLine.setAttribute("y2", svgPoint.y);
        }
    });
    dragLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    svg.appendChild(dragLine);
    if (dragLine) {
        svg.removeChild(dragLine);
        dragLine = null;
    }
    svg.addEventListener('click', () => {
        if (selectedNode) {
            highlightNode(selectedNode, false);
            selectedNode = null;
        }
        if (selectedConnection) {
            selectedConnection.classList.remove('highlighted');
            selectedConnection = null;
        }
    });
    const confirmBtn = shadowRoot.getElementById('confirmLockBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (userToLock) {
                await lockUserByNickname(userToLock);
                const messageBox = shadowRoot.getElementById('overlayMessage');
                messageBox.textContent = `locking IP from "${userToLock}" was successful.`;
                shadowRoot.querySelector('.overlay-buttons').style.display = 'none';
                setTimeout(() => {
                    shadowRoot.getElementById('ipLockOverlay').style.display = 'none';
                    shadowRoot.querySelector('.overlay-buttons').style.display = 'flex';
                    userToLock = null;
                }, 2000);
            }
        });
    }
    const cancelBtn = shadowRoot.getElementById('cancelLockBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            shadowRoot.getElementById('ipLockOverlay').style.display = 'none';
            userToLock = null;
        });
    }
    shadowRoot.host.addEventListener("keydown", (e) => {
        const path = e.composedPath();
        const isTyping = path.some(el =>
            el instanceof HTMLElement &&
            (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
        );
        if (isTyping) return;
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                viewBox.y -= panStep * (viewBox.h / initialViewBoxSize);
                updateViewBox();
                break;
            case 's':
            case 'arrowdown':
                viewBox.y += panStep * (viewBox.h / initialViewBoxSize);
                updateViewBox();
                break;
            case 'a':
            case 'arrowleft':
                viewBox.x -= panStep * (viewBox.w / initialViewBoxSize);
                updateViewBox();
                break;
            case 'd':
            case 'arrowright':
                viewBox.x += panStep * (viewBox.w / initialViewBoxSize);
                updateViewBox();
                break;
        }
    });

    // Drag-Bewegung
    svg.addEventListener('pointermove', e => {
        if (!dragTarget) return;
        const point = getSVGPoint(e.clientX, e.clientY);
        const id = dragTarget.dataset.nodeId;
        const node = allNodes.find(n => n.id === id);
        if (!node) return;
        const newX = point.x - offset.x;
        const newY = point.y - offset.y;
        dragTarget.setAttribute("transform", `translate(${newX}, ${newY})`);
        node.x = newX;
        node.y = newY;
        if (socket) {
            socket.emit("node-moving", {
                id: node.id,
                x: node.x,
                y: node.y,
            });
        }
        console.log(" node-moving gesendet", node.id, node.x, node.y);
        updateConnections(id);
    });
    // Deselect auf SVG-Klick
    svg.addEventListener('click', () => {
        if (selectedNode !== null) {
            highlightNode(selectedNode, false);
            selectedNode = null;
        }
        if (selectedConnection) {
            selectedConnection.classList.remove('highlighted');
            selectedConnection = null;
        }
    });
    // Delete-Taste zum Entfernen von Knoten oder Verbindung
    document.addEventListener('keydown', (e) => {
        const path = e.composedPath();
        const isTyping = path.some(el =>
            el instanceof HTMLElement &&
            (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
        );
        if (isTyping) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            if (selectedConnection) {
                const fromId = selectedConnection.dataset.from;
                const toId = selectedConnection.dataset.to;
                if (svg.contains(selectedConnection)) {
                    svg.removeChild(selectedConnection);
                }
                allConnections = allConnections.filter(conn =>
                    conn.line !== selectedConnection
                );
                selectedConnection = null;
                if (socket) {
                    socket.emit("connection-deleted", {
                        fromId,
                        toId
                    });
                    scheduleSVGSave();
                }
                return;
            }
            if (selectedNode) {
                const nodeIndex = allNodes.findIndex(n => n.id === selectedNode);
                if (nodeIndex === -1) return;
                const node = allNodes[nodeIndex];
                svg.removeChild(node.group);
                allNodes.splice(nodeIndex, 1);
                if (socket) {
                    socket.emit("node-deleted", { id: selectedNode });
                    scheduleSVGSave();
                }
                // Verbindungen mit dem Knoten entfernen
                allConnections = allConnections.filter(conn => {
                    if (conn.fromId === selectedNode || conn.toId === selectedNode) {
                        svg.removeChild(conn.line);
                        return false;
                    }
                    return true;
                });
                selectedNode = null;
            }
        }
    });
    svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    // Zoom mit Mausrad
    svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        // Zoomrichtung
        zoom += e.deltaY > 0 ? -zoomStep : zoomStep;
        zoom = Math.min(Math.max(zoom, minZoom), maxZoom);
        // Zoom um Mausposition (optional)
        const mouseSVG = getSVGPoint(e.clientX, e.clientY);
        // Neue ViewBox-Größe basierend auf Zoom
        const newWidth = initialViewBoxSize / zoom;
        const newHeight = initialViewBoxSize / zoom;
        // ViewBox so verschieben, dass Zoom um Mausposition bleibt
        viewBox.x = mouseSVG.x - (mouseSVG.x - viewBox.x) * (newWidth / viewBox.w);
        viewBox.y = mouseSVG.y - (mouseSVG.y - viewBox.y) * (newHeight / viewBox.h);
        viewBox.w = newWidth;
        viewBox.h = newHeight;
        updateViewBox();
    });
    function updateViewBox() {
        svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    }
    const downloadBtn = shadowRoot.getElementById('downloadbtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const pdfElement = shadowRoot.getElementById('mindmap');
            if (pdfElement) {
                exportMindmapToPDF(pdfElement);
            } else {
                console.error("PDF nicht gefunden für Export.");
            }
        });
    }
    initializeAccessControl(shadowRoot);
    // Falls eine ID vorhanden ist, lade die Mindmap
    if (mindmapId) {
        loadMindmapFromDB(mindmapId);
    }
    console.log("✅ Mindmap im Shadow DOM vollständig initialisiert");
}

function exportMindmapAsSVG(svgElement) {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindmap.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}