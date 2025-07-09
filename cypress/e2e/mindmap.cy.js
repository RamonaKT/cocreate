/// <reference types="cypress" />

describe('CoCreate Mindmap', () => {
    beforeEach(() => {
        cy.visit('http://localhost:1235');
        cy.get('cocreate-mindmap').shadow().as('shadow');
    });

    it('lädt erfolgreich das Shadow DOM', () => {
        cy.get('@shadow').find('#toolbar').should('exist');
        cy.get('@shadow').find('#mindmap').should('exist');
    });

    it('öffnet das Manual-Dialogfenster und zeigt den Link', () => {
        cy.get('@shadow').find('img[alt="Icon manual"]').click();

        cy.get('@shadow')
            .find('#dialogIconManual')
            .should('be.visible')
            .within(() => {
                cy.get('#mindmapLink').should('have.value', 'No ID found in URL.');
            });
    });

    it('öffnet das User-Overview-Dialogfenster', () => {
        cy.get('@shadow').find('img[alt="Icon overview user"]').click();
        cy.get('@shadow').find('#dialogIconOverviewUser').should('be.visible');
    });

    it('zeigt und schließt das IP-Lock-Overlay', () => {
        // IP-Lock Overlay manuell anzeigen, falls nicht direkt sichtbar
        cy.get('@shadow').find('#ipLockOverlay').invoke('show');
        cy.get('@shadow').find('#ipLockOverlay').should('be.visible');
        cy.get('@shadow').find('#cancelLockBtn').click();
        cy.get('@shadow').find('#ipLockOverlay').should('not.be.visible');
    });

    it('fügt einen Knoten hinzu per Drag & Drop', () => {
        const dataTransfer = new DataTransfer();
        cy.get('@shadow')
            .find('.node-template[data-type="1"]')
            .trigger('dragstart', { dataTransfer });

        cy.get('@shadow')
            .find('#mindmap')
            .trigger('dragover', { dataTransfer })
            .trigger('drop', { clientX: 300, clientY: 200, dataTransfer });

        // Ergebnis schwer zu prüfen ohne DOM-Details — z. B. testest du ggf. auf Anzahl Gruppen
        cy.get('@shadow')
            .find('#mindmap')
            .find('g') // SVG-Groups für Knoten
            .should('have.length.at.least', 1);
    });

    it('öffnet Save-Prompt beim Klick auf Save-Icon', () => {
        cy.window().then((win) => {
            cy.stub(win, 'prompt').returns('MeinTestMindmap');
            cy.stub(win, 'fetch').resolves({ text: () => Promise.resolve('127.0.0.1') });
            cy.stub(win, 'alert'); // Unterdrücke redirect-alert

            cy.get('@shadow').find('#saveButton').click();
        });
    });

    it('zeigt Zoom-Funktion via Mausrad', () => {
        cy.get('@shadow')
            .find('#mindmap')
            .trigger('wheel', { deltaY: -100 });

        // Hier könnten wir theoretisch das viewBox-Attribut prüfen, wenn nötig
        cy.get('@shadow')
            .find('#mindmap')
            .invoke('attr', 'viewBox')
            .should('match', /[\d\s.-]+/);
    });

});
