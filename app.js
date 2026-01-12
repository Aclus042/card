/* =====================================================
   NARRATIVE CARDS - WORLDBUILDING TOOL
   JavaScript Application
   ===================================================== */

// =====================================================
// DATA STORE
// =====================================================

class DataStore {
    constructor() {
        this.cards = [];
        this.navigationHistory = [];
    }

    generateId() {
        return 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    createCard(cardData) {
        const card = {
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...cardData
        };
        this.cards.push(card);
        return card;
    }

    updateCard(id, cardData) {
        const index = this.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            this.cards[index] = {
                ...this.cards[index],
                ...cardData,
                updatedAt: new Date().toISOString()
            };
            return this.cards[index];
        }
        return null;
    }

    deleteCard(id) {
        const index = this.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            // Remove references to this card from other cards
            this.cards.forEach(card => {
                if (card.adjacentLocations) {
                    card.adjacentLocations = card.adjacentLocations.filter(loc => loc !== id);
                }
                if (card.presentCharacters) {
                    card.presentCharacters = card.presentCharacters.filter(char => char !== id);
                }
                if (card.bonds) {
                    card.bonds = card.bonds.filter(bond => bond !== id);
                }
            });
            
            this.cards.splice(index, 1);
            return true;
        }
        return false;
    }

    getCard(id) {
        return this.cards.find(c => c.id === id);
    }

    getCardsByType(type) {
        return this.cards.filter(c => c.type === type);
    }

    getAllCards() {
        return this.cards;
    }

    searchCards(query) {
        const lowerQuery = query.toLowerCase();
        return this.cards.filter(card => 
            card.name.toLowerCase().includes(lowerQuery) ||
            (card.description && card.description.toLowerCase().includes(lowerQuery))
        );
    }

    pushToHistory(cardId) {
        this.navigationHistory.push(cardId);
        if (this.navigationHistory.length > 20) {
            this.navigationHistory.shift();
        }
    }

    getLastFromHistory() {
        return this.navigationHistory.pop();
    }
}

// =====================================================
// UI CONTROLLER
// =====================================================

