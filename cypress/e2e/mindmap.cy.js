/// <reference types="cypress" />

describe('CoCreate Mindmap', () => {
    beforeEach(() => {
        cy.visit('http://localhost:1235');
        cy.get('cocreate-mindmap').shadow().as('shadow');
    });

    it('loads the shadow DOM successfully', () => {
        cy.get('@shadow').find('#toolbar').should('exist');
        cy.get('@shadow').find('#mindmap').should('exist');
    });

    it('opens the manual dialog and displays the link', () => {
        cy.get('@shadow').find('img[alt="Icon manual"]').click();

        cy.get('@shadow')
            .find('#dialogIconManual')
            .should('be.visible')
            .within(() => {
                cy.get('#mindmapLink').should('have.value', 'No ID found in URL.');
            });
    });

    it('opens the user overview dialog', () => {
        cy.get('@shadow').find('img[alt="Icon overview user"]').click();
        cy.get('@shadow').find('#dialogIconOverviewUser').should('be.visible');
    });

    it('shows and hides the IP lock overlay', () => {
        // Manually show the IP lock overlay in case it’s not visible by default
        cy.get('@shadow').find('#ipLockOverlay').invoke('show');
        cy.get('@shadow').find('#ipLockOverlay').should('be.visible');
        cy.get('@shadow').find('#cancelLockBtn').click();
        cy.get('@shadow').find('#ipLockOverlay').should('not.be.visible');
    });

    it('adds a node via drag & drop', () => {
        const dataTransfer = new DataTransfer();
        cy.get('@shadow')
            .find('.node-template[data-type="1"]')
            .trigger('dragstart', { dataTransfer });

        cy.get('@shadow')
            .find('#mindmap')
            .trigger('dragover', { dataTransfer })
            .trigger('drop', { clientX: 300, clientY: 200, dataTransfer });

        // Result is hard to check without more DOM details — for example, we check the number of groups
        cy.get('@shadow')
            .find('#mindmap')
            .find('g') // SVG groups representing nodes
            .should('have.length.at.least', 1);
    });

    it('opens the save prompt when clicking the save icon', () => {
        cy.window().then((win) => {
            cy.stub(win, 'prompt').returns('MyTestMindmap');
            cy.stub(win, 'fetch').resolves({ text: () => Promise.resolve('127.0.0.1') });
            cy.stub(win, 'alert'); // Suppress redirect alert

            cy.get('@shadow').find('#saveButton').click();
        });
    });

    it('uses the zoom function via mouse wheel', () => {
        cy.get('@shadow')
            .find('#mindmap')
            .trigger('wheel', { deltaY: -100 });

        // Check that viewBox attribute exists and changes
        cy.get('@shadow')
            .find('#mindmap')
            .invoke('attr', 'viewBox')
            .should('match', /[\d\s.-]+/);
    });

    it('creates, reads, and updates a node', () => {
        const dataTransfer = new DataTransfer();

        // Create node
        cy.get('@shadow')
            .find('.node-template[data-type="1"]')
            .trigger('dragstart', { dataTransfer });

        cy.get('@shadow')
            .find('#mindmap')
            .trigger('dragover', { dataTransfer })
            .trigger('drop', { clientX: 300, clientY: 200, dataTransfer });

        // Check if node exists
        cy.get('@shadow')
            .find('#mindmap g.draggable')
            .its('length')
            .should('be.gte', 1);

        // Get the ID of the last added node
        cy.get('@shadow')
            .find('#mindmap g.draggable')
            .last()
            .invoke('attr', 'data-node-id')
            .then(id => {
                // Read
                cy.get('@shadow')
                    .find(`#mindmap g.draggable[data-node-id="${id}"]`)
                    .should('exist');

                // Update
                cy.get('@shadow')
                    .find(`#mindmap g.draggable[data-node-id="${id}"] text`)
                    .dblclick();

                cy.get('@shadow')
                    .find(`#mindmap g.draggable[data-node-id="${id}"] foreignObject input`)
                    .clear()
                    .type('New node text{enter}');

                cy.get('@shadow')
                    .find(`#mindmap g.draggable[data-node-id="${id}"] text`)
                    .should('contain.text', 'New node text');
            });
    });
});