class UIController {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.currentView = 'cards';
        this.currentCard = null;
        this.currentFilter = 'all';
        this.selectedType = null;
        this.editingCardId = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderCardsList();
        this.updateWelcomeScreen();
    }

    bindEvents() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.showView(view);
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Search input
        document.getElementById('search-cards').addEventListener('input', (e) => {
            this.filterCardsList(e.target.value);
        });

        // Type selection buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.selectType(type);
            });
        });

        // Form submission
        document.getElementById('card-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Connection selectors
        this.bindConnectionSelectors();

        // Modal overlay click to close
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    bindConnectionSelectors() {
        const selectors = [
            { select: 'adjacent-locations-select', container: 'selected-adjacent', type: 'local' },
            { select: 'present-characters-select', container: 'selected-characters', type: 'personagem' },
            { select: 'bonds-select', container: 'selected-bonds', type: 'personagem' }
        ];

        selectors.forEach(({ select, container }) => {
            const selectEl = document.getElementById(select);
            if (selectEl) {
                selectEl.addEventListener('change', (e) => {
                    const cardId = e.target.value;
                    if (cardId) {
                        this.addConnectionTag(cardId, container);
                        e.target.value = '';
                    }
                });
            }
        });
    }

    addConnectionTag(cardId, containerId) {
        const container = document.getElementById(containerId);
        const card = this.dataStore.getCard(cardId);
        
        if (!card) return;
        
        // Check if already added
        if (container.querySelector(`[data-card-id="${cardId}"]`)) return;

        const tag = document.createElement('div');
        tag.className = 'selected-connection';
        tag.dataset.cardId = cardId;
        tag.innerHTML = `
            <span>${card.name}</span>
            <button type="button" class="remove-connection" onclick="ui.removeConnectionTag('${cardId}', '${containerId}')">×</button>
        `;
        container.appendChild(tag);
    }

    removeConnectionTag(cardId, containerId) {
        const container = document.getElementById(containerId);
        const tag = container.querySelector(`[data-card-id="${cardId}"]`);
        if (tag) {
            tag.remove();
        }
    }

    getSelectedConnections(containerId) {
        const container = document.getElementById(containerId);
        return Array.from(container.querySelectorAll('.selected-connection')).map(
            tag => tag.dataset.cardId
        );
    }

    showView(view) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');

        this.currentView = view;

        if (view === 'cards') {
            if (!this.currentCard) {
                this.updateWelcomeScreen();
            }
        } else if (view === 'create') {
            this.resetForm();
        }

        // Update breadcrumb
        this.updateBreadcrumb();
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderCardsList();
    }

    filterCardsList(query) {
        const cards = query ? this.dataStore.searchCards(query) : this.dataStore.getAllCards();
        this.renderCardsList(cards);
    }

    renderCardsList(cards = null) {
        const list = document.getElementById('cards-list');
        let filteredCards = cards || this.dataStore.getAllCards();

        if (this.currentFilter !== 'all') {
            filteredCards = filteredCards.filter(c => c.type === this.currentFilter);
        }

        if (filteredCards.length === 0) {
            list.innerHTML = `
                <li class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>Nenhum card encontrado</p>
                </li>
            `;
            return;
        }

        list.innerHTML = filteredCards.map(card => `
            <li class="card-list-item ${this.currentCard && this.currentCard.id === card.id ? 'active' : ''}" 
                onclick="ui.openCard('${card.id}')">
                <span class="type-dot ${card.type}"></span>
                <span class="card-name">${this.escapeHtml(card.name)}</span>
            </li>
        `).join('');
    }

    updateWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcome-screen');
        const cardDisplay = document.getElementById('card-display');
        
        const hasCards = this.dataStore.getAllCards().length > 0;
        
        if (this.currentCard) {
            welcomeScreen.style.display = 'none';
            cardDisplay.classList.add('active');
        } else {
            welcomeScreen.style.display = 'flex';
            cardDisplay.classList.remove('active');
            cardDisplay.innerHTML = '';
        }
    }

    openCard(cardId, animation = 'default') {
        const card = this.dataStore.getCard(cardId);
        if (!card) return;

        // Push current card to history before navigating
        if (this.currentCard) {
            this.dataStore.pushToHistory(this.currentCard.id);
        }

        this.currentCard = card;
        this.showView('cards');
        this.renderCard(card, animation);
        this.renderCardsList();
        this.updateBreadcrumb();
        this.updateWelcomeScreen();
    }

    renderCard(card, animation = 'default') {
        const display = document.getElementById('card-display');
        display.classList.add('active');
        document.getElementById('welcome-screen').style.display = 'none';

        let animationClass = 'narrative-card';
        if (animation === 'left') animationClass += ' card-slide-left';
        else if (animation === 'right') animationClass += ' card-slide-right';

        let html = `
            <div class="${animationClass}">
                <div class="card-header ${card.type}">
                    <span class="card-type-badge ${card.type}">
                        ${this.getTypeIcon(card.type)} ${this.getTypeName(card.type)}
                    </span>
                    <h1 class="card-title">${this.escapeHtml(card.name)}</h1>
                    <div class="card-actions">
                        <button class="card-action-btn" onclick="ui.editCard('${card.id}')" title="Editar">
                            ✎
                        </button>
                        <button class="card-action-btn delete" onclick="ui.confirmDeleteCard('${card.id}')" title="Excluir">
                            🗑
                        </button>
                    </div>
                </div>
                <div class="card-body">
        `;

        // Render type-specific content
        if (card.type === 'personagem') {
            html += this.renderCharacterContent(card);
        } else if (card.type === 'local') {
            html += this.renderLocationContent(card);
        } else if (card.type === 'evento') {
            html += this.renderEventContent(card);
        }

        html += `
                </div>
            </div>
        `;

        display.innerHTML = html;
    }

    renderEventContent(card) {
        let html = '';

        if (card.description) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">O que acontece</h3>
                    <div class="card-section-content">${this.formatText(card.description)}</div>
                </div>
            `;
        }

        if (card.consequences) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Consequências Narrativas</h3>
                    <div class="card-section-content">${this.formatText(card.consequences)}</div>
                </div>
            `;
        }

        if (card.hooks) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Possíveis Ganchos</h3>
                    <div class="card-section-content">${this.formatText(card.hooks)}</div>
                </div>
            `;
        }

        return html;
    }

    renderLocationContent(card) {
        let html = '';

        if (card.description) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Descrição</h3>
                    <div class="card-section-content">${this.formatText(card.description)}</div>
                </div>
            `;
        }

        // Adjacent Locations
        if (card.adjacentLocations && card.adjacentLocations.length > 0) {
            const locations = card.adjacentLocations
                .map(id => this.dataStore.getCard(id))
                .filter(c => c);

            if (locations.length > 0) {
                html += `
                    <div class="connections-section">
                        <h3 class="connections-title">
                            🏛 Locais Adjacentes
                        </h3>
                        <div class="connections-list">
                            ${locations.map(loc => `
                                <span class="connection-tag local" onclick="ui.openCard('${loc.id}', 'left')">
                                    <span class="connection-icon">→</span>
                                    ${this.escapeHtml(loc.name)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // Present Characters
        if (card.presentCharacters && card.presentCharacters.length > 0) {
            const characters = card.presentCharacters
                .map(id => this.dataStore.getCard(id))
                .filter(c => c);

            if (characters.length > 0) {
                html += `
                    <div class="connections-section">
                        <h3 class="connections-title">
                            👤 Personagens Presentes
                        </h3>
                        <div class="connections-list">
                            ${characters.map(char => `
                                <span class="connection-tag personagem" onclick="ui.openCard('${char.id}', 'left')">
                                    <span class="connection-icon">→</span>
                                    ${this.escapeHtml(char.name)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        return html;
    }

    renderCharacterContent(card) {
        let html = '';

        // Meta info
        if (card.occupation || card.age) {
            html += `<div class="card-meta">`;
            if (card.occupation) {
                html += `
                    <div class="meta-item">
                        <span class="meta-label">Ocupação</span>
                        <span class="meta-value">${this.escapeHtml(card.occupation)}</span>
                    </div>
                `;
            }
            if (card.age) {
                html += `
                    <div class="meta-item">
                        <span class="meta-label">Idade</span>
                        <span class="meta-value">${this.escapeHtml(card.age)}</span>
                    </div>
                `;
            }
            html += `</div>`;
        }

        if (card.description) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Descrição</h3>
                    <div class="card-section-content">${this.formatText(card.description)}</div>
                </div>
            `;
        }

        if (card.appearance) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Aparência</h3>
                    <div class="card-section-content">${this.formatText(card.appearance)}</div>
                </div>
            `;
        }

        if (card.personality) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Personalidade</h3>
                    <div class="card-section-content">${this.formatText(card.personality)}</div>
                </div>
            `;
        }

        if (card.history) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">História</h3>
                    <div class="card-section-content">${this.formatText(card.history)}</div>
                </div>
            `;
        }

        if (card.secrets) {
            html += `
                <div class="card-section">
                    <h3 class="card-section-title">Segredos ou Motivações</h3>
                    <div class="card-section-content">${this.formatText(card.secrets)}</div>
                </div>
            `;
        }

        // Bonds
        if (card.bonds && card.bonds.length > 0) {
            const bondCards = card.bonds
                .map(id => this.dataStore.getCard(id))
                .filter(c => c);

            if (bondCards.length > 0) {
                html += `
                    <div class="connections-section">
                        <h3 class="connections-title">
                            🔗 Vínculos
                        </h3>
                        <div class="connections-list">
                            ${bondCards.map(bond => `
                                <span class="connection-tag personagem" onclick="ui.openCard('${bond.id}', 'left')">
                                    <span class="connection-icon">→</span>
                                    ${this.escapeHtml(bond.name)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        return html;
    }

    selectType(type) {
        this.selectedType = type;

        // Update type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Show common fields
        document.getElementById('common-fields').style.display = 'block';
        document.getElementById('form-actions').style.display = 'flex';

        // Hide all type-specific fields
        document.querySelectorAll('.type-fields').forEach(el => {
            el.style.display = 'none';
        });

        // Show selected type fields
        document.getElementById(`${type}-fields`).style.display = 'block';

        // Populate connection selectors
        this.populateConnectionSelectors();
    }

    populateConnectionSelectors() {
        // Adjacent locations (only other locations)
        const adjacentSelect = document.getElementById('adjacent-locations-select');
        if (adjacentSelect) {
            const locations = this.dataStore.getCardsByType('local')
                .filter(c => !this.editingCardId || c.id !== this.editingCardId);
            adjacentSelect.innerHTML = `
                <option value="">+ Adicionar local adjacente...</option>
                ${locations.map(loc => `
                    <option value="${loc.id}">${this.escapeHtml(loc.name)}</option>
                `).join('')}
            `;
        }

        // Present characters
        const charactersSelect = document.getElementById('present-characters-select');
        if (charactersSelect) {
            const characters = this.dataStore.getCardsByType('personagem');
            charactersSelect.innerHTML = `
                <option value="">+ Adicionar personagem...</option>
                ${characters.map(char => `
                    <option value="${char.id}">${this.escapeHtml(char.name)}</option>
                `).join('')}
            `;
        }

        // Bonds
        const bondsSelect = document.getElementById('bonds-select');
        if (bondsSelect) {
            const characters = this.dataStore.getCardsByType('personagem')
                .filter(c => !this.editingCardId || c.id !== this.editingCardId);
            bondsSelect.innerHTML = `
                <option value="">+ Adicionar vínculo...</option>
                ${characters.map(char => `
                    <option value="${char.id}">${this.escapeHtml(char.name)}</option>
                `).join('')}
            `;
        }
    }

    handleFormSubmit() {
        const name = document.getElementById('card-name').value.trim();
        
        if (!this.selectedType) {
            this.showToast('Selecione um tipo de card', 'error');
            return;
        }

        if (!name) {
            this.showToast('Digite um nome para o card', 'error');
            return;
        }

        const cardData = {
            type: this.selectedType,
            name: name,
            description: document.getElementById('card-description').value.trim()
        };

        // Type-specific fields
        if (this.selectedType === 'evento') {
            cardData.consequences = document.getElementById('evento-consequences').value.trim();
            cardData.hooks = document.getElementById('evento-hooks').value.trim();
        } else if (this.selectedType === 'local') {
            cardData.adjacentLocations = this.getSelectedConnections('selected-adjacent');
            cardData.presentCharacters = this.getSelectedConnections('selected-characters');
        } else if (this.selectedType === 'personagem') {
            cardData.occupation = document.getElementById('personagem-occupation').value.trim();
            cardData.age = document.getElementById('personagem-age').value.trim();
            cardData.appearance = document.getElementById('personagem-appearance').value.trim();
            cardData.personality = document.getElementById('personagem-personality').value.trim();
            cardData.history = document.getElementById('personagem-history').value.trim();
            cardData.secrets = document.getElementById('personagem-secrets').value.trim();
            cardData.bonds = this.getSelectedConnections('selected-bonds');
        }

        let card;
        if (this.editingCardId) {
            card = this.dataStore.updateCard(this.editingCardId, cardData);
            this.showToast('Card atualizado com sucesso!', 'success');
        } else {
            card = this.dataStore.createCard(cardData);
            this.showToast('Card criado com sucesso!', 'success');
        }

        this.renderCardsList();
        this.openCard(card.id);
        this.resetForm();
    }

    editCard(cardId) {
        const card = this.dataStore.getCard(cardId);
        if (!card) return;

        this.editingCardId = cardId;
        this.showView('create');

        // Update form title
        document.getElementById('form-title').textContent = 'Editar Card';
        document.getElementById('submit-text').textContent = 'Salvar Alterações';

        // Set type
        this.selectType(card.type);

        // Populate common fields
        document.getElementById('card-name').value = card.name || '';
        document.getElementById('card-description').value = card.description || '';

        // Populate type-specific fields
        if (card.type === 'evento') {
            document.getElementById('evento-consequences').value = card.consequences || '';
            document.getElementById('evento-hooks').value = card.hooks || '';
        } else if (card.type === 'local') {
            // Clear and repopulate connections
            document.getElementById('selected-adjacent').innerHTML = '';
            document.getElementById('selected-characters').innerHTML = '';
            
            if (card.adjacentLocations) {
                card.adjacentLocations.forEach(id => {
                    this.addConnectionTag(id, 'selected-adjacent');
                });
            }
            if (card.presentCharacters) {
                card.presentCharacters.forEach(id => {
                    this.addConnectionTag(id, 'selected-characters');
                });
            }
        } else if (card.type === 'personagem') {
            document.getElementById('personagem-occupation').value = card.occupation || '';
            document.getElementById('personagem-age').value = card.age || '';
            document.getElementById('personagem-appearance').value = card.appearance || '';
            document.getElementById('personagem-personality').value = card.personality || '';
            document.getElementById('personagem-history').value = card.history || '';
            document.getElementById('personagem-secrets').value = card.secrets || '';
            
            // Clear and repopulate bonds
            document.getElementById('selected-bonds').innerHTML = '';
            if (card.bonds) {
                card.bonds.forEach(id => {
                    this.addConnectionTag(id, 'selected-bonds');
                });
            }
        }
    }

    confirmDeleteCard(cardId) {
        const card = this.dataStore.getCard(cardId);
        if (!card) return;

        const confirmed = confirm(`Tem certeza que deseja excluir "${card.name}"?\n\nEsta ação não pode ser desfeita.`);
        
        if (confirmed) {
            this.dataStore.deleteCard(cardId);
            this.showToast('Card excluído', 'info');
            this.currentCard = null;
            this.renderCardsList();
            this.updateWelcomeScreen();
            this.updateBreadcrumb();
        }
    }

    resetForm() {
        this.editingCardId = null;
        this.selectedType = null;

        document.getElementById('form-title').textContent = 'Criar Novo Card';
        document.getElementById('submit-text').textContent = 'Criar Card';

        // Reset type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Hide fields
        document.getElementById('common-fields').style.display = 'none';
        document.getElementById('form-actions').style.display = 'none';
        document.querySelectorAll('.type-fields').forEach(el => {
            el.style.display = 'none';
        });

        // Clear all inputs
        document.getElementById('card-form').reset();

        // Clear connection containers
        document.getElementById('selected-adjacent').innerHTML = '';
        document.getElementById('selected-characters').innerHTML = '';
        document.getElementById('selected-bonds').innerHTML = '';
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        let html = `<span class="breadcrumb-home" onclick="goHome()">Início</span>`;

        if (this.currentView === 'create') {
            html += `
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-item">${this.editingCardId ? 'Editar Card' : 'Criar Card'}</span>
            `;
        } else if (this.currentCard) {
            html += `
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-item">${this.escapeHtml(this.currentCard.name)}</span>
            `;
        }

        breadcrumb.innerHTML = html;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ';
        if (type === 'success') icon = '✓';
        else if (type === 'error') icon = '✕';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    }

    getTypeIcon(type) {
        const icons = {
            evento: '⚡',
            local: '🏛',
            personagem: '👤'
        };
        return icons[type] || '◇';
    }

    getTypeName(type) {
        const names = {
            evento: 'Evento',
            local: 'Local',
            personagem: 'Personagem'
        };
        return names[type] || type;
    }

    formatText(text) {
        if (!text) return '';
        return text.split('\n').map(line => 
            `<p>${this.escapeHtml(line) || '&nbsp;'}</p>`
        ).join('');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// =====================================================
// GLOBAL FUNCTIONS
// =====================================================

let dataStore;
let ui;

function initApp() {
    dataStore = new DataStore();
    ui = new UIController(dataStore);
}

function showView(view) {
    ui.showView(view);
}

function goHome() {
    ui.currentCard = null;
    ui.showView('cards');
    ui.updateWelcomeScreen();
    ui.updateBreadcrumb();
}

function resetForm() {
    ui.resetForm();
    ui.showView('cards');
}

function exportCards() {
    const cards = dataStore.getAllCards();
    
    if (cards.length === 0) {
        ui.showToast('Nenhum card para exportar', 'error');
        return;
    }
    
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        cards: cards
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `narrative-cards-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ui.showToast(`${cards.length} cards exportados com sucesso!`, 'success');
}

function importCards(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.cards || !Array.isArray(data.cards)) {
                throw new Error('Formato de arquivo inválido');
            }
            
            const existingIds = dataStore.getAllCards().map(c => c.id);
            let imported = 0;
            let skipped = 0;
            
            // Create a mapping for old IDs to new IDs
            const idMapping = {};
            
            // First pass: create all cards with new IDs
            data.cards.forEach(card => {
                const oldId = card.id;
                const newId = dataStore.generateId();
                idMapping[oldId] = newId;
            });
            
            // Second pass: import cards with updated references
            data.cards.forEach(card => {
                const newCard = { ...card };
                newCard.id = idMapping[card.id];
                
                // Update connection references
                if (newCard.adjacentLocations) {
                    newCard.adjacentLocations = newCard.adjacentLocations
                        .map(id => idMapping[id] || id)
                        .filter(id => id);
                }
                if (newCard.presentCharacters) {
                    newCard.presentCharacters = newCard.presentCharacters
                        .map(id => idMapping[id] || id)
                        .filter(id => id);
                }
                if (newCard.bonds) {
                    newCard.bonds = newCard.bonds
                        .map(id => idMapping[id] || id)
                        .filter(id => id);
                }
                
                newCard.createdAt = new Date().toISOString();
                newCard.updatedAt = new Date().toISOString();
                
                dataStore.cards.push(newCard);
                imported++;
            });
            
            ui.renderCardsList();
            ui.updateWelcomeScreen();
            
            ui.showToast(`${imported} cards importados com sucesso!`, 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            ui.showToast('Erro ao importar: arquivo inválido', 'error');
        }
    };
    
    reader.onerror = function() {
        ui.showToast('Erro ao ler o arquivo', 'error');
    };
    
    reader.readAsText(file);
    
    // Reset input so the same file can be selected again
    event.target.value = '';
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
